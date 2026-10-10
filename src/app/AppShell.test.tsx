import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { buildContent } from '@/content/build-content';
import { ContentContext } from '@/content/use-content';
import { routes } from './router';

const content = buildContent({
  'content/npc/ana.md': '---\ntype: npc\ntitle: Ana la Herrera\n---\n',
  'content/npc/bruno.md': '---\ntype: npc\ntitle: Bruno\n---\n',
  'content/zona/puerto.md': '---\ntype: zona\ntitle: Puerto\n---\n',
  'content/sesion/primera.md': '---\ntype: sesion\ntitle: Primera\nfecha: 2026-01-10\n---\n',
});

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <ContentContext.Provider value={content}>
      <RouterProvider router={router} />
    </ContentContext.Provider>,
  );
  return router;
}

describe('AppShell', () => {
  it('lists the 7 types in order with their entry counts', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Categorías' });
    const links = within(nav).getAllByRole('link');

    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'NPCs, 2 fichas',
      'Zonas y mapas, 1 ficha',
      'Lore y facciones, 0 fichas',
      'Varitas, 0 fichas',
      'Comandos, 0 fichas',
      'Herramientas, 0 fichas',
      'Diario de sesiones, 1 ficha',
    ]);
    expect(links.map((link) => link.textContent)).toEqual([
      'NPCs2',
      'Zonas y mapas1',
      'Lore y facciones0',
      'Varitas0',
      'Comandos0',
      'Herramientas0',
      'Diario de sesiones1',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/npc',
      '/zona',
      '/lore',
      '/varita',
      '/comando',
      '/herramienta',
      '/sesion',
    ]);
  });

  it('marks the current type with aria-current, also inside an entry', () => {
    renderAt('/npc/ana');
    const nav = screen.getByRole('navigation', { name: 'Categorías' });
    expect(within(nav).getByRole('link', { name: /^NPCs/ }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(
      within(nav)
        .getByRole('link', { name: /^Zonas/ })
        .hasAttribute('aria-current'),
    ).toBe(false);
  });

  it('has the header, nav and main landmarks and a skip link to main', () => {
    renderAt('/');
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('main').id).toBe('contenido');
    expect(screen.getByRole('link', { name: 'Saltar al contenido' }).getAttribute('href')).toBe(
      '#contenido',
    );
  });

  it('navigates to /buscar?q=… when the header search is submitted', async () => {
    const router = renderAt('/npc');
    const input = screen.getByRole('searchbox', { name: 'Buscar en el grimorio' });

    fireEvent.change(input, { target: { value: '  tobías mercader ' } });
    fireEvent.submit(screen.getByRole('search'));

    expect(await screen.findByRole('heading', { level: 1, name: 'Buscar' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/buscar');
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('tobías mercader');
    expect(screen.getByText('Resultados para «tobías mercader»')).toBeTruthy();
  });
});

describe('routes', () => {
  it('shows the list placeholder with the type label and count', () => {
    renderAt('/npc');
    expect(screen.getByRole('heading', { level: 1, name: 'NPCs' })).toBeTruthy();
    expect(screen.getByText('2 fichas')).toBeTruthy();
    expect(document.title).toBe('NPCs · Grimorio del DM');
  });

  it('shows the entry title', () => {
    renderAt('/npc/ana');
    expect(screen.getByRole('heading', { level: 1, name: 'Ana la Herrera' })).toBeTruthy();
    expect(document.title).toBe('Ana la Herrera · Grimorio del DM');
  });

  it.each([
    ['an unknown type', '/dragones'],
    ['an unknown type with a slug', '/dragones/ana'],
    ['a missing slug', '/npc/no-existe'],
    ['a slug under the wrong type', '/zona/ana'],
    ['a deeper path', '/npc/ana/extra'],
  ])('shows the 404 page for %s', (_case, path) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/');
    expect(document.title).toBe('Página no encontrada · Grimorio del DM');
  });

  it('uses the app name as the home title', () => {
    renderAt('/');
    expect(document.title).toBe('Grimorio del DM');
  });
});
