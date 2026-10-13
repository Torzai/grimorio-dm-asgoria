import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { RAW_DIR, THREAD_KINDS } from './config';
import { extractThreadDir, printExtractSummary } from './extract-thread';
import { crawlThread } from './lib/crawl';
import { CrawlStop, ForumClient } from './lib/forum-client';
import { threadSlug } from './lib/thread-page';

// npm run scrape:thread -- --url <url del hilo> --kind pj [--force]
// Downloads every page of one thread, in order and one request at a time, to
// scraper/raw/<kind>/<thread-slug>/page-NN.html, then extracts posts.json. Pages already on disk
// are skipped (--force downloads them again), so an interrupted crawl resumes where it stopped.

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    kind: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
});

const client = new ForumClient();
try {
  const threadUrl = (values.url ?? '').replace(/\/$/, '');
  const slug = threadSlug(threadUrl);
  if (!slug) {
    throw new CrawlStop(
      'Uso: npm run scrape:thread -- --url https://asgoria.com.ar/foro/topic/<hilo> --kind pj',
    );
  }
  const kind = values.kind ?? '';
  if (!(THREAD_KINDS as readonly string[]).includes(kind)) {
    throw new CrawlStop(`--kind debe ser uno de: ${THREAD_KINDS.join(', ')}`);
  }

  const dir = join(RAW_DIR, kind, slug);
  await mkdir(dir, { recursive: true });
  await crawlThread(client, threadUrl, dir, { force: values.force, verbose: true });
  printExtractSummary(await extractThreadDir(dir));
} catch (error) {
  if (!(error instanceof CrawlStop)) throw error;
  console.error(`✖ ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.close();
}
