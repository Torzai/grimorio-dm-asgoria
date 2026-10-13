import { collapse, parseMarkdown, plainText, withoutNodes } from '../../src/content/markdown-text';
import { normalize } from '../../src/content/normalize';
import { splitBlocks } from '../../src/content/post-structure';
import { GENERAL_REGION, type TopicRegion, type TopicSplit } from '../config';
import { postToMarkdown, type ConvertedPost } from './markdown';
import type { ForumPost } from './thread-page';

/*
 * A thread that mixes regions, split in one crónica per region (TrackedTopic.split): a bold
 * line with only a region's name opens that region's part of a post; a post without such lines
 * goes whole to the region its text names most; `assign` overrides both. Prints nothing.
 */

/** How a part got its region: a region heading in the post, a DM's `assign`, or its words. */
export type RegionOrigin = 'encabezado' | 'manual' | 'auto';

export type Confidence = 'alta' | 'media' | 'baja';

export interface Deduction {
  /** A region slug, or GENERAL_REGION when no region stands out. */
  region: string;
  confidence: Confidence;
}

export interface RegionPart {
  post: ForumPost;
  /** The post converted, with only this part's Markdown. */
  converted: ConvertedPost;
  /** Where the part goes: a region slug or GENERAL_REGION. */
  region: string;
  origin: RegionOrigin;
  /** What the words of the part say, kept to report it next to a manual assignment. */
  deduced: Deduction;
}

/** Every post of the thread, or every region part of a post, with its region, in thread order. */
export function splitByRegion(
  posts: readonly ForumPost[],
  split: TopicSplit,
  assign: Readonly<Record<number, string>> = {},
): RegionPart[] {
  const known = new Set([...split.regions.map((region) => region.slug), GENERAL_REGION]);
  for (const [number, region] of Object.entries(assign)) {
    if (!known.has(region)) {
      throw new Error(
        `assign: el post #${number} va a «${region}», que no es una región de split ni '${GENERAL_REGION}'`,
      );
    }
  }
  return [...posts]
    .sort((a, b) => a.number - b.number)
    .flatMap((post) => partsOf(post, split.regions, assign[post.number]));
}

function partsOf(
  post: ForumPost,
  regions: readonly TopicRegion[],
  assigned: string | undefined,
): RegionPart[] {
  const converted = postToMarkdown(post.html);
  const deduced = deduceRegion(converted.markdown, regions);
  if (assigned !== undefined) {
    return [{ post, converted, region: assigned, origin: 'manual', deduced }];
  }

  const sections = regionSections(converted.markdown, regions);
  if (sections.length === 0)
    return [{ post, converted, region: deduced.region, origin: 'auto', deduced }];

  return sections.map((section, index): RegionPart => {
    // What the cleanup noted about the post (images, links) is counted once, with its first part.
    const part: ConvertedPost =
      index === 0
        ? { ...converted, markdown: section.markdown }
        : { ...converted, markdown: section.markdown, images: [], droppedLinks: [], quotes: 0 };
    if (section.region) {
      const byHeading = { region: section.region, confidence: 'alta' } as const;
      return {
        post,
        converted: part,
        region: section.region,
        origin: 'encabezado',
        deduced: byHeading,
      };
    }
    const own = deduceRegion(section.markdown, regions);
    return { post, converted: part, region: own.region, origin: 'auto', deduced: own };
  });
}

interface Section {
  /** Undefined for the text before the first region heading. */
  region?: string;
  markdown: string;
}

/**
 * The post cut at its region headings, the headings themselves left out; two parts of the same
 * region are joined. Empty when the post has no region heading.
 */
function regionSections(markdown: string, regions: readonly TopicRegion[]): Section[] {
  const { intro, blocks } = splitBlocks(markdown, { idOf: (slug) => slug });
  if (!blocks.some((block) => regionOfHeading(block.label, regions))) return [];

  const sections: { region?: string; texts: string[] }[] = intro ? [{ texts: [intro] }] : [];
  for (const block of blocks) {
    const region = regionOfHeading(block.label, regions);
    if (region) {
      const text = withoutHeading(block.markdown, block.label);
      const same = sections.find((section) => section.region === region);
      if (same) same.texts.push(text);
      else sections.push({ region, texts: [text] });
    } else {
      const current = sections.at(-1);
      if (current) current.texts.push(block.markdown);
      else sections.push({ texts: [block.markdown] });
    }
  }
  return sections.map(({ region, texts }) => ({
    ...(region ? { region } : {}),
    markdown: texts.filter((text) => text !== '').join('\n\n'),
  }));
}

/** 'Karak', 'En Karak', 'Región de Karak', 'Situación en Karak' → 'karak'. */
const HEADING_PREFIX = /^(?:(?:situacion|region)\s+)?(?:(?:de|del|en)\s+)?/;

function regionOfHeading(label: string, regions: readonly TopicRegion[]): string | undefined {
  const name = words(label).replace(HEADING_PREFIX, '');
  return regions.find((region) => words(region.title) === name)?.slug;
}

/** The block without its label, when the label is a paragraph of its own. */
function withoutHeading(markdown: string, label: string): string {
  const [first] = parseMarkdown(markdown).children;
  const compact = (text: string) => normalize(text).replace(/[^\p{L}\p{N}]/gu, '');
  return first && compact(collapse(plainText(first))) === compact(label)
    ? withoutNodes(markdown, [first]).trim()
    : markdown;
}

/**
 * The region a text mentions most, by its name and keywords. 'alta' when it names two or more
 * of them and no other region; 'media' when one region leads; 'baja', and GENERAL_REGION, when
 * none is named or two tie.
 */
export function deduceRegion(markdown: string, regions: readonly TopicRegion[]): Deduction {
  const text = words(markdown);
  const scores = regions
    .map((region) => {
      let hits = 0;
      let named = 0;
      for (const term of [region.title, ...(region.keywords ?? [])]) {
        const count = countWord(text, words(term));
        hits += count;
        if (count > 0) named++;
      }
      return { region: region.slug, hits, named };
    })
    .filter((score) => score.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  const [top, second] = scores;
  if (!top || second?.hits === top.hits) return { region: GENERAL_REGION, confidence: 'baja' };
  return { region: top.region, confidence: top.named >= 2 && !second ? 'alta' : 'media' };
}

/** Lowercase words without accents, split by single spaces: 'Dhu-Nún.' → 'dhu nun'. */
function words(text: string): string {
  return normalize(text)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Times `term` appears in `text` as whole words; both come from words(), letters and spaces only. */
function countWord(text: string, term: string): number {
  if (!term) return 0;
  return [...text.matchAll(new RegExp(`(?<=^| )${term}(?= |$)`, 'g'))].length;
}
