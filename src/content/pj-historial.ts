import type { Nodes, Root, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { normalize, withoutApostrophes } from './normalize.ts';
import { parseHistorial, type HistorialEntry } from './pj.ts';
import type { Entry, EntryMeta } from './types.ts';
import { parseWikilinks } from './wikilinks.ts';

/*
 * What the PJ view needs from a PJ's history. The content plugin (vite-plugin-content.ts)
 * splits every history at build time and hands the browser everything but the text of the
 * entries. The browser splits the body of a PJ with these same functions once it is loaded,
 * one entry at a time, to show the text of an entry or search the whole history.
 */

/** One history entry without its text: what the browser loads up front for every PJ. */
export interface HistorialItemMeta {
  /** Stable anchor: 'h-2023-09-12-li-zakien'. */
  id: string;
  /** 'AAAA-MM-DD' */
  date: string;
  authorName: string;
  authorHandle?: string;
  /** Names from the list that opens the entry; empty when it doesn't open with one. */
  participantes: string[];
  /** The reward line as plain text, without the leading 'Recompensa:'. */
  recompensa?: string;
  /** About the first 220 letters of the body, as plain text. */
  preview: string;
}

/** The text of a history entry, which comes with the PJ's body. */
export interface HistorialItemText {
  /** The Markdown shown when the entry is open: without the participants and the reward. */
  bodyMarkdown: string;
  /** Everything the in-history search looks into, normalized (lowercase, no accents). */
  searchText: string;
}

/** One history entry, ready to show. */
export interface HistorialItem extends HistorialItemMeta, HistorialItemText {}

export interface NameCount {
  name: string;
  count: number;
}

export interface YearCount {
  year: string;
  count: number;
}

/** Totals of a PJ's history: small, so the app loads them for every PJ up front. */
export interface PjSummary {
  total: number;
  /** Oldest and newest dates, 'AAAA-MM-DD'; undefined without entries. */
  first?: string;
  last?: string;
  /** Narrators with how many entries each, most first. */
  dms: NameCount[];
  /** The 8 names that most often share an entry with the PJ, most first. */
  companions: NameCount[];
  /** Entries per year, newest year first. */
  years: YearCount[];
}

export interface PjHistorialData {
  /** Newest first. */
  items: HistorialItem[];
  /** The body without the '## Historial' section, for the "Ficha y trasfondo" tab. */
  fichaBody: string;
}

export interface PjBuild {
  summary: PjSummary;
  data: PjHistorialData;
}

const PREVIEW_LENGTH = 220;
const TOP_COMPANIONS = 8;
const parser = unified().use(remarkParse).use(remarkGfm);

/** History, summary and ficha body of a PJ entry. */
export function buildPjHistorial(entry: Entry): PjBuild {
  const { entries, fichaBody } = parseHistorial(entry.body);
  const ownNames = ownNamesOf(entry);
  const items = entries.map((historialEntry) => historialItem(historialEntry, ownNames));
  // Newest first, whatever the order they are written in; stable for the same day.
  items.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  return { summary: summarize(items, ownNames), data: { items, fichaBody } };
}

/** The title and aliases of a PJ: the names that are the PJ itself in its history. */
export function ownNamesOf(entry: EntryMeta): string[] {
  return [entry.data.title, ...(entry.data.aliases ?? [])];
}

/** The item of one entry of parseHistorial(), with its text; ownNames from ownNamesOf(). */
export function historialItem(entry: HistorialEntry, ownNames: readonly string[]): HistorialItem {
  const root = parser.parse(entry.body);
  const removed: RootContent[] = [];

  const participantes = findParticipants(root.children, ownNames);
  if (participantes) removed.push(...participantes.nodes);

  const reward = findReward(root.children, removed);
  if (reward) removed.push(...reward.nodes);

  const bodyMarkdown = withoutNodes(entry.body, removed);
  const kept = root.children.filter((node) => !removed.includes(node));
  const text = collapse(kept.map(plainText).join('\n'));
  const names = participantes?.names ?? [];

  return {
    id: entry.id,
    date: entry.date,
    authorName: entry.authorName,
    ...(entry.authorHandle === undefined ? {} : { authorHandle: entry.authorHandle }),
    participantes: names,
    ...(reward ? { recompensa: reward.text } : {}),
    preview: truncate(text, PREVIEW_LENGTH),
    bodyMarkdown,
    searchText: searchTextOf(entry.authorName, names, text, reward?.text),
  };
}

/**
 * What the in-history search looks into while the text of the entry isn't loaded: the same
 * as searchText, with the preview in place of the whole text.
 */
export function previewSearchText(item: HistorialItemMeta): string {
  return searchTextOf(item.authorName, item.participantes, item.preview, item.recompensa);
}

function searchTextOf(
  authorName: string,
  names: readonly string[],
  text: string,
  reward = '',
): string {
  return normalize(withoutApostrophes([authorName, names.join(' '), text, reward].join('\n')));
}

// --- Participants ------------------------------------------------------------------------

/** 'Participantes:' and the like, which some DMs put before the list. */
const LIST_LABEL = /^(?:participantes|personajes|pjs?|jugadores)\s*:\s*/i;
/** ' - ', '–', ',', '/', a line break or ' y ' between names; 'Thyra- Ailyth' counts too. */
const NAME_SEPARATOR = /\s*[,/\n]\s*|\s+[-–—]\s*|\s*[-–—]\s+|\s+y\s+/;
/** Notes such as 'Elthair (se añadió casi al final)', closed or not. */
const PARENTHESIS = /\([^)]*\)?/g;
const NAME_WORD = /^[\p{L}][\p{L}'’.-]*$/u;
const PARTICLES = new Set(['de', 'del', 'la', 'van', 'von']);
const MIN_NAMES = 3;
const MAX_NAME_WORDS = 3;
/** A last item longer than this is a sentence that follows the names, not a name. */
const MAX_TAIL_WORDS = 4;
const MAX_TITLE_LENGTH = 80;
/** A title may hold ' - ' or ' y ' ('Cementerio profano XII - …'), but not these. */
const TITLE_LIST_SEPARATOR = /[,;/\n]/;

interface Participants {
  names: string[];
  /** The paragraphs that are only the list, which the open entry doesn't show again. */
  nodes: RootContent[];
}

interface NameList {
  names: string[];
  /** False when a sentence after the names was left out: the paragraph stays in the body. */
  onlyNames: boolean;
}

/**
 * The names of the paragraph that opens an entry, when it is a list of at least 3 names of
 * 1 to 3 capitalized words, or of 2 when one of them is the PJ ('Einar - Aen'). When the
 * entry opens with a short title ('Capítulo XXII…', 'Título: …'), the list is the paragraph
 * after it. A second list right after the first (jousts: spectators, then contenders) is
 * added to it.
 */
function findParticipants(
  nodes: readonly RootContent[],
  ownNames: readonly string[],
): Participants | undefined {
  const own = ownNameKeys(ownNames);
  const from = (start: number): Participants | undefined => {
    const first = namesOf(nodes[start], own);
    if (!first) return undefined;
    const second = namesOf(nodes[start + 1], own);
    const names = [...first.names];
    if (second) {
      const seen = new Set(first.names.map(normalize));
      names.push(...second.names.filter((name) => !seen.has(normalize(name))));
    }
    const lists = second ? [first, second] : [first];
    return {
      names,
      nodes: lists.flatMap((list, index) => (list.onlyNames ? [nodes[start + index]] : [])),
    };
  };
  return from(0) ?? (isTitle(nodes[0]) ? from(1) : undefined);
}

/** A short line that names the entry, which stays in the body. */
function isTitle(node: RootContent | undefined): boolean {
  if (node?.type !== 'paragraph') return false;
  const text = plainText(node).trim();
  return text !== '' && text.length <= MAX_TITLE_LENGTH && !TITLE_LIST_SEPARATOR.test(text);
}

/** Normalized title and aliases of the PJ, and the first word of each ('einar'). */
function ownNameKeys(ownNames: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (const name of ownNames) {
    const key = normalize(name).trim();
    if (key === '') continue;
    keys.add(key);
    keys.add(key.split(/\s+/)[0]);
  }
  return keys;
}

function namesOf(node: RootContent | undefined, own: ReadonlySet<string>): NameList | undefined {
  // '> Mirna - William - …' is still the list, quoted by mistake.
  const paragraph =
    node?.type === 'blockquote' && node.children.length === 1 ? node.children[0] : node;
  if (paragraph?.type !== 'paragraph') return undefined;

  const text = plainText(paragraph).replace(LIST_LABEL, '').replace(PARENTHESIS, ' ');
  const items = text
    .split(NAME_SEPARATOR)
    .map((item) => item.replace(/[.:;]+$/, '').trim())
    .filter((item) => item !== '');
  // 'Einar - Aen - Thyra - y se les unió un guardia': the sentence after the names is no name.
  const onlyNames = (items.at(-1)?.split(/\s+/).length ?? 0) <= MAX_TAIL_WORDS;
  if (!onlyNames) items.pop();
  const isOwn = (item: string) => own.has(normalize(item));
  if (items.length < MIN_NAMES && !(items.length === 2 && items.some(isOwn))) return undefined;

  const words = items.map((item) => item.split(/\s+/));
  const isName = (itemWords: string[]) => {
    const main = itemWords.filter((word) => !PARTICLES.has(word));
    return (
      main.length >= 1 &&
      main.length <= MAX_NAME_WORDS &&
      itemWords.every((word) => NAME_WORD.test(word))
    );
  };
  if (!words.every(isName)) return undefined;
  // One lowercase name ('Fulggur - ioanna - Durgaaz') is a typo, not prose.
  const capitalized = words.filter(([word]) => /^\p{Lu}/u.test(word)).length;
  if (capitalized < items.length - 1) return undefined;

  const unique = new Map<string, string>();
  for (const item of items) {
    const name = item.charAt(0).toUpperCase() + item.slice(1);
    if (!unique.has(normalize(name))) unique.set(normalize(name), name);
  }
  return { names: [...unique.values()], onlyNames };
}

// --- Reward ------------------------------------------------------------------------------

const REWARD = /^\s*(?:recompensas?|premios)\b\s*:?\s*/i;

interface Reward {
  text: string;
  nodes: RootContent[];
}

/**
 * The first paragraph that starts with 'Recompensa', 'Recompensas' or 'Premios', bold or not.
 * When the word stands alone ('Recompensas:' and a list under it), the list is the reward.
 */
function findReward(
  nodes: readonly RootContent[],
  skip: readonly RootContent[],
): Reward | undefined {
  const index = nodes.findIndex(
    (node) => !skip.includes(node) && node.type === 'paragraph' && REWARD.test(plainText(node)),
  );
  if (index === -1) return undefined;
  const text = collapseLines(plainText(nodes[index]).replace(REWARD, ''));
  const next = nodes[index + 1];
  if (text === '' && next && (next.type === 'list' || next.type === 'paragraph')) {
    return { text: collapseLines(plainText(next)), nodes: [nodes[index], next] };
  }
  return { text, nodes: [nodes[index]] };
}

// --- Summary -----------------------------------------------------------------------------

function summarize(items: readonly HistorialItem[], ownNames: readonly string[]): PjSummary {
  const dms = new Counter();
  const companions = new Counter();
  const years = new Map<string, number>();
  const own = new Set(ownNames.map(normalize));

  for (const item of items) {
    dms.add(item.authorHandle ?? item.authorName, item.authorName);
    for (const name of item.participantes) {
      if (!own.has(normalize(name))) companions.add(name, name);
    }
    const year = item.date.slice(0, 4);
    years.set(year, (years.get(year) ?? 0) + 1);
  }

  return {
    total: items.length,
    ...(items.length > 0 ? { first: items.at(-1)?.date, last: items[0].date } : {}),
    dms: dms.top(),
    companions: companions.top(TOP_COMPANIONS),
    years: [...years]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => (a.year < b.year ? 1 : -1)),
  };
}

