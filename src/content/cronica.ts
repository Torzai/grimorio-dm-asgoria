import { Counter, type HistorialItemMeta, type NameCount } from './historial-items.ts';
import { cutSection } from './markdown-text.ts';
import { splitBlocks, splitPostNotes, type LabeledBlock } from './post-structure.ts';

/*
 * A crónica is a forum thread on a region or a plot: post #1, which its author keeps editing,
 * is the situation ('## Situación'), and the replies are annexes in its '## Historial'
 * (historial.ts, with the 'cronica' profile). Node-safe and pure: the content plugin derives
 * the metadata at build time and the browser splits the loaded body with the same functions.
 */

const SITUACION_SECTION = /^##\s+situaci[oó]n\s*#*\s*$/i;

/** Label of what the situation says before its first bold label. */
export const SITUACION_GENERAL = 'Situación general';

/** Anchor of the whole situation, when it has no bold labels to split it in blocks. */
export const SITUACION_ANCHOR = 's-situacion';

export interface Situacion {
  /** The situation's thematic blocks ('s-magia'), its opening text first as SITUACION_GENERAL. */
  blocks: LabeledBlock[];
  /** The whole situation when it has no bold labels; empty otherwise. */
  intro: string;
  /** Author and day of post #1, and day of its last edit, from the importer's notes. */
  authorName?: string;
  publishedAt?: string;
  editedAt?: string;
  /** The body without "## Situación" and "## Historial": whatever the DMs add. */
  rest: string;
}

/** The situation of a crónica, from its body without the '## Historial' section. */
export function parseSituacion(fichaBody: string): Situacion {
  const { section, rest } = cutSection(fichaBody, SITUACION_SECTION);
  const { markdown, published, edited } = splitPostNotes(section ?? '');
  const { intro, blocks } = splitBlocks(markdown, {
    idOf: (label) => `s-${label}`,
    introLabel: SITUACION_GENERAL,
  });
  return {
    blocks,
    intro,
    ...(published ? { authorName: published.by, publishedAt: published.date } : {}),
    ...(edited ? { editedAt: edited.date } : {}),
    rest,
  };
}

/** What the browser knows of a crónica before its body loads. */
export interface CronicaMeta {
  /** Newest day among the posts and edits of the thread, 'AAAA-MM-DD'. */
  updated?: string;
  /** Who wrote the situation and the annexes, with how many posts each, most first. */
  narrators: NameCount[];
  situacion: {
    authorName?: string;
    publishedAt?: string;
    editedAt?: string;
    /** The index of the situation: anchor and label of each block. */
    blocks: { id: string; label: string }[];
  };
}

export function cronicaMeta(
  situacion: Situacion,
  items: readonly HistorialItemMeta[],
): CronicaMeta {
  const narrators = new Counter();
  if (situacion.authorName) narrators.add(situacion.authorName, situacion.authorName);
  for (const item of items) narrators.add(item.authorName, item.authorName);

  // ISO dates sort chronologically as plain text.
  const days = [
    situacion.publishedAt,
    situacion.editedAt,
    ...items.flatMap((item) => [item.date, item.editedAt]),
  ].flatMap((day) => (day ? [day] : []));
  const updated = days.sort().at(-1);

  const { authorName, publishedAt, editedAt } = situacion;
  return {
    ...(updated ? { updated } : {}),
    narrators: narrators.top(),
    situacion: {
      ...(authorName ? { authorName } : {}),
      ...(publishedAt ? { publishedAt } : {}),
      ...(editedAt ? { editedAt } : {}),
      blocks: situacion.blocks.map(({ id, label }) => ({ id, label })),
    },
  };
}

/**
 * A block of the situation as a search result of its own: 'Situación de Gadélica · Magia', or
 * '<crónica> · Magia' when it has no zona.
 */
export function situacionSearchTitle(
  cronicaTitle: string,
  zonaTitle: string | undefined,
  label: string,
): string {
  return `${zonaTitle ? `Situación de ${zonaTitle}` : cronicaTitle} · ${label}`;
}
