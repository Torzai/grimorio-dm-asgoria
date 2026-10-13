import type { Paragraph, RootContent } from 'mdast';
import { collapse, parseMarkdown, plainText, truncate, withoutNodes } from './markdown-text.ts';
import { slugify } from './normalize.ts';

/*
 * The structure the forum's authors give a long post without real headings (the importer
 * turns headings into bold lines): a short bold label opening a paragraph ('**Magia:** …')
 * starts a thematic block; the first heading or bold line names the post; and the importer's
 * own notes ('_Publicado el …_', '_Editado el …_') close it. Node-safe and pure.
 */

/** One thematic block: a paragraph that opens with a bold label, up to the next one. */
export interface LabeledBlock {
  /** Anchor, unique among the blocks of one split. */
  id: string;
  label: string;
  /** The block's Markdown, its label included. */
  markdown: string;
}

export interface Blocks {
  /** What comes before the first label; empty when the text opens with one. */
  intro: string;
  blocks: LabeledBlock[];
}

export interface SplitOptions {
  /** The anchor of a block from its label's slug: 'magia' → 's-magia'. */
  idOf: (labelSlug: string) => string;
  /** When set, a non-empty intro before labeled blocks becomes a block with this label. */
  introLabel?: string;
}

const MAX_LABEL_LENGTH = 80;
/** Text around the bold that is only stray marks: '**' left over from nested bold, spaces. */
const STRAY_MARKS = /^[\s*_]*$/;
/** A bold sentence ('**Teniendo en cuenta… más tarde.**') is text, not a label. */
const SENTENCE_END = /[.!?…]$/;

/** Splits Markdown at the top-level paragraphs that open with a short bold label. */
export function splitBlocks(markdown: string, { idOf, introLabel }: SplitOptions): Blocks {
  const root = parseMarkdown(markdown);
  const starts = root.children.flatMap((node) => {
    const label = labelOf(node);
    const offset = node.position?.start.offset;
    return label === undefined || offset === undefined ? [] : [{ label, offset }];
  });
  if (starts.length === 0) return { intro: markdown.trim(), blocks: [] };

  const timesSeen = new Map<string, number>();
  const block = (label: string, from: number, to: number): LabeledBlock => {
    const base = idOf(slugify(label) || 'bloque');
    const count = (timesSeen.get(base) ?? 0) + 1;
    timesSeen.set(base, count);
    return {
      id: count === 1 ? base : `${base}-${count}`,
      label,
      markdown: markdown.slice(from, to).trim(),
    };
  };

  const intro = markdown.slice(0, starts[0].offset).trim();
  const blocks: LabeledBlock[] = [];
  if (introLabel && intro) blocks.push(block(introLabel, 0, starts[0].offset));
  starts.forEach(({ label, offset }, index) => {
    blocks.push(block(label, offset, starts[index + 1]?.offset ?? markdown.length));
  });
  return { intro: introLabel ? '' : intro, blocks };
}

export interface DetectedTitle {
  title: string;
  /** The Markdown without the title when it was a paragraph or heading of its own. */
  markdown: string;
}

const FALLBACK_LENGTH = 60;
/** Where the first words of a text end when no bold line names it: ':' or the end of a sentence. */
const FIRST_WORDS_END = /[.:;]/;

/**
 * What names a post: its first heading or the bold line that opens it (up to 80 letters); if
 * neither, its first line up to the first ':' or '.', or its first words. A heading or a bold
 * paragraph that is only the title leaves the Markdown. Undefined for a post without text.
 */
export function detectTitle(markdown: string): DetectedTitle | undefined {
  const root = parseMarkdown(markdown);
  const first = root.children.find((node) => collapse(plainText(node)) !== '');
  if (!first) return undefined;

  if (first.type === 'heading') {
    const title = cleanLabel(plainText(first));
    if (title) return { title, markdown: withoutNodes(markdown, [first]) };
  }
  const lead = boldLead(first);
  if (lead && lead.text.length <= MAX_LABEL_LENGTH) {
    return { title: lead.text, markdown: lead.whole ? withoutNodes(markdown, [first]) : markdown };
  }

  const line = collapse(plainText(first).split('\n')[0] ?? '');
  const end = FIRST_WORDS_END.exec(line);
  const sentence = cleanLabel(end ? line.slice(0, end.index) : line);
  const title =
    sentence.length >= 3 && sentence.length <= MAX_LABEL_LENGTH
      ? sentence
      : truncate(line, FALLBACK_LENGTH);
  return { title: readableLabel(title), markdown };
}

