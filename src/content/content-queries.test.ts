// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildContent } from './build-content';
import {
  countByType,
  filterKeysFor,
  getEntry,
  getEntryContext,
  getFilterOptions,
  getZoneTitles,
  isEntryType,
  listEntries,
} from './content-queries';

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

/** One Markdown file; `fields` is the frontmatter after `type` and `title`. */
function file(type: string, slug: string, title: string, fields = ''): [string, string] {
  return [`content/${type}/${slug}.md`, `---\ntype: ${type}\ntitle: ${title}\n${fields}\n---\n`];
}

const world = buildContent(
  Object.fromEntries([
    file('zona', 'puerto', 'Puerto de Ejemplo', 'tags: [costa]'),
    file('zona', 'bosque', 'Bosque', 'tags: [costa, verde]\nzona: puerto'),
    file('npc', 'zoe', 'Zoe', 'zona: puerto\nfaccion: Gremio de Ejemplo\ntags: [mercader, ejemplo]'),
    file('npc', 'alvaro', 'Álvaro', 'zona: bosque\nfaccion: Los Árboles\ntags: [ejemplo]'),
    file('npc', 'alba', 'Alba', 'zona: puerto\nfaccion: Gremio de Ejemplo'),
    // Lowercase title and a zona that has no entry.
    file('npc', 'beto', 'beto', 'zona: perdida\ntags: [mercader]'),
    file('npc', 'zorro', 'zorro'),
    file('lore', 'culto', 'Culto', 'categoria: religion\nzona: puerto'),
    file('lore', 'mito', 'Mito', 'categoria: historia\nzona: puerto\ntags: [ejemplo]'),
    file('sesion', 'uno', 'Zeta', 'fecha: 2026-01-10\nzona: puerto'),
    file('sesion', 'dos', 'Alfa', 'fecha: 2026-03-14'),
    file('sesion', 'tres', 'Beta', 'fecha: 2026-03-14'),
    file('sesion', 'cuatro', 'Gama', 'fecha: 2025-12-31'),
  ]),
).entries;

const slugs = (list: { slug: string }[]) => list.map((entry) => entry.slug);

describe('listEntries', () => {
  it('lists only the entries of the type', () => {
    expect(listEntries(world, 'lore')).toHaveLength(2);
    expect(listEntries(world, 'varita')).toEqual([]);
  });

  it('sorts alphabetically by title, ignoring case and accents', () => {
    // Plain code-point order would put 'Álvaro' and 'beto' after 'Zoe'.
    expect(slugs(listEntries(world, 'npc'))).toEqual(['alba', 'alvaro', 'beto', 'zoe', 'zorro']);
  });

  it('sorts the same whatever order the entries come in', () => {
    expect(slugs(listEntries([...world].reverse(), 'npc'))).toEqual(
      slugs(listEntries(world, 'npc')),
    );
  });

  it('sorts sessions by date, newest first, then by title', () => {
    expect(slugs(listEntries(world, 'sesion'))).toEqual(['dos', 'tres', 'uno', 'cuatro']);
  });

  it('filters by zona slug', () => {
    expect(slugs(listEntries(world, 'npc', { zona: 'puerto' }))).toEqual(['alba', 'zoe']);
  });

  it('filters by faction with the exact text', () => {
    expect(slugs(listEntries(world, 'npc', { faccion: 'Gremio de Ejemplo' }))).toEqual([
      'alba',
      'zoe',
    ]);
    expect(listEntries(world, 'npc', { faccion: 'gremio de ejemplo' })).toEqual([]);
  });

  it('filters by tag', () => {
    expect(slugs(listEntries(world, 'npc', { tag: 'mercader' }))).toEqual(['beto', 'zoe']);
  });

  it('combines the filters with AND', () => {
    expect(slugs(listEntries(world, 'npc', { zona: 'puerto', tag: 'ejemplo' }))).toEqual(['zoe']);
    expect(
      slugs(
        listEntries(world, 'npc', {
          zona: 'puerto',
          faccion: 'Gremio de Ejemplo',
          tag: 'mercader',
        }),
      ),
    ).toEqual(['zoe']);
  });

  it('returns nothing when the filters match no entry', () => {
    expect(listEntries(world, 'npc', { zona: 'puerto', faccion: 'Los Árboles' })).toEqual([]);
    expect(listEntries(world, 'npc', { zona: 'no-existe' })).toEqual([]);
  });

  it('treats an empty value as no filter', () => {
    expect(listEntries(world, 'npc', { zona: '', tag: '' })).toHaveLength(5);
  });

  it('ignores filters that do not apply to the type', () => {
    expect(listEntries(world, 'lore', { faccion: 'Los Árboles' })).toHaveLength(2);
    // The zona of a zona is its parent, and zonas have no zona filter.
    expect(listEntries(world, 'zona', { zona: 'puerto' })).toHaveLength(2);
  });

  it('does not reorder the entries it receives', () => {
    const before = slugs(world);
    listEntries(world, 'npc');
    expect(slugs(world)).toEqual(before);
  });
});

