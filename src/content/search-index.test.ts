// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadEntries } from './loader';
import { buildIndex, search } from './search-index';
import { ENTRY_TYPES, type Entry } from './types';

function md(frontmatter: string, body = ''): string {
  return `---\n${frontmatter}\n---\n${body}`;
}

const { entries, issues } = loadEntries({
  'content/npc/tobias.md': md(
    'type: npc\ntitle: "Tobías, mercader de ejemplo"\naliases: [Tobi el Tuerto]\ntags: [mercader]\nresumen: Vende varitas en el muelle\nzona: puerto',
    'Regatea por todo.',
  ),
  'content/npc/sigrund.md': md('type: npc\ntitle: Sigründ la Fría', 'Guerrera del norte.'),
  'content/zona/puerto.md': md('type: zona\ntitle: Puerto Gris', 'Barcos y gaviotas.'),
  'content/varita/varita-chispas.md': md('type: varita\ntitle: Varita de chispas', 'Lanza chispas.'),
  'content/varita/varita-niebla.md': md('type: varita\ntitle: Varita de niebla', 'Crea niebla.'),
  'content/lore/dragon-rojo.md': md('type: lore\ntitle: Dragón Rojo\ncategoria: historia', 'Leyenda antigua.'),
  'content/lore/cronica.md': md(
    'type: lore\ntitle: Crónica del norte\ncategoria: historia',
    'Cuentan que un dragón quemó la aldea.',
  ),
});
const index = buildIndex(entries);
const slugs = (query: string, options?: Parameters<typeof search>[2]) =>
  search(index, query, options).map((result) => result.slug);

describe('search', () => {
  it('uses valid fixtures', () => {
    expect(issues).toEqual([]);
  });

  it('returns the stored fields and the score', () => {
    expect(search(index, 'tobias')).toEqual([
      {
        slug: 'tobias',
        type: 'npc',
        title: 'Tobías, mercader de ejemplo',
        resumen: 'Vende varitas en el muelle',
        zona: 'puerto',
        score: expect.any(Number),
      },
    ]);
    expect(search(index, 'puerto gris')[0]).not.toHaveProperty('resumen');
  });

  it('tolerates typos', () => {
    expect(slugs('tobyas')[0]).toBe('tobias');
    expect(slugs('sigrnd')[0]).toBe('sigrund');
  });

  it('finds accented entries with unaccented queries and the other way round', () => {
    expect(slugs('sigrund')).toEqual(['sigrund']);
    expect(slugs('cronica')).toEqual(['cronica']);
    expect(slugs('PUÉRTO')[0]).toBe('puerto');
  });

  it('matches by prefix', () => {
    const results = search(index, 'var');
    expect(results.slice(0, 2).map((result) => result.type)).toEqual(['varita', 'varita']);
    expect(results.map((result) => result.slug)).toContain('tobias');
    expect(slugs('guerr')).toEqual(['sigrund']);
  });

  it('finds entries by alias', () => {
    expect(slugs('Tobi el Tuerto')[0]).toBe('tobias');
    // 'tuerto' is one typo away from 'puerto', so the zona shows up after the alias match.
    expect(slugs('tuerto')).toEqual(['tobias', 'puerto']);
  });

  it('ranks a title match above a body match', () => {
    expect(slugs('dragon')).toEqual(['dragon-rojo', 'cronica']);
  });

  it('filters by type', () => {
    expect(slugs('varita', { type: 'npc' })).toEqual(['tobias']);
    expect(slugs('varita', { type: 'varita' })).toHaveLength(2);
    expect(slugs('varita', { type: 'sesion' })).toEqual([]);
  });

  it('needs every word, but falls back to any word when nothing matches all', () => {
    expect(slugs('varita niebla')).toEqual(['varita-niebla']);
    expect(slugs('niebla chispas').sort()).toEqual(['varita-chispas', 'varita-niebla']);
  });

  it('ignores Spanish stopwords', () => {
    expect(slugs('la crónica del norte')).toEqual(['cronica']);
    expect(slugs('de la')).toEqual([]);
  });

  it('returns nothing for an empty query', () => {
    expect(search(index, '')).toEqual([]);
    expect(search(index, '   ')).toEqual([]);
  });

  it('honours the limit', () => {
    expect(slugs('varita', { limit: 1 })).toHaveLength(1);
  });
});

describe('search performance', () => {
  const SYLLABLES = ['ar', 'bel', 'cor', 'dun', 'el', 'fal', 'gor', 'hal', 'ir', 'jor', 'kal', 'lun'];
  const MORE = ['mar', 'nor', 'os', 'pel', 'quin', 'ras', 'sol', 'tur', 'ur', 'vel', 'xan', 'zor'];
  const ALL = [...SYLLABLES, ...MORE];

  // Deterministic pseudo-random numbers, so every run indexes the same corpus.
  let seed = 42;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
  const word = () => pick(ALL) + pick(ALL) + (random() < 0.5 ? pick(ALL) : '');
  const words = (count: number) => Array.from({ length: count }, word).join(' ');

  const synthetic: Entry[] = Array.from({ length: 2000 }, (_, i): Entry => {
    const type = ENTRY_TYPES[i % ENTRY_TYPES.length];
    return {
      slug: `ficha-${i}`,
      type,
      path: `content/${type}/ficha-${i}.md`,
      // The index only reads the common fields, so one data shape serves every type.
      data: {
        type: 'lore',
        categoria: 'otro',
        title: `${word()} ${word()}`,
        aliases: [word()],
        tags: [word(), word()],
        resumen: words(10),
        zona: `zona-${i % 50}`,
      },
      body: Array.from({ length: 4 }, () => words(40)).join('\n\n'),
    };
  });

  it('answers in under 50 ms on average with 2,000 entries', () => {
    const syntheticIndex = buildIndex(synthetic);
    const queries = [
      synthetic[10].data.title,
      synthetic[500].data.title.slice(0, 4),
      synthetic[999].data.aliases?.[0] ?? '',
      'corbel',
      'cor',
      'a',
      'mar nor',
      'zorvel quin',
      'velxan',
      'turos dunel',
      'belcor halir lunar',
      'ir',
      'kalmar',
      'gorfal',
      'pelras',
      'urzor',
      'el jorkal',
      'xanxan',
      'solsol',
      'fal',
    ];
    const options = [{}, { type: 'npc' as const }, { limit: 5 }, {}];

    const times = queries.map((query, i) => {
      const start = performance.now();
      search(syntheticIndex, query, options[i % options.length]);
      return performance.now() - start;
    });
    const mean = times.reduce((sum, time) => sum + time, 0) / times.length;
    console.info(
      `search: mean ${mean.toFixed(2)} ms, max ${Math.max(...times).toFixed(2)} ms over ${times.length} queries`,
    );

    // Vitest mirrors process.env into import.meta.env; shared CI runners are slower.
    expect(mean).toBeLessThan(import.meta.env.CI ? 150 : 50);
  });
});
