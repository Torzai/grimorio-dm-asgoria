import { analyzeLinks, type LinkGraph } from './links';
import { loadEntries } from './loader';
import { pjIssues } from './pj';
import { buildIndex, type SearchIndex } from './search-index';
import type { ContentIssue, Entry } from './types';

export interface Content {
  entries: Entry[];
  /** Loader issues, then the warnings of each PJ, then link issues. */
  issues: ContentIssue[];
  links: LinkGraph;
  index: SearchIndex;
}

/**
 * What the content plugin already computed at build time, so the browser doesn't go through
 * every PJ's history again.
 */
export interface Prebuilt {
  index: SearchIndex;
  /** pjIssues() of every PJ. */
  pjIssues: ContentIssue[];
}

/** Everything the app and validate need from the raw Markdown files. */
export function buildContent(files: Record<string, string>, prebuilt?: Prebuilt): Content {
  const { entries, issues } = loadEntries(files);
  const { issues: linkIssues, ...links } = analyzeLinks(entries);
  return {
    entries,
    issues: [...issues, ...(prebuilt?.pjIssues ?? entries.flatMap(pjIssues)), ...linkIssues],
    links,
    index: prebuilt?.index ?? buildIndex(entries),
  };
}
