import {
  CLEANUP,
  DISCORD_HOST_PATTERN,
  EMAIL_PATTERN,
  IMAGE_LABEL,
  IMAGE_UNAVAILABLE,
  QUOTE_TITLE_PATTERN,
  SITE_URL,
} from '../config';
import { parseFragment, textOf } from './html';

export interface ImageNote {
  /** `src` as found in the post. */
  src: string;
  /** URL linked from the draft; undefined when the image became a note. */
  url?: string;
  status: 'ok' | 'repaired' | 'unavailable' | 'invalid';
}

export interface CleanedPost {
  html: string;
  /** The post had messages pasted from Discord. */
  discordPaste: boolean;
  /** Quotes left in the post: Asgaros quotes plus forum posts pasted into it. */
  quotes: number;
  images: ImageNote[];
  /** Links removed, by kind. */
  droppedLinks: ('mailto' | 'discord')[];
}

const EMAIL = new RegExp(EMAIL_PATTERN.source);

/**
 * Keeps only what the author wrote. Pasted forum posts and quotes become <blockquote>s headed
 * by their author, forum and Discord interface goes, Discord pastes become one block per
 * message, mailto and Discord links go and images become links. Returns HTML for turndown.
 */
export function cleanPostHtml(html: string): CleanedPost {
  const fragment = parseFragment(html);
  const doc = fragment.ownerDocument;

  // Before removing the forum chrome: the author of a pasted post lives in it.
  quotePastedPosts(fragment);
  headQuotes(fragment);
  removeAll(fragment, CLEANUP.forumChrome);
  const discordPaste = flattenDiscordPastes(fragment);
  const droppedLinks = dropPrivateLinks(fragment);
  const images = linkImages(fragment);
  flattenHeadings(fragment);

  const container = doc.createElement('div');
  container.append(fragment);
  return {
    html: container.innerHTML,
    discordPaste,
    quotes: container.querySelectorAll('blockquote').length,
    images,
    droppedLinks,
  };
}

