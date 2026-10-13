import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { parseDocument } from 'yaml';
import {
  DISCORD_TAG_PATTERN,
  EMAIL_PATTERN,
  PJ_CONTENT_DIR,
  PJ_CONVERT_REPORT,
  PJ_INDEX_FILE,
  RAW_DIR,
} from './config';
import { localDay } from './lib/dates';
import { pjIndexSchema, type PjIndexEntry } from './lib/pj-index';
import { draftMarkdown, renderPjDraft, YAML_OPTIONS, type PjDraft } from './lib/pj-draft';
import { isAuthorizationForm } from './lib/pj-sheet';
import { threadDumpSchema } from './lib/thread-page';

// npm run scrape:convert-all -- [--only <hilo>]…
// Turns every PJ thread downloaded by scrape:pjs (scraper/raw/pj/<hilo>/posts.json) into a real
// entry in content/pj/<personaje>.md. An entry that already exists for the same thread (found
// by its `hilo`) keeps its whole frontmatter: only `hilo` and `importado` change, and the body
// (form + history) is generated again. With `importar: false` in its frontmatter it is not
// touched at all. `estado` is only decided when the entry is created.
// Prints a report (no post texts) and saves it to scraper/raw/pj/_convert-report.txt.

const { values } = parseArgs({ options: { only: { type: 'string', multiple: true } } });

type Action = 'creada' | 'actualizada' | 'sin cambios' | 'protegida (importar: false)';

interface Converted {
  thread: string;
  file: string;
  action: Action;
  draft: PjDraft;
  posts: number;
  subforum?: string;
}

interface ExistingEntry {
  slug: string;
  file: string;
}

const PJ_RAW_DIR = join(RAW_DIR, 'pj');
const FRONTMATTER_BLOCK = /^---[ \t]*\n([\s\S]*?\n)?---[ \t]*\n/;

const today = localDay(new Date());
const index = await readIndex();
const { byThread, slugs } = await readExistingEntries();
const converted: Converted[] = [];
const skipped: { thread: string; reason: string }[] = [];

for (const thread of await downloadedThreads()) {
  const dump = threadDumpSchema.parse(
    JSON.parse(await readFile(join(PJ_RAW_DIR, thread, 'posts.json'), 'utf8')) as unknown,
  );
  const opening = dump.posts.find((post) => post.number === 1);
  if (!opening || !isAuthorizationForm(opening.html)) {
    skipped.push({ thread, reason: 'el post #1 no es una ficha de autorización' });
    continue;
  }

  const listed = index.get(thread);
  const threadUrl = listed?.url ?? dump.url.replace(/\/$/, '');
  const draft = renderPjDraft({
    threadUrl,
    threadTitle: dump.title || listed?.title,
    subforum: listed?.subforum,
    posts: dump.posts,
    today,
  });

  const existing = byThread.get(threadUrl);
  const slug = existing?.slug ?? freeSlug(draft);
  const file = existing?.file ?? join(PJ_CONTENT_DIR, `${slug}.md`);
  slugs.add(slug);

  const result = existing ? await updateEntry(file, threadUrl, draft) : createEntry(draft);
  if (result.markdown === undefined) {
    converted.push({
      thread,
      file,
      action: result.action,
      draft,
      posts: dump.posts.length,
      subforum: listed?.subforum,
    });
    continue;
  }
  const leak = personalDataIn(result.markdown);
  if (leak) {
    skipped.push({ thread, reason: `no se escribe: el resultado contiene ${leak}` });
    continue;
  }
  await writeFile(file, result.markdown);
  converted.push({
    thread,
    file,
    action: result.action,
    draft,
    posts: dump.posts.length,
    subforum: listed?.subforum,
  });
}

const report = buildReport();
await writeFile(PJ_CONVERT_REPORT, `${report.join('\n')}\n`);
console.log(report.join('\n'));
console.log(`\nInforme guardado en ${relative(process.cwd(), PJ_CONVERT_REPORT)}`);

// ---------------------------------------------------------------------------------------------

async function readIndex(): Promise<Map<string, PjIndexEntry>> {
  if (!existsSync(PJ_INDEX_FILE)) return new Map();
  const { threads } = pjIndexSchema.parse(
    JSON.parse(await readFile(PJ_INDEX_FILE, 'utf8')) as unknown,
  );
  return new Map(threads.map((entry) => [entry.slug, entry]));
}

