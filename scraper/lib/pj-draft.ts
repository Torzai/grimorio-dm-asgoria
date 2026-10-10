import { Document as YamlDocument, isScalar, visit } from 'yaml';
import { slugify } from '../../src/content/normalize';
import type { ImageNote } from './clean-post';
import { isoDay, spanishDay } from './dates';
import { postToMarkdown, redactPersonalData } from './markdown';
import { parseSheet, type PjSheet, type SheetField } from './pj-sheet';
import { threadSlug, type ForumPost } from './thread-page';

export interface DraftReport {
  /** History entries written: posts #2…N. */
  entries: number;
  /** Day of the first entry of the history (the newest) and of the last one (the oldest). */
  newest?: string;
  oldest?: string;
  edited: number[];
  discordPastes: number[];
  quotes: number[];
  images: { post: number; image: ImageNote }[];
  droppedLinks: { post: number; kind: 'mailto' | 'discord' }[];
  unknownLabels: string[];
  discardedLabels: string[];
  missingFields: string[];
  oddPosts: string[];
}

export interface PjDraft {
  /** File name for content/_inbox/pj/, without '.md'. */
  slug: string;
  markdown: string;
  report: DraftReport;
}

const REQUIRED_FIELDS: SheetField[] = [
  'title',
  'cuenta_nwn',
  'sexo',
  'raza',
  'alineamiento',
  'deidad',
];

/**
 * Draft of a PJ: post #1 (the authorization form) becomes frontmatter and sections, and every
 * reply becomes a history entry, newest first.
 */
export function renderPjDraft(input: {
  threadUrl: string;
  posts: ForumPost[];
  /** 'YYYY-MM-DD' */
  today: string;
}): PjDraft {
  const [form, ...replies] = [...input.posts].sort((a, b) => a.number - b.number);
  if (form?.number !== 1) throw new Error('falta el post #1, que es la ficha del personaje');

  const sheet = parseSheet(form.html);
  const report: DraftReport = {
    entries: 0,
    edited: [],
    discordPastes: [],
    quotes: [],
    images: sheet.notes.flatMap(({ images }) => images.map((image) => ({ post: 1, image }))),
    droppedLinks: sheet.notes.flatMap(({ droppedLinks }) =>
      droppedLinks.map((kind) => ({ post: 1, kind })),
    ),
    unknownLabels: sheet.others.map(({ label }) => label),
    discardedLabels: sheet.discarded,
    missingFields: [
      ...REQUIRED_FIELDS.filter((field) => !sheet.fields[field]),
      ...(sheet.clases.length === 0 ? ['clases'] : []),
    ],
    oddPosts: [],
  };

  const blocks: string[] = [];
  for (const { heading, markdown } of sheet.sections) blocks.push(`## ${heading}`, markdown);
  if (sheet.others.length > 0) {
    blocks.push('## Otros datos');
    for (const { label, markdown } of sheet.others) blocks.push(`### ${label}`, markdown);
  }
  blocks.push('## Historial');
  for (const post of replies.reverse()) blocks.push(...historyEntry(post, report));

  return {
    slug: slugify(sheet.fields.title ?? '') || threadSlug(input.threadUrl) || 'pj-sin-nombre',
    markdown: `---\n${frontmatter(sheet, input.threadUrl, input.today)}---\n\n${blocks.join('\n\n')}\n`,
    report,
  };
}

function frontmatter(sheet: PjSheet, threadUrl: string, today: string): string {
  const { title, cuenta_nwn, sexo, raza, alineamiento, deidad } = sheet.fields;
  const words = title?.split(' ') ?? [];
  const doc = new YamlDocument({
    type: 'pj',
    title,
    aliases: words.length > 1 ? [words[0]] : undefined,
    cuenta_nwn,
    sexo,
    raza,
    clases: sheet.clases.length > 0 ? sheet.clases : undefined,
    alineamiento,
    deidad,
    estado: 'activo',
    hilo: threadUrl,
    importado: today,
    tags: ['importado'],
  });
  visit(doc, {
    Seq: (_key, seq) => {
      seq.flow = true;
    },
  });
  const estado = doc.get('estado', true);
  if (isScalar(estado)) estado.comment = ' provisional: el DM lo revisa';
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false });
}

function historyEntry(post: ForumPost, report: DraftReport): string[] {
  const { markdown, discordPaste, quotes, images, droppedLinks } = postToMarkdown(post.html);
  const day = post.postedAt ? isoDay(post.postedAt) : 'sin fecha';
  const author = redactPersonalData(post.authorName) || 'autor desconocido';
  const handle = post.authorHandle ? ` (@${post.authorHandle})` : '';

  report.entries++;
  report.newest ??= day;
  report.oldest = day;
  if (discordPaste) report.discordPastes.push(post.number);
  if (quotes > 0) report.quotes.push(post.number);
  report.images.push(...images.map((image) => ({ post: post.number, image })));
  report.droppedLinks.push(...droppedLinks.map((kind) => ({ post: post.number, kind })));
  if (!post.postedAt) report.oddPosts.push(`#${post.number}: sin fecha`);
  if (!post.authorName) report.oddPosts.push(`#${post.number}: sin autor`);
  if (!post.authorHandle) report.oddPosts.push(`#${post.number}: sin @usuario`);
  if (!markdown) report.oddPosts.push(`#${post.number}: sin texto tras la limpieza`);

  const lines = [`### ${day} · ${author}${handle}`, markdown || '_(sin texto)_'];
  if (post.editedAt && post.editedBy) {
    report.edited.push(post.number);
    lines.push(
      `_Editado el ${spanishDay(post.editedAt)} por ${redactPersonalData(post.editedBy)}_`,
    );
  }
  return lines;
}
