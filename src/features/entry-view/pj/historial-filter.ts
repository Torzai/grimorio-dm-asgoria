import { normalize } from '@/content/normalize';
import type { HistorialItem, NameCount } from '@/content/pj-historial';
import { matchesAll } from './highlight';

/** The history filters, as read from the URL (?q=&dm=&con=&anio=). */
export interface HistorialFilters {
  /** Normalized words of ?q=, all required. */
  terms: readonly string[];
  /** Narrator's name. */
  dm?: string;
  /** A participant's name. */
  con?: string;
  /** 'AAAA' */
  year?: string;
}

export interface YearGroup {
  year: string;
  /** Entries of the year that pass the filters, newest first. */
  items: HistorialItem[];
  /** Entries of the year, filtered or not. */
  total: number;
}

const sameName = (a: string, b: string) => normalize(a) === normalize(b);

export function hasFilters({ terms, dm, con }: HistorialFilters): boolean {
  return terms.length > 0 || dm !== undefined || con !== undefined;
}

/**
 * The entries that pass every filter, grouped by year, newest first. `keep` is shown even
 * when it doesn't pass them: it is the entry a link points to.
 */
export function groupHistorial(
  items: readonly HistorialItem[],
  filters: HistorialFilters,
  keep?: string,
): YearGroup[] {
  const groups = new Map<string, YearGroup>();
  for (const item of items) {
    const year = item.date.slice(0, 4);
    const group = groups.get(year) ?? { year, items: [], total: 0 };
    groups.set(year, group);
    group.total += 1;
    if (item.id === keep || passes(item, filters)) group.items.push(item);
  }
  return [...groups.values()]
    .filter(
      (group) =>
        group.items.length > 0 &&
        (!filters.year ||
          group.year === filters.year ||
          group.items.some((item) => item.id === keep)),
    )
    .sort((a, b) => (a.year < b.year ? 1 : -1));
}

function passes(item: HistorialItem, { terms, dm, con }: HistorialFilters): boolean {
  if (dm && !sameName(item.authorName, dm)) return false;
  if (con && !item.participantes.some((name) => sameName(name, con))) return false;
  return matchesAll(item.searchText, terms);
}

/** Every participant with how many entries they appear in, alphabetically, for the 'Con:' chip. */
export function participantOptions(
  items: readonly HistorialItem[],
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
