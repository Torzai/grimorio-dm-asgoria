import { normalize } from '../../src/content/normalize';
import {
  MIN_FORM_LABELS,
  NO_CLASS_ANSWER,
  SHEET_CLASS_LABELS,
  SHEET_DISCARDED_LABEL,
  SHEET_FIELDS,
  SHEET_SECTIONS,
  SHEET_SELECTORS,
  SHEET_TEXT_LABEL,
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
  /** Answered fields whose label is one of the form's (known fields, classes or sections). */
  knownLabels: number;
}

interface Answer {
  label: string;
  key: string;
  /** The answer as HTML (a table cell) or, in a form written as text, already as Markdown. */
  html?: string;
  markdown?: string;
  text: string;
}

const FIELD_KEYS = keyMap(Object.entries(SHEET_FIELDS) as [SheetField, readonly string[]][]);
const CLASS_ORDER = keyMap(
  SHEET_CLASS_LABELS.map((labels, index): [number, readonly string[]] => [index, labels]),
);
const SECTION_KEYS = keyMap(
  SHEET_SECTIONS.map(({ heading, labels }): [string, readonly string[]] => [heading, labels]),
);

/**
 * Reads the authorization form (post #1) by its labels, whatever their order: from its tables,
 * however deep, or else from "Etiqueta: respuesta" lines.
 */
export function parseSheet(html: string): PjSheet {
  const fromTables = buildSheet(readTableAnswers(html));
  if (isForm(fromTables)) return fromTables;
  const fromText = buildSheet(readTextAnswers(html));
  return fromText.knownLabels > fromTables.knownLabels ? fromText : fromTables;
}

/**
 * True when the post is an authorization form: enough of its fields carry labels of the form.
 * Rules, templates, pinned notices and free-text sheets have none.
 */
export function isAuthorizationForm(html: string): boolean {
  return isForm(parseSheet(html));
}

export function isForm(sheet: PjSheet): boolean {
  return sheet.knownLabels >= MIN_FORM_LABELS;
}

/** A sheet with nothing read, for a post #1 that has no form. */
export function emptySheet(): PjSheet {
  return {
    fields: {},
    clases: [],
    sections: [],
    others: [],
    discarded: [],
    notes: [],
    knownLabels: 0,
  };
}

/**
 * Post #1 of a PJ without a form, whole, as Markdown. Any field or "Etiqueta: …" line with
 * personal data (email, Discord, forum user) is left out, as it is from a form.
 */
export function freeSheetMarkdown(html: string): ConvertedPost {
  const fragment = parseFragment(html);
  for (const table of fieldTables(fragment)) {
    if (SHEET_DISCARDED_LABEL.test(readTableField(table).key)) table.remove();
  }
  const container = fragment.ownerDocument.createElement('div');
  container.append(fragment);
  const converted = postToMarkdown(container.innerHTML);
  const markdown = converted.markdown
    .split('\n')
    .filter((line) => !SHEET_DISCARDED_LABEL.test(textLabel(line)?.key ?? ''))
    .join('\n')
    .trim();
  return { ...converted, markdown };
}

/** Comparable form of a label: 'Descripción Física (opcional):' → 'descripcion fisica'. */
export function labelKey(label: string): string {
  return normalize(displayLabel(label)).replace(/\s+/g, ' ');
}

function buildSheet(answers: Answer[]): PjSheet {
  const sheet = emptySheet();
  const classes: { order: number; value: string }[] = [];
  const sectionAnswers = new Map<string, Answer>();

  for (const answer of answers) {
    const field = FIELD_KEYS.get(answer.key);
    const classIndex = CLASS_ORDER.get(answer.key);
    const section = SECTION_KEYS.get(answer.key);
    // An empty template has the labels but no answers, so only answered labels count.
    if ((field || classIndex !== undefined || section) && answer.text) sheet.knownLabels++;
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

/** Label as shown in a draft: without "(opcional)" or a trailing colon. */
function displayLabel(label: string): string {
  return label
    .replace(/\(\s*opcional\s*\)/gi, '')
    .replace(/[\s:]+$/, '')
    .trim();
}

/**
 * Every table with no table inside is one field: the form's tables are direct children of the
 * post, or sit in a <div>, or inside the layout tables of the confirmation email.
 */
function fieldTables(root: ParentNode): Element[] {
  return [...root.querySelectorAll(SHEET_SELECTORS.field)].filter(
    (table) => !table.querySelector(SHEET_SELECTORS.field),
  );
}

function readTableAnswers(html: string): Answer[] {
  return fieldTables(parseFragment(html))
    .map(readTableField)
    .filter((answer) => answer.label !== '');
}

function readTableField(table: Element): Answer {
  const labelRow = table.querySelector(SHEET_SELECTORS.label);
  const cells = [...table.querySelectorAll(SHEET_SELECTORS.value)];
  const inline = cells.length === 0 ? inlineAnswer(labelRow) : undefined;
  if (inline) return inline;
  const label = textOf(labelRow);
  return {
    label,
    key: labelKey(label),
    html: cells.map((cell) => cell.innerHTML).join('<br>'),
    text: collapseSpaces(cells.map((cell) => cell.textContent ?? '').join(' ')),
  };
}

/** One-row field with the label in bold and the answer after it, in the same cell. */
function inlineAnswer(row: Element | null): Answer | undefined {
  const source = row?.querySelector('td');
  if (!source) return undefined;
  const cell = source.cloneNode(true) as Element;
  const bold = cell.querySelector(SHEET_SELECTORS.inlineLabel);
  if (!bold) return undefined;
  const label = textOf(bold);
  bold.remove();
  const text = textOf(cell);
  if (!label || !text) return undefined;
  return { label, key: labelKey(label), html: cell.innerHTML, text };
}

/** "Raza: Humano" lines; the lines after one without a label belong to the same answer. */
function readTextAnswers(html: string): Answer[] {
  const answers: Answer[] = [];
  let current: { label: string; key: string; lines: string[] } | undefined;
  const finish = () => {
    if (!current) return;
    const markdown = current.lines.join('\n').trim();
    answers.push({
      label: current.label,
      key: current.key,
      markdown,
      text: collapseSpaces(plainText(markdown)),
    });
  };
  for (const line of postToMarkdown(html).markdown.split('\n')) {
    const label = textLabel(line);
    if (label && (isKnownKey(label.key) || SHEET_DISCARDED_LABEL.test(label.key))) {
      finish();
      current = { label: label.label, key: label.key, lines: [label.rest] };
    } else {
      current?.lines.push(line);
    }
  }
  finish();
  return answers;
}

function textLabel(line: string): { label: string; key: string; rest: string } | undefined {
  const match = SHEET_TEXT_LABEL.exec(plainText(line));
  return match ? { label: match[1], key: labelKey(match[1]), rest: match[2] } : undefined;
}

/** A Markdown line as plain text: without escapes, bold marks or a list bullet. */
function plainText(markdown: string): string {
  return markdown
    .replace(/\\(.)/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/^\s*[-*+]\s+/gm, '');
}

function isKnownKey(key: string): boolean {
  return FIELD_KEYS.has(key) || CLASS_ORDER.has(key) || SECTION_KEYS.has(key);
}

function convert(answer: Answer, sheet: PjSheet): string {
  if (answer.markdown !== undefined) return answer.markdown;
  const { markdown, ...notes } = postToMarkdown(answer.html ?? '');
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
