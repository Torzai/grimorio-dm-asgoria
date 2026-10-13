import { useMemo } from 'react';
import { useContent } from '@/content/use-content';
import { useLocalStorage } from '@/hooks/use-local-storage';
import {
  MAX_RECENTS,
  PINS_KEY,
  RECENTS_KEY,
  itemKey,
  parseSavedItems,
  resolveItem,
  resolveItems,
  type ResolvedItem,
  type SavedItem,
} from './saved-items';

export interface Pins {
  /** The pins that still exist, the last pinned first. */
  pins: ResolvedItem[];
  isPinned: (item: SavedItem) => boolean;
  /** Pins or unpins; returns whether the item ends up pinned. */
  toggle: (item: SavedItem) => boolean;
  remove: (item: SavedItem) => void;
  clear: () => void;
}

export function usePins(): Pins {
  const { entries } = useContent();
  const [stored, update] = useLocalStorage(PINS_KEY, parseSavedItems);
  const pins = useMemo(() => resolveItems(stored, entries), [stored, entries]);
  const pinnedKeys = useMemo(() => new Set(pins.map((pin) => pin.key)), [pins]);

  // Writes drop what no longer exists, so the stored list doesn't keep dead items forever.
  const existing = (items: readonly SavedItem[]) =>
    items.filter((item) => resolveItem(item, entries) !== undefined);
  const without = (items: readonly SavedItem[], item: SavedItem) =>
    existing(items).filter((other) => itemKey(other) !== itemKey(item));

  const isPinned = (item: SavedItem) => pinnedKeys.has(itemKey(item));
  return {
    pins,
    isPinned,
    toggle(item) {
      const pin = !isPinned(item);
      update((previous) => (pin ? [item, ...without(previous, item)] : without(previous, item)));
      return pin;
    },
    remove: (item) => update((previous) => without(previous, item)),
    clear: () => update(() => []),
  };
}

export function useRecents(): { recents: ResolvedItem[]; add: (item: SavedItem) => void } {
  const { entries } = useContent();
  const [stored, update] = useLocalStorage(RECENTS_KEY, parseSavedItems);
  const recents = useMemo(() => resolveItems(stored, entries), [stored, entries]);
  return {
    recents,
    add(item) {
      update((previous) => {
        const others = previous.filter(
          (other) => itemKey(other) !== itemKey(item) && resolveItem(other, entries),
        );
        // Opening the newest one again changes nothing: no write, no re-render.
        if (previous.length > 0 && itemKey(previous[0]) === itemKey(item)) return previous;
        return [item, ...others].slice(0, MAX_RECENTS);
      });
    },
  };
}
