import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { Document as YamlDocument, parseDocument } from 'yaml';
import { CONTENT_DIR, RAW_DIR, TRACKED_TOPICS, type TrackedTopic } from './config';
import { extractThreadDir } from './extract-thread';
import { renderCronicaDraft, type CronicaDraft } from './lib/cronica-draft';
import { crawlThread, lastPageOnDisk } from './lib/crawl';
import { localDay } from './lib/dates';
import {
  flowLists,
  FRONTMATTER_BLOCK,
  normalizeNewlines,
  personalDataIn,
  YAML_OPTIONS,
} from './lib/entry-file';
import { CrawlStop, ForumClient } from './lib/forum-client';
import { errorMessage } from './lib/pj-thread';
import { threadDumpSchema, threadSlug } from './lib/thread-page';

// npm run scrape:topics -- [--refresh]
// For every thread of TRACKED_TOPICS (scraper/config.ts): downloads it with the same crawl as
// scrape:thread (1500 ms between requests; pages on disk are not downloaded again, so a stopped
// run resumes) to scraper/raw/<type>/<thread-slug>/, and writes content/<type>/<thread-slug>.md
// with the same cleanup as the PJ importer. --refresh downloads again the last page of each
// thread, to catch new posts and edits.
// An entry that exists keeps its whole frontmatter: only `hilo` and `importado` change, and the
// body is generated again. With `importar: false` it is not touched. A topic's zona entry is
// created, minimal, when it does not exist. Prints a report without post texts.

const { values } = parseArgs({ options: { refresh: { type: 'boolean', default: false } } });

type Action = 'creada' | 'actualizada' | 'sin cambios' | 'protegida (importar: false)';

interface Outcome {
  topic: TrackedTopic;
  file?: string;
  action?: Action;
  pages?: number;
  downloaded?: number;
  posts?: number;
  draft?: CronicaDraft;
  zonaCreated?: string;
  error?: string;
}

const today = localDay(new Date());
const client = new ForumClient();
const outcomes: Outcome[] = [];
try {
  for (const topic of TRACKED_TOPICS) outcomes.push(await syncTopic(topic));
} catch (error) {
  if (!(error instanceof CrawlStop)) throw error;
  console.error(`✖ ${error.message}`);
  console.error('  Lo descargado se conserva; relanza el mismo comando para seguir.');
  process.exitCode = 1;
} finally {
  await client.close();
}
printReport();

async function syncTopic(topic: TrackedTopic): Promise<Outcome> {
  const url = topic.url.replace(/\/$/, '');
  const slug = threadSlug(url);
  if (!slug) return { topic, error: 'la URL no es la de un hilo del foro (…/foro/topic/<hilo>)' };

  const dir = join(RAW_DIR, topic.type, slug);
  await mkdir(dir, { recursive: true });
  try {
    const refreshPage = values.refresh ? await lastPageOnDisk(dir) : undefined;
    const crawl = await crawlThread(client, url, dir, { redownloadPage: refreshPage });
    const summary = await extractThreadDir(dir);
    for (const problem of summary.problems) console.warn(`  ⚠ ${slug}: ${problem}`);
    const dump = threadDumpSchema.parse(
      JSON.parse(await readFile(summary.file, 'utf8')) as unknown,
    );

    const draft = renderCronicaDraft({
      threadUrl: url,
      title: topic.title ?? dump.title,
      zona: topic.zona,
      posts: dump.posts,
      today,
    });
    const folder = join(CONTENT_DIR, topic.type);
    await mkdir(folder, { recursive: true });
    const file = join(folder, `${slug}.md`);
    const result = existsSync(file) ? await updateEntry(file, url, draft) : createEntry(draft);
    if (result.markdown !== undefined) {
      const leak = personalDataIn(result.markdown);
      if (leak) throw new Error(`no se escribe: el resultado contiene ${leak}`);
      await writeFile(file, result.markdown);
    }
    return {
      topic,
      file,
      action: result.action,
      pages: summary.pages,
      downloaded: crawl.downloaded,
      posts: dump.posts.length,
      draft,
      zonaCreated: topic.zona ? await ensureZona(topic.zona, topic.zonaTitle) : undefined,
    };
  } catch (error) {
    // A lost session or a changed forum stops the whole run; anything else, only this topic.
    if (error instanceof CrawlStop) throw error;
    return { topic, error: errorMessage(error) };
  }
}

