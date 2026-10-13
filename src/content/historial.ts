import { codeLines } from './markdown-text.ts';
import { slugify } from './normalize.ts';
import type { ContentIssue, Entry, EntryType } from './types.ts';

/*
 * The '## Historial' section, which any type in HISTORIAL_TYPES may have: a PJ's quests, the
 * annexes of a crónica or of a lore entry imported from a thread. One parser, one set of items
 * and one view for all of them; what changes per type is in HISTORIAL_PROFILES.
 */

/** Types whose body may hold a '## Historial' section. */
export const HISTORIAL_TYPES = ['pj', 'cronica', 'lore'] as const satisfies readonly EntryType[];

export type HistorialType = (typeof HISTORIAL_TYPES)[number];

export function isHistorialType(type: string | undefined): type is HistorialType {
  return HISTORIAL_TYPES.some((historialType) => historialType === type);
}

/** What changes from one type's history to another's. */
export interface HistorialProfile {
  /**
   * 'date': newest first, whatever the order they are written in, grouped and filtered by year
   * (a PJ's quests). 'thread': as written, which is the order of the forum thread (a crónica's
   * annexes, documents on a subject rather than dated reports).
   */
  order: 'date' | 'thread';
  /**
   * 'date-author': an entry is known by its date and narrator. 'detected': by a title found in
   * its text, its first heading or bold line (post-structure.ts).
   */
  entryTitle: 'date-author' | 'detected';
  /** Participants and reward are read from the text, and "Suele jugar con" counts them. */
  participants: boolean;
  /** ?tab= of the tab that lists the entries in the entry's view. */
  tab: string;
}

/** The annexes of a forum thread, in a crónica or in a lore entry. */
const THREAD_PROFILE: HistorialProfile = {
  order: 'thread',
  entryTitle: 'detected',
  participants: false,
  tab: 'anexos',
};

export const HISTORIAL_PROFILES: Readonly<Record<HistorialType, HistorialProfile>> = {
  pj: { order: 'date', entryTitle: 'date-author', participants: true, tab: 'historial' },
  cronica: THREAD_PROFILE,
  lore: THREAD_PROFILE,
};

/** One entry of a history, from a heading like '### 2026-08-31 · She Wolf (@she-wolf)'. */
export interface HistorialEntry {
  /** 'AAAA-MM-DD' */
  date: string;
  authorName: string;
  /** Forum user without the '@'; undefined when the heading has none. */
  authorHandle?: string;
  /**
   * Stable anchor, unique within the entry: 'h-2026-08-31-she-wolf', then '-2', '-3'… when the
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
  /** The body without the '## Historial' section: a PJ's sheet, a crónica's situation. */
  fichaBody: string;
}

export const HISTORIAL_FORMAT = '### AAAA-MM-DD · Nombre (@usuario)';

const SECTION = /^##\s+historial\s*#*\s*$/i;
const NEXT_SECTION = /^#{1,2}\s/;
/** Only '### AAAA-MM-DD · …' opens an entry; any other '### ' line is text of the entry. */
const ENTRY_HEADING = /^###\s+(\d{4}-\d{2}-\d{2}\s+·\s+.*?)(?:\s+#+)?\s*$/;
const ENTRY = /^(\S+)\s+·\s+(.+?)(?:\s+\(@([^()\s]+)\))?$/;

/**
 * Reads the '## Historial' section of a body and its '### AAAA-MM-DD · Nombre (@usuario)'
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

  const closeEntry = () => {
    const last = entries.at(-1);
    if (last && entryLines) last.body = entryLines.join('\n').trim();
    entryLines = undefined;
  };

  const lines = body.split(/\r?\n/);
  const isCode = codeLines(lines);
  lines.forEach((line, index) => {
    // Lines of fenced code, fences included, are never headings.
    const code = isCode[index];
    if (!code && SECTION.test(line)) {
      inSection = true;
      return;
    }
    if (!code && inSection && NEXT_SECTION.test(line)) {
      closeEntry();
      inSection = false;
    }
    if (!inSection) {
      fichaLines.push(line);
      return;
    }

    const heading = code ? undefined : ENTRY_HEADING.exec(line)?.[1];
    const match = heading === undefined ? undefined : ENTRY.exec(heading);
    if (heading === undefined || !match) {
      entryLines?.push(line);
      return;
    }
    const [, date, authorName, authorHandle] = match;
    if (!isCalendarDate(date)) {
      problems.push(`la entrada '### ${heading}' del historial tiene una fecha que no existe`);
      entryLines?.push(line);
      return;
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
  });
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

/**
 * Warnings of a history, never errors: headings that can't be read, and, where entries go by
 * date, a history that is not written newest first.
 */
export function historialIssues(entry: Entry): ContentIssue[] {
  if (!isHistorialType(entry.type)) return [];
  const warn = (message: string): ContentIssue => ({ path: entry.path, level: 'warning', message });
  const { entries, problems } = historialOf(entry);
  const issues = problems.map(warn);
  if (HISTORIAL_PROFILES[entry.type].order !== 'date') return issues;
  const misplaced = entries.find(
    (current, index) => index > 0 && current.date > entries[index - 1].date,
  );
  if (misplaced) {
    issues.push(
      warn(
        `el historial debe ir del más reciente al más antiguo: la entrada del ${misplaced.date} está debajo de una más antigua`,
      ),
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
