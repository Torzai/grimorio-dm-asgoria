import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const TOBIAS = '/npc/tobias-mercader-ejemplo';
const TOBIAS_TITLE = 'Tobías, mercader de ejemplo';
const PUERTO = '/zona/puerto-ejemplo';

const title = (page: Page) => page.getByRole('heading', { level: 1 });
const body = (page: Page) => page.getByRole('article');
const aside = (page: Page) => page.getByRole('complementary', { name: 'Fichas relacionadas' });
const box = (page: Page, name: string) => page.getByRole('group', { name });
const cards = (page: Page) =>
  page.getByRole('region', { name: 'NPCs', exact: true }).getByRole('list').getByRole('link');
const scrollWidth = (page: Page) => page.evaluate<number>('document.documentElement.scrollWidth');
const scrollY = (page: Page) => page.evaluate<number>('window.scrollY');

test.describe('at 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('shows the header: kicker with the zona, title, aliases and tags', async ({ page }) => {
    await page.goto(TOBIAS);

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(title(page)).toHaveText(TOBIAS_TITLE);
    await expect(page.getByText('NPC · Puerto de Ejemplo')).toBeVisible();
    await expect(
      page.getByText('NPC · Puerto de Ejemplo').getByRole('link', { name: 'Puerto de Ejemplo' }),
    ).toHaveAttribute('href', PUERTO);
    await expect(page.getByText('También conocido como: Tobi el Tuerto')).toBeVisible();
    await expect(page).toHaveTitle(`${TOBIAS_TITLE} · Grimorio del DM`);

    const tags = page.getByRole('list', { name: 'Tags' }).getByRole('link');
    await expect(tags).toHaveText(['#ejemplo', '#mercader']);
    await expect(tags.first()).toBeVisible();
  });

  test('a direct load leaves the focus alone', async ({ page }) => {
    await page.goto(TOBIAS);
    await expect(title(page)).toBeVisible();
    await expect(title(page)).not.toBeFocused();
  });

  test('clicking a tag opens the list of the type filtered by it', async ({ page }) => {
    await page.goto(TOBIAS);
    await page.getByRole('link', { name: '#mercader' }).click();

    await expect(page).toHaveURL('/npc?tag=mercader');
    await expect(page.getByLabel('Filtrar por tag')).toHaveValue('mercader');
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toContainText('Tobías');
    await expect(page.getByText('1 de 3 fichas · orden alfabético')).toBeVisible();
  });

  test('the Markdown body has its sections, lists and wikilinks', async ({ page }) => {
    await page.goto(TOBIAS);

    await expect(body(page).getByRole('heading', { level: 2 })).toHaveText([
      'Cómo interpretarlo',
      'Qué sabe',
      'Ganchos',
    ]);
    await expect(body(page).getByRole('heading', { level: 2 }).first()).toHaveCSS(
      'border-bottom-style',
      'solid',
    );
    await expect(body(page).getByRole('listitem')).toHaveCount(3);
    await expect(body(page).getByRole('link', { name: 'varitas de chispas' })).toHaveAttribute(
      'href',
      '/varita/varita-chispas-ejemplo',
    );
  });

  test('following a [[wikilink]] opens the entry and puts the focus on its title', async ({
    page,
  }) => {
    await page.goto(TOBIAS);
    await body(page).getByRole('link', { name: 'Puerto de Ejemplo' }).click();

    await expect(page).toHaveURL(PUERTO);
    await expect(title(page)).toHaveText('Puerto de Ejemplo');
    await expect(title(page)).toBeFocused();
    // Programmatic focus: no ring around the title.
    await expect(title(page)).toHaveCSS('outline-style', 'none');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('the destination lists the entry it came from in "Mencionado en" and the journal', async ({
    page,
  }) => {
    await page.goto(TOBIAS);
    await body(page).getByRole('link', { name: 'Puerto de Ejemplo' }).click();
    await expect(page).toHaveURL(PUERTO);

    const mentions = box(page, 'Mencionado en');
    await expect(mentions.getByRole('link', { name: `NPC: ${TOBIAS_TITLE}` })).toHaveAttribute(
      'href',
      TOBIAS,
    );

    const journal = box(page, 'Diario de sesiones');
    await expect(journal.getByRole('listitem')).toContainText('10 ene 2026 · Sesión de ejemplo');
    await expect(
      journal.getByRole('link', { name: 'Sesión de ejemplo: llegada al puerto' }),
    ).toBeVisible();
  });

  test('the related box links the frontmatter entries, without repeating the zona', async ({
    page,
  }) => {
    await page.goto(TOBIAS);

    const related = box(page, 'Relacionado');
    await expect(related.getByRole('link')).toHaveText([
      '→ Lore: Gremio de Ejemplo',
      '→ Varita: Varita de chispas de ejemplo',
    ]);
    await related.getByRole('link', { name: 'Lore: Gremio de Ejemplo' }).click();
    await expect(page).toHaveURL('/lore/gremio-ejemplo');
  });

  test('a zona lists what is in it, and the table with an escaped pipe links correctly', async ({
    page,
  }) => {
    await page.goto(PUERTO);

    const inZone = box(page, 'En esta zona');
    await expect(inZone.getByRole('heading', { level: 3, name: 'NPCs' })).toBeVisible();
    await expect(inZone.getByRole('link', { name: TOBIAS_TITLE })).toHaveAttribute('href', TOBIAS);

    const table = body(page).getByRole('table');
    await expect(table.getByRole('columnheader')).toHaveText(['Lugar', 'Qué hay']);
    await expect(table.locator('xpath=..')).toHaveCSS('overflow-x', 'auto');
    await table.getByRole('link', { name: 'Tobías', exact: true }).click();

    await expect(page).toHaveURL(TOBIAS);
    await expect(title(page)).toHaveText(TOBIAS_TITLE);
    await expect(title(page)).toBeFocused();
  });

  test('moving to another entry scrolls to the top', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 500 });
    await page.goto(PUERTO);
    await page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
    expect(await scrollY(page)).toBeGreaterThan(0);

    await body(page).getByRole('table').getByRole('link', { name: 'Tobías', exact: true }).click();

    await expect(page).toHaveURL(TOBIAS);
    await expect.poll(() => scrollY(page)).toBe(0);
  });

  test('a broken wikilink is shown differently and does not navigate', async ({ page }) => {
    // The example content has no broken link: break one in the response, not in the file.
    await page.route(/tobias-mercader-ejemplo\.md\?import&raw/, async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      await route.fulfill({
        response,
        body: source.replace('[[Mina de Ejemplo]]', '[[Mina Inexistente]]'),
      });
    });
    await page.goto(TOBIAS);

    const broken = body(page).getByText('Mina Inexistente');
    await expect(broken).toBeVisible();
    await expect(broken).toHaveAttribute(
      'title',
      'Enlace roto: no existe ninguna ficha con ese nombre',
    );
    await expect(body(page).getByRole('link', { name: 'Mina Inexistente' })).toHaveCount(0);
    await expect(broken).toHaveCSS('text-decoration-line', 'underline');
    await expect(broken).toHaveCSS('text-decoration-style', 'dashed');

    await broken.click();
    await expect(page).toHaveURL(TOBIAS);
    await expect(title(page)).toHaveText(TOBIAS_TITLE);
  });

  test('"Editar .md" opens the file in VS Code (dev only)', async ({ page }) => {
    await page.goto(TOBIAS);

    const edit = page.getByRole('link', { name: 'Editar .md' });
    await expect(edit).toBeVisible();
    const href = (await edit.getAttribute('href')) ?? '';
    expect(href).toMatch(/^vscode:\/\/file\/.+\/content\/npc\/tobias-mercader-ejemplo\.md$/);
    // An absolute path: a drive ('C:/…') on Windows, the root of the repo elsewhere.
    expect(decodeURI(href)).toContain(process.cwd().replaceAll('\\', '/').replace(/^\//, ''));
  });

  test('the whole entry works with the keyboard', async ({ page }) => {
    await page.goto(TOBIAS);

    const link = body(page).getByRole('link', { name: 'varitas de chispas' });
    await link.focus();
    await expect(link).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL('/varita/varita-chispas-ejemplo');
    await expect(title(page)).toBeFocused();
    // From the title, Tab goes on into the page instead of back to the top.
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).not.toHaveText('Saltar al contenido');
  });

  test('the dark scrollbar gutter: html has the page background and a dark color scheme', async ({
    page,
  }) => {
    await page.goto(TOBIAS);

    const html = page.locator('html');
    const bodyColor = await page.evaluate<string>(
      'getComputedStyle(document.body).backgroundColor',
    );
    await expect(html).toHaveCSS('background-color', bodyColor);
    await expect(html).toHaveCSS('color-scheme', 'dark');
  });

  test('the list stays next to the entry and the side boxes next to the body', async ({ page }) => {
    await page.goto(TOBIAS);

    const list = await cards(page).first().boundingBox();
    const article = await body(page).boundingBox();
    const side = await aside(page).boundingBox();
    expect(list && article && side).toBeTruthy();
    if (!list || !article || !side) return;

    expect(list.x + list.width).toBeLessThan(article.x);
    // The aside is to the right of the body, at the same height, and about half as wide.
    expect(side.x).toBeGreaterThanOrEqual(article.x + article.width);
    expect(side.y).toBeLessThan(article.y + 100);
    expect(side.width).toBeLessThan(article.width);
    expect(await scrollWidth(page)).toBeLessThanOrEqual(1440);
  });

  test('the side boxes go under the body when the window is too narrow for both', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1250, height: 900 });
    await page.goto(TOBIAS);

    await expect(cards(page).first()).toBeVisible();
    const article = await body(page).boundingBox();
    const side = await aside(page).boundingBox();
    if (!article || !side) throw new Error('missing boxes');
    expect(side.y).toBeGreaterThanOrEqual(article.y + article.height);
    expect(side.x).toBeCloseTo(article.x, 0);
    expect(await scrollWidth(page)).toBeLessThanOrEqual(1250);
  });

  test('the side boxes sit next to the body again at 1920 px', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(TOBIAS);

    const article = await body(page).boundingBox();
    const side = await aside(page).boundingBox();
    if (!article || !side) throw new Error('missing boxes');
    expect(side.x).toBeGreaterThanOrEqual(article.x + article.width);
    // About 2:1, as in the mockup.
    expect(article.width / side.width).toBeGreaterThan(1.5);
    expect(article.width / side.width).toBeLessThan(2.5);
  });
});

test.describe('at 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const url of [TOBIAS, PUERTO]) {
    test(`${url} has no horizontal scroll and the side boxes under the body`, async ({ page }) => {
      await page.goto(url);

      await expect(title(page)).toBeVisible();
      expect(await scrollWidth(page)).toBeLessThanOrEqual(390);
      const article = await body(page).boundingBox();
      const side = await aside(page).boundingBox();
      if (!article || !side) throw new Error('missing boxes');
      expect(side.y).toBeGreaterThanOrEqual(article.y + article.height);
      expect(article.x + article.width).toBeLessThanOrEqual(390);
    });
  }
});

test.describe('screenshots for human review', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('app and mockup at 1440×900', async ({ page }) => {
    await page.goto(TOBIAS);
    await expect(title(page)).toHaveText(TOBIAS_TITLE);
    await page.evaluate('document.fonts.ready.then(() => true)');
    await page.screenshot({ path: 'e2e/__screenshots__/t06-app.png' });

    const mockup = pathToFileURL(path.resolve('sdd/design/maqueta-ficha.html')).href;
    await page.goto(mockup);
    await page.evaluate('document.fonts.ready.then(() => true)');
    await page.screenshot({ path: 'e2e/__screenshots__/t06-maqueta.png' });
  });
});
