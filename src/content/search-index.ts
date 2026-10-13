import MiniSearch, { type AsPlainObject, type Options } from 'minisearch';
import { normalize, withoutApostrophes } from './normalize.ts';
import type { HistorialItem } from './pj-historial.ts';
import type { Entry, EntryType } from './types.ts';

/** A result that is one entry of a PJ's history, not the whole entry. */
export interface HistorialHit {
  /** Anchor of the entry inside the PJ: 'h-2023-09-12-li-zakien'. */
  entryId: string;
  /** Title of the PJ, which the result's title starts with. */
  pjTitle: string;
}

export interface SearchResult {
  slug: string;
  type: EntryType;
  title: string;
  resumen?: string;
  zona?: string;
  /** Set when the result is a history entry; slug and type are then the PJ's. */
  historial?: HistorialHit;
  score: number;
}

export interface SearchOptions {
  type?: EntryType;
  /** Maximum number of results; 20 by default. */
  limit?: number;
}

type StoredResult = Omit<SearchResult, 'score'>;

/** Built once with buildIndex() (or loaded with loadIndex()) and passed to search(). */
export interface SearchIndex {
  engine: MiniSearch<IndexedDocument>;
  /** Result fields by document id, kept here so results stay typed. */
  stored: Map<string, StoredResult>;
}

/** What the build writes and the browser reads back with loadIndex(). */
export interface SerializedIndex {
  engine: AsPlainObject;
  stored: [string, StoredResult][];
}

interface IndexedDocument {
  /** The slug, or '<slug>#<entryId>' for a history entry. */
  id: string;
  title: string;
  aliases: string;
  tags: string;
  resumen: string;
  body: string;
}

/** What buildIndex needs from a PJ's history, already split at build time. */
export interface PjSearchSource {
  /** The body without the '## Historial' section. */
  fichaBody: string;
  items: readonly Pick<HistorialItem, 'id' | 'date' | 'authorName' | 'participantes' | 'recompensa' | 'bodyMarkdown'>[];
}

const FIELDS = ['title', 'aliases', 'tags', 'resumen', 'body'];
const BOOST = { title: 4, aliases: 3, tags: 2, resumen: 1.5, body: 1 };
const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'a', 'un', 'una']);
// Also splits on symbols such as '|', so '[[slug|texto]]' indexes 'texto' on its own.
const SEPARATORS = /[\n\r\p{Z}\p{P}\p{S}]+/u;

/** Apostrophes join instead of split: "Drak'Nar" is one word, 'draknar'. */
function tokenize(text: string): string[] {
  return withoutApostrophes(text).split(SEPARATORS);
}

/** Same in indexing and in queries: lowercase, no accents or apostrophes, no stopwords. */
function processTerm(term: string): string | null {
  const normalized = normalize(withoutApostrophes(term));
  return normalized && !STOPWORDS.has(normalized) ? normalized : null;
}

// Identical when building and when loading: a serialized index keeps no functions.
const OPTIONS: Options<IndexedDocument> = {
  idField: 'id',
  fields: FIELDS,
  tokenize,
  processTerm,
  searchOptions: { boost: BOOST, prefix: true, fuzzy: 0.2 },
};

/** '2023-09-12' → '12/09/2023'. */
function numericDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Indexes every entry. A PJ with its history in `historiales` is indexed without it, and each
 * history entry becomes a document of its own ('<slug>#<entryId>').
 */
export function buildIndex(
  entries: readonly Entry[],
  historiales: ReadonlyMap<string, PjSearchSource> = new Map(),
): SearchIndex {
  const engine = new MiniSearch<IndexedDocument>(OPTIONS);
  const stored = new Map<string, StoredResult>();

  for (const { slug, type, data, body } of entries) {
    const historial = type === 'pj' ? historiales.get(slug) : undefined;
    const { title, resumen, zona } = data;
    engine.add({
      id: slug,
      title,
      aliases: (data.aliases ?? []).join(' '),
      tags: (data.tags ?? []).join(' '),
      resumen: resumen ?? '',
      body: historial ? historial.fichaBody : body,
    });
    stored.set(slug, {
      slug,
      type,
      title,
      ...(resumen === undefined ? {} : { resumen }),
      ...(zona === undefined ? {} : { zona }),
    });

    for (const item of historial?.items ?? []) {
      const id = `${slug}#${item.id}`;
      const itemTitle = `${title} · ${numericDate(item.date)} · ${item.authorName}`;
      engine.add({
        id,
        title: itemTitle,
        aliases: '',
        tags: '',
        resumen: item.participantes.join(' '),
        body: [item.bodyMarkdown, item.recompensa ?? ''].join('\n'),
      });
      stored.set(id, { slug, type, title: itemTitle, historial: { entryId: item.id, pjTitle: title } });
    }
  }
  return { engine, stored };
}

export function serializeIndex(index: SearchIndex): SerializedIndex {
  return { engine: index.engine.toJSON(), stored: [...index.stored] };
}

export function loadIndex(serialized: SerializedIndex): SearchIndex {
  return {
    engine: MiniSearch.loadJS<IndexedDocument>(serialized.engine, OPTIONS),
    stored: new Map(serialized.stored),
  };
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
