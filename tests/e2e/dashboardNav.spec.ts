import { test, expect } from '@playwright/test'

/**
 * E2E tests for dashboard navigation.
 * Verifies that all protected routes redirect unauthenticated users to /login,
 * and that authenticated navigation works (auth-gated, skipped by default).
 */

const PROTECTED_ROUTES = [
  '/dashboard',
  '/dashboard/chat',
  '/dashboard/settings',
  '/dashboard/projects',
]

test.describe('Dashboard Nav — Unauthenticated redirects', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/.*login/)
    })
  }
})

test.describe('Dashboard Nav — Authenticated', () => {
  // Requires a logged-in session. Remove test.skip once Clerk test auth is set up.

  test.skip('sidebar nav links are visible', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard')

    // Check main nav items are rendered
    for (const label of ['Dashboard', 'Chat', 'Projects', 'Settings']) {
      await expect(page.getByRole('link', { name: new RegExp(label, 'i') })).toBeVisible()
    }
  })

  test.skip('client-side navigation between routes', async ({ page }) => {
    await page.goto('/dashboard')

    // Navigate to Chat
    await page.getByRole('link', { name: /chat/i }).click()
    await expect(page).toHaveURL(/.*dashboard\/chat/)

    // Navigate to Projects
    await page.getByRole('link', { name: /projects/i }).click()
    await expect(page).toHaveURL(/.*dashboard\/projects/)

    // Navigate to Settings
    await page.getByRole('link', { name: /settings/i }).click()
    await expect(page).toHaveURL(/.*dashboard\/settings/)
  })
})
