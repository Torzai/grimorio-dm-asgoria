import { Document as YamlDocument, isScalar, visit } from 'yaml';
import { normalize, slugify } from '../../src/content/normalize';
import {
  ACTIVE_DAYS,
  PJ_SUBFORUMS,
  SEXO_PATTERNS,
  THREAD_TITLE_PATTERN,
  UNKNOWN_ACCOUNT,
} from '../config';
import type { ImageNote } from './clean-post';
import { daysBetween, isoDay, spanishDay } from './dates';
import { postToMarkdown, redactPersonalData } from './markdown';
import type { PjSubforum } from './pj-index';
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
  /** Where `cuenta_nwn` came from. */
  cuentaFrom: 'ficha' | 'titulo' | 'desconocida';
  /** Where `sexo` came from: the form (normalized or as written), the subforum, or nowhere. */
  sexoFrom: 'ficha' | 'ficha-sin-normalizar' | 'subforo' | 'desconocido';
  /** Estado a new entry gets, from the newest post of the thread (#1 included). */
  estado: 'activo' | 'inactivo';
  /** Day of the newest post of the thread; undefined when no post has a date. */
  lastPost?: string;
}

export interface PjDraft {
  /** File name, without '.md': the PJ's name. */
  slug: string;
  /** File name when `slug` belongs to another PJ: name and account. */
  fallbackSlug: string;
  /** YAML of a new entry, without the '---' lines. */
  frontmatter: string;
  /** Everything after the frontmatter: the form's sections and the history. */
  body: string;
  report: DraftReport;
}

export interface PjDraftInput {
  threadUrl: string;
  /** "Nombre ( Cuenta )": name and account when the form lacks them. */
  threadTitle?: string;
  /** Subforum the thread was listed in: sexo when the form lacks it. */
  subforum?: PjSubforum;
  posts: ForumPost[];
  /** 'YYYY-MM-DD' */
  today: string;
}

/** Same YAML style everywhere the importer writes: one line per value, lists in brackets. */
export const YAML_OPTIONS = { lineWidth: 0, flowCollectionPadding: false } as const;

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
export function renderPjDraft(input: PjDraftInput): PjDraft {
  const [form, ...replies] = [...input.posts].sort((a, b) => a.number - b.number);
  if (form?.number !== 1) throw new Error('falta el post #1, que es la ficha del personaje');

  const sheet = parseSheet(form.html);
  const fromTitle = THREAD_TITLE_PATTERN.exec(input.threadTitle ?? '');
  const titleName = (fromTitle?.[1] ?? input.threadTitle ?? '').trim();
  const titleAccount = fromTitle?.[2].trim() ?? '';

  const lastPost = input.posts
    .flatMap((post) => (post.postedAt ? [isoDay(post.postedAt)] : []))
    .sort()
    .at(-1);
  const estado =
    lastPost && daysBetween(lastPost, input.today) < ACTIVE_DAYS ? 'activo' : 'inactivo';

  const formSexo = sheet.fields.sexo;
  const knownSexo = formSexo ? normalizeSexo(formSexo) : undefined;
  const sexo = formSexo ? (knownSexo ?? formSexo) : subforumSexo(input.subforum);

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
    cuentaFrom: sheet.fields.cuenta_nwn ? 'ficha' : titleAccount ? 'titulo' : 'desconocida',
    sexoFrom: formSexo
      ? knownSexo
        ? 'ficha'
        : 'ficha-sin-normalizar'
      : sexo
        ? 'subforo'
        : 'desconocido',
    estado,
    lastPost,
  };

  const title = sheet.fields.title ?? (titleName ? redactPersonalData(titleName) : undefined);
  const cuenta =
    sheet.fields.cuenta_nwn ?? (titleAccount ? redactPersonalData(titleAccount) : UNKNOWN_ACCOUNT);
  if (!sheet.fields.title && title) report.oddPosts.push('nombre tomado del título del hilo');

  const blocks: string[] = [];
  for (const { heading, markdown } of sheet.sections) blocks.push(`## ${heading}`, markdown);
  if (sheet.others.length > 0) {
    blocks.push('## Otros datos');
    for (const { label, markdown } of sheet.others) blocks.push(`### ${label}`, markdown);
  }
  // A PJ without replies has no history, so no empty section either.
  if (replies.length > 0) blocks.push('## Historial');
  for (const post of replies.reverse()) blocks.push(...historyEntry(post, report));

  const slug = slugify(title ?? '') || threadSlug(input.threadUrl) || 'pj-sin-nombre';
  return {
    slug,
    fallbackSlug: cuenta === UNKNOWN_ACCOUNT ? `${slug}-2` : `${slug}-${slugify(cuenta)}`,
    frontmatter: frontmatter({
      sheet,
      title,
      cuenta,
      sexo,
      estado,
      lastPost,
      threadUrl: input.threadUrl,
      today: input.today,
    }),
    body: `${blocks.join('\n\n')}\n`,
    report,
  };
}

/** A whole new file: frontmatter and body. */
export function draftMarkdown(draft: PjDraft): string {
  return `---\n${draft.frontmatter}---\n\n${draft.body}`;
}

function frontmatter(values: {
  sheet: PjSheet;
  title: string | undefined;
  cuenta: string;
  sexo: string | undefined;
  estado: DraftReport['estado'];
  lastPost: string | undefined;
  threadUrl: string;
  today: string;
}): string {
  const { sheet, title } = values;
  const { raza, alineamiento, deidad } = sheet.fields;
  const words = title?.split(' ') ?? [];
  const doc = new YamlDocument({
    type: 'pj',
    title,
    aliases: words.length > 1 ? [words[0]] : undefined,
    cuenta_nwn: values.cuenta,
    sexo: values.sexo,
    raza,
    clases: sheet.clases.length > 0 ? sheet.clases : undefined,
    alineamiento,
    deidad,
    estado: values.estado,
    hilo: values.threadUrl,
    importado: values.today,
    tags: ['importado'],
  });
  visit(doc, {
    Seq: (_key, seq) => {
      seq.flow = true;
    },
  });
  const estado = doc.get('estado', true);
  if (isScalar(estado)) {
    estado.comment = values.lastPost
      ? ` por el último post del hilo (${values.lastPost}); el DM lo revisa`
      : ' ningún post tiene fecha; el DM lo revisa';
  }
  return doc.toString(YAML_OPTIONS);
}

/** 'masculino', 'Hombre', 'MASC.' → 'Masculino'; undefined when it is something else. */
function normalizeSexo(value: string): string | undefined {
  const key = normalize(value);
  return SEXO_PATTERNS.find(({ pattern }) => pattern.test(key))?.value;
}

function subforumSexo(subforum: PjSubforum | undefined): string | undefined {
  return PJ_SUBFORUMS.find(({ id }) => id === subforum)?.sexo;
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
