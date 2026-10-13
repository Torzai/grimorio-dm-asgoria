import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { Document as YamlDocument, parseDocument } from 'yaml';
import { parseSituacion } from '../src/content/cronica';
import {
  CONTENT_DIR,
  GENERAL_REGION,
  RAW_DIR,
  TRACKED_TOPICS,
  type TopicSplit,
  type TrackedTopic,
} from './config';
import { extractThreadDir } from './extract-thread';
import { renderCronicaDraft, wholeThread, type CronicaDraft } from './lib/cronica-draft';
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
import { splitByRegion, type RegionPart } from './lib/region-split';
import { threadDumpSchema, threadSlug, type ForumPost, type ThreadDump } from './lib/thread-page';

// npm run scrape:topics -- [--refresh]
// For every thread of TRACKED_TOPICS (scraper/config.ts): downloads it with the same crawl as
// scrape:thread (1500 ms between requests; pages on disk are not downloaded again, so a stopped
// run resumes) to scraper/raw/<type>/<thread-slug>/, and writes content/<type>/<slug>.md with
// the same cleanup as the PJ importer. --refresh downloads again the last page of each thread,
// to catch new posts and edits.
// A topic with `split` becomes one entry per region, content/<type>/situacion-<region>.md, plus
// a general one for the posts without a region when there are any (content/README.md).
// An entry that exists keeps its whole frontmatter: only `hilo` and `importado` change, and the
// body is generated again. With `importar: false` it is not touched. A topic's zona entry is
// created, minimal, when it does not exist. Prints a report without post texts.

const { values } = parseArgs({ options: { refresh: { type: 'boolean', default: false } } });

type Action = 'creada' | 'actualizada' | 'sin cambios' | 'protegida (importar: false)';

/** One entry a topic becomes. */
interface EntryPlan {
  /** content/<type>/<slug>.md */
  slug: string;
  /** The thread, or the anchor of the entry's first post in it. */
  hilo: string;
  draft: CronicaDraft;
  zona?: { slug: string; title?: string };
}

interface EntryOutcome {
  file: string;
  action: Action;
  draft: CronicaDraft;
  zonaCreated?: string;
}

interface Outcome {
  topic: TrackedTopic;
  entries: EntryOutcome[];
  pages?: number;
  downloaded?: number;
  posts?: number;
  /** The region of every post, for a topic with `split`. */
  parts?: RegionPart[];
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
  if (!slug) {
    return {
      topic,
      entries: [],
      error: 'la URL no es la de un hilo del foro (…/foro/topic/<hilo>)',
    };
  }

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

    const { plans, parts } = topic.split
      ? planRegions(topic, topic.split, url, dump)
      : { plans: [planWhole(topic, url, slug, dump)], parts: undefined };
    if (!topic.split && topic.assign) {
      console.warn(`  ⚠ ${slug}: 'assign' solo se usa con 'split'; se ignora`);
    }

    const entries: EntryOutcome[] = [];
    for (const plan of plans) entries.push(await writePlan(topic, plan));
    return {
      topic,
      entries,
      pages: summary.pages,
      downloaded: crawl.downloaded,
      posts: dump.posts.length,
      ...(parts ? { parts } : {}),
    };
  } catch (error) {
    // A lost session or a changed forum stops the whole run; anything else, only this topic.
    if (error instanceof CrawlStop) throw error;
    return { topic, entries: [], error: errorMessage(error) };
  }
}

/** A thread on one subject: one entry, post #1 its situation. */
function planWhole(topic: TrackedTopic, url: string, slug: string, dump: ThreadDump): EntryPlan {
  return {
    slug: topic.slug ?? slug,
    hilo: url,
    draft: renderCronicaDraft({
      threadUrl: url,
      title: topic.title ?? dump.title,
      zona: topic.zona,
      parts: wholeThread(dump.posts),
      today,
    }),
    ...(topic.zona ? { zona: { slug: topic.zona, title: topic.zonaTitle } } : {}),
  };
}

/**
 * A thread on several regions: one entry per region with posts, its first part the situation,
 * and a general one, named as the thread, only when some post has no region.
 */
function planRegions(
  topic: TrackedTopic,
  split: TopicSplit,
  url: string,
  dump: ThreadDump,
): { plans: EntryPlan[]; parts: RegionPart[] } {
  const parts = splitByRegion(dump.posts, split, topic.assign);
  const plans: EntryPlan[] = [];
  const plan = (slug: string, title: string, of: RegionPart[], zona?: EntryPlan['zona']) => {
    const hilo = anchored(url, of[0].post);
    plans.push({
      slug,
      hilo,
      draft: renderCronicaDraft({ threadUrl: hilo, title, zona: zona?.slug, parts: of, today }),
      ...(zona ? { zona } : {}),
    });
  };

  for (const region of split.regions) {
    const of = parts.filter((part) => part.region === region.slug);
    if (of.length > 0) {
      plan(`situacion-${region.slug}`, `Situación de ${region.title}`, of, {
        slug: region.slug,
        title: region.title,
      });
    }
  }
  const general = parts.filter((part) => part.region === GENERAL_REGION);
  const slug = topic.slug ?? threadSlug(url);
  if (general.length > 0 && slug) plan(slug, topic.title ?? dump.title, general);
  return { plans, parts };
}

