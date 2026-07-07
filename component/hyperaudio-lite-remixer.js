/**
 * hyperaudio-lite-remixer.js — the <hyperaudio-remixer> custom element.
 *
 * Wraps the vanilla remix stack (hyperaudio-lite source transcript + Mix model +
 * MixPlayer scheduler) into a single light-DOM custom element, following the
 * Hyperaudio Lite Editor's conventions:
 *   - light DOM (no shadow root) so it inherits the host page's CSS/theme,
 *   - renders its UI in connectedCallback via this.innerHTML,
 *   - coordinates via document-bubbling CustomEvents (hyperaudio*-prefixed).
 *
 * Standalone today (it hosts its own source transcript from the fixtures); the
 * HLE integration step will add a mode that reads the editor's existing
 * #hypertranscript instead of loading its own.
 *
 * Single instance per page (hyperaudio-lite resolves elements by id).
 *
 * Public API: loadSource(clip) · addClip({startIndex,count}) · addSelection() ·
 * play() · pause(); properties: mix, mixPlayer, currentSrc, ready.
 * Events (bubble to document): hyperaudioRemixerReady, hyperaudioRemixerClipAdded,
 * hyperaudioRemixerMixChanged, hyperaudioRemixerClipChange.
 */
import { mountTranscriptPanel } from './transcript-panel.mjs';
import { Mix } from './mix.mjs';
import { MixPlayer } from './mix-player.mjs';

/**
 * True only when the selection genuinely overlaps a word's content — not when it
 * merely touches the word's leading boundary. Browser selections often set their
 * end at offset 0 of the *next* span; Range.intersectsNode() counts that as a hit
 * and captures a phantom trailing word (a classic off-by-one). Strict boundary
 * comparison excludes those touch-only spans.
 */
function rangeCoversWord(range, span) {
  const wr = document.createRange();
  wr.selectNodeContents(span);
  const covers =
    range.compareBoundaryPoints(Range.END_TO_START, wr) < 0 && // selection starts before word ends
    range.compareBoundaryPoints(Range.START_TO_END, wr) > 0; // selection ends after word starts
  wr.detach && wr.detach();
  return covers;
}

const TEMPLATE = `
  <div class="hr-cols">
    <div class="hr-col hr-source">
      <strong>Source</strong>
      <div class="hr-toolbar" data-role="source-buttons"></div>
      <video id="hr-player" controls playsinline></video>
      <div id="hr-transcript"></div>
    </div>
    <div class="hr-col hr-mix">
      <strong>Mix</strong>
      <div class="hr-toolbar">
        <button data-role="play">Play</button>
        <button data-role="pause">Pause</button>
        <button data-role="add">Add selection to mix</button>
      </div>
      <video id="hr-mix-player" controls playsinline></video>
      <div id="hr-stage"></div>
    </div>
  </div>
`;

class HyperaudioRemixer extends HTMLElement {
  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;

    this.ready = false;
    this.currentSrc = null;
    this.currentClip = null;
    this._hla = null;

    this.innerHTML = TEMPLATE;

    this.mix = new Mix();
    this.mixPlayer = new MixPlayer(this.querySelector('#hr-mix-player'), this.mix);
    this._stageEl = this.querySelector('#hr-stage');
    this.mixPlayer.onClipChange = i => {
      [...this._stageEl.children].forEach((el, n) => el.classList.toggle('playing', n === i));
      this._emit('hyperaudioRemixerClipChange', { index: i });
    };

    // Source buttons from the `sources` attribute (fixtures, for standalone use).
    this._sources = (this.getAttribute('sources') || 'clip-a').split(',').map(s => s.trim());
    const btnBar = this.querySelector('[data-role="source-buttons"]');
    for (const clip of this._sources) {
      const b = document.createElement('button');
      b.textContent = `Load ${clip}`;
      b.addEventListener('click', () => this.loadSource(clip));
      btnBar.appendChild(b);
    }

    this.querySelector('[data-role="play"]').addEventListener('click', () => this.play());
    this.querySelector('[data-role="pause"]').addEventListener('click', () => this.pause());
    this.querySelector('[data-role="add"]').addEventListener('click', () => this.addSelection());

    this.loadSource(this._sources[0]).then(() => {
      this.ready = true;
      this._emit('hyperaudioRemixerReady', {});
    });
  }

  disconnectedCallback() {
    if (this.mixPlayer) this.mixPlayer.destroy();
    if (this._hla && this._hla.destroy) this._hla.destroy();
  }

  async loadSource(clip) {
    if (this._hla && this._hla.destroy) {
      try { this._hla.destroy(); } catch (e) {}
    }
    const { hla, mediaUrl } = await mountTranscriptPanel({
      clip,
      transcriptId: 'hr-transcript',
      playerId: 'hr-player',
    });
    this._hla = hla;
    this.currentSrc = mediaUrl;
    this.currentClip = clip;
  }

  _words() {
    return [...this.querySelectorAll('#hr-transcript span[data-m]')];
  }

  addClip({ startIndex = 0, count = 6 } = {}) {
    const spans = this._words().slice(startIndex, startIndex + count);
    if (!spans.length) return null;
    return this._commitClip(spans);
  }

  addSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const spans = this._words().filter(s => rangeCoversWord(range, s));
    if (!spans.length) return null;
    sel.removeAllRanges();
    return this._commitClip(spans);
  }

  _commitClip(spans) {
    const text = spans.map(s => s.textContent).join('').trim();
    const clip = this.mix.addClip(Mix.clipFromWords(spans, this.currentSrc));
    this._renderClip(clip, text);
    this._emit('hyperaudioRemixerClipAdded', { clip, text });
    this._emit('hyperaudioRemixerMixChanged', { clips: this.mix.clips });
    return clip;
  }

  _renderClip(clip, text) {
    const el = document.createElement('div');
    el.className = 'hr-clip';
    const name = clip.src.split('/').pop();
    el.innerHTML =
      `<div>${text || '(clip)'}</div>` +
      `<div class="hr-meta">${name} · ${clip.start.toFixed(1)}–${clip.end.toFixed(1)}s</div>`;
    this._stageEl.appendChild(el);
  }

  play() { return this.mixPlayer.play(); }
  pause() { this.mixPlayer.pause(); }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

customElements.define('hyperaudio-remixer', HyperaudioRemixer);

export { HyperaudioRemixer };
