import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const NPC_TITLES = [
  'Brom, capataz de ejemplo',
  'Elara, guardabosques de ejemplo',
  'Tobías, mercader de ejemplo',
];
const SESSION_TITLES = [
  'Sesión de ejemplo: la mina',
  'Sesión de ejemplo: el bosque',
  'Sesión de ejemplo: llegada al puerto',
];
const TOBIAS = '/npc/tobias-mercader-ejemplo';
const HINT = 'Elige una ficha de la lista';

const list = (page: Page) => page.getByRole('region', { name: 'NPCs', exact: true });
const cards = (page: Page) => list(page).getByRole('list').getByRole('link');
const scrollWidth = (page: Page) => page.evaluate<number>('document.documentElement.scrollWidth');

test.describe('at 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('/npc lists the 3 NPCs alphabetically next to the "pick an entry" hint', async ({
    page,
  }) => {
    await page.goto('/npc');

    await expect(cards(page)).toHaveCount(3);
    await expect(cards(page)).toContainText(NPC_TITLES);
    await expect(list(page).getByText('3 fichas · orden alfabético')).toBeVisible();
    await expect(cards(page).first()).toContainText('Gremio de Ejemplo');
    await expect(page.getByText(HINT)).toBeVisible();
    await expect(page.getByText('NPCs · 3 fichas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Todos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('choosing a zona narrows the list, goes in the URL and survives a reload', async ({
    page,
  }) => {
    await page.goto('/npc');
    await page.getByLabel('Filtrar por zona').selectOption({ label: 'Puerto de Ejemplo (1)' });

    await expect(page).toHaveURL('/npc?zona=puerto-ejemplo');
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toContainText('Tobías');
    await expect(list(page).getByText('1 de 3 fichas · orden alfabético')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Todos' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await page.reload();
    await expect(page).toHaveURL('/npc?zona=puerto-ejemplo');
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByLabel('Filtrar por zona')).toHaveValue('puerto-ejemplo');
  });

  test('a faction with spaces is escaped in the URL and read back after a reload', async ({
    page,
  }) => {
    await page.goto('/npc');
    await page.getByLabel('Filtrar por facción').selectOption({ label: 'Gremio de Ejemplo (2)' });

    await expect(page).toHaveURL('/npc?faccion=Gremio+de+Ejemplo');
    await expect(cards(page)).toHaveCount(2);

    await page.reload();
    await expect(cards(page)).toContainText([NPC_TITLES[0], NPC_TITLES[2]]);
    await expect(page.getByLabel('Filtrar por facción')).toHaveValue('Gremio de Ejemplo');
  });

  test('zona, faction and tag combine', async ({ page }) => {
    await page.goto('/npc');
    await page.getByLabel('Filtrar por facción').selectOption({ label: 'Gremio de Ejemplo (2)' });
    await page.getByLabel('Filtrar por tag').selectOption({ label: 'minero (1)' });

    await expect(page).toHaveURL('/npc?faccion=Gremio+de+Ejemplo&tag=minero');
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toContainText('Brom');
  });

  test('opening a card keeps the filters in the URL and the list next to the entry', async ({
    page,
  }) => {
    await page.goto('/npc?zona=puerto-ejemplo');
    await cards(page).first().click();

    await expect(page).toHaveURL(`${TOBIAS}?zona=puerto-ejemplo`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(NPC_TITLES[2]);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toBeVisible();
    await expect(cards(page).first()).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Filtrar por zona')).toHaveValue('puerto-ejemplo');
    await expect(page.getByText(HINT)).toBeHidden();
    await expect(page.getByText('Volver a NPCs')).toBeHidden();
  });

  test('switching entry keeps the list and the active card follows', async ({ page }) => {
    await page.goto('/npc?tag=ejemplo');
    await cards(page).nth(1).click();
    await expect(page).toHaveURL('/npc/elara-guardabosques-ejemplo?tag=ejemplo');
    await expect(cards(page)).toHaveCount(3);
    await expect(cards(page).nth(1)).toHaveAttribute('aria-current', 'page');

    await cards(page).nth(2).click();
    await expect(page).toHaveURL(`${TOBIAS}?tag=ejemplo`);
    await expect(cards(page).nth(2)).toHaveAttribute('aria-current', 'page');
    await expect(list(page).locator('[aria-current="page"]')).toHaveCount(1);
  });

  test('changing a filter next to an open entry keeps the entry', async ({ page }) => {
    await page.goto(TOBIAS);
    await page.getByLabel('Filtrar por zona').selectOption({ label: 'Mina de Ejemplo (1)' });

    await expect(page).toHaveURL(`${TOBIAS}?zona=mina-ejemplo`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(NPC_TITLES[2]);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toContainText('Brom');
  });

  test('"Todos" brings the 3 cards back and cleans the URL', async ({ page }) => {
    await page.goto('/npc?zona=puerto-ejemplo');
    await expect(cards(page)).toHaveCount(1);

    await page.getByRole('button', { name: 'Todos' }).click();

    await expect(page).toHaveURL('/npc');
    await expect(cards(page)).toHaveCount(3);
    await expect(page.getByLabel('Filtrar por zona')).toHaveValue('');
  });

  test('filters with no results show the empty state; "Limpiar filtros" clears it', async ({
    page,
  }) => {
    await page.goto('/npc?zona=mina-ejemplo&tag=mercader');

    await expect(page.getByText('No hay fichas con estos filtros')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();

    await expect(page).toHaveURL('/npc');
    await expect(cards(page)).toHaveCount(3);
  });

  test('an unknown filter value in the URL shows as active and empties the list', async ({
    page,
  }) => {
    await page.goto('/npc?zona=no-existe');

    await expect(page.getByLabel('Filtrar por zona')).toHaveValue('no-existe');
    await expect(page.getByText('No hay fichas con estos filtros')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Todos' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('the zona type has no zona filter, and a type without faction no faction filter', async ({
    page,
  }) => {
    await page.goto('/zona');
    await expect(page.getByLabel('Filtrar por zona')).toHaveCount(0);
    await expect(page.getByLabel('Filtrar por tag')).toBeVisible();

    await page.goto('/lore');
    await expect(page.getByLabel('Filtrar por facción')).toHaveCount(0);
    await expect(page.getByLabel('Filtrar por zona')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Lore y facciones' })).toContainText('Religión');
  });

  test('/sesion lists the sessions from the newest to the oldest', async ({ page }) => {
    await page.goto('/sesion');

    const sessions = page.getByRole('region', { name: 'Diario de sesiones' }).getByRole('listitem');
    await expect(sessions).toContainText(SESSION_TITLES);
    await expect(page.getByText('3 fichas · orden cronológico')).toBeVisible();
    await expect(sessions.first()).toContainText('14 mar 2026');
  });

  test('the whole flow works with the keyboard', async ({ page }) => {
    await page.goto('/npc');

    const todos = page.getByRole('button', { name: 'Todos' });
    await todos.focus();
    // Tab out and back, so the focus ring is the keyboard one.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(todos).toBeFocused();
    await expect(todos).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Filtrar por zona')).toBeFocused();
    await expect(page.getByLabel('Filtrar por zona')).toHaveCSS('outline-style', 'solid');

    await cards(page).first().focus();
    await expect(cards(page).first()).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/npc/brom-capataz-ejemplo');
    // Opening an entry moves the focus to its title (T06); the list stays mounted next to it.
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(cards(page).first()).toHaveAttribute('aria-current', 'page');
  });

  test('the header, sidebar and list stay put and the list scrolls on its own', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 500 });
    await page.goto('/npc');

    const pane = list(page).locator('..');
    await expect(page.getByRole('banner')).toHaveCSS('position', 'sticky');
    await expect(page.getByRole('navigation', { name: 'Categorías' })).toHaveCSS(
      'position',
      'sticky',
    );
    await expect(pane).toHaveCSS('position', 'sticky');
    await expect(pane).toHaveCSS('overflow-y', 'auto');

    const header = await page.getByRole('banner').boundingBox();
    const box = await pane.boundingBox();
    expect(box?.y).toBeCloseTo(header?.height ?? 0, 0);
    expect(box?.height).toBeCloseTo(500 - (header?.height ?? 0), 0);

    const overflows = await pane.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(overflows).toBe(true);
    await pane.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    expect(await page.evaluate<number>('window.scrollY')).toBe(0);
  });
});

