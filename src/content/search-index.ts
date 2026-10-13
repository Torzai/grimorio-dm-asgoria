import MiniSearch, { type AsPlainObject, type Options } from 'minisearch';
import { normalize, withoutApostrophes } from './normalize.ts';
import type { Entry, EntryType } from './types.ts';

/** A result that is one entry of a history (a PJ's quest, a crónica's annex). */
export interface HistorialHit {
  /** Anchor of the entry inside its parent: 'h-2023-09-12-li-zakien'. */
  entryId: string;
  /** Title of the parent entry, which the result's title starts with. */
  parentTitle: string;
}

/** A result that is one thematic block of an entry (a block of a crónica's situation). */
export interface SectionHit {
  /** Anchor of the block inside its parent: 's-magia'. */
  anchor: string;
  parentTitle: string;
}

export interface SearchResult {
  slug: string;
  type: EntryType;
  title: string;
  resumen?: string;
  zona?: string;
  /** Set when the result is a history entry; slug and type are then its parent's. */
  historial?: HistorialHit;
  /** Set when the result is a block of the parent's text; slug and type are the parent's. */
  section?: SectionHit;
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
  /** The slug, or '<slug>#<anchor>' for a part of an entry (history entry, block). */
  id: string;
  title: string;
  aliases: string;
  tags: string;
  resumen: string;
  body: string;
}

/** A part of an entry that is indexed as a result of its own ('<slug>#<anchor>'). */
export interface SubDocument {
  kind: 'historial' | 'section';
  /** 'h-2023-09-12-li-zakien', 's-magia' */
  anchor: string;
  title: string;
  /** Words weighted as a resumen: a quest's participants. */
  resumen?: string;
  body: string;
}

/** An entry split at build time: what stays in its own document, and its parts. */
export interface SearchSource {
  /** The body without its parts (a PJ without its history, a crónica without its situation). */
  body: string;
  parts: readonly SubDocument[];
}

const FIELDS = ['title', 'aliases', 'tags', 'resumen', 'body'];
const BOOST = { title: 4, aliases: 3, tags: 2, resumen: 1.5, body: 1 };
const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'a', 'un', 'una']);
// Also splits on symbols such as '|', so '[[slug|texto]]' indexes 'texto' on its own.
const SEPARATORS = /[\n\r\p{Z}\p{P}\p{S}]+/u;
/**
 * A part's title starts with its parent's name and its text often repeats it, so without this
 * the entries of a PJ outrank the PJ itself when searching for its name.
 */
const HISTORIAL_BOOST = 0.5;

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

/**
 * Indexes every entry. An entry split in `sources` is indexed with the body left there, and
 * each of its parts becomes a document of its own ('<slug>#<anchor>').
 */
export function buildIndex(
  entries: readonly Entry[],
  sources: ReadonlyMap<string, SearchSource> = new Map(),
): SearchIndex {
  const engine = new MiniSearch<IndexedDocument>(OPTIONS);
  const stored = new Map<string, StoredResult>();

  for (const { slug, type, data, body } of entries) {
    const source = sources.get(slug);
    const { title, resumen, zona } = data;
    engine.add({
      id: slug,
      title,
      aliases: (data.aliases ?? []).join(' '),
      tags: (data.tags ?? []).join(' '),
      resumen: resumen ?? '',
      body: source ? source.body : body,
    });
    stored.set(slug, {
      slug,
      type,
      title,
      ...(resumen === undefined ? {} : { resumen }),
      ...(zona === undefined ? {} : { zona }),
    });

    for (const part of source?.parts ?? []) {
      const id = `${slug}#${part.anchor}`;
      engine.add({
        id,
        title: part.title,
        aliases: '',
        tags: '',
        resumen: part.resumen ?? '',
        body: part.body,
      });
      stored.set(id, {
        slug,
        type,
        title: part.title,
        ...(part.kind === 'historial'
          ? { historial: { entryId: part.anchor, parentTitle: title } }
          : { section: { anchor: part.anchor, parentTitle: title } }),
      });
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
  const boostDocument = (id: unknown) => (String(id).includes('#') ? HISTORIAL_BOOST : 1);
  let matches = index.engine.search(query, { combineWith: 'AND', filter, boostDocument });
  if (matches.length === 0) {
    matches = index.engine.search(query, { combineWith: 'OR', filter, boostDocument });
  }

  const results: SearchResult[] = [];
  for (const match of matches.slice(0, limit)) {
    const stored = index.stored.get(String(match.id));
    if (stored) results.push({ ...stored, score: match.score });
  }
  return results;
}
