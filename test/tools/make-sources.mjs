/**
 * make-sources.mjs — build the full-talk media sources for the pad harness.
 *
 * Each source = a real conference talk: a transcript (hypertranscript .html, or
 * {words,paragraphs} .json) + its full video, from ~/sites/atproto-conf. For each
 * source whose transcript exists on disk, this:
 *   - writes test/fixtures/transcripts/<id>.json   (committed)
 *   - symlinks the full video → test/fixtures/media/<id>.mp4  (git-ignored)
 * and writes test/fixtures/sources.json — the manifest the stub uses to populate
 * the side menu. Sources whose transcript file is missing are skipped (noted),
 * so the menu grows as transcripts are added.
 *
 * Re-run after adding a transcript:  node test/tools/make-sources.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseHypertranscript } from './hypertranscript.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const CONF = resolve(homedir(), 'sites/atproto-conf');

const SOURCES = [
  {
    id: 'rjQ96kl',
    label: 'Daniel Holmgren — Protocol Governance',
    transcript: `${CONF}/local-streamplace/rjQ96kl.json`,
    video: `${CONF}/local-test/rjQ96kl.mp4`,
  },
  {
    id: 'Z33R5gQkEvU',
    label: 'Victoria — Non-English speaking users',
    transcript: `${CONF}/local-test/Z33R5gQkEvU.html`,
    video: `${CONF}/local-test/Z33R5gQkEvU.mp4`,
  },
  {
    id: 'X3AckEvuNYc',
    label: 'Ivan Fleet — Open social & geopolitical risk',
    transcript: `${CONF}/local-test/X3AckEvuNYc.html`,
    video: `${CONF}/local-test/X3AckEvuNYc.mp4`,
  },
];

const TRANSCRIPTS_DIR = resolve(REPO, 'test/fixtures/transcripts');
const MEDIA_DIR = resolve(REPO, 'test/fixtures/media');
mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
mkdirSync(MEDIA_DIR, { recursive: true });

const manifest = [];
for (const s of SOURCES) {
  if (!existsSync(s.transcript)) {
    console.warn(`⏭  ${s.id}: transcript not found (${s.transcript.replace(CONF + '/', '')}) — skipped`);
    continue;
  }
  const raw = readFileSync(s.transcript, 'utf8');
  const data = s.transcript.endsWith('.html')
    ? parseHypertranscript(raw)
    : JSON.parse(raw);

  writeFileSync(
    resolve(TRANSCRIPTS_DIR, `${s.id}.json`),
    JSON.stringify({ id: s.id, label: s.label, words: data.words, paragraphs: data.paragraphs || [] }, null, 1)
  );

  const link = resolve(MEDIA_DIR, `${s.id}.mp4`);
  if (existsSync(link)) rmSync(link);
  if (existsSync(s.video)) symlinkSync(s.video, link);
  else console.warn(`   ⚠ ${s.id}: video missing (${s.video})`);

  manifest.push({ id: s.id, label: s.label });
  console.log(`✅ ${s.id}: ${data.words.length} words — "${s.label}"`);
}

writeFileSync(resolve(TRANSCRIPTS_DIR, '..', 'sources.json'), JSON.stringify(manifest, null, 1));
console.log(`\nManifest: ${manifest.length} source(s) → test/fixtures/sources.json`);
