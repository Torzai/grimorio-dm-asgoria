// @vitest-environment node
import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import { createResolver } from './links';
import { loadEntries } from './loader';
import { remarkWikilinks } from './remark-wikilinks';

const { entries } = loadEntries({
  'content/npc/tobias.md': '---\ntype: npc\ntitle: Tobías el Mercader\naliases: [Tobi]\n---\n',
});
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkWikilinks, createResolver(entries));

function transform(markdown: string): Root {
  return processor.runSync(processor.parse(markdown));
}

describe('remarkWikilinks', () => {
  it('turns a resolved link into a link node with the entry title', () => {
    const [paragraph] = transform('Habla con [[Tobi]] hoy.').children;
    expect(paragraph).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Habla con ' },
        {
          type: 'link',
          url: '/npc/tobias',
          children: [{ type: 'text', value: 'Tobías el Mercader' }],
          data: { hProperties: { 'data-wikilink': 'true' } },
        },
        { type: 'text', value: ' hoy.' },
      ],
    });
  });

  it('uses the label as link text, also inside a GFM table', () => {
    const tree = transform('| A |\n|---|\n| [[tobias\\|el mercader]] |');
    expect(tree.children[0]).toMatchObject({
      type: 'table',
      children: [
        {},
        {
          children: [
            {
              children: [
                { type: 'link', url: '/npc/tobias', children: [{ type: 'text', value: 'el mercader' }] },
              ],
            },
          ],
        },
      ],
    });
  });

  it('turns a broken link into a span marked with data-broken', () => {
    const [paragraph] = transform('[[Nadie]] y [[nadie-mas|Otro]]').children;
    expect(paragraph).toMatchObject({
      children: [
        { type: 'text', value: 'Nadie', data: { hName: 'span', hProperties: { 'data-broken': 'true' } } },
        { type: 'text', value: ' y ' },
        { type: 'text', value: 'Otro', data: { hName: 'span', hProperties: { 'data-broken': 'true' } } },
      ],
    });
  });

  it('leaves code blocks, inline code and plain text untouched', () => {
    const markdown = 'Escribe `[[Tobi]]` así.\n\n```\n[[Tobi]]\n```\n\nSin enlaces.';
    expect(transform(markdown)).toEqual(processor.parse(markdown));
  });
});