describe('filterKeysFor', () => {
  it('offers faction only to NPCs and no zona filter to zonas', () => {
    expect(filterKeysFor('npc')).toEqual(['zona', 'faccion', 'tag']);
    expect(filterKeysFor('zona')).toEqual(['tag']);
    expect(filterKeysFor('lore')).toEqual(['zona', 'tag']);
    expect(filterKeysFor('sesion')).toEqual(['zona', 'tag']);
  });
});

describe('getZoneTitles', () => {
  it('maps zona slugs to their titles', () => {
    expect(Object.fromEntries(getZoneTitles(world))).toEqual({
      puerto: 'Puerto de Ejemplo',
      bosque: 'Bosque',
    });
  });
});

describe('getFilterOptions', () => {
  it('counts each value and shows zonas by the title of their entry', () => {
    const [zona] = getFilterOptions(world, 'npc');
    expect(zona).toEqual({
      key: 'zona',
      values: [
        { value: 'bosque', label: 'Bosque', count: 1 },
        // No zona entry for this slug: the slug stands in for the title.
        { value: 'perdida', label: 'perdida', count: 1 },
        { value: 'puerto', label: 'Puerto de Ejemplo', count: 2 },
      ],
    });
  });

  it('sorts zonas by title, not by slug', () => {
    const { entries: sorted } = buildContent(
      Object.fromEntries([
        file('zona', 'a', 'Zeta'),
        file('zona', 'z', 'Alfa'),
        file('npc', 'uno', 'Uno', 'zona: a'),
        file('npc', 'dos', 'Dos', 'zona: z'),
      ]),
    );
    expect(getFilterOptions(sorted, 'npc')[0]?.values.map((value) => value.label)).toEqual([
      'Alfa',
      'Zeta',
    ]);
  });

  it('counts factions by their exact text and tags', () => {
    const groups = getFilterOptions(world, 'npc');
    expect(groups.map((group) => group.key)).toEqual(['zona', 'faccion', 'tag']);
    expect(groups[1]?.values).toEqual([
      { value: 'Gremio de Ejemplo', label: 'Gremio de Ejemplo', count: 2 },
      { value: 'Los Árboles', label: 'Los Árboles', count: 1 },
    ]);
    expect(groups[2]?.values).toEqual([
      { value: 'ejemplo', label: 'ejemplo', count: 2 },
      { value: 'mercader', label: 'mercader', count: 2 },
    ]);
  });

  it('has no zona filter in the zona type', () => {
    const groups = getFilterOptions(world, 'zona');
    expect(groups.map((group) => group.key)).toEqual(['tag']);
    expect(groups[0]?.values).toEqual([
      { value: 'costa', label: 'costa', count: 2 },
      { value: 'verde', label: 'verde', count: 1 },
    ]);
  });

  it('has no faction filter outside NPCs', () => {
    expect(getFilterOptions(world, 'lore').map((group) => group.key)).toEqual(['zona', 'tag']);
    expect(getFilterOptions(world, 'sesion').map((group) => group.key)).toEqual(['zona']);
  });

  it('leaves out filters without values', () => {
    expect(getFilterOptions(world, 'varita')).toEqual([]);
    expect(getFilterOptions(world, 'sesion').some((group) => group.key === 'tag')).toBe(false);
  });
});

/** Like file(), with a Markdown body so the entry can link to others. */
function doc(type: string, slug: string, title: string, fields = '', body = ''): [string, string] {
  const [path, source] = file(type, slug, title, fields);
  return [path, `${source}${body}\n`];
}

