import { cwd } from 'node:process';
import { styleText } from 'node:util';
import { loadContentFromFs } from '../src/content/load-from-fs';
import type { ContentIssue } from '../src/content/types';

const { entries, issues } = await loadContentFromFs(cwd());

const issuesByFile = new Map<string, ContentIssue[]>();
for (const issue of issues) {
  issuesByFile.set(issue.path, [...(issuesByFile.get(issue.path) ?? []), issue]);
}

const isError = (issue: ContentIssue) => issue.level === 'error';
const errorsFirst = (a: ContentIssue, b: ContentIssue) => Number(isError(b)) - Number(isError(a));

const files = [...issuesByFile].sort(
  ([pathA, a], [pathB, b]) =>
    Number(b.some(isError)) - Number(a.some(isError)) || pathA.localeCompare(pathB),
);

for (const [path, fileIssues] of files) {
  console.log(styleText('bold', path));
  for (const issue of [...fileIssues].sort(errorsFirst)) {
    const label = isError(issue)
      ? styleText('red', '  ✖ error  ')
      : styleText('yellow', '  ⚠ warning');
    const field = issue.field ? `[${issue.field}] ` : '';
    console.log(`${label} ${field}${issue.message}`);
  }
  console.log('');
}

const errorCount = issues.filter(isError).length;
const warningCount = issues.length - errorCount;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

console.log(
  [
    plural(entries.length, 'ficha válida', 'fichas válidas'),
    plural(errorCount, 'error', 'errores'),
    plural(warningCount, 'warning', 'warnings'),
  ].join(' · '),
);

if (errorCount > 0) {
  process.exitCode = 1;
}
