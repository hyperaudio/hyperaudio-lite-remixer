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
  constructor({ trim = 1 } = {}) {
    this.clips = [];
    this.trim = trim; // seconds the last word of a clip plays out (old pad default: 1)
    this.duration = 0;
  }

  addClip({ src, start, end }, at) {
    const clip = { src, start, end, trim: this.trim };
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
      c.totalStart = t;
      t += c.end + c.trim - c.start; // play-out duration of this clip
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
