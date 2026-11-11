/**
 * End-to-end browser smoke test against the PRODUCTION build.
 *
 *   npm run build && npm run smoke
 *
 * Serves dist/ with `vite preview`, drives the game in headless Edge/Chrome
 * (whichever is installed) with real mouse, keyboard and touch input, and
 * fails on any console error. Screenshots land in test-artifacts/.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { chromium } from 'playwright-core';

/** Ask the OS for a free port so the test never collides with something already running. */
const PORT = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});
const URL = `http://127.0.0.1:${PORT}/?tfptest`;
const OUT = 'test-artifacts';
mkdirSync(OUT, { recursive: true });

const results = [];
const errors = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
}

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(URL);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch { /* try the next browser */ }
  }
  throw new Error('Neither Microsoft Edge nor Google Chrome could be launched');
}

function watch(page, label) {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
}

/** Logical position of a HUD button (they move with the window shape). */
const hudBtn = (page, name) =>
  page.evaluate((n) => {
    const m = window.__TFP.game.scene.getScene('UI')[n].getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }, name);

/** Logical position of the bottom-of-screen button that flips belt `id`. */
const beltBtn = (page, id) => page.evaluate((i) => window.__TFP.game.scene.getScene('UI').beltButtonPos(i), id);

/** Logical 720x1280 (portrait) game coordinates -> page coordinates. */
async function toPage(page, x, y) {
  const box = await page.locator('#game canvas').boundingBox();
  const v = await page.evaluate(() => ({ w: window.__TFP.view.w, h: window.__TFP.view.h, cy: window.__TFP.view.cy }));
  const s = box.width / v.w;
  // the 1280x720 play field is centred inside the (possibly larger) visible area
  return { x: box.x + (x - (360 - v.w / 2)) * s, y: box.y + (y - (v.cy - v.h / 2)) * s };
}
async function click(page, x, y) {
  const p = await toPage(page, x, y);
  await page.mouse.click(p.x, p.y);
}
async function tap(page, x, y) {
  const p = await toPage(page, x, y);
  await page.touchscreen.tap(p.x, p.y);
}
async function drag(page, x1, y1, x2, y2) {
  const a = await toPage(page, x1, y1);
  const b = await toPage(page, x2, y2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 8 });
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}
const active = (page, key) => page.waitForFunction((k) => window.__TFP?.game.scene.isActive(k), key, { timeout: 15000 });
const gameState = (page, state, timeout = 30000) =>
  page.waitForFunction((s) => window.__TFP.game.scene.getScene('Game').state === s, state, { timeout });
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const startScene = (page, key, data) =>
  ev(page, ([k, d]) => {
    const g = window.__TFP.game;
    for (const s of g.scene.getScenes(true)) if (s.scene.key !== k && s.scene.key !== 'Transition') g.scene.stop(s.scene.key);
    g.scene.start(k, d);
  }, [key, data]);

// Run Vite's CLI with this Node directly (no shell wrapper), so the server can be stopped reliably.
/**
 * Play the current sorting level to the end with real input: every 80 ms, work out which belts
 * point the wrong way for the toy on (or about to land on) them and flip those by `flipBelt`.
 */
