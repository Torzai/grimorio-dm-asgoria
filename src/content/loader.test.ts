// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadEntries } from './loader';

function md(frontmatter: string, body = 'Cuerpo.\n'): string {
  return `---\n${frontmatter}\n---\n${body}`;
}

const NPC = md('type: npc\ntitle: Ana de prueba');

/** Loads a single file and returns its issues. */
function issuesOf(path: string, raw: string) {
  return loadEntries({ [path]: raw }).issues;
}

describe('loadEntries', () => {
  it('loads a valid entry and normalizes Vite-style paths', () => {
    const { entries, issues } = loadEntries({
      '/content/npc/ana.md': md('type: npc\ntitle: Ana\naliases: [La Roja]\nzona: puerto', 'Hola\n'),
    });
    expect(issues).toEqual([]);
    expect(entries).toEqual([
      {
        slug: 'ana',
        type: 'npc',
        path: 'content/npc/ana.md',
        data: { type: 'npc', title: 'Ana', aliases: ['La Roja'], zona: 'puerto' },
        body: 'Hola\n',
      },
    ]);
  });

  it('returns entries sorted by path regardless of input order', () => {
    const { entries } = loadEntries({
      'content/zona/b.md': md('type: zona\ntitle: B'),
      'content/npc/c.md': NPC,
      'content/npc/a.md': NPC,
    });
    expect(entries.map((entry) => entry.path)).toEqual([
      'content/npc/a.md',
      'content/npc/c.md',
      'content/zona/b.md',
    ]);
  });

  it('treats empty fields as not written', () => {
    const { entries, issues } = loadEntries({
      'content/npc/ana.md': md('type: npc\ntitle: Ana\nzona:\nfaccion:'),
    });
    expect(issues).toEqual([]);
    expect(entries[0].data).toEqual({ type: 'npc', title: 'Ana' });
  });

  it('reports a missing frontmatter block', () => {
    const issues = issuesOf('content/npc/ana.md', 'Solo cuerpo');
    expect(issues).toMatchObject([{ level: 'error', message: expect.stringContaining('falta la cabecera') }]);
  });

  it('reports a frontmatter that is not a list of fields', () => {
    const issues = issuesOf('content/npc/ana.md', md('- uno\n- dos'));
    expect(issues).toMatchObject([{ level: 'error', message: expect.stringContaining("'campo: valor'") }]);
  });

  it('reports a missing required field and excludes the entry', () => {
    const { entries, issues } = loadEntries({
      'content/comando/tirar.md': md('type: comando\ntitle: Tirar\nambito: dm'),
    });
    expect(entries).toEqual([]);
    expect(issues).toEqual([
      {
        path: 'content/comando/tirar.md',
        level: 'error',
        field: 'sintaxis',
        message: "falta el campo obligatorio 'sintaxis'",
      },
    ]);
  });

  it('reports a missing type', () => {
    const issues = issuesOf('content/npc/ana.md', md('title: Ana'));
    expect(issues).toMatchObject([
      { level: 'error', field: 'type', message: "falta el campo obligatorio 'type'" },
    ]);
  });

  it('reports an unknown type', () => {
    const issues = issuesOf('content/npc/ana.md', md('type: monstruo\ntitle: Ana'));
    expect(issues).toMatchObject([
      { level: 'error', field: 'type', message: expect.stringContaining("tipo desconocido 'monstruo'") },
    ]);
  });

  it.each([
    ['muchas', "'cargas' debe ser un número entero; has puesto 'muchas'"],
    ['2.5', "'cargas' debe ser un número entero; has puesto 2.5"],
    ['-1', "'cargas' no puede ser menor que 0"],
  ])('reports a wrong data type (cargas: %s)', (value, message) => {
    const issues = issuesOf('content/varita/v.md', md(`type: varita\ntitle: V\ncargas: ${value}`));
    expect(issues).toEqual([{ path: 'content/varita/v.md', level: 'error', field: 'cargas', message }]);
  });

  it('reports a list field written as plain text', () => {
    const issues = issuesOf('content/npc/ana.md', md('type: npc\ntitle: Ana\naliases: La Roja'));
    expect(issues).toMatchObject([
      { field: 'aliases', message: "'aliases' debe ser una lista, p. ej. [uno, dos]; has puesto 'La Roja'" },
    ]);
  });

  it('reports a boolean written as text', () => {
    const issues = issuesOf('content/varita/v.md', md('type: varita\ntitle: V\nrecarga: si'));
    expect(issues).toMatchObject([{ field: 'recarga', message: "'recarga' debe ser true o false; has puesto 'si'" }]);
  });

  it('reports an invalid enum value', () => {
    const issues = issuesOf('content/lore/l.md', md('type: lore\ntitle: L\ncategoria: magia'));
    expect(issues).toMatchObject([
      {
        field: 'categoria',
        message:
          "'categoria' debe ser uno de estos valores: historia, faccion, religion, cultura, otro; has puesto 'magia'",
      },
    ]);
  });

  it.each(['14/03/2026', '2026-02-30', '2026-3-14'])('reports a malformed date (%s)', (value) => {
    const issues = issuesOf('content/sesion/s.md', md(`type: sesion\ntitle: S\nfecha: "${value}"`));
    expect(issues).toMatchObject([
      { field: 'fecha', message: expect.stringContaining('formato AAAA-MM-DD') },
    ]);
  });

  it('reports slugs and tags that are not kebab-case', () => {
    const issues = issuesOf(
      'content/npc/ana.md',
      md('type: npc\ntitle: Ana\nzona: Puerto Ejemplo\ntags: [ok, Mal Tag]\nrelacionados: [bien, Mal]'),
    );
    expect(issues.map((issue) => issue.field)).toEqual(['tags', 'zona', 'relacionados']);
    expect(issues[0].message).toBe(
      "cada tag debe ser una palabra en minúsculas, sin tildes y con guiones, p. ej. 'mercader-rico'; has puesto 'Mal Tag'",
    );
  });

  it('drops unknown fields with a warning and keeps the entry', () => {
    const { entries, issues } = loadEntries({
      'content/npc/ana.md': md('type: npc\ntitle: Ana\nfacion: Gremio\nhumor: alegre'),
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].data).not.toHaveProperty('facion');
    expect(issues).toEqual([
      {
        path: 'content/npc/ana.md',
        level: 'warning',
        field: 'facion',
        message: "campo desconocido 'facion' (¿quisiste decir 'faccion'?); se ignora",
      },
      {
        path: 'content/npc/ana.md',
        level: 'warning',
        field: 'humor',
        message: "campo desconocido 'humor'; se ignora",
      },
    ]);
  });

  it('reports a folder that does not match the type', () => {
    const { entries, issues } = loadEntries({ 'content/zona/ana.md': NPC });
    expect(entries).toEqual([]);
    expect(issues).toMatchObject([
      {
        level: 'error',
        field: 'type',
        message: expect.stringContaining("está en la carpeta 'zona' pero su 'type' es 'npc'"),
      },
    ]);
  });

  it('reports entries outside a type folder', () => {
    const issues = issuesOf('content/ana.md', NPC);
    expect(issues).toMatchObject([{ level: 'error', message: expect.stringContaining('content/npc/') }]);
  });

  it('reports duplicated slugs in both files', () => {
    const { entries, issues } = loadEntries({
      'content/npc/ana.md': NPC,
      'content/zona/ana.md': md('type: zona\ntitle: Ana'),
    });
    expect(entries).toEqual([]);
    expect(issues).toMatchObject([
      { path: 'content/npc/ana.md', level: 'error', message: expect.stringContaining('content/zona/ana.md') },
      { path: 'content/zona/ana.md', level: 'error', message: expect.stringContaining('content/npc/ana.md') },
    ]);
  });

  it('reports file names that are not kebab-case', () => {
    const { entries, issues } = loadEntries({ 'content/npc/Ana Pérez.md': NPC });
    expect(entries).toEqual([]);
    expect(issues).toMatchObject([
      { level: 'error', message: expect.stringContaining("p. ej. 'ana-perez.md'") },
    ]);
  });

  it('ignores _templates, _inbox, assets and content/README.md', () => {
    const broken = 'sin cabecera';
    const result = loadEntries({
      'content/_templates/npc.md': broken,
      'content/_inbox/foro/hilo.md': broken,
      'content/npc/_borrador.md': broken,
      'content/assets/notas.md': broken,
      'content/README.md': broken,
      'content/npc/mapa.png': broken,
      'content/npc/ana.md': NPC,
    });
    expect(result.issues).toEqual([]);
    expect(result.entries.map((entry) => entry.slug)).toEqual(['ana']);
  });
});
