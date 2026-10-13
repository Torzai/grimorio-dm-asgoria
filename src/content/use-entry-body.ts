import { useEffect, useState } from 'react';
import { importBody } from './load-from-glob.ts';

// Bodies already loaded, and the ones on their way, by path. They are kept for the session:
// opening an entry again shows its body at once.
const bodies = new Map<string, string>();
const loading = new Map<string, Promise<string>>();

/** The body of an entry by its path ('content/npc/x.md'), from memory or from its chunk. */
export function loadEntryBody(path: string): Promise<string> {
  const cached = bodies.get(path);
  if (cached !== undefined) return Promise.resolve(cached);
  let promise = loading.get(path);
  if (!promise) {
    promise = importBody(path).then(
      (body) => {
        bodies.set(path, body);
        loading.delete(path);
        return body;
      },
      (error: unknown) => {
        // Forgotten, so the next attempt imports it again.
        loading.delete(path);
        throw error;
      },
    );
    loading.set(path, promise);
  }
  return promise;
}

/**
 * The body of an entry, or undefined while it loads. Starts loading it when the component
 * mounts and when the path changes.
 */
export function useEntryBody(path: string): string | undefined {
  // The path the state belongs to, so another entry's body is never shown for this one.
  const [loaded, setLoaded] = useState<{ path: string; body: string }>();

  useEffect(() => {
    if (bodies.has(path)) return;
    let current = true;
    loadEntryBody(path).then(
      (body) => {
        if (current) setLoaded({ path, body });
      },
      (error: unknown) => console.error(`No se pudo cargar ${path}`, error),
    );
    return () => {
      current = false;
    };
  }, [path]);

  return bodies.get(path) ?? (loaded?.path === path ? loaded.body : undefined);
}
