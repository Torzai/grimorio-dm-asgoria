import type { To } from 'react-router';
import { isEntryType } from '@/content/content-queries';
import { isHistorialType, type HistorialType } from '@/content/historial';
import { historialItemsOf } from '@/content/historial-data';
import type { SearchResult } from '@/content/search-index';
import type { EntryMeta, EntryType } from '@/content/types';
import { formatNumericDate } from '@/features/entry-list/entry-meta';
import { KIND_TAGS, type ResultKind } from '@/features/palette/palette-results';

/*
 * Pins and recents: what the DM keeps at hand during a session. Each is an entry (type + slug)
 * or one entry of a history, a PJ's or a crónica's (slug + entryId), stored newest first in
 * localStorage.
 */

export const PINS_KEY = 'grimorio.pins.v1';
export const RECENTS_KEY = 'grimorio.recents.v1';
export const MAX_RECENTS = 10;

/** An entry, or a history entry when entryId is set (type is then a HistorialType). */
export interface SavedItem {
  type: EntryType;
  slug: string;
  entryId?: string;
}

/** A saved item that still exists, ready to show. */
export interface ResolvedItem {
  item: SavedItem;
  key: string;
  /** The entry's title; '<PJ> · DD/MM/AAAA' or '<crónica> · <annex>' for a history entry. */
  title: string;
  kind: ResultKind;
  /** Short label in mono: 'npc', 'pj', 'historial'… */
  tag: string;
  to: To;
  entry: EntryMeta;
}

export function itemKey({ type, slug, entryId }: SavedItem): string {
  return entryId ? `${type}/${slug}#${entryId}` : `${type}/${slug}`;
}

export function historialItem(type: HistorialType, slug: string, entryId: string): SavedItem {
  return { type, slug, entryId };
}

/** Whatever is stored, as a list of well-formed items without repeats. Anything else is dropped. */
export function parseSavedItems(stored: unknown): SavedItem[] {
  if (!Array.isArray(stored)) return [];
  const seen = new Set<string>();
  const items: SavedItem[] = [];
  for (const value of stored as unknown[]) {
    const item = asSavedItem(value);
    if (!item || seen.has(itemKey(item))) continue;
    seen.add(itemKey(item));
    items.push(item);
  }
  return items;
}

function asSavedItem(value: unknown): SavedItem | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { type, slug, entryId } = value as Record<string, unknown>;
  if (typeof type !== 'string' || !isEntryType(type) || typeof slug !== 'string') return undefined;
  if (entryId === undefined) return { type, slug };
  return typeof entryId === 'string' && isHistorialType(type) ? { type, slug, entryId } : undefined;
}

const lookups = new WeakMap<readonly EntryMeta[], Map<string, EntryMeta>>();

/** Entries by 'type/slug', built once per content. */
function lookupOf(entries: readonly EntryMeta[]): Map<string, EntryMeta> {
  let lookup = lookups.get(entries);
  if (!lookup) {
    lookup = new Map(entries.map((entry) => [`${entry.type}/${entry.slug}`, entry]));
    lookups.set(entries, lookup);
  }
  return lookup;
}

/** The item ready to show, or undefined when its entry (or history entry) no longer exists. */
export function resolveItem(
  item: SavedItem,
  entries: readonly EntryMeta[],
): ResolvedItem | undefined {
  const entry = lookupOf(entries).get(`${item.type}/${item.slug}`);
  if (!entry) return undefined;
  const key = itemKey(item);
  if (!item.entryId) {
    return {
      item,
      key,
      title: entry.data.title,
      kind: entry.type,
      tag: KIND_TAGS[entry.type],
      to: `/${entry.type}/${entry.slug}`,
      entry,
    };
  }
  const historial = historialItemsOf(entry.slug).find((candidate) => candidate.id === item.entryId);
  if (!historial) return undefined;
  return {
    item,
    key,
    title: `${entry.data.title} · ${historial.title ?? formatNumericDate(historial.date)}`,
    kind: 'historial',
    tag: KIND_TAGS.historial,
    to: { pathname: `/${entry.type}/${entry.slug}`, hash: historial.id },
    entry,
  };
}

/** The items that still exist, in order. */
export function resolveItems(
  items: readonly SavedItem[],
  entries: readonly EntryMeta[],
): ResolvedItem[] {
  return items.flatMap((item) => {
    const resolved = resolveItem(item, entries);
    return resolved ? [resolved] : [];
  });
}

/** What a search result pins: its entry, or its history entry; a block pins its entry. */
export function itemOfResult(result: SearchResult): SavedItem {
  return result.historial && isHistorialType(result.type)
    ? historialItem(result.type, result.slug, result.historial.entryId)
    : { type: result.type, slug: result.slug };
}

/** A resolved item as a palette result, so the palette lists and opens it as any other. */
export function resultOfItem({ item, entry, title }: ResolvedItem): SearchResult {
  const { resumen, zona } = entry.data;
  return {
    slug: entry.slug,
    type: entry.type,
    title,
    ...(resumen === undefined ? {} : { resumen }),
    ...(zona === undefined ? {} : { zona }),
    ...(item.entryId
      ? { historial: { entryId: item.entryId, parentTitle: entry.data.title } }
      : {}),
    score: 0,
  };
}
