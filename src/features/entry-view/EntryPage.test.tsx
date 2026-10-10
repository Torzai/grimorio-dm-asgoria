import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContent } from '@/content/build-content';
import { ContentContext } from '@/content/use-content';
import { EntryPage } from './EntryPage';

const content = buildContent({
  'content/zona/puerto.md': [
    '---',
    'type: zona',
    'title: Puerto de Ejemplo',
    'relacionados: [gremio]',
    '---',
    'Aquí vive [[Tobías]].',
  ].join('\n'),
  'content/lore/gremio.md': '---\ntype: lore\ntitle: Gremio\ncategoria: faccion\n---\nSin más.',
  'content/npc/tobias.md': [
    '---',
    'type: npc',
    'title: Tobías, mercader',
    'aliases: [Tobi el Tuerto, El Tuerto]',
    'tags: [mercader, ejemplo]',
    'resumen: Vende varitas',
    'zona: puerto',
    'relacionados: [gremio, ana]',
    '---',
    'Habla con [[Ana]].',
  ].join('\n'),
  'content/npc/ana.md':
    '---\ntype: npc\ntitle: Ana\nresumen: Una herrera\n---\nConoce a [[Tobías]].',
  'content/npc/solo.md': '---\ntype: npc\ntitle: Solo\n---\nNadie sabe de él.',
  'content/sesion/vieja.md': [
    '---',
    'type: sesion',
    'title: Sesión vieja',
    'fecha: 2026-01-10',
    '---',
    'Llega [[Tobías]].',
  ].join('\n'),
  'content/sesion/nueva.md': [
    '---',
    'type: sesion',
    'title: Sesión nueva',
    'fecha: 2026-03-14',
    '---',
    'Vuelve [[Tobías]].',
  ].join('\n'),
});

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/:type/:slug', element: <EntryPage /> }], {
    initialEntries: [path],
  });
  render(
    <ContentContext.Provider value={content}>
      <RouterProvider router={router} />
    </ContentContext.Provider>,
  );
  return router;
}

const title = () => screen.getByRole('heading', { level: 1 });
// The line above the title: the type, and the zona when there is one.
const kickerOf = () => title().previousElementSibling as HTMLElement;
const box = (name: string) => screen.queryByRole('group', { name });

describe('EntryPage header', () => {
  it('shows the type, the zona as a link, the title and a single h1', () => {
    renderAt('/npc/tobias');

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(title().textContent).toBe('Tobías, mercader');
    const kicker = kickerOf();
    expect(kicker.textContent).toBe('NPC · Puerto de Ejemplo');
    expect(
      within(kicker).getByRole('link', { name: 'Puerto de Ejemplo' }).getAttribute('href'),
    ).toBe('/zona/puerto');
  });

  it('shows only the type in the kicker when the entry has no zona', () => {
    renderAt('/npc/ana');
    expect(kickerOf().textContent).toBe('NPC');
  });

  it('uses the aliases as the subtitle', () => {
    renderAt('/npc/tobias');
    expect(screen.getByText('También conocido como: Tobi el Tuerto · El Tuerto')).toBeTruthy();
    expect(screen.queryByText('Vende varitas')).toBeNull();
  });

  it('falls back to the resumen when there are no aliases', () => {
    renderAt('/npc/ana');
    expect(screen.getByText('Una herrera')).toBeTruthy();
    expect(screen.queryByText(/También conocido/)).toBeNull();
  });

  it('has no subtitle when there are neither aliases nor resumen', () => {
    renderAt('/npc/solo');
    expect(title().parentElement?.querySelectorAll('p')).toHaveLength(1);
  });

  it('sets the document title', () => {
    renderAt('/npc/tobias');
    expect(document.title).toBe('Tobías, mercader · Grimorio del DM');
  });

  it('links each tag to the list of the type filtered by it', () => {
    renderAt('/npc/tobias');

    const tags = within(screen.getByRole('list', { name: 'Tags' })).getAllByRole('link');
    expect(tags.map((tag) => tag.textContent)).toEqual(['#mercader', '#ejemplo']);
    expect(tags.map((tag) => tag.getAttribute('href'))).toEqual([
      '/npc?tag=mercader',
      '/npc?tag=ejemplo',
    ]);
  });

  it('has no tag list for an entry without tags', () => {
    renderAt('/npc/ana');
    expect(screen.queryByRole('list', { name: 'Tags' })).toBeNull();
  });

  it('shows the not-found page for a slug that does not exist or has another type', () => {
    renderAt('/npc/nadie');
    expect(screen.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeTruthy();
  });
});

describe('EntryPage "Editar .md"', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is a link to the .md in VS Code in dev', () => {
    renderAt('/npc/tobias');

    const link = screen.getByRole('link', { name: 'Editar .md' });
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('vscode://file/')).toBe(true);
    expect(href.endsWith('/content/npc/tobias.md')).toBe(true);
    // The repo root injected by vite.config.ts is absolute (a drive or a leading slash).
    expect(__REPO_ROOT__).toMatch(/^([A-Za-z]:)?\//);
    expect(decodeURI(href)).toBe(
      `vscode://file/${__REPO_ROOT__.replace(/^\//, '')}/content/npc/tobias.md`,
    );
  });

  it('is not rendered outside dev', () => {
    vi.stubEnv('DEV', false);
    renderAt('/npc/tobias');

    expect(screen.queryByRole('link', { name: 'Editar .md' })).toBeNull();
    expect(document.body.innerHTML).not.toContain('vscode://');
  });
});

