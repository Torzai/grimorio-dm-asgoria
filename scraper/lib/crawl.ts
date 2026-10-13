import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { MAX_PAGES } from '../config';
import { CrawlStop, type ForumClient } from './forum-client';
import { parseHtml } from './html';
import { countPosts, pageFileName, readPagination } from './thread-page';

export interface CrawlOptions {
  /** Download every page again. */
  force?: boolean;
  /**
   * Download this page again even if it is on disk: the last page of a thread, which may have
   * new posts since. Whatever follows it is missing anyway, so it is downloaded too.
   */
  redownloadPage?: number;
  /** Stop after this page: 1 is enough to read the authorization form. */
  maxPage?: number;
  /** Prints one line per page. */
  verbose?: boolean;
}

export interface CrawlResult {
  /** Pages of the thread now on disk, as far as the walk went. */
  pages: number;
  /** Pages requested from the forum in this run. */
  downloaded: number;
  /** True when the walk stopped at `maxPage` while the thread has more pages. */
  partial: boolean;
}

/**
 * Downloads the pages of one thread to `dir`/page-NN.html, in order and one request at a time.
 * Pages already on disk are read instead of downloaded, so an interrupted crawl resumes where
 * it stopped; their "Siguiente" link is enough to keep walking.
 */
export async function crawlThread(
  client: ForumClient,
  threadUrl: string,
  dir: string,
  options: CrawlOptions = {},
): Promise<CrawlResult> {
  const { force = false, redownloadPage, maxPage = MAX_PAGES, verbose = false } = options;
  const visited = new Set<string>();
  let downloaded = 0;
  let pages = 0;

  let url: string | undefined = threadUrl;
  for (let page = 1; url; page++) {
    if (page > maxPage) {
      if (maxPage === MAX_PAGES) {
        console.warn(`⚠ Tope de seguridad de ${MAX_PAGES} páginas alcanzado; se para aquí.`);
      }
      return { pages, downloaded, partial: true };
    }
    if (visited.has(url)) throw new CrawlStop(`la página ${page} repite una URL (${url})`);
    visited.add(url);

    const file = join(dir, pageFileName(page));
    const cached = !force && page !== redownloadPage && existsSync(file);
    let html: string;
    if (cached) {
      html = await readFile(file, 'utf8');
    } else {
      const response = await client.get(url);
      html = response.html;
      downloaded++;
      if (countPosts(parseHtml(html)) === 0) {
        throw new CrawlStop(
          `la página ${page} no tiene posts (HTTP ${response.status}): ¿ha cambiado el HTML ` +
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
    pages = page;
    if (verbose) {
      const status = cached ? 'ya estaba, se salta' : `descargada (${countPosts(doc)} posts)`;
      console.log(`· Página ${page}/${total ?? '?'}: ${status} → ${relative(process.cwd(), file)}`);
    }
    url = nextUrl;
  }
  return { pages, downloaded, partial: false };
}
