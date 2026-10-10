import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import type { APIRequestContext, Browser } from '@playwright/test';
import { openForumBrowser } from './browser';
import { AUTH_FILE, MAX_PAGES, RAW_DIR, REQUEST_DELAY_MS, THREAD_KINDS } from './config';
import { extractThreadDir, printExtractSummary } from './extract-thread';
import { parseHtml } from './lib/html';
import { isLoggedOutPage } from './lib/session';
import { countPosts, pageFileName, readPagination, threadSlug } from './lib/thread-page';

// npm run scrape:thread -- --url <url del hilo> --kind pj [--force]
// Downloads every page of one thread, in order and one request at a time, to
// scraper/raw/<kind>/<thread-slug>/page-NN.html, then extracts posts.json. Pages already on disk
// are skipped (--force downloads them again), so an interrupted crawl resumes where it stopped.

/** Expected stop: printed without a stack trace. */
class CrawlStop extends Error {}

const SESSION_EXPIRED = 'Sesión caducada: ejecuta npm run scrape:login';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    kind: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
});

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
  await crawl(threadUrl, dir, values.force);
  printExtractSummary(await extractThreadDir(dir));
} catch (error) {
  if (!(error instanceof CrawlStop)) throw error;
  console.error(`✖ ${error.message}`);
  process.exitCode = 1;
}

async function crawl(threadUrl: string, dir: string, force: boolean): Promise<void> {
  let browser: Browser | undefined;
  let request: APIRequestContext | undefined;
  let lastRequestAt = 0;
  const visited = new Set<string>();

  try {
    let url: string | undefined = threadUrl;
    for (let page = 1; url; page++) {
      if (page > MAX_PAGES) {
        console.warn(`⚠ Tope de seguridad de ${MAX_PAGES} páginas alcanzado; se para aquí.`);
        return;
      }
      if (visited.has(url)) throw new CrawlStop(`la página ${page} repite una URL (${url})`);
      visited.add(url);

      const file = join(dir, pageFileName(page));
      const cached = !force && existsSync(file);
      let html: string;
      if (cached) {
        html = await readFile(file, 'utf8');
      } else {
        if (!request) {
          if (!existsSync(AUTH_FILE)) {
            throw new CrawlStop('No hay sesión guardada: ejecuta npm run scrape:login');
          }
          // The context's request API sends the session cookies and the importer's user agent:
          // one request per page, without images, styles or scripts.
          const opened = await openForumBrowser({ headless: true, storageState: AUTH_FILE });
          browser = opened.browser;
          request = opened.context.request;
        }
        await sleep(Math.max(0, lastRequestAt + REQUEST_DELAY_MS - Date.now()));
        const response = await request.get(url);
        lastRequestAt = Date.now();
        html = await response.text();
        if (countPosts(parseHtml(html)) === 0) {
          if (isLoggedOutPage(response.url(), html)) throw new CrawlStop(SESSION_EXPIRED);
          throw new CrawlStop(
            `la página ${page} no tiene posts (HTTP ${response.status()}): ¿ha cambiado el HTML ` +
              'del foro? Revisa SELECTORS en scraper/config.ts',
          );
        }
        await writeFile(file, html);
      }

      const doc = parseHtml(html);
      const { current, total, nextUrl } = readPagination(doc, url);
      if (current !== undefined && current !== page) {
        throw new CrawlStop(`se esperaba la página ${page} y el foro muestra la ${current}`);
      }
      const status = cached ? 'ya estaba, se salta' : `descargada (${countPosts(doc)} posts)`;
      console.log(`· Página ${page}/${total ?? '?'}: ${status} → ${relative(process.cwd(), file)}`);
      url = nextUrl;
    }
  } finally {
    await browser?.close();
  }
}
