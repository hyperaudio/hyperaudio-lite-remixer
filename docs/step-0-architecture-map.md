# Step 0 — Architecture Map & Porting Strategy

_Hyperaudio Pad → vanilla-JS web component for the Hyperaudio Lite Editor (HLE)._
_Status: research complete, no code changed. This is the reference the port builds on._

---

## The one insight that reframes everything

> **`hyperaudio-lite` does NOT replace Popcorn's job in the remixer. It replaces a small part of it. The remix *scheduler* already exists, is Popcorn-independent, and is the piece to preserve.**

Three things were assumed going in; two were wrong:

| Assumption | Reality |
|---|---|
| "It's a jQuery app to de-jQuery." | ❌ `hap.js` is already vanilla. The engine is **Popcorn.js + the `HA` library**. |
| "Popcorn drives remix playback." | ❌ Remix playback (`Projector`) already runs on **native `<video>.currentTime` + `timeupdate`**. Popcorn only does per-word highlighting + the YouTube wrapper. |
| "hyperaudio-lite can replace Popcorn." | ⚠️ Partly. It replaces the **transcript-sync/highlight** role. It **cannot** sequence arbitrary clips across multiple sources — that's the remixer's core, and it isn't in the library. |

**Likely cause of the prior failed attempt:** treating hyperaudio-lite as a drop-in Popcorn replacement. It can't sequence a multi-source mix — no clip model, no queue, no "advance to next clip" (its one range feature *pauses* at the end), no source-swapping, and it emits no events to hang a scheduler on. Swap Popcorn → hyperaudio-lite naively and the mix player dies.

