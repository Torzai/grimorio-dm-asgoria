// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildContent } from './build-content';
import { search } from './search-index';

describe('buildContent', () => {
  it('loads entries, links them, indexes them and merges every issue', () => {
    const { entries, issues, links, index } = buildContent({
      'content/npc/ana.md': '---\ntype: npc\ntitle: Ana\nzona: puerto\n---\nVive en [[Puerto]] con [[Nadie]].\n',
      'content/zona/puerto.md': '---\ntype: zona\ntitle: Puerto\n---\n',
      'content/zona/roto.md': '---\ntype: zona\n---\n',
    });

    expect(entries.map((entry) => entry.slug)).toEqual(['ana', 'puerto']);
    expect(issues).toEqual([
      {
        path: 'content/zona/roto.md',
        level: 'error',
        field: 'title',
        message: "falta el campo obligatorio 'title'",
      },
      {
        path: 'content/npc/ana.md',
        level: 'warning',
        message:
          'enlace roto: [[Nadie]] no coincide con el nombre de fichero, el título ni ningún alias de otra ficha',
      },
    ]);
    expect(links.backlinks.get('puerto')).toEqual(['ana']);
    expect(links.byZona.get('puerto')).toEqual(['ana']);
    expect(links.resolve('PUERTO')?.slug).toBe('puerto');
    expect(search(index, 'ana').map((result) => result.slug)).toEqual(['ana']);
  });
});
