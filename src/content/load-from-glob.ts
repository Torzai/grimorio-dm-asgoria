import { pjIssues, searchIndex } from 'virtual:grimorio/content';
import { buildContent, type Content } from './build-content';
import { loadIndex } from './search-index';

// The negative pattern keeps folders starting with '_' (drafts in _inbox, templates in
// _templates) out of the bundle. The loader skips them too, but by then their text would
// already be in dist/.
const files = import.meta.glob<string>(['/content/**/*.md', '!/content/_*/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Paths of the bundled Markdown files, e.g. '/content/npc/ejemplo.md'. */
export const bundledPaths: readonly string[] = Object.keys(files);

/**
 * Browser-only: content bundled by Vite at build time. The search index and the PJ warnings
 * come ready from the content plugin (vite-plugin-content.ts).
 */
export function loadContentFromGlob(): Content {
  return buildContent(files, { index: loadIndex(searchIndex), pjIssues });
}