function createEntry(draft: CronicaDraft): { action: Action; markdown: string } {
  return { action: 'creada', markdown: `---\n${draft.frontmatter}---\n\n${draft.body}` };
}

/**
 * Keeps the frontmatter as the DMs left it (comments included) and replaces the body. When
 * nothing changes the file is left alone, so `importado` keeps the day of the last real change.
 */
async function updateEntry(
  file: string,
  url: string,
  draft: CronicaDraft,
): Promise<{ action: Action; markdown?: string }> {
  const text = normalizeNewlines(await readFile(file, 'utf8'));
  const block = FRONTMATTER_BLOCK.exec(text);
  const doc = parseDocument(block?.[1] ?? '');
  if (doc.get('importar') === false) return { action: 'protegida (importar: false)' };

  const body = block ? text.slice(block[0].length).replace(/^\n+/, '') : text;
  if (body === draft.body && doc.get('hilo') === url) return { action: 'sin cambios' };
  doc.set('hilo', url);
  doc.set('importado', today);
  return {
    action: 'actualizada',
    markdown: `---\n${doc.toString(YAML_OPTIONS)}---\n\n${draft.body}`,
  };
}

/**
 * Creates content/zona/<slug>.md with only a title and the 'importado' tag, so the topic's
 * `zona` resolves. Nothing is written when an entry of any type already has that slug.
 * Returns the file created, if any.
 */
async function ensureZona(slug: string, title: string | undefined): Promise<string | undefined> {
  const folders = (await readdir(CONTENT_DIR, { withFileTypes: true })).filter(
    (dirent) => dirent.isDirectory() && !dirent.name.startsWith('_'),
  );
  if (folders.some(({ name }) => existsSync(join(CONTENT_DIR, name, `${slug}.md`)))) {
    return undefined;
  }
  const doc = new YamlDocument({
    type: 'zona',
    title: title ?? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' '),
    tags: ['importado'],
  });
  flowLists(doc);
  const folder = join(CONTENT_DIR, 'zona');
  await mkdir(folder, { recursive: true });
  const file = join(folder, `${slug}.md`);
  await writeFile(file, `---\n${doc.toString(YAML_OPTIONS)}---\n`);
  return file;
}

function printReport(): void {
  const shown = (file: string) => relative(process.cwd(), file);
  const lines = [`Hilos seguidos · ${today}${values.refresh ? ' · --refresh' : ''}`];
  for (const outcome of outcomes) {
    const { topic, draft } = outcome;
    if (outcome.error || !outcome.file || !outcome.action || !draft) {
      lines.push(`✖ ${topic.url}: ${outcome.error ?? 'sin resultado'}`);
      continue;
    }
    const { report } = draft;
    lines.push(
      `${outcome.action.padEnd(12)} ${shown(outcome.file)} ← ${topic.url}`,
      `    páginas=${outcome.pages} descargadas=${outcome.downloaded} posts=${outcome.posts} ` +
        `anexos=${report.entries} fechas=${report.first ?? '?'}…${report.last ?? '?'}`,
      ...(report.edited.length > 0
        ? [`    editados: ${report.edited.map((n) => `#${n}`).join(', ')}`]
        : []),
      ...(report.discordPastes.length > 0
        ? [`    pegados de Discord: ${report.discordPastes.map((n) => `#${n}`).join(', ')}`]
        : []),
      ...(report.images > 0 ? [`    imágenes convertidas en enlace: ${report.images}`] : []),
      ...(report.droppedLinks > 0 ? [`    enlaces privados quitados: ${report.droppedLinks}`] : []),
      ...report.oddPosts.map((odd) => `    ⚠ ${odd}`),
      ...(outcome.zonaCreated ? [`    zona creada: ${shown(outcome.zonaCreated)}`] : []),
    );
  }
  const failed = outcomes.filter((outcome) => outcome.error).length;
  lines.push(
    '',
    `${outcomes.length - failed} de ${TRACKED_TOPICS.length} hilos procesados` +
      (failed > 0 ? ` · ${failed} con error` : ''),
  );
  console.log(lines.join('\n'));
}
