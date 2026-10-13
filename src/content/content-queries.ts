import type { Content } from './build-content.ts';
import { PJ_ESTADO_LABELS, TYPE_NAV_ORDER } from './type-labels.ts';
import { ENTRY_TYPES, type EntryMeta, type EntryType } from './types.ts';

export function isEntryType(value: string | undefined): value is EntryType {
  return ENTRY_TYPES.some((type) => type === value);
}

export function getEntry(
  entries: readonly EntryMeta[],
  type: EntryType,
  slug: string,
): EntryMeta | undefined {
  return entries.find((entry) => entry.type === type && entry.slug === slug);
}

export const FILTER_KEYS = ['zona', 'faccion', 'estado', 'sexo', 'tag'] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

/** Selected value per filter; a missing or empty value means "no filter". */
export type EntryFilters = Partial<Record<FilterKey, string>>;

export interface FilterValue {
  /** What goes in the URL: a zona slug, a faction's exact text, a PJ's estado or sexo, or a tag. */
  value: string;
  /** What the DM reads; for zonas, the title of the zona entry; for estados, 'Activo'… */
  label: string;
  count: number;
}

export interface FilterGroup {
  key: FilterKey;
  values: FilterValue[];
}

// Spanish collation, ignoring case and accents: 'Álvaro' sorts next to 'Alba', not after 'Zoe'.
const collator = new Intl.Collator('es', { sensitivity: 'base' });

/**
 * Filters that make sense for a type: no zona filter among zonas, factions only for NPCs and
 * estado and sexo only for PJs.
 */
export function filterKeysFor(type: EntryType): FilterKey[] {
  return FILTER_KEYS.filter((key) => {
    if (key === 'zona') return type !== 'zona';
    if (key === 'faccion') return type === 'npc';
    if (key === 'estado' || key === 'sexo') return type === 'pj';
    return true;
  });
}

function filterValuesOf(entry: EntryMeta, key: FilterKey): string[] {
  switch (key) {
    case 'zona':
      return entry.data.zona ? [entry.data.zona] : [];
    case 'faccion':
      return entry.data.type === 'npc' && entry.data.faccion ? [entry.data.faccion] : [];
    case 'estado':
      return entry.data.type === 'pj' ? [entry.data.estado] : [];
    case 'sexo':
      return entry.data.type === 'pj' && entry.data.sexo ? [entry.data.sexo] : [];
    case 'tag':
      return entry.data.tags ?? [];
  }
}

const estadoLabels: ReadonlyMap<string, string> = new Map(Object.entries(PJ_ESTADO_LABELS));

function filterLabel(key: FilterKey, value: string, zoneTitles: ReadonlyMap<string, string>) {
  if (key === 'zona') return zoneTitles.get(value) ?? value;
  if (key === 'estado') return estadoLabels.get(value) ?? value;
  return value;
}

function compareByTitle(a: EntryMeta, b: EntryMeta): number {
  return collator.compare(a.data.title, b.data.title) || collator.compare(a.slug, b.slug);
}

function compareByDateDesc(a: EntryMeta, b: EntryMeta): number {
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
  entries: readonly EntryMeta[],
  type: EntryType,
  filters: EntryFilters = {},
): EntryMeta[] {
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
export function getZoneTitles(entries: readonly EntryMeta[]): Map<string, string> {
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
export function getFilterOptions(entries: readonly EntryMeta[], type: EntryType): FilterGroup[] {
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
      label: filterLabel(key, value, zoneTitles),
      count,
    }));
    values.sort((a, b) => collator.compare(a.label, b.label) || collator.compare(a.value, b.value));
    return values.length > 0 ? [{ key, values }] : [];
  });
}

/** Number of entries of each type; types without entries count 0. */
export function countByType(entries: readonly EntryMeta[]): Record<EntryType, number> {
  const counts = Object.fromEntries(ENTRY_TYPES.map((type) => [type, 0])) as Record<
    EntryType,
    number
  >;
  for (const entry of entries) counts[entry.type] += 1;
  return counts;
}

export interface EntryGroup {
  type: EntryType;
  entries: EntryMeta[];
}

/** What the side panel of an entry shows; every list is empty when there is nothing to show. */
export interface EntryContext {
  /** The zona the entry belongs to, shown in the page's kicker. Undefined when there is none. */
  zona: EntryMeta | undefined;
  /** The 'relacionados' that exist, in frontmatter order, plus a 'zona' that is not a zona. */
  related: EntryMeta[];
  /** Entries that link here, except sessions, sorted by title. */
  mentionedIn: EntryMeta[];
  /** Sessions that link here, newest first. */
  sessions: EntryMeta[];
  /** For a zona: the entries that belong to it, grouped by type. */
  inZone: EntryGroup[];
}

/**
 * Everything the side panel needs, decided here so the component only renders.
 * Broken references ('zona' or 'relacionados' pointing nowhere) are left out: validate reports them.
 */
export function getEntryContext(
  entry: EntryMeta,
  content: Pick<Content, 'entries' | 'links'>,
): EntryContext {
  const bySlug = new Map(content.entries.map((other) => [other.slug, other]));
  const find = (slugs: readonly string[] = []): EntryMeta[] =>
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
function groupByType(entries: readonly EntryMeta[], except: EntryMeta): EntryGroup[] {
  return TYPE_NAV_ORDER.flatMap((type) => {
    const ofType = entries.filter((entry) => entry.type === type && entry !== except);
    ofType.sort(type === 'sesion' ? compareByDateDesc : compareByTitle);
    return ofType.length > 0 ? [{ type, entries: ofType }] : [];
  });
}
