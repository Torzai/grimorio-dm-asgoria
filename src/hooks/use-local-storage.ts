import { useCallback, useMemo, useSyncExternalStore } from 'react';

/*
 * localStorage that never breaks the app: when it is missing or throws (private mode, a full
 * quota, blocked site data), values live in memory for this tab. Every component that reads a
 * key shares one value, and a change made in another tab arrives through the 'storage' event.
 */

/** The raw text of every key read so far: what storage had, or what was written here. */
const memory = new Map<string, string | null>();
const listeners = new Map<string, Set<() => void>>();
let listeningToOtherTabs = false;

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readRaw(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(key) ?? null;
  } catch {
    // Unreadable storage: start from nothing.
  }
  memory.set(key, raw);
  return raw;
}

function writeRaw(key: string, raw: string) {
  memory.set(key, raw);
  try {
    storage()?.setItem(key, raw);
  } catch {
    // Kept in memory only; the app goes on.
  }
  notify(key);
}

function notify(key: string) {
  for (const listener of listeners.get(key) ?? []) listener();
}

function handleStorage(event: StorageEvent) {
  // A null key means another tab cleared the whole storage.
  const keys = event.key === null ? [...memory.keys()] : [event.key];
  for (const key of keys) {
    if (!listeners.has(key)) continue;
    memory.set(key, event.key === null ? null : event.newValue);
    notify(key);
  }
}

function subscribeTo(key: string, listener: () => void): () => void {
  if (!listeningToOtherTabs) {
    window.addEventListener('storage', handleStorage);
    listeningToOtherTabs = true;
  }
  let forKey = listeners.get(key);
  if (!forKey) listeners.set(key, (forKey = new Set()));
  forKey.add(listener);
  return () => {
    forKey.delete(listener);
    if (forKey.size === 0) listeners.delete(key);
  };
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * A JSON value kept under a key. `parse` turns whatever is stored (undefined when nothing or
 * broken JSON) into a valid value; it must be a stable function, such as a module-level one.
 */
export function useLocalStorage<T>(
  key: string,
  parse: (stored: unknown) => T,
): [T, (update: (previous: T) => T) => void] {
  const raw = useSyncExternalStore(
    useCallback((listener: () => void) => subscribeTo(key, listener), [key]),
    () => readRaw(key),
    () => null,
  );
  const value = useMemo(() => parse(parseJson(raw)), [parse, raw]);
  const update = useCallback(
    (next: (previous: T) => T) => {
      const previous = parse(parseJson(readRaw(key)));
      const value = next(previous);
      // Returning the same value is a no-op: nothing is written and nobody re-renders.
      if (value !== previous) writeRaw(key, JSON.stringify(value));
    },
    [key, parse],
  );
  return [value, update];
}
