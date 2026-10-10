import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { normalize } from './normalize';
import type { ContentIssue, Entry } from './types';
import { parseWikilinks } from './wikilinks';

/** Finds the entry a wikilink target points to, or null when the link is broken. */
export type Resolver = (target: string) => Entry | null;

export interface LinkGraph {
  resolve: Resolver;
  /** Slugs each entry links to (body and 'relacionados'), without duplicates. */
  outgoing: Map<string, string[]>;
  /** Slugs of the entries that link to each entry, without self-links. */
  backlinks: Map<string, string[]>;
  /** Slugs of the entries whose 'zona' field points to each zona. */
  byZona: Map<string, string[]>;
}

export interface LinkAnalysis extends LinkGraph {
  issues: ContentIssue[];
}

/** One way an entry can be named, ranked by priority: slug, then title, then alias. */
interface NameClaim {
  entry: Entry;
  rank: number;
  field?: 'title' | 'aliases';
  written: string;
}

const markdown = unified().use(remarkParse).use(remarkGfm).freeze();

/** Resolves by slug, title or alias, ignoring case and accents. */
export function createResolver(entries: readonly Entry[]): Resolver {
  return resolverFrom(claimNames(entries));
}

/**
 * Wikilink targets in a Markdown body, in order and with repeats.
 * Code blocks and inline code are skipped because they are not text nodes.
 */
export function extractWikilinks(body: string): string[] {
  const targets: string[] = [];
  if (!body.includes('[[')) return targets;

  visit(markdown.parse(body), 'text', (node, _index, parent) => {
    // Link text can't hold another link; remark-wikilinks skips it too.
    if (parent?.type === 'link' || parent?.type === 'linkReference') return;
    for (const segment of parseWikilinks(node.value)) {
      if (typeof segment !== 'string') targets.push(segment.target);
    }
  });
  return targets;
}

/** Builds the link graph and reports broken links and references as warnings. */
export function analyzeLinks(entries: readonly Entry[]): LinkAnalysis {
  const claims = claimNames(entries);
  const resolve = resolverFrom(claims);
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  const issues = ambiguityIssues(claims);

  const outgoing = new Map<string, string[]>();
  const backlinks = new Map(entries.map((entry): [string, string[]] => [entry.slug, []]));
  const byZona = new Map(
    entries
      .filter((entry) => entry.type === 'zona')
      .map((entry): [string, string[]] => [entry.slug, []]),
  );

  for (const entry of entries) {
    const warn = (message: string, field?: string) =>
      issues.push({ path: entry.path, level: 'warning', field, message });

    const targets = new Set<string>();
    const broken = new Set<string>();
    for (const target of extractWikilinks(entry.body)) {
      const found = resolve(target);
      if (found) {
        targets.add(found.slug);
      } else if (!broken.has(target)) {
        broken.add(target);
        warn(
          `enlace roto: [[${target}]] no coincide con el nombre de fichero, el título ni ningún alias de otra ficha`,
        );
      }
    }

    for (const slug of entry.data.relacionados ?? []) {
      if (bySlug.has(slug)) {
        targets.add(slug);
      } else {
        warn(
          `'relacionados' incluye '${slug}', pero no hay ninguna ficha con ese nombre de fichero`,
          'relacionados',
        );
      }
    }

    const { zona } = entry.data;
    if (zona !== undefined) {
      const target = bySlug.get(zona);
      if (!target) {
        warn(`'zona' apunta a '${zona}', pero no hay ninguna ficha con ese nombre de fichero`, 'zona');
      } else if (target.type !== 'zona') {
        warn(`'zona' apunta a '${zona}', que es una ficha de tipo ${target.type}, no una zona`, 'zona');
      } else {
        byZona.get(zona)?.push(entry.slug);
      }
    }

    outgoing.set(entry.slug, [...targets]);
    for (const slug of targets) {
      if (slug !== entry.slug) backlinks.get(slug)?.push(entry.slug);
    }
  }

  return { resolve, outgoing, backlinks, byZona, issues };
}

/** Normalized name → every entry using it, winner first (rank, then path). */
function claimNames(entries: readonly Entry[]): Map<string, NameClaim[]> {
  const claims = new Map<string, NameClaim[]>();
  for (const entry of entries) {
    // An entry may repeat a name (title also listed as alias); keep its best rank.
    const own = new Map<string, NameClaim>();
    const claim = (written: string, rank: number, field?: NameClaim['field']) => {
      const name = normalize(written);
      if (name && !own.has(name)) own.set(name, { entry, rank, field, written });
    };
    claim(entry.slug, 0);
    claim(entry.data.title, 1, 'title');
    for (const alias of entry.data.aliases ?? []) claim(alias, 2, 'aliases');

    for (const [name, nameClaim] of own) {
      claims.set(name, [...(claims.get(name) ?? []), nameClaim]);
    }
  }

  for (const list of claims.values()) {
    list.sort((a, b) => a.rank - b.rank || compare(a.entry.path, b.entry.path));
  }
  return claims;
}

function resolverFrom(claims: Map<string, NameClaim[]>): Resolver {
  const winners = new Map<string, Entry>();
  for (const [name, [winner]] of claims) winners.set(name, winner.entry);
  return (target) => winners.get(normalize(target)) ?? null;
}

function ambiguityIssues(claims: Map<string, NameClaim[]>): ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const list of claims.values()) {
    if (list.length < 2) continue;
    const [winner] = list;
    for (const claim of list) {
      const others = list.filter((other) => other !== claim).map((other) => other.entry.path);
      const users = `también ${others.length === 1 ? 'lo usa' : 'lo usan'} ${others.join(', ')}`;
      const outcome =
        claim === winner
          ? 'lleva a esta ficha'
          : `lleva a ${winner.entry.path}; para enlazar esta usa [[${claim.entry.slug}]]`;
      issues.push({
        path: claim.entry.path,
        level: 'warning',
        field: claim.field,
        message: `nombre ambiguo: '${claim.written}' ${users}; [[${claim.written}]] ${outcome}`,
      });
    }
  }
  return issues;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
