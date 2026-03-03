import { test, expect } from '@playwright/test';
import { ROUTES } from '../src/constants/routes';

test('admin login page renders', async ({ page }) => {
  await page.goto(ROUTES.portal.admin.login);
  await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
});
