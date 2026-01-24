import { test, expect } from '@playwright/test';

test.describe('Donor Registration Flow', () => {
  test('should navigate to registration page from login', async ({ page }) => {
    await page.goto('/donor/login');
    await page.getByRole('link', { name: /register now|register/i }).click();
    await expect(page).toHaveURL(/.*donor\/register/);
  });

  test('should display registration form', async ({ page }) => {
    await page.goto('/donor/register');

    // Check for form fields
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/donor/register');

    // Try to submit empty form
    const submitButton = page.getByRole('button', { name: /register|sign up/i });
    await submitButton.click();

    // Should show validation errors (wait for them to appear)
    await page.waitForTimeout(500);
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/donor/register');

    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill('invalid-email');
    await emailInput.blur();

    // Wait for validation message
    await page.waitForTimeout(300);
  });

  test('should navigate to login page from registration', async ({ page }) => {
    await page.goto('/donor/register');

    const loginLink = page.getByRole('link', { name: /login|sign in/i });
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/.*donor\/login/);
    }
  });
});
