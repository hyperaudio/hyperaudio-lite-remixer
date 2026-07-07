// <hyperaudio-remixer> custom element (Step 4): the assembled component wrapping
// the vanilla remix stack, following HLE conventions (light DOM, document
// CustomEvents). Scheduler behaviours are covered by scheduler.spec.js (which
// drives this same element); here we assert the custom-element contract itself.
const { test, expect } = require('@playwright/test');

async function openReady(page) {
  await page.goto('/component/remixer-demo.html');
  await page.waitForFunction(() => {
    const el = document.querySelector('hyperaudio-remixer');
    return el && el.ready;
  });
}

test.describe('<hyperaudio-remixer> custom element', () => {
  test('is defined, uses light DOM, and renders its transcript — no Popcorn', async ({ page }) => {
    await openReady(page);

    expect(await page.evaluate(() => !!customElements.get('hyperaudio-remixer'))).toBe(true);
    // Light DOM (no shadow root) so host CSS/theme reaches it — the HLE convention.
    expect(
      await page.evaluate(() => document.querySelector('hyperaudio-remixer').shadowRoot)
    ).toBeNull();
    await expect(page.locator('hyperaudio-remixer #hr-transcript span[data-m]')).toHaveCount(87);
    expect(await page.evaluate(() => typeof window.Popcorn)).toBe('undefined');
  });

  test('emits bubbling hyperaudio* events on clip add / mix change', async ({ page }) => {
    await openReady(page);

    await page.evaluate(() => {
      window.__events = [];
      ['hyperaudioRemixerClipAdded', 'hyperaudioRemixerMixChanged'].forEach(t =>
        document.addEventListener(t, e =>
          window.__events.push({ type: e.type, clips: e.detail.clips && e.detail.clips.length })
        )
      );
    });
    await page.evaluate(() =>
      document.querySelector('hyperaudio-remixer').addClip({ startIndex: 0, count: 5 })
    );

    const types = await page.evaluate(() => window.__events.map(e => e.type));
    expect(types).toContain('hyperaudioRemixerClipAdded');
    expect(types).toContain('hyperaudioRemixerMixChanged');
  });

  test('selection does not over-capture the word after it (off-by-one)', async ({ page }) => {
    await openReady(page);

    const text = await page.evaluate(() => {
      const el = document.querySelector('hyperaudio-remixer');
      const spans = [...el.querySelectorAll('#hr-transcript span[data-m]')];
      // End the selection exactly at the START of word 4 — the boundary that
      // Range.intersectsNode() would wrongly count as selecting word 4.
      const range = document.createRange();
      range.setStart(spans[0].firstChild, 0);
      range.setEnd(spans[3], 0);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      el.addSelection();
      return el.querySelector('#hr-stage .hr-clip').firstChild.textContent;
    });

    // Words 0..2 only — "Hey" (word 3) must NOT be included.
    expect(text).toBe('Hello, hello. Okay.');
  });

  test('builds a two-source mix through the element API', async ({ page }) => {
    await openReady(page);

    await page.evaluate(async () => {
      const r = document.querySelector('hyperaudio-remixer');
      await r.loadSource('clip-a');
      r.addClip({ startIndex: 0, count: 8 });
      await r.loadSource('clip-b');
      r.addClip({ startIndex: 0, count: 8 });
    });

    const srcs = await page.evaluate(() =>
      document.querySelector('hyperaudio-remixer').mix.clips.map(c => c.src.split('/').pop())
    );
    expect(srcs).toEqual(['clip-a.mp4', 'clip-b.mp4']);
    await expect(page.locator('hyperaudio-remixer .hr-clip')).toHaveCount(2);
  });
});
