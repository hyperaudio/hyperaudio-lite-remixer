// Shared helpers for the pad characterization tests.
//
// Per the agreed "hybrid" approach: robust actions (load, click-word, play, save)
// go through the real UI; the flaky legacy pointer gestures (phrase-drag,
// word-select) are driven by invoking the same internal path the gesture ends in
// (stage.dropped with a built <section>) so we assert on real engine outcomes.

const PAGE = '/pad.test.html';

/** Load a fixture transcript the way the app does (URL param → transcript.load). */
async function loadClip(page, id = 'clip-a') {
  await page.goto(`${PAGE}?t=${id}`);
  await page.waitForFunction(
    () => document.querySelectorAll('#transcript a[data-m]').length > 0
  );
  await page.waitForSelector('#video-source video');
  // Wait for metadata so seeks/currentTime are meaningful.
  await page.waitForFunction(() => {
    const v = document.querySelector('#video-source video');
    return v && v.readyState >= 1;
  });
}

/**
 * Switch the loaded source transcript WITHOUT navigating (mirrors the sidemenu's
 * transcript.load) so an in-progress stage/mix is preserved. Needed to build a
 * mix that spans two source videos.
 */
async function switchTranscript(page, id) {
  await page.evaluate(i => window.__HA_TEST__.instances.Transcript.load(i), id);
  await page.waitForFunction(
    i => {
      const m = window.__HA_TEST__.instances.Transcript.options.media;
      return m && typeof m.mp4 === 'string' && m.mp4.includes(i);
    },
    id
  );
}

/**
 * Add a clip (a run of the currently-loaded transcript's words) onto the stage,
 * reproducing Transcript.selectorize's drop handler, then wiring it via
 * stage.dropped — the exact engine path a real phrase-drag ends in.
 * Returns { sections, mp4 }.
 */
async function addClip(page, opts = {}) {
  const { count = 6, startIndex = 0 } = opts;
  return page.evaluate(
    ({ count, startIndex }) => {
      const { Transcript: transcript, Stage: stage } = window.__HA_TEST__.instances;
      const t = transcript.options;
      const o = stage.options;

      const words = Array.from(document.querySelectorAll('#transcript a[data-m]')).slice(
        startIndex,
        startIndex + count
      );
      const wordsHTML = words
        .map(w => `<a data-m="${w.getAttribute('data-m')}">${w.textContent}</a>`)
        .join('');

      const el = document.createElement('section');
      el.innerHTML = wordsHTML + '<div class="actions"></div>';

      const m = t.media;
      if (m.id) el.setAttribute(o.idAttr, m.id);
      if (m.transcript) el.setAttribute(o.transAttr, m.transcript);
      if (m.mp4) el.setAttribute(o.mp4Attr, m.mp4);
      if (m.webm) el.setAttribute(o.webmAttr, m.webm);
      if (m.youtube) el.setAttribute(o.ytAttr, m.youtube);
      if (m.mpeg) el.setAttribute(o.mpegAttr, m.mpeg);
      el.setAttribute(o.unitAttr, t.unit);

      stage.article.appendChild(el);
      stage.dropped(el);

      return {
        sections: stage.article.querySelectorAll('section').length,
        mp4: m.mp4,
      };
    },
    { count, startIndex }
  );
}

/** Drop an effect section (fade|trim|title) onto the stage, as hap.js does. */
async function addEffect(page, kind = 'fade') {
  return page.evaluate(k => {
    const { Stage: stage } = window.__HA_TEST__.instances;
    const el = document.createElement('section');
    el.setAttribute('data-effect', k);
    el.className += ' effect';
    el.innerHTML =
      '<form onsubmit="return false"><label>' +
      k +
      ': <span class="value">1</span>s</label>' +
      '<input id="effect-duration" type="range" value="1" min="0" max="5" step="0.1"></form>';
    stage.article.appendChild(el);
    stage.dropped(el, k);
    return stage.article.querySelectorAll('section[data-effect]').length;
  }, kind);
}

/** Wait until the projector has (re)built its content timeline to `n` clips. */
async function waitForContent(page, n) {
  await page.waitForFunction(expected => {
    const p = window.__HA_TEST__.instances.Projector;
    return p && Array.isArray(p.content) && p.content.length === expected;
  }, n);
}

/** Snapshot the projector's computed timeline for assertions. */
async function readContent(page) {
  return page.evaluate(() => {
    const p = window.__HA_TEST__.instances.Projector;
    return (p.content || []).map(c => ({
      mp4: c.media && c.media.mp4,
      start: c.start,
      end: c.end,
      totalStart: c.totalStart,
      totalEnd: c.totalEnd,
    }));
  });
}

module.exports = {
  PAGE,
  loadClip,
  switchTranscript,
  addClip,
  addEffect,
  waitForContent,
  readContent,
};
