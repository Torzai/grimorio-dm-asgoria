import { normalize } from './normalize.ts';
import type { ContentIssue, Entry } from './types.ts';

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
 * Warnings of a PJ entry, never errors: an alignment that is not one of the 9. The history's
 * warnings come from historialIssues (historial.ts).
 */
export function pjIssues(entry: Entry): ContentIssue[] {
  if (entry.data.type !== 'pj') return [];
  const { alineamiento } = entry.data;
  if (alineamiento === undefined || normalizeAlignment(alineamiento) !== undefined) return [];
  return [
    {
      path: entry.path,
      level: 'warning',
      field: 'alineamiento',
      message: `'alineamiento' tiene '${alineamiento}', que no es uno de los 9 alineamientos de D&D 3.5 (p. ej. Legal bueno, Neutral o Caótico maligno); se muestra tal cual`,
    },
  ];
}