describe('EntryPage side panel', () => {
  it('shows the related ones without repeating the zona of the kicker', () => {
    renderAt('/npc/tobias');

    const related = within(box('Relacionado') as HTMLElement);
    expect(related.getAllByRole('link').map((link) => link.textContent)).toEqual([
      '→ Lore: Gremio',
      '→ NPC: Ana',
    ]);
    expect(related.getByRole('link', { name: 'Lore: Gremio' }).getAttribute('href')).toBe(
      '/lore/gremio',
    );
  });

  it('shows who mentions the entry, and the sessions apart, newest first', () => {
    renderAt('/npc/tobias');

    const mentions = within(box('Mencionado en') as HTMLElement);
    expect(mentions.getAllByRole('link').map((link) => link.textContent)).toEqual([
      '→ NPC: Ana',
      '→ Zona: Puerto de Ejemplo',
    ]);

    const journal = within(box('Diario de sesiones') as HTMLElement);
    const items = journal.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      '14 mar 2026 · Sesión nueva',
      '10 ene 2026 · Sesión vieja',
    ]);
    expect(journal.getByRole('link', { name: 'Sesión nueva' }).getAttribute('href')).toBe(
      '/sesion/nueva',
    );
  });

  it('only shows the boxes that have content', () => {
    renderAt('/npc/solo');

    expect(box('Relacionado')).toBeNull();
    expect(box('Mencionado en')).toBeNull();
    expect(box('Diario de sesiones')).toBeNull();
    expect(box('En esta zona')).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('lists what is in a zona, grouped by type, only for zonas', () => {
    renderAt('/zona/puerto');

    const inZone = within(box('En esta zona') as HTMLElement);
    expect(inZone.getByRole('heading', { level: 3, name: 'NPCs' })).toBeTruthy();
    expect(inZone.getByRole('link', { name: 'Tobías, mercader' }).getAttribute('href')).toBe(
      '/npc/tobias',
    );
  });

  it('does not show "En esta zona" for an entry that is not a zona', () => {
    renderAt('/npc/tobias');
    expect(box('En esta zona')).toBeNull();
  });
});

describe('EntryPage when moving to another entry', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('leaves focus and scroll alone on the first render', () => {
    renderAt('/npc/tobias');

    expect(document.activeElement).toBe(document.body);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('moves the focus to the title and scrolls to the top after following a link', async () => {
    renderAt('/npc/tobias');
    // The link in the body; the focus is on it when it is clicked.
    const link = screen.getByRole('link', { name: 'Ana' });
    link.focus();
    fireEvent.click(link);

    expect(await screen.findByRole('heading', { level: 1, name: 'Ana' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(title()));
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(title().getAttribute('tabindex')).toBe('-1');
  });

  it('does not steal the focus when only the query string changes', async () => {
    const router = renderAt('/npc/tobias');
    const tag = screen.getByRole('link', { name: '#mercader' });
    tag.focus();
    await router.navigate('/npc/tobias?zona=puerto');

    expect(document.activeElement).toBe(tag);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
