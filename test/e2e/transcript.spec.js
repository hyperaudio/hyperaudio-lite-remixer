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

  test('words are greyed ahead of the playhead and cleared behind it', async ({ page }) => {
    await loadClip(page, 'clip-a');

    // At t=0 most words are still in the future → greyed.
    const initialGrey = await page.evaluate(
      () => document.querySelectorAll('#transcript a.transcript-grey').length
    );
    expect(initialGrey).toBeGreaterThan(0);

    // Play from ~word 20, let the highlighter run, then freeze and inspect.
    await page.locator('#transcript a[data-m]').nth(20).click();
    await page.waitForTimeout(700);
    const state = await page.evaluate(() => {
      const v = document.querySelector('#video-source video');
      v.pause();
      const t = v.currentTime * 1000;
      const words = [...document.querySelectorAll('#transcript a[data-m]')];
      const grey = w => w.classList.contains('transcript-grey');
      const past = words.filter(w => +w.getAttribute('data-m') < t - 600);
      const future = words.filter(w => +w.getAttribute('data-m') > t + 600);
      return {
        pastCleared: past.length > 0 && past.every(w => !grey(w)),
        futureGrey: future.length > 0 && future.every(w => grey(w)),
      };
    });
    expect(state.pastCleared).toBe(true); // words behind the playhead are un-greyed
    expect(state.futureGrey).toBe(true); // words ahead stay greyed
  });
});
