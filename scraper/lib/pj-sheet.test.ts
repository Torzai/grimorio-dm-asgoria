// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFragment, parseHtml } from './html';
import { labelKey, parseSheet, type PjSheet } from './pj-sheet';
import { extractPosts } from './thread-page';

const page = parseHtml(
  readFileSync(new URL('../__fixtures__/thread-page.html', import.meta.url), 'utf8'),
);
const [formPost] = extractPosts(page, 1).posts;
const sheet = parseSheet(formPost.html);

/** The same form with its fields in reverse order. */
function reversedForm(html: string): string {
  const fragment = parseFragment(html);
  const tables = [...fragment.querySelectorAll('table')];
  const container = fragment.ownerDocument.createElement('div');
  container.append(...tables.reverse());
  return container.innerHTML;
}

const comparable = (result: PjSheet) => ({
  fields: result.fields,
  clases: result.clases,
  sections: result.sections,
  others: result.others,
  discarded: [...result.discarded].sort(),
});

describe('parseSheet', () => {
  it('reads the frontmatter fields by label, ignoring case and accents', () => {
    expect(sheet.fields).toEqual({
      title: 'Aldric Pruebas',
      cuenta_nwn: 'CuentaFicticia01',
      sexo: 'Masculino',
      raza: 'Semiorco',
      alineamiento: 'Legal Bueno',
      deidad: 'Diosa Ficticia de las Pruebas',
    });
  });

  it('gives the same result whatever the order of the fields', () => {
    expect(comparable(parseSheet(reversedForm(formPost.html)))).toEqual(comparable(sheet));
  });

  it('collects the classes in order, without "No sé..." or empty answers', () => {
    expect(sheet.clases).toEqual(['Guerrero', 'Explorador']);
  });

  it('turns the long answers into sections with the headings of config.ts', () => {
    expect(sheet.sections).toEqual([
      { heading: 'Descripción Física', markdown: 'Alto y fornido, con una cicatriz.' },
      { heading: 'Origen', markdown: 'Nació en una aldea inventada.\n\nCreció entre pruebas.' },
      { heading: 'Objetivos', markdown: 'Superar todos los tests.' },
      {
        heading: 'Otras Notas',
        markdown:
          'Hermano de [@Otro-Jugador](https://asgoria.com.ar/foro/profile/otro-jugador/). ' +
          'Para dudas: [email eliminado]',
      },
    ]);
  });

  it('keeps unknown labels for "Otros datos"', () => {
    expect(sheet.others).toEqual([{ label: 'Color favorito', markdown: 'Verde' }]);
  });

  it('drops the email and Discord answers, keeping only their labels for the report', () => {
    expect(sheet.discarded).toEqual([
      'Tu correo electrónico',
      'Usuario de Discord o Foro (opcional)',
    ]);
    const everything = JSON.stringify(sheet);
    expect(everything).not.toContain('jugador.ficticio@example.com');
    expect(everything).not.toContain('aldric_ficticio');
    expect(everything).not.toContain('aldric.contacto@example.org');
  });
});

describe('labelKey', () => {
  it('ignores case, accents, "(opcional)", extra spaces and a trailing colon', () => {
    expect(labelKey('Descripción Física (opcional):')).toBe('descripcion fisica');
    expect(labelKey('CLASE   Terciaria')).toBe('clase terciaria');
  });
});
