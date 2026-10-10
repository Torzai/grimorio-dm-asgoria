import { JSDOM } from 'jsdom';

// jsdom neither runs scripts nor fetches anything by default, so saved forum pages are inert.

/** Parses a whole saved page. */
export function parseHtml(html: string): Document {
  return new JSDOM(html).window.document;
}

/** Parses a piece of HTML, such as the body of one post. */
export function parseFragment(html: string): DocumentFragment {
  return JSDOM.fragment(html);
}

/** Text of an element with its whitespace (including &nbsp;) collapsed. */
export function textOf(node: Node | null | undefined): string {
  return collapseSpaces(node?.textContent ?? '');
}

export function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
