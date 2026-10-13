import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { isScalar, isSeq, parseDocument, type Document } from 'yaml';
import { normalize } from '../src/content/normalize';
import { ALIGNMENT_LABELS, readAlignment } from '../src/content/pj';
import { PJ_CONTENT_DIR, PJ_CONVERT_REPORT, PJ_INDEX_FILE, RAW_DIR } from './config';
import { localDay } from './lib/dates';
import {
  FRONTMATTER_BLOCK,
  normalizeNewlines,
  personalDataIn,
  YAML_OPTIONS,
} from './lib/entry-file';
import { pjIndexSchema, type PjIndexEntry } from './lib/pj-index';
import { draftMarkdown, pjFirstName, pjTitle, renderPjDraft, type PjDraft } from './lib/pj-draft';
import {
  classifyPjThread,
  errorMessage,
  pjThreadSummary,
  type PjThreadOutcome,
} from './lib/pj-thread';
import { threadDumpSchema, type ThreadDump } from './lib/thread-page';

// npm run scrape:convert-all -- [--only <hilo>]…
// Turns every PJ thread of _index.json, downloaded by scrape:pjs (scraper/raw/pj/<hilo>/
// posts.json), into a real entry in content/pj/<personaje>.md. Nothing is left out in silence:
// each thread is imported with its form, imported as 'ficha-libre' (post #1 has no form: its
// whole text goes under "Trasfondo"), excluded with its reason (clearly no PJ) or failed with
// its error, and the report ends with the totals of the four groups. An entry that already exists for the same thread (found
// by its `hilo`) keeps its whole frontmatter: only `hilo` and `importado` change, and the body
// (form + history) is generated again. Two fixes reach the frontmatter of an existing entry:
// an alignment that needed fixing (comment, typo or empty template) is written again, and in
// entries tagged `importado` the first name goes from `aliases` when another PJ shares it. With
// `importar: false` in its frontmatter it is not touched at all. `estado` is only decided when
// the entry is created. The first name is only added as alias when no other PJ shares it.
// Prints a report (no post texts) and saves it to scraper/raw/pj/_convert-report.txt.

const { values } = parseArgs({ options: { only: { type: 'string', multiple: true } } });

type Action =
  'creada' | 'actualizada' | 'frontmatter' | 'sin cambios' | 'protegida (importar: false)';

interface Converted {
  thread: string;
  group: 'formulario' | 'ficha-libre';
  file: string;
  action: Action;
  draft: PjDraft;
  posts: number;
  subforum?: string;
}

interface ExistingEntry {
  slug: string;
  file: string;
  title?: string;
  hilo?: string;
}

interface Downloaded {
  thread: string;
  dump: ThreadDump;
  listed?: PjIndexEntry;
  threadUrl: string;
  title?: string;
}

/** What to do with an entry: the Markdown to write, if any, and the frontmatter fixes. */
interface EntryResult {
  action: Action;
  markdown?: string;
  fixes?: FrontmatterFixes;
}

/** What updateEntry changed in the frontmatter of an existing entry. */
interface FrontmatterFixes {
  aliasRemoved?: string;
  alineamiento?: { from: string; to?: string };
}

const PJ_RAW_DIR = join(RAW_DIR, 'pj');

const today = localDay(new Date());
const index = await readIndex();
const existingEntries = await readExistingEntries();
const { byThread, slugs } = existingEntries;
const converted: Converted[] = [];
/** Threads that are not imported: excluded (no PJ) or failed. */
const notImported: PjThreadOutcome[] = [];
const fixes: { file: string; fixes: FrontmatterFixes }[] = [];
const fail = (thread: string, reason: string) => {
  notImported.push({ thread, group: 'fallido', reason });
};

