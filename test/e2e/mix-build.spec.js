const { test, expect } = require('@playwright/test');
const { loadClip, addClip, addEffect, waitForContent, readContent } = require('./helpers');

test.describe('building a mix', () => {
  test('dragging a phrase adds an ordered clip carrying its source media', async ({ page }) => {
    await loadClip(page, 'clip-a');

    const r1 = await addClip(page, { count: 5, startIndex: 0 });
    expect(r1.sections).toBe(1);
    await waitForContent(page, 1);
    let content = await readContent(page);
    expect(content[0].mp4).toContain('clip-a.mp4');

    const r2 = await addClip(page, { count: 4, startIndex: 12 });
    expect(r2.sections).toBe(2);
    await waitForContent(page, 2);

    // Order preserved: the first section holds the earlier words.
    const [first, second] = await page.evaluate(() => {
      const secs = window.__HA_TEST__.instances.Stage.article.querySelectorAll('section');
      return [0, 1].map(i =>
        parseInt(secs[i].querySelector('a[data-m]').getAttribute('data-m'), 10)
      );
    });
    expect(first).toBeLessThan(second);
  });

  test('dropping a Fade effect inserts an effect section and fires ha:change', async ({ page }) => {
    await loadClip(page, 'clip-a');
    await addClip(page, { count: 5 });

    await page.evaluate(() => {
      window.__chg = 0;
      window.__HA_TEST__.instances.Stage.target.addEventListener('ha:change', () => window.__chg++);
    });

    await addEffect(page, 'fade');

    await expect(page.locator('#stage section[data-effect="fade"]')).toHaveCount(1);
    expect(await page.evaluate(() => window.__chg)).toBeGreaterThan(0);
  });
});