/** The label a paragraph opens with: '**Magia:** …' → 'Magia'; undefined when it has none. */
function labelOf(node: RootContent): string | undefined {
  const lead = boldLead(node);
  if (!lead || lead.text.length > MAX_LABEL_LENGTH || SENTENCE_END.test(lead.text)) {
    return undefined;
  }
  return lead.text;
}

/** The bold text a paragraph opens with, and whether that bold is all the paragraph holds. */
function boldLead(node: RootContent): { text: string; whole: boolean } | undefined {
  if (node.type !== 'paragraph') return undefined;
  const children: Paragraph['children'] = node.children;
  const index = children.findIndex(
    (child) => !(child.type === 'text' && STRAY_MARKS.test(child.value)),
  );
  const strong = children[index];
  if (strong?.type !== 'strong') return undefined;
  const text = cleanLabel(plainText(strong));
  if (!/\p{L}/u.test(text) || text.length < 2) return undefined;
  const after = children.slice(index + 1);
  const whole = after.every(
    (child) =>
      child.type === 'break' || (child.type === 'text' && /^[\s*_:]*$/.test(child.value)),
  );
  return { text: readableLabel(text), whole };
}

/** One line, without stray marks around it nor the ':' that ends a label. */
function cleanLabel(text: string): string {
  return collapse(text)
    .replace(/^[\s*_]+/, '')
    .replace(/[\s*_:]+$/, '');
}

const PARTICLES = new Set([
  'a',
  'al',
  'con',
  'de',
  'del',
  'e',
  'el',
  'en',
  'la',
  'las',
  'lo',
  'los',
  'o',
  'para',
  'por',
  'sin',
  'u',
  'y',
]);
/** A word in capitals this long is shouted ('MAGIA'); a shorter one may be an acronym ('NPC'). */
const SHOUTED_LENGTH = 4;

/**
 * A label written in capitals reads as a title: 'MAGIA' → 'Magia', 'MALDICIÓN DE LA SANGRE' →
 * 'Maldición de la Sangre'. Short words in capitals that are no particle stay ('NPC'), and so
 * does any label with no shouted word in it.
 */
function readableLabel(label: string): string {
  const isCapitals = (word: string) => /\p{Lu}/u.test(word) && word === word.toUpperCase();
  const letters = (word: string) => word.replace(/[^\p{L}]/gu, '').length;
  const words = label.split(' ');
  if (!words.some((word) => isCapitals(word) && letters(word) >= SHOUTED_LENGTH)) return label;
  return words
    .map((word, index) => {
      if (!isCapitals(word)) return word;
      const lower = word.toLowerCase();
      if (PARTICLES.has(lower.replace(/[^\p{L}]/gu, ''))) return index === 0 ? capitalize(lower) : lower;
      return letters(word) < SHOUTED_LENGTH ? word : capitalize(lower);
    })
    .join(' ');
}

function capitalize(word: string): string {
  return word.replace(/\p{L}/u, (letter) => letter.toUpperCase());
}

// --- The importer's notes ------------------------------------------------------------------

/** '_Publicado el 17/12/2022 por She Wolf_' or '_Editado el 28/04/2025 por She Wolf_'. */
const POST_NOTE = /^_(Publicado|Editado) el (\d{2})\/(\d{2})\/(\d{4}) por (.+)_$/;

export interface PostNote {
  /** 'AAAA-MM-DD' */
  date: string;
  by: string;
}

export interface PostNotes {
  /** The Markdown without the notes. */
  markdown: string;
  published?: PostNote;
  edited?: PostNote;
}

/** Takes the importer's notes off the end of a post: when it was published and last edited. */
export function splitPostNotes(markdown: string): PostNotes {
  const lines = markdown.trimEnd().split('\n');
  const notes: Omit<PostNotes, 'markdown'> = {};
  for (;;) {
    while (lines.length > 0 && lines.at(-1)?.trim() === '') lines.pop();
    const match = POST_NOTE.exec(lines.at(-1)?.trim() ?? '');
    if (!match) break;
    const [, kind, day, month, year, by] = match;
    const note = { date: `${year}-${month}-${day}`, by };
    if (kind === 'Publicado') notes.published ??= note;
    else notes.edited ??= note;
    lines.pop();
  }
  return { markdown: lines.join('\n').trim(), ...notes };
}
