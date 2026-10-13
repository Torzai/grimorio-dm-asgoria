import { normalize } from '@/content/normalize';

/*
 * Search terms are compared without accents or case: 'drak' finds "Drák'Nar". Matches are found
 * in a per-letter normalized copy of the text, whose positions map back to the original.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;

/** The words of a query, normalized; empty for a blank query. */
export function queryTerms(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter((term) => term !== '');
}

/** True when every term appears in the (already normalized) text. */
export function matchesAll(normalizedText: string, terms: readonly string[]): boolean {
  return terms.every((term) => normalizedText.includes(term));
}

type Range = [start: number, end: number];

/** Where the terms appear in the text, sorted and without overlaps. */
export function findRanges(text: string, terms: readonly string[]): Range[] {
  if (terms.length === 0) return [];
  // folded[i] comes from text[offsets[i]], so a match in folded maps back to text.
  let folded = '';
  const offsets: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const letter = text[index].normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
    for (let k = 0; k < letter.length; k += 1) offsets.push(index);
    folded += letter;
  }
  offsets.push(text.length);

  const ranges: Range[] = [];
  for (const term of terms) {
    let from = folded.indexOf(term);
    while (from !== -1) {
      const lastLetter = offsets[from + term.length - 1];
      ranges.push([offsets[from], lastLetter + 1]);
      from = folded.indexOf(term, from + term.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/* rehype plugin: the same <mark> inside rendered Markdown. */

interface HastText {
  type: 'text';
  value: string;
}

interface HastElement {
  type: 'element';
  tagName: string;
  properties: Record<string, unknown>;
  children: HastNode[];
}

interface HastParent {
  type: string;
  children?: HastNode[];
}

type HastNode = HastText | HastElement | HastParent;

const isText = (node: HastNode): node is HastText => node.type === 'text';

function markTexts(node: HastNode, terms: readonly string[]) {
  if (isText(node) || !('children' in node) || !node.children) return;
  if (node.type === 'element' && 'tagName' in node && node.tagName === 'mark') return;
  node.children = node.children.flatMap((child): HastNode[] => {
    if (!isText(child)) {
      markTexts(child, terms);
      return [child];
    }
    const ranges = findRanges(child.value, terms);
    if (ranges.length === 0) return [child];
    const pieces: HastNode[] = [];
    let from = 0;
    for (const [start, end] of ranges) {
      if (start > from) pieces.push({ type: 'text', value: child.value.slice(from, start) });
      pieces.push({
        type: 'element',
        tagName: 'mark',
        properties: {},
        children: [{ type: 'text', value: child.value.slice(start, end) }],
      });
      from = end;
    }
    if (from < child.value.length) pieces.push({ type: 'text', value: child.value.slice(from) });
    return pieces;
  });
}

/** Wraps the query's terms in <mark> in every text of the rendered Markdown. */
export function rehypeMark(terms: readonly string[]) {
  return (tree: HastNode) => markTexts(tree, terms);
}
