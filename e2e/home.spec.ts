import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/BloodHub India/i);
  });

  test('should display navigation menu', async ({ page }) => {
    await page.goto('/');

    // Check for main navigation items
    await expect(page.getByRole('link', { name: /home/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /about/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /contact/i })).toBeVisible();
  });

  test('should have functional donor signin link', async ({ page }) => {
    await page.goto('/');

    const signinButton = page.getByRole('button', { name: /sign in/i });
    await expect(signinButton).toBeVisible();
    await signinButton.hover();

    const donorSigninLink = page.getByRole('link', { name: /^donor$/i });
    await expect(donorSigninLink).toBeVisible();
    await donorSigninLink.click();
    await expect(page).toHaveURL(/.*donor\/login/);
  });

  test('should display hero section', async ({ page }) => {
    await page.goto('/');

    // Check for hero content
    const heroSection = page.locator('section').first();
    await expect(heroSection).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await expect(page).toHaveTitle(/BloodHub India/i);
  });
});
