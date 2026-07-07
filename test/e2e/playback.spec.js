const { test, expect } = require('@playwright/test');
const {
  loadClip,
  switchTranscript,
  addClip,
  waitForContent,
  readContent,
} = require('./helpers');

test.describe('multi-source remix playback', () => {
  // The behaviour hyperaudio-lite cannot do natively, so it's the most important
  // to pin down: a mix spanning two source videos plays them as one sequential
  // timeline, switching sources at clip boundaries.
  test('a two-source mix builds one sequential, non-overlapping timeline', async ({ page }) => {
    await loadClip(page, 'clip-a');
    await addClip(page, { count: 8, startIndex: 0 });

    await switchTranscript(page, 'clip-b');
    await addClip(page, { count: 8, startIndex: 0 });

    await waitForContent(page, 2);
    const content = await readContent(page);

    expect(content[0].mp4).toContain('clip-a.mp4');
    expect(content[1].mp4).toContain('clip-b.mp4');

    // Clip 2 starts on the global timeline where clip 1 ended — no overlap.
    expect(content[0].totalStart).toBeCloseTo(0, 3);
    expect(content[1].totalStart).toBeGreaterThanOrEqual(content[0].totalEnd - 0.001);
  });

  test('clips cut at the last word end (data-d), no 1s overrun', async ({ page }) => {
    await loadClip(page, 'clip-a');
    await addClip(page, { count: 5, startIndex: 0 });
    await waitForContent(page, 1);

    const c = await page.evaluate(() => {
      const clip = window.__HA_TEST__.instances.Projector.content[0];
      const words = clip.element.getElementsByTagName('a');
      const last = words[words.length - 1];
      const lastWordEnd =
        (parseInt(last.getAttribute('data-m'), 10) + parseInt(last.getAttribute('data-d'), 10)) *
        clip.unit;
      return {
        end: clip.end,
        trim: clip.trim,
        lastWordEnd,
        span: clip.totalEnd - clip.totalStart,
        startToEnd: clip.end - clip.start,
      };
    });

    expect(c.trim).toBe(0); // no arbitrary 1-second tail
    expect(c.end).toBeCloseTo(c.lastWordEnd, 3); // cut exactly at the last word's end
    expect(c.span).toBeCloseTo(c.startToEnd, 3); // timeline uses the exact clip length
  });

  test('seeking into the second clip switches the projector to that source', async ({ page }) => {
    await loadClip(page, 'clip-a');
    await addClip(page, { count: 8, startIndex: 0 });
    await switchTranscript(page, 'clip-b');
    await addClip(page, { count: 8, startIndex: 0 });
    await waitForContent(page, 2);

    const content = await readContent(page);
    const intoClip2 = content[1].totalStart + 0.1;

    await page.evaluate(t => {
      window.__HA_TEST__.instances.Projector.currentTime(t, false);
    }, intoClip2);

    await page.waitForFunction(
      () => window.__HA_TEST__.instances.Projector.contentIndex === 1
    );
  });
});
