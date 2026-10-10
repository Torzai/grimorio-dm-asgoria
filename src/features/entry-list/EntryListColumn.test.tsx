import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, useParams } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { buildContent } from '@/content/build-content';
import { isEntryType } from '@/content/content-queries';
import { ContentContext } from '@/content/use-content';
import { EntryListColumn } from './EntryListColumn';

const content = buildContent({
  'content/zona/puerto.md': '---\ntype: zona\ntitle: Puerto de Ejemplo\n---\n',
  'content/zona/mina.md': '---\ntype: zona\ntitle: Mina de Ejemplo\ntags: [subterraneo]\n---\n',
  'content/npc/tobias.md': [
    '---',
    'type: npc',
    'title: Tobías, mercader',
    'resumen: Vende varitas en el puerto',
    'zona: puerto',
    'faccion: Gremio de Ejemplo',
    'tags: [mercader]',
    '---',
  ].join('\n'),
  'content/npc/brom.md':
    '---\ntype: npc\ntitle: Brom, capataz\nzona: mina\nfaccion: Gremio de Ejemplo\n---\n',
  'content/npc/elara.md': '---\ntype: npc\ntitle: Elara\ntags: [mercader]\n---\n',
  'content/sesion/vieja.md': '---\ntype: sesion\ntitle: Vieja\nfecha: 2026-01-10\n---\n',
  'content/sesion/nueva.md': '---\ntype: sesion\ntitle: Nueva\nfecha: 2026-03-14\n---\n',
});

function Probe() {
  const { type, slug } = useParams();
  return isEntryType(type) ? <EntryListColumn type={type} activeSlug={slug} /> : null;
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/:type', element: <Probe /> },
      { path: '/:type/:slug', element: <Probe /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <ContentContext.Provider value={content}>
      <RouterProvider router={router} />
    </ContentContext.Provider>,
  );
  return router;
}

const cardTitles = () =>
  within(screen.getByRole('list'))
    .getAllByRole('link')
    .map((link) => link.querySelector('span')?.textContent);

const zonaSelect = () => screen.getByRole('combobox', { name: 'Filtrar por zona' });
const searchOf = (router: ReturnType<typeof renderAt>) =>
  new URLSearchParams(router.state.location.search);

