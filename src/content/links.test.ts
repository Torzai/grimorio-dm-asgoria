// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { analyzeLinks, createResolver, extractWikilinks } from './links';
import { loadEntries } from './loader';

function md(frontmatter: string, body = ''): string {
  return `---\n${frontmatter}\n---\n${body}`;
}

/** Loads valid fixture files; fails the test if the loader reports anything. */
function entriesOf(files: Record<string, string>) {
  const { entries, issues } = loadEntries(files);
  expect(issues).toEqual([]);
  return entries;
}

const BASE = {
  'content/npc/tobias.md': md(
    'type: npc\ntitle: Tobías el Mercader\naliases: [Tobi el Tuerto]\nzona: puerto',
  ),
  'content/zona/puerto.md': md('type: zona\ntitle: Puerto Gris\naliases: [Los Muelles]'),
  'content/lore/gremio.md': md('type: lore\ntitle: Gremio\ncategoria: faccion'),
};

describe('createResolver', () => {
  const resolve = createResolver(entriesOf(BASE));
  const slugOf = (target: string) => resolve(target)?.slug ?? null;

  it.each([
    ['tobias', 'tobias'],
    ['Tobías el Mercader', 'tobias'],
    ['TOBIAS EL MERCADER', 'tobias'],
    ['tobi el tuerto', 'tobias'],
    ['  Puerto Gris ', 'puerto'],
    ['los múelles', 'puerto'],
    ['GREMIO', 'gremio'],
  ])('resolves %j by slug, title or alias, ignoring case and accents', (target, slug) => {
    expect(slugOf(target)).toBe(slug);
  });

  it('returns null when nothing matches', () => {
    expect(resolve('Tobías el Rico')).toBeNull();
    expect(resolve('')).toBeNull();
  });

  it('prefers slug over title and title over alias', () => {
    const entries = entriesOf({
      'content/npc/tobi.md': md('type: npc\ntitle: Otro nombre'),
      'content/npc/zeta.md': md('type: npc\ntitle: Tobi\naliases: [Faro]'),
      'content/zona/alfa.md': md('type: zona\ntitle: Faro\naliases: [Tobi]'),
    });
    const resolveName = createResolver(entries);
    expect(resolveName('Tobi')?.slug).toBe('tobi');
    expect(resolveName('Faro')?.slug).toBe('alfa');
  });
});

describe('extractWikilinks', () => {
  it('finds links in text, lists, emphasis and tables', () => {
    const body = [
      'Hola [[A]] y [[b|be]].',
      '',
      '- *[[C]]*',
      '',
      '| x | y |',
      '|---|---|',
      '| 1 | [[d\\|De]] |',
    ].join('\n');
    expect(extractWikilinks(body)).toEqual(['A', 'b', 'C', 'd']);
  });

  it('ignores links inside code blocks and inline code', () => {
    const body = ['Uso: `[[inline]]` y [[real]].', '', '```', '[[bloque]]', '```', '', '    [[sangrado]]'].join(
      '\n',
    );
    expect(extractWikilinks(body)).toEqual(['real']);
  });
});

