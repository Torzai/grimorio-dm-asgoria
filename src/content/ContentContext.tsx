import { useMemo, type ReactNode } from 'react';
import type { Content } from './build-content';
import { loadContentFromGlob } from './load-from-glob';
import { ContentContext } from './use-content';

// Module-level so StrictMode's double render doesn't build twice.
// HMR re-runs this module when a .md changes, which resets it.
let loaded: Content | undefined;

function loadOnce(): Content {
  if (!loaded) {
    const start = performance.now();
    loaded = loadContentFromGlob();
    if (import.meta.env.DEV) {
      const elapsed = (performance.now() - start).toFixed(1);
      console.info(`buildContent: ${elapsed} ms (${loaded.entries.length} fichas)`);
    }
  }
  return loaded;
}

interface ContentProviderProps {
  /** Ready-made content, for tests; the bundled content otherwise. */
  content?: Content;
  children: ReactNode;
}

export function ContentProvider({ content, children }: ContentProviderProps) {
  const value = useMemo(() => content ?? loadOnce(), [content]);
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}
