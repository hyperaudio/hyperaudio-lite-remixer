# Test-data drop folder

Put talk **transcripts** here to make them selectable in the pad's side menu.

For each talk, drop a transcript named by an id of your choosing:

- `<id>.html` — hypertranscript (`<p><span data-m data-d>word </span>…</p>`), **or**
- `<id>.json` — `{ "words": [{start,end,text}], "paragraphs": [{start,end}] }` (seconds)

The matching **video** is resolved as `<id>.mp4` in this folder if present,
otherwise it falls back to `~/sites/atproto-conf/local-test/<id>.mp4` — so you
usually only need to drop the transcript here; drop or symlink the `.mp4` too if
you want the repo fully standalone.

Then build:

```sh
npm run sources
```

This parses each transcript → `test/fixtures/transcripts/<id>.json`, links the
video → `test/fixtures/media/<id>.mp4`, and writes the `sources.json` manifest
the harness reads. Nicely-labelled talks live in the `LABELS` map in
`test/tools/make-sources.mjs`; anything else shows under its id.

Everything in this folder except this README is git-ignored (transcripts are
large and derived; videos are large and may not be redistributable).
