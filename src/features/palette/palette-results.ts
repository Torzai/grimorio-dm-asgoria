import { createSearchParams, type To } from 'react-router';
import { HISTORIAL_PROFILES, isHistorialType } from '@/content/historial';
import { oficioAnchorSearch, parseOficioAnchor } from '@/content/oficio';
import type { SearchResult } from '@/content/search-index';
import { ENTRY_TYPES, type EntryType } from '@/content/types';

/** What a result is for the palette: its entry type, or 'historial' for a history entry. */
export type ResultKind = EntryType | 'historial';

/** Order of the type chips. */
export const KIND_ORDER: readonly ResultKind[] = [
  'pj',
  'npc',
  'historial',
  'lore',
  'cronica',
  'zona',
  'varita',
  'oficio',
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
  cronica: 'Situación por regiones',
  zona: 'Zonas',
  varita: 'Varitas',
  oficio: 'Oficios',
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
  cronica: 'situación',
  zona: 'zona',
  varita: 'varita',
  oficio: 'oficio',
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

/** The label at the right of a result: its kind, or which part of an oficio it is. */
export function resultTag(result: SearchResult): string {
  const part =
    result.type === 'oficio' && result.section
      ? parseOficioAnchor(result.section.anchor)
      : undefined;
  return part ? part.kind : KIND_TAGS[kindOf(result)];
}

/** One row of a result list: a result, or the "Ver N más" that leads to /buscar. */
export type ResultOption =
  | { key: string; kind: ResultKind; result: SearchResult }
  | { key: string; kind: ResultKind; more: number };

export interface ResultGroup {
  /** Unique among the groups shown together: the kind, or 'pins', 'recents'… */
  key: string;
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
    return { key: groupKind, kind: groupKind, label: KIND_LABELS[groupKind], options };
  });
}

export function resultKey(result: SearchResult): string {
  if (result.historial) return `${result.slug}#${result.historial.entryId}`;
  if (result.section) return `${result.slug}#${result.section.anchor}`;
  return `${result.type}/${result.slug}`;
}

/**
 * A history entry opens its parent on that entry, in the tab of the history, with the query as
 * the history's search so the words come highlighted. A block of a crónica's situation opens
 * the crónica on that block, and a recipe, component or skill its oficio in its tab, selected.
 */
export function resultTarget(result: SearchResult, query: string): To {
  const pathname = `/${result.type}/${result.slug}`;
  if (result.section) {
    const search = result.type === 'oficio' ? oficioAnchorSearch(result.section.anchor) : undefined;
    return search ? { pathname, search } : { pathname, hash: result.section.anchor };
  }
  if (!result.historial || !isHistorialType(result.type)) return pathname;
  const tab = HISTORIAL_PROFILES[result.type].tab;
  return {
    pathname,
    search: `?${createSearchParams({ tab, ...(query.trim() ? { q: query.trim() } : {}) })}`,
    hash: result.historial.entryId,
  };
}

/** /buscar with the query and, optionally, one kind. */
export function searchPageTarget(query: string, kind?: ResultKind): To {
  const params = createSearchParams({ q: query.trim(), ...(kind ? { type: kind } : {}) });
  return { pathname: '/buscar', search: `?${params}` };
}
