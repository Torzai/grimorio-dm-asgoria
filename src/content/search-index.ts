import MiniSearch from 'minisearch';
import { normalize } from './normalize';
import type { Entry, EntryType } from './types';

export interface SearchResult {
  slug: string;
  type: EntryType;
  title: string;
  resumen?: string;
  zona?: string;
  score: number;
}

export interface SearchOptions {
  type?: EntryType;
  /** Maximum number of results; 20 by default. */
  limit?: number;
}

/** Built once with buildIndex() and passed to search(). */
export interface SearchIndex {
  engine: MiniSearch<IndexedDocument>;
  /** Result fields by slug, kept here so results stay typed. */
  stored: Map<string, Omit<SearchResult, 'score'>>;
}

interface IndexedDocument {
  slug: string;
  title: string;
  aliases: string;
  tags: string;
  resumen: string;
  body: string;
}

const FIELDS = ['title', 'aliases', 'tags', 'resumen', 'body'];
const BOOST = { title: 4, aliases: 3, tags: 2, resumen: 1.5, body: 1 };
const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'a', 'un', 'una']);
// Also splits on symbols such as '|', so '[[slug|texto]]' indexes 'texto' on its own.
const SEPARATORS = /[\n\r\p{Z}\p{P}\p{S}]+/u;

function tokenize(text: string): string[] {
  return text.split(SEPARATORS);
}

/** Same in indexing and in queries: lowercase, no accents, no stopwords. */
function processTerm(term: string): string | null {
  const normalized = normalize(term);
  return normalized && !STOPWORDS.has(normalized) ? normalized : null;
}

export function buildIndex(entries: readonly Entry[]): SearchIndex {
  const engine = new MiniSearch<IndexedDocument>({
    idField: 'slug',
    fields: FIELDS,
    tokenize,
    processTerm,
    searchOptions: { boost: BOOST, prefix: true, fuzzy: 0.2 },
  });
  engine.addAll(
    entries.map(({ slug, data, body }) => ({
      slug,
      title: data.title,
      aliases: (data.aliases ?? []).join(' '),
      tags: (data.tags ?? []).join(' '),
      resumen: data.resumen ?? '',
      body,
    })),
  );

  const stored = new Map(
    entries.map(({ slug, type, data: { title, resumen, zona } }) => [
      slug,
      {
        slug,
        type,
        title,
        ...(resumen === undefined ? {} : { resumen }),
        ...(zona === undefined ? {} : { zona }),
      },
    ]),
  );
  return { engine, stored };
}

/**
 * Fuzzy, prefix search that needs every word ('AND'); if nothing matches,
 * it retries accepting any word ('OR'). Results are sorted by score.
 */
export function search(
  index: SearchIndex,
  query: string,
  { type, limit = 20 }: SearchOptions = {},
): SearchResult[] {
  if (!query.trim()) return [];

  const filter = type
    ? (result: { id: unknown }) => index.stored.get(String(result.id))?.type === type
    : undefined;
  let matches = index.engine.search(query, { combineWith: 'AND', filter });
  if (matches.length === 0) {
    matches = index.engine.search(query, { combineWith: 'OR', filter });
  }

  const results: SearchResult[] = [];
  for (const match of matches.slice(0, limit)) {
    const stored = index.stored.get(String(match.id));
    if (stored) results.push({ ...stored, score: match.score });
  }
  return results;
}
