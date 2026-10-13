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
const ENTRY_HEADING = /^###\s+(.*?)(?:\s+#+)?\s*$/;
const ENTRY = /^(\S+)\s+·\s+(.+?)(?:\s+\(@([^()\s]+)\))?$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Reads the '## Historial' section of a PJ body and its '### AAAA-MM-DD · Nombre (@usuario)'
 * headings, up to the next '#' or '##' heading. Headings inside fenced code are not entries.
 * Text under a heading that can't be read stays with the entry before it.
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
      problems.push(
        `la entrada '### ${heading}' del historial no sigue el formato '${HISTORIAL_FORMAT}'`,
      );
      entryLines?.push(line);
      continue;
    }
    const [, date, authorName, authorHandle] = match;
    if (!isCalendarDate(date)) {
      problems.push(
        `la entrada '### ${heading}' del historial tiene una fecha que no existe o no tiene el formato AAAA-MM-DD`,
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

/**
 * One of the 9 alignments, lowercase and without accents, or undefined when the text is not one:
 * 'Caótica Buena' → 'caotico bueno', 'Legal Malvado' → 'legal maligno',
 * 'Neutral Auténtico', 'Neutral Neutral' and 'Neutral' → 'neutral'.
 */
export function normalizeAlignment(text: string): Alignment | undefined {
  const words = normalize(text)
    .split(/[^a-z]+/)
    .filter((word) => word !== '' && !EMPHASIS_WORDS.has(word))
    .map((word) => ALIGNMENT_WORDS.get(word));
  if (words.length === 0 || words.length > 2 || words.includes(undefined)) return undefined;
  // A single word is only valid as 'neutral'; ALIGNMENTS rejects 'legal' or 'bueno' alone.
  const value = words[0] === 'neutral' && words[1] === 'neutral' ? 'neutral' : words.join(' ');
  return ALIGNMENTS.find((alignment) => alignment === value);
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
