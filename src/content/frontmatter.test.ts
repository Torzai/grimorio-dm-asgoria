// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { splitFrontmatter } from './frontmatter';

describe('splitFrontmatter', () => {
  it('separates the YAML block from the body', () => {
    const result = splitFrontmatter('---\ntype: npc\ntitle: Ana\n---\n\n## Qué sabe\nAlgo.\n');
    expect(result).toEqual({
      ok: true,
      frontmatter: { type: 'npc', title: 'Ana' },
      body: '## Qué sabe\nAlgo.\n',
    });
  });

  it('keeps ISO dates as strings', () => {
    const result = splitFrontmatter('---\nfecha: 2026-03-14\n---\n');
    expect(result).toMatchObject({ ok: true, frontmatter: { fecha: '2026-03-14' } });
  });

  it('accepts an empty block', () => {
    expect(splitFrontmatter('---\n---\nCuerpo')).toEqual({
      ok: true,
      frontmatter: null,
      body: 'Cuerpo',
    });
  });

  it('fails when the --- block is missing', () => {
    const result = splitFrontmatter('type: npc\ntitle: Ana\n');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('falta la cabecera');
  });

  it('fails when the block is not closed', () => {
    const result = splitFrontmatter('---\ntype: npc\ntitle: Ana\n');
    expect(!result.ok && result.error).toContain('no está cerrada');
  });

  it('reports broken YAML with the file line', () => {
    const result = splitFrontmatter('---\ntype: npc\ntitle: "Ana\n---\n');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/la cabecera tiene un error en la línea \d+/);
  });

  it('reports duplicated fields', () => {
    const result = splitFrontmatter('---\ntitle: Ana\ntitle: Otra\n---\n');
    expect(!result.ok && result.error).toContain('en la línea 3: hay un campo repetido');
  });

  it('tolerates CRLF line endings', () => {
    const result = splitFrontmatter('---\r\ntype: npc\r\ntitle: Ana\r\n---\r\nCuerpo\r\n');
    expect(result).toEqual({
      ok: true,
      frontmatter: { type: 'npc', title: 'Ana' },
      body: 'Cuerpo\n',
    });
  });

  it('tolerates a leading BOM', () => {
    const result = splitFrontmatter('\uFEFF---\ntitle: Ana\n---\n');
    expect(result).toMatchObject({ ok: true, frontmatter: { title: 'Ana' } });
  });
});
