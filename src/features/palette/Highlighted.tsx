import type { ReactNode } from 'react';
import { findRanges } from '@/features/entry-view/pj/highlight';

/** Plain text with every match of the terms wrapped in <mark>. */
export function Highlighted({ text, terms }: { text: string; terms: readonly string[] }) {
  const ranges = findRanges(text, terms);
  if (ranges.length === 0) return text;
  const parts: ReactNode[] = [];
  let from = 0;
  for (const [start, end] of ranges) {
    parts.push(text.slice(from, start), <mark key={start}>{text.slice(start, end)}</mark>);
    from = end;
  }
  parts.push(text.slice(from));
  return parts;
}
