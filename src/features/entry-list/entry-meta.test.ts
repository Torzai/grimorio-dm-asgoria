// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildContent } from '@/content/build-content';
import { getZoneTitles } from '@/content/content-queries';
import type { Entry } from '@/content/types';
import { formatDate, getEntryMeta } from './entry-meta';

const { entries } = buildContent({
  'content/zona/puerto.md': '---\ntype: zona\ntitle: Puerto de Ejemplo\n---\n',
  'content/npc/tobias.md':
    '---\ntype: npc\ntitle: Tobías\nzona: puerto\nfaccion: Gremio de Ejemplo\n---\n',
  'content/npc/solo-zona.md': '---\ntype: npc\ntitle: Solo zona\nzona: puerto\n---\n',
  'content/npc/solo-faccion.md': '---\ntype: npc\ntitle: Solo facción\nfaccion: Gremio\n---\n',
  'content/npc/nada.md': '---\ntype: npc\ntitle: Nada\n---\n',
  'content/npc/perdido.md': '---\ntype: npc\ntitle: Perdido\nzona: no-existe\n---\n',
  'content/lore/culto.md':
    '---\ntype: lore\ntitle: Culto\ncategoria: religion\nzona: puerto\n---\n',
  'content/sesion/uno.md': '---\ntype: sesion\ntitle: Uno\nfecha: 2026-01-10\nzona: puerto\n---\n',
  'content/varita/luz.md': '---\ntype: varita\ntitle: Luz\nzona: puerto\n---\n',
  'content/comando/clima.md':
    '---\ntype: comando\ntitle: Clima\nsintaxis: /clima\nambito: dm\n---\n',
});
const zoneTitles = getZoneTitles(entries);

function metaOf(slug: string): string[] {
  const entry: Entry | undefined = entries.find((candidate) => candidate.slug === slug);
  if (!entry) throw new Error(`missing fixture ${slug}`);
  return getEntryMeta(entry, zoneTitles);
}

describe('getEntryMeta', () => {
  it('shows the zona title and the faction of an NPC', () => {
    expect(metaOf('tobias')).toEqual(['Puerto de Ejemplo', 'Gremio de Ejemplo']);
  });

  it('leaves out what the NPC does not have', () => {
    expect(metaOf('solo-zona')).toEqual(['Puerto de Ejemplo']);
    expect(metaOf('solo-faccion')).toEqual(['Gremio']);
    expect(metaOf('nada')).toEqual([]);
  });

  it('falls back to the slug when the zona has no entry', () => {
    expect(metaOf('perdido')).toEqual(['no-existe']);
  });

  it('shows the category of lore', () => {
    expect(metaOf('culto')).toEqual(['Puerto de Ejemplo', 'Religión']);
  });

  it('shows the date of a session', () => {
    expect(metaOf('uno')).toEqual(['Puerto de Ejemplo', '10 ene 2026']);
  });

  it('shows only the zona for the other types', () => {
    expect(metaOf('luz')).toEqual(['Puerto de Ejemplo']);
    expect(metaOf('clima')).toEqual([]);
  });
});

describe('formatDate', () => {
  it('writes a short Spanish date without moving the day', () => {
    expect(formatDate('2026-01-10')).toBe('10 ene 2026');
    expect(formatDate('2026-12-31')).toBe('31 dic 2026');
    expect(formatDate('2026-03-01')).toBe('1 mar 2026');
  });
});
