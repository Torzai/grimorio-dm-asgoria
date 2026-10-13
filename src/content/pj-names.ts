import { normalize, withoutApostrophes } from './normalize.ts';
import type { EntryMeta } from './types.ts';

/*
 * Node-safe and pure: the content plugin runs it at build time over every PJ's history, so
 * the browser only reads the result. A name in a history ('Einar') may be the first name of
 * several PJs; the PJ that really played with the owner of the history is the one whose own
 * history has entries on the same dates.
 */

/** What the resolution needs from a PJ: its names and the dates and participants of its history. */
export interface PjNameSource {
  entry: EntryMeta;
  items: readonly { date: string; participantes: readonly string[] }[];
}

/** How a name in a PJ's history resolves to another PJ. */
export type NameResolution =
  | { kind: 'pj'; slug: string; candidates: number; matches: number }
  /** Several PJs share the name and the dates didn't settle which one it is. */
  | { kind: 'ambiguous'; candidates: number }
  /** No PJ has that name, or it is the owner of the history. */
  | { kind: 'none' };

/** Normalized name → how it resolves; one map per PJ slug. */
export type PjNameResolutions = Map<string, Map<string, NameResolution>>;

const NONE: NameResolution = { kind: 'none' };

/** Key of a name in the index and in the result: no accents, case or apostrophes. */
export function nameKey(name: string): string {
  return withoutApostrophes(normalize(name)).replace(/\s+/g, ' ');
}

/** Resolves every participant name of every PJ's history to the PJ it most likely is. */
export function resolvePjNames(pjs: readonly PjNameSource[]): PjNameResolutions {
  const index = nameIndex(pjs);
  const datesOf = new Map(pjs.map((pj) => [pj.entry.slug, datesIndex(pj)]));
  const result: PjNameResolutions = new Map();

  for (const pj of pjs) {
    const own = ownKeys(pj.entry);
    // Dates of the entries where each name appears.
    const datesByName = new Map<string, Set<string>>();
    for (const item of pj.items) {
      for (const name of item.participantes) {
        const key = nameKey(name);
        const dates = datesByName.get(key) ?? new Set<string>();
        dates.add(item.date);
        datesByName.set(key, dates);
      }
    }

    const resolved = new Map<string, NameResolution>();
    for (const [key, dates] of datesByName) {
      if (own.has(key)) {
        resolved.set(key, NONE);
        continue;
      }
      const candidates = candidatesFor(index, key).filter((other) => other !== pj);
      resolved.set(key, pick(candidates, dates, own, datesOf));
    }
    result.set(pj.entry.slug, resolved);
  }
  return result;
}

interface Score {
  pj: PjNameSource;
  /** Entries of the owner, with this name, on a date the candidate has an entry too. */
  matches: number;
  /** Of those dates, how many list the owner among the candidate's participants. */
  mutual: number;
}

function pick(
  candidates: readonly PjNameSource[],
  dates: ReadonlySet<string>,
  ownerKeys: ReadonlySet<string>,
  datesOf: ReadonlyMap<string, Map<string, Set<string>>>,
): NameResolution {
  if (candidates.length === 0) return NONE;
  if (candidates.length === 1) {
    const [only] = candidates;
    return { kind: 'pj', slug: only.entry.slug, candidates: 1, matches: 0 };
  }

  const scores: Score[] = candidates.map((candidate) => {
    const theirs = datesOf.get(candidate.entry.slug) ?? new Map<string, Set<string>>();
    let matches = 0;
    let mutual = 0;
    for (const date of dates) {
      const names = theirs.get(date);
      if (!names) continue;
      matches += 1;
      if ([...names].some((name) => ownerKeys.has(name))) mutual += 1;
    }
    return { pj: candidate, matches, mutual };
  });
  scores.sort((a, b) => b.matches - a.matches || b.mutual - a.mutual);

  const [first, second] = scores;
  const wins =
    first.matches >= 1 &&
    (first.matches > second.matches ||
      (first.matches === second.matches && first.mutual > second.mutual));
  return wins
    ? { kind: 'pj', slug: first.pj.entry.slug, candidates: candidates.length, matches: first.matches }
    : { kind: 'ambiguous', candidates: candidates.length };
}

/** Full title, aliases and the first word of each → the PJs that use it. */
function nameIndex(pjs: readonly PjNameSource[]): Map<string, PjNameSource[]> {
  const index = new Map<string, PjNameSource[]>();
  for (const pj of pjs) {
    for (const key of ownKeys(pj.entry)) {
      const list = index.get(key) ?? [];
      if (!list.includes(pj)) list.push(pj);
      index.set(key, list);
    }
  }
  return index;
}

/** By the whole name first ('Einar Eriksson'), then by its first word ('Einar'). */
function candidatesFor(index: Map<string, PjNameSource[]>, key: string): PjNameSource[] {
  return index.get(key) ?? index.get(key.split(' ')[0]) ?? [];
}

/** Title and aliases of a PJ, whole and by their first word. */
function ownKeys(entry: EntryMeta): Set<string> {
  const keys = new Set<string>();
  for (const name of [entry.data.title, ...(entry.data.aliases ?? [])]) {
    const key = nameKey(name);
    if (key === '') continue;
    keys.add(key);
    keys.add(key.split(' ')[0]);
  }
  return keys;
}

/** Date → normalized participant names of the PJ's entries on that date. */
function datesIndex(pj: PjNameSource): Map<string, Set<string>> {
  const byDate = new Map<string, Set<string>>();
  for (const item of pj.items) {
    const names = byDate.get(item.date) ?? new Set<string>();
    for (const name of item.participantes) {
      const key = nameKey(name);
      names.add(key);
      names.add(key.split(' ')[0]);
    }
    byDate.set(item.date, names);
  }
  return byDate;
}