test.describe('at 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('/npc shows only the list', async ({ page }) => {
    await page.goto('/npc');

    await expect(cards(page)).toHaveCount(3);
    await expect(page.getByText(HINT)).toBeHidden();
    expect(await scrollWidth(page)).toBeLessThanOrEqual(390);
  });

  test('/npc/<slug> shows only the entry, and "← Volver a NPCs" goes back with the filters', async ({
    page,
  }) => {
    await page.goto('/npc?zona=puerto-ejemplo');
    await expect(cards(page)).toHaveCount(1);
    expect(await scrollWidth(page)).toBeLessThanOrEqual(390);

    await cards(page).first().click();
    await expect(page).toHaveURL(`${TOBIAS}?zona=puerto-ejemplo`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(NPC_TITLES[2]);
    await expect(list(page)).toBeHidden();
    await expect(page.getByLabel('Filtrar por zona')).toBeHidden();
    expect(await scrollWidth(page)).toBeLessThanOrEqual(390);

    const back = page.getByRole('link', { name: 'Volver a NPCs' });
    await expect(back).toBeVisible();
    await expect(back).toHaveText('← Volver a NPCs');
    await back.click();

    await expect(page).toHaveURL('/npc?zona=puerto-ejemplo');
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByLabel('Filtrar por zona')).toHaveValue('puerto-ejemplo');
    expect(await scrollWidth(page)).toBeLessThanOrEqual(390);
  });

  test('a missing entry still offers the way back', async ({ page }) => {
    await page.goto('/npc/no-existe?tag=ejemplo');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Página no encontrada');
    await page.getByRole('link', { name: 'Volver a NPCs' }).click();
    await expect(page).toHaveURL('/npc?tag=ejemplo');
  });

  test('the filter chips fit with a long faction selected', async ({ page }) => {
    await page.goto('/npc?faccion=Gremio+de+Ejemplo&zona=puerto-ejemplo&tag=mercader');

    await expect(page.getByLabel('Filtrar por facción')).toBeVisible();
    expect(await scrollWidth(page)).toBeLessThanOrEqual(390);
  });
});

test.describe('screenshots for human review', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('app and mockup at 1440×900', async ({ page }) => {
    await page.goto(TOBIAS);
    await expect(cards(page)).toHaveCount(3);
    await page.evaluate('document.fonts.ready.then(() => true)');
    await page.screenshot({ path: 'e2e/__screenshots__/t05-app.png' });

    const mockup = pathToFileURL(path.resolve('sdd/design/maqueta-ficha.html')).href;
    await page.goto(mockup);
    await page.evaluate('document.fonts.ready.then(() => true)');
    await page.screenshot({ path: 'e2e/__screenshots__/t05-maqueta.png' });
  });
});
