// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { splitFrontmatter } from '../../src/content/frontmatter';
import { parseHtml } from './html';
import { renderPjDraft } from './pj-draft';
import { extractPosts } from './thread-page';

const THREAD_URL = 'https://asgoria.com.ar/foro/topic/aldric-pruebas-cuentaficticia01';
const page = parseHtml(
  readFileSync(new URL('../__fixtures__/thread-page.html', import.meta.url), 'utf8'),
);
const { posts } = extractPosts(page, 1);
const { slug, markdown, report } = renderPjDraft({
  threadUrl: THREAD_URL,
  posts,
  today: '2026-10-10',
});

const PLAYER_ENTRY = '### 2021-03-11 · Jugador de Prueba (@jugador-prueba)';
const DM_ENTRY = '### 2021-03-10 · Narradora Ficticia (@narradora-ficticia)';

describe('renderPjDraft', () => {
  it('names the draft after the character', () => {
    expect(slug).toBe('aldric-pruebas');
  });

  it('writes the frontmatter of a pj, readable by the app', () => {
    const split = splitFrontmatter(markdown);
    expect(split.ok && split.frontmatter).toEqual({
      type: 'pj',
      title: 'Aldric Pruebas',
      aliases: ['Aldric'],
      cuenta_nwn: 'CuentaFicticia01',
      sexo: 'Masculino',
      raza: 'Semiorco',
      clases: ['Guerrero', 'Explorador'],
      alineamiento: 'Legal Bueno',
      deidad: 'Diosa Ficticia de las Pruebas',
      estado: 'activo',
      hilo: THREAD_URL,
      importado: '2026-10-10',
      tags: ['importado'],
    });
    expect(markdown).toContain('estado: activo # provisional: el DM lo revisa\n');
  });

  it('puts the sheet first and then the history', () => {
    const order = [
      '## Descripción Física',
      '## Origen',
      '## Objetivos',
      '## Otras Notas',
      '## Otros datos',
      '## Historial',
    ].map((heading) => markdown.indexOf(`\n${heading}\n`));
    expect(order.every((position, index) => position > (order[index - 1] ?? 0))).toBe(true);
  });

  it('lists the history newest first, headed by date, name and @usuario only', () => {
    expect(markdown.indexOf(PLAYER_ENTRY)).toBeGreaterThan(markdown.indexOf('## Historial'));
    expect(markdown.indexOf(PLAYER_ENTRY)).toBeLessThan(markdown.indexOf(DM_ENTRY));
    const headings = markdown.split('\n').filter((line) => line.startsWith('### 2'));
    expect(headings).toEqual([PLAYER_ENTRY, DM_ENTRY]);
  });

  it('shows no roles anywhere', () => {
    expect(markdown).not.toMatch(/Staff|· DM\b|usergroup/);
  });

  it('adds the edit line only to edited entries, after their text', () => {
    const player = markdown.slice(markdown.indexOf(PLAYER_ENTRY), markdown.indexOf(DM_ENTRY));
    expect(player.trimEnd().endsWith('_Editado el 12/03/2021 por Narradora Ficticia_')).toBe(true);
    expect(markdown.match(/_Editado el /g)).toHaveLength(1);
  });

  it('separates entries with a blank line and nothing else', () => {
    expect(markdown).toContain(`\n\n${DM_ENTRY}\n\n`);
    expect(markdown.split('\n').filter((line) => line === '---')).toHaveLength(2);
  });

  it('leaves no signature, forum chrome, HTML or personal data', () => {
    expect(markdown).not.toMatch(
      /Firma|thumbs|Click to report|Last edited|class=|<div|<span|COPIA OCULTA|Le gusta a/,
    );
    expect(markdown).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    expect(markdown).not.toMatch(/#\d{4}\b|aldric_ficticio|jugador_viejo|discord/i);
    expect(markdown).toContain('[email eliminado]');
  });

  it('reports what a DM has to review', () => {
    expect(report).toMatchObject({
      entries: 2,
      newest: '2021-03-11',
      oldest: '2021-03-10',
      edited: [3],
      discordPastes: [2],
      quotes: [3],
      unknownLabels: ['Color favorito'],
      discardedLabels: ['Tu correo electrónico', 'Usuario de Discord o Foro (opcional)'],
      missingFields: [],
      oddPosts: [],
    });
    expect(report.images.map(({ post, image }) => [post, image.status])).toEqual([
      [3, 'repaired'],
      [3, 'unavailable'],
    ]);
  });

  it('needs post #1, the character sheet', () => {
    expect(() =>
      renderPjDraft({ threadUrl: THREAD_URL, posts: posts.slice(1), today: '2026-10-10' }),
    ).toThrow('falta el post #1');
  });
});
