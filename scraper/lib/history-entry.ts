import { isoDay, spanishDay } from './dates';
import { postToMarkdown, redactPersonalData, type ConvertedPost } from './markdown';
import type { ForumPost } from './thread-page';

/** One reply of a thread written as an entry of a '## Historial' section. */
export interface WrittenEntry {
  /** The '### AAAA-MM-DD · Nombre (@usuario)' heading, the text and the edit note. */
  blocks: string[];
  /** 'AAAA-MM-DD', or 'sin fecha'. */
  day: string;
  converted: ConvertedPost;
  /** What looks wrong in the post, for the report: '#3: sin fecha'… */
  oddities: string[];
}

/**
 * The entry of a reply, in the format every '## Historial' uses (src/content/historial.ts):
 * the PJ importer and the topics importer write it with this one function. `converted` is the
 * part of the post to write, when only a part of it belongs here.
 */
export function historyEntry(
  post: ForumPost,
  converted: ConvertedPost = postToMarkdown(post.html),
): WrittenEntry {
  const day = post.postedAt ? isoDay(post.postedAt) : 'sin fecha';
  const author = redactPersonalData(post.authorName) || 'autor desconocido';
  const handle = post.authorHandle ? ` (@${post.authorHandle})` : '';

  const oddities: string[] = [];
  if (!post.postedAt) oddities.push(`#${post.number}: sin fecha`);
  if (!post.authorName) oddities.push(`#${post.number}: sin autor`);
  if (!post.authorHandle) oddities.push(`#${post.number}: sin @usuario`);
  if (!converted.markdown) oddities.push(`#${post.number}: sin texto tras la limpieza`);

  const blocks = [`### ${day} · ${author}${handle}`, converted.markdown || '_(sin texto)_'];
  const note = editNote(post);
  if (note) blocks.push(note);
  return { blocks, day, converted, oddities };
}

/** '_Editado el 28/04/2025 por She Wolf_'; undefined when the post was never edited. */
export function editNote(post: ForumPost): string | undefined {
  if (!post.editedAt || !post.editedBy) return undefined;
  return `_Editado el ${spanishDay(post.editedAt)} por ${redactPersonalData(post.editedBy)}_`;
}
