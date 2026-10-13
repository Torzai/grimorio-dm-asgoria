import { useEffect, useState } from 'react';
import { whenIdle } from './idle.ts';
import { loadIndex, type SearchIndex } from './search-index.ts';

/*
 * The search index, built and serialized at build time by the content plugin, lives in its
 * own chunk: it holds every word of every body. It is loaded when the browser is idle after
 * the app starts, or earlier if the search is used first.
 */

let index: SearchIndex | undefined;
let loading: Promise<SearchIndex> | undefined;

export function loadSearchIndex(): Promise<SearchIndex> {
  loading ??= import('virtual:grimorio/search-index').then(
    (module) => (index = loadIndex(module.default)),
    (error: unknown) => {
      loading = undefined;
      throw error;
    },
  );
  return loading;
}

/** Loads the index once the browser has nothing else to do; returns a cancel function. */
export function preloadSearchIndexWhenIdle(): () => void {
  // A failure is reported by useSearchIndex, which tries again.
  return whenIdle(() => void loadSearchIndex().catch(() => undefined));
}

/** The search index, or undefined while it loads (which this starts). */
export function useSearchIndex(): SearchIndex | undefined {
  const [loaded, setLoaded] = useState(index);
  useEffect(() => {
    if (loaded) return;
    let current = true;
    loadSearchIndex().then(
      (value) => {
        if (current) setLoaded(value);
      },
      (error: unknown) => console.error('No se pudo cargar el índice de búsqueda', error),
    );
    return () => {
      current = false;
    };
  }, [loaded]);
  return loaded;
}
