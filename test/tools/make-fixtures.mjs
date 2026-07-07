/**
 * make-fixtures.mjs — regenerate the local test fixtures from real conference data.
 *
 * Source (local, not committed): ~/sites/atproto-conf
 *   - transcript: local-streamplace/rjQ96kl.json  ({words,paragraphs}, seconds)
 *   - media:      local-test/rjQ96kl.mp4          (27-min talk)
 *
 * Produces, for each clip window:
 *   - test/fixtures/transcripts/<id>.json   (committed — sliced + rebased to 0)
 *   - test/fixtures/media/<id>.mp4          (git-ignored — short, downscaled clip)
 *
 * Two distinct clips give the remix "swap between two source videos" test real
 * cross-file behaviour. Re-run after changing windows:  node test/tools/make-fixtures.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { sliceWords } from './hypertranscript.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const SRC_JSON = resolve(homedir(), 'sites/atproto-conf/local-streamplace/rjQ96kl.json');
const SRC_MP4 = resolve(homedir(), 'sites/atproto-conf/local-test/rjQ96kl.mp4');

// [t0, t1) in seconds. Two non-adjacent windows from the same talk.
const CLIPS = [
  { id: 'clip-a', t0: 1, t1: 31, label: 'Clip A — Daniel Holmgren (intro)' },
  { id: 'clip-b', t0: 180, t1: 210, label: 'Clip B — Daniel Holmgren (mid-talk)' },
];

const TRANSCRIPTS_DIR = resolve(REPO, 'test/fixtures/transcripts');
const MEDIA_DIR = resolve(REPO, 'test/fixtures/media');
mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
mkdirSync(MEDIA_DIR, { recursive: true });

const data = JSON.parse(readFileSync(SRC_JSON, 'utf8'));
console.log(`Source: ${data.words.length} words, ${(data.paragraphs || []).length} paragraphs\n`);

for (const clip of CLIPS) {
  const sliced = sliceWords(data, clip.t0, clip.t1);
  const jsonPath = resolve(TRANSCRIPTS_DIR, `${clip.id}.json`);
  writeFileSync(
    jsonPath,
    JSON.stringify({ id: clip.id, label: clip.label, ...sliced }, null, 1)
  );
  console.log(
    `${clip.id}: ${sliced.words.length} words, ${sliced.paragraphs.length} paragraphs ` +
      `[${clip.t0}s–${clip.t1}s] → ${jsonPath.replace(REPO + '/', '')}`
  );
  if (sliced.words.length === 0) {
    console.warn(`  ⚠ no words in window — adjust t0/t1 for ${clip.id}`);
  }

  const mp4Path = resolve(MEDIA_DIR, `${clip.id}.mp4`);
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-ss', String(clip.t0),
      '-i', SRC_MP4,
      '-t', String(clip.t1 - clip.t0),
      '-vf', 'scale=640:-2',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30',
      '-c:a', 'aac', '-b:a', '96k',
      '-movflags', '+faststart',
      mp4Path,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  );
  console.log(`  clip → ${mp4Path.replace(REPO + '/', '')}\n`);
}

console.log('Done.');
