import { expect, test } from '@playwright/test';

test('shows the app title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Grimorio del DM' })).toBeVisible();
});
