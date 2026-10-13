import { visit, type Document } from 'yaml';
import { DISCORD_TAG_PATTERN, EMAIL_PATTERN } from '../config';

/** Same YAML style everywhere the importer writes: one line per value, lists in brackets. */
export const YAML_OPTIONS = { lineWidth: 0, flowCollectionPadding: false } as const;

/** The '---' frontmatter block at the top of an entry, with its YAML as group 1. */
export const FRONTMATTER_BLOCK = /^---[ \t]*\n([\s\S]*?\n)?---[ \t]*\n/;

/** Without a BOM and with '\n' line ends, as the importer writes every entry. */
export function normalizeNewlines(text: string): string {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return withoutBom.replace(/\r\n?/g, '\n');
}

/** Last line of defence: the cleanup already redacted these from every text of the entry. */
export function personalDataIn(markdown: string): string | undefined {
  if (new RegExp(EMAIL_PATTERN.source).test(markdown)) return 'algo con forma de email';
  if (new RegExp(DISCORD_TAG_PATTERN.source).test(markdown)) return 'una etiqueta nombre#1234';
  return undefined;
}

/** Every list of the YAML in brackets on one line: tags: [importado]. */
export function flowLists(doc: Document): void {
  visit(doc, {
    Seq: (_key, seq) => {
      seq.flow = true;
    },
  });
}
