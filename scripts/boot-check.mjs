// Serve dist/ and confirm the build boots to the title screen, into level 1 and through RUN on an emulated phone.
//   node scripts/boot-check.mjs
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium, devices } from 'playwright-core';

const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const p = probe.address().port;
    probe.close(() => resolve(p));
  });
});
const url = `http://127.0.0.1:${port}/?tfptest`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
let browser;
let ok = false;
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const problems = [];
  const requests = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith(`http://127.0.0.1:${port}`)) requests.push(r.url()); });
  await page.goto(url);
  // a first visit goes straight into level 1 (no title screen)
  await page.waitForFunction(() => window.__TFP?.game.scene.isActive('Game') && !!window.__TFP.game.scene.getScene('Game').world && window.__TFP.game.scene.getScene('Game').state === 'prep', null, { timeout: 20000 });
  console.log('level 1 open in setup straight after loading');
  // Poki: gameplayStart must wait for the player's first interaction (a first visit has no PLAY tap)
  await page.waitForTimeout(2000);
  const before = await page.evaluate(() => window.__TFP.platform.debugState);
  // the player's first tap (on the belt, as level 1 asks)
  const pos = await page.evaluate(() => {
    const m = window.__TFP.game.scene.getScene('Game').world.machine('belt');
    const v = window.__TFP.view;
    return { x: m.x - (360 - v.w / 2), y: m.y - (v.cy - v.h / 2), w: v.w };
  });
  const box = await page.locator('#game canvas').boundingBox();
  await page.touchscreen.tap(box.x + (pos.x * box.width) / pos.w, box.y + (pos.y * box.width) / pos.w);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.__TFP.platform.debugState);
  console.log('gameplay reported to the portal before the first tap:', before.playing, '/ after it:', after.playing);
  if (before.playing || !before.wanted || !after.playing) problems.push('gameplayStart: must be held until the first input, then sent');
  await page.evaluate(() => window.__TFP.game.scene.getScene('Game').toggleRun());
  await page.waitForFunction(() => window.__TFP.game.scene.getScene('Game').state === 'running', null, { timeout: 5000 });
  console.log('level 1 running after RUN');
  console.log('external requests:', requests.length ? [...new Set(requests)].join(', ') : 'none');
  console.log('errors:', problems.length ? problems.join(' | ') : 'none');
  ok = problems.every((p) => p.includes('poki')); // SDK complaints outside Poki's site are expected
} finally {
  await browser?.close();
  server.kill();
}
process.exit(ok ? 0 : 1);
