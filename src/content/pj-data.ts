import { historialSummaryOf } from './historial-data.ts';
import type { EntryMeta } from './types.ts';

export interface ActivePj {
  entry: EntryMeta<'pj'>;
  /** Date of the newest history entry, 'AAAA-MM-DD'. */
  last: string;
}

/** The active PJs with a history, latest activity first. */
export function recentActivePjs(entries: readonly EntryMeta[], count: number): ActivePj[] {
  const active = entries.flatMap((entry): ActivePj[] => {
    if (entry.data.type !== 'pj' || entry.data.estado !== 'activo') return [];
    const last = historialSummaryOf(entry.slug)?.last;
    return last ? [{ entry: entry as EntryMeta<'pj'>, last }] : [];
  });
  // ISO dates sort chronologically as plain text.
  active.sort((a, b) => (a.last === b.last ? 0 : a.last < b.last ? 1 : -1));
  return active.slice(0, count);
}
