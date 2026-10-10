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

/** Number of entries of each type; types without entries count 0. */
export function countByType(entries: readonly Entry[]): Record<EntryType, number> {
  const counts = Object.fromEntries(ENTRY_TYPES.map((type) => [type, 0])) as Record<
    EntryType,
    number
  >;
  for (const entry of entries) counts[entry.type] += 1;
  return counts;
}
