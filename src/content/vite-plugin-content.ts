import { resolve, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { buildContent } from './build-content.ts';
import {
  cronicaMeta,
  hasThreadView,
  parseSituacion,
  situacionSearchTitle,
  THREAD_PROFILES,
  type CronicaMeta,
} from './cronica.ts';
import { isHistorialType, type HistorialType } from './historial.ts';
import {
  buildHistorial,
  itemSearchTitle,
  type HistorialData,
  type HistorialItemMeta,
  type HistorialSummary,
} from './historial-items.ts';
import { readContentFiles } from './load-from-fs.ts';
import { nameKey, resolvePjNames, type NameResolution } from './pj-names.ts';
import { buildIndex, serializeIndex, type SearchSource } from './search-index.ts';
import type { Entry, EntryMeta } from './types.ts';

/*
 * Node-only. Does at build time (and once per change in dev) the heavy work over the content
 * and hands the browser two virtual modules:
 *   virtual:grimorio/content       every entry without its body, the issues, the link graph,
 *                                  each history (PJ, crónica) without the text of its entries
 *                                  and what is derived from each crónica (eager)
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

const hasHistorial = (entry: Entry): entry is Entry<HistorialType> => isHistorialType(entry.type);

async function compute(rootDir: string): Promise<Computed> {
  const { entries, issues, links } = buildContent(await readContentFiles(rootDir));

  const historiales = new Map<string, HistorialData>();
  const summaries: Record<string, HistorialSummary> = {};
  const withHistorial = entries.filter(hasHistorial);
  for (const entry of withHistorial) {
    const { summary, data } = buildHistorial(entry);
    historiales.set(entry.slug, data);
    summaries[entry.slug] = summary;
  }

  // Which PJ each companion and participant is, so the browser only reads the slug.
  const pjs = withHistorial.filter((entry) => entry.type === 'pj');
  const resolutions = resolvePjNames(
    pjs.map((entry) => ({ entry, items: historiales.get(entry.slug)?.items ?? [] })),
  );
  const items: Record<string, HistorialItemMeta[]> = {};
  for (const entry of withHistorial) {
    const resolved = resolutions.get(entry.slug) ?? new Map<string, NameResolution>();
    const resolve = (name: string) => resolved.get(nameKey(name)) ?? { kind: 'none' };
    const slugOf = (name: string) => {
      const resolution = resolve(name);
      return resolution.kind === 'pj' ? resolution.slug : null;
    };
    const isPj = entry.type === 'pj';

    if (isPj) {
      const summary = summaries[entry.slug];
      summary.companions = summary.companions.map((companion) => ({
        ...companion,
        pj: slugOf(companion.name),
        ...(resolve(companion.name).kind === 'ambiguous' ? { ambiguous: true } : {}),
      }));
    }
    // Without bodyMarkdown, searchText and blocks; JSON leaves out the fields that are undefined.
    items[entry.slug] = (historiales.get(entry.slug)?.items ?? []).map(
      ({ id, date, authorName, authorHandle, title, editedAt, participantes, recompensa, preview }) => ({
        id,
        date,
        authorName,
        authorHandle,
        title,
        editedAt,
        participantes,
        participantesPj: isPj ? participantes.map(slugOf) : undefined,
        recompensa,
        preview,
      }),
    );
  }

  // Each history entry is a search result of its own, and so is each block of a situation (a
  // crónica's, or the content of a lore entry that is a thread).
  const titleOf = new Map(entries.map((entry) => [entry.slug, entry.data.title]));
  const cronicas: Record<string, CronicaMeta> = {};
  const sources = new Map<string, SearchSource>();
  for (const entry of withHistorial) {
    const data = historiales.get(entry.slug);
    if (!data) continue;
    const { title } = entry.data;
    const { type } = entry;
    const historialParts = data.items.map((item) => ({
      kind: 'historial' as const,
      anchor: item.id,
      title: itemSearchTitle(title, item),
      resumen: item.participantes.join(' '),
      body: [item.bodyMarkdown, item.recompensa ?? ''].join('\n'),
    }));
    if (type === 'pj') {
      sources.set(entry.slug, { body: data.fichaBody, parts: historialParts });
      continue;
    }
    // A lore entry that is no thread is indexed whole, as any other entry.
    if (!hasThreadView(entry, data.items.length)) continue;
    const situacion = parseSituacion(data.fichaBody, type);
    const profile = THREAD_PROFILES[type];
    cronicas[entry.slug] = cronicaMeta(situacion, data.items);
    const zonaTitle = entry.data.zona ? titleOf.get(entry.data.zona) : undefined;
    sources.set(entry.slug, {
      body: situacion.rest,
      parts: [
        ...situacion.blocks.map((block) => ({
          kind: 'section' as const,
          anchor: block.id,
          title: situacionSearchTitle(type, title, zonaTitle, block.label),
          body: block.markdown,
        })),
        ...(situacion.intro
          ? [
              {
                kind: 'section' as const,
                anchor: profile.anchor,
                title: `${title} · ${profile.heading}`,
                body: situacion.intro,
              },
            ]
          : []),
        ...historialParts,
      ],
    });
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
      anchors: [...links.anchors],
    })};`,
    `export const historialSummaries = ${jsonModuleValue(summaries)};`,
    `export const historialItems = ${jsonModuleValue(items)};`,
    `export const cronicas = ${jsonModuleValue(cronicas)};`,
  ].join('\n');
  const index = serializeIndex(buildIndex(entries, sources));
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
