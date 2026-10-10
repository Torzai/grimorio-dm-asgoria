// @vitest-environment node
import { expect, it } from 'vitest';
import { loadContentFromGlob } from './load-from-glob';

it('builds the bundled example content without errors or warnings', () => {
  const { entries, issues, links } = loadContentFromGlob();

  expect(issues).toEqual([]);
  expect(entries).toHaveLength(21);
  expect(entries[0].path).toMatch(/^content\//);
  expect(links.outgoing.size).toBe(21);
});
