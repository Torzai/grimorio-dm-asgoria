import { existsSync } from 'node:fs';
import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { PJ_CRAWL_LOG, PJ_INDEX_FILE, RAW_DIR } from './config';
import { extractThreadDir } from './extract-thread';
import { crawlThread } from './lib/crawl';
import { CrawlStop, ForumClient } from './lib/forum-client';
import { parseHtml } from './lib/html';
import { pjIndexSchema, type PjIndexEntry } from './lib/pj-index';
import { isAuthorizationForm } from './lib/pj-sheet';
import { extractPosts, pageFileName, pageNumberOf } from './lib/thread-page';

// npm run scrape:pjs -- [--limit N] [--only <slug>]… [--refresh]
// Downloads, one after another, the PJ threads listed in scraper/raw/pj/_index.json (made by
// scrape:discover-pjs) with the same crawl as scrape:thread: 1500 ms between requests, and pages
// already on disk are not downloaded again, so a stopped run resumes where it was.
// Page 1 comes first: a thread whose post #1 is not an authorization form (rules, templates,
// pinned notices) is skipped without downloading the rest.
// --refresh downloads again the last page of every thread (to catch new posts) and any missing.

const { values } = parseArgs({
  options: {
    limit: { type: 'string' },
    only: { type: 'string', multiple: true },
    refresh: { type: 'boolean', default: false },
  },
});

interface ThreadOutcome {
  entry: PjIndexEntry;
  status: 'importable' | 'saltado';
  pages: number;
  posts: number;
  downloaded: number;
}

const client = new ForumClient();
const outcomes: ThreadOutcome[] = [];
try {
  const threads = await selectThreads();
  await log(`--- ${new Date().toISOString()} · ${threads.length} hilos${refreshNote()}`);
  for (const [index, entry] of threads.entries()) {
    const outcome = await crawlPj(entry);
    outcomes.push(outcome);
    const line =
      `${index + 1}/${threads.length} ${entry.slug} páginas=${outcome.pages} ` +
      `posts=${outcome.posts} descargadas=${outcome.downloaded}` +
      (outcome.status === 'saltado' ? ' SALTADO (el post #1 no es una ficha)' : '');
    console.log(line);
    await log(line);
  }
  printSummary();
} catch (error) {
  if (!(error instanceof CrawlStop)) throw error;
  console.error(`✖ ${error.message}`);
  await log(`PARADO: ${error.message}`);
  console.error('  Lo descargado se conserva; relanza el mismo comando para seguir.');
  process.exitCode = 1;
} finally {
  await client.close();
}

async function selectThreads(): Promise<PjIndexEntry[]> {
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
  return selected;
}

async function crawlPj(entry: PjIndexEntry): Promise<ThreadOutcome> {
  const dir = join(RAW_DIR, 'pj', entry.slug);
  await mkdir(dir, { recursive: true });
  // Decided once: the second walk must not download again a page the first one just refreshed.
  const refreshPage = values.refresh ? await lastPageOnDisk(dir) : undefined;

  const first = await crawlThread(client, entry.url, dir, {
    maxPage: 1,
    redownloadPage: refreshPage,
  });
  const page1 = parseHtml(await readFile(join(dir, pageFileName(1)), 'utf8'));
  const opening = extractPosts(page1, 1).posts.find((post) => post.number === 1);
  if (!opening || !isAuthorizationForm(opening.html)) {
    return { entry, status: 'saltado', pages: 1, posts: 0, downloaded: first.downloaded };
  }

  const rest = first.partial
    ? await crawlThread(client, entry.url, dir, {
        redownloadPage: refreshPage === 1 ? undefined : refreshPage,
      })
    : first;
  const summary = await extractThreadDir(dir);
  for (const problem of summary.problems) console.warn(`  ⚠ ${entry.slug}: ${problem}`);
  return {
    entry,
    status: 'importable',
    pages: summary.pages,
    posts: summary.posts,
    downloaded: first.downloaded + (rest === first ? 0 : rest.downloaded),
  };
}

async function lastPageOnDisk(dir: string): Promise<number | undefined> {
  const numbers = (await readdir(dir)).flatMap((name) => pageNumberOf(name) ?? []);
  return numbers.length > 0 ? Math.max(...numbers) : undefined;
}

function printSummary(): void {
  const importable = outcomes.filter((outcome) => outcome.status === 'importable');
  const skipped = outcomes.filter((outcome) => outcome.status === 'saltado');
  const downloaded = outcomes.reduce((sum, outcome) => sum + outcome.downloaded, 0);
  console.log(
    `✔ ${importable.length} hilos con ficha, ${skipped.length} saltados, ` +
      `${downloaded} páginas descargadas. Log: ${relative(process.cwd(), PJ_CRAWL_LOG)}`,
  );
  for (const { entry } of skipped) {
    console.log(`  Saltado (sin ficha): ${entry.slug} [${entry.subforum}]`);
  }
}

function refreshNote(): string {
  return values.refresh ? ' · --refresh' : '';
}

async function log(line: string): Promise<void> {
  await appendFile(PJ_CRAWL_LOG, `${line}\n`);
}
