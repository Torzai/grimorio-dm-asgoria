import type { Nodes, Root, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { normalize } from './normalize';
import { parseHistorial, type HistorialEntry } from './pj';
import type { Entry } from './types';
import { parseWikilinks } from './wikilinks';

/*
 * What the PJ view needs from a PJ's history, computed at build time by the content plugin
 * (vite-plugin-content.ts), never in the browser: a long history is hundreds of KB of Markdown.
 * The browser only imports the types of this module.
 */

/** One history entry, ready to show. */
export interface HistorialItem {
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
  /** The Markdown shown when the entry is open: without the participants and the reward. */
  bodyMarkdown: string;
  /** Everything the in-history search looks into, normalized (lowercase, no accents). */
  searchText: string;
}

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

/** Loaded on demand when a PJ is opened. */
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
  const items = entries.map(toItem);
  // Newest first, whatever the order they are written in; stable for the same day.
  items.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  const ownNames = [entry.data.title, ...(entry.data.aliases ?? [])];
  return { summary: summarize(items, ownNames), data: { items, fichaBody } };
}

function toItem(entry: HistorialEntry): HistorialItem {
  const root = parser.parse(entry.body);
  const removed: RootContent[] = [];

  const participantes = findParticipants(root.children);
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
    searchText: normalize(
      [entry.authorName, names.join(' '), text, reward?.text ?? ''].join('\n'),
    ),
  };
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

interface Participants {
  names: string[];
  nodes: RootContent[];
}

/**
 * The names of the paragraph that opens an entry, when it is a list of at least 3 names of
 * 1 to 3 capitalized words. A second list right after it (jousts: spectators, then
 * contenders) is added to the first.
 */
function findParticipants(nodes: readonly RootContent[]): Participants | undefined {
  const first = namesOf(nodes[0]);
  if (!first) return undefined;
  const second = namesOf(nodes[1]);
  const names = [...first];
  if (second) {
    const seen = new Set(first.map(normalize));
    names.push(...second.filter((name) => !seen.has(normalize(name))));
  }
  return { names, nodes: second ? nodes.slice(0, 2) : nodes.slice(0, 1) };
}

function namesOf(node: RootContent | undefined): string[] | undefined {
  // '> Mirna - William - …' is still the list, quoted by mistake.
  const paragraph =
    node?.type === 'blockquote' && node.children.length === 1 ? node.children[0] : node;
  if (paragraph?.type !== 'paragraph') return undefined;

  const text = plainText(paragraph).replace(LIST_LABEL, '').replace(PARENTHESIS, ' ');
  const items = text
    .split(NAME_SEPARATOR)
    .map((item) => item.replace(/[.:;]+$/, '').trim())
    .filter((item) => item !== '');
  if (items.length < MIN_NAMES) return undefined;

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
  return [...unique.values()];
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
