import { normalize, slugify } from './normalize.ts';
import type { ContentIssue, Entry } from './types.ts';

/** One entry of a PJ's history, from a heading like '### 2026-08-31 · She Wolf (@she-wolf)'. */
export interface HistorialEntry {
  /** 'AAAA-MM-DD' */
  date: string;
  authorName: string;
  /** Forum user without the '@'; undefined when the heading has none. */
  authorHandle?: string;
  /**
   * Stable anchor, unique within the PJ: 'h-2026-08-31-she-wolf', then '-2', '-3'… when the
   * same date and author repeat.
   */
  id: string;
  /** The Markdown under the heading, up to the next entry, trimmed. */
  body: string;
}

export interface Historial {
  /** The valid entries, in the order they are written. */
  entries: HistorialEntry[];
  /** Why some headings of the section are not entries; in Spanish, for validate. */
  problems: string[];
  /** The body without the '## Historial' section: what "Ficha y trasfondo" shows. */
  fichaBody: string;
}

export const HISTORIAL_FORMAT = '### AAAA-MM-DD · Nombre (@usuario)';

const SECTION = /^##\s+historial\s*#*\s*$/i;
const NEXT_SECTION = /^#{1,2}\s/;
/** Only '### AAAA-MM-DD · …' opens an entry; any other '### ' line is text of the entry. */
const ENTRY_HEADING = /^###\s+(\d{4}-\d{2}-\d{2}\s+·\s+.*?)(?:\s+#+)?\s*$/;
const ENTRY = /^(\S+)\s+·\s+(.+?)(?:\s+\(@([^()\s]+)\))?$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Reads the '## Historial' section of a PJ body and its '### AAAA-MM-DD · Nombre (@usuario)'
 * headings, up to the next '#' or '##' heading. Headings inside fenced code are not entries.
 * Any other '### ' line (a heading pasted in a post) is text of the entry before it, so it
 * never splits an entry.
 */
export function parseHistorial(body: string): Historial {
  const entries: HistorialEntry[] = [];
  const problems: string[] = [];
  const timesSeen = new Map<string, number>();
  const fichaLines: string[] = [];
  let entryLines: string[] | undefined;
  let inSection = false;
  let fence: string | undefined;

  const closeEntry = () => {
    const last = entries.at(-1);
    if (last && entryLines) last.body = entryLines.join('\n').trim();
    entryLines = undefined;
  };

  for (const line of body.split(/\r?\n/)) {
    // Lines of fenced code, fences included, are never headings.
    const fenceMark = FENCE.exec(line)?.[1];
    let isCode = true;
    if (fence !== undefined) {
      if (fenceMark?.[0] === fence[0] && fenceMark.length >= fence.length) fence = undefined;
    } else if (fenceMark !== undefined) {
      fence = fenceMark;
    } else {
      isCode = false;
    }

    if (!isCode && SECTION.test(line)) {
      inSection = true;
      continue;
    }
    if (!isCode && inSection && NEXT_SECTION.test(line)) {
      closeEntry();
      inSection = false;
    }
    if (!inSection) {
      fichaLines.push(line);
      continue;
    }

    const heading = isCode ? undefined : ENTRY_HEADING.exec(line)?.[1];
    if (heading === undefined) {
      entryLines?.push(line);
      continue;
    }
    const match = ENTRY.exec(heading);
    if (!match) {
      entryLines?.push(line);
      continue;
    }
    const [, date, authorName, authorHandle] = match;
    if (!isCalendarDate(date)) {
      problems.push(
        `la entrada '### ${heading}' del historial tiene una fecha que no existe`,
      );
      entryLines?.push(line);
      continue;
    }
    closeEntry();
    const baseId = `h-${date}-${slugify(authorName) || 'autor'}`;
    const count = (timesSeen.get(baseId) ?? 0) + 1;
    timesSeen.set(baseId, count);
    entries.push({
      date,
      authorName,
      ...(authorHandle === undefined ? {} : { authorHandle }),
      id: count === 1 ? baseId : `${baseId}-${count}`,
      body: '',
    });
    entryLines = [];
  }
  closeEntry();
  return { entries, problems, fichaBody: fichaLines.join('\n').trim() };
}

