import Phaser from 'phaser';
import { COLORS, GAME_W, HUD_H, PLAY_H, STEP_MS, view, WORKSHOP } from '../config';
import type { LevelDef, TutorialStep } from '../levels/LevelTypes';
import type { BaseMachine } from '../machines/BaseMachine';
import { ConveyorBelt } from '../machines/ConveyorBelt';
import { Piston } from '../machines/Piston';
import { SpringBumper } from '../machines/SpringBumper';
import { platform } from '../platform';
import { drawFactoryBackground, safeTop, setupCamera } from '../rendering/Background';
import { drawIcon, type IconName } from '../rendering/Icons';
import { DEPTH } from '../rendering/MachineViews';
import { circle } from '../rendering/VectorFactory';
import { WorldView } from '../rendering/WorldView';
import { FactoryWorld } from '../sim/FactoryWorld';
import { audio } from '../systems/AudioManager';
import { LevelManager } from '../systems/LevelManager';
import { PuzzleRules } from '../systems/PuzzleRules';
import { save } from '../systems/SaveManager';
import { computeStars } from '../systems/ScoreManager';
import { Button, fadeIn, gotoScene } from '../ui/UIComponents';
import type { UIScene } from './UIScene';

export type GameState = 'prep' | 'running' | 'won' | 'failed';
type OpName = 'rotL' | 'rotR' | 'flip' | 'clock';

export interface TutorialHint {
  kind: 'tap' | 'drag' | 'run';
  /** id of the machine this hint is about */
  machine?: string;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  text: string;
}

interface Press {
  m: BaseMachine;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  moved: boolean;
  lastValid: { x: number; y: number };
}

/** Remember each level's machine layout for the session so "Retry" and re-entry keep the player's work. */
const sessionConfigs = new Map<string, ReturnType<FactoryWorld['getConfig']>>();

/**
 * Puzzle Factory gameplay: preparation (select / drag / rotate / flip machines)
 * and simulation (fixed-step physics, rules, results).
 */