**Correct decomposition:**
- `hyperaudio-lite` → the **source-transcript panel** (click-to-seek, word highlight). Kills the Popcorn dependency there. ✅
- The **remix scheduler** (`Projector`'s content model + `manager`/`cue`) → **preserve and port to vanilla**. It's already native-video-based. ✅
- **Popcorn** → **delete**. Only the transcript plugin + `HTMLYouTubeVideoElement` were load-bearing, and hyperaudio-lite covers the first natively.

---

## Popcorn coupling verdict

Everything the live pad actually touches in ~2000 lines of bundled Popcorn:

| Popcorn API | Where | Replaceable by |
|---|---|---|
| `.transcript({time,target,futureClass})` plugin | Transcript, Projector | **hyperaudio-lite** native highlighting |
| `Popcorn(el)` / `.destroy()` | Player, Music | Nothing — plain bookkeeping |
| `.play/.pause/.currentTime` | Player (**YouTube path only**) | Native `<video>` API / HLE player adapters |
| `Popcorn.HTMLYouTubeVideoElement` | Player | hyperaudio-lite's YouTube `BasePlayer`, or defer YT to phase 2 |

Coupling by concern: **transcript highlight = tight but shallow** (one plugin, trivial to swap) · **playback/scheduling = loose** (native events) · **drag/drop = none** · **effects = none** (custom CSS classes) · **YouTube = tight** (only load-bearing hard dependency).

---

## Module map — keep / port / replace / delete

`hap.js` is a thin controller over the `HA` namespace (source lives in `build/hyperaudio-pad.js`, the verbose bundle).

| Module | Role | Disposition |
|---|---|---|
| **Projector** | **The remix engine.** Parses stage HTML → `content[]` timeline; sequences clips across 2 swapped players via native `timeupdate`; applies effects. | **PORT — the crown jewel.** Reimplement in vanilla; this is the real value. |
| **Stage** | Mix editor/model: holds the `<section>` clips, drop handling, save/serialize. | **PORT** — becomes the pad's mix state. |
| **Transcript** | Loads transcript, renders clickable `<a data-m>` words, click-to-seek, highlight. | **REPLACE** with hyperaudio-lite. |
| **Player / PlayerGUI** | Wraps one media surface (native `<video>` + YouTube); transport UI. | **REPLACE** with HLE/hyperaudio-lite player adapters (keep a thin GUI). |
| **WordSelect / DragDrop / Tap** | Pointer/touch selection + drag of phrases and effects. | **PORT** to vanilla (modern Pointer Events / Selection API). |
| **fadeFX / titleFX** | CSS-transition effect helpers (no Popcorn). | **PORT** — nearly as-is. |
| **Music** | BGM `<audio>` player; its Popcorn instance is vestigial/unused. | **PORT**, drop dead Popcorn. |
| **SideMenu** | Media/BGM browser sidebar. | **RECONSIDER** — in HLE the transcript is already loaded; the source-picker role changes. |
| **api / Address / Clipboard / EditBlock** | REST client (dead `hyperaud.io` backend), URL params, copy, clip editor. | **api → REPLACE** (HLE storage/export). Others **PORT** as small utilities. |
| **Popcorn (+ iScroll, jQuery-lite)** | Bundled engine + scroll/DOM shims. | **DELETE.** |

---

## Data model — HTML-as-data, and it nearly matches HLE already

There is **no JSON clip array**. A mix is a JSON envelope whose payload is the stage's `innerHTML`:

```js
mix = { _id, owner, label, desc, type, content: stage.innerHTML }
```

`content` is an `<article>` of `<section>`s. A **clip** carries source refs as attributes + the phrase's words as children; an **effect** is a `<section data-effect>`:

```html
<section data-id="…" data-mp4="…" data-webm="…" data-yt="…" data-unit="0.001">
  <a data-m="1234">word</a> <a data-m="1789">word</a> …
</section>
<section data-effect="fade" class="effect"><form>…</form></section>
```

At playback, Projector parses each clip to `{ media:{mp4,webm,youtube}, start = firstWord.data-m×unit, end = lastWord.data-m×unit, trim, effect[], totalStart, totalEnd }`. In/out points are derived purely from first/last word `data-m` — no stored duration.

**Alignment with the Hyperaudio ecosystem (good news):**

| | Pad (old) | hyperaudio-lite / HLE |
|---|---|---|
| Word element | `<a data-m>` | `<span data-m data-d>` |
| Time unit | ms (× `data-unit` 0.001) | ms |
| Source ref | per-clip `data-mp4/webm/yt` | container `data-media-src` |
| Duration | derived (next word) | explicit `data-d` |

Same timing model. Reconciliation is mechanical: `<a>`→`<span>`, add `data-d`, map per-clip media attrs → `data-media-src`. **No format migration for the transcript layer.** A dragged phrase = a contiguous run of `data-m` spans → `{src, start, end}` clip tuple, which is exactly what a scheduler needs.

---

## Target shape in HLE (how to be idiomatic)

HLE is **not** a Shadow-DOM framework. It's plain `<script src>` files sharing globals, with **light-DOM custom elements** as declarative widgets. Conventions:

- Shared transcript DOM: `#hypertranscript` of `<span data-m data-d>`.
- Shared player: `window.hyperaudioInstance` (`new HyperaudioLite({...})` from `editor-core.js`).
- Coordination: document-level `CustomEvent`s (`hyperaudioInit`, `hyperaudioTranscriptLoaded`, …) — an ad-hoc bus, no registry.
- Styling: **Tailwind + DaisyUI** utilities + one hand-written sheet; theme via DaisyUI `data-theme` vars (`oklch(var(--p))`, `var(--b1)`); kebab-case structural classes (`*-panel`, `*-holder`). **No Shadow DOM** (it would wall off Tailwind/DaisyUI + theming).

**Recommended `<hyperaudio-pad>`:** a **light-DOM custom element** that
1. reads/copies `<span data-m data-d>` runs from `#hypertranscript` (drag or select-to-add),
2. holds the mix as its own list of `{src, start, end, effects}` clips (upgrade the old HTML-as-data to an explicit model, still serializable to spans),
3. plays the mix with the **ported Projector scheduler** driving native media (reusing HLE player adapters / `hyperaudioInstance` for highlight + seek),
4. talks to the editor via `window.hyperaudioInstance` + `hyperaudio*` events, styles with DaisyUI classes.

```
js/hyperaudio-lite-pad.js        # defines + registers <hyperaudio-pad>
css/hyperaudio-lite-pad.css      # small; prefer DaisyUI utilities inline
# index.html: <hyperaudio-pad> in a panel + <script> after editor-core.js
```

---

## Characterization test plan (the Step 1 safety net)

These pin down "the pad works" as observable behaviour, run in a real browser (Playwright) against the **old app as the oracle**, then re-run against the new component as the contract. Grouped by area; each is one asserted behaviour.

**Transcript / source**
- Loading a transcript renders `#transcript` with clickable `<a data-m>` words and loads the source into `#video-source`.
- Clicking a word seeks the source to `data-m×unit` s and plays.
- During playback the current word loses `transcript-grey`; upcoming words keep it.
- Selecting a word range fills the clipboard copy buffer.

**Building a mix**
- Dragging a phrase onto `#stage` adds a `<section>` at the drop position with `data-id/mp4/webm/unit` + the selected words.
- Clips preserve order and can be re-dragged to reorder.
- Dragging Fade/Trim/Title inserts a `data-effect` section with the right form controls; changing a control fires `ha:change`.
- Editing the mix title updates state/URL and marks the mix changed.

**Playback of the mix**
- Play plays clips back-to-back in stage order, advancing at each clip's `end + trim`.
- A mix spanning two source videos swaps players without overlap/replay.
- Clicking a word inside a staged clip seeks the mix to that clip+offset.
- Progress bar reflects cumulative mix time; reaching the end resets to clip 0.
- `fade` cross-fades (`#fxHelper`); `title` shows text (`#titleFXHelper`); `trim` shortens the previous clip; a BGM drop plays in `#music-player`.

**Persistence** (rework for HLE storage, but the behaviours hold)
- Save serializes `#stage` innerHTML into `mix.content`; on success URL gains `?m=<id>` and `ha:save` fires.
- Loading `?m=<id>` reconstructs the identical stage (clips + effects).

_Note: several tests assume the dead `hyperaud.io` API. For a self-contained harness we need a local fixture transcript + a stub/replacement for `HA.api` so tests don't depend on a live backend._

---

## Revised roadmap (adjusting the original six steps)

0. **This document.** ✅
1. **Characterization tests** — browser/E2E behavioural (not unit), old app as oracle. Needs a **local fixture transcript + api stub** first, since the backend is dead.
2. **Verbose over minified** — point `pad.html` at `build/hyperaudio-pad.js` (one line). Consider **vendoring `hyperaudio-lite` source** into the repo so it's all readable.
3. ~~jQuery → vanilla~~ → **De-Popcorn + port the engine.** Replace Transcript/Player with hyperaudio-lite; port Projector/Stage/WordSelect/effects to vanilla. Test against the Step 1 contract at each move.
4. **Rearchitect as `<hyperaudio-pad>`** light-DOM custom element, HLE module/event conventions.
5. **CSS → DaisyUI/HLE tokens** (late, low-risk).
6. **Integrate with HLE.**

---

## Decisions

Locked (2026-07-07):
1. **Location** — ✅ **New directory in this repo; keep the old app runnable as the reference oracle.** Lowest-risk given the prior failure.
2. **v1 playback scope** — ✅ **Native `<video>/<audio>` only.** Defer YouTube (the only hard Popcorn dependency) and effects (Fade/Trim/Title/BGM) to a later phase. Land the core multi-source remix loop first.

Still open:
3. **Mix serialization** — keep HTML-as-data (round-trips through HLE's JSON/SRT/VTT exporters) or move to an explicit JSON clip model? (Recommend: explicit model in memory, serialize to spans for interop.) — decide during Step 3/4.
