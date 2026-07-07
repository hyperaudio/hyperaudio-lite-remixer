/**
 * hypertranscript.mjs — convert word-timed STT JSON into hypertranscript HTML.
 *
 * Pure ES module, no Node/browser-specific APIs, so it runs in both the
 * fixture generator (Node) and the in-browser api stub.
 *
 * Input JSON shape (Whisper/Deepgram-style, times in SECONDS):
 *   { words: [{ start, end, text }], paragraphs: [{ start, end }] }
 *
 * Output is hypertranscript HTML with millisecond timings, in one of two
 * flavours:
 *   - pad  : <p><a data-m="1280">Hello </a> ...</p>          (old Hyperaudio Pad)
 *   - hle  : <p><span data-m="1280" data-d="440">Hello </span> ...</p>  (HLE / hyperaudio-lite)
 */

const esc = s =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const toMs = seconds => Math.round(seconds * 1000);

/**
 * Slice a transcript to the window [t0, t1) (seconds) and rebase times so the
 * window starts at 0 — used to make a clip's transcript line up with a clip's
 * media that was cut from the same offset.
 */
export function sliceWords(data, t0, t1) {
  const words = (data.words || [])
    .filter(w => w.start >= t0 && w.start < t1)
    .map(w => ({
      start: +(w.start - t0).toFixed(3),
      end: +(Math.min(w.end == null ? w.start : w.end, t1) - t0).toFixed(3),
      text: w.text,
    }));

  const paragraphs = (data.paragraphs || [])
    .filter(p => p.end > t0 && p.start < t1)
    .map(p => ({
      start: +Math.max(0, p.start - t0).toFixed(3),
      end: +(Math.min(p.end, t1) - t0).toFixed(3),
    }));

  return { words, paragraphs };
}

/**
 * Render { words, paragraphs } to a hypertranscript HTML string.
 *
 * opts:
 *   wordTag   'a' (default) | 'span'
 *   duration  false (default) | true — emit data-d (word duration in ms)
 */
export function toHypertranscript(data, opts = {}) {
  const wordTag = opts.wordTag || 'a';
  const withDuration = !!opts.duration;
  const words = data.words || [];
  const paras = data.paragraphs && data.paragraphs.length ? data.paragraphs : null;

  const wordHTML = w => {
    const m = toMs(w.start);
    const end = w.end == null ? w.start : w.end;
    const d = withDuration ? ` data-d="${Math.max(0, toMs(end) - m)}"` : '';
    // Trailing space kept inside the tag so text selections read naturally.
    return `<${wordTag} data-m="${m}"${d}>${esc(w.text)} </${wordTag}>`;
  };

  // Bucket words into their containing paragraph (paragraphs are contiguous).
  const groups = [];
  if (paras) {
    let pi = 0;
    for (const w of words) {
      while (pi < paras.length - 1 && w.start >= paras[pi].end) pi++;
      (groups[pi] = groups[pi] || []).push(w);
    }
  } else {
    groups[0] = words;
  }

  return groups
    .filter(Boolean)
    .map(g => `<p>${g.map(wordHTML).join('')}</p>`)
    .join('\n');
}