/** Counts names that match without accents or case, keeping the most used spelling. */
class Counter {
  private readonly counts = new Map<string, { count: number; spellings: Map<string, number> }>();

  add(key: string, spelling: string) {
    const id = normalize(key);
    const current = this.counts.get(id) ?? { count: 0, spellings: new Map<string, number>() };
    current.count += 1;
    current.spellings.set(spelling, (current.spellings.get(spelling) ?? 0) + 1);
    this.counts.set(id, current);
  }

  top(limit = Infinity): NameCount[] {
    return [...this.counts.values()]
      .map(({ count, spellings }) => ({
        name: [...spellings].sort((a, b) => b[1] - a[1])[0][0],
        count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
      .slice(0, limit);
  }
}

// --- Markdown helpers --------------------------------------------------------------------

const BLOCK_CONTAINERS = new Set(['root', 'blockquote', 'list', 'listItem', 'table']);

/** The text of a Markdown node: blocks on their own lines, wikilinks as their visible text. */
function plainText(node: Nodes | Root): string {
  switch (node.type) {
    case 'text':
      return withoutWikilinks(node.value);
    case 'inlineCode':
    case 'code':
      return node.value;
    case 'break':
      return '\n';
    case 'image':
      return node.alt ?? '';
    case 'html':
      return '';
    case 'tableRow':
      return node.children.map(plainText).join(' · ');
  }
  if (!('children' in node)) return '';
  const children: Nodes[] = node.children;
  return children.map(plainText).join(BLOCK_CONTAINERS.has(node.type) ? '\n' : '');
}

function withoutWikilinks(text: string): string {
  return parseWikilinks(text)
    .map((segment) =>
      typeof segment === 'string' ? segment : (segment.label ?? segment.target),
    )
    .join('');
}

/** The Markdown without the given top-level nodes, which come from parsing that same text. */
function withoutNodes(markdown: string, nodes: readonly RootContent[]): string {
  const ranges = nodes
    .flatMap((node) => {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      return start === undefined || end === undefined ? [] : [[start, end] as const];
    })
    .sort((a, b) => a[0] - b[0]);
  let result = '';
  let from = 0;
  for (const [start, end] of ranges) {
    result += markdown.slice(from, start);
    from = end;
  }
  result += markdown.slice(from);
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

/** One line, single spaces. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Single spaces, but keeping the line breaks of a reward written as a list. */
function collapseLines(text: string): string {
  return text
    .split('\n')
    .map(collapse)
    .filter((line) => line !== '')
    .join('\n');
}

function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  const cut = text.slice(0, length);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > length * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}
