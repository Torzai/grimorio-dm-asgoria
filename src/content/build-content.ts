import { historialIssues } from './historial.ts';
import { analyzeLinks, type LinkGraph } from './links.ts';
import { loadEntries } from './loader.ts';
import { pjIssues } from './pj.ts';
import type { ContentIssue, Entry, EntryMeta } from './types.ts';

/** What the app holds: every entry without its body, which is loaded when the entry opens. */
export interface Content {
  entries: EntryMeta[];
  /** Loader issues, then the warnings of each PJ and of each history, then link issues. */
  issues: ContentIssue[];
  links: LinkGraph;
}

/** The same, with the bodies: what validate and the content plugin work on. */
export interface FullContent extends Content {
  entries: Entry[];
}

/** Everything validate and the content plugin need from the raw Markdown files. */
export function buildContent(files: Record<string, string>): FullContent {
  const { entries, issues } = loadEntries(files);
  const { issues: linkIssues, ...links } = analyzeLinks(entries);
  return {
    entries,
    issues: [
      ...issues,
      ...entries.flatMap(pjIssues),
      ...entries.flatMap(historialIssues),
      ...linkIssues,
    ],
    links,
  };
}