describe('getEntryContext', () => {
  const content = buildContent(
    Object.fromEntries([
      doc('zona', 'puerto', 'Puerto de Ejemplo', 'relacionados: [gremio]'),
      doc('zona', 'muelle', 'Muelle', 'zona: puerto'),
      doc('zona', 'faro', 'Faro', 'zona: puerto'),
      doc('lore', 'gremio', 'Gremio', 'categoria: faccion\nzona: puerto'),
      doc('lore', 'mito', 'Mito', 'categoria: historia', 'Habla de [[Tobías]] y de [[Gremio]].'),
      // A repeat, the zona itself, the entry itself, a slug with no entry and the same slug again.
      doc(
        'npc',
        'tobias',
        'Tobías',
        'zona: puerto\nrelacionados: [varita, gremio, puerto, tobias, perdida, varita, ana]',
      ),
      doc('npc', 'ana', 'Ana', 'zona: puerto', 'Conoce a [[Tobías]].'),
      doc('npc', 'alvaro', 'Álvaro', 'zona: puerto', 'Compra a [[Tobías]] y a [[Tobías]].'),
      doc('npc', 'zoe', 'Zoe', 'relacionados: [tobias]'),
      doc('npc', 'solo', 'Solo'),
      // Its 'zona' points to an NPC.
      doc('varita', 'varita', 'Varita de chispas', 'zona: tobias', 'La vende [[Tobías]].'),
      doc('sesion', 'vieja', 'Zeta', 'fecha: 2026-01-10\nzona: puerto', 'Llega [[Tobías]].'),
      doc('sesion', 'nueva-b', 'Beta', 'fecha: 2026-03-14', 'Ven a [[Tobías]].'),
      doc('sesion', 'nueva-a', 'Alfa', 'fecha: 2026-03-14', 'Ven a [[Tobías]].'),
      doc('sesion', 'sin-enlace', 'Gama', 'fecha: 2026-04-01', 'No pasa nada.'),
    ]),
  );
  const contextOf = (slug: string, from = content) => {
    const entry = from.entries.find((other) => other.slug === slug);
    if (!entry) throw new Error(`no entry ${slug}`);
    return getEntryContext(entry, from);
  };

  it('returns the zona for the kicker and does not repeat it among the related', () => {
    const context = contextOf('tobias');
    expect(context.zona?.slug).toBe('puerto');
    expect(slugs(context.related)).not.toContain('puerto');
  });

  it('lists the related in frontmatter order, without repeats, itself or broken slugs', () => {
    expect(slugs(contextOf('tobias').related)).toEqual(['varita', 'gremio', 'ana']);
  });

  it('shows a zona that is not a zona among the related instead of in the kicker', () => {
    const context = contextOf('varita');
    expect(context.zona).toBeUndefined();
    expect(slugs(context.related)).toEqual(['tobias']);
  });

  it('has no zona when the field is missing or points to no entry', () => {
    expect(contextOf('solo').zona).toBeUndefined();
    const lost = buildContent(Object.fromEntries([doc('npc', 'beto', 'Beto', 'zona: perdida')]));
    expect(contextOf('beto', lost).zona).toBeUndefined();
    expect(contextOf('beto', lost).related).toEqual([]);
  });

  it('splits the backlinks: sessions apart, the rest sorted by title ignoring accents', () => {
    const context = contextOf('tobias');
    // 'relacionados' counts as a link too, so Zoe is here without mentioning Tobías in the text.
    expect(slugs(context.mentionedIn)).toEqual(['alvaro', 'ana', 'mito', 'varita', 'zoe']);
    expect(context.mentionedIn.every((entry) => entry.type !== 'sesion')).toBe(true);
  });

  it('sorts the sessions newest first, then by title', () => {
    expect(slugs(contextOf('tobias').sessions)).toEqual(['nueva-a', 'nueva-b', 'vieja']);
  });

  it('counts an entry once however many times it links', () => {
    expect(slugs(contextOf('tobias').mentionedIn).filter((slug) => slug === 'alvaro')).toEqual([
      'alvaro',
    ]);
  });

  it('lists the entries of a zona grouped by type, in sidebar order and sorted', () => {
    const { inZone } = contextOf('puerto');
    expect(inZone.map((group) => group.type)).toEqual(['npc', 'zona', 'lore', 'sesion']);
    expect(inZone.map((group) => slugs(group.entries))).toEqual([
      ['alvaro', 'ana', 'tobias'],
      ['faro', 'muelle'],
      ['gremio'],
      ['vieja'],
    ]);
  });

  it('has no "in this zona" groups for other types nor for an empty zona', () => {
    expect(contextOf('tobias').inZone).toEqual([]);
    expect(contextOf('muelle').inZone).toEqual([]);
  });

  it('is empty for an entry nobody links to and that links to nobody', () => {
    expect(contextOf('solo')).toEqual({
      zona: undefined,
      related: [],
      mentionedIn: [],
      sessions: [],
      inZone: [],
    });
  });
});
