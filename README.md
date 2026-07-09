# hyperaudio-lite-remixer

Remix audio/video by dragging phrases out of a transcript. Select words from a
timed transcript, drag them onto a stage to build an ordered **mix** of clips —
each clip a time‑range of a source medium — and play the whole thing back as one
continuous timeline, switching sources at clip boundaries.

This repo continues the original [**Hyperaudio Pad**](https://github.com/hyperaudio/hyperaudio-remixer)
(now frozen) and is being ported, in place and test‑first, toward a vanilla‑JS
web component that integrates with the [**Hyperaudio Lite Editor**](https://github.com/hyperaudio/hyperaudio-lite-editor).
The plan and analysis live in [`docs/step-0-architecture-map.md`](docs/step-0-architecture-map.md).

## Status

Two things live here side by side:

- **The working pad** (`pad.html`) — the original app, improved in place: runs
  fully offline against local fixtures, cuts clips at the exact end of the last
  word (no overrun), and plays gapless across multiple sources. This is the
  reference implementation and the oracle the tests validate against.
- **The new component** (`component/`) — a from‑scratch, Popcorn‑free rebuild of
  the engine: a hyperaudio‑lite source‑transcript panel, an explicit mix model,
  a multi‑source clip scheduler, and a `<hyperaudio-remixer>` custom element.
  Working but unstyled; parked while the pad is finished. Styling and full HLE
  integration are the remaining steps.

The porting principle throughout: **keep the working UI and swap internals
behind it**, guarded by an end‑to‑end characterization test suite.

## Quick start

Needs Node 18+ (for the ESM tooling) and a modern browser. `ffmpeg` is only
needed if you regenerate the short test clips.

```sh
npm install
npm run serve        # range-capable static server on http://localhost:8777
```

Then open:

- **http://localhost:8777/pad.test.html** — the working pad, offline, with the
  demo talks in the ☰ side menu. Select a phrase, hold‑drag it onto the stage to
  add a clip; switch talks and add more to build a cross‑source mix; press play.
- **http://localhost:8777/component/remixer-demo.html** — the new
  `<hyperaudio-remixer>` component (bare styling).

> Use `npm run serve`, **not** `python3 -m http.server` — the latter ignores HTTP
> Range requests, which breaks video seeking.

`pad.html` is the unmodified production entry point (it expects the live
hyperaud.io backend); `pad.test.html` is the same app wired to local fixtures.

## Test data

The demo talks (real ATmosphereConf recordings) are **not committed** —
transcripts are large and the videos may not be redistributable. To populate the
side menu locally, drop transcripts into `test/fixtures/src/` and build:

```sh
# test/fixtures/src/<id>.html   (hypertranscript <span data-m data-d>)  or
# test/fixtures/src/<id>.json   ({ words:[{start,end,text}], paragraphs })
npm run sources
```

`make-sources` parses each transcript, links its `<id>.mp4` (from the drop folder
or `~/sites/atproto-conf/local-test/`), and writes the manifest the harness
reads. See [`test/fixtures/src/README.md`](test/fixtures/src/README.md). The two
small `clip-a` / `clip-b` fixtures the tests use **are** committed.

## Tests

```sh
npm run test:e2e     # Playwright characterization suite (uses system Chrome)
```

The specs in `test/e2e/` drive the pad and the component end‑to‑end and define
"correct" behaviour — transcript rendering and click‑to‑seek, phrase‑drag → clip,
multi‑source sequential playback, exact‑duration clip cutting, and persistence.
They run against the pad as the oracle and against the new component as the
contract it must satisfy.

## Layout

| Path | What |
|---|---|
| `pad.html`, `pad.test.html` | The working pad (production / offline-fixtures) |
| `build/`, `dist/` | The verbose and minified pad bundles (Popcorn + `HA` lib + `src/hap.js`) |
| `src/hap.js` | The pad's controller |
| `css/` | Pad styles |
| `component/` | The new vanilla engine: `hyperaudio-lite-remixer.js` (the `<hyperaudio-remixer>` element), `mix.mjs`, `mix-player.mjs`, `transcript-panel.mjs`, `vendor/hyperaudio-lite.mjs` |
| `test/e2e/` | Playwright characterization specs |
| `test/tools/` | `hypertranscript.mjs` (format conversion), `make-sources.mjs`, `make-fixtures.mjs` |
| `test/ha-api-stub.mjs`, `test/serve.mjs` | Backend stub + range‑capable dev server |
| `test/fixtures/` | Committed test clips; `src/` drop folder (git‑ignored) |
| `docs/step-0-architecture-map.md` | Architecture map, Popcorn‑coupling analysis, roadmap |

## Related

- [hyperaudio-remixer](https://github.com/hyperaudio/hyperaudio-remixer) — the original Hyperaudio Pad (frozen)
- [hyperaudio-lite](https://github.com/hyperaudio/hyperaudio-lite) — the lightweight interactive‑transcript library this port adopts
- [hyperaudio-lite-editor](https://github.com/hyperaudio/hyperaudio-lite-editor) — the editor this component targets

## License

[AGPL‑3.0‑or‑later](LICENSE). Vendored components (Popcorn.js, iScroll, jQuery,
hyperaudio‑lite) retain their original MIT licenses.
