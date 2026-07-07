/**
 * mix-player.mjs — the multi-source clip scheduler (vanilla, no Popcorn).
 *
 * Drives a single <video> element from a Mix: plays the clips back-to-back as
 * one timeline, swapping the media `src` at clip boundaries, and maps mix-time
 * seeks onto the right clip. This is the vanilla reimplementation of the old
 * pad's Projector.manager/cue sequencing — which already ran on native <video>
 * `timeupdate`, so no Popcorn was involved to begin with.
 *
 * (v1 uses one video element; the old pad used two for gapless cross-fades.
 * Two-element preloading can be layered on later without changing this API.)
 */
export class MixPlayer {
  constructor(video, mix) {
    this.video = video;
    this.mix = mix;
    this.index = 0;
    this._playing = false;
    this._loadedSrc = null;
    this.onClipChange = null;
    this.onEnded = null;
    this._onTime = this._onTime.bind(this);
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
  }

  pause() {
    this._playing = false;
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

  _onTime() {
    if (!this._playing) return;
    const clip = this.mix.clips[this.index];
    if (!clip) return;
    // Advance once this clip has played out to end + trim.
    if (this.video.currentTime >= clip.end + clip.trim - 0.02) {
      if (this.index + 1 < this.mix.clips.length) {
        this._loadClip(this.index + 1).then(() => {
          if (this._playing) this.video.play();
        });
      } else {
        this._playing = false;
        this.video.pause();
        if (this.onEnded) this.onEnded();
      }
    }
  }

  destroy() {
    this.video.removeEventListener('timeupdate', this._onTime);
  }
}
