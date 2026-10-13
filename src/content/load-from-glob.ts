import { entries, issues, links } from 'virtual:grimorio/content';
import type { Content } from './build-content.ts';
import { splitFrontmatter } from './frontmatter.ts';
import { createResolver } from './links.ts';

// One chunk per file, imported when the entry opens. The negative pattern keeps folders
// starting with '_' (drafts in _inbox, templates in _templates) out of the bundle.
const files = import.meta.glob<string>(['/content/**/*.md', '!/content/_*/**'], {
  query: '?raw',
  import: 'default',
});

/**
 * Browser-only: every entry without its body, the issues and the link graph, as the content
 * plugin (vite-plugin-content.ts) computed them at build time.
 */
export function loadContentFromGlob(): Content {
  return {
    entries,
    issues,
    links: {
      resolve: createResolver(entries),
      outgoing: new Map(links.outgoing),
      backlinks: new Map(links.backlinks),
      byZona: new Map(links.byZona),
    },
  };
}

/** The body of an entry, by its path ('content/npc/x.md'); empty for an unknown path. */
export async function importBody(path: string): Promise<string> {
  const load = files[`/${path}`];
  if (!load) return '';
  const split = splitFrontmatter(await load());
  return split.ok ? split.body : '';
}