export class GameScene extends Phaser.Scene {
  levelIndex = 0;
  level!: LevelDef;
  world!: FactoryWorld;
  rules!: PuzzleRules;
  view!: WorldView;
  state: GameState = 'prep';
  speed = 1;
  /** result of the most recent win, shown by the HUD banner */
  lastStars = 0;
  lastNewBest = false;
  /** bumps on every prep reset so delayed callbacks from an old run are ignored */
  private runToken = 0;
  private acc = 0;
  private selected: BaseMachine | null = null;
  private press: Press | null = null;
  private placementOk = true;
  private selG!: Phaser.GameObjects.Graphics;
  private haloG!: Phaser.GameObjects.Graphics;
  private ops!: Phaser.GameObjects.Container;
  private opPos: Partial<Record<OpName, { x: number; y: number }>> = {};
  private pulse = 0;
  private debugG: Phaser.GameObjects.Graphics | null = null;
  private debugT: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('Game');
  }

  init(data: { level?: number }): void {
    this.levelIndex = data.level ?? 0;
    this.level = LevelManager.get(this.levelIndex);
    this.state = 'prep';
    this.speed = 1;
    this.acc = 0;
    this.selected = null;
    this.press = null;
    this.opPos = {};
  }

  create(): void {
    setupCamera(this);
    drawFactoryBackground(this, true, true);
    fadeIn(this);

    this.world = new FactoryWorld(this.level);
    this.rules = new PuzzleRules(this.world, this.level);
    // Classic puzzle levels remember the player's layout; sorting levels always start fresh.
    const stored = this.level.sortAll ? undefined : sessionConfigs.get(this.level.id);
    if (stored) this.world.applyConfig(stored);
    this.view = new WorldView(this, this.world);

    this.haloG = this.add.graphics().setDepth(DEPTH.zone + 1);
    this.selG = this.add.graphics().setDepth(DEPTH.select - 1);
    this.ops = this.add.container(0, 0).setDepth(DEPTH.select);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.keyboard?.on('keydown', this.onKey, this);
    this.events.on('chain', (n: number) => {
      this.view.floatText(GAME_W / 2, HUD_H + 60, n >= 8 ? 'Mega chain!' : 'Chain reaction!', '#9479e0', 26);
      audio.combo(n >= 8 ? 3 : 1);
    });

    if (this.scene.isActive('UI')) this.scene.stop('UI');
    this.scene.launch('UI', { mode: 'puzzle' });

    if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {
      this.debugG = this.add.graphics().setDepth(999);
      this.debugT = this.add.text(8, HUD_H + 6, '', { fontFamily: 'monospace', fontSize: '13px', color: '#43536A', backgroundColor: '#ffffffcc' }).setDepth(999);
    }

    platform.gameplayStart();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    // Sorting levels have no RUN button: the factory starts by itself after the intro card.
    if (this.level.sortAll) this.scheduleStart(1000);
  }

  private scheduleStart(ms: number): void {
    const token = this.runToken;
    this.time.delayedCall(ms, () => {
      if (token === this.runToken && this.state === 'prep') this.run();
    });
  }

  /** Flippable belts, left to right: the same order as their buttons at the bottom of the screen. */
  get belts(): ConveyorBelt[] {
    return this.world.machines
      .filter((m): m is ConveyorBelt => m instanceof ConveyorBelt && m.canFlip)
      .sort((a, b) => a.x - b.x || a.y - b.y);
  }
  private get liveBelts(): ConveyorBelt[] {
    return this.belts;
  }

  /** Flip one belt (bottom buttons, taps on the belt and the keyboard all end up here). */
  flipBelt(id: string): void {
    if (this.state !== 'prep' && this.state !== 'running') return;
    const belt = this.world.machine(id);
    if (belt instanceof ConveyorBelt && belt.canFlip) belt.flip();
  }

  private shutdown(): void {
    sessionConfigs.set(this.level.id, this.world.getConfig());
    this.input.off('pointerdown', this.onDown, this);
    this.input.off('pointermove', this.onMove, this);
    this.input.off('pointerup', this.onUp, this);
    this.input.off('pointerupoutside', this.onUp, this);
    this.input.keyboard?.off('keydown', this.onKey, this);
    this.events.off('chain');
    this.time.removeAllEvents();
    this.view.destroy();
    this.world.destroy();
    platform.gameplayStop();
  }

  // --- flow ---------------------------------------------------------------------

  /** Press Run: lock the layout and switch the factory on. */
  run(): void {
    if (this.state !== 'prep') return;
    this.cancelPress();
    this.select(null);
    sessionConfigs.set(this.level.id, this.world.getConfig());
    this.state = 'running';
    this.acc = 0;
    this.world.start();
    audio.whirr();
  }

  /** Instant retry: back to the preparation phase with the layout intact. */
  retry(): void {
    this.runToken++;
    if (this.scene.isActive('Result')) this.scene.stop('Result');
    const wasRunning = this.state !== 'prep';
    this.world.reset();
    this.cameras.main.zoomEffect.reset();
    this.cameras.main.setZoom(view.res);
    this.state = 'prep';
    this.speed = 1;
    this.acc = 0;
    if (wasRunning) audio.powerDown();
    platform.gameplayStart();
    if (this.level.sortAll) {
      // put every belt back the way the level starts, then go again
      for (const b of this.liveBelts) {
        if (b.dir !== (b.def.dir ?? 1)) {
          b.dir = b.def.dir ?? 1;
          this.world.events.emit('machineChanged', b);
        }
      }
      this.scheduleStart(800);
    }
  }

  toggleRun(): void {
    if (this.state === 'prep') this.run();
    else this.retry();
  }

  toggleSpeed(): void {
    this.speed = this.speed === 1 ? 3 : 1;
  }

  pause(): void {
    if (this.scene.isActive('Pause') || this.scene.isActive('Result')) return;
    this.cancelPress();
    platform.gameplayStop();
    this.scene.launch('Pause', { from: 'Game' });
    this.scene.pause();
  }

  nextLevel(): void {
    gotoScene(this, 'Game', { level: this.levelIndex + 1 });
  }

  private finish(result: 'won' | 'failed'): void {
    this.state = result;
    this.speed = 1;
    const token = this.runToken;
    platform.gameplayStop();
    if (result === 'won') {
      const summary = { mistakes: this.rules.mistakes, lost: this.rules.lost, seconds: this.rules.elapsedSeconds };
      const stars = computeStars(this.level, summary);
      const newBest = save.recordLevel(this.level.id, this.levelIndex, stars);
      save.markTutorial(this.level.id);
      this.time.delayedCall(350, () => {
        if (token !== this.runToken) return;
        audio.win();
        this.view.particles.celebrate(GAME_W / 2, 640, 70);
        if (!save.settings.reducedMotion) {
          // a tiny zoom punch to mark the moment
          const cam = this.cameras.main;
          cam.zoomTo(view.res * 1.03, 180, 'Sine.easeOut', true);
          this.time.delayedCall(200, () => cam.zoomTo(view.res, 420, 'Sine.easeInOut', true));
        }
      });
      this.lastStars = stars;
      this.lastNewBest = newBest;
      // No result dialog: celebrate briefly, then move straight on to the next level.
      this.time.delayedCall(2300, () => {
        if (token !== this.runToken) return;
        void platform.commercialBreak().then(() => {
          if (token !== this.runToken) return;
          if (LevelManager.hasNext(this.levelIndex)) this.nextLevel();
          else gotoScene(this, 'Menu');
        });
      });
    } else {
      this.time.delayedCall(250, () => token === this.runToken && audio.fail());
      // No dialog either: show why it failed for a moment, then hand the layout straight back.
      this.time.delayedCall(1900, () => {
        if (token !== this.runToken) return;
        this.retry();
      });
    }
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    if (this.state !== 'prep') {
      this.acc += dt * this.speed;
      let n = 0;
      while (this.acc >= STEP_MS && n < 10) {
        this.acc -= STEP_MS;
        n++;
        this.world.step();
        if (this.state === 'running') {
          const s = this.rules.update();
          if (s !== 'running') this.finish(s);
        }
      }
      if (n === 10) this.acc = 0; // never spiral after a long hitch
    }
    this.view.update(dt, this.state === 'prep');
    this.pulse += dt;
    this.drawPrepOverlays();
    if (this.debugG) this.drawDebug();
  }

  // --- selection & editing ------------------------------------------------------

  private worldPoint(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
  }

  private pick(x: number, y: number): BaseMachine | null {
    let best: BaseMachine | null = null;
    let bestD = Infinity;
    for (const m of this.world.machines) {
      if (!m.configurable || !m.hitTest(x, y, 14)) continue;
      const d = (m.x - x) ** 2 + (m.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  }

  private onDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    audio.unlock();
    if (over.length > 0) return;
    const p = this.worldPoint(pointer);
    if (this.level.sortAll) {
      // The one verb of the game: tap a belt to flip it, before or while toys are moving.
      if (this.state !== 'prep' && this.state !== 'running') return;
      let best: ConveyorBelt | null = null;
      let bestD = Infinity;
      for (const b of this.liveBelts) {
        if (!b.hitTest(p.x, p.y, 48)) continue; // generous: belts are the only controls
        const d = Math.abs(b.y - p.y) * 2 + Math.abs(b.x - p.x);
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      }
      if (best) best.flip();
      // a tap that hit no belt (often an attempt to drag a spring): point at the buttons
      else if (p.y > safeTop() + HUD_H && p.y < PLAY_H) (this.scene.get('UI') as UIScene).nudgeControls();
      return;
    }
    if (this.state !== 'prep') return;
    const m = this.pick(p.x, p.y);
    if (!m) {
      this.select(null);
      return;
    }
    const already = this.selected === m;
    this.select(m);
    this.press = { m, sx: p.x, sy: p.y, ox: m.x, oy: m.y, moved: false, lastValid: { x: m.x, y: m.y } };
    if (!already) audio.click();
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    const pr = this.press;
    if (!pr) return;
    if (!pointer.isDown) {
      this.onUp();
      return;
    }
    const m = pr.m;
    if (!m.canMove) return;
    const p = this.worldPoint(pointer);
    const dx = p.x - pr.sx;
    const dy = p.y - pr.sy;
    // A small dead zone keeps taps from nudging machines by accident.
    if (!pr.moved && dx * dx + dy * dy < 9 * 9) return;
    pr.moved = true;
    const z = m.def.zone!;
    const snap = (v: number, o: number) => o + Math.round((v - o) / 10) * 10;
    const c = this.world.clampToZone(m, snap(pr.ox + dx, z.x), snap(pr.oy + dy, z.y));
    if (c.x !== m.x || c.y !== m.y) {
      m.setTransform(c.x, c.y, m.angle);
      this.placementOk = this.world.isPlacementValid(m);
      if (this.placementOk) pr.lastValid = { x: c.x, y: c.y };
      this.layoutOps();
    }
  }

  private onUp(): void {
    const pr = this.press;
    if (!pr) return;
    this.press = null;
    const m = pr.m;
    if (pr.moved) {
      if (!this.placementOk) {
        m.setTransform(pr.lastValid.x, pr.lastValid.y, m.angle);
        this.placementOk = true;
        audio.buzz();
      } else {
        audio.thunk();
      }
      this.layoutOps();
      return;
    }
    // Tap: machines with a single tap-action respond immediately.
    if (!m.canMove && !m.canRotate) {
      if (m.canFlip) this.doOp('flip');
      else if (m.canTime) this.doOp('clock');
    }
  }

  private cancelPress(): void {
    if (this.press) this.onUp();
  }

  select(m: BaseMachine | null): void {
    if (this.selected === m) return;
    this.selected = m;
    this.placementOk = true;
    this.view.setAim(m);
    this.buildOps();
  }

  private buildOps(): void {
    this.ops.removeAll(true);
    this.opPos = {};
    const m = this.selected;
    if (!m) return;
    const list: { op: OpName; icon: IconName; color: number }[] = [];
    if (m.canRotate) {
      list.push({ op: 'rotL', icon: 'rotL', color: COLORS.blue });
      list.push({ op: 'rotR', icon: 'rotR', color: COLORS.blue });
    }
    if (m.canFlip) list.push({ op: 'flip', icon: 'flip', color: COLORS.yellow });
    if (m.canTime) list.push({ op: 'clock', icon: 'clock', color: COLORS.pink });
    list.forEach((it, i) => {
      const b = new Button(this, (i - (list.length - 1) / 2) * 88, 0, {
        w: 76,
        h: 66,
        icon: it.icon,
        color: it.color,
        radius: 22,
        onClick: () => this.doOp(it.op),
      });
      b.setData('op', it.op);
      this.ops.add(b);
    });
    this.layoutOps();
    if (!save.settings.reducedMotion && list.length) {
      this.ops.setScale(0.6);
      this.tweens.add({ targets: this.ops, scale: 1, duration: 200, ease: 'Back.easeOut' });
    }
  }

  private layoutOps(): void {
    const m = this.selected;
    if (!m || this.ops.length === 0) return;
    const e = m.extents();
    const reach = Math.abs(Math.sin(m.rad)) * e.hw + Math.abs(Math.cos(m.rad)) * e.hh;
    const n = this.ops.length;
    let y = m.y - reach - 64;
    if (y < HUD_H + 50) y = m.y + reach + 70;
    const x = Phaser.Math.Clamp(m.x, 50 + n * 44, GAME_W - 50 - n * 44);
    this.ops.setPosition(x, y);
    this.ops.each((b: Phaser.GameObjects.GameObject) => {
      const btn = b as Button;
      this.opPos[btn.getData('op') as OpName] = { x: x + btn.x, y };
    });
  }

  private doOp(op: OpName): void {
    const m = this.selected;
    if (!m || this.state !== 'prep') return;
    if ((op === 'rotL' || op === 'rotR') && m.canRotate) {
      const prev = m.angle;
      const next = m.steppedAngle(op === 'rotR' ? 1 : -1);
      if (next === prev) {
        audio.buzz();
        return;
      }
      m.setTransform(m.x, m.y, next);
      if (!this.world.isPlacementValid(m)) {
        m.setTransform(m.x, m.y, prev);
        audio.buzz();
        this.view.floatText(m.x, m.y - 40, 'No room!', '#e2566b', 18);
      }
      this.layoutOps();
    } else if (op === 'flip' && m instanceof ConveyorBelt && m.canFlip) {
      m.flip();
    } else if (op === 'clock' && m instanceof Piston && m.canTime) {
      m.cycleTiming();
      audio.flip();
    }
  }

  private onKey(ev: KeyboardEvent): void {
    if (platform.inBreak) return;
    const k = ev.key.toLowerCase();
    if (k === 'escape' || k === 'p') {
      this.pause();
      return;
    }
    if (this.level.sortAll) {
      // keyboard mirrors the bottom buttons: Space / A / Left / 1 = first button, D / Right / 2 = second
      audio.unlock();
      const belts = this.liveBelts;
      const i = [' ', 'a', 'arrowleft', '1'].includes(k) ? 0 : ['d', 'arrowright', '2'].includes(k) ? Math.min(1, belts.length - 1) : -1;
      if (i >= 0 && belts[i] && (this.state === 'prep' || this.state === 'running')) belts[i].flip();
      else if (k === 'r') this.retry();
      return;
    }
    if (k === ' ' || k === 'enter') {
      audio.unlock();
      this.toggleRun();
      return;
    }
    if (k === 'r') {
      this.retry();
      return;
    }
    if (this.state !== 'prep') {
      if (k === 'f') this.toggleSpeed();
      return;
    }
    if (k === 'tab') {
      ev.preventDefault();
      const list = this.world.machines.filter((m) => m.configurable);
      if (list.length) this.select(list[(list.indexOf(this.selected as BaseMachine) + 1) % list.length]);
      return;
    }
    const m = this.selected;
    if (!m) return;
    if (k === 'q') this.doOp('rotL');
    else if (k === 'e') this.doOp('rotR');
    else if (k === 'f') this.doOp('flip');
    else if (k === 't') this.doOp('clock');
    else if (m.canMove && k.startsWith('arrow')) {
      const d = { arrowleft: [-10, 0], arrowright: [10, 0], arrowup: [0, -10], arrowdown: [0, 10] }[k];
      if (!d) return;
      const c = this.world.clampToZone(m, m.x + d[0], m.y + d[1]);
      const px = m.x;
      const py = m.y;
      m.setTransform(c.x, c.y, m.angle);
      if (!this.world.isPlacementValid(m)) m.setTransform(px, py, m.angle);
      this.layoutOps();
    }
  }

  // --- overlays -------------------------------------------------------------------

  private drawPrepOverlays(): void {
    const halo = this.haloG;
    const sel = this.selG;
    halo.clear();
    sel.clear();
    this.ops.setVisible(this.state === 'prep');
    // sorting levels keep their belts highlighted while toys are moving: they stay tappable
    const live = !!this.level.sortAll && this.state === 'running';
    if (this.state !== 'prep' && !live) return;
    const wave = 0.5 + 0.5 * Math.sin(this.pulse / 260);

    for (const m of this.world.machines) {
      if (!m.configurable) continue;
      const e = m.extents();
      const isSel = m === this.selected;
      const pad = isSel ? 9 : 7 + wave * 3;

      if (isSel && m.canMove && m.def.zone) {
        // placement zone: where this machine may be dragged
        const z = m.def.zone;
        const hw = Math.abs(Math.cos(m.rad)) * e.hw + Math.abs(Math.sin(m.rad)) * e.hh + 8;
        const hh = Math.abs(Math.sin(m.rad)) * e.hw + Math.abs(Math.cos(m.rad)) * e.hh + 8;
        halo.fillStyle(WORKSHOP.accent, 0.06);
        halo.fillRoundedRect(z.x - hw, z.y - hh, z.w + hw * 2, z.h + hh * 2, 18);
        this.dashedRect(halo, z.x - hw, z.y - hh, z.w + hw * 2, z.h + hh * 2, WORKSHOP.accent, 0.7);
      }

      const g = isSel ? sel : halo;
      g.save();
      g.translateCanvas(m.x, m.y);
      g.rotateCanvas(m.rad);
      const bad = isSel && !this.placementOk;
      // a belt's outline and badge use its accent colour: the same colour as its button below
      const accent = m instanceof ConveyorBelt && m.def.accent !== undefined ? m.def.accent : WORKSHOP.accent;
      g.lineStyle(isSel ? 4 : 3, bad ? COLORS.red : accent, isSel ? 1 : 0.35 + wave * 0.45);
      g.strokeRoundedRect(-e.hw - pad, -e.hh - pad, (e.hw + pad) * 2, (e.hh + pad) * 2, 16);
      if (bad) {
        g.fillStyle(COLORS.red, 0.22);
        g.fillRoundedRect(-e.hw - pad, -e.hh - pad, (e.hw + pad) * 2, (e.hh + pad) * 2, 16);
      }
      g.restore();

      if (!isSel) {
        // little badge telling the player what this machine can do
        const icon: IconName = m.canMove ? 'move' : m.canRotate ? 'rotR' : m.canFlip ? 'flip' : 'clock';
        const reach = Math.abs(Math.sin(m.rad)) * e.hw + Math.abs(Math.cos(m.rad)) * e.hh;
        const bx = m.x + (Math.abs(Math.cos(m.rad)) * e.hw + Math.abs(Math.sin(m.rad)) * e.hh) * 0.72;
        const by = m.y - reach - 16 - wave * 3;
        halo.save();
        halo.translateCanvas(bx, by);
        circle(halo, 0, 0, 18, WORKSHOP.panel, 0);
        drawIcon(halo, icon, 10, accent);
        halo.restore();
      }
    }
  }

  private dashedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha: number): void {
    g.lineStyle(3, color, alpha);
    const dash = 12;
    const gap = 9;
    const edge = (x1: number, y1: number, x2: number, y2: number) => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const ux = (x2 - x1) / len;
      const uy = (y2 - y1) / len;
      for (let d = 10; d < len - 10; d += dash + gap) {
        const e = Math.min(d + dash, len - 10);
        g.lineBetween(x1 + ux * d, y1 + uy * d, x1 + ux * e, y1 + uy * e);
      }
    };
    edge(x, y, x + w, y);
    edge(x + w, y, x + w, y + h);
    edge(x + w, y + h, x, y + h);
    edge(x, y + h, x, y);
  }

  // --- tutorial support ---------------------------------------------------------

  private stepDone(step: TutorialStep, m: BaseMachine): boolean {
    const sol = this.level.solution[m.id] ?? {};
    switch (step.op) {
      case 'flip':
        return m instanceof ConveyorBelt && m.dir === sol.dir;
      case 'rotate':
        return m.angle === sol.angle;
      case 'timing':
        return m instanceof Piston && m.phase === sol.phase;
      case 'move':
        return Math.abs(m.x - (sol.x ?? m.x)) <= 30 && Math.abs(m.y - (sol.y ?? m.y)) <= 30;
    }
  }

  /** What the tutorial hand should point at right now (null = no tutorial). */
  tutorialHint(): TutorialHint | null {
    const live = !!this.level.sortAll && this.state === 'running';
    if ((this.state !== 'prep' && !live) || !this.level.tutorial || save.data.tutorialsDone[this.level.id]) return null;
    for (const step of this.level.tutorial) {
      const m = this.world.machine(step.machine);
      if (!m || this.stepDone(step, m)) continue;
      const sol = this.level.solution[m.id] ?? {};
      if (step.op === 'move') {
        if (this.press?.moved) return null;
        return { kind: 'drag', x: m.x, y: m.y, x2: sol.x ?? m.x, y2: sol.y ?? m.y, text: step.text };
      }
      let target = { x: m.x, y: m.y };
      if (this.selected === m) {
        const op: OpName = step.op === 'flip' ? 'flip' : step.op === 'timing' ? 'clock' : (sol.angle ?? 0) > m.angle ? 'rotR' : 'rotL';
        target = this.opPos[op] ?? target;
      }
      return { kind: 'tap', machine: m.id, x: target.x, y: target.y, text: step.text };
    }
    if (this.level.sortAll) return null; // nothing to press: the factory runs by itself
    return { kind: 'run', x: 0, y: 0, text: 'Now press RUN!' };
  }

  // --- debug ----------------------------------------------------------------------

  private drawDebug(): void {
    const g = this.debugG!;
    g.clear();
    g.lineStyle(1, 0xff00ff, 0.8);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bodies: any[] = (this.world.engine.world.bodies as any[]) ?? [];
    for (const b of bodies) {
      g.lineStyle(1, b.isSensor ? 0x00aa00 : b.isStatic ? 0x0000ff : 0xff00ff, 0.8);
      g.strokePoints(b.vertices, true, true);
    }
    this.debugT!.setText(
      `fps ${this.game.loop.actualFps.toFixed(0)}  bodies ${this.world.bodyCount}  toys ${this.world.objects.length}  state ${this.state}  tick ${this.world.tick}  x${this.speed}`,
    );
  }

  /** Used by bumpers' aim preview and tests. */
  get selectedMachine(): BaseMachine | null {
    return this.selected;
  }

  /** True if the selected machine is a pad bumper (aim dots are showing). */
  get aiming(): boolean {
    return this.selected instanceof SpringBumper && this.selected.def.shape === 'pad';
  }
}
