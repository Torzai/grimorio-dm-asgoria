import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { PJ_CRAWL_LOG, PJ_INDEX_FILE, RAW_DIR } from './config';
import { extractThreadDir } from './extract-thread';
import { crawlThread, lastPageOnDisk } from './lib/crawl';
import { CrawlStop, ForumClient } from './lib/forum-client';
import { pjIndexSchema, type PjIndexEntry } from './lib/pj-index';
import {
  classifyPjThread,
  errorMessage,
  pjThreadSummary,
  type PjThreadOutcome,
} from './lib/pj-thread';
import { threadDumpSchema } from './lib/thread-page';

// npm run scrape:pjs -- [--limit N] [--only <slug>]… [--refresh]
// Downloads, one after another, the PJ threads listed in scraper/raw/pj/_index.json (made by
// scrape:discover-pjs) with the same crawl as scrape:thread: 1500 ms between requests, and pages
// already on disk are not downloaded again, so a stopped run resumes where it was.
// Every thread is downloaded whole, whatever its post #1 holds, and lands in one group: with
// form, ficha-libre, excluded (clearly no PJ: rules, templates, staff notices) or failed. The run
// ends with the same summary as scrape:convert-all, which is the one that writes the entries.
// --refresh downloads again the last page of every thread (to catch new posts) and any missing.

const { values } = parseArgs({
  options: {
    limit: { type: 'string' },
    only: { type: 'string', multiple: true },
    refresh: { type: 'boolean', default: false },
  },
});

interface CrawlOutcome extends PjThreadOutcome {
  pages: number;
  posts: number;
  downloaded: number;
}

const client = new ForumClient();
const outcomes: CrawlOutcome[] = [];
try {
  const { threads, listed } = await selectThreads();
  await log(`--- ${new Date().toISOString()} · ${threads.length} hilos${refreshNote()}`);
  for (const [index, entry] of threads.entries()) {
    const outcome = await crawlPj(entry);
    outcomes.push(outcome);
    const line =
      `${index + 1}/${threads.length} ${entry.slug} páginas=${outcome.pages} ` +
      `posts=${outcome.posts} descargadas=${outcome.downloaded} → ${outcome.group}` +
      (outcome.reason ? ` (${outcome.reason})` : '');
    console.log(line);
    await log(line);
  }
  await printSummary(listed);
} catch (error) {
  if (!(error instanceof CrawlStop)) throw error;
  console.error(`✖ ${error.message}`);
  await log(`PARADO: ${error.message}`);
  console.error('  Lo descargado se conserva; relanza el mismo comando para seguir.');
  process.exitCode = 1;
} finally {
  await client.close();
}

async function selectThreads(): Promise<{ threads: PjIndexEntry[]; listed: number }> {
  if (!existsSync(PJ_INDEX_FILE)) {
    throw new CrawlStop('No existe _index.json: ejecuta antes npm run scrape:discover-pjs');
  }
  const { threads } = pjIndexSchema.parse(
    JSON.parse(await readFile(PJ_INDEX_FILE, 'utf8')) as unknown,
  );
  let selected = threads;
  if (values.only) {
    const wanted = new Set(values.only);
    selected = threads.filter((entry) => wanted.has(entry.slug));
    const missing = values.only.filter((slug) => !threads.some((entry) => entry.slug === slug));
    if (missing.length > 0) throw new CrawlStop(`No están en _index.json: ${missing.join(', ')}`);
  }
  if (values.limit !== undefined) {
    const limit = Number(values.limit);
    if (!Number.isInteger(limit) || limit < 1)
      throw new CrawlStop('--limit debe ser un entero ≥ 1');
    selected = selected.slice(0, limit);
  }
  return { threads: selected, listed: threads.length };
}

async function crawlPj(entry: PjIndexEntry): Promise<CrawlOutcome> {
  const dir = join(RAW_DIR, 'pj', entry.slug);
  await mkdir(dir, { recursive: true });
  const refreshPage = values.refresh ? await lastPageOnDisk(dir) : undefined;
  let downloaded = 0;
  try {
    const crawl = await crawlThread(client, entry.url, dir, { redownloadPage: refreshPage });
    downloaded = crawl.downloaded;
    const summary = await extractThreadDir(dir);
    for (const problem of summary.problems) console.warn(`  ⚠ ${entry.slug}: ${problem}`);
    const dump = threadDumpSchema.parse(
      JSON.parse(await readFile(summary.file, 'utf8')) as unknown,
    );
    const opening = dump.posts.find((post) => post.number === 1);
    const counts = { pages: summary.pages, posts: summary.posts, downloaded };
    if (!opening) {
      return {
        thread: entry.slug,
        group: 'fallido',
        reason: 'no se encuentra el post #1',
        ...counts,
      };
    }
    return {
      thread: entry.slug,
      ...classifyPjThread(dump.title || entry.title, opening),
      ...counts,
    };
  } catch (error) {
    // A lost session or a changed forum stops the whole run; anything else, only this thread.
    if (error instanceof CrawlStop) throw error;
    return {
      thread: entry.slug,
      group: 'fallido',
      reason: errorMessage(error),
      pages: 0,
      posts: 0,
      downloaded,
    };
  }
}

async function printSummary(listed: number): Promise<void> {
  const downloaded = outcomes.reduce((sum, outcome) => sum + outcome.downloaded, 0);
  const lines = [
    `✔ ${outcomes.length} hilos recorridos, ${downloaded} páginas descargadas. ` +
      `Log: ${relative(process.cwd(), PJ_CRAWL_LOG)}`,
    ...pjThreadSummary(outcomes, listed),
  ];
  console.log(lines.join('\n'));
  for (const line of lines) await log(line);
}

function refreshNote(): string {
  return values.refresh ? ' · --refresh' : '';
}

async function log(line: string): Promise<void> {
  await appendFile(PJ_CRAWL_LOG, `${line}\n`);
}
