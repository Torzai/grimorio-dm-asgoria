// @vitest-environment node
import { cwd } from 'node:process';
import { expect, it } from 'vitest';
import { loadContentFromFs } from './load-from-fs';
import { search } from './search-index';
import { ENTRY_TYPES } from './types';

it('builds the example content in content/ without errors or warnings', async () => {
  const { entries, issues, links, index } = await loadContentFromFs(cwd());

  expect(issues).toEqual([]);
  expect(entries).toHaveLength(21);
  for (const type of ENTRY_TYPES) {
    expect(entries.filter((entry) => entry.type === type)).toHaveLength(3);
  }

  // The [[slug\|texto]] inside the puerto-ejemplo table resolves too.
  expect(links.outgoing.get('puerto-ejemplo')).toContain('tobias-mercader-ejemplo');
  expect(links.backlinks.get('tobias-mercader-ejemplo')).toContain('puerto-ejemplo');
  expect(links.byZona.get('bosque-ejemplo')).toEqual([
    'elara-guardabosques-ejemplo',
    'sesion-2026-02-07-ejemplo',
    'mina-ejemplo',
  ]);
  expect(search(index, 'tobyas')[0]?.slug).toBe('tobias-mercader-ejemplo');
});
