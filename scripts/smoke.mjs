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
/** Logical position of a machine in the factory. */
const machinePos = (page, id) => page.evaluate((i) => {
  const m = window.__TFP.game.scene.getScene('Game').world.machine(i);
  return { x: m.x, y: m.y };
}, id);

/** Set the current level up to its solution by tapping each machine until it matches, with `tapAt`. */
async function setUp(page, tapAt) {
  for (let guard = 0; guard < 20; guard++) {
    const next = await page.evaluate(() => {
      const g = window.__TFP.game.scene.getScene('Game');
      for (const [id, want] of Object.entries(g.level.solution)) {
        const m = g.world.machine(id);
        const have = m.getConfig();
        const same = Object.entries(want).every(([k, v]) => Math.abs((have[k] ?? 0) - v) < 1e-6);
        if (!same) return { x: m.x, y: m.y };
      }
      return null;
    });
    if (!next) return true;
    await tapAt(next.x, next.y);
    await page.waitForTimeout(120);
  }
  return false;
}

/** Wait for the current run to end. */
async function waitResult(page) {
  await page.waitForFunction(() => ['won', 'failed'].includes(window.__TFP.game.scene.getScene('Game').state), null, { timeout: 30000 });
  return page.evaluate(() => window.__TFP.game.scene.getScene('Game').state);
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
  await active(page, 'Game');
  await gameState(page, 'prep');
  check('a first visit goes straight into level 1, waiting in setup', (await ev(page, () => window.__TFP.game.scene.getScene('Game').levelIndex)) === 0);
  await page.waitForTimeout(800);
  await startScene(page, 'Menu');
  await active(page, 'Menu');
  check('the title screen still works', true);
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
  await page.waitForTimeout(1500);
  check('the level waits in setup until RUN is pressed', (await ev(page, () => window.__TFP.game.scene.getScene('Game').state)) === 'prep');
  check('HUD scene is running, with one big RUN button', await ev(page, () => window.__TFP.game.scene.isActive('UI') && !!window.__TFP.game.scene.getScene('UI').runBtn));
  check('tutorial hand points at the belt', (await ev(page, () => window.__TFP.game.scene.getScene('Game').tutorialHint()?.machine)) === 'belt');
  await click(page, 60, 400); // empty wall: playtesters tried to drag the springs
  await page.waitForTimeout(150); // the label updates on the next frame
  const nudge = await ev(page, () => {
    const ui = window.__TFP.game.scene.getScene('UI');
    const g = window.__TFP.game.scene.getScene('Game');
    return { on: ui.nudgeUntil > ui.time.now, flash: g.badgeFlashUntil > g.time.now, text: ui.effectT.text, belt: g.world.machine('belt').dir };
  });
  check('tapping empty space flashes the badges, explains, and changes nothing', nudge.on && nudge.flash && nudge.text.includes('BADGE') && nudge.belt === 1, JSON.stringify(nudge));
  let rb = await hudBtn(page, 'runBtn');
  await click(page, rb.x, rb.y); // RUN before tapping the belt: it waits (fit test: 35% failed level 1 this way)
  await page.waitForTimeout(200);
  check('RUN waits until the tutorial step is done', (await ev(page, () => window.__TFP.game.scene.getScene('Game').state)) === 'prep');
  let mp = await machinePos(page, 'belt');
  await click(page, mp.x, mp.y); // tap the belt: the first thing the player learns
  check('tapping the belt flips it', (await ev(page, () => window.__TFP.game.scene.getScene('Game').world.machine('belt').dir)) === -1);
  check('then the tutorial points at RUN', (await ev(page, () => window.__TFP.game.scene.getScene('Game').tutorialHint()?.kind)) === 'run');
  await page.screenshot({ path: `${OUT}/smoke-level1-setup.png` });
  rb = await hudBtn(page, 'runBtn');
  await click(page, rb.x, rb.y);
  check('RUN starts the factory', (await ev(page, () => window.__TFP.game.scene.getScene('Game').state)) === 'running');
  await page.waitForTimeout(150);
  await click(page, rb.x, rb.y); // a second tap must not stop the run (fit test: 30% stopped level 1)
  await page.waitForTimeout(150);
  const fast = await ev(page, () => {
    const g = window.__TFP.game.scene.getScene('Game');
    return { state: g.state, speed: g.speed, label: window.__TFP.game.scene.getScene('UI').runBtn.labelT?.text };
  });
  check('tapping the big button during a run speeds it up instead of stopping it', fast.state === 'running' && fast.speed === 3, JSON.stringify(fast));
  await click(page, mp.x, mp.y); // machines are locked while the toys move
  check('machines cannot be changed during a run', (await ev(page, () => window.__TFP.game.scene.getScene('Game').world.machine('belt').dir)) === -1);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/smoke-level1-running.png` });
  await gameState(page, 'won');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/smoke-level1-complete.png` });
  const r1 = await ev(page, () => {
    const g = window.__TFP.game.scene.getScene('Game');
    return { delivered: g.rules.delivered.blue, mistakes: g.rules.mistakes, stars: window.__TFP.save.data.stars['first-flip'], unlocked: window.__TFP.save.data.unlocked };
  });
  check('level 1 completes on the first run: 3 delivered, 3 stars, level 2 unlocked', r1.delivered === 3 && r1.mistakes === 0 && r1.stars === 3 && r1.unlocked === 2, JSON.stringify(r1));

  // no button press: the game moves on by itself
  await page.waitForFunction(() => window.__TFP.game.scene.getScene('Game').levelIndex === 1 && window.__TFP.game.scene.getScene('Game').state === 'prep', null, { timeout: 20000 });
  check('the next level loads by itself after a win and waits in setup', true);

  // a half-done setup fails, says why, and hands the setup back as it was
  await page.waitForTimeout(600);
  check('level 2: the hand points at the belt that is wrong', (await ev(page, () => window.__TFP.game.scene.getScene('Game').tutorialHint()?.machine)) === 'beltL');
  mp = await machinePos(page, 'beltL');
  await click(page, mp.x, mp.y); // the tutorial step
  await page.waitForTimeout(150);
  mp = await machinePos(page, 'beltR'); // the right belt starts correct, so flipping it is a mistake
  await click(page, mp.x, mp.y);
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');
  await gameState(page, 'failed');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/smoke-level2-failed.png` });
  const reason = await ev(page, () => window.__TFP.game.scene.getScene('Game').rules.failReason);
  check('a wrong setup fails with a clear reason', /went in the .* bin|missed the bins/.test(reason), reason);
  await gameState(page, 'prep');
  await page.waitForTimeout(150); // the HUD updates on the next frame
  const after = await ev(page, () => {
    const g = window.__TFP.game.scene.getScene('Game');
    return { toys: g.world.objects.length, beltR: g.world.machine('beltR').dir, runs: g.runs, stars: window.__TFP.game.scene.getScene('UI').starsShown };
  });
  check('after a failed run the setup comes back as the player left it, and fewer stars are on offer', after.toys === 0 && after.beltR === -1 && after.runs === 1 && after.stars === 2, JSON.stringify(after));
  check('no hint after one failed run', !(await ev(page, () => window.__TFP.game.scene.getScene('UI').hintBtn.visible)));
  await page.keyboard.press('Space'); // fail a second time
  await gameState(page, 'failed');
  await gameState(page, 'prep');
  await page.waitForTimeout(200);
  check('after two failed runs a HINT button appears', await ev(page, () => window.__TFP.game.scene.getScene('UI').hintBtn.visible));
  const hb = await hudBtn(page, 'hintBtn');
  await click(page, hb.x, hb.y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/smoke-hint.png` });
  const hint = await ev(page, () => {
    const g = window.__TFP.game.scene.getScene('Game');
    return { active: g.hintActive, machine: g.tutorialHint()?.machine, text: g.tutorialHint()?.text };
  });
  check('the hint points at the machine that is set wrong', hint.active && hint.machine === 'beltR', JSON.stringify(hint));

  // pause / resume during a run
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
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

  // keyboard only: number keys tap the machines left to right, Space runs (level 3: two stacked belts)
  await startScene(page, 'Game', { level: 2 });
  await gameState(page, 'prep');
  await page.waitForTimeout(400);
  await page.keyboard.press('1'); // a person never presses two keys within one frame
  await page.waitForTimeout(150);
  await page.keyboard.press('2');
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');
  check('level 3 can be set up and won with the keyboard', (await waitResult(page)) === 'won');

  // mouse: the finale, every kind of machine (level 12)
  await startScene(page, 'Game', { level: 11 });
  await gameState(page, 'prep');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/smoke-level12.png` });
  await setUp(page, (x, y) => click(page, x, y));
  rb = await hudBtn(page, 'runBtn');
  await click(page, rb.x, rb.y);
  check('level 12 (timer, belt and bouncer) can be set up with the mouse and won', (await waitResult(page)) === 'won');

  // save persistence across a reload
  await page.reload();
  await active(page, 'Menu');
  const saved = await ev(page, () => window.__TFP.save.data);
  check('progress persists after reload', saved.stars['first-flip'] === 3 && saved.stars['flip-stack'] >= 1 && saved.unlocked >= 3 && saved.settings.reducedShake === true, JSON.stringify(saved.stars));

  // corrupted save must not break boot (it counts as a first visit: straight into level 1)
  await page.evaluate(() => localStorage.setItem('tiny-factory-panic-save', '{{{ definitely not json'));
  await page.reload();
  await active(page, 'Game');
  check('corrupted save data is handled safely', await ev(page, () => window.__TFP.save.data.unlocked === 1));

  // panic mode
  await startScene(page, 'Panic');
  await active(page, 'Panic');
  await page.waitForTimeout(2500);
  const dirBefore = await ev(page, () => window.__TFP.game.scene.getScene('Panic').world.machine('beltL').dir);
  const bb = await beltBtn(page, 'beltL');
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
    await startScene(page, 'Game', { level: i * 2 % 12 });
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
  await tp.goto(URL + '&menu');
  await active(tp, 'Menu');
  await tp.waitForTimeout(800);
  await tp.screenshot({ path: `${OUT}/smoke-mobile-menu.png` });
  await tap(tp, 360, 680);
  await active(tp, 'Game');
  await gameState(tp, 'prep');
  await tp.waitForTimeout(1500); // let the wipe finish revealing the level
  const tm = await machinePos(tp, 'belt');
  await tap(tp, tm.x, tm.y);
  check('touch: tapping the belt flips it', (await ev(tp, () => window.__TFP.game.scene.getScene('Game').world.machine('belt').dir)) === -1);
  await tp.screenshot({ path: `${OUT}/smoke-mobile-level1.png` });
  let trb = await hudBtn(tp, 'runBtn');
  await tap(tp, trb.x, trb.y);
  check('touch: level 1 can be completed with two taps', (await waitResult(tp)) === 'won');
  // a level with two bouncers, set up entirely with touch taps
  await startScene(tp, 'Game', { level: 6 });
  await gameState(tp, 'prep');
  await tp.waitForTimeout(400);
  await setUp(tp, (x, y) => tap(tp, x, y));
  trb = await hudBtn(tp, 'runBtn');
  await tap(tp, trb.x, trb.y);
  check('touch: level 7 (two bouncers) can be set up by tapping and won', (await waitResult(tp)) === 'won');
  await tp.screenshot({ path: `${OUT}/smoke-mobile-level7.png` });
  check('touch: render resolution adapts to the device', (await ev(tp, () => window.__TFP.game.config.width)) >= 720);
  await tctx.close();

  // ---------------------------------------------------------------- viewports
  for (const [w, h] of [[390, 844], [412, 915], [768, 1024], [1280, 720], [1920, 1080], [650, 590]]) {
    const vctx = await browser.newContext({ viewport: { width: w, height: h } });
    const vp = await vctx.newPage();
    watch(vp, `${w}x${h}`);
    await vp.goto(URL + '&menu');
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
  await sp.goto(URL + '&safe=47,34&menu');
  await active(sp, 'Menu');
  await startScene(sp, 'Game', { level: 5 });
  await gameState(sp, 'prep');
  await sp.waitForTimeout(500);
  const sbox = await sp.locator('#game canvas').boundingBox();
  const edges = await sp.evaluate(() => {
    const ui = window.__TFP.game.scene.getScene('UI');
    const v = window.__TFP.view;
    const top = v.cy - v.h / 2;
    const lowest = ui.runBtn.getWorldTransformMatrix().ty + 60;
    return { barTop: ui.bar.y - top, buttonsBottom: v.cy + v.h / 2 - lowest, perLogical: 0 };
  });
  const cssPerLogical = sbox.height / (await sp.evaluate(() => window.__TFP.view.h));
  check('safe area: the top bar starts below the camera cut-out', edges.barTop * cssPerLogical >= 46.5, `${(edges.barTop * cssPerLogical).toFixed(1)} px from the top`);
  check('safe area: RUN stays above the home indicator', edges.buttonsBottom * cssPerLogical >= 33.5, `${(edges.buttonsBottom * cssPerLogical).toFixed(1)} px from the bottom`);
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
