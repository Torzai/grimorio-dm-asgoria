import { normalize } from '../../src/content/normalize';
import {
  NO_CLASS_ANSWER,
  SHEET_CLASS_LABELS,
  SHEET_DISCARDED_LABEL,
  SHEET_FIELDS,
  SHEET_SECTIONS,
  SHEET_SELECTORS,
} from '../config';
import { collapseSpaces, parseFragment, textOf } from './html';
import { postToMarkdown, redactPersonalData, type ConvertedPost } from './markdown';

export type SheetField = keyof typeof SHEET_FIELDS;

export interface PjSheet {
  /** Short answers for the frontmatter; empty answers are left out. */
  fields: Partial<Record<SheetField, string>>;
  /** Principal, secundaria, terciaria, without "No sé..." or empty answers. */
  clases: string[];
  /** Long answers, in the order of SHEET_SECTIONS. */
  sections: { heading: string; markdown: string }[];
  /** Answers whose label is not in config.ts: they go to "Otros datos". */
  others: { label: string; markdown: string }[];
  /** Labels (never values) of the answers dropped as personal data. */
  discarded: string[];
  /** Cleanup notes of the long answers (images, removed links…). */
  notes: Omit<ConvertedPost, 'markdown'>[];
}

interface Answer {
  label: string;
  key: string;
  html: string;
  text: string;
}

/** Reads the authorization form (post #1) by its labels, whatever their order. */
export function parseSheet(html: string): PjSheet {
  const fieldKeys = keyMap(Object.entries(SHEET_FIELDS) as [SheetField, readonly string[]][]);
  const classOrder = new Map(
    SHEET_CLASS_LABELS.map((label, index): [string, number] => [labelKey(label), index]),
  );
  const sectionKeys = keyMap(
    SHEET_SECTIONS.map(({ heading, labels }): [string, readonly string[]] => [heading, labels]),
  );

  const sheet: PjSheet = {
    fields: {},
    clases: [],
    sections: [],
    others: [],
    discarded: [],
    notes: [],
  };
  const classes: { order: number; value: string }[] = [];
  const sectionAnswers = new Map<string, Answer>();

  for (const answer of readAnswers(html)) {
    const field = fieldKeys.get(answer.key);
    const classIndex = classOrder.get(answer.key);
    const section = sectionKeys.get(answer.key);
    if (SHEET_DISCARDED_LABEL.test(answer.key)) {
      sheet.discarded.push(answer.label);
    } else if (field) {
      if (answer.text) sheet.fields[field] = redactPersonalData(answer.text);
    } else if (classIndex !== undefined) {
      if (!isNoClass(answer.text)) classes.push({ order: classIndex, value: answer.text });
    } else if (section) {
      sectionAnswers.set(section, answer);
    } else {
      const converted = convert(answer, sheet);
      if (converted) sheet.others.push({ label: displayLabel(answer.label), markdown: converted });
    }
  }

  sheet.clases = classes
    .sort((a, b) => a.order - b.order)
    .map(({ value }) => redactPersonalData(value));
  for (const { heading } of SHEET_SECTIONS) {
    const answer = sectionAnswers.get(heading);
    const markdown = answer && convert(answer, sheet);
    if (markdown) sheet.sections.push({ heading, markdown });
  }
  return sheet;
}

/** Comparable form of a label: 'Descripción Física (opcional):' → 'descripcion fisica'. */
export function labelKey(label: string): string {
  return normalize(displayLabel(label)).replace(/\s+/g, ' ');
}

/** Label as shown in a draft: without "(opcional)" or a trailing colon. */
function displayLabel(label: string): string {
  return label
    .replace(/\(\s*opcional\s*\)/gi, '')
    .replace(/[\s:]+$/, '')
    .trim();
}

function readAnswers(html: string): Answer[] {
  return [...parseFragment(html).children]
    .filter((element) => element.matches(SHEET_SELECTORS.field))
    .map((field) => {
      const label = textOf(field.querySelector(SHEET_SELECTORS.label));
      const cells = [...field.querySelectorAll(SHEET_SELECTORS.value)];
      return {
        label,
        key: labelKey(label),
        html: cells.map((cell) => cell.innerHTML).join('<br>'),
        text: collapseSpaces(cells.map((cell) => cell.textContent ?? '').join(' ')),
      };
    })
    .filter((answer) => answer.label !== '');
}

function convert(answer: Answer, sheet: PjSheet): string {
  const { markdown, ...notes } = postToMarkdown(answer.html);
  sheet.notes.push(notes);
  return markdown;
}

function isNoClass(answer: string): boolean {
  return NO_CLASS_ANSWER.test(normalize(answer).replace(/[.…\s]+$/, ''));
}

function keyMap<T>(entries: [T, readonly string[]][]): Map<string, T> {
  return new Map(
    entries.flatMap(([value, labels]) =>
      labels.map((label): [string, T] => [labelKey(label), value]),
    ),
  );
}
