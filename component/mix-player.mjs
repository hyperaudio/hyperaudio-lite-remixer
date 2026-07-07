/**
 * mix-player.mjs — the multi-source clip scheduler (vanilla, no Popcorn).
 *
 * Drives a single <video> element from a Mix: plays the clips back-to-back as
 * one timeline, swapping the media `src` at clip boundaries, and maps mix-time
 * seeks onto the right clip. This is the vanilla reimplementation of the old
 * pad's Projector.manager/cue sequencing — which already ran on native <video>
 * events, so no Popcorn was involved.
 *
 * Boundary timing: each clip's exact end is known from the word durations
 * (clip.end + clip.trim, in source seconds), so we switch precisely there. We
 * watch it with requestAnimationFrame (frame-accurate) and keep a `timeupdate`
 * listener as a fallback for when rAF is throttled (e.g. a backgrounded tab).
 *
 * (v1 uses one video element; the old pad used two for gapless swaps. Two-element
 * preloading can layer on next to remove the reload gap without changing this API.)
 */
export class MixPlayer {
  constructor(video, mix) {
    this.video = video;
    this.mix = mix;
    this.index = 0;
    this._playing = false;
    this._loadedSrc = null;
    this._raf = 0;
    this.onClipChange = null;
    this.onEnded = null;
    this._tick = this._tick.bind(this);
    this._onTime = () => this._checkBoundary();
    this.video.addEventListener('timeupdate', this._onTime);
  }

  /** Point the video at clip[i] and cue it to the clip's in-point. */
  async _loadClip(i) {
    const clip = this.mix.clips[i];
    if (!clip) return;
    this.index = i;
    if (this._loadedSrc !== clip.src) {
      this._loadedSrc = clip.src;
      this.video.src = clip.src;
      await new Promise(resolve =>
        this.video.addEventListener('loadedmetadata', resolve, { once: true })
      );
    }
    this.video.currentTime = clip.start;
    if (this.onClipChange) this.onClipChange(i, clip);
  }

  async play() {
    this._playing = true;
    if (!this.mix.clips.length) return;
    if (this._loadedSrc === null) await this._loadClip(this.index); // fresh start → cue clip 0
    await this.video.play();
    this._startTicking();
  }

  pause() {
    this._playing = false;
    this._stopTicking();
    this.video.pause();
  }

  /** Seek the whole mix to a mix-timeline time (seconds). */
  async seek(globalTime) {
    const at = this.mix.clipAt(globalTime);
    if (!at) return;
    await this._loadClip(at.index);
    this.video.currentTime = at.clip.start + at.offset;
  }

  /** Current position on the mix timeline (seconds). */
  currentMixTime() {
    const clip = this.mix.clips[this.index];
    if (!clip) return 0;
    return clip.totalStart + Math.max(0, this.video.currentTime - clip.start);
  }

  // --- boundary detection ---------------------------------------------------

  /** The source-time at which the current clip should hand off. */
  _boundary() {
    const clip = this.mix.clips[this.index];
    return clip ? clip.end + clip.trim : Infinity;
  }

  /** Returns true (and advances) if the current clip has reached its end. */
  _checkBoundary() {
    if (!this._playing) return false;
    if (this.video.currentTime >= this._boundary()) {
      this._advance();
      return true;
    }
    return false;
  }

  _startTicking() {
    this._stopTicking();
    this._raf = requestAnimationFrame(this._tick);
  }

  _stopTicking() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
  }

  _tick() {
    if (!this._playing) return;
    if (this._checkBoundary()) return; // _advance re-arms the loop
    this._raf = requestAnimationFrame(this._tick);
  }

  _advance() {
    this._stopTicking();
    if (this.index + 1 < this.mix.clips.length) {
      this._loadClip(this.index + 1).then(() => {
        if (this._playing) {
          this.video.play();
          this._startTicking();
        }
      });
    } else {
      this._playing = false;
      this.video.pause();
      if (this.onEnded) this.onEnded();
    }
  }

  destroy() {
    this._stopTicking();
    this.video.removeEventListener('timeupdate', this._onTime);
  }
}
