const { defineConfig } = require('@playwright/test');

// Characterization tests run against the OLD pad (via pad.test.html + the fixture
// api stub) — the reference oracle. The new component must later satisfy the same
// specs. Uses the system Google Chrome (channel: 'chrome') so no browser download.
module.exports = defineConfig({
  testDir: './test/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8777',
    channel: 'chrome',
    headless: true,
  },
  webServer: {
    // Range-capable server so video seeking (click-a-word-to-jump) actually works.
    command: 'node test/serve.mjs 8777',
    url: 'http://localhost:8777/pad.test.html',
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
