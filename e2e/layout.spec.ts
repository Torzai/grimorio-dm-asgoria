import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const TYPE_LABELS = [
  'NPCs',
  'Zonas y mapas',
  'Lore y facciones',
  'Varitas',
  'Comandos',
  'Herramientas',
  'Diario de sesiones',
];
const ENTRY_PATH = '/npc/tobias-mercader-ejemplo';
const ENTRY_TITLE = 'Tobías, mercader de ejemplo';

test('the home loads and the sidebar lists the 7 types with 3 entries each', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Grimorio del DM' })).toBeVisible();
  await expect(page).toHaveTitle('Grimorio del DM');

  const links = page.getByRole('navigation', { name: 'Categorías' }).getByRole('link');
  await expect(links).toHaveCount(TYPE_LABELS.length);
  for (const [i, label] of TYPE_LABELS.entries()) {
    await expect(links.nth(i)).toHaveAccessibleName(`${label}, 3 fichas`);
    await expect(links.nth(i)).toContainText(label);
    await expect(links.nth(i).locator('span')).toHaveText('3');
  }
});

test('clicking a type opens its list and marks it as current', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Categorías' });
  await nav.getByRole('link', { name: /^NPCs/ }).click();

  await expect(page).toHaveURL('/npc');
  await expect(nav.getByRole('link', { name: /^NPCs/ })).toHaveAttribute('aria-current', 'page');
  await expect(nav.locator('[aria-current]')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('NPCs');
  await expect(page).toHaveTitle('NPCs · Grimorio del DM');
});

test('an entry shows its title', async ({ page }) => {
  await page.goto(ENTRY_PATH);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ENTRY_TITLE);
  await expect(page).toHaveTitle(`${ENTRY_TITLE} · Grimorio del DM`);
});

for (const route of ['/npc/no-existe', '/dragones']) {
  test(`${route} shows the 404 page`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Página no encontrada');
    await page.getByRole('link', { name: 'Volver al inicio' }).click();
    await expect(page).toHaveURL('/');
  });
}

test('the header search goes to /buscar?q=…', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('searchbox', { name: 'Buscar en el grimorio' });
  await input.fill('tobias');
  await input.press('Enter');

  await expect(page).toHaveURL('/buscar?q=tobias');
  await expect(page.getByText('Resultados para «tobias»')).toBeVisible();
});

test('the first Tab focuses a visible "Saltar al contenido" link', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');

  const skip = page.getByRole('link', { name: 'Saltar al contenido' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport({ ratio: 1 });
  const box = await skip.boundingBox();
  expect(box?.width).toBeGreaterThan(100);

  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('focus is visible on the sidebar links', async ({ page }) => {
  await page.goto('/');
  const link = page.getByRole('navigation', { name: 'Categorías' }).getByRole('link').first();
  await link.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS('outline-style', 'solid');
  await expect(link).toHaveCSS('outline-width', '2px');
});

test.describe('at 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of ['/', ENTRY_PATH, '/buscar?q=tobias']) {
    test(`${route} has no horizontal page scroll`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const scrollWidth = await page.evaluate<number>('document.documentElement.scrollWidth');
      expect(scrollWidth).toBeLessThanOrEqual(390);
    });
  }
});

test.describe('screenshots for human review', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('app and mockup at 1440×900', async ({ page }) => {
    await page.goto(ENTRY_PATH);
    await page.evaluate('document.fonts.ready.then(() => true)');
    await page.screenshot({ path: 'e2e/__screenshots__/t04-app.png' });

    const mockup = pathToFileURL(path.resolve('sdd/design/maqueta-ficha.html')).href;
    await page.goto(mockup);
    await page.evaluate('document.fonts.ready.then(() => true)');
    await page.screenshot({ path: 'e2e/__screenshots__/t04-maqueta.png' });
  });
});
