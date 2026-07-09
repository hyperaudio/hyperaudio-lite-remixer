# Project status

_A snapshot of where the port stands and where it's going. See
[`step-0-architecture-map.md`](step-0-architecture-map.md) for the full
architecture analysis._

## What this is

Modernizing the original **Hyperaudio Pad** remixer (frozen at
[hyperaudio-remixer](https://github.com/hyperaudio/hyperaudio-remixer)) toward a
vanilla-JS web component for the
[Hyperaudio Lite Editor](https://github.com/hyperaudio/hyperaudio-lite-editor).
Done slowly and test-first, after an earlier from-scratch attempt failed.

## Guiding principles

- **Improve the pad in place; change the UI last.** Keep the working, familiar
  interface and swap internals behind it. A from-scratch UI rebuilt too early
  regressed playback and drag, and was set aside.
- **Popcorn removal is not a goal.** The remix scheduler (`Projector`) already
  runs on native `<video>` events; Popcorn only does per-word highlighting and
  the YouTube wrapper. Keep it in place and replace only what's worth replacing,
  at integration time.
- **A characterization test suite is the contract.** Every change is guarded by
  end-to-end specs that pin down observable behaviour.

## Working now

The pad (`pad.html` / `pad.test.html`) runs fully offline against local
fixtures, with these fixes and features landed in place:

- **No backend dependency** — `pad.test.html` serves everything from local
  fixtures via a stub, so the app runs without the (dead) hyperaud.io API.
- **Exact-duration clip cutting** — clips end at the last word's true end (from
  `data-d`), removing the old hard-coded 1-second overrun. Cross-source switches
  now land precisely when the words end.
- **Custom pointer drag-and-drop** — select a phrase, drag it onto the stage to
  add a clip (mouse and touch).
- **Real multi-source remixing** — three full-length conference talks with
  different speakers are selectable from the pad's side menu, so a mix that
  spans sources visibly switches speaker at each clip boundary, gaplessly.
- **Characterization suite green** — transcript rendering, click-to-seek, word
  highlighting, phrase-drag → clip, multi-source sequential playback,
  exact-duration cutting, and persistence.

## Shelved (dormant)

`component/` holds a from-scratch, Popcorn-free rebuild — a hyperaudio-lite
transcript panel, an explicit mix model, a multi-source scheduler, and a
`<hyperaudio-remixer>` custom element. It works and is tested but is parked; it
will be revived for the eventual clean HLE integration rather than developed now.

## Roadmap

| Step | | |
|---|---|---|
| 0 | Architecture map & Popcorn-coupling analysis | ✅ |
| 1 | Characterization test suite (pad as oracle) | ✅ |
| 2 | Serve the verbose (debuggable) build | ✅ |
| 3 | In-place pad improvements: offline, overrun fix, drag-drop, multi-talk menu | ✅ |
| 4 | Optional in-place de-Popcorn of just the transcript highlighter | next |
| 5 | HLE integration: styling + `<hyperaudio-remixer>` reading the editor's transcript | planned |

The Popcorn-vs-hyperaudio-lite decision is deferred to integration time, where it
resolves naturally: embedding the pad keeps Popcorn; adopting hyperaudio-lite for
the transcript layer supersedes it.

## Running it

See the [README](../README.md). In short: `npm install`, `npm run serve`, open
`http://localhost:8777/pad.test.html`. Demo talks are loaded locally via
`npm run sources` (see [`test/fixtures/src/`](../test/fixtures/src)); tests run
with `npm run test:e2e`.
