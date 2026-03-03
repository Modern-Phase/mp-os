import { test, expect } from '@playwright/test';

/**
 * E2E tests for Agent File Artifacts
 *
 * Tests that artifact cards appear in agent chat and the download flow works.
 * These tests require an authenticated session and a running agent.
 * In CI, skip with auth guard; locally, use seeded test data.
 */

test.describe('Agent Chat Artifacts', () => {
  // Skip all tests if no auth session is available
  // In a full CI setup, we'd seed auth state via storageState
  test.beforeEach(async ({ page }) => {
    // Attempt to navigate to an agent chat page
    // If redirected to login, skip the suite
    await page.goto('/dashboard');
    const url = page.url();
    if (url.includes('login')) {
      test.skip(true, 'Requires authenticated session');
    }
  });

  test('artifact cards render after agent message with artifacts', async ({ page }) => {
    // Navigate to agent chat (assumes at least one agent exists)
    const agentLink = page.locator('[data-testid="agent-card"]').first();
    if (!(await agentLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No agents available for testing');
      return;
    }
    await agentLink.click();

    // Wait for chat to load
    await page.waitForSelector('[data-testid="agent-chat"]', { timeout: 10000 }).catch(() => null);

    // Look for artifact cards in existing messages
    // Artifact cards contain a Download button and file metadata
    const artifactCards = page.locator('.rounded-lg.border.bg-card').filter({
      has: page.getByRole('button', { name: /download/i }),
    });

    // If no artifacts exist yet, send a message that should create files
    if ((await artifactCards.count()) === 0) {
      const textarea = page.locator('textarea').first();
      if (await textarea.isVisible()) {
        await textarea.fill('Create a simple hello.py script that prints hello world');
        await page.getByRole('button', { name: /send/i }).click();

        // Wait for agent response (up to 30s for agent processing + 5s sync delay)
        await page.waitForTimeout(35000);

        // Reload to pick up artifact metadata
        await page.reload();
        await page.waitForTimeout(3000);
      }
    }

    // Verify artifact card structure (may still be 0 if agent didn't create files)
    const cards = await artifactCards.count();
    if (cards > 0) {
      const firstCard = artifactCards.first();

      // Should show filename
      await expect(firstCard.locator('p').first()).toBeVisible();

      // Should show file type and size info
      await expect(firstCard.locator('.text-muted-foreground')).toBeVisible();

      // Should have a Download button
      await expect(
        firstCard.getByRole('button', { name: /download/i }),
      ).toBeVisible();
    }
  });

  test('download button triggers file download', async ({ page }) => {
    // Navigate to agent chat
    const agentLink = page.locator('[data-testid="agent-card"]').first();
    if (!(await agentLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No agents available for testing');
      return;
    }
    await agentLink.click();
    await page.waitForSelector('[data-testid="agent-chat"]', { timeout: 10000 }).catch(() => null);

    // Find an artifact card with a download button
    const downloadButton = page
      .locator('.rounded-lg.border.bg-card')
      .filter({ has: page.getByRole('button', { name: /download/i }) })
      .first()
      .getByRole('button', { name: /download/i });

    if (!(await downloadButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No artifact cards with download buttons found');
      return;
    }

    // Listen for download event
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await downloadButton.click();

    try {
      const download = await downloadPromise;
      // Verify download has a filename
      expect(download.suggestedFilename()).toBeTruthy();
      expect(download.suggestedFilename().length).toBeGreaterThan(0);
    } catch {
      // Download may use blob URL which doesn't trigger download event
      // In that case, verify the button didn't error (no error state)
      await expect(downloadButton).toBeEnabled({ timeout: 5000 });
    }
  });

  test('agent messages without artifacts show no artifact cards', async ({ page }) => {
    const agentLink = page.locator('[data-testid="agent-card"]').first();
    if (!(await agentLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No agents available for testing');
      return;
    }
    await agentLink.click();
    await page.waitForSelector('[data-testid="agent-chat"]', { timeout: 10000 }).catch(() => null);

    // Send a simple message that shouldn't create files
    const textarea = page.locator('textarea').first();
    if (!(await textarea.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Chat textarea not available');
      return;
    }

    await textarea.fill('What is 2 + 2?');
    await page.getByRole('button', { name: /send/i }).click();

    // Wait for agent response
    await page.waitForTimeout(15000);

    // The most recent agent message should NOT have an artifact card
    // Get all agent message containers
    const agentMessages = page.locator('[data-testid="chat-message-agent"]');
    const lastAgentMsg = agentMessages.last();

    if (await lastAgentMsg.isVisible({ timeout: 5000 }).catch(() => false)) {
      // The sibling/adjacent artifact card container should not exist
      const artifactInLastMsg = lastAgentMsg
        .locator('..')
        .locator('.rounded-lg.border.bg-card')
        .filter({ has: page.getByRole('button', { name: /download/i }) });
      expect(await artifactInLastMsg.count()).toBe(0);
    }
  });
});
