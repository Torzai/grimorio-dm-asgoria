import { pjHistorialLoaders, pjSummaries } from 'virtual:grimorio/content';
import type { PjHistorialData, PjSummary } from './pj-historial';

const EMPTY: PjHistorialData = { items: [], fichaBody: '' };
const loading = new Map<string, Promise<PjHistorialData>>();

/** Totals of a PJ's history, computed at build time; undefined for an unknown slug. */
export function pjSummaryOf(slug: string): PjSummary | undefined {
  return pjSummaries[slug];
}

/**
 * The history of a PJ, from its own chunk. The same promise for the same slug, so it can be
 * passed to React's use(). A slug the build doesn't know (e.g. a PJ added while the dev server
 * reloads) gets an empty history.
 */
export function loadPjHistorial(slug: string): Promise<PjHistorialData> {
  let promise = loading.get(slug);
  if (!promise) {
    const loader = pjHistorialLoaders[slug];
    promise = loader ? loader().then((module) => module.default) : Promise.resolve(EMPTY);
    loading.set(slug, promise);
  }
  return promise;
}
