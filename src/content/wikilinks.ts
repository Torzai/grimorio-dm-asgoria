export interface Wikilink {
  /** What the link points to, as written: a slug, title or alias. */
  target: string;
  /** Visible text from '[[target|label]]', when given. */
  label?: string;
}

/** Plain text or a wikilink, in reading order. */
export type WikilinkSegment = string | Wikilink;

// No brackets or line breaks inside, so '[[a [[b]]' only matches '[[b]]'.
const WIKILINK = /\[\[([^[\]\n]*)\]\]/g;
// The first '|' splits target and label; '\|' is the form escaped for GFM tables.
const LABEL_SEPARATOR = /^(.*?)\\?\|(.*)$/;

/**
 * Splits text into plain strings and wikilinks: '[[target]]', '[[target|label]]'
 * or '[[target\|label]]'. Empty links such as '[[]]' are kept as plain text.
 */
export function parseWikilinks(text: string): WikilinkSegment[] {
  const segments: WikilinkSegment[] = [];
  let plain = '';
  let lastIndex = 0;

  for (const match of text.matchAll(WIKILINK)) {
    const link = toWikilink(match[1]);
    plain += text.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;
    if (!link) {
      plain += match[0];
      continue;
    }
    if (plain) segments.push(plain);
    segments.push(link);
    plain = '';
  }

  plain += text.slice(lastIndex);
  if (plain) segments.push(plain);
  return segments;
}

function toWikilink(inner: string): Wikilink | null {
  const parts = LABEL_SEPARATOR.exec(inner);
  const target = (parts ? parts[1] : inner).trim();
  const label = parts?.[2].trim();
  if (!target) return null;
  return label ? { target, label } : { target };
}
