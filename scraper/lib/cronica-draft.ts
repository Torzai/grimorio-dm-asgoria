import { Document as YamlDocument } from 'yaml';
import { SITUACION_HEADING } from '../config';
import { isoDay, spanishDay } from './dates';
import { editNote, historyEntry } from './history-entry';
import { flowLists, YAML_OPTIONS } from './entry-file';
import { postToMarkdown, redactPersonalData } from './markdown';
import type { ForumPost } from './thread-page';

export interface CronicaReport {
  /** Annexes written: posts #2…N. */
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
  /** Everything after the frontmatter: "## Situación" and "## Historial". */
  body: string;
  report: CronicaReport;
}

export interface CronicaDraftInput {
  threadUrl: string;
  /** Title of a new entry. */
  title: string;
  zona?: string;
  posts: ForumPost[];
  /** 'YYYY-MM-DD' */
  today: string;
}

/**
 * Draft of a crónica: post #1, the summary its author keeps editing, goes under "## Situación";
 * every reply becomes an entry of "## Historial" in the order of the thread (they are annexes on
 * a subject, not dated reports), written as the PJ importer writes its history.
 */
export function renderCronicaDraft(input: CronicaDraftInput): CronicaDraft {
  const [opening, ...replies] = [...input.posts].sort((a, b) => a.number - b.number);
  if (opening?.number !== 1) throw new Error('falta el post #1, que es la situación');

  const situacion = postToMarkdown(opening.html);
  const report: CronicaReport = {
    entries: 0,
    edited: [],
    discordPastes: [],
    images: situacion.images.length,
    droppedLinks: situacion.droppedLinks.length,
    oddPosts: situacion.markdown ? [] : ['#1: sin texto tras la limpieza'],
  };
  if (situacion.discordPaste) report.discordPastes.push(1);
  if (opening.editedAt) report.edited.push(1);

  const blocks = [`## ${SITUACION_HEADING}`, situacion.markdown || '_(sin texto)_'];
  const published = publishedNote(opening);
  if (published) blocks.push(published);
  const edited = editNote(opening);
  if (edited) blocks.push(edited);

  if (replies.length > 0) blocks.push('## Historial');
  for (const post of replies) {
    const entry = historyEntry(post);
    report.entries++;
    if (entry.converted.discordPaste) report.discordPastes.push(post.number);
    if (post.editedAt) report.edited.push(post.number);
    report.images += entry.converted.images.length;
    report.droppedLinks += entry.converted.droppedLinks.length;
    report.oddPosts.push(...entry.oddities);
    blocks.push(...entry.blocks);
  }

  const days = input.posts
    .flatMap((post) => [post.postedAt, post.editedAt])
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

/** '_Publicado el 17/12/2022 por She Wolf_': the day of post #1, which has no heading. */
function publishedNote(post: ForumPost): string | undefined {
  if (!post.postedAt) return undefined;
  const author = redactPersonalData(post.authorName) || 'autor desconocido';
  return `_Publicado el ${spanishDay(post.postedAt)} por ${author}_`;
}

function frontmatter({ title, zona, threadUrl, today }: CronicaDraftInput): string {
  const doc = new YamlDocument({
    type: 'cronica',
    title: redactPersonalData(title),
    zona,
    hilo: threadUrl,
    importado: today,
    tags: ['importado'],
  });
  flowLists(doc);
  return doc.toString(YAML_OPTIONS);
}
