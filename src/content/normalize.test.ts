// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { normalize, slugify } from './normalize';

describe('normalize', () => {
  it('lowercases, trims and strips diacritics', () => {
    expect(normalize('  Sigründ ')).toBe('sigrund');
    expect(normalize('Tobías ÑANDÚ')).toBe('tobias nandu');
  });
});

describe('slugify', () => {
  it('produces ASCII kebab-case', () => {
    expect(slugify('Tobías, el Mercader!')).toBe('tobias-el-mercader');
    expect(slugify('  --Ana  Pérez--  ')).toBe('ana-perez');
    expect(slugify('Varita nº 3')).toBe('varita-n-3');
  });
});
