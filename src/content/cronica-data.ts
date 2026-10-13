import { cronicas } from 'virtual:grimorio/content';
import type { CronicaMeta } from './cronica.ts';
import type { EntryMeta } from './types.ts';

/** What the build derived from a crónica; undefined for an unknown slug. */
export function cronicaMetaOf(slug: string): CronicaMeta | undefined {
  return cronicas[slug];
}

export interface UpdatedCronica {
  entry: EntryMeta<'cronica'>;
  /** Newest day among the posts and edits of its thread, 'AAAA-MM-DD'. */
  updated?: string;
}

/** The crónicas among `entries`, latest update first; those without dates go last. */
export function cronicasByUpdate(entries: readonly EntryMeta[]): UpdatedCronica[] {
  const list = entries.flatMap((entry): UpdatedCronica[] =>
    entry.data.type === 'cronica'
      ? [{ entry: entry as EntryMeta<'cronica'>, updated: cronicaMetaOf(entry.slug)?.updated }]
      : [],
  );
  // ISO dates sort chronologically as plain text.
  return list.sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''));
}
