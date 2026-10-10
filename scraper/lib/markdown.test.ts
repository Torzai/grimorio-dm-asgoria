// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { escapeMarkdown, htmlToMarkdown, redactPersonalData, tidyMarkdown } from './markdown';

describe('redactPersonalData', () => {
  it('replaces anything shaped like an email', () => {
    expect(redactPersonalData('Escribe a nombre.apellido+rol@example.co.uk ya.')).toBe(
      'Escribe a [email eliminado] ya.',
    );
  });

  it('replaces old Discord tags', () => {
    expect(redactPersonalData('Era Jugador_Viejo#1234, ahora otro.')).toBe(
      'Era [usuario eliminado], ahora otro.',
    );
  });

  it('keeps forum mentions, NWN accounts and links to posts', () => {
    const text =
      '@she-wolf y CuentaFicticia01 en <https://asgoria.com.ar/foro/topic/x/?part=2#postid-1979>';
    expect(redactPersonalData(text)).toBe(text);
  });
});

describe('escapeMarkdown', () => {
  it('escapes what would break the outline: headings, quotes, rules, fences', () => {
    expect(escapeMarkdown('# no es un título')).toBe('\\# no es un título');
    expect(escapeMarkdown('> no es una cita')).toBe('\\> no es una cita');
    expect(escapeMarkdown('---')).toBe('\\---');
    expect(escapeMarkdown('===')).toBe('\\===');
    expect(escapeMarkdown('Drak`nar')).toBe('Drak\\`nar');
  });

  it('leaves hand-written lists and inline marks as typed', () => {
    for (const text of ['- Einar: aporta troncos', '1. devolver las monedas', '***El rescate***']) {
      expect(escapeMarkdown(text)).toBe(text);
    }
  });
});

describe('tidyMarkdown', () => {
  it('keeps line breaks inside a paragraph and drops other trailing spaces', () => {
    expect(tidyMarkdown('uno  \ndos   \n\n  \n\n\ntres  \n\ncuatro ')).toBe(
      'uno  \ndos\n\ntres\n\ncuatro',
    );
  });
});

describe('htmlToMarkdown', () => {
  it('turns &nbsp; into normal spaces and drops empty paragraphs', () => {
    expect(htmlToMarkdown('<p>Hola&nbsp;&nbsp;mundo</p><p>&nbsp;</p><p></p><p>Adiós</p>')).toBe(
      'Hola mundo\n\nAdiós',
    );
  });

  it('keeps bold, italics and lists', () => {
    expect(
      htmlToMarkdown('<p><strong>a</strong> y <em>b</em></p><ul><li>c</li><li>d</li></ul>'),
    ).toBe('**a** y _b_\n\n- c\n- d');
    expect(htmlToMarkdown('<ol><li>uno</li><li>dos</li></ol>')).toBe('1. uno\n2. dos');
  });

  it('writes a link whose text is its URL as <url>', () => {
    expect(
      htmlToMarkdown(
        '<p><a href="https://asgoria.com.ar/foro/">https://asgoria.com.ar/foro/</a></p>',
      ),
    ).toBe('<https://asgoria.com.ar/foro/>');
  });

  it('drops the "(editado)" mark Discord leaves at the end of a line', () => {
    expect(htmlToMarkdown('<p>Texto copiado. (editado)<br>Sigue (editado) aquí.</p>')).toBe(
      'Texto copiado.  \nSigue (editado) aquí.',
    );
  });
});