describe('EntryListColumn', () => {
  it('lists the cards of the type in alphabetical order, with the count line', () => {
    renderAt('/npc');
    expect(cardTitles()).toEqual(['Brom, capataz', 'Elara', 'Tobías, mercader']);
    expect(screen.getByText('3 fichas · orden alfabético')).toBeTruthy();
  });

  it('shows zona, faction and summary on a card, and links to the entry', () => {
    renderAt('/npc');
    const card = screen.getByRole('link', { name: /Tobías/ });
    expect(card.getAttribute('href')).toBe('/npc/tobias');
    expect(card.textContent).toBe(
      'Tobías, mercaderPuerto de Ejemplo · Gremio de EjemploVende varitas en el puerto',
    );
  });

  it('orders the journal from the newest session and says so', () => {
    renderAt('/sesion');
    expect(cardTitles()).toEqual(['Nueva', 'Vieja']);
    expect(screen.getByText('2 fichas · orden cronológico')).toBeTruthy();
  });

  it('has an active "Todos" chip and one select chip per filter with values', () => {
    renderAt('/npc');
    expect(screen.getByRole('button', { name: 'Todos', pressed: true })).toBeTruthy();
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
    expect(
      within(zonaSelect())
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Zona: todas', 'Mina de Ejemplo (1)', 'Puerto de Ejemplo (1)']);
    expect(
      within(screen.getByRole('combobox', { name: 'Filtrar por facción' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Facción: todas', 'Gremio de Ejemplo (2)']);
    expect(screen.getByRole('combobox', { name: 'Filtrar por tag' })).toBeTruthy();
  });

  it('offers no zona filter among zonas and no faction filter outside NPCs', () => {
    renderAt('/zona');
    expect(screen.queryByRole('combobox', { name: 'Filtrar por zona' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Filtrar por facción' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Filtrar por tag' })).toBeTruthy();
  });

  it('puts the chosen filter in the URL and narrows the list', async () => {
    const router = renderAt('/npc');
    fireEvent.change(zonaSelect(), { target: { value: 'puerto' } });

    await waitFor(() => expect(cardTitles()).toEqual(['Tobías, mercader']));
    expect(router.state.location.search).toBe('?zona=puerto');
    expect(screen.getByText('1 de 3 fichas · orden alfabético')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Todos', pressed: false })).toBeTruthy();
    expect((zonaSelect() as HTMLSelectElement).value).toBe('puerto');
    expect(zonaSelect().closest('span')?.hasAttribute('data-active')).toBe(true);
  });

  it('combines filters', async () => {
    const router = renderAt('/npc?zona=puerto');
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por tag' }), {
      target: { value: 'mercader' },
    });
    await waitFor(() => expect(searchOf(router).get('tag')).toBe('mercader'));
    expect(searchOf(router).get('zona')).toBe('puerto');
    expect(cardTitles()).toEqual(['Tobías, mercader']);
  });

  it('reads the filters from the URL, also with spaces and accents', () => {
    renderAt('/npc?faccion=Gremio%20de%20Ejemplo&tag=mercader');
    expect(cardTitles()).toEqual(['Tobías, mercader']);
    expect(
      (screen.getByRole('combobox', { name: 'Filtrar por facción' }) as HTMLSelectElement).value,
    ).toBe('Gremio de Ejemplo');
  });

  it('writes a faction with spaces so that it reads back unchanged', async () => {
    const router = renderAt('/npc');
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por facción' }), {
      target: { value: 'Gremio de Ejemplo' },
    });
    await waitFor(() => expect(cardTitles()).toEqual(['Brom, capataz', 'Tobías, mercader']));
    expect(searchOf(router).get('faccion')).toBe('Gremio de Ejemplo');
  });

  it('"Todos" clears every filter and leaves other query params alone', async () => {
    const router = renderAt('/npc?zona=puerto&tag=mercader&x=1');
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));

    await waitFor(() => expect(cardTitles()).toHaveLength(3));
    expect(router.state.location.search).toBe('?x=1');
    expect(screen.getByRole('button', { name: 'Todos', pressed: true })).toBeTruthy();
  });

  it('choosing "todas" removes just that filter', async () => {
    const router = renderAt('/npc?zona=puerto&tag=mercader');
    fireEvent.change(zonaSelect(), { target: { value: '' } });
    await waitFor(() => expect(router.state.location.search).toBe('?tag=mercader'));
  });

  it('shows the empty state for filters that match nothing, and clears from it', async () => {
    const router = renderAt('/npc?zona=mina&tag=mercader');
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText('No hay fichas con estos filtros')).toBeTruthy();
    expect(screen.getByText('0 de 3 fichas · orden alfabético')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(cardTitles()).toHaveLength(3));
    expect(router.state.location.search).toBe('');
  });

  it('shows an unknown filter value as active and gives the empty state', () => {
    renderAt('/npc?zona=no-existe');
    const select = zonaSelect() as HTMLSelectElement;
    expect(select.value).toBe('no-existe');
    expect(select.selectedOptions[0]?.textContent).toBe('no-existe');
    expect(screen.getByRole('button', { name: 'Todos', pressed: false })).toBeTruthy();
    expect(screen.getByText('No hay fichas con estos filtros')).toBeTruthy();
  });

  it('still shows a filter without values when the URL asks for it', () => {
    // No session has a zona in this content, so the filter is not offered by itself.
    renderAt('/sesion?zona=puerto');
    expect(screen.getByRole('combobox', { name: 'Filtrar por zona' })).toBeTruthy();
    expect(screen.getByText('No hay fichas con estos filtros')).toBeTruthy();
  });

  it('ignores filters that do not apply to the type', () => {
    renderAt('/zona?faccion=Gremio');
    expect(cardTitles()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Todos', pressed: true })).toBeTruthy();
  });

  it('marks the open entry with aria-current and no other', () => {
    renderAt('/npc/elara');
    const current = screen.getAllByRole('link', { current: 'page' });
    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute('href')).toBe('/npc/elara');
  });

  it('keeps the query string in the links to the entries', () => {
    renderAt('/npc?faccion=Gremio%20de%20Ejemplo&tag=mercader');
    expect(screen.getByRole('link', { name: /Tobías/ }).getAttribute('href')).toBe(
      '/npc/tobias?faccion=Gremio%20de%20Ejemplo&tag=mercader',
    );
  });

  it('keeps the filters and the list when the open entry changes', async () => {
    const router = renderAt('/npc/elara?tag=mercader');
    fireEvent.click(screen.getByRole('link', { name: /Tobías/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/npc/tobias'));
    expect(router.state.location.search).toBe('?tag=mercader');
    expect(cardTitles()).toEqual(['Elara', 'Tobías, mercader']);
    expect(screen.getByRole('link', { current: 'page' }).getAttribute('href')).toBe(
      '/npc/tobias?tag=mercader',
    );
  });

  it('names the list after the type, as h1 when no entry is open', () => {
    renderAt('/npc');
    expect(screen.getByRole('heading', { level: 1, name: 'NPCs' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'NPCs' })).toBeTruthy();
  });

  it('uses h2 when an entry is open', () => {
    renderAt('/npc/elara');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'NPCs' })).toBeTruthy();
  });

  it('says so when the type has no entries', () => {
    renderAt('/lore');
    expect(screen.getByText('Todavía no hay fichas de este tipo.')).toBeTruthy();
    expect(screen.getByText('0 fichas · orden alfabético')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull();
  });
});
