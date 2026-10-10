import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import App from '@/App';

it('renders the shell with the bundled content', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Grimorio del DM' })).toBeTruthy();
  const nav = screen.getByRole('navigation', { name: 'Categorías' });
  expect(within(nav).getAllByRole('link')).toHaveLength(7);
  expect(within(nav).getByRole('link', { name: 'NPCs, 3 fichas' })).toBeTruthy();
});
