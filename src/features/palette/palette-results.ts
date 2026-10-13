import { createSearchParams, type To } from 'react-router';
import { pjSummaryOf } from '@/content/pj-data';
import type { SearchResult } from '@/content/search-index';
import { ENTRY_TYPES, type EntryMeta, type EntryType } from '@/content/types';

/** What a result is for the palette: its entry type, or 'historial' for a history entry. */
export type ResultKind = EntryType | 'historial';

/** Order of the type chips. */
export const KIND_ORDER: readonly ResultKind[] = [
  'pj',
  'npc',
  'historial',
  'lore',
  'zona',
  'varita',
  'comando',
  'herramienta',
  'sesion',
];

/** Chip and group heading of each kind. */
export const KIND_LABELS: Readonly<Record<ResultKind, string>> = {
  pj: 'PJ',
  npc: 'NPCs',
  historial: 'Historial',
  lore: 'Lore',
  zona: 'Zonas',
  varita: 'Varitas',
  comando: 'Comandos',
  herramienta: 'Herramientas',
  sesion: 'Sesiones',
};

/** The short label at the right of each result, in mono. */
export const KIND_TAGS: Readonly<Record<ResultKind, string>> = {
  pj: 'pj',
  npc: 'npc',
  historial: 'historial',
  lore: 'lore',
  zona: 'zona',
  varita: 'varita',
  comando: 'comando',
  herramienta: 'herramienta',
  sesion: 'sesión',
};

export function isResultKind(value: string | null | undefined): value is ResultKind {
  return value === 'historial' || ENTRY_TYPES.some((type) => type === value);
}

export function kindOf(result: SearchResult): ResultKind {
  return result.historial ? 'historial' : result.type;
}

/** One row of a result list: a result, or the "Ver N más" that leads to /buscar. */
export type ResultOption =
  | { key: string; kind: ResultKind; result: SearchResult }
  | { key: string; kind: ResultKind; more: number };

export interface ResultGroup {
  kind: ResultKind;
  label: string;
  options: ResultOption[];
}

export interface GroupOptions {
  /** Only results of this kind. */
  kind?: ResultKind;
  /** Results shown per group; the rest become a "Ver N más" row. */
  maxPerGroup?: number;
}

/** The kinds that have results, in chip order. */
export function kindsWithResults(results: readonly SearchResult[]): ResultKind[] {
  const present = new Set(results.map(kindOf));
  return KIND_ORDER.filter((kind) => present.has(kind));
}

/**
 * Results grouped by kind. Results come sorted by score, so the group of the best result goes
 * first, and so on.
 */
export function groupResults(
  results: readonly SearchResult[],
  { kind, maxPerGroup = Infinity }: GroupOptions = {},
): ResultGroup[] {
  const byKind = new Map<ResultKind, SearchResult[]>();
  for (const result of results) {
    const resultKind = kindOf(result);
    if (kind && resultKind !== kind) continue;
    let group = byKind.get(resultKind);
    if (!group) byKind.set(resultKind, (group = []));
    group.push(result);
  }
  return [...byKind].map(([groupKind, ofKind]) => {
    const options: ResultOption[] = ofKind
      .slice(0, maxPerGroup)
      .map((result) => ({ key: resultKey(result), kind: groupKind, result }));
    const more = ofKind.length - options.length;
    if (more > 0) options.push({ key: `more:${groupKind}`, kind: groupKind, more });
    return { kind: groupKind, label: KIND_LABELS[groupKind], options };
  });
}

export function resultKey(result: SearchResult): string {
  return result.historial
    ? `${result.slug}#${result.historial.entryId}`
    : `${result.type}/${result.slug}`;
}

/**
 * A history entry opens its PJ on that entry, with the query as the history's search so the
 * words come highlighted.
 */
export function resultTarget(result: SearchResult, query: string): To {
  if (!result.historial) return `/${result.type}/${result.slug}`;
  return {
    pathname: `/${result.type}/${result.slug}`,
    search: `?${createSearchParams({ tab: 'historial', q: query.trim() })}`,
    hash: result.historial.entryId,
  };
}

/** /buscar with the query and, optionally, one kind. */
export function searchPageTarget(query: string, kind?: ResultKind): To {
  const params = createSearchParams({ q: query.trim(), ...(kind ? { type: kind } : {}) });
  return { pathname: '/buscar', search: `?${params}` };
}

/** What the palette suggests without a query: the active PJs with the latest activity. */
export function recentActivePjs(entries: readonly EntryMeta[], count = 8): SearchResult[] {
  const active = entries.flatMap((entry) => {
    if (entry.data.type !== 'pj' || entry.data.estado !== 'activo') return [];
    const last = pjSummaryOf(entry.slug)?.last;
    return last ? [{ entry, last }] : [];
  });
  // ISO dates sort chronologically as plain text.
  active.sort((a, b) => (a.last === b.last ? 0 : a.last < b.last ? 1 : -1));
  return active.slice(0, count).map(({ entry }) => ({
    slug: entry.slug,
    type: entry.type,
    title: entry.data.title,
    score: 0,
  }));
}
