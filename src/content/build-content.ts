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

/** Everything the app and validate need from the raw Markdown files. */
export function buildContent(files: Record<string, string>): Content {
  const { entries, issues } = loadEntries(files);
  const { issues: linkIssues, ...links } = analyzeLinks(entries);
  return {
    entries,
    issues: [...issues, ...entries.flatMap(pjIssues), ...linkIssues],
    links,
    index: buildIndex(entries),
  };
}