async function playLevel(page, flipBelt) {
  for (let i = 0; i < 1500; i++) {
    const info = await page.evaluate(() => {
      const g = window.__TFP.game.scene.getScene('Game');
      if (g.state !== 'running') return { state: g.state, flips: [] };
      const flips = [];
      const belts = g.world.machines.filter((m) => m.kind === 'conveyor' && m.def.flippable).sort((a, b) => a.y - b.y || a.x - b.x);
      belts.forEach((m, index) => {
        const want = (g.level.routes ?? {})[m.id];
        if (!want) return;
        let best = Infinity;
        let dir = 0;
        for (const o of g.world.objects) {
          if (Math.abs(o.x - m.x) > m.def.length / 2 + 14) continue;
          const w = want[o.type];
          const above = m.y - 14 - o.y;
          if (!w || above < 10 || above > 420) continue;
          const toExit = w === 1 ? m.x + m.def.length / 2 - o.x : o.x - (m.x - m.def.length / 2);
          const urgency = above < 80 ? toExit : 1000 + above;
          if (urgency < best) { best = urgency; dir = w; }
        }
        if (dir && dir !== m.dir) flips.push({ index, id: m.id, x: m.x, y: m.y + 8 });
      });
      return { state: g.state, flips };
    });
    if (info.state === 'won' || info.state === 'failed') return info.state;
    for (const f of info.flips) await flipBelt(f);
    await page.waitForTimeout(80);
  }
  return 'timeout';
}

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await launch();

  // ------------------------------------------------------------------ desktop
  const ctx = await browser.newContext({ viewport: { width: 560, height: 996 } });
  const page = await ctx.newPage();
  watch(page, 'desktop');
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await active(page, 'Menu');
  check('game launches to the main menu', true);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/smoke-menu.png` });
  check('menu factory is alive (physics running)', (await ev(page, () => window.__TFP.game.scene.getScene('Menu').world.tick)) > 30);
  check('panic mode starts locked', await ev(page, () => window.__TFP.save.data.unlocked === 1));

  await click(page, 200, 900); // small Levels button
  await active(page, 'LevelSelect');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/smoke-levels.png` });
  await click(page, 274, 476); // a locked level: must do nothing
  await page.waitForTimeout(400);
  check('locked levels cannot be opened', await ev(page, () => window.__TFP.game.scene.isActive('LevelSelect')));
  await page.keyboard.press('Escape'); // back to the menu
  await active(page, 'Menu');
  await page.waitForTimeout(900);
  await click(page, 360, 680); // PLAY goes straight into the next unfinished level
  await active(page, 'Game');
  check('PLAY drops straight into level 1', (await ev(page, () => window.__TFP.game.scene.getScene('Game').levelIndex)) === 0);
  await gameState(page, 'running'); // no RUN button: the factory starts by itself
  check('the level starts by itself, and one belt means one button', (await ev(page, () => window.__TFP.game.scene.getScene('UI').beltButtons.length)) === 1);
  check('tutorial hand points at the flip button', (await ev(page, () => window.__TFP.game.scene.getScene('Game').tutorialHint()?.machine)) === 'belt');
  check('HUD scene is running', await ev(page, () => window.__TFP.game.scene.isActive('UI')));
  check('tutorial points at the belt', (await ev(page, () => window.__TFP.game.scene.getScene('Game').tutorialHint()?.kind)) === 'tap');
  let bb = await beltBtn(page, 'belt');
  await click(page, bb.x, bb.y); // press the big button: the one thing the player has to learn
  check('pressing the button flips the belt', (await ev(page, () => window.__TFP.game.scene.getScene('Game').world.machine('belt').dir)) === -1);
  check('tutorial hand goes away once the belt is right', (await ev(page, () => window.__TFP.game.scene.getScene('Game').tutorialHint())) === null);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/smoke-level1-running.png` });
  await gameState(page, 'won');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/smoke-level1-complete.png` });
  const r1 = await ev(page, () => {
    const g = window.__TFP.game.scene.getScene('Game');
    return { delivered: g.rules.delivered.blue, mistakes: g.rules.mistakes, stars: window.__TFP.save.data.stars['first-flip'], unlocked: window.__TFP.save.data.unlocked };
  });
  check('level 1 completes: 3 delivered, 3 stars, level 2 unlocked', r1.delivered === 3 && r1.mistakes === 0 && r1.stars === 3 && r1.unlocked === 2, JSON.stringify(r1));

  // no button press: the game moves on by itself
  await page.waitForFunction(() => window.__TFP.game.scene.getScene('Game').levelIndex === 1 && window.__TFP.game.scene.getScene('Game').state === 'running', null, { timeout: 20000 });
  check('the next level loads and starts automatically after a win', true);

  // leave the belts alone: the level fails, says why, and restarts by itself
  await gameState(page, 'failed');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/smoke-level2-failed.png` });
  const reason = await ev(page, () => window.__TFP.game.scene.getScene('Game').rules.failReason);
  check('ignoring the belts fails with a clear reason', reason.length > 5, reason);
  await gameState(page, 'running');
  const after = await ev(page, () => {
    const g = window.__TFP.game.scene.getScene('Game');
    return { mistakes: g.rules.mistakes, toys: g.world.objects.length, tick: g.world.tick, belt: g.world.machine('belt').dir, result: window.__TFP.game.scene.isActive('Result') };
  });
  check('after a failure the level resets and starts again by itself', after.mistakes === 0 && after.toys <= 1 && after.tick < 240 && after.belt === -1 && !after.result, JSON.stringify(after));

  // pause / resume
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await active(page, 'Pause');
  const t1 = await ev(page, () => window.__TFP.game.scene.getScene('Game').world.tick);
  await page.waitForTimeout(500);
  const t2 = await ev(page, () => window.__TFP.game.scene.getScene('Game').world.tick);
  await page.screenshot({ path: `${OUT}/smoke-pause.png` });
  check('pause freezes physics', t1 === t2 && t1 > 0, `${t1} -> ${t2}`);
  await click(page, 484, 748); // Settings
  await active(page, 'Settings');
  await page.waitForTimeout(400);
  await drag(page, 490, 543, 384, 543); // music slider
  const music = await ev(page, () => window.__TFP.save.data.settings.music);
  check('settings sliders work and save', music < 0.3 && JSON.parse(await ev(page, () => localStorage.getItem('tiny-factory-panic-save'))).settings.music === music, `music=${music.toFixed(2)}`);
  await click(page, 584, 692); // reduced shake toggle
  check('settings toggles work', await ev(page, () => window.__TFP.save.data.settings.reducedShake === true));
  await page.screenshot({ path: `${OUT}/smoke-settings.png` });
  await click(page, 360, 876); // Done
  await page.waitForTimeout(300);
  await click(page, 360, 640); // Resume
  await page.waitForTimeout(400);
  const t3 = await ev(page, () => window.__TFP.game.scene.getScene('Game').world.tick);
  check('resume continues the run', t3 > t2 && !(await ev(page, () => window.__TFP.game.scene.isActive('Pause'))));

  // live flipping with the keyboard (level 3: one belt, colours alternate)
  await startScene(page, 'Game', { level: 2 });
  await gameState(page, 'running');
  const k3 = await playLevel(page, () => page.keyboard.press('Space'));
  check('level 3 can be won by flipping the belt live (keyboard)', k3 === 'won', k3);

  // two belts, two buttons, played with the mouse (level 10: the two-step layout)
  await startScene(page, 'Game', { level: 9 });
  await gameState(page, 'running');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/smoke-level9.png` });
  check('two belts means two buttons', (await ev(page, () => window.__TFP.game.scene.getScene('UI').beltButtons.length)) === 2);
  const m9 = await playLevel(page, async (f) => {
    const p = await beltBtn(page, f.id);
    await click(page, p.x, p.y);
  });
  const slips9 = await ev(page, () => window.__TFP.game.scene.getScene('Game').rules.mistakes);
  check('level 10 can be won by clicking its two buttons', m9 === 'won', `${m9}, ${slips9} slips`);

  // save persistence across a reload
  await page.reload();
  await active(page, 'Menu');
  const saved = await ev(page, () => window.__TFP.save.data);
  check('progress persists after reload', saved.stars['first-flip'] === 3 && saved.stars['slide-down'] >= 1 && saved.unlocked >= 2 && saved.settings.reducedShake === true, JSON.stringify(saved.stars));

  // corrupted save must not break boot
  await page.evaluate(() => localStorage.setItem('tiny-factory-panic-save', '{{{ definitely not json'));
  await page.reload();
  await active(page, 'Menu');
  check('corrupted save data is handled safely', await ev(page, () => window.__TFP.save.data.unlocked === 1));

  // panic mode
  await startScene(page, 'Panic');
  await active(page, 'Panic');
  await page.waitForTimeout(2500);
  const dirBefore = await ev(page, () => window.__TFP.game.scene.getScene('Panic').world.machine('beltL').dir);
  bb = await beltBtn(page, 'beltL');
  await click(page, bb.x, bb.y);
  const dirAfter = await ev(page, () => window.__TFP.game.scene.getScene('Panic').world.machine('beltL').dir);
  check('panic mode: a button flips its belt live', dirBefore !== dirAfter);
  await page.keyboard.press('a');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/smoke-panic.png` });
  check('panic mode: toys are spawning', (await ev(page, () => window.__TFP.game.scene.getScene('Panic').world.tick)) > 200);
  await page.waitForFunction(() => window.__TFP.game.scene.getScene('Panic').director.over, null, { timeout: 60000 });
  await active(page, 'Result');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/smoke-panic-over.png` });
  check('panic mode: ends with a result screen and stores the high score', await ev(page, () => window.__TFP.save.data.panicBest >= 0 && window.__TFP.game.scene.isActive('Result')));
  await click(page, 412, 806); // Play Again
  await page.waitForFunction(() => window.__TFP.game.scene.isActive('Panic') && !window.__TFP.game.scene.getScene('Panic').director.over, null, { timeout: 15000 });
  check('panic mode: Play Again restarts cleanly', true);

  // scene churn: no leaked bodies / scenes
  for (let i = 0; i < 6; i++) {
    await startScene(page, 'Game', { level: i * 2 });
    await gameState(page, 'prep');
    await page.keyboard.press('Space');
    await page.waitForTimeout(350);
  }
  await startScene(page, 'Menu');
  await active(page, 'Menu');
  const scenes = await ev(page, () => window.__TFP.game.scene.getScenes(true).map((s) => s.scene.key).filter((k) => k !== 'Transition'));
  check('level transitions leave only the menu running', scenes.length === 1 && scenes[0] === 'Menu', scenes.join(','));
  await ctx.close();

  // -------------------------------------------------------------------- touch
  const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const tp = await tctx.newPage();
  watch(tp, 'touch');
  await tp.goto(URL);
  await active(tp, 'Menu');
  await tp.waitForTimeout(800);
  await tp.screenshot({ path: `${OUT}/smoke-mobile-menu.png` });
  await tap(tp, 360, 680);
  await active(tp, 'Game');
  await gameState(tp, 'running');
  await tp.waitForTimeout(500);
  const tb = await beltBtn(tp, 'belt');
  await tap(tp, tb.x, tb.y);
  check('touch: tapping the button flips the belt', (await ev(tp, () => window.__TFP.game.scene.getScene('Game').world.machine('belt').dir)) === -1);
  await tp.screenshot({ path: `${OUT}/smoke-mobile-level1.png` });
  await gameState(tp, 'won');
  check('touch: level 1 can be completed with one tap', true);
  // a busier level, played entirely with touch taps
  await startScene(tp, 'Game', { level: 12 });
  await gameState(tp, 'running');
  const t10 = await playLevel(tp, async (f) => {
    const p = await beltBtn(tp, f.id);
    await tap(tp, p.x, p.y);
  });
  check('touch: level 13 (two belts, three colours) can be won by tapping the buttons', t10 === 'won', t10);
  await tp.screenshot({ path: `${OUT}/smoke-mobile-level10.png` });
  check('touch: render resolution adapts to the device', (await ev(tp, () => window.__TFP.game.config.width)) >= 720);
  await tctx.close();

  // ---------------------------------------------------------------- viewports
  for (const [w, h] of [[390, 844], [412, 915], [768, 1024], [1280, 720], [1920, 1080], [650, 590]]) {
    const vctx = await browser.newContext({ viewport: { width: w, height: h } });
    const vp = await vctx.newPage();
    watch(vp, `${w}x${h}`);
    await vp.goto(URL);
    await active(vp, 'Menu');
    await vp.waitForTimeout(700);
    const box = await vp.locator('#game canvas').boundingBox();
    const fills = Math.abs(box.width - w) <= 2 && Math.abs(box.height - h) <= 2 && Math.abs(box.x) <= 1 && Math.abs(box.y) <= 1;
    const v = await ev(vp, () => window.__TFP.view);
    check(`viewport ${w}x${h}: canvas fills the window and shows the whole play field`, fills && v.w >= 720 && v.h >= 1280, `canvas ${Math.round(box.width)}x${Math.round(box.height)}, view ${v.w}x${v.h}`);
    await vp.screenshot({ path: `${OUT}/smoke-viewport-${w}x${h}-menu.png` });
    await startScene(vp, 'Game', { level: 11 });
    await gameState(vp, 'prep');
    await vp.waitForTimeout(1500);
    await vp.screenshot({ path: `${OUT}/smoke-viewport-${w}x${h}-level.png` });
    await vctx.close();
  }

  // safe area: with a camera cut-out at the top and a home indicator at the bottom, the HUD stays clear
  const sctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const sp = await sctx.newPage();
  watch(sp, 'safe-area');
  await sp.goto(URL + '&safe=47,34');
  await active(sp, 'Menu');
  await startScene(sp, 'Game', { level: 5 });
  await gameState(sp, 'running');
  await sp.waitForTimeout(500);
  const sbox = await sp.locator('#game canvas').boundingBox();
  const edges = await sp.evaluate(() => {
    const ui = window.__TFP.game.scene.getScene('UI');
    const v = window.__TFP.view;
    const top = v.cy - v.h / 2;
    const lowest = Math.max(...ui.beltButtons.map((b) => b.button.getWorldTransformMatrix().ty + 60));
    return { barTop: ui.bar.y - top, buttonsBottom: v.cy + v.h / 2 - lowest, perLogical: 0 };
  });
  const cssPerLogical = sbox.height / (await sp.evaluate(() => window.__TFP.view.h));
  check('safe area: the top bar starts below the camera cut-out', edges.barTop * cssPerLogical >= 46.5, `${(edges.barTop * cssPerLogical).toFixed(1)} px from the top`);
  check('safe area: the buttons stay above the home indicator', edges.buttonsBottom * cssPerLogical >= 33.5, `${(edges.buttonsBottom * cssPerLogical).toFixed(1)} px from the bottom`);
  await sp.screenshot({ path: `${OUT}/smoke-safe-area.png` });
  await sctx.close();

  // a phone held sideways is asked to turn upright
  const pctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const pp = await pctx.newPage();
  watch(pp, 'portrait');
  await pp.goto(URL);
  await pp.waitForTimeout(800);
  check('sideways phones get a turn-upright prompt', await pp.locator('#rotate').isVisible());
  await pp.screenshot({ path: `${OUT}/smoke-portrait.png` });
  await pctx.close();

  check('no console errors or uncaught exceptions', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  check('smoke test ran to completion', false, e.message.split('\n')[0]);
  if (errors.length) console.log(errors.join('\n'));
} finally {
  await browser?.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
