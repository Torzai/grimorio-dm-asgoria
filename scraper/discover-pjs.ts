import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import {
  LISTING_SELECTORS,
  MAX_LISTING_PAGES,
  PJ_INDEX_FILE,
  PJ_SUBFORUMS,
  REPLIES_PATTERN,
} from './config';
import { parseForumDate } from './lib/dates';
import { CrawlStop, ForumClient } from './lib/forum-client';
import { parseHtml, textOf } from './lib/html';
import type { PjIndexEntry } from './lib/pj-index';
import { readPagination, threadSlug } from './lib/thread-page';

// npm run scrape:discover-pjs
// Walks the listing pages of both PJ subforums and writes ONE scraper/raw/pj/_index.json with
// every thread (deduplicated by URL). Always reads the forum: the listing is small and changes.

async function discover(client: ForumClient): Promise<PjIndexEntry[]> {
  const byUrl = new Map<string, PjIndexEntry>();
  for (const subforum of PJ_SUBFORUMS) {
    let url: string | undefined = subforum.url;
    const visited = new Set<string>();
    let found = 0;
    const skipped = { noLink: 0, badUrl: [] as string[], duplicate: 0 };
    for (let page = 1; url; page++) {
      if (page > MAX_LISTING_PAGES) {
        console.warn(`⚠ ${subforum.id}: tope de ${MAX_LISTING_PAGES} páginas; se para aquí.`);
        break;
      }
      if (visited.has(url)) throw new CrawlStop(`${subforum.id}: la página ${page} repite URL`);
      visited.add(url);

      const response = await client.get(url);
      const doc = parseHtml(response.html);
      const rows = [...doc.querySelectorAll(LISTING_SELECTORS.topic)];
      if (rows.length === 0) {
        throw new CrawlStop(
          `${subforum.id}, página ${page}: no hay hilos (HTTP ${response.status}). ¿Ha cambiado ` +
            'el HTML del foro? Revisa LISTING_SELECTORS en scraper/config.ts',
        );
      }
      for (const row of rows) {
        const link = row.querySelector(LISTING_SELECTORS.topicLink);
        const href = link?.getAttribute('href');
        if (!link || !href) {
          skipped.noLink++;
          continue;
        }
        const threadUrl = new URL(href, url).href.replace(/[?#].*$/, '').replace(/\/$/, '');
        const slug = threadSlug(threadUrl);
        if (!slug) {
          skipped.badUrl.push(threadUrl);
          continue;
        }
        if (byUrl.has(threadUrl)) {
          skipped.duplicate++;
          continue;
        }
        const replies = REPLIES_PATTERN.exec(textOf(row.querySelector(LISTING_SELECTORS.replies)));
        const lastPost = textOf(row.querySelector(LISTING_SELECTORS.lastPostDate));
        const lastPostAt = parseForumDate(lastPost);
        byUrl.set(threadUrl, {
          url: threadUrl,
          slug,
          title: textOf(link),
          subforum: subforum.id,
          ...(replies ? { replies: Number(replies[1].replace(/[.,]/g, '')) } : {}),
          ...(lastPostAt ? { lastPostAt } : lastPost ? { lastPostAgo: lastPost } : {}),
        });
        found++;
      }
      const { total, nextUrl } = readPagination(doc, url);
      console.log(`· ${subforum.id} página ${page}/${total ?? '?'}: ${rows.length} filas`);
      url = nextUrl;
    }
    console.log(`  ${subforum.id}: ${found} hilos`);
    if (skipped.noLink) console.warn(`  ⚠ ${skipped.noLink} filas sin enlace al hilo`);
    if (skipped.duplicate) console.log(`  ${skipped.duplicate} filas repetidas (misma URL)`);
    for (const bad of skipped.badUrl) console.warn(`  ⚠ URL de hilo no reconocida: ${bad}`);
  }
  return [...byUrl.values()];
}

const client = new ForumClient();
try {
  const threads = await discover(client);
  await mkdir(dirname(PJ_INDEX_FILE), { recursive: true });
  const index = { generatedAt: new Date().toISOString(), threads };
  await writeFile(PJ_INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`);
  for (const subforum of PJ_SUBFORUMS) {
    const count = threads.filter((t) => t.subforum === subforum.id).length;
    console.log(`${subforum.id}: ${count}`);
  }
  console.log(`✔ ${threads.length} hilos → ${relative(process.cwd(), PJ_INDEX_FILE)}`);
} catch (error) {
  if (!(error instanceof CrawlStop)) throw error;
  console.error(`✖ ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.close();
}