/** Fixes what a bad paste does to an <img> src: junk glued after the URL, no scheme. */
export function repairImageUrl(src: string): { url?: string; repaired: boolean } {
  const original = src.trim();
  // "//i.postimg.cc/33.jpg' border='0' alt='33'/></a>" → "//i.postimg.cc/33.jpg"
  const [cut] = original.split(/['"\s<>]/);
  const absolute = cut.startsWith('//') ? `https:${cut}` : cut;
  try {
    const url = new URL(absolute, absolute.startsWith('/') ? SITE_URL : undefined);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { repaired: false };
    return { url: url.href, repaired: absolute !== original };
  } catch {
    return { repaired: false };
  }
}

function quotePastedPosts(root: DocumentFragment): void {
  const doc = root.ownerDocument;
  for (const body of root.querySelectorAll(CLEANUP.pastedPostBody)) {
    const frame = body.closest(CLEANUP.pastedPost) ?? body;
    const author = frame === body ? '' : textOf(frame.querySelector(CLEANUP.pastedPostAuthor));
    const quote = doc.createElement('blockquote');
    if (author) quote.append(authorLine(doc, author));
    quote.append(...body.childNodes);
    frame.replaceWith(quote);
  }
}

/** "Cita de Li Zakien en 24/10/2023, 5:52 pm" → "**Li Zakien escribió:**". */
function headQuotes(root: DocumentFragment): void {
  const doc = root.ownerDocument;
  for (const title of root.querySelectorAll(`blockquote ${CLEANUP.quoteTitle}`)) {
    const author =
      textOf(title.querySelector(CLEANUP.quoteAuthor)) ||
      (QUOTE_TITLE_PATTERN.exec(textOf(title))?.[1] ?? '');
    if (author) title.replaceWith(authorLine(doc, author));
    else title.remove();
  }
}

function authorLine(doc: Document, author: string): HTMLParagraphElement {
  const line = doc.createElement('p');
  const strong = doc.createElement('strong');
  strong.textContent = `${author} escribió:`;
  line.append(strong);
  return line;
}

/**
 * A heading inside a post (a Discord username, a line written as a title) would become a
 * '### ' line and split the history, so it becomes a bold paragraph. Its inline marks go:
 * the whole line is bold already, and '<strong><b>X</b></strong>' or '<i>—</i>' would come
 * out as '****X****' or '_—_'. Links stay. Empty headings go.
 */
function flattenHeadings(root: DocumentFragment): void {
  const doc = root.ownerDocument;
  for (const heading of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (!textOf(heading)) {
      heading.remove();
      continue;
    }
    for (const mark of heading.querySelectorAll(INLINE_MARKS)) mark.replaceWith(...mark.childNodes);
    const line = doc.createElement('p');
    const strong = doc.createElement('strong');
    strong.append(...heading.childNodes);
    line.append(strong);
    heading.replaceWith(line);
  }
}

const INLINE_MARKS = 'strong, b, em, i, u, s, span, font';

/** One block per message; lists inside a paste are flattened too, so each item is a paragraph. */
function flattenDiscordPastes(root: DocumentFragment): boolean {
  const doc = root.ownerDocument;
  const selector = CLEANUP.discordPaste.join(', ');
  const pastes = [...root.querySelectorAll(selector)].filter(
    (element) => !element.parentElement?.closest(selector),
  );
  for (const paste of pastes) {
    removeAll(paste, CLEANUP.discordChrome);
    for (const item of paste.querySelectorAll('li')) {
      const block = doc.createElement('div');
      block.append(...item.childNodes);
      item.replaceWith(block);
    }
    for (const list of [paste, ...paste.querySelectorAll('ul, ol')]) {
      if (list.matches('ul, ol')) list.replaceWith(...list.childNodes);
    }
  }
  return pastes.length > 0;
}

function dropPrivateLinks(root: DocumentFragment): CleanedPost['droppedLinks'] {
  const dropped: CleanedPost['droppedLinks'] = [];
  for (const link of root.querySelectorAll('a[href]')) {
    const href = (link.getAttribute('href') ?? '').trim();
    const text = textOf(link);
    if (/^mailto:/i.test(href)) {
      dropped.push('mailto');
      // The address goes entirely; other wording stays as plain text.
      if (EMAIL.test(text) || text === href.slice('mailto:'.length)) link.remove();
      else link.replaceWith(...link.childNodes);
    } else if (isDiscordUrl(href)) {
      dropped.push('discord');
      if (text === href || isDiscordUrl(text)) link.remove();
      else link.replaceWith(...link.childNodes);
    }
  }
  return dropped;
}

function linkImages(root: DocumentFragment): ImageNote[] {
  const doc = root.ownerDocument;
  const notes: ImageNote[] = [];
  for (const image of root.querySelectorAll('img')) {
    const src = image.getAttribute('src') ?? '';
    const alt = (image.getAttribute('alt') ?? '').trim();
    const label = alt ? `${IMAGE_LABEL}: ${alt}` : IMAGE_LABEL;
    const { url, repaired } = repairImageUrl(src);

    if (url && isDiscordUrl(url)) {
      notes.push({ src, status: 'unavailable' });
      image.replaceWith(emphasis(doc, IMAGE_UNAVAILABLE));
    } else if (url) {
      notes.push({ src, url, status: repaired ? 'repaired' : 'ok' });
      if (image.closest('a')) {
        // Already inside a link: keep that link and just give it a text.
        image.replaceWith(doc.createTextNode(label));
      } else {
        const link = doc.createElement('a');
        link.setAttribute('href', url);
        link.textContent = label;
        image.replaceWith(link);
      }
    } else {
      notes.push({ src, status: 'invalid' });
      image.replaceWith(emphasis(doc, `(${label.toLowerCase()})`));
    }
  }
  return notes;
}

function isDiscordUrl(value: string): boolean {
  try {
    return DISCORD_HOST_PATTERN.test(new URL(value, SITE_URL).hostname);
  } catch {
    return false;
  }
}

function emphasis(doc: Document, text: string): HTMLElement {
  const element = doc.createElement('em');
  element.textContent = text;
  return element;
}

function removeAll(root: ParentNode, selectors: readonly string[]): void {
  for (const element of root.querySelectorAll(selectors.join(', '))) element.remove();
}