/**
 * The thread's URL pointing at a post. Only for posts on its first page: the forum's anchors
 * work on the page that holds the post.
 */
function anchored(url: string, post: ForumPost): string {
  return post.anchor && post.page === 1 ? `${url}#${post.anchor}` : url;
}

async function writePlan(topic: TrackedTopic, plan: EntryPlan): Promise<EntryOutcome> {
  const folder = join(CONTENT_DIR, topic.type);
  await mkdir(folder, { recursive: true });
  const file = join(folder, `${plan.slug}.md`);
  const result = existsSync(file)
    ? await updateEntry(file, plan.hilo, plan.draft)
    : createEntry(plan.draft);
  if (result.markdown !== undefined) {
    const leak = personalDataIn(result.markdown);
    if (leak) throw new Error(`no se escribe ${plan.slug}: el resultado contiene ${leak}`);
    await writeFile(file, result.markdown);
  }
  return {
    file,
    action: result.action,
    draft: plan.draft,
    ...(plan.zona ? { zonaCreated: await ensureZona(plan.zona.slug, plan.zona.title) } : {}),
  };
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
  hilo: string,
  draft: CronicaDraft,
): Promise<{ action: Action; markdown?: string }> {
  const text = normalizeNewlines(await readFile(file, 'utf8'));
  const block = FRONTMATTER_BLOCK.exec(text);
  const doc = parseDocument(block?.[1] ?? '');
  if (doc.get('importar') === false) return { action: 'protegida (importar: false)' };

  const body = block ? text.slice(block[0].length).replace(/^\n+/, '') : text;
  if (body === draft.body && doc.get('hilo') === hilo) return { action: 'sin cambios' };
  doc.set('hilo', hilo);
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

/** '#3 · Li Zakien · 2023-06-10 → mraganur (auto, alta)', one line per post. */
function assignmentLines(parts: readonly RegionPart[]): string[] {
  const numbers = [...new Set(parts.map((part) => part.post.number))];
  return numbers.map((number) => {
    const ofPost = parts.filter((part) => part.post.number === number);
    const [{ post, origin, deduced }] = ofPost;
    const regions = ofPost.map((part) => part.region).join(', ');
    const how =
      origin === 'manual'
        ? `manual; deducida ${deduced.region}, ${deduced.confidence}`
        : origin === 'encabezado'
          ? 'encabezados'
          : `auto, ${deduced.confidence}`;
    const day = post.postedAt?.slice(0, 10) ?? 'sin fecha';
    return `    #${number} · ${post.authorName || 'autor desconocido'} · ${day} → ${regions} (${how})`;
  });
}

function printReport(): void {
  const shown = (file: string) => relative(process.cwd(), file);
  const lines = [`Hilos seguidos · ${today}${values.refresh ? ' · --refresh' : ''}`];
  for (const outcome of outcomes) {
    const { topic } = outcome;
    if (outcome.error || outcome.entries.length === 0) {
      lines.push(`✖ ${topic.url}: ${outcome.error ?? 'sin resultado'}`);
      continue;
    }
    lines.push(
      `${topic.url}`,
      `    páginas=${outcome.pages} descargadas=${outcome.downloaded} posts=${outcome.posts}`,
      ...(outcome.parts ? ['  Regiones:', ...assignmentLines(outcome.parts)] : []),
    );
    for (const { file, action, draft, zonaCreated } of outcome.entries) {
      const { report } = draft;
      const { blocks } = parseSituacion(draft.body);
      lines.push(
        `  ${action.padEnd(12)} ${shown(file)}`,
        `    índice=${Math.max(blocks.length, 1)} anexos=${report.entries} ` +
          `fechas=${report.first ?? '?'}…${report.last ?? '?'}`,
        ...(report.edited.length > 0
          ? [`    editados: ${report.edited.map((n) => `#${n}`).join(', ')}`]
          : []),
        ...(report.discordPastes.length > 0
          ? [`    pegados de Discord: ${report.discordPastes.map((n) => `#${n}`).join(', ')}`]
          : []),
        ...(report.images > 0 ? [`    imágenes convertidas en enlace: ${report.images}`] : []),
        ...(report.droppedLinks > 0
          ? [`    enlaces privados quitados: ${report.droppedLinks}`]
          : []),
        ...report.oddPosts.map((odd) => `    ⚠ ${odd}`),
        ...(zonaCreated ? [`    zona creada: ${shown(zonaCreated)}`] : []),
      );
    }
  }
  const failed = outcomes.filter((outcome) => outcome.error).length;
  lines.push(
    '',
    `${outcomes.length - failed} de ${TRACKED_TOPICS.length} hilos procesados` +
      (failed > 0 ? ` · ${failed} con error` : ''),
  );
  console.log(lines.join('\n'));
}
