const { test, expect } = require('@playwright/test');
const { loadClip } = require('./helpers');

test.describe('transcript loading & word interaction', () => {
  test('loads a fixture transcript and wires the source video', async ({ page }) => {
    await loadClip(page, 'clip-a');

    // Every timed word rendered as a clickable <a data-m>.
    await expect(page.locator('#transcript a[data-m]')).toHaveCount(87);

    // Source player points at the clip's media.
    const src = await page.evaluate(() => {
      const v = document.querySelector('#video-source video');
      return v.currentSrc || (v.querySelector('source') || {}).src || '';
    });
    expect(src).toContain('clip-a.mp4');
  });

  test('clicking a word seeks the source video to that word time', async ({ page }) => {
    await loadClip(page, 'clip-a');

    const word = page.locator('#transcript a[data-m]').nth(20);
    const target = await word.evaluate(el => parseInt(el.getAttribute('data-m'), 10) / 1000);

    await word.click();

    // Must JUMP to the word (~11.9s), not merely drift there via playback — so a
    // short timeout: a real seek is near-instant, drift-from-0 would take ~12s.
    // (This is what caught the missing HTTP Range support in the static server.)
    await page.waitForFunction(
      t => {
        const v = document.querySelector('#video-source video');
        return v && Math.abs(v.currentTime - t) < 1.5;
      },
      target,
      { timeout: 4000 }
    );
  });
});
