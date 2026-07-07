const { test, expect } = require('@playwright/test');
const { loadClip, addClip, waitForContent } = require('./helpers');

test.describe('mix persistence', () => {
  test('saving a mix persists it; reloading ?m=<id> reconstructs the clips', async ({ page }) => {
    await loadClip(page, 'clip-a');
    await addClip(page, { count: 6, startIndex: 0 });
    await addClip(page, { count: 5, startIndex: 12 });
    await waitForContent(page, 2);

    // Save through the real button, wait for the save round-trip to complete.
    await page.evaluate(() => {
      window.__saved = null;
      window.__HA_TEST__.instances.Stage.target.addEventListener(
        'ha:save',
        () => (window.__saved = window.HA.api.mix && window.HA.api.mix._id),
        { once: true }
      );
    });
    await page.locator('#save-button').click();
    await page.waitForFunction(() => window.__saved);
    const mixId = await page.evaluate(() => window.__saved);
    expect(mixId).toBeTruthy();

    // Reload as a saved mix — the stage must rebuild from stored HTML.
    await page.goto(`/pad.test.html?m=${mixId}`);
    await page.waitForFunction(
      () => document.querySelectorAll('#stage article section').length > 0
    );
    await expect(page.locator('#stage article section')).toHaveCount(2);

    // The reconstructed clips still carry their source media + words.
    const ok = await page.evaluate(() => {
      const secs = document.querySelectorAll('#stage article section');
      return (
        secs[0].getAttribute('data-mp4').includes('clip-a.mp4') &&
        secs[0].querySelectorAll('a[data-m]').length > 0
      );
    });
    expect(ok).toBe(true);
  });
});
