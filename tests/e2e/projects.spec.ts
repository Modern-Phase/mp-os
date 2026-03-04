import { test, expect } from '@playwright/test'

/**
 * E2E tests for the Projects page (/dashboard/projects).
 * Auth-gated tests are skipped — they require an authenticated session.
 */

test.describe('Projects Page — Unauthenticated', () => {
  test('redirects /dashboard/projects to /login', async ({ page }) => {
    await page.goto('/dashboard/projects')
    await expect(page).toHaveURL(/.*login/)
  })
})

test.describe('Projects Page — Auth-gated', () => {
  // All tests here require a logged-in session.
  // Once Clerk test auth is configured, remove the test.skip() calls.

  test.skip('sidebar renders with project list or empty state', async ({ page }) => {
    await page.goto('/dashboard/projects')

    // Either the "Projects" heading appears in the sidebar…
    const heading = page.getByRole('heading', { name: 'Projects' })
    await expect(heading).toBeVisible({ timeout: 10_000 })

    // …and we see project cards OR an empty state message
    const hasProjects = await page.locator('[class*="space-y-1"]').count()
    const emptyState = page.getByText(/no projects yet/i)

    if (hasProjects === 0) {
      await expect(emptyState).toBeVisible()
    }
  })

  test.skip('search input filters projects', async ({ page }) => {
    await page.goto('/dashboard/projects')
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 10_000 })

    const searchInput = page.getByPlaceholder('Search projects...')
    await expect(searchInput).toBeVisible()

    // Type a nonsense query — should show "No matches"
    await searchInput.fill('zzz_nonexistent_project')
    await expect(page.getByText(/no matches/i)).toBeVisible()

    // Clear the search — should restore list or empty state
    await searchInput.clear()
    await expect(page.getByText(/no matches/i)).not.toBeVisible()
  })

  test.skip('clicking a project loads detail panel with tabs', async ({ page }) => {
    await page.goto('/dashboard/projects')
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 10_000 })

    // Wait for at least one project card
    const firstCard = page.locator('[class*="space-y-1"] > div').first()
    if (await firstCard.count() === 0) {
      test.skip(true, 'No projects available to click')
      return
    }
    await firstCard.click()

    // Detail panel should show tab triggers
    for (const tab of ['Tasks', 'Agents', 'Activity', 'Tickets', 'GitHub']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible()
    }
  })

  test.skip('Agents tab shows "Assign Agent" button', async ({ page }) => {
    await page.goto('/dashboard/projects')
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 10_000 })

    // Select first project
    const firstCard = page.locator('[class*="space-y-1"] > div').first()
    if (await firstCard.count() === 0) {
      test.skip(true, 'No projects available')
      return
    }
    await firstCard.click()

    // Click the Agents tab
    await page.getByRole('tab', { name: 'Agents' }).click()

    // "Assign Agent" button should be visible
    const assignBtn = page.getByRole('button', { name: /assign agent/i })
    await expect(assignBtn).toBeVisible()
  })

  test.skip('"Assign Agent" button opens dialog', async ({ page }) => {
    await page.goto('/dashboard/projects')
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 10_000 })

    const firstCard = page.locator('[class*="space-y-1"] > div').first()
    if (await firstCard.count() === 0) {
      test.skip(true, 'No projects available')
      return
    }
    await firstCard.click()

    await page.getByRole('tab', { name: 'Agents' }).click()
    await page.getByRole('button', { name: /assign agent/i }).click()

    // Dialog with "Assign Agents" heading should appear
    await expect(page.getByRole('heading', { name: /assign agents/i })).toBeVisible()
  })
})

test.describe('Projects Page — Responsive', () => {
  test('no horizontal overflow at 375px width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard/projects')

    // Even before auth, the page (or redirect) should not overflow
    const body = page.locator('body')
    const box = await body.boundingBox()
    expect(box?.width).toBeLessThanOrEqual(375)
  })
})
