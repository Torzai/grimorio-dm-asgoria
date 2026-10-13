import { matchesAll } from '@/content/highlight';
import type { HistorialItemMeta, NameCount } from '@/content/historial-items';
import { normalize } from '@/content/normalize';

/** The history filters, as read from the URL (?q=&dm=&con=&anio=, or ?autor= in a crónica). */
export interface HistorialFilters {
  /** Normalized words of ?q=, all required. */
  terms: readonly string[];
  /** Narrator's (author's) name. */
  author?: string;
  /** A participant's name. */
  con?: string;
  /** 'AAAA' */
  year?: string;
}

export interface HistorialGroup {
  /** 'AAAA'; '' when the history is not grouped by year. */
  year: string;
  /** Entries of the group that pass the filters, in the history's order. */
  items: HistorialItemMeta[];
  /** Entries of the group, filtered or not. */
  total: number;
}

const sameName = (a: string, b: string) => normalize(a) === normalize(b);

export function hasFilters({ terms, author, con }: HistorialFilters): boolean {
  return terms.length > 0 || author !== undefined || con !== undefined;
}

/** What the search terms are looked for in: the whole text, or the preview while it loads. */
export type SearchTextOf = (item: HistorialItemMeta) => string;

/**
 * The entries that pass every filter: grouped by year, newest first, when `byYear`; else in one
 * group, in the history's order. `keep` is shown even when it doesn't pass them: it is the entry
 * a link points to.
 */
export function groupHistorial(
  items: readonly HistorialItemMeta[],
  filters: HistorialFilters,
  searchTextOf: SearchTextOf,
  { keep, byYear }: { keep?: string; byYear: boolean },
): HistorialGroup[] {
  const groups = new Map<string, HistorialGroup>();
  for (const item of items) {
    const year = byYear ? item.date.slice(0, 4) : '';
    const group = groups.get(year) ?? { year, items: [], total: 0 };
    groups.set(year, group);
    group.total += 1;
    if (item.id === keep || passes(item, filters, searchTextOf)) group.items.push(item);
  }
  return [...groups.values()]
    .filter(
      (group) =>
        group.items.length > 0 &&
        (!byYear ||
          !filters.year ||
          group.year === filters.year ||
          group.items.some((item) => item.id === keep)),
    )
    .sort((a, b) => (a.year < b.year ? 1 : -1));
}

function passes(
  item: HistorialItemMeta,
  { terms, author, con }: HistorialFilters,
  searchTextOf: SearchTextOf,
): boolean {
  if (author && !sameName(item.authorName, author)) return false;
  if (con && !item.participantes.some((name) => sameName(name, con))) return false;
  return terms.length === 0 || matchesAll(searchTextOf(item), terms);
}

/** Every participant with how many entries they appear in, alphabetically, for the 'Con:' chip. */
export function participantOptions(
  items: readonly HistorialItemMeta[],
  ownNames: readonly string[],
): NameCount[] {
  const own = new Set(ownNames.map(normalize));
  const counts = new Map<string, NameCount>();
  for (const item of items) {
    for (const name of item.participantes) {
      const key = normalize(name);
      if (own.has(key)) continue;
      const current = counts.get(key) ?? { name, count: 0 };
      current.count += 1;
      counts.set(key, current);
    }
  }
  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
