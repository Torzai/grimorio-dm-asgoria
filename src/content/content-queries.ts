import type { Content } from './build-content';
import { TYPE_NAV_ORDER } from './type-labels';
import { ENTRY_TYPES, type Entry, type EntryType } from './types';

export function isEntryType(value: string | undefined): value is EntryType {
  return ENTRY_TYPES.some((type) => type === value);
}

export function getEntry(
  entries: readonly Entry[],
  type: EntryType,
  slug: string,
): Entry | undefined {
  return entries.find((entry) => entry.type === type && entry.slug === slug);
}

export const FILTER_KEYS = ['zona', 'faccion', 'tag'] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

/** Selected value per filter; a missing or empty value means "no filter". */
export type EntryFilters = Partial<Record<FilterKey, string>>;

export interface FilterValue {
  /** What goes in the URL: a zona slug, a faction's exact text or a tag. */
  value: string;
  /** What the DM reads; for zonas, the title of the zona entry. */
  label: string;
  count: number;
}

export interface FilterGroup {
  key: FilterKey;
  values: FilterValue[];
}

// Spanish collation, ignoring case and accents: 'Álvaro' sorts next to 'Alba', not after 'Zoe'.
const collator = new Intl.Collator('es', { sensitivity: 'base' });

/** Filters that make sense for a type: no zona filter among zonas, factions only for NPCs. */
export function filterKeysFor(type: EntryType): FilterKey[] {
  return FILTER_KEYS.filter((key) => {
    if (key === 'zona') return type !== 'zona';
    if (key === 'faccion') return type === 'npc';
    return true;
  });
}

function filterValuesOf(entry: Entry, key: FilterKey): string[] {
  switch (key) {
    case 'zona':
      return entry.data.zona ? [entry.data.zona] : [];
    case 'faccion':
      return entry.data.type === 'npc' && entry.data.faccion ? [entry.data.faccion] : [];
    case 'tag':
      return entry.data.tags ?? [];
  }
}

function compareByTitle(a: Entry, b: Entry): number {
  return collator.compare(a.data.title, b.data.title) || collator.compare(a.slug, b.slug);
}

function compareByDateDesc(a: Entry, b: Entry): number {
  if (a.data.type !== 'sesion' || b.data.type !== 'sesion') return 0;
  // ISO dates (AAAA-MM-DD) sort chronologically as plain text.
  if (a.data.fecha !== b.data.fecha) return a.data.fecha < b.data.fecha ? 1 : -1;
  return compareByTitle(a, b);
}

/**
 * Entries of a type that match every active filter (AND), sorted for the list:
 * alphabetically by title, except the journal, which is newest first.
 * Filters that don't apply to the type are ignored.
 */
export function listEntries(
  entries: readonly Entry[],
  type: EntryType,
  filters: EntryFilters = {},
): Entry[] {
  const active = filterKeysFor(type).flatMap((key) => {
    const wanted = filters[key];
    return wanted ? [{ key, wanted }] : [];
  });
  return entries
    .filter(
      (entry) =>
        entry.type === type &&
        active.every(({ key, wanted }) => filterValuesOf(entry, key).includes(wanted)),
    )
    .sort(type === 'sesion' ? compareByDateDesc : compareByTitle);
}

/** Title of every zona entry by slug, to show a zona's name instead of its slug. */
export function getZoneTitles(entries: readonly Entry[]): Map<string, string> {
  const titles = new Map<string, string>();
  for (const entry of entries) {
    if (entry.type === 'zona') titles.set(entry.slug, entry.data.title);
  }
  return titles;
}

/**
 * The values each applicable filter can take in a type, with how many entries carry each.
 * Filters without any value are left out; values are sorted alphabetically by label.
 */
export function getFilterOptions(entries: readonly Entry[], type: EntryType): FilterGroup[] {
  const ofType = entries.filter((entry) => entry.type === type);
  const zoneTitles = getZoneTitles(entries);
  return filterKeysFor(type).flatMap((key) => {
    const counts = new Map<string, number>();
    for (const entry of ofType) {
      // A Set so a repeated tag in one entry doesn't count twice.
      for (const value of new Set(filterValuesOf(entry, key))) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    const values = [...counts].map(([value, count]) => ({
      value,
      label: key === 'zona' ? (zoneTitles.get(value) ?? value) : value,
      count,
    }));
    values.sort((a, b) => collator.compare(a.label, b.label) || collator.compare(a.value, b.value));
    return values.length > 0 ? [{ key, values }] : [];
  });
}

/** Number of entries of each type; types without entries count 0. */
export function countByType(entries: readonly Entry[]): Record<EntryType, number> {
  const counts = Object.fromEntries(ENTRY_TYPES.map((type) => [type, 0])) as Record<
    EntryType,
    number
  >;
  for (const entry of entries) counts[entry.type] += 1;
  return counts;
}

export interface EntryGroup {
  type: EntryType;
  entries: Entry[];
}

/** What the side panel of an entry shows; every list is empty when there is nothing to show. */
export interface EntryContext {
  /** The zona the entry belongs to, shown in the page's kicker. Undefined when there is none. */
  zona: Entry | undefined;
  /** The 'relacionados' that exist, in frontmatter order, plus a 'zona' that is not a zona. */
  related: Entry[];
  /** Entries that link here, except sessions, sorted by title. */
  mentionedIn: Entry[];
  /** Sessions that link here, newest first. */
  sessions: Entry[];
  /** For a zona: the entries that belong to it, grouped by type. */
  inZone: EntryGroup[];
}

/**
 * Everything the side panel needs, decided here so the component only renders.
 * Broken references ('zona' or 'relacionados' pointing nowhere) are left out: validate reports them.
 */
export function getEntryContext(
  entry: Entry,
  content: Pick<Content, 'entries' | 'links'>,
): EntryContext {
  const bySlug = new Map(content.entries.map((other) => [other.slug, other]));
  const find = (slugs: readonly string[] = []): Entry[] =>
    slugs.flatMap((slug) => {
      const found = bySlug.get(slug);
      return found ? [found] : [];
    });

  const [zonaTarget] = find(entry.data.zona ? [entry.data.zona] : []);
  const zona = zonaTarget?.type === 'zona' && zonaTarget !== entry ? zonaTarget : undefined;

  // The zona already sits in the kicker, so it is not repeated here. A 'zona' that points to
  // another type of entry can't go in the kicker, and shows up here instead.
  const candidates = [...(zonaTarget && !zona ? [zonaTarget] : []), ...find(entry.data.relacionados)];
  const related = candidates.filter(
    (other, index) => other !== entry && other !== zona && candidates.indexOf(other) === index,
  );

  const linking = find(content.links.backlinks.get(entry.slug));
  const mentionedIn = linking.filter((other) => other.type !== 'sesion').sort(compareByTitle);
  const sessions = linking.filter((other) => other.type === 'sesion').sort(compareByDateDesc);

  const inZone =
    entry.type === 'zona' ? groupByType(find(content.links.byZona.get(entry.slug)), entry) : [];

  return { zona, related, mentionedIn, sessions, inZone };
}

/** Entries grouped by type in sidebar order, each group sorted as its list is. */
function groupByType(entries: readonly Entry[], except: Entry): EntryGroup[] {
  return TYPE_NAV_ORDER.flatMap((type) => {
    const ofType = entries.filter((entry) => entry.type === type && entry !== except);
    ofType.sort(type === 'sesion' ? compareByDateDesc : compareByTitle);
    return ofType.length > 0 ? [{ type, entries: ofType }] : [];
  });
}
