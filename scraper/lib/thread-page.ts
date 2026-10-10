import { z } from 'zod';
import {
  EDIT_NOTE_PATTERN,
  PAGE_COUNTER_PATTERN,
  POST_NUMBER_PATTERN,
  SELECTORS,
  THREAD_URL_PATTERN,
} from '../config';
import { parseForumDate } from './dates';
import { textOf } from './html';

export const forumPostSchema = z.object({
  /** Position in the thread: 1 is the opening post. */
  number: z.number().int().positive(),
  authorName: z.string(),
  /** Without the '@'. */
  authorHandle: z.string(),
  /** Local 'YYYY-MM-DDTHH:mm'; null when the date line could not be read. */
  postedAt: z.string().nullable(),
  editedAt: z.string().optional(),
  editedBy: z.string().optional(),
  /** Content only: no signature, reactions or hidden quote copy. */
  html: z.string(),
  page: z.number().int().positive(),
});

/** Shape of raw/<kind>/<slug>/posts.json. */
export const threadDumpSchema = z.object({
  url: z.string(),
  title: z.string(),
  pages: z.number().int().nonnegative(),
  posts: z.array(forumPostSchema),
});

export type ForumPost = z.infer<typeof forumPostSchema>;
export type ThreadDump = z.infer<typeof threadDumpSchema>;

export interface Pagination {
  current?: number;
  total?: number;
  /** Absolute URL of the next page; undefined on the last one. */
  nextUrl?: string;
}

export interface PageExtraction {
  posts: ForumPost[];
  /** Anything odd found while reading the page, in Spanish, for the log. */
  problems: string[];
}

/** '…/foro/topic/einar-eriksson-fernando10100' → 'einar-eriksson-fernando10100'. */
export function threadSlug(url: string): string | undefined {
  return THREAD_URL_PATTERN.exec(url)?.[1];
}

/** 3 → 'page-03.html' */
export function pageFileName(page: number): string {
  return `page-${String(page).padStart(2, '0')}.html`;
}

/** 'page-03.html' → 3; undefined for any other file. */
export function pageNumberOf(fileName: string): number | undefined {
  const match = /^page-(\d+)\.html$/.exec(fileName);
  return match ? Number(match[1]) : undefined;
}

export function readPagination(doc: Document, pageUrl: string): Pagination {
  const counter = PAGE_COUNTER_PATTERN.exec(textOf(doc.querySelector(SELECTORS.pageCounter)));
  const href = doc.querySelector(SELECTORS.nextPageIcon)?.closest('a')?.getAttribute('href');
  return {
    current: counter ? Number(counter[1]) : undefined,
    total: counter ? Number(counter[2]) : undefined,
    nextUrl: href ? new URL(href, pageUrl).href : undefined,
  };
}

export function readThreadInfo(doc: Document): { url?: string; title: string } {
  return {
    url: doc.querySelector(SELECTORS.canonical)?.getAttribute('href') ?? undefined,
    title: textOf(doc.querySelector(SELECTORS.title)),
  };
}

export function countPosts(doc: Document): number {
  return doc.querySelectorAll(SELECTORS.post).length;
}

export function extractPosts(doc: Document, page: number): PageExtraction {
  const posts: ForumPost[] = [];
  const problems: string[] = [];

  for (const element of doc.querySelectorAll(SELECTORS.post)) {
    const where = `página ${page}, ${element.id || 'post sin id'}`;
    const numberMatch = POST_NUMBER_PATTERN.exec(
      textOf(element.querySelector(SELECTORS.postNumber)),
    );
    if (!numberMatch) {
      problems.push(`${where}: sin número de post; se omite`);
      continue;
    }
    const number = Number(numberMatch[1]);

    const postedAt = parseForumDate(textOf(element.querySelector(SELECTORS.postDate))) ?? null;
    const authorName = textOf(element.querySelector(SELECTORS.authorName));
    const authorHandle = textOf(element.querySelector(SELECTORS.authorHandle)).replace(/^@/, '');
    const body = element.querySelector(SELECTORS.body);

    const post: ForumPost = {
      number,
      authorName,
      authorHandle,
      postedAt,
      html: body ? contentOf(body) : '',
      page,
    };

    const editNote = textOf(element.querySelector(SELECTORS.editNote));
    if (editNote) {
      const edit = EDIT_NOTE_PATTERN.exec(editNote);
      const editedAt = edit ? parseForumDate(edit[1]) : undefined;
      if (edit && editedAt) {
        post.editedAt = editedAt;
        post.editedBy = edit[2].trim();
      } else {
        problems.push(`#${number}: nota de edición no reconocida («${editNote}»)`);
      }
    }

    if (!postedAt) problems.push(`#${number}: sin fecha reconocible`);
    if (!authorName) problems.push(`#${number}: sin autor`);
    if (!body) problems.push(`#${number}: sin cuerpo`);
    posts.push(post);
  }

  return { posts, problems };
}

/** Joins the posts of several pages: one per number (the first seen wins), sorted by number. */
export function mergePosts(pages: ForumPost[][]): { posts: ForumPost[]; duplicates: number[] } {
  const byNumber = new Map<number, ForumPost>();
  const duplicates: number[] = [];
  for (const post of pages.flat()) {
    if (byNumber.has(post.number)) duplicates.push(post.number);
    else byNumber.set(post.number, post);
  }
  return { posts: [...byNumber.values()].sort((a, b) => a.number - b.number), duplicates };
}

function contentOf(body: Element): string {
  const copy = body.cloneNode(true) as Element;
  for (const noise of copy.querySelectorAll(SELECTORS.bodyNoise.join(', '))) noise.remove();
  return copy.innerHTML.trim();
}