const parsed = new WeakMap<Entry, Historial>();

/** parseHistorial of an entry's body, parsed once per entry. */
export function historialOf(entry: Entry): Historial {
  let historial = parsed.get(entry);
  if (!historial) {
    historial = parseHistorial(entry.body);
    parsed.set(entry, historial);
  }
  return historial;
}

/** The 9 alignments of D&D 3.5, as normalizeAlignment returns them. */
export const ALIGNMENTS = [
  'legal bueno',
  'neutral bueno',
  'caotico bueno',
  'legal neutral',
  'neutral',
  'caotico neutral',
  'legal maligno',
  'neutral maligno',
  'caotico maligno',
] as const;

export type Alignment = (typeof ALIGNMENTS)[number];

// Feminine forms too: the forms are filled in by players for PJs of either sex.
const ALIGNMENT_WORDS = new Map([
  ['legal', 'legal'],
  ['caotico', 'caotico'],
  ['caotica', 'caotico'],
  ['neutral', 'neutral'],
  ['neutro', 'neutral'],
  ['neutra', 'neutral'],
  ['bueno', 'bueno'],
  ['buena', 'bueno'],
  ['maligno', 'maligno'],
  ['maligna', 'maligno'],
  ['malvado', 'maligno'],
  ['malvada', 'maligno'],
  ['malo', 'maligno'],
  ['mala', 'maligno'],
]);
const EMPHASIS_WORDS = new Set(['autentico', 'autentica', 'verdadero', 'verdadera', 'puro', 'pura']);

/** How each alignment is written in a generated entry. */
export const ALIGNMENT_LABELS: Record<Alignment, string> = {
  'legal bueno': 'Legal bueno',
  'neutral bueno': 'Neutral bueno',
  'caotico bueno': 'Caótico bueno',
  'legal neutral': 'Legal neutral',
  neutral: 'Neutral',
  'caotico neutral': 'Caótico neutral',
  'legal maligno': 'Legal maligno',
  'neutral maligno': 'Neutral maligno',
  'caotico maligno': 'Caótico maligno',
};

export interface AlignmentReading {
  /** One of the 9, or undefined when the text can't be read as one (or is a placeholder). */
  alignment?: Alignment;
  /** What follows '//' or sits in parentheses: 'Neutral Malvado //pasaría a NA' → 'pasaría a NA'. */
  comment?: string;
  /** The empty answer of the form: 'Seleccionar alineamiento...', 'Elegir…', '-' or nothing. */
  placeholder: boolean;
  /** The alignment was found only after taking out a comment or fixing a typo. */
  corrected: boolean;
}

/** Comments players add to an alignment: everything after '//', and text in parentheses. */
const ALIGNMENT_COMMENT = /\/\/(.*)$|\(([^)]*)\)?/g;
/** A form left as it came: 'Seleccionar alineamiento...', 'Elegir…', '-', '…' or empty. */
const ALIGNMENT_PLACEHOLDER = /^(?:[^a-z0-9]*|(?:seleccion|elegi|elij|elige|escog|escoj)\w*\b.*)$/;
/** Spelling slips allowed per word: 2 in long words ('malgino'), 1 in short ones ('mal'). */
const maxTypos = (word: string) => (word.length >= 5 ? 2 : 1);

/**
 * Reads an alignment as players write it: the 9 alignments (feminine forms and 'malvado'
 * included), with comments ('// pasaría a NA', '(de momento)') taken out and typos of up to
 * 2 letters per word fixed ('Legal Malgino', 'Caóotico Neutral').
 */