// First the name of every PJ, so a first name only becomes an alias when it is unique.
const downloaded: Downloaded[] = [];
for (const thread of await threadsToConvert()) {
  const postsFile = join(PJ_RAW_DIR, thread, 'posts.json');
  if (!existsSync(postsFile)) {
    fail(thread, 'no está descargado (falta posts.json): npm run scrape:pjs');
    continue;
  }
  let dump: ThreadDump;
  try {
    dump = threadDumpSchema.parse(JSON.parse(await readFile(postsFile, 'utf8')) as unknown);
  } catch (error) {
    fail(thread, `posts.json ilegible: ${errorMessage(error)}`);
    continue;
  }
  const listed = index.get(thread);
  const threadTitle = dump.title || listed?.title || '';
  const opening = dump.posts.find((post) => post.number === 1);
  if (!opening) {
    fail(thread, 'no se encuentra el post #1');
    continue;
  }
  const verdict = classifyPjThread(threadTitle, opening);
  if (verdict.group === 'excluido') {
    notImported.push({ thread, ...verdict });
    continue;
  }
  downloaded.push({
    thread,
    dump,
    listed,
    threadUrl: listed?.url ?? dump.url.replace(/\/$/, ''),
    title: pjTitle(opening.html, threadTitle),
  });
}
const isUniqueFirstName = firstNameCounter(downloaded, existingEntries.all);

for (const thread of downloaded) {
  try {
    await convertThread(thread);
  } catch (error) {
    fail(thread.thread, errorMessage(error));
  }
}

const report = buildReport();
await writeFile(PJ_CONVERT_REPORT, `${report.join('\n')}\n`);
console.log(report.join('\n'));
console.log(`\nInforme guardado en ${relative(process.cwd(), PJ_CONVERT_REPORT)}`);

// ---------------------------------------------------------------------------------------------

async function convertThread({ thread, dump, listed, threadUrl, title }: Downloaded) {
  const draft = renderPjDraft({
    threadUrl,
    threadTitle: dump.title || listed?.title,
    subforum: listed?.subforum,
    posts: dump.posts,
    today,
    firstNameAlias: isUniqueFirstName(pjFirstName(title)),
  });

  const existing = byThread.get(threadUrl);
  const slug = existing?.slug ?? freeSlug(draft);
  const file = existing?.file ?? join(PJ_CONTENT_DIR, `${slug}.md`);
  slugs.add(slug);

  const result = existing
    ? await updateEntry(file, threadUrl, draft, isUniqueFirstName)
    : createEntry(draft);
  if (result.markdown !== undefined) {
    const leak = personalDataIn(result.markdown);
    if (leak) throw new Error(`no se escribe: el resultado contiene ${leak}`);
    await writeFile(file, result.markdown);
    if (result.fixes) fixes.push({ file, fixes: result.fixes });
  }
  converted.push({
    thread,
    group: draft.report.ficha,
    file,
    action: result.action,
    draft,
    posts: dump.posts.length,
    subforum: listed?.subforum,
  });
}

async function readIndex(): Promise<Map<string, PjIndexEntry>> {
  if (!existsSync(PJ_INDEX_FILE)) return new Map();
  const { threads } = pjIndexSchema.parse(
    JSON.parse(await readFile(PJ_INDEX_FILE, 'utf8')) as unknown,
  );
  return new Map(threads.map((entry) => [entry.slug, entry]));
}

/**
 * Every thread of _index.json and every thread folder in raw/pj, in alphabetical order, so a
 * listed thread that was never downloaded is reported too; --only narrows them.
 */
