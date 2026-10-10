import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { buildContent } from '@/content/build-content';
import { ContentContext } from '@/content/use-content';
import { EntryBody } from './EntryBody';

const content = buildContent({
  'content/npc/ana.md': '---\ntype: npc\ntitle: Ana la Herrera\naliases: [La Herrera]\n---\n',
  'content/zona/puerto.md': '---\ntype: zona\ntitle: Puerto de Ejemplo\n---\n',
});

/** Renders a Markdown body as the body of a throwaway entry. */
function renderBody(body: string) {
  const { entries } = buildContent({
    'content/lore/prueba.md': `---\ntype: lore\ntitle: Prueba\ncategoria: otro\n---\n${body}`,
  });
  const entry = entries[0];
  if (!entry) throw new Error('the test entry did not load');
  return render(
    <ContentContext.Provider value={content}>
      <MemoryRouter>
        <EntryBody entry={entry} />
      </MemoryRouter>
    </ContentContext.Provider>,
  );
}

describe('EntryBody links', () => {
  it('turns a wikilink into a router link to the entry', () => {
    renderBody('Habla con [[Ana la Herrera]] y con [[puerto]].');

    const ana = screen.getByRole('link', { name: 'Ana la Herrera' });
    expect(ana.getAttribute('href')).toBe('/npc/ana');
    expect(ana.getAttribute('target')).toBeNull();
    expect(screen.getByRole('link', { name: 'Puerto de Ejemplo' }).getAttribute('href')).toBe(
      '/zona/puerto',
    );
  });

  it('resolves by alias and shows the label of [[target|label]]', () => {
    renderBody('Pregunta a [[la herrera|la dueña]].');
    const link = screen.getByRole('link', { name: 'la dueña' });
    expect(link.getAttribute('href')).toBe('/npc/ana');
  });

  it('shows a broken wikilink as a span that is not a link, with an explanatory title', () => {
    renderBody('Busca a [[Fantasma]] en la costa.');

    expect(screen.queryByRole('link')).toBeNull();
    const broken = screen.getByText('Fantasma');
    expect(broken.tagName).toBe('SPAN');
    expect(broken.getAttribute('title')).toBe(
      'Enlace roto: no existe ninguna ficha con ese nombre',
    );
    expect(broken.getAttribute('href')).toBeNull();
  });

  it('opens external links in a new tab without leaking the opener', () => {
    renderBody('Mira [la wiki](https://example.com/wiki) o [esta](//example.com/otra).');

    for (const name of ['la wiki', 'esta']) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('uses the router for paths of the site and leaves them in the same tab', () => {
    renderBody('Ve a [la lista](/npc?tag=ejemplo).');
    const link = screen.getByRole('link', { name: 'la lista' });
    expect(link.getAttribute('href')).toBe('/npc?tag=ejemplo');
    expect(link.getAttribute('target')).toBeNull();
  });

  it('does not render a javascript: link', () => {
    renderBody('[clic](javascript:alert(1))');
    expect(document.body.innerHTML).not.toContain('javascript:');
  });

  it('resolves a wikilink with an escaped pipe inside a table', () => {
    renderBody('| Quién |\n|---|\n| [[ana\\|la dueña]] |');
    expect(screen.getByRole('link', { name: 'la dueña' }).getAttribute('href')).toBe('/npc/ana');
  });
});

describe('EntryBody elements', () => {
  it('renders the h1 of the Markdown as an h2, so the page keeps a single h1', () => {
    renderBody('# Título\n\n## Sección\n\n### Subsección');

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Título', 'Sección']);
    expect(screen.getByRole('heading', { level: 3, name: 'Subsección' })).toBeTruthy();
  });

  it('puts a GFM table inside a container that scrolls on its own', () => {
    renderBody('| Lugar | Qué hay |\n|---|---|\n| Muelle | Puesto |');

    const table = screen.getByRole('table');
    const container = table.parentElement;
    expect(container?.tagName).toBe('DIV');
    expect(container?.className).toContain('tableScroll');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Lugar', 'Qué hay']);
  });

  it('shows an image as a placeholder and never as an <img>', () => {
    const { container } = renderBody('![Mapa del puerto](mapa.png) y ![](otra.png)');

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Imagen: Mapa del puerto')).toBeTruthy();
    expect(screen.getByText('Imagen')).toBeTruthy();
  });

  it('renders code, quotes, lists and strikethrough', () => {
    const { container } = renderBody(
      'Usa `/clima` ahora.\n\n```\nlinea larga\n```\n\n> "Ni lo sueñes."\n\n- uno\n- ~~dos~~',
    );

    expect(container.querySelector('p code')?.textContent).toBe('/clima');
    expect(container.querySelector('pre code')?.textContent).toBe('linea larga\n');
    expect(container.querySelector('blockquote')?.textContent).toContain('Ni lo sueñes.');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(container.querySelector('del')?.textContent).toBe('dos');
  });

  it('does not render raw HTML', () => {
    const { container } = renderBody('Hola <b>negrita</b> <script>alert(1)</script> <img src=x>');

    expect(container.querySelector('b, script, img')).toBeNull();
  });

  it('says so when the entry has no text', () => {
    renderBody('\n  \n');
    expect(screen.getByText('Esta ficha todavía no tiene texto.')).toBeTruthy();
  });
});
