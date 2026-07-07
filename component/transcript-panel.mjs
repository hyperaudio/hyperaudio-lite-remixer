/**
 * transcript-panel.mjs — the source-transcript panel, de-Popcorned.
 *
 * First increment of the port: the old pad drove transcript highlighting +
 * click-to-seek through a Popcorn `transcript` plugin. This does the same job
 * with the vanilla `hyperaudio-lite` library and no Popcorn — the transcript
 * layer the finished <hyperaudio-pad> will build on.
 *
 * It consumes the same fixtures as the characterization harness, rendered in
 * hyperaudio-lite's `<span data-m data-d>` format (millisecond timings) via the
 * shared converter.
 */
import { HyperaudioLite } from './vendor/hyperaudio-lite.mjs';
import { toHypertranscript } from '../test/tools/hypertranscript.mjs';

export async function mountTranscriptPanel(options = {}) {
  const {
    transcriptId = 'hypertranscript',
    playerId = 'hyperplayer',
    clip = 'clip-a',
    fixtureBase = '../test/fixtures',
  } = options;

  const transcriptEl = document.getElementById(transcriptId);
  const playerEl = document.getElementById(playerId);

  const json = await fetch(`${fixtureBase}/transcripts/${clip}.json`).then(r => r.json());
  const mediaUrl = `${fixtureBase}/media/${clip}.mp4`;

  // Build the transcript DOM BEFORE instantiating — hyperaudio-lite reads the
  // words ([data-m]) and the media source ([data-media-src]) at construction.
  transcriptEl.innerHTML =
    `<article><section data-media-src="${mediaUrl}">` +
    toHypertranscript(json, { wordTag: 'span', duration: true }) +
    `</section></article>`;
  playerEl.src = mediaUrl;

  const hla = new HyperaudioLite({
    transcript: transcriptId,
    player: playerId,
    autoScroll: true,
    playOnClick: true,
  });

  // Test/debug surface, mirroring the old harness's window.__HA_TEST__.
  window.__PANEL__ = { hla, clip, mediaUrl };
  return { hla, clip, mediaUrl };
}
