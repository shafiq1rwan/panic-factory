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

/** Logical 720x1280 (portrait) game coordinates -> page coordinates. */
async function toPage(page, x, y) {
  const box = await page.locator('#game canvas').boundingBox();
  const v = await page.evaluate(() => ({ w: window.__TFP.view.w, h: window.__TFP.view.h }));
  const s = box.width / v.w;
  // the 1280x720 play field is centred inside the (possibly larger) visible area
  return { x: box.x + (x - (360 - v.w / 2)) * s, y: box.y + (y - (640 - v.h / 2)) * s };
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
  await click(page, 360, 476); // a locked level: must do nothing
  await page.waitForTimeout(400);
  check('locked levels cannot be opened', await ev(page, () => window.__TFP.game.scene.isActive('LevelSelect')));
  await page.keyboard.press('Escape'); // back to the menu
  await active(page, 'Menu');
  await page.waitForTimeout(900);
  await click(page, 360, 680); // PLAY goes straight into the next unfinished level
  await active(page, 'Game');
  await gameState(page, 'prep');
  check('PLAY drops straight into level 1 (preparation phase)', (await ev(page, () => window.__TFP.game.scene.getScene('Game').levelIndex)) === 0);
  await page.waitForTimeout(700);
  check('HUD scene is running', await ev(page, () => window.__TFP.game.scene.isActive('UI')));
  check('tutorial points at the belt', (await ev(page, () => window.__TFP.game.scene.getScene('Game').tutorialHint()?.kind)) === 'tap');

  await click(page, 300, 430); // tap the conveyor -> flips
  check('tapping the belt flips it', (await ev(page, () => window.__TFP.game.scene.getScene('Game').world.machine('belt').dir)) === 1);
  check('tutorial now points at RUN', (await ev(page, () => window.__TFP.game.scene.getScene('Game').tutorialHint()?.kind)) === 'run');
  let b = await hudBtn(page, 'runBtn');
  await click(page, b.x, b.y); // the big RUN button under the play field
  await gameState(page, 'running');
  check('RUN starts the simulation', true);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/smoke-level1-running.png` });
  b = await hudBtn(page, 'ffBtn');
  await click(page, b.x, b.y); // fast-forward
  check('fast-forward toggles', (await ev(page, () => window.__TFP.game.scene.getScene('Game').speed)) === 3);
  await gameState(page, 'won');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/smoke-level1-complete.png` });
  const r1 = await ev(page, () => {
    const g = window.__TFP.game.scene.getScene('Game');
    return { delivered: g.rules.delivered.blue, mistakes: g.rules.mistakes, stars: window.__TFP.save.data.stars['first-shift'], unlocked: window.__TFP.save.data.unlocked };
  });
  check('level 1 completes: 3 delivered, 3 stars, level 2 unlocked', r1.delivered === 3 && r1.mistakes === 0 && r1.stars === 3 && r1.unlocked === 2, JSON.stringify(r1));

  // no button press: the game moves on by itself
  await page.waitForFunction(() => window.__TFP.game.scene.getScene('Game').levelIndex === 1 && window.__TFP.game.scene.getScene('Game').state === 'prep', null, { timeout: 15000 });
  check('the next level loads automatically after a win', true);
  await page.waitForTimeout(900);

  // fail on purpose, then retry
  const bodies2 = await ev(page, () => window.__TFP.game.scene.getScene('Game').world.bodyCount);
  await page.keyboard.press('Space');
  await gameState(page, 'failed');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/smoke-level2-failed.png` });
  const reason = await ev(page, () => window.__TFP.game.scene.getScene('Game').rules.failReason);
  check('wrong setup fails with a clear reason', reason.length > 5, reason);
  await gameState(page, 'prep'); // hands the layout back by itself
  await page.waitForTimeout(250); // let the overlay scene finish closing
  const after = await ev(page, () => {
    const g = window.__TFP.game.scene.getScene('Game');
    return { bodies: g.world.bodyCount, toys: g.world.objects.length, views: g.view.toyCount, tick: g.world.tick, result: window.__TFP.game.scene.isActive('Result') };
  });
  check('after a failure the level resets itself for another try', after.bodies === bodies2 && after.toys === 0 && after.views === 0 && after.tick === 0 && !after.result, JSON.stringify(after));

  // pause / resume
  await page.keyboard.press('Space');
  await gameState(page, 'running');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await active(page, 'Pause');
  const t1 = await ev(page, () => window.__TFP.game.scene.getScene('Game').world.tick);
  await page.waitForTimeout(500);
  const t2 = await ev(page, () => window.__TFP.game.scene.getScene('Game').world.tick);
  await page.screenshot({ path: `${OUT}/smoke-pause.png` });
  check('pause freezes physics', t1 === t2 && t1 > 0, `${t1} -> ${t2}`);
  await click(page, 360, 723); // Settings
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
  await click(page, 360, 546); // Resume
  await page.waitForTimeout(400);
  const t3 = await ev(page, () => window.__TFP.game.scene.getScene('Game').world.tick);
  check('resume continues the run', t3 > t2 && !(await ev(page, () => window.__TFP.game.scene.isActive('Pause'))));

  // dragging a machine (level 4) and rotating one (level 5)
  await startScene(page, 'Game', { level: 3 });
  await gameState(page, 'prep');
  await page.waitForTimeout(1500);
  await drag(page, 420, 760, 180, 760);
  const padX = await ev(page, () => window.__TFP.game.scene.getScene('Game').world.machine('spring').x);
  check('dragging moves a machine inside its zone', padX === 180, `x=${padX}`);
  await drag(page, 180, 760, 20, 400);
  const pad2 = await ev(page, () => { const m = window.__TFP.game.scene.getScene('Game').world.machine('spring'); return [m.x, m.y]; });
  check('machines cannot leave their zone', pad2[0] === 150 && pad2[1] === 760, pad2.join(','));
  await drag(page, 150, 760, 180, 760);
  await page.keyboard.press('Space');
  await page.keyboard.press('f');
  await gameState(page, 'won');
  check('level 4 solved by dragging the spring', true);

  await startScene(page, 'Game', { level: 4 });
  await gameState(page, 'prep');
  await page.waitForTimeout(1500);
  await click(page, 160, 800); // select the spring
  for (let i = 0; i < 4; i++) {
    const pos = await ev(page, () => window.__TFP.game.scene.getScene('Game').opPos.rotR);
    await click(page, pos.x, pos.y);
    await page.waitForTimeout(120);
  }
  check('rotate buttons turn a machine', (await ev(page, () => window.__TFP.game.scene.getScene('Game').world.machine('spring').angle)) === 30);
  await page.screenshot({ path: `${OUT}/smoke-level5-aim.png` });
  await page.keyboard.press('Space');
  await page.keyboard.press('f');
  await gameState(page, 'won');
  check('level 5 solved by rotating the spring', true);

  // save persistence across a reload
  await page.reload();
  await active(page, 'Menu');
  const saved = await ev(page, () => window.__TFP.save.data);
  check('progress persists after reload', saved.stars['first-shift'] === 3 && saved.stars['boing'] >= 1 && saved.unlocked >= 2 && saved.settings.reducedShake === true, JSON.stringify(saved.stars));

  // corrupted save must not break boot
  await page.evaluate(() => localStorage.setItem('tiny-factory-panic-save', '{{{ definitely not json'));
  await page.reload();
  await active(page, 'Menu');
  check('corrupted save data is handled safely', await ev(page, () => window.__TFP.save.data.unlocked === 1));

  // panic mode
  await startScene(page, 'Panic');
  await active(page, 'Panic');
  await page.waitForTimeout(2500);
  const dirBefore = await ev(page, () => window.__TFP.game.scene.getScene('Panic').world.machine('top').dir);
  await click(page, 360, 570);
  const dirAfter = await ev(page, () => window.__TFP.game.scene.getScene('Panic').world.machine('top').dir);
  check('panic mode: tapping a belt flips it live', dirBefore !== dirAfter);
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
  await gameState(tp, 'prep');
  await tp.waitForTimeout(1400);
  await tap(tp, 300, 430);
  check('touch: tapping the belt flips it', (await ev(tp, () => window.__TFP.game.scene.getScene('Game').world.machine('belt').dir)) === 1);
  await tp.screenshot({ path: `${OUT}/smoke-mobile-level1.png` });
  const tb = await hudBtn(tp, 'runBtn');
  await tap(tp, tb.x, tb.y);
  await gameState(tp, 'won');
  check('touch: level 1 can be completed with taps only', true);
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
