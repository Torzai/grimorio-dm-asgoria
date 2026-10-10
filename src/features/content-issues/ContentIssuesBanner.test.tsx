import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildContent } from '@/content/build-content';
import type { ContentIssue } from '@/content/types';
import { ContentContext } from '@/content/use-content';
import { ContentIssuesBanner } from './ContentIssuesBanner';

function renderWith(issues: ContentIssue[]) {
  return render(
    <ContentContext.Provider value={{ ...buildContent({}), issues }}>
      <ContentIssuesBanner />
    </ContentContext.Provider>,
  );
}

const ERRORS: ContentIssue[] = [
  {
    path: 'content/npc/roto.md',
    level: 'error',
    field: 'title',
    message: "falta el campo obligatorio 'title'",
  },
  { path: 'content/npc/roto.md', level: 'error', field: 'zona', message: 'zona no válida' },
  { path: 'content/zona/mal.md', level: 'error', message: 'el frontmatter no es YAML válido' },
];
const WARNING: ContentIssue = {
  path: 'content/npc/ana.md',
  level: 'warning',
  message: 'enlace roto: [[Nadie]]',
};

describe('ContentIssuesBanner', () => {
  it('renders nothing without issues', () => {
    const { container } = renderWith([]);
    expect(container.innerHTML).toBe('');
  });

  it('counts the files with errors and lists path, field and message on demand', () => {
    renderWith(ERRORS);
    expect(screen.getByText('2 fichas con errores no se muestran')).toBeTruthy();

    const toggle = screen.getByRole('button', { name: 'Ver errores' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toBe('Ocultar errores');
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      "content/npc/roto.mdtitlefalta el campo obligatorio 'title'",
      'content/npc/roto.mdzonazona no válida',
      'content/zona/mal.mdel frontmatter no es YAML válido',
    ]);
  });

  it('uses the singular for a single broken file', () => {
    renderWith(ERRORS.slice(0, 2));
    expect(screen.getByText('1 ficha con errores no se muestra')).toBeTruthy();
  });

  it('folds the warnings with their count, next to the errors', () => {
    renderWith([...ERRORS, WARNING, WARNING]);
    const summary = screen.getByText('2 avisos en el contenido');
    expect(summary.closest('details')?.open).toBe(false);
  });

  it('shows only the folded warnings when there are no errors', () => {
    renderWith([WARNING]);
    expect(screen.getByText('1 aviso en el contenido')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
