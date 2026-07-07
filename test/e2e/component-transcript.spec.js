// De-Popcorn source transcript (Step 3): the new hyperaudio-lite-driven panel
// must reproduce the same observable behaviours the old Popcorn transcript had —
// mirrors transcript.spec.js (which asserts them against the old pad oracle).
const { test, expect } = require('@playwright/test');

async function loadPanel(page, clip = 'clip-a') {
  await page.goto(`/component/transcript-panel.html?t=${clip}`);
  await page.waitForFunction(
    () => document.querySelectorAll('#hypertranscript span[data-m]').length > 0
  );
  await page.waitForFunction(() => {
    const v = document.querySelector('#hyperplayer');
    return v && v.readyState >= 1;
  });
}

test.describe('de-Popcorn source transcript (hyperaudio-lite)', () => {
  test('renders every timed word and wires the media — no Popcorn', async ({ page }) => {
    await loadPanel(page, 'clip-a');

    await expect(page.locator('#hypertranscript span[data-m]')).toHaveCount(87);

    const src = await page.evaluate(() => document.querySelector('#hyperplayer').currentSrc || '');
    expect(src).toContain('clip-a.mp4');

    // Confirm Popcorn really isn't involved.
    expect(await page.evaluate(() => typeof window.Popcorn)).toBe('undefined');
  });

  test('clicking a word seeks the media to that word time', async ({ page }) => {
    await loadPanel(page, 'clip-a');

    const word = page.locator('#hypertranscript span[data-m]').nth(20);
    const target = await word.evaluate(el => parseInt(el.getAttribute('data-m'), 10) / 1000);
    await word.click();

    await page.waitForFunction(
      t => {
        const v = document.querySelector('#hyperplayer');
        return v && Math.abs(v.currentTime - t) < 1.5;
      },
      target,
      { timeout: 4000 }
    );
  });

  test('the word under the playhead gets the active highlight', async ({ page }) => {
    await loadPanel(page, 'clip-a');

    await page.evaluate(() => {
      const v = document.querySelector('#hyperplayer');
      v.currentTime = 12;
      v.play();
    });

    await page.waitForFunction(
      () => document.querySelectorAll('#hypertranscript span.active').length > 0,
      null,
      { timeout: 6000 }
    );
    // Past words should be marked read.
    expect(
      await page.evaluate(() => document.querySelectorAll('#hypertranscript span.read').length)
    ).toBeGreaterThan(0);
  });
});
