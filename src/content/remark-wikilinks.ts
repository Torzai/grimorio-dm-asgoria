import type { Link, PhrasingContent, Root, Text } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import type { Resolver } from './links.ts';
import { parseWikilinks, type Wikilink } from './wikilinks.ts';

/** What mdast-util-to-hast reads from node.data to choose the HTML element. */
interface HastData {
  hName?: string;
  hProperties: Record<string, string>;
}

/**
 * Turns '[[target]]' and '[[target|label]]' in text nodes into links to '/<type>/<slug>'.
 * Broken links become a '<span data-broken="true">' with the text as written.
 * Code and inline code are left alone because they are not text nodes.
 */
export const remarkWikilinks: Plugin<[Resolver], Root> = (resolve) => {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined) return;
      // Link text can't hold another link; links.ts skips it too.
      if (parent.type === 'link' || parent.type === 'linkReference') return;

      const segments = parseWikilinks(node.value);
      if (segments.every((segment) => typeof segment === 'string')) return;

      const nodes = segments.map((segment) =>
        typeof segment === 'string' ? text(segment) : toNode(segment, resolve),
      );
      parent.children.splice(index, 1, ...nodes);
      // Continue after the inserted nodes so the new text isn't scanned again.
      return index + nodes.length;
    });
  };
};

function toNode({ target, label }: Wikilink, resolve: Resolver): PhrasingContent {
  const entry = resolve(target);
  if (!entry) {
    return { ...text(label ?? target), data: hastData({ 'data-broken': 'true' }, 'span') };
  }
  const link: Link = {
    type: 'link',
    url: `/${entry.type}/${entry.slug}`,
    children: [text(label ?? entry.data.title)],
    data: hastData({ 'data-wikilink': 'true' }),
  };
  return link;
}

function text(value: string): Text {
  return { type: 'text', value };
}

// Typed locally rather than augmenting mdast's Data, so it cannot clash with the
// augmentation that mdast-util-to-hast brings in (react-markdown, T06).
function hastData(hProperties: Record<string, string>, hName?: string): HastData {
  return hName ? { hName, hProperties } : { hProperties };
}