describe('analyzeLinks', () => {
  it('builds outgoing links and backlinks without duplicates or self-links', () => {
    const entries = entriesOf({
      ...BASE,
      'content/sesion/s1.md': md(
        'type: sesion\ntitle: S1\nfecha: 2026-01-10\nrelacionados: [tobias]',
        '[[Tobi el Tuerto]] en [[Puerto Gris]] con [[tobias]] y [[S1]].',
      ),
      'content/sesion/s2.md': md('type: sesion\ntitle: S2\nfecha: 2026-02-07', '[[Tobías el Mercader]]'),
    });
    const { outgoing, backlinks, issues } = analyzeLinks(entries);

    expect(issues).toEqual([]);
    expect(outgoing.get('s1')).toEqual(['tobias', 'puerto', 's1']);
    expect(outgoing.get('gremio')).toEqual([]);
    expect(backlinks.get('tobias')).toEqual(['s1', 's2']);
    expect(backlinks.get('puerto')).toEqual(['s1']);
    expect(backlinks.get('s1')).toEqual([]);
  });

  it('counts relacionados as links in both directions of the graph', () => {
    const entries = entriesOf({
      ...BASE,
      'content/lore/gremio.md': md('type: lore\ntitle: Gremio\ncategoria: faccion\nrelacionados: [tobias]'),
    });
    const { outgoing, backlinks } = analyzeLinks(entries);
    expect(outgoing.get('gremio')).toEqual(['tobias']);
    expect(backlinks.get('tobias')).toEqual(['gremio']);
  });

  it('groups entries by the zona they point to', () => {
    const entries = entriesOf({
      ...BASE,
      'content/zona/mina.md': md('type: zona\ntitle: Mina\nzona: puerto'),
      'content/lore/faro.md': md('type: lore\ntitle: Faro\ncategoria: otro\nzona: mina'),
    });
    const { byZona } = analyzeLinks(entries);
    expect(Object.fromEntries(byZona)).toEqual({
      mina: ['faro'],
      puerto: ['tobias', 'mina'],
    });
  });

  it('resolves a wikilink written with \\| inside a GFM table', () => {
    const entries = entriesOf({
      ...BASE,
      'content/lore/gremio.md': md(
        'type: lore\ntitle: Gremio\ncategoria: faccion',
        '| Miembro | Dónde |\n|---|---|\n| [[tobias\\|Tobi]] | [[puerto\\|el puerto]] |\n',
      ),
    });
    const { outgoing, issues } = analyzeLinks(entries);
    expect(issues).toEqual([]);
    expect(outgoing.get('gremio')).toEqual(['tobias', 'puerto']);
  });

  it('warns once per broken link, quoting it as written', () => {
    const entries = entriesOf({
      ...BASE,
      'content/lore/gremio.md': md(
        'type: lore\ntitle: Gremio\ncategoria: faccion',
        '[[Tobías el Rico]] y [[Tobías el Rico|otra vez]], pero `[[en código]]` no cuenta.',
      ),
    });
    expect(analyzeLinks(entries).issues).toEqual([
      {
        path: 'content/lore/gremio.md',
        level: 'warning',
        message:
          'enlace roto: [[Tobías el Rico]] no coincide con el nombre de fichero, el título ni ningún alias de otra ficha',
      },
    ]);
  });

  it('warns about zona and relacionados references that do not exist', () => {
    const entries = entriesOf({
      ...BASE,
      'content/lore/gremio.md': md(
        'type: lore\ntitle: Gremio\ncategoria: faccion\nzona: puerto-perdido\nrelacionados: [puerto, fantasma]',
      ),
    });
    const { issues, outgoing } = analyzeLinks(entries);
    expect(issues).toEqual([
      {
        path: 'content/lore/gremio.md',
        level: 'warning',
        field: 'relacionados',
        message: "'relacionados' incluye 'fantasma', pero no hay ninguna ficha con ese nombre de fichero",
      },
      {
        path: 'content/lore/gremio.md',
        level: 'warning',
        field: 'zona',
        message: "'zona' apunta a 'puerto-perdido', pero no hay ninguna ficha con ese nombre de fichero",
      },
    ]);
    expect(outgoing.get('gremio')).toEqual(['puerto']);
  });

  it('warns when zona points to an entry that is not a zona', () => {
    const entries = entriesOf({
      ...BASE,
      'content/lore/gremio.md': md('type: lore\ntitle: Gremio\ncategoria: faccion\nzona: tobias'),
    });
    const { issues, byZona } = analyzeLinks(entries);
    expect(issues).toEqual([
      {
        path: 'content/lore/gremio.md',
        level: 'warning',
        field: 'zona',
        message: "'zona' apunta a 'tobias', que es una ficha de tipo npc, no una zona",
      },
    ]);
    expect(byZona.has('tobias')).toBe(false);
  });

  it('warns about ambiguous names in every entry involved, saying which one wins', () => {
    const entries = entriesOf({
      'content/zona/faro-b.md': md('type: zona\ntitle: El Faro'),
      'content/lore/faro-a.md': md('type: lore\ntitle: El faro\ncategoria: otro'),
      'content/npc/vigia.md': md('type: npc\ntitle: Vigía\naliases: [el FARO]'),
    });
    const { issues, resolve } = analyzeLinks(entries);
    expect(resolve('el faro')?.slug).toBe('faro-a');
    expect(issues).toEqual([
      {
        path: 'content/lore/faro-a.md',
        level: 'warning',
        field: 'title',
        message:
          "nombre ambiguo: 'El faro' también lo usan content/zona/faro-b.md, content/npc/vigia.md; [[El faro]] lleva a esta ficha",
      },
      {
        path: 'content/zona/faro-b.md',
        level: 'warning',
        field: 'title',
        message:
          "nombre ambiguo: 'El Faro' también lo usan content/lore/faro-a.md, content/npc/vigia.md; [[El Faro]] lleva a content/lore/faro-a.md; para enlazar esta usa [[faro-b]]",
      },
      {
        path: 'content/npc/vigia.md',
        level: 'warning',
        field: 'aliases',
        message:
          "nombre ambiguo: 'el FARO' también lo usan content/lore/faro-a.md, content/zona/faro-b.md; [[el FARO]] lleva a content/lore/faro-a.md; para enlazar esta usa [[vigia]]",
      },
    ]);
  });

  it('does not treat a title repeated as alias of the same entry as ambiguous', () => {
    const entries = entriesOf({
      'content/npc/ana.md': md('type: npc\ntitle: Ana\naliases: [ana, Anita]'),
    });
    expect(analyzeLinks(entries).issues).toEqual([]);
  });
});
