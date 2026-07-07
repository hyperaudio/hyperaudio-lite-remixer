// Multi-source mix scheduler (Step 3, crown jewel): the vanilla, Popcorn-free
// reimplementation of the old pad's remix playback. Mirrors playback.spec.js
// (which pins these behaviours on the old-app oracle).
const { test, expect } = require('@playwright/test');

async function openPad(page) {
  await page.goto('/component/remixer-demo.html');
  await page.waitForFunction(() => window.__PAD__ && window.__PAD__.ready);
}

async function loadSource(page, clip) {
  await page.evaluate(c => window.__PAD__.loadSource(c), clip);
  await page.waitForFunction(
    c =>
      document.querySelectorAll('#hr-transcript span[data-m]').length > 0 &&
      window.__PAD__.currentSrc &&
      window.__PAD__.currentSrc.includes(c),
    clip
  );
}

async function addClip(page, opts) {
  return page.evaluate(o => window.__PAD__.addClip(o), opts);
}

async function buildTwoSourceMix(page, count = 8) {
  await openPad(page);
  await loadSource(page, 'clip-a');
  await addClip(page, { startIndex: 0, count });
  await loadSource(page, 'clip-b');
  await addClip(page, { startIndex: 0, count });
  await page.waitForFunction(() => window.__PAD__.mix.clips.length === 2);
}

test.describe('multi-source mix scheduler (vanilla, no Popcorn)', () => {
  test('builds one sequential, non-overlapping two-source timeline', async ({ page }) => {
    await buildTwoSourceMix(page);

    const clips = await page.evaluate(() =>
      window.__PAD__.mix.clips.map(c => ({
        src: c.src,
        totalStart: c.totalStart,
        totalEnd: c.totalEnd,
      }))
    );

    expect(clips.map(c => c.src.split('/').pop())).toEqual(['clip-a.mp4', 'clip-b.mp4']);
    expect(clips[0].totalStart).toBeCloseTo(0, 3);
    expect(clips[1].totalStart).toBeGreaterThanOrEqual(clips[0].totalEnd - 0.001);

    // And there is genuinely no Popcorn behind this playback.
    expect(await page.evaluate(() => typeof window.Popcorn)).toBe('undefined');
  });

  test('seeking into the second clip switches the mix video to that source', async ({ page }) => {
    await buildTwoSourceMix(page);

    const intoClip2 = await page.evaluate(() => window.__PAD__.mix.clips[1].totalStart + 0.1);
    await page.evaluate(t => window.__PAD__.mixPlayer.seek(t), intoClip2);

    await page.waitForFunction(() => window.__PAD__.mixPlayer.index === 1);
    const src = await page.evaluate(() => document.querySelector('#hr-mix-player').src);
    expect(src).toContain('clip-b.mp4');
  });

  test('playing advances across the clip boundary to the next source', async ({ page }) => {
    await buildTwoSourceMix(page, 6);

    // Start playback just before clip 1 ends, so the boundary arrives quickly.
    await page.evaluate(async () => {
      const { mixPlayer, mix } = window.__PAD__;
      await mixPlayer.seek(mix.clips[0].totalEnd - 0.4);
      await mixPlayer.play();
    });

    await page.waitForFunction(() => window.__PAD__.mixPlayer.index === 1, null, { timeout: 8000 });
    const src = await page.evaluate(() => document.querySelector('#hr-mix-player').src);
    expect(src).toContain('clip-b.mp4');
  });
});
