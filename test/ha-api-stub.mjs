/**
 * ha-api-stub.mjs — replace HA.api with a local, backend-free implementation.
 *
 * The old pad talks to the (dead) hyperaud.io REST API via HA.api.*. This module
 * patches those methods to serve the committed fixtures under test/fixtures/, so
 * the app runs fully self-contained for characterization tests. Nothing in the
 * production bundle changes — pad.test.html loads this, then calls HAP.init().
 *
 * Callbacks are invoked with `this` bound to the api object, matching the real
 * client (consumers read `this.username`, `this.transcript`, `this.mix`).
 */
import { toHypertranscript } from './tools/hypertranscript.mjs';

const HA = window.HA;
const api = HA.api;

// Talk sources shown in the side menu, built by `node test/tools/make-sources.mjs`
// (each is a full conference talk: transcript + video).
let SOURCES = [];
try {
  SOURCES = await fetch('test/fixtures/sources.json').then(r => (r.ok ? r.json() : []));
} catch (e) {
  SOURCES = [];
}

// Clip fixtures used by the automated tests (loaded directly via ?t=clip-a).
const FIXTURES = [
  { _id: 'clip-a', label: 'Clip A — intro', owner: '' },
  { _id: 'clip-b', label: 'Clip B — mid-talk', owner: '' },
];

// Every id getTranscript can serve (talks + test clips).
const KNOWN = new Set([...FIXTURES.map(f => f._id), ...SOURCES.map(s => s.id)]);
// Default when the pad asks for its hard-coded default transcript: first talk.
const DEFAULT_ID = SOURCES[0] ? SOURCES[0].id : 'clip-a';

const soon = (fn, self, arg) => setTimeout(() => fn && fn.call(self, arg), 0);

// --- identity: behave as a signed-in user so "Your Media" + save both work ---
api.getUsername = function (callback) {
  this.guest = false;
  this.username = 'tester';
  soon(callback, this, true);
};
api.signin = function (auth, callback) {
  this.guest = false;
  this.username = 'tester';
  soon(callback, this, true);
};

// --- browsing: one channel holding both fixtures ---
api.getChannels = function (options) {
  soon(options && options.callback, this, ['Test Clips']);
};
api.getTranscripts = function (options) {
  soon(options && options.callback, this, FIXTURES.slice());
};
api.getBGM = function (callback) {
  this.bgm = [];
  soon(callback, this, true);
};

// --- a single transcript: build hypertranscript HTML from the fixture JSON ---
api.getTranscript = function (id, callback) {
  const self = this;
  const fixtureId = KNOWN.has(id) ? id : DEFAULT_ID;
  fetch(`test/fixtures/transcripts/${fixtureId}.json`)
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then(json => {
      self.transcript = {
        _id: fixtureId,
        label: json.label || fixtureId,
        content: toHypertranscript(json, { wordTag: 'a', duration: true }),
        media: {
          _id: `${fixtureId}-media`,
          source: { mp4: { url: `test/fixtures/media/${fixtureId}.mp4` } },
        },
      };
      callback && callback.call(self, true);
    })
    .catch(() => {
      self.error = true;
      callback && callback.call(self, false);
    });
};

// --- mixes: localStorage-backed store, so save/load round-trips across a
//     page reload (?m=<id>) without a backend ---
const STORE_KEY = 'ha-test-mixes';
const readStore = () => {
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY)) || {};
  } catch (ignored) {
    return {};
  }
};
const writeStore = store => {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (ignored) {}
};

api.getMixes = function (callback) {
  this.mixes = Object.values(readStore());
  soon(callback, this, true);
};
api.getMix = function (id, callback) {
  const self = this;
  setTimeout(() => {
    const mix = readStore()[id];
    if (mix) {
      self.mix = mix;
      callback && callback.call(self, true);
    } else {
      self.error = true;
      callback && callback.call(self, false);
    }
  }, 0);
};
api.putMix = function (mix, callback) {
  const self = this;
  setTimeout(() => {
    const store = readStore();
    if (!mix._id) mix._id = `mix-${Object.keys(store).length + 1}`;
    mix.owner = 'tester';
    store[mix._id] = mix;
    writeStore(store);
    self.mix = mix;
    callback && callback.call(self, { saved: true });
  }, 0);
};

// --- capture module instances so hybrid tests can reach the engine ---
// The pad keeps stage/projector/transcript/player as closures. Wrap the HA
// factories (all called as HA.X({...})) to record the instances they return.
// This touches nothing in the production source — only the test build loads us.
const instances = {};
['Stage', 'Projector', 'Transcript', 'Player', 'Music'].forEach(name => {
  const orig = HA[name];
  if (typeof orig !== 'function') return;
  HA[name] = function () {
    const inst = orig.apply(this, arguments);
    instances[name] = inst;
    return inst;
  };
});

// Test surface: instances + fixtures + a raw store reset for isolation.
window.__HA_TEST__ = {
  instances,
  FIXTURES,
  resetMixes: () => writeStore({}),
};

// --- side menu: list the talks flat, directly selectable ---
// The real SideMenu buries items under on-demand channel folders (mirroring the
// hyperaud.io API). For the harness we replace initTranscripts with a flat list
// of the talk SOURCES; clicking one loads its transcript + video.
HA.SideMenu.prototype.initTranscripts = function () {
  const self = this;
  const panel = self.transcripts; // #panel-media
  panel.innerHTML = '';
  for (const s of SOURCES) {
    const li = document.createElement('li');
    li.setAttribute('data-id', s.id);
    li.textContent = s.label;
    panel.appendChild(li);
  }
  panel._tap = new HA.Tap({ el: panel });
  panel.addEventListener(
    'tap',
    function (e) {
      const item = e.target.closest ? e.target.closest('li[data-id]') : null;
      const id = item && item.getAttribute('data-id');
      if (!id || !self.mediaCallback) return;
      HA.Address.setParam('t', id);
      self.mediaCallback(item);
    },
    false
  );
};

// Kick off the app now that the API is stubbed.
window.HAP.init();
