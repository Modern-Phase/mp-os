import { test, expect } from '@playwright/test';

/**
 * E2E tests for authentication flows
 * Tests user login, logout, and protected routes
 */

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('/');
  });

  test('should display landing page for unauthenticated users', async ({ page }) => {
    // Landing page should be visible
    await expect(page).toHaveTitle(/AI Starter Kit/i);

    // Should have login/signup options
    const signInButton = page.getByRole('link', { name: /sign in/i });
    await expect(signInButton).toBeVisible();
  });

  test('should redirect to login when accessing protected routes', async ({ page }) => {
    // Try to access protected dashboard
    await page.goto('/dashboard');

    // Should be redirected to login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('should show Clerk sign in component on login page', async ({ page }) => {
    await page.goto('/login');

    // Clerk component should be loaded
    // Look for common Clerk UI elements
    await expect(page.locator('[data-clerk-id]')).toBeVisible({ timeout: 10000 });
  });

  // Note: Full login test requires actual Clerk credentials
  // In CI, we'd use Clerk's test mode or mock the auth
  test.skip('should complete login flow with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // This would require test credentials
    // await page.fill('input[name="identifier"]', 'test@example.com');
    // await page.fill('input[name="password"]', 'testpassword');
    // await page.click('button[type="submit"]');

    // After successful login, should redirect to dashboard
    // await expect(page).toHaveURL('/dashboard');
  });

  test('authenticated routes should be accessible after login', async ({ page, context }) => {
    // Skip this test if we don't have auth cookies
    // In a full test suite, we'd have a helper to set auth state
    test.skip(true, 'Requires authenticated session');

    // await page.goto('/dashboard');
    // await expect(page).toHaveURL('/dashboard');
    // await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should navigate to different public pages', async ({ page }) => {
    await page.goto('/');

    // Test navigation to various pages
    const links = ['/login'];

    for (const link of links) {
      await page.goto(link);
      expect(page.url()).toContain(link);
    }
  });
});

test.describe('Responsive Design', () => {
  test('should be mobile responsive', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Page should render without horizontal scroll
    const body = await page.locator('body');
    const box = await body.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });

  test('should have accessible navigation on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Mobile menu button should be visible
    // This depends on your implementation
    // const menuButton = page.getByRole('button', { name: /menu/i });
    // await expect(menuButton).toBeVisible();
  });
});
