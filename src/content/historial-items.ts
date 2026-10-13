import type { RootContent } from 'mdast';
import {
  HISTORIAL_PROFILES,
  parseHistorial,
  type HistorialEntry,
  type HistorialProfile,
  type HistorialType,
} from './historial.ts';
import {
  collapse,
  collapseLines,
  parseMarkdown,
  plainText,
  truncate,
  withoutNodes,
} from './markdown-text.ts';
import { normalize, withoutApostrophes } from './normalize.ts';
import { detectTitle, splitBlocks, splitPostNotes, type Blocks } from './post-structure.ts';
import type { Entry, EntryMeta } from './types.ts';

/*
 * What the view of a history needs, for every type in HISTORIAL_TYPES. The content plugin
 * (vite-plugin-content.ts) splits every history at build time and hands the browser everything
 * but the text of the entries. The browser splits the body with these same functions once it
 * is loaded, one entry at a time, to show the text of an entry or search the whole history.
 */

/** One history entry without its text: what the browser loads up front. */
export interface HistorialItemMeta {
  /** Stable anchor: 'h-2023-09-12-li-zakien'. */
  id: string;
  /** 'AAAA-MM-DD' */
  date: string;
  authorName: string;
  authorHandle?: string;
  /** Title found in the text; only in types whose entries are titled ('detected'). */
  title?: string;
  /** Day of the last edit, 'AAAA-MM-DD', from the importer's note; only in titled entries. */
  editedAt?: string;
  /** Names from the list that opens the entry; empty when it doesn't open with one. */
  participantes: string[];
  /**
   * The PJ slug each participant resolves to, in the same order; null when none does. Filled
   * in by the content plugin (pj-names.ts), so it is missing while a body is split.
   */
  participantesPj?: (string | null)[];
  /** The reward line as plain text, without the leading 'Recompensa:'. */
  recompensa?: string;
  /** About the first 220 letters of the body, as plain text. */
  preview: string;
}

/** The text of a history entry, which comes with the entry's body. */
export interface HistorialItemText {
  /**
   * The Markdown shown when the entry is open: without the participants, the reward, a title
   * that was a paragraph of its own and the edit note, which the head shows instead.
   */
  bodyMarkdown: string;
  /** Everything the in-history search looks into, normalized (lowercase, no accents). */
  searchText: string;
  /** Thematic blocks of bodyMarkdown, for the mini-index of a titled entry. */
  blocks?: Blocks;
}

/** One history entry, ready to show. */
export interface HistorialItem extends HistorialItemMeta, HistorialItemText {}

export interface NameCount {
  name: string;
  count: number;
}

/** A companion of 'Suele jugar con', with the PJ its name resolves to. */
export interface CompanionCount extends NameCount {
  /** Slug of the PJ; null when no PJ has the name or several do. Set by the content plugin. */
  pj?: string | null;
  /** Several PJs share the name and the dates didn't settle which one it is. */
  ambiguous?: true;
}

export interface YearCount {
  year: string;
  count: number;
}

/** Totals of a history: small, so the app loads them for every entry up front. */
export interface HistorialSummary {
  total: number;
  /** Oldest and newest dates, 'AAAA-MM-DD'; undefined without entries. */
  first?: string;
  last?: string;
  /** Narrators (authors) with how many entries each, most first. */
  dms: NameCount[];
  /** The 8 names that most often share an entry with the PJ, most first; empty for other types. */
  companions: CompanionCount[];
  /** Entries per year, newest year first. */
  years: YearCount[];
}

export interface HistorialData {
  /** In the profile's order: newest first, or as written. */
  items: HistorialItem[];
  /** The body without the '## Historial' section. */
  fichaBody: string;
}

export interface HistorialBuild {
  summary: HistorialSummary;
  data: HistorialData;
}

export interface ItemOptions {
  profile: HistorialProfile;
  /** From ownNamesOf(): the names that are the PJ itself in its history. */
  ownNames: readonly string[];
}

const PREVIEW_LENGTH = 220;
const TOP_COMPANIONS = 8;

