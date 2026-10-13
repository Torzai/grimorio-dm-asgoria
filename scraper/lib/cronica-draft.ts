import { Document as YamlDocument } from 'yaml';
import { THREAD_PROFILES } from '../../src/content/cronica';
import type { LoreCategory } from '../config';
import { isoDay, spanishDay } from './dates';
import { editNote, historyEntry } from './history-entry';
import { flowLists, YAML_OPTIONS } from './entry-file';
import { postToMarkdown, redactPersonalData, type ConvertedPost } from './markdown';
import type { ForumPost } from './thread-page';

export interface CronicaReport {
  /** Annexes written: every part after the situation. */
  entries: number;
  /** Oldest and newest day of the thread, posts and edits of every post included. */
  first?: string;
  last?: string;
  edited: number[];
  discordPastes: number[];
  images: number;
  droppedLinks: number;
  oddPosts: string[];
}

export interface CronicaDraft {
  /** YAML of a new entry, without the '---' lines. */
  frontmatter: string;
  /** Everything after the frontmatter: "## Situación" (or "## Contenido") and "## Historial". */
  body: string;
  report: CronicaReport;
}

/**
 * What the draft becomes: a crónica, whose post #1 goes under "## Situación", or a lore entry
 * of the given category, under "## Contenido". Both write the replies the same way.
 */
export type DraftTarget = { type: 'cronica' } | { type: 'lore'; categoria: LoreCategory };

/** A post of the crónica, or the part of it that belongs to the crónica's region. */
export interface DraftPart {
  post: ForumPost;
  converted: ConvertedPost;
}

export interface CronicaDraftInput {
  target: DraftTarget;
  /** What goes in `hilo`: the thread, or the anchor of the entry's first post in it. */
  threadUrl: string;
  /** Title of a new entry. */
  title: string;
  zona?: string;
  /** The situation (or content) first, then its annexes in thread order. */
  parts: readonly DraftPart[];
  /** 'YYYY-MM-DD' */
  today: string;
}

/** The parts of a thread on one subject: every post whole, post #1 (the main one) first. */
export function wholeThread(posts: readonly ForumPost[]): DraftPart[] {
  const sorted = [...posts].sort((a, b) => a.number - b.number);
  if (sorted[0]?.number !== 1) throw new Error('falta el post #1, que es el principal del hilo');
  return sorted.map((post) => ({ post, converted: postToMarkdown(post.html) }));
}

/**
 * Draft of a crónica or of a lore entry: the first part, the summary its author keeps editing
 * (post #1 of a thread on one subject), goes under "## Situación" ("## Contenido" for lore);
 * every other part becomes an entry of "## Historial" in the order of the thread (they are
 * annexes on a subject, not dated reports), written as the PJ importer writes its history.
 */
export function renderCronicaDraft(input: CronicaDraftInput): CronicaDraft {
  const [first, ...replies] = input.parts;
  if (!first) throw new Error('no hay ningún post principal para el hilo');
  const { post: opening, converted: situacion } = first;

  const report: CronicaReport = {
    entries: 0,
    edited: [],
    discordPastes: [],
    images: situacion.images.length,
    droppedLinks: situacion.droppedLinks.length,
    oddPosts: situacion.markdown ? [] : [`#${opening.number}: sin texto tras la limpieza`],
  };
  if (situacion.discordPaste) report.discordPastes.push(opening.number);
  if (opening.editedAt) report.edited.push(opening.number);

  const blocks = [
    `## ${THREAD_PROFILES[input.target.type].heading}`,
    situacion.markdown || '_(sin texto)_',
  ];
  const published = publishedNote(opening);
  if (published) blocks.push(published);
  const edited = editNote(opening);
  if (edited) blocks.push(edited);

  if (replies.length > 0) blocks.push('## Historial');
  for (const { post, converted } of replies) {
    const entry = historyEntry(post, converted);
    report.entries++;
    if (entry.converted.discordPaste) report.discordPastes.push(post.number);
    if (post.editedAt) report.edited.push(post.number);
    report.images += entry.converted.images.length;
    report.droppedLinks += entry.converted.droppedLinks.length;
    report.oddPosts.push(...entry.oddities);
    blocks.push(...entry.blocks);
  }

  const days = input.parts
    .flatMap(({ post }) => [post.postedAt, post.editedAt])
    .flatMap((date) => (date ? [isoDay(date)] : []))
    .sort();
  report.first = days[0];
  report.last = days.at(-1);

  return {
    frontmatter: frontmatter(input),
    body: `${blocks.join('\n\n')}\n`,
    report,
  };
}

/** '_Publicado el 17/12/2022 por She Wolf_': the day of the situation, which has no heading. */
function publishedNote(post: ForumPost): string | undefined {
  if (!post.postedAt) return undefined;
  const author = redactPersonalData(post.authorName) || 'autor desconocido';
  return `_Publicado el ${spanishDay(post.postedAt)} por ${author}_`;
}

function frontmatter({ target, title, zona, threadUrl, today }: CronicaDraftInput): string {
  const doc = new YamlDocument({
    type: target.type,
    title: redactPersonalData(title),
    ...(target.type === 'lore' ? { categoria: target.categoria } : {}),
    zona,
    hilo: threadUrl,
    importado: today,
    tags: ['importado'],
  });
  flowLists(doc);
  return doc.toString(YAML_OPTIONS);
}
