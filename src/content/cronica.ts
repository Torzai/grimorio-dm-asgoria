import { Counter, type HistorialItemMeta, type NameCount } from './historial-items.ts';
import { cutSection } from './markdown-text.ts';
import { splitBlocks, splitPostNotes, type LabeledBlock } from './post-structure.ts';
import type { EntryMeta, EntryType } from './types.ts';

/*
 * A crónica is a forum thread on a region or a plot: post #1, which its author keeps editing,
 * is the situation ('## Situación'), and the replies are annexes in its '## Historial'
 * (historial.ts, with the thread profile). A lore entry imported from a thread has the same
 * shape, with its main post under '## Contenido'; names here say 'situación' for both. Node-safe
 * and pure: the content plugin derives the metadata at build time and the browser splits the
 * loaded body with the same functions.
 */

/** Types whose body can be a forum thread: a main post and its replies as annexes. */
export const THREAD_TYPES = ['cronica', 'lore'] as const satisfies readonly EntryType[];

export type ThreadType = (typeof THREAD_TYPES)[number];

export function isThreadType(type: string | undefined): type is ThreadType {
  return THREAD_TYPES.some((threadType) => threadType === type);
}

/** What changes from one thread type to another: how its main post is called. */
export interface ThreadProfile {
  /** Heading of post #1 in the body, and the label of its tab. */
  heading: string;
  /** ?tab= of the tab that shows post #1. */
  tab: string;
  /** The line of the body that opens post #1's section. */
  section: RegExp;
  /** Label of what post #1 says before its first bold label. */
  general: string;
  /** Anchor of the whole of post #1, when it has no bold labels to split it in blocks. */
  anchor: string;
}

export const THREAD_PROFILES: Readonly<Record<ThreadType, ThreadProfile>> = {
  cronica: {
    heading: 'Situación',
    tab: 'situacion',
    section: /^##\s+situaci[oó]n\s*#*\s*$/i,
    general: 'Situación general',
    anchor: 's-situacion',
  },
  lore: {
    heading: 'Contenido',
    tab: 'contenido',
    section: /^##\s+contenido\s*#*\s*$/i,
    general: 'Contenido general',
    anchor: 's-contenido',
  },
};

/**
 * Whether an entry is shown as a thread: a crónica always; a lore entry when it comes from a
 * forum thread (`hilo`, which the importer writes, even when nobody has replied yet) or has
 * annexes in its '## Historial'. The lore that was never a thread keeps its ordinary view.
 */
export function hasThreadView(entry: Pick<EntryMeta, 'data'>, annexes: number): boolean {
  const { data } = entry;
  if (data.type === 'cronica') return true;
  return data.type === 'lore' && (data.hilo !== undefined || annexes > 0);
}

export interface Situacion {
  /** The situation's thematic blocks ('s-magia'), its opening text first as the profile's `general`. */
  blocks: LabeledBlock[];
  /** The whole situation when it has no bold labels; empty otherwise. */
  intro: string;
  /** Author and day of post #1, and day of its last edit, from the importer's notes. */
  authorName?: string;
  publishedAt?: string;
  editedAt?: string;
  /** The body without the main section and "## Historial": whatever the DMs add. */
  rest: string;
}

/** The situation of a thread, from its body without the '## Historial' section. */
export function parseSituacion(fichaBody: string, type: ThreadType): Situacion {
  const profile = THREAD_PROFILES[type];
  const { section, rest } = cutSection(fichaBody, profile.section);
  const { markdown, published, edited } = splitPostNotes(section ?? '');
  const { intro, blocks } = splitBlocks(markdown, {
    idOf: (label) => `s-${label}`,
    introLabel: profile.general,
  });
  return {
    blocks,
    intro,
    ...(published ? { authorName: published.by, publishedAt: published.date } : {}),
    ...(edited ? { editedAt: edited.date } : {}),
    rest,
  };
}

/** What the browser knows of a crónica (or a lore thread) before its body loads. */
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
 * '<crónica> · Magia' when it has no zona; '<lore> · Magia' for a lore thread.
 */
export function situacionSearchTitle(
  type: ThreadType,
  title: string,
  zonaTitle: string | undefined,
  label: string,
): string {
  return `${type === 'cronica' && zonaTitle ? `Situación de ${zonaTitle}` : title} · ${label}`;
}
