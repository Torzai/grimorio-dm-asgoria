import { resolve, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { buildContent } from './build-content.ts';
import { readContentFiles } from './load-from-fs.ts';
import {
  buildPjHistorial,
  type HistorialItemMeta,
  type PjHistorialData,
  type PjSummary,
} from './pj-historial.ts';
import { nameKey, resolvePjNames, type NameResolution } from './pj-names.ts';
import { buildIndex, serializeIndex } from './search-index.ts';
import type { EntryMeta } from './types.ts';

/*
 * Node-only. Does at build time (and once per change in dev) the heavy work over the content
 * and hands the browser two virtual modules:
 *   virtual:grimorio/content       every entry without its body, the issues, the link graph,
 *                                  and each PJ's history without the text of its entries (eager)
 *   virtual:grimorio/search-index  the MiniSearch index, serialized (its own chunk, loaded
 *                                  when the browser is idle or the search is first used)
 * The bodies are not here: load-from-glob.ts imports each .md on its own when it is opened.
 */

const CONTENT_ID = 'virtual:grimorio/content';
const INDEX_ID = 'virtual:grimorio/search-index';

interface Computed {
  contentModule: string;
  indexModule: string;
}

async function compute(rootDir: string): Promise<Computed> {
  const { entries, issues, links } = buildContent(await readContentFiles(rootDir));

  const historiales = new Map<string, PjHistorialData>();
  const summaries: Record<string, PjSummary> = {};
  const pjs = entries.filter((entry) => entry.type === 'pj');
  for (const pj of pjs) {
    const { summary, data } = buildPjHistorial(pj);
    historiales.set(pj.slug, data);
    summaries[pj.slug] = summary;
  }

  // Which PJ each companion and participant is, so the browser only reads the slug.
  const resolutions = resolvePjNames(
    pjs.map((entry) => ({ entry, items: historiales.get(entry.slug)?.items ?? [] })),
  );
  const items: Record<string, HistorialItemMeta[]> = {};
  for (const pj of pjs) {
    const resolved = resolutions.get(pj.slug) ?? new Map<string, NameResolution>();
    const resolve = (name: string) => resolved.get(nameKey(name)) ?? { kind: 'none' };
    const slugOf = (name: string) => {
      const resolution = resolve(name);
      return resolution.kind === 'pj' ? resolution.slug : null;
    };

    const summary = summaries[pj.slug];
    summary.companions = summary.companions.map((companion) => ({
      ...companion,
      pj: slugOf(companion.name),
      ...(resolve(companion.name).kind === 'ambiguous' ? { ambiguous: true } : {}),
    }));
    // Without bodyMarkdown and searchText; JSON leaves out the fields that are undefined.
    items[pj.slug] = (historiales.get(pj.slug)?.items ?? []).map(
      ({ id, date, authorName, authorHandle, participantes, recompensa, preview }) => ({
        id,
        date,
        authorName,
        authorHandle,
        participantes,
        participantesPj: participantes.map(slugOf),
        recompensa,
        preview,
      }),
    );
  }

  const metas: EntryMeta[] = entries.map(({ slug, type, path, data }) => ({
    slug,
    type,
    path,
    data,
  }));
  const contentModule = [
    `export const entries = ${jsonModuleValue(metas)};`,
    `export const issues = ${jsonModuleValue(issues)};`,
    `export const links = ${jsonModuleValue({
      outgoing: [...links.outgoing],
      backlinks: [...links.backlinks],
      byZona: [...links.byZona],
    })};`,
    `export const pjSummaries = ${jsonModuleValue(summaries)};`,
    `export const pjHistoriales = ${jsonModuleValue(items)};`,
  ].join('\n');
  const index = serializeIndex(buildIndex(entries, historiales));
  return { contentModule, indexModule: `export default ${jsonModuleValue(index)};` };
}

/** JSON.parse of a string literal is parsed faster than the same object as a JS literal. */
function jsonModuleValue(value: unknown): string {
  return `JSON.parse(${JSON.stringify(JSON.stringify(value))})`;
}

export function grimorioContent(): Plugin {
  let rootDir = process.cwd();
  let computed: Promise<Computed> | undefined;
  const get = () => (computed ??= compute(rootDir));

  function watchContent(server: ViteDevServer) {
    const contentDir = resolve(rootDir, 'content') + sep;
    const onChange = (file: string) => {
      if (!resolve(file).startsWith(contentDir) || !file.toLowerCase().endsWith('.md')) return;
      computed = undefined;
      const graph = server.environments.client.moduleGraph;
      for (const id of [CONTENT_ID, INDEX_ID]) {
        const module = graph.getModuleById(`\0${id}`);
        if (module) graph.invalidateModule(module);
      }
      server.ws.send({ type: 'full-reload' });
    };
    server.watcher.on('add', onChange);
    server.watcher.on('change', onChange);
    server.watcher.on('unlink', onChange);
  }

  return {
    name: 'grimorio-content',
    configResolved(config) {
      rootDir = config.root;
    },
    configureServer: watchContent,
    resolveId(id) {
      if (id === CONTENT_ID || id === INDEX_ID) return `\0${id}`;
      return undefined;
    },
    async load(id) {
      if (id === `\0${CONTENT_ID}`) return (await get()).contentModule;
      if (id === `\0${INDEX_ID}`) return (await get()).indexModule;
      return undefined;
    },
  };
}
