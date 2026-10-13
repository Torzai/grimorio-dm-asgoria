import { z } from 'zod';
import { PJ_SUBFORUMS } from '../config';

const subforumIds = PJ_SUBFORUMS.map((s) => s.id);

export const pjIndexEntrySchema = z.object({
  url: z.string(),
  slug: z.string(),
  title: z.string(),
  subforum: z.enum(
    subforumIds as [(typeof subforumIds)[number], ...(typeof subforumIds)[number][]],
  ),
  /** Replies shown in the listing, when visible. */
  replies: z.number().int().nonnegative().optional(),
  /** Local 'YYYY-MM-DDTHH:mm' of the last post, when the listing shows an absolute date. */
  lastPostAt: z.string().optional(),
  /** Relative date of the last post as the listing shows it ("hace 4 semanas"). */
  lastPostAgo: z.string().optional(),
});

/** Shape of scraper/raw/pj/_index.json. */
export const pjIndexSchema = z.object({
  generatedAt: z.string(),
  threads: z.array(pjIndexEntrySchema),
});

export type PjIndexEntry = z.infer<typeof pjIndexEntrySchema>;
export type PjSubforum = PjIndexEntry['subforum'];