export function readAlignment(text: string): AlignmentReading {
  const comments: string[] = [];
  const value = text
    .replace(ALIGNMENT_COMMENT, (_match, slashed?: string, parenthesized?: string) => {
      const comment = (slashed ?? parenthesized ?? '').trim();
      if (comment !== '') comments.push(comment);
      return ' ';
    })
    .trim();
  const comment = comments.length > 0 ? comments.join(' · ') : undefined;
  const key = normalize(value);
  if (ALIGNMENT_PLACEHOLDER.test(key)) return { comment, placeholder: true, corrected: false };

  const words = key.split(/[^a-z]+/).filter((word) => word !== '');
  const exact = alignmentOf(words.map((word) => ALIGNMENT_WORDS.get(word) ?? emphasis(word)));
  if (exact) return { alignment: exact, comment, placeholder: false, corrected: comment !== undefined };
  const fixed = alignmentOf(words.map(closestWord));
  return { alignment: fixed, comment, placeholder: false, corrected: fixed !== undefined };
}

/**
 * One of the 9 alignments, lowercase and without accents, or undefined when the text is not one:
 * 'Caótica Buena' → 'caotico bueno', 'Legal Malvado' → 'legal maligno',
 * 'Neutral Auténtico', 'Neutral Neutral' and 'Neutral' → 'neutral',
 * 'Legal Malgino (de momento)' → 'legal maligno'.
 */
export function normalizeAlignment(text: string): Alignment | undefined {
  return readAlignment(text).alignment;
}

/** '' for a word that only stresses the alignment ('Neutral Auténtico'). */
function emphasis(word: string): '' | undefined {
  return EMPHASIS_WORDS.has(word) ? '' : undefined;
}

/** The alignment of some words already read by ALIGNMENT_WORDS ('' = emphasis, left out). */
function alignmentOf(words: readonly (string | undefined)[]): Alignment | undefined {
  if (words.includes(undefined)) return undefined;
  const kept = words.filter((word) => word !== '');
  if (kept.length === 0 || kept.length > 2) return undefined;
  // A single word is only valid as 'neutral'; ALIGNMENTS rejects 'legal' or 'bueno' alone.
  const value = kept[0] === 'neutral' && kept[1] === 'neutral' ? 'neutral' : kept.join(' ');
  return ALIGNMENTS.find((alignment) => alignment === value);
}

/** The word a typo stands for ('' = emphasis); undefined when none is close or two tie. */
function closestWord(word: string): string | undefined {
  const exact = ALIGNMENT_WORDS.get(word) ?? emphasis(word);
  if (exact !== undefined) return exact;
  const vocabulary: [string, string][] = [
    ...ALIGNMENT_WORDS,
    ...[...EMPHASIS_WORDS].map((emphasisWord): [string, string] => [emphasisWord, '']),
  ];
  let best: { distance: number; meanings: Set<string> } = {
    distance: maxTypos(word) + 1,
    meanings: new Set(),
  };
  for (const [spelling, meaning] of vocabulary) {
    const distance = editDistance(word, spelling);
    if (distance < best.distance) best = { distance, meanings: new Set([meaning]) };
    else if (distance === best.distance) best.meanings.add(meaning);
  }
  return best.meanings.size === 1 ? [...best.meanings][0] : undefined;
}

/** Levenshtein distance: letters added, removed or changed to turn one word into the other. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const change = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, change));
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Warnings of a PJ entry, never errors: an alignment that is not one of the 9, history headings
 * that can't be read and a history that is not written newest first.
 */
export function pjIssues(entry: Entry): ContentIssue[] {
  if (entry.data.type !== 'pj') return [];
  const issues: ContentIssue[] = [];
  const warn = (message: string, field?: string) =>
    issues.push({ path: entry.path, level: 'warning', field, message });

  const { alineamiento } = entry.data;
  if (alineamiento !== undefined && normalizeAlignment(alineamiento) === undefined) {
    warn(
      `'alineamiento' tiene '${alineamiento}', que no es uno de los 9 alineamientos de D&D 3.5 (p. ej. Legal bueno, Neutral o Caótico maligno); se muestra tal cual`,
      'alineamiento',
    );
  }

  const { entries, problems } = historialOf(entry);
  for (const problem of problems) warn(problem);
  const misplaced = entries.find((current, index) => index > 0 && current.date > entries[index - 1].date);
  if (misplaced) {
    warn(
      `el historial debe ir del más reciente al más antiguo: la entrada del ${misplaced.date} está debajo de una más antigua`,
    );
  }
  return issues;
}

function isCalendarDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
