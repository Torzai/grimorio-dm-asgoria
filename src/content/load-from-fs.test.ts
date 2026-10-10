// @vitest-environment node
import { cwd } from 'node:process';
import { expect, it } from 'vitest';
import { loadContentFromFs } from './load-from-fs';
import { ENTRY_TYPES } from './types';

it('loads the example content in content/ without errors', async () => {
  const { entries, issues } = await loadContentFromFs(cwd());

  expect(issues.filter((issue) => issue.level === 'error')).toEqual([]);
  expect(entries).toHaveLength(21);
  for (const type of ENTRY_TYPES) {
    expect(entries.filter((entry) => entry.type === type)).toHaveLength(3);
  }
});
