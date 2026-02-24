import { test, expect } from '@playwright/test';

test('admin login page renders', async ({ page }) => {
  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
});
