// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseWikilinks } from './wikilinks';

describe('parseWikilinks', () => {
  it('returns plain text untouched', () => {
    expect(parseWikilinks('Sin enlaces [ni] corchetes')).toEqual(['Sin enlaces [ni] corchetes']);
    expect(parseWikilinks('')).toEqual([]);
  });

  it('parses a simple link', () => {
    expect(parseWikilinks('Ver [[Puerto de Ejemplo]].')).toEqual([
      'Ver ',
      { target: 'Puerto de Ejemplo' },
      '.',
    ]);
  });

  it('parses a link with a label', () => {
    expect(parseWikilinks('[[puerto-ejemplo|el puerto]]')).toEqual([
      { target: 'puerto-ejemplo', label: 'el puerto' },
    ]);
  });

  it('parses the escaped \\| form used inside GFM tables', () => {
    expect(parseWikilinks('[[puerto-ejemplo\\|el puerto]]')).toEqual([
      { target: 'puerto-ejemplo', label: 'el puerto' },
    ]);
  });

  it('parses several links on one line', () => {
    expect(parseWikilinks('[[A]] y [[B|be]][[C]]')).toEqual([
      { target: 'A' },
      ' y ',
      { target: 'B', label: 'be' },
      { target: 'C' },
    ]);
  });

  it('keeps empty links as plain text', () => {
    expect(parseWikilinks('a [[]] b [[  ]] c [[ |texto]] [[X]]')).toEqual([
      'a [[]] b [[  ]] c [[ |texto]] ',
      { target: 'X' },
    ]);
  });

  it('trims target and label, and drops an empty label', () => {
    expect(parseWikilinks('[[  Tobías  |  Tobi  ]] [[ Elara | ]]')).toEqual([
      { target: 'Tobías', label: 'Tobi' },
      ' ',
      { target: 'Elara' },
    ]);
  });

  it('only takes the innermost brackets and never spans lines', () => {
    expect(parseWikilinks('[[a [[b]] [[c\nd]]')).toEqual(['[[a ', { target: 'b' }, ' [[c\nd]]']);
  });
});
