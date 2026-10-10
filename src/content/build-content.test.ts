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

describe('buildContent performance', () => {
  const TYPES = ['npc', 'zona', 'lore', 'varita', 'comando', 'herramienta', 'sesion'] as const;
  const EXTRA: Record<(typeof TYPES)[number], string> = {
    npc: 'faccion: Gremio\nraza: Humano\nclase: Pícaro\n',
    zona: 'region: Costa\n',
    lore: 'categoria: historia\n',
    varita: 'cargas: 5\nnivel_lanzador: 9\nrecarga: true\n',
    comando: 'sintaxis: "/comando"\nambito: dm\n',
    herramienta: 'uso: Preparar partidas\n',
    sesion: 'fecha: 2026-03-14\n',
  };
  const COUNT = 500;
  const slugOf = (i: number) => `${TYPES[i % TYPES.length]}-sintetica-${i}`;
  const zonaOf = (i: number) => slugOf(Math.floor(i / TYPES.length) * TYPES.length + 1);

  function syntheticFiles(): Record<string, string> {
    const files: Record<string, string> = {};
    for (let i = 0; i < COUNT; i++) {
      const type = TYPES[i % TYPES.length];
      const body = Array.from(
        { length: 6 },
        (_, p) =>
          `## Sección ${p}\n\nTexto de relleno número ${i}-${p} que menciona [[Ficha sintética ${(i * 7 + p) % COUNT}]] y sigue un poco más para parecer una ficha real.`,
      ).join('\n\n');
      files[`content/${type}/${slugOf(i)}.md`] =
        `---\ntype: ${type}\ntitle: Ficha sintética ${i}\naliases: [alias-${i}]\n` +
        `tags: [ejemplo, grupo-${i % 10}]\nresumen: Resumen de la ficha ${i}\n` +
        `zona: ${zonaOf(i)}\nrelacionados: [${slugOf((i + 1) % COUNT)}]\n${EXTRA[type]}---\n${body}\n`;
    }
    return files;
  }

  it('builds 500 entries in under a second (RNF-02)', () => {
    const files = syntheticFiles();
    const start = performance.now();
    const { entries, issues } = buildContent(files);
    const elapsed = performance.now() - start;
    console.info(`buildContent: ${elapsed.toFixed(1)} ms for ${entries.length} entries`);

    expect(entries).toHaveLength(COUNT);
    expect(issues.filter((issue) => issue.level === 'error')).toEqual([]);
    // Vitest mirrors process.env into import.meta.env; shared CI runners are slower.
    expect(elapsed).toBeLessThan(import.meta.env.CI ? 3000 : 1000);
  });
});
