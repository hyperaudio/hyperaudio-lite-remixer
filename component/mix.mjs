/**
 * mix.mjs — the mix model (vanilla, DOM-free, no Popcorn).
 *
 * A mix is an ordered list of clips. Each clip is a time-range of a source
 * medium: { src, start, end } in seconds. The model lays the clips out on one
 * continuous "mix timeline" (totalStart..totalEnd per clip), which is what the
 * scheduler plays back and seeks against.
 *
 * This replaces the old pad's HTML-as-data representation with an explicit clip
 * list (per the Step 0 recommendation); it can still serialize to/from
 * hypertranscript spans for interop with the editor.
 */
export class Mix {
  constructor({ trim = 0 } = {}) {
    this.clips = [];
    // Extra tail seconds played after the last word. Default 0 => cut exactly at
    // the last word's end (which we know from data-d). The old pad hard-coded 1s
    // because it had no per-word durations; that overrun is what made switches
    // feel late. Kept as a knob for a future user-facing trim control.
    this.trim = trim;
    this.duration = 0;
  }

  addClip({ src, start, end, trim }, at) {
    const t = trim == null ? this.trim : trim;
    const clip = { src, start, end, trim: t, duration: end - start + t };
    if (at == null || at >= this.clips.length) this.clips.push(clip);
    else this.clips.splice(at, 0, clip);
    this._recompute();
    return clip;
  }

  removeClip(index) {
    this.clips.splice(index, 1);
    this._recompute();
  }

  _recompute() {
    let t = 0;
    for (const c of this.clips) {
      c.duration = c.end - c.start + c.trim; // exact play-out length of this clip
      c.totalStart = t;
      t += c.duration;
      c.totalEnd = t;
    }
    this.duration = t;
  }

  /** Map a mix-timeline time to { index, offset, clip }. */
  clipAt(globalTime) {
    if (!this.clips.length) return null;
    for (let i = 0; i < this.clips.length; i++) {
      const c = this.clips[i];
      if (globalTime < c.totalEnd || i === this.clips.length - 1) {
        return { index: i, offset: Math.max(0, globalTime - c.totalStart), clip: c };
      }
    }
    return null;
  }

  /**
   * Build a clip descriptor from a run of hypertranscript word elements
   * (<span data-m data-d> or <a data-m>) plus the source media url.
   * end uses the last word's data-m + data-d when available (more accurate than
   * the old pad, which used the last word's start time as the end).
   */
  static clipFromWords(words, src) {
    const ms = el => parseInt(el.getAttribute('data-m'), 10);
    const first = words[0];
    const last = words[words.length - 1];
    const start = ms(first) / 1000;
    const lastD = last.getAttribute('data-d');
    const end = (ms(last) + (lastD ? parseInt(lastD, 10) : 0)) / 1000;
    return { src, start, end };
  }
}
