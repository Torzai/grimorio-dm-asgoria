import type { z } from 'zod';
import type { entrySchemas } from './schemas.ts';

export const ENTRY_TYPES = [
  'npc',
  'pj',
  'zona',
  'lore',
  'varita',
  'comando',
  'herramienta',
  'sesion',
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

export type FrontmatterOf<T extends EntryType> = z.infer<(typeof entrySchemas)[T]>;

/** An entry without its body: what the browser loads up front for every entry. */
export interface EntryMeta<T extends EntryType = EntryType> {
  slug: string;
  type: T;
  /** Repo-relative path, e.g. 'content/npc/ejemplo.md'. */
  path: string;
  data: FrontmatterOf<T>;
}

export interface Entry<T extends EntryType = EntryType> extends EntryMeta<T> {
  /** Markdown without the frontmatter block. */
  body: string;
}

export interface ContentIssue {
  path: string;
  level: 'error' | 'warning';
  field?: string;
  /** Human-readable message in Spanish, aimed at DMs who don't code. */
  message: string;
}
