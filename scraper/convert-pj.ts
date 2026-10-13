import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { EMAIL_PATTERN, INBOX_DIR } from './config';
import { localDay } from './lib/dates';
import { draftMarkdown, renderPjDraft, type DraftReport } from './lib/pj-draft';
import { threadDumpSchema } from './lib/thread-page';

// npm run scrape:convert -- --dir <carpeta> [--force]
// Turns the posts.json of a PJ thread into a draft in content/_inbox/pj/<personaje>.md, which
// the app and `validate` ignore until a DM reviews it and moves it. An existing draft is only
// replaced with --force, since it may already have changes made by hand.

const { values } = parseArgs({
  options: { dir: { type: 'string' }, force: { type: 'boolean', default: false } },
});

if (values.dir) {
  await convert(resolve(values.dir), values.force);
} else {
  console.error('Uso: npm run scrape:convert -- --dir <carpeta con posts.json> [--force]');
  process.exitCode = 1;
}

async function convert(dir: string, force: boolean): Promise<void> {
  const dump = threadDumpSchema.parse(
    JSON.parse(await readFile(join(dir, 'posts.json'), 'utf8')) as unknown,
  );
  const draft = renderPjDraft({
    threadUrl: dump.url,
    threadTitle: dump.title,
    posts: dump.posts,
    today: localDay(new Date()),
  });
  const markdown = draftMarkdown(draft);

  // Last line of defence: redactPersonalData already ran on every text that reached the draft.
  if (new RegExp(EMAIL_PATTERN.source).test(markdown)) {
    console.error(
      '✖ El borrador contiene algo con forma de email; no se escribe. Revisa la limpieza.',
    );
    process.exitCode = 1;
    return;
  }

  const file = join(INBOX_DIR, 'pj', `${draft.slug}.md`);
  const shown = relative(process.cwd(), file);
  if (existsSync(file) && !force) {
    console.error(
      `✖ ${shown} ya existe. Usa --force para reemplazarlo (se pierden los cambios a mano).`,
    );
    process.exitCode = 1;
    return;
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, markdown);
  console.log(`✔ Borrador escrito en ${shown}`);
  printReport(draft.report);
}

function printReport(report: DraftReport): void {
  const list = (items: (string | number)[]) =>
    items.length > 0
      ? items.map((item) => (typeof item === 'number' ? `#${item}` : item)).join(', ')
      : 'ninguno';

  console.log(
    `  Historial: ${report.entries} entradas, de ${report.newest} (arriba) a ${report.oldest}`,
  );
  console.log(`  Editados: ${list(report.edited)}`);
  console.log(`  Con mensajes de Discord pegados: ${list(report.discordPastes)}`);
  console.log(`  Con citas: ${list(report.quotes)}`);
  console.log(`  Etiquetas no reconocidas (en "Otros datos"): ${list(report.unknownLabels)}`);
  console.log(`  Etiquetas descartadas por datos personales: ${list(report.discardedLabels)}`);
  console.log(`  Campos sin valor: ${list(report.missingFields)}`);
  for (const { post, image } of report.images) {
    const detail = image.url ? `${image.url}` : `sin enlace (src original: ${image.src})`;
    console.log(`  Imagen #${post} [${image.status}]: ${detail}`);
  }
  for (const { post, kind } of report.droppedLinks) {
    console.log(`  Enlace eliminado en #${post}: ${kind === 'mailto' ? 'mailto' : 'Discord'}`);
  }
  for (const odd of report.oddPosts) console.warn(`  ⚠ ${odd}`);
}
