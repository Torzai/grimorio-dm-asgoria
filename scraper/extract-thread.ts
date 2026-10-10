import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseHtml } from './lib/html';
import {
  extractPosts,
  mergePosts,
  pageNumberOf,
  readThreadInfo,
  type ForumPost,
  type ThreadDump,
} from './lib/thread-page';

// npm run scrape:extract -- --dir <carpeta>
// Reads the saved page-NN.html files of one thread (no network) and writes posts.json next to
// them. crawl-thread.ts runs it after every crawl.

export interface ExtractSummary {
  file: string;
  pages: number;
  posts: number;
  duplicates: number[];
  problems: string[];
}

export async function extractThreadDir(dir: string): Promise<ExtractSummary> {
  const pageFiles = (await readdir(dir))
    .flatMap((name) => {
      const page = pageNumberOf(name);
      return page === undefined ? [] : [{ name, page }];
    })
    .sort((a, b) => a.page - b.page);
  if (pageFiles.length === 0) throw new Error(`no hay ficheros page-NN.html en ${dir}`);

  let url = '';
  let title = '';
  const perPage: ForumPost[][] = [];
  const problems: string[] = [];
  for (const { name, page } of pageFiles) {
    const doc = parseHtml(await readFile(join(dir, name), 'utf8'));
    if (page === 1) ({ url = '', title } = readThreadInfo(doc));
    const extraction = extractPosts(doc, page);
    perPage.push(extraction.posts);
    problems.push(...extraction.problems);
  }
  if (!url) problems.push('no se ha encontrado la URL del hilo en page-01.html');

  const { posts, duplicates } = mergePosts(perPage);
  const dump: ThreadDump = { url, title, pages: pageFiles.length, posts };
  const file = join(dir, 'posts.json');
  await writeFile(file, `${JSON.stringify(dump, null, 2)}\n`);
  return { file, pages: pageFiles.length, posts: posts.length, duplicates, problems };
}

export function printExtractSummary(summary: ExtractSummary): void {
  const file = relative(process.cwd(), summary.file);
  console.log(`✔ ${summary.posts} posts de ${summary.pages} páginas → ${file}`);
  if (summary.duplicates.length > 0) {
    console.log(`  Duplicados descartados: ${summary.duplicates.map((n) => `#${n}`).join(', ')}`);
  }
  for (const problem of summary.problems) console.warn(`  ⚠ ${problem}`);
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { dir: { type: 'string' } } });
  if (values.dir) {
    printExtractSummary(await extractThreadDir(resolve(values.dir)));
  } else {
    console.error('Uso: npm run scrape:extract -- --dir <carpeta con los page-NN.html>');
    process.exitCode = 1;
  }
}
