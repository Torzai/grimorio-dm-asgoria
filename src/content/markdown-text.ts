import type { Nodes, Root, RootContent } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { parseWikilinks } from './wikilinks.ts';

/*
 * Small helpers over the Markdown of a body, shared by everything that reads its structure
 * (histories, crónicas). Node-safe and pure: the content plugin runs them at build time and the
 * browser runs the same ones once a body is loaded, so both get the same result.
 */

const parser = unified().use(remarkParse).use(remarkGfm);

/** The Markdown tree (GFM) of a text; every node keeps its position in it. */
export function parseMarkdown(markdown: string): Root {
  return parser.parse(markdown);
}

const BLOCK_CONTAINERS = new Set(['root', 'blockquote', 'list', 'listItem', 'table']);

/** The text of a Markdown node: blocks on their own lines, wikilinks as their visible text. */
export function plainText(node: Nodes | Root): string {
  switch (node.type) {
    case 'text':
      return withoutWikilinks(node.value);
    case 'inlineCode':
    case 'code':
      return node.value;
    case 'break':
      return '\n';
    case 'image':
      return node.alt ?? '';
    case 'html':
      return '';
    case 'tableRow':
      return node.children.map(plainText).join(' · ');
  }
  if (!('children' in node)) return '';
  const children: Nodes[] = node.children;
  return children.map(plainText).join(BLOCK_CONTAINERS.has(node.type) ? '\n' : '');
}

function withoutWikilinks(text: string): string {
  return parseWikilinks(text)
    .map((segment) =>
      typeof segment === 'string' ? segment : (segment.label ?? segment.target),
    )
    .join('');
}

/** The Markdown without the given top-level nodes, which come from parsing that same text. */
export function withoutNodes(markdown: string, nodes: readonly RootContent[]): string {
  const ranges = nodes
    .flatMap((node) => {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      return start === undefined || end === undefined ? [] : [[start, end] as const];
    })
    .sort((a, b) => a[0] - b[0]);
  let result = '';
  let from = 0;
  for (const [start, end] of ranges) {
    result += markdown.slice(from, start);
    from = end;
  }
  result += markdown.slice(from);
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

/** One line, single spaces. */
export function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Single spaces, but keeping the line breaks of a reward written as a list. */
export function collapseLines(text: string): string {
  return text
    .split('\n')
    .map(collapse)
    .filter((line) => line !== '')
    .join('\n');
}

/** At most `length` letters, cut at a space when there is one near the end, with '…'. */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  const cut = text.slice(0, length);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > length * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Per line of the Markdown, whether it is fenced code (fences included). */
export function codeLines(lines: readonly string[]): boolean[] {
  let fence: string | undefined;
  return lines.map((line) => {
    const mark = FENCE.exec(line)?.[1];
    if (fence !== undefined) {
      if (mark?.[0] === fence[0] && mark.length >= fence.length) fence = undefined;
      return true;
    }
    if (mark !== undefined) {
      fence = mark;
      return true;
    }
    return false;
  });
}

const NEXT_SECTION = /^#{1,2}\s/;

/**
 * The text under the first heading that matches `heading`, up to the next '#' or '##' heading,
 * and the rest of the body without that section. Headings inside fenced code don't count.
 */
export function cutSection(
  body: string,
  heading: RegExp,
): { section: string | undefined; rest: string } {
  const lines = body.split(/\r?\n/);
  const isCode = codeLines(lines);
  const sectionLines: string[] = [];
  const restLines: string[] = [];
  let state: 'before' | 'inside' | 'after' = 'before';
  lines.forEach((line, index) => {
    if (state === 'before' && !isCode[index] && heading.test(line)) {
      state = 'inside';
      return;
    }
    if (state === 'inside' && !isCode[index] && NEXT_SECTION.test(line)) state = 'after';
    (state === 'inside' ? sectionLines : restLines).push(line);
  });
  return {
    section: state === 'before' ? undefined : sectionLines.join('\n').trim(),
    rest: restLines.join('\n').trim(),
  };
}
