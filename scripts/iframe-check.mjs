// Serve dist/ and load it inside a cross-origin iframe on an emulated phone, the way a portal
// such as Poki embeds it. Reports the safe-area inset the game chose and whether the Poki SDK
// offers movePill, and saves a screenshot of a two-belt level.
//   npm run build (or VITE_PLATFORM=poki npm run build), then: node scripts/iframe-check.mjs [outDir]
// This is Chromium's phone emulation, not a real phone.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium, devices } from 'playwright-core';

const out = process.argv[2] ?? 'test-artifacts';
const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const p = probe.address().port;
    probe.close(() => resolve(p));
  });
});
const gameUrl = `http://127.0.0.1:${port}/?tfptest`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
let browser;
let ok = false;
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(gameUrl)).ok) break;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  // the parent page is about:blank and the game is on 127.0.0.1: different origins, as on a portal
  const host = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%;display:block}</style>'
    + `<iframe src="${gameUrl}" allow="autoplay; fullscreen"></iframe>`;
  await page.setContent(host);
  let f;
  for (let i = 0; i < 80 && !f; i++) {
    f = page.frames().find((fr) => fr.url().startsWith(`http://127.0.0.1:${port}`));
    if (!f) await page.waitForTimeout(250);
  }
  if (!f) throw new Error('game iframe never loaded');
  // a first visit opens level 1 straight away; returning players see the title screen
  await f.waitForFunction(() => window.__TFP?.game.scene.isActive('Menu') || window.__TFP?.game.scene.isActive('Game'), null, { timeout: 30000 });
  const info = await f.evaluate(() => ({
    framed: window.self !== window.top,
    safeTopCss: Math.round(window.__TFP.view.safeTop * (innerWidth / window.__TFP.view.w)),
    size: `${innerWidth}x${innerHeight}`,
    pokiSdk: !!window.PokiSDK,
    movePill: typeof window.PokiSDK?.movePill,
  }));
  // the game re-places the pill on every resize: spy on it and nudge resizes until the SDK has
  // finished init (the menu may appear first: the game does not wait more than 2.5 s for it)
  info.pillCall = await f.evaluate(async () => {
    const sdk = window.PokiSDK;
    if (typeof sdk?.movePill !== 'function') return null;
    let seen = null;
    const orig = sdk.movePill.bind(sdk);
    sdk.movePill = (a, b) => { seen = [a, b]; return orig(a, b); };
    // also record analytics events from here on
    window.__measured = [];
    if (typeof sdk.measure === 'function') {
      const m = sdk.measure.bind(sdk);
      sdk.measure = (...args) => { window.__measured.push(args.join(' ')); return m(...args); };
    }
    for (let i = 0; i < 30 && !seen; i++) {
      window.dispatchEvent(new Event('resize'));
      await new Promise((r) => setTimeout(r, 500));
    }
    return seen;
  });
  console.log(JSON.stringify(info));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/iframe-menu.png` });
  for (const [key, data, name] of [['LevelSelect', undefined, 'levels'], ['Game', { level: 9 }, 'level']]) {
    await f.evaluate(([k, d]) => {
      const g = window.__TFP.game;
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'Transition') g.scene.stop(s.scene.key);
      g.scene.start(k, d);
    }, [key, data]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/iframe-${name}.png` });
  }
  // press RUN (level start), STOP (level stop), RUN again and wait for the run to end (complete or fail)
  const game = (fn) => f.evaluate(fn);
  await game(() => window.__TFP.game.scene.getScene('Game').toggleRun());
  await page.waitForTimeout(400);
  await game(() => window.__TFP.game.scene.getScene('Game').retry()); // the restart button stops a run
  await page.waitForTimeout(400);
  await game(() => window.__TFP.game.scene.getScene('Game').toggleRun());
  await f.waitForFunction(() => ['won', 'failed'].includes(window.__TFP.game.scene.getScene('Game').state), null, { timeout: 30000 });
  console.log('measure events:', JSON.stringify(await f.evaluate(() => window.__measured ?? null)));
  ok = info.framed && info.safeTopCss > 0;
} finally {
  await browser?.close();
  server.kill();
}
process.exit(ok ? 0 : 1);