/** Thread folders with a posts.json, in alphabetical order; --only narrows them. */
async function downloadedThreads(): Promise<string[]> {
  const names = (await readdir(PJ_RAW_DIR, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('_'))
    .map((dirent) => dirent.name)
    .filter((name) => existsSync(join(PJ_RAW_DIR, name, 'posts.json')))
    .sort();
  if (!values.only) return names;
  const missing = values.only.filter((name) => !names.includes(name));
  for (const name of missing) skipped.push({ thread: name, reason: 'no está descargado' });
  return names.filter((name) => values.only?.includes(name));
}

/** The PJ entries that exist, by their thread, and every slug taken. */
async function readExistingEntries(): Promise<{
  byThread: Map<string, ExistingEntry>;
  slugs: Set<string>;
}> {
  const byThread = new Map<string, ExistingEntry>();
  const slugs = new Set<string>();
  for (const name of await readdir(PJ_CONTENT_DIR)) {
    if (!name.endsWith('.md')) continue;
    const slug = name.slice(0, -3);
    const file = join(PJ_CONTENT_DIR, name);
    slugs.add(slug);
    const block = FRONTMATTER_BLOCK.exec(normalizeNewlines(await readFile(file, 'utf8')));
    const hilo: unknown = block ? parseDocument(block[1] ?? '').get('hilo') : undefined;
    if (typeof hilo === 'string') byThread.set(hilo.replace(/\/$/, ''), { slug, file });
  }
  return { byThread, slugs };
}

/** The PJ's name; with the account when another PJ has it; then numbered. */
function freeSlug(draft: PjDraft): string {
  if (!slugs.has(draft.slug)) return draft.slug;
  if (!slugs.has(draft.fallbackSlug)) return draft.fallbackSlug;
  let n = 2;
  while (slugs.has(`${draft.fallbackSlug}-${n}`)) n++;
  return `${draft.fallbackSlug}-${n}`;
}

function createEntry(draft: PjDraft): { action: Action; markdown?: string } {
  return { action: 'creada', markdown: draftMarkdown(draft) };
}

/**
 * Keeps the frontmatter as the DMs left it (comments included) and replaces the body. When
 * nothing changes the file is left alone, so `importado` keeps the day of the last real change.
 */
async function updateEntry(
  file: string,
  threadUrl: string,
  draft: PjDraft,
): Promise<{ action: Action; markdown?: string }> {
  const text = normalizeNewlines(await readFile(file, 'utf8'));
  const block = FRONTMATTER_BLOCK.exec(text);
  const doc = parseDocument(block?.[1] ?? '');
  if (doc.get('importar') === false) return { action: 'protegida (importar: false)' };

  const body = block ? text.slice(block[0].length).replace(/^\n+/, '') : text;
  if (body === draft.body && doc.get('hilo') === threadUrl) return { action: 'sin cambios' };

  doc.set('hilo', threadUrl);
  doc.set('importado', today);
  return {
    action: 'actualizada',
    markdown: `---\n${doc.toString(YAML_OPTIONS)}---\n\n${draft.body}`,
  };
}

/** Last line of defence: the cleanup already redacted these from every text of the entry. */
function personalDataIn(markdown: string): string | undefined {
  if (new RegExp(EMAIL_PATTERN.source).test(markdown)) return 'algo con forma de email';
  if (new RegExp(DISCORD_TAG_PATTERN.source).test(markdown)) return 'una etiqueta nombre#1234';
  return undefined;
}

function normalizeNewlines(text: string): string {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return withoutBom.replace(/\r\n?/g, '\n');
}

function buildReport(): string[] {
  const lines = [`Conversión de PJ · ${today}`, ''];
  const shown = (file: string) => relative(process.cwd(), file);

  for (const { thread, file, action, draft, posts } of converted) {
    const { report } = draft;
    lines.push(
      `${action.padEnd(12)} ${shown(file)} ← ${thread}`,
      `  posts=${posts} entradas=${report.entries} último post=${report.lastPost ?? '?'}` +
        ` estado(nueva)=${report.estado} sexo=${report.sexoFrom} cuenta=${report.cuentaFrom}`,
    );
    if (report.missingFields.length > 0) {
      lines.push(`  campos sin valor: ${report.missingFields.join(', ')}`);
    }
    for (const odd of report.oddPosts) lines.push(`  ⚠ ${odd}`);
  }

  const count = (action: Action) => converted.filter((item) => item.action === action).length;
  lines.push(
    '',
    `Creadas: ${count('creada')} · actualizadas: ${count('actualizada')} · ` +
      `sin cambios: ${count('sin cambios')} · protegidas: ${count('protegida (importar: false)')} · ` +
      `saltadas: ${skipped.length}`,
  );

  const list = (title: string, items: string[]) => {
    if (items.length > 0)
      lines.push('', `${title} (${items.length}):`, ...items.map((i) => `  ${i}`));
  };
  const created = converted.filter((item) => item.action === 'creada');
  list(
    'Cuenta desconocida (ni en la ficha ni en el título)',
    converted.filter((c) => c.draft.report.cuentaFrom === 'desconocida').map((c) => c.thread),
  );
  list(
    'Cuenta tomada del título del hilo',
    converted.filter((c) => c.draft.report.cuentaFrom === 'titulo').map((c) => c.thread),
  );
  list(
    'Sexo tomado del subforo',
    created
      .filter((c) => c.draft.report.sexoFrom === 'subforo')
      .map((c) => `${c.thread} [${c.subforum ?? '?'}]`),
  );
  list(
    'Sexo sin normalizar (se deja como está escrito)',
    created.filter((c) => c.draft.report.sexoFrom === 'ficha-sin-normalizar').map((c) => c.thread),
  );
  list(
    'Sin sexo',
    created.filter((c) => c.draft.report.sexoFrom === 'desconocido').map((c) => c.thread),
  );

  const labels = new Map<string, number>();
  for (const { draft } of converted) {
    for (const label of draft.report.unknownLabels) labels.set(label, (labels.get(label) ?? 0) + 1);
  }
  list(
    'Etiquetas no reconocidas, en "Otros datos" (etiqueta: fichas)',
    [...labels].sort((a, b) => b[1] - a[1]).map(([label, n]) => `${label}: ${n}`),
  );
  list(
    'Saltados',
    skipped.map(({ thread, reason }) => `${thread}: ${reason}`),
  );
  return lines;
}
