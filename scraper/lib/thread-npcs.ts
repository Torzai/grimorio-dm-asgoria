import { Document as YamlDocument } from 'yaml';
import { parseSituacion, type ThreadType } from '../../src/content/cronica';
import { HISTORIAL_PROFILES, parseHistorial } from '../../src/content/historial';
import { historialItem } from '../../src/content/historial-items';
import { normalize } from '../../src/content/normalize';
import { SECRET_COLORS, SECRET_LABEL, type BlockNpc, type NpcBlock } from '../config';
import { flowLists, YAML_OPTIONS } from './entry-file';
import { parseFragment } from './html';
import { postToMarkdown } from './markdown';
import type { ForumPost } from './thread-page';

/*
 * The NPCs of a lore thread (NPC_LINKS in config.ts): their first mention in their block
 * becomes a wikilink to their ficha, and each ficha is drafted with a link back to the block
 * and the blue text of that block, the secrets. Blocks are found by the anchors the app gives
 * them, with the app's own functions.
 */

/** Where a block is in the body: [start, end). */
interface Range {
  start: number;
  end: number;
}

/**
 * Every anchor of a thread entry's body with its range: the blocks of the main post, the
 * annexes and the blocks inside each annex.
 */
function anchorRanges(body: string, type: ThreadType): Map<string, Range> {
  const ranges = new Map<string, Range>();
  /** Finds a block's Markdown from `from` on; returns where the search can go on. */
  const add = (id: string, markdown: string, from: number): number => {
    const start = markdown ? body.indexOf(markdown, from) : -1;
    if (start < 0) return from;
    ranges.set(id, { start, end: start + markdown.length });
    return start + markdown.length;
  };

  let cursor = 0;
  for (const block of parseSituacion(body, type).blocks) {
    cursor = add(block.id, block.markdown, cursor);
  }
  const profile = HISTORIAL_PROFILES[type];
  for (const entry of parseHistorial(body).entries) {
    const from = cursor;
    cursor = add(entry.id, entry.body, cursor);
    let inside = from;
    for (const block of historialItem(entry, { profile, ownNames: [] }).blocks?.blocks ?? []) {
      inside = add(block.id, block.markdown, inside);
    }
  }
  return ranges;
}

/** The smallest of the given anchors whose range holds `offset`. */
function anchorAt(
  ranges: ReadonlyMap<string, Range>,
  offset: number,
  anchors: Iterable<string> = ranges.keys(),
): string | undefined {
  let best: { anchor: string; size: number } | undefined;
  for (const anchor of anchors) {
    const range = ranges.get(anchor);
    if (!range || offset < range.start || offset >= range.end) continue;
    const size = range.end - range.start;
    if (!best || size < best.size) best = { anchor, size };
  }
  return best?.anchor;
}

const LETTER = /[\p{L}\p{N}]/u;

