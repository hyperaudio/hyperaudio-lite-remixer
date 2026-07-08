/**
 * make-sources.mjs — build the pad harness's full-talk media sources.
 *
 * Discovers transcripts dropped into test/fixtures/src/ (see its README): for
 * each `<id>.html` (hypertranscript) or `<id>.json` ({words,paragraphs}) it:
 *   - writes test/fixtures/transcripts/<id>.json   (git-ignored, generated)
 *   - links the video → test/fixtures/media/<id>.mp4  (from src/<id>.mp4, else
 *     ~/sites/atproto-conf/local-test/<id>.mp4)
 * and writes test/fixtures/sources.json — the manifest the stub reads to
 * populate the side menu.
 *
 * Drop transcripts in test/fixtures/src/, then:  npm run sources
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  symlinkSync,
  readdirSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseHypertranscript } from './hypertranscript.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const SRC_DIR = resolve(REPO, 'test/fixtures/src');
const TRANSCRIPTS_DIR = resolve(REPO, 'test/fixtures/transcripts');
const MEDIA_DIR = resolve(REPO, 'test/fixtures/media');
const CONF_MEDIA = resolve(homedir(), 'sites/atproto-conf/local-test');

// Friendly menu labels for known talks; anything else shows under its id.
const LABELS = {
  rjQ96kl: 'Daniel Holmgren — Protocol Governance',
  Z33R5gQkEvU: 'Victoria — Non-English speaking users',
  X3AckEvuNYc: 'Ivan Fleet — Open social & geopolitical risk',
};
const ORDER = Object.keys(LABELS);

mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
mkdirSync(MEDIA_DIR, { recursive: true });

const files = existsSync(SRC_DIR) ? readdirSync(SRC_DIR) : [];
const ids = [...new Set(files.filter(f => /\.(html|json)$/i.test(f)).map(f => f.replace(/\.(html|json)$/i, '')))];

if (!ids.length) {
  console.warn(`No transcripts in ${SRC_DIR.replace(REPO + '/', '')} — drop <id>.html or <id>.json there.`);
}

const manifest = [];
for (const id of ids) {
  const htmlPath = resolve(SRC_DIR, `${id}.html`);
  const jsonPath = resolve(SRC_DIR, `${id}.json`);
  const tPath = existsSync(htmlPath) ? htmlPath : jsonPath;
  const raw = readFileSync(tPath, 'utf8');
  const data = tPath.endsWith('.html') ? parseHypertranscript(raw) : JSON.parse(raw);
  const label = LABELS[id] || id;

  writeFileSync(
    resolve(TRANSCRIPTS_DIR, `${id}.json`),
    JSON.stringify({ id, label, words: data.words, paragraphs: data.paragraphs || [] }, null, 1)
  );

  const localVid = resolve(SRC_DIR, `${id}.mp4`);
  const video = existsSync(localVid) ? localVid : resolve(CONF_MEDIA, `${id}.mp4`);
  const link = resolve(MEDIA_DIR, `${id}.mp4`);
  if (existsSync(link)) rmSync(link);
  if (existsSync(video)) symlinkSync(video, link);
  else console.warn(`   ⚠ ${id}: video not found (${localVid.replace(REPO + '/', '')} or ${video})`);

  manifest.push({ id, label });
  console.log(`✅ ${id}: ${data.words.length} words — "${label}"`);
}

manifest.sort((a, b) => {
  const ia = ORDER.indexOf(a.id), ib = ORDER.indexOf(b.id);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});
writeFileSync(resolve(TRANSCRIPTS_DIR, '..', 'sources.json'), JSON.stringify(manifest, null, 1));
console.log(`\nManifest: ${manifest.length} source(s) → test/fixtures/sources.json`);
