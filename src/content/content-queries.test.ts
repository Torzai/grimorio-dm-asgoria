// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildContent } from './build-content';
import { countByType, getEntry, isEntryType } from './content-queries';

const { entries } = buildContent({
  'content/npc/ana.md': '---\ntype: npc\ntitle: Ana\n---\n',
  'content/npc/bruno.md': '---\ntype: npc\ntitle: Bruno\n---\n',
  'content/zona/puerto.md': '---\ntype: zona\ntitle: Puerto\n---\n',
});

describe('isEntryType', () => {
  it('accepts only the known types', () => {
    expect(isEntryType('npc')).toBe(true);
    expect(isEntryType('sesion')).toBe(true);
    expect(isEntryType('dragones')).toBe(false);
    expect(isEntryType('NPC')).toBe(false);
    expect(isEntryType(undefined)).toBe(false);
  });
});

describe('getEntry', () => {
  it('finds an entry by type and slug', () => {
    expect(getEntry(entries, 'npc', 'ana')?.data.title).toBe('Ana');
  });

  it('returns undefined for a missing slug or a slug of another type', () => {
    expect(getEntry(entries, 'npc', 'nadie')).toBeUndefined();
    expect(getEntry(entries, 'zona', 'ana')).toBeUndefined();
  });
});

describe('countByType', () => {
  it('counts every type, including the empty ones', () => {
    expect(countByType(entries)).toEqual({
      npc: 2,
      zona: 1,
      lore: 0,
      varita: 0,
      comando: 0,
      herramienta: 0,
      sesion: 0,
    });
  });
});
