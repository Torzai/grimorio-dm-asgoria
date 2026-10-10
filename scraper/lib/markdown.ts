import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import {
  DISCORD_EDIT_MARK,
  DISCORD_TAG_PATTERN,
  DISCORD_TAG_PLACEHOLDER,
  EMAIL_PATTERN,
  EMAIL_PLACEHOLDER,
} from '../config';
import { cleanPostHtml, type CleanedPost } from './clean-post';

const turndown = new TurndownService({
  headingStyle: 'atx',
  hr: '* * *',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
});
turndown.use(gfm);
turndown.remove(['script', 'style', 'noscript']);
turndown.escape = escapeMarkdown;

// A link whose text is its own URL is written as <url> instead of [url](url).
turndown.addRule('bareUrl', {
  filter: (node) => {
    const href = node.getAttribute('href');
    return node.nodeName === 'A' && !!href && node.textContent?.trim() === href;
  },
  replacement: (content, node) => (isElement(node) ? `<${node.getAttribute('href')}>` : content),
});

// Turndown's own list rule with one space after the marker ("- item" instead of "-   item").
turndown.addRule('listItem', {
  filter: 'li',
  replacement: (content, node, options) => {
    const parent = node.parentNode;
    let prefix = `${options.bulletListMarker} `;
    if (parent && isElement(parent) && parent.nodeName === 'OL') {
      const start = parent.getAttribute('start');
      const index = Array.prototype.indexOf.call(parent.children, node);
      prefix = `${start ? Number(start) + index : index + 1}. `;
    }
    const isParagraph = /\n$/.test(content);
    const body = content.replace(/^\n+|\n+$/g, '') + (isParagraph ? '\n' : '');
    const indented = body.replace(/\n/gm, `\n${' '.repeat(prefix.length)}`);
    return prefix + indented + (node.nextSibling ? '\n' : '');
  },
});

export interface ConvertedPost extends Omit<CleanedPost, 'html'> {
  markdown: string;
}

/** Cleans a post body (see clean-post.ts) and turns it into tidy Markdown. */
export function postToMarkdown(html: string): ConvertedPost {
  const { html: cleanHtml, ...notes } = cleanPostHtml(html);
  return { markdown: htmlToMarkdown(cleanHtml), ...notes };
}

export function htmlToMarkdown(html: string): string {
  const markdown = turndown.turndown(normalizeSpaces(html)).replace(DISCORD_EDIT_MARK, '');
  return redactPersonalData(tidyMarkdown(markdown));
}

/** Emails and old Discord tags ("nombre#1234") are replaced wherever they appear. */
export function redactPersonalData(text: string): string {
  return text
    .replace(EMAIL_PATTERN, EMAIL_PLACEHOLDER)
    .replace(DISCORD_TAG_PATTERN, DISCORD_TAG_PLACEHOLDER);
}

/**
 * Escapes only what would break the outline of the draft: text starting like a heading, a
 * quote, a setext underline or a code fence. Everything else stays as typed: lists written by
 * hand ("- Einar: aporta troncos", "1. devolver las monedas") become real lists, and inline
 * marks (*, _, [ ]) keep the meaning the DMs give them on Discord.
 */
export function escapeMarkdown(text: string): string {
  const escaped = text.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  return OUTLINE_BREAKERS.some((start) => start.test(escaped)) ? `\\${escaped}` : escaped;
}

const OUTLINE_BREAKERS = [/^#{1,6}(\s|$)/, /^>/, /^=+\s*$/, /^(-\s*){3,}$/, /^~~~/];

/**
 * Trailing spaces go, except the two that make a line break inside a paragraph; runs of blank
 * lines become one.
 */
export function tidyMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  return lines
    .map((line, index) => {
      const trimmed = line.trimEnd();
      const nextLine = lines[index + 1] ?? '';
      const lineBreak = trimmed !== '' && / {2,}$/.test(line) && nextLine.trim() !== '';
      return lineBreak ? `${trimmed}  ` : trimmed;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** &nbsp; becomes a normal space and zero-width characters (common in Discord pastes) go. */
function normalizeSpaces(html: string): string {
  return html.replace(/&nbsp;|&#160;|&#xa0;|\u00a0/gi, ' ').replace(/[\u200b-\u200d\ufeff]/g, '');
}

function isElement(node: TurndownService.Node | ParentNode): node is HTMLElement {
  return node.nodeType === 1;
}
