import { loadEntries, type LoadResult } from './loader';

const files = import.meta.glob<string>('/content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Browser-only: content bundled by Vite at build time. */
export function loadContentFromGlob(): LoadResult {
  return loadEntries(files);
}
