import { resolve, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { readContentFiles } from './load-from-fs';
import { loadEntries } from './loader';
import { pjIssues } from './pj';
import { buildPjHistorial, type PjHistorialData, type PjSummary } from './pj-historial';
import { buildIndex, serializeIndex } from './search-index';

/*
 * Node-only. Does at build time (and once per change in dev) the heavy work over the content:
 * the search index, serialized, and each PJ's history split into entries. The browser gets
 * them as virtual modules:
 *   virtual:grimorio/content    index, PJ warnings, PJ summaries and a loader per PJ (eager)
 *   virtual:grimorio/pj/<slug>  the history of one PJ (its own chunk, loaded on demand)
 */

const CONTENT_ID = 'virtual:grimorio/content';
const PJ_PREFIX = 'virtual:grimorio/pj/';

interface Computed {
  contentModule: string;
  historiales: Map<string, PjHistorialData>;
}

async function compute(rootDir: string): Promise<Computed> {
  const { entries } = loadEntries(await readContentFiles(rootDir));
  const pjs = entries.filter((entry) => entry.type === 'pj');

  const historiales = new Map<string, PjHistorialData>();
  const summaries: Record<string, PjSummary> = {};
  for (const pj of pjs) {
    const { summary, data } = buildPjHistorial(pj);
    historiales.set(pj.slug, data);
    summaries[pj.slug] = summary;
  }

  const index = serializeIndex(buildIndex(entries, historiales));
  const loaders = pjs
    .map(({ slug }) => `  ${JSON.stringify(slug)}: () => import(${JSON.stringify(PJ_PREFIX + slug)}),`)
    .join('\n');
  const contentModule = [
    `export const searchIndex = ${jsonModuleValue(index)};`,
    `export const pjIssues = ${jsonModuleValue(pjs.flatMap(pjIssues))};`,
    `export const pjSummaries = ${jsonModuleValue(summaries)};`,
    `export const pjHistorialLoaders = {\n${loaders}\n};`,
  ].join('\n');
  return { contentModule, historiales };
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
      for (const module of graph.idToModuleMap.values()) {
        if (module.id?.startsWith(`\0${CONTENT_ID}`) || module.id?.startsWith(`\0${PJ_PREFIX}`)) {
          graph.invalidateModule(module);
        }
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
      if (id === CONTENT_ID || id.startsWith(PJ_PREFIX)) return `\0${id}`;
      return undefined;
    },
    async load(id) {
      if (id === `\0${CONTENT_ID}`) return (await get()).contentModule;
      if (!id.startsWith(`\0${PJ_PREFIX}`)) return undefined;
      const slug = id.slice(`\0${PJ_PREFIX}`.length);
      const data = (await get()).historiales.get(slug) ?? { items: [], fichaBody: '' };
      return `export default ${jsonModuleValue(data)};`;
    },
  };
}