/** Spans of the [[wikilinks]] already in the body, which a mention must stay out of. */
function wikilinkSpans(body: string): Range[] {
  return [...body.matchAll(/\[\[[^[\]\n]*\]\]/g)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/** The first appearance of `mention` as whole words inside `range`, outside `taken`; -1 if none. */
function firstMention(
  body: string,
  mention: string,
  range: Range,
  taken: readonly Range[],
): number {
  for (
    let at = body.indexOf(mention, range.start);
    at >= 0 && at + mention.length <= range.end;
    at = body.indexOf(mention, at + 1)
  ) {
    const end = at + mention.length;
    const wholeWords = !LETTER.test(body[at - 1] ?? '') && !LETTER.test(body[end] ?? '');
    const free = taken.every((span) => end <= span.start || at >= span.end);
    if (wholeWords && free) return at;
  }
  return -1;
}

export interface NpcLinking {
  body: string;
  linked: number;
  /** 'sir-derian en s-casa-tuktan', for every mention that was not found. */
  missing: string[];
}

/** The first mention of each NPC in its block becomes [[slug|mention]]. */
export function linkNpcs(body: string, blocks: readonly NpcBlock[], type: ThreadType): NpcLinking {
  const ranges = anchorRanges(body, type);
  const taken = wikilinkSpans(body);
  const links: { at: number; npc: BlockNpc }[] = [];
  const missing: string[] = [];
  for (const block of blocks) {
    const range = ranges.get(block.bloque);
    for (const npc of block.npcs) {
      const at = range ? firstMention(body, npc.mention, range, taken) : -1;
      if (at < 0) {
        missing.push(
          `${npc.slug} en ${block.bloque}${range ? '' : ' (no hay bloque con ese anchor)'}`,
        );
        continue;
      }
      links.push({ at, npc });
      taken.push({ start: at, end: at + npc.mention.length });
    }
  }

  // From the end, so the offsets still to apply stay valid.
  let linked = body;
  for (const { at, npc } of links.sort((a, b) => b.at - a.at)) {
    const end = at + npc.mention.length;
    linked = `${linked.slice(0, at)}[[${npc.slug}|${npc.mention}]]${linked.slice(end)}`;
  }
  return { body: linked, linked: links.length, missing };
}

export interface NpcSecrets {
  /** Secrets of each NPC, as Markdown, in thread order. */
  bySlug: Map<string, string[]>;
  /** Anchors of the blocks with secrets but no NPC: they stay only in the lore entry. */
  withoutNpc: string[];
  /** Blue texts that could not be found in the body. */
  unplaced: number;
}

/**
 * The blue texts of the thread (SECRET_COLORS), each given to the NPCs of its block that it
 * names, or to the block's first NPC when it names none. Found on the body before linkNpcs().
 */
export function npcSecrets(
  posts: readonly ForumPost[],
  body: string,
  blocks: readonly NpcBlock[],
  type: ThreadType,
): NpcSecrets {
  const ranges = anchorRanges(body, type);
  const byAnchor = new Map(blocks.map((block) => [block.bloque, block]));
  const result: NpcSecrets = { bySlug: new Map(), withoutNpc: [], unplaced: 0 };

  for (const post of posts) {
    for (const element of secretElements(post.html)) {
      const secret = postToMarkdown(element.outerHTML).markdown.trim();
      if (!secret) continue;
      const at = body.indexOf((secret.split('\n')[0] ?? '').slice(0, 40));
      if (at < 0) {
        result.unplaced++;
        continue;
      }
      const block = byAnchor.get(anchorAt(ranges, at, byAnchor.keys()) ?? '');
      if (!block || block.npcs.length === 0) {
        result.withoutNpc.push(anchorAt(ranges, at) ?? 'fuera de los bloques');
        continue;
      }
      const text = normalize(secret);
      const named = block.npcs.filter((npc) =>
        [npc.mention, npc.title ?? '', ...(npc.aliases ?? [])].some(
          (name) => name && text.includes(normalize(name)),
        ),
      );
      for (const npc of named.length > 0 ? named : block.npcs.slice(0, 1)) {
        const own = result.bySlug.get(npc.slug) ?? [];
        if (!own.includes(secret)) result.bySlug.set(npc.slug, [...own, secret]);
      }
    }
  }
  return result;
}

/** The outermost elements of a post written in a secret colour. */
function secretElements(html: string): Element[] {
  const all = [...parseFragment(html).querySelectorAll('[style], font[color]')].filter(isSecret);
  return all.filter(
    (element) => !all.some((other) => other !== element && other.contains(element)),
  );
}

function isSecret(element: Element): boolean {
  const style = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(element.getAttribute('style') ?? '')?.[1];
  const color = (style ?? element.getAttribute('color') ?? '').replace(/\s+/g, '').toLowerCase();
  return SECRET_COLORS.includes(color);
}

export interface NpcDraft {
  slug: string;
  /** The whole file: frontmatter and body. */
  markdown: string;
  secrets: number;
}

/**
 * The ficha of each NPC of the blocks, in order of first appearance: the fields of its first
 * block, a link to every block it appears in, its secrets and the empty sections of the NPC
 * template (`templateBody`).
 */
export function npcDrafts(
  loreSlug: string,
  blocks: readonly NpcBlock[],
  secrets: ReadonlyMap<string, readonly string[]>,
  templateBody: string,
): NpcDraft[] {
  const appearances = new Map<string, { npc: BlockNpc; block: NpcBlock }[]>();
  for (const block of blocks) {
    for (const npc of block.npcs) {
      appearances.set(npc.slug, [...(appearances.get(npc.slug) ?? []), { npc, block }]);
    }
  }

  return [...appearances].map(([slug, [first, ...others]]) => {
    const { npc, block } = first;
    const faccion = npc.faccion === undefined ? block.nombre : npc.faccion;
    const zona = npc.zona === undefined ? block.zona : npc.zona;
    const doc = new YamlDocument({
      type: 'npc',
      title: npc.title ?? npc.mention,
      ...(npc.aliases?.length ? { aliases: [...npc.aliases] } : {}),
      tags: ['importado'],
      ...(zona ? { zona } : {}),
      ...(faccion ? { faccion } : {}),
      relacionados: [loreSlug],
    });
    flowLists(doc);

    const seen = new Set<string>();
    const links = [first, ...others].flatMap(({ block: { bloque, nombre } }) => {
      if (seen.has(bloque)) return [];
      seen.add(bloque);
      return [`[[${loreSlug}#${bloque}|${nombre}]]`];
    });
    const own = secrets.get(slug) ?? [];
    const body = [
      `Aparece en ${spanishList(links)}.`,
      ...own.map((secret) => `${SECRET_LABEL}${secret}`),
      templateBody.trim(),
    ]
      .filter((part) => part !== '')
      .join('\n\n');
    return {
      slug,
      markdown: `---\n${doc.toString(YAML_OPTIONS)}---\n\n${body}\n`,
      secrets: own.length,
    };
  });
}

/** 'a', 'a y b', 'a, b y c'; 'e' before a word that sounds 'i' ('Juzgado e Iglesia'). */
function spanishList(items: readonly string[]): string {
  if (items.length < 2) return items.join('');
  const last = items.at(-1) ?? '';
  const visible = last.replace(/^\[\[[^|\]]*\|/, '');
  const and = /^h?i(?![aeouáéó])/i.test(visible) ? 'e' : 'y';
  return `${items.slice(0, -1).join(', ')} ${and} ${last}`;
}