async function threadsToConvert(): Promise<string[]> {
  const folders = (await readdir(PJ_RAW_DIR, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('_'))
    .map((dirent) => dirent.name);
  const names = [...new Set([...index.keys(), ...folders])].sort();
  if (!values.only) return names;
  for (const name of values.only) {
    if (!names.includes(name)) fail(name, 'no está en _index.json ni en scraper/raw/pj');
  }
  return names.filter((name) => values.only?.includes(name));
}

/** The PJ entries that exist (all, and by their thread) and every slug taken. */
async function readExistingEntries(): Promise<{
  all: ExistingEntry[];
  byThread: Map<string, ExistingEntry>;
  slugs: Set<string>;
}> {
  const all: ExistingEntry[] = [];
  const byThread = new Map<string, ExistingEntry>();
  const slugs = new Set<string>();
  for (const name of await readdir(PJ_CONTENT_DIR)) {
    if (!name.endsWith('.md')) continue;
    const slug = name.slice(0, -3);
    const file = join(PJ_CONTENT_DIR, name);
    slugs.add(slug);
    const block = FRONTMATTER_BLOCK.exec(normalizeNewlines(await readFile(file, 'utf8')));
    const doc = parseDocument(block?.[1] ?? '');
    const hilo: unknown = doc.get('hilo');
    const title: unknown = doc.get('title');
    const entry: ExistingEntry = {
      slug,
      file,
      ...(typeof title === 'string' ? { title } : {}),
      ...(typeof hilo === 'string' ? { hilo: hilo.replace(/\/$/, '') } : {}),
    };
    all.push(entry);
    if (entry.hilo) byThread.set(entry.hilo, entry);
  }
  return { all, byThread, slugs };
}

/**
 * Whether a first name ('Einar') belongs to one PJ only, among the threads being converted and
 * every PJ entry that exists. A one-word name counts too: 'Bjorn' takes 'Bjorn' from
 * 'Bjorn Thorkelsson'. An entry of a downloaded thread counts once, with the title it has.
 */
function firstNameCounter(
  threads: readonly Downloaded[],
  entries: readonly ExistingEntry[],
): (name: string | undefined) => boolean {
  const owners = new Map<string, Set<string>>();
  const add = (title: string | undefined, owner: string) => {
    const key = normalize(title?.split(' ')[0] ?? '');
    if (key !== '') owners.set(key, (owners.get(key) ?? new Set<string>()).add(owner));
  };
  const threadUrls = new Set(threads.map(({ threadUrl }) => threadUrl));
  for (const { threadUrl, title } of threads) {
    add(byThread.get(threadUrl)?.title ?? title, threadUrl);
  }
  for (const { file, hilo, title } of entries) {
    if (!hilo || !threadUrls.has(hilo)) add(title, file);
  }
  return (name) => name !== undefined && owners.get(normalize(name))?.size === 1;
}

/** The PJ's name; with the account when another PJ has it; then numbered. */
function freeSlug(draft: PjDraft): string {
  if (!slugs.has(draft.slug)) return draft.slug;
  if (!slugs.has(draft.fallbackSlug)) return draft.fallbackSlug;
  let n = 2;
  while (slugs.has(`${draft.fallbackSlug}-${n}`)) n++;
  return `${draft.fallbackSlug}-${n}`;
}

function createEntry(draft: PjDraft): EntryResult {
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
  isUniqueFirstName: (name: string | undefined) => boolean,
): Promise<EntryResult> {
  const text = normalizeNewlines(await readFile(file, 'utf8'));
  const block = FRONTMATTER_BLOCK.exec(text);
  const doc = parseDocument(block?.[1] ?? '');
  if (doc.get('importar') === false) return { action: 'protegida (importar: false)' };

  const fixes = fixFrontmatter(doc, isUniqueFirstName);
  const body = block ? text.slice(block[0].length).replace(/^\n+/, '') : text;
  const bodyChanged = body !== draft.body || doc.get('hilo') !== threadUrl;
  if (!bodyChanged && !fixes.aliasRemoved && !fixes.alineamiento) {
    return { action: 'sin cambios' };
  }

  // Fixing the frontmatter alone is no new import: 'importado' keeps its day.
  if (bodyChanged) {
    doc.set('hilo', threadUrl);
    doc.set('importado', today);
  }
  return {
    action: bodyChanged ? 'actualizada' : 'frontmatter',
    markdown: `---\n${doc.toString(YAML_OPTIONS)}---\n\n${draft.body}`,
    fixes,
  };
}

/**
 * The two fixes that reach the frontmatter of an existing entry: an alignment that needed a
 * fix is written as one of the 9 (or goes, when it is the empty template), and in an entry
 * tagged 'importado' the first name leaves `aliases` when another PJ shares it.
 */
function fixFrontmatter(
  doc: Document,
  isUniqueFirstName: (name: string | undefined) => boolean,
): FrontmatterFixes {
  const fixes: FrontmatterFixes = {};

  const alineamiento: unknown = doc.get('alineamiento');
  if (typeof alineamiento === 'string') {
    const reading = readAlignment(alineamiento);
    if (reading.placeholder) {
      doc.delete('alineamiento');
      fixes.alineamiento = { from: alineamiento };
    } else if (reading.alignment && reading.corrected) {
      const to = ALIGNMENT_LABELS[reading.alignment];
      doc.set('alineamiento', to);
      fixes.alineamiento = { from: alineamiento, to };
    }
  }

  const title: unknown = doc.get('title');
  const tags: unknown = doc.get('tags');
  const aliases: unknown = doc.get('aliases');
  const firstName = typeof title === 'string' ? pjFirstName(title) : undefined;
  const imported =
    isSeq(tags) && tags.items.some((tag) => isScalar(tag) && tag.value === 'importado');
  if (firstName && imported && isSeq(aliases) && !isUniqueFirstName(firstName)) {
    const index = aliases.items.findIndex(
      (alias) =>
        isScalar(alias) &&
        typeof alias.value === 'string' &&
        normalize(alias.value) === normalize(firstName),
    );
    if (index !== -1) {
      aliases.items.splice(index, 1);
      if (aliases.items.length === 0) doc.delete('aliases');
      fixes.aliasRemoved = firstName;
    }
  }
  return fixes;
}

function buildReport(): string[] {
  const lines = [`Conversión de PJ · ${today}`];
  const shown = (file: string) => relative(process.cwd(), file);
  const list = (title: string, items: string[]) => {
    if (items.length > 0)
      lines.push('', `${title} (${items.length}):`, ...items.map((i) => `  ${i}`));
  };

  const imported = [
    { group: 'formulario', title: 'Importados con formulario' },
    { group: 'ficha-libre', title: 'Importados como ficha-libre (post #1 sin formulario)' },
  ] as const;
  for (const { group, title } of imported) {
    list(
      title,
      converted
        .filter((item) => item.group === group)
        // One item per thread, so the heading counts threads; its details go indented below.
        .map(({ thread, file, action, draft: { report }, posts }) =>
          [
            `${action.padEnd(12)} ${shown(file)} ← ${thread}`,
            `posts=${posts} entradas=${report.entries} último post=${report.lastPost ?? '?'}` +
              ` estado(nueva)=${report.estado} sexo=${report.sexoFrom} cuenta=${report.cuentaFrom}`,
            ...(report.missingFields.length > 0
              ? [`campos sin valor: ${report.missingFields.join(', ')}`]
              : []),
            ...report.oddPosts.map((odd) => `⚠ ${odd}`),
          ].join('\n    '),
        ),
    );
  }
  const notImportedGroups = [
    { group: 'excluido', title: 'Excluidos (no son un PJ), con su motivo' },
    { group: 'fallido', title: 'Fallidos, con su error' },
  ] as const;
  for (const { group, title } of notImportedGroups) {
    list(
      title,
      notImported
        .filter((item) => item.group === group)
        .map(({ thread, reason }) => `${thread}: ${reason ?? '?'}`),
    );
  }

  const count = (action: Action) => converted.filter((item) => item.action === action).length;
  lines.push(
    '',
    `Fichas: creadas ${count('creada')} · actualizadas ${count('actualizada')} · ` +
      `solo frontmatter ${count('frontmatter')} · sin cambios ${count('sin cambios')} · ` +
      `protegidas ${count('protegida (importar: false)')}`,
  );
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
  list(
    'Nombre de pila quitado de aliases (lo comparte otro PJ)',
    fixes.flatMap(({ file, fixes: { aliasRemoved } }) =>
      aliasRemoved ? [`${shown(file)}: ${aliasRemoved}`] : [],
    ),
  );
  list(
    'Alineamiento corregido en el frontmatter',
    fixes.flatMap(({ file, fixes: { alineamiento } }) =>
      alineamiento ? [`${shown(file)} → ${alineamiento.to ?? '(se quita: plantilla vacía)'}`] : [],
    ),
  );
  list(
    'Alineamiento sin interpretar (se deja como está escrito)',
    converted.filter((c) => c.draft.report.alineamientoFrom === 'ilegible').map((c) => c.thread),
  );

  const labels = new Map<string, number>();
  for (const { draft } of converted) {
    for (const label of draft.report.unknownLabels) labels.set(label, (labels.get(label) ?? 0) + 1);
  }
  list(
    'Etiquetas no reconocidas, en "Otros datos" (etiqueta: fichas)',
    [...labels].sort((a, b) => b[1] - a[1]).map(([label, n]) => `${label}: ${n}`),
  );
  // Last, the totals: the same summary scrape:pjs prints.
  const outcomes: PjThreadOutcome[] = [
    ...converted.map(({ thread, group }) => ({ thread, group })),
    ...notImported,
  ];
  lines.push('', ...pjThreadSummary(outcomes, index.size));
  return lines;
}