/** History, summary and remaining body of an entry with a history. */
export function buildHistorial(entry: Entry<HistorialType>): HistorialBuild {
  const profile = HISTORIAL_PROFILES[entry.type];
  const { entries, fichaBody } = parseHistorial(entry.body);
  const ownNames = ownNamesOf(entry);
  const items = entries.map((historialEntry) =>
    historialItem(historialEntry, { profile, ownNames }),
  );
  // Newest first, whatever the order they are written in; stable for the same day.
  if (profile.order === 'date') {
    items.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  }
  return { summary: summarize(items, ownNames), data: { items, fichaBody } };
}

/** The title and aliases of an entry: the names that are the PJ itself in its history. */
export function ownNamesOf(entry: EntryMeta): string[] {
  return [entry.data.title, ...(entry.data.aliases ?? [])];
}

/** The item of one entry of parseHistorial(), with its text. */
export function historialItem(entry: HistorialEntry, options: ItemOptions): HistorialItem {
  if (options.profile.entryTitle === 'detected') return titledItem(entry);
  const root = parseMarkdown(entry.body);
  const removed: RootContent[] = [];

  const participantes = options.profile.participants
    ? findParticipants(root.children, options.ownNames)
    : undefined;
  if (participantes) removed.push(...participantes.nodes);

  const reward = options.profile.participants ? findReward(root.children, removed) : undefined;
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
    searchText: searchTextOf([entry.authorName, ...names], text, reward?.text),
  };
}

/**
 * An entry named by its own text (a crónica's annex): its title, the day of its last edit and
 * its thematic blocks, each under an anchor of its own ('<entry id>--<label>').
 */
function titledItem(entry: HistorialEntry): HistorialItem {
  const { markdown, edited } = splitPostNotes(entry.body);
  const detected = detectTitle(markdown);
  const bodyMarkdown = detected?.markdown ?? markdown;
  const text = collapse(plainText(parseMarkdown(bodyMarkdown)));
  return {
    id: entry.id,
    date: entry.date,
    authorName: entry.authorName,
    ...(entry.authorHandle === undefined ? {} : { authorHandle: entry.authorHandle }),
    ...(detected ? { title: detected.title } : {}),
    ...(edited ? { editedAt: edited.date } : {}),
    participantes: [],
    preview: truncate(text, PREVIEW_LENGTH),
    bodyMarkdown,
    searchText: searchTextOf([entry.authorName, detected?.title ?? ''], text),
    blocks: splitBlocks(bodyMarkdown, { idOf: (label) => `${entry.id}--${label}` }),
  };
}

/**
 * What the in-history search looks into while the text of the entry isn't loaded: the same
 * as searchText, with the preview in place of the whole text.
 */
export function previewSearchText(item: HistorialItemMeta): string {
  return searchTextOf(
    [item.authorName, item.title ?? '', ...item.participantes],
    item.preview,
    item.recompensa,
  );
}

function searchTextOf(names: readonly string[], text: string, reward = ''): string {
  return normalize(withoutApostrophes([names.join(' '), text, reward].join('\n')));
}

/**
 * The title of an entry as a search result of its own: '<PJ> · 12/09/2023 · Li Zakien', or
 * '<crónica> · <its title>' for a titled one.
 */
export function itemSearchTitle(parentTitle: string, item: HistorialItemMeta): string {
  return item.title
    ? `${parentTitle} · ${item.title}`
    : `${parentTitle} · ${numericDate(item.date)} · ${item.authorName}`;
}

/** '2023-09-12' → '12/09/2023'. */
function numericDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
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

function summarize(items: readonly HistorialItem[], ownNames: readonly string[]): HistorialSummary {
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
  // Whatever the order of the items; ISO dates sort chronologically as plain text.
  const dates = items.map((item) => item.date).sort();

  return {
    total: items.length,
    ...(items.length > 0 ? { first: dates[0], last: dates.at(-1) } : {}),
    dms: dms.top(),
    companions: companions.top(TOP_COMPANIONS),
    years: [...years]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => (a.year < b.year ? 1 : -1)),
  };
}

/** Counts names that match without accents or case, keeping the most used spelling. */
export class Counter {
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
