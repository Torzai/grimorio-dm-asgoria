// @vitest-environment node
import { expect, it } from 'vitest';
import { loadContentFromGlob } from './load-from-glob';

it('loads the bundled example content without errors', () => {
  const { entries, issues } = loadContentFromGlob();

  expect(issues.filter((issue) => issue.level === 'error')).toEqual([]);
  expect(entries).toHaveLength(21);
  expect(entries[0].path).toMatch(/^content\//);
});
