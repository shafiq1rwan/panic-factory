import Phaser from 'phaser';
import { COLORS, GAME_W, HUD_H, PLAY_H, STEP_MS, view, WORKSHOP } from '../config';
import type { LevelDef, TutorialStep } from '../levels/LevelTypes';
import type { BaseMachine } from '../machines/BaseMachine';
import { ConveyorBelt } from '../machines/ConveyorBelt';
import { Piston } from '../machines/Piston';
import { Fan } from '../machines/Fan';
import { SpringBumper } from '../machines/SpringBumper';
import { platform } from '../platform';
import { drawFactoryBackground, safeTop, setupCamera, themeForLevel, WATER_Y } from '../rendering/Background';
import { drawIcon, type IconName } from '../rendering/Icons';
import { DEPTH } from '../rendering/MachineViews';
import { circle } from '../rendering/VectorFactory';
import { WorldView } from '../rendering/WorldView';
import { FactoryWorld } from '../sim/FactoryWorld';
import { audio } from '../systems/AudioManager';
import { LevelManager } from '../systems/LevelManager';
import { PuzzleRules } from '../systems/PuzzleRules';
import { save } from '../systems/SaveManager';
import { computeStars, starsForRuns } from '../systems/ScoreManager';
import { Button, fadeIn, gotoScene } from '../ui/UIComponents';
import type { UIScene } from './UIScene';
import { unlockedOutfits } from '../systems/Outfits';

/** A reward shown after a win. */
export type RewardCard = { kind: 'outfit'; id: string } | { kind: 'panic' };

/** No ad break is requested after winning one of the first this-many levels. */
const NO_ADS_BEFORE_LEVEL = 3;

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
  /** RUN presses on this level so far (set-up-then-run levels are rated on it) */
  runs = 0;
  /** a hint was given on this level: the hand walks the player to the verified solution */
  hintActive = false;
  /** a hint is being fetched (rewarded ad on Poki) */
  hintPending = false;
  /** water worlds: the wave strip in front of the bins */
  private waves: Phaser.GameObjects.Graphics | null = null;
  private backWaves: Phaser.GameObjects.Graphics | null = null;
  private waveColors: { top: number; deep: number; foam: number } | null = null;
  /** set-up levels: until when the machines' badges flash after a tap that missed them */
  badgeFlashUntil = 0;
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
    this.runs = 0;
    this.hintActive = false;
    this.hintPending = false;
    this.hintTargets = null;
    this.badgeFlashUntil = 0;
  }

  create(): void {
    setupCamera(this);
    const theme = themeForLevel(this.levelIndex);
    drawFactoryBackground(this, true, true, theme);
    this.waves = theme.water ? this.add.graphics().setDepth(DEPTH.machineFront + 2) : null;
    this.backWaves = theme.water ? this.add.graphics().setDepth(DEPTH.machineBack - 1) : null;
    this.waveColors = theme.water ?? null;
    fadeIn(this);

    this.world = new FactoryWorld(this.level);
    this.rules = new PuzzleRules(this.world, this.level);
    // analytics: shows where players give up even if they never press RUN
    platform.measure('level', String(this.levelIndex + 1), 'open');
    // Classic puzzle levels remember the player's layout; sorting levels always start fresh.
    const stored = this.level.sortAll && !this.level.plan ? undefined : sessionConfigs.get(this.level.id);
    if (stored) this.world.applyConfig(stored);
    this.view = new WorldView(this, this.world, { pipe: { body: theme.pipe, rim: theme.pipeRim }, water: !!theme.water });

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
    if (this.level.sortAll && !this.level.plan) this.scheduleStart(1000);
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
    if (this.state === 'running') this.measureStop();
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

  /**
   * A tutorial step the player has not done yet. RUN waits for it: in the v1.12.1 fit test 35% of
   * players failed level 1 at least once, mostly by pressing RUN before tapping the belt.
   */
  get runBlocked(): boolean {
    return !!this.level.plan && this.state === 'prep' && this.tutorialStepPending() !== null;
  }

  /** What the waiting RUN button says: the step to do first (a grey RUN looked broken). */
  get runBlockedLabel(): string {
    const op = this.tutorialStepPending()?.op;
    return op === 'rotate' ? 'TURN THE BOUNCER FIRST' : op === 'timing' ? 'SET THE TIMER FIRST' : op === 'blow' ? 'TAP THE FAN FIRST' : 'FLIP THE BELT FIRST';
  }

  /** Press Run: lock the layout and switch the factory on. */
  run(): void {
    if (this.state !== 'prep') return;
    if (this.runBlocked) {
      this.badgeFlashUntil = this.time.now + 1300;
      audio.buzz();
      return;
    }
    this.cancelPress();
    this.select(null);
    sessionConfigs.set(this.level.id, this.world.getConfig());
    this.state = 'running';
    this.runs++;
    this.acc = 0;
    this.world.start();
    platform.measure('level', String(this.levelIndex + 1), 'start');
    audio.whirr();
  }

  /** Show reward cards one after another, then carry on (or leave for Panic mode). */
  private showRewards(cards: RewardCard[], token: number, done: () => void): void {
    const card = cards.shift();
    if (!card || token !== this.runToken) {
      if (token === this.runToken) done();
      return;
    }
    const ui = this.scene.get('UI') as UIScene;
    if (card.kind === 'outfit') {
      save.markOutfitsSeen(unlockedOutfits(save.totalStars).length);
      platform.measure('outfit', card.id, 'unlocked');
      ui.showRewardCard(card, (wear) => {
        if (wear) {
          save.wearOutfit(card.id);
          platform.measure('outfit', card.id, 'worn');
        }
        this.showRewards(cards, token, done);
      });
    } else {
      save.markPanicOffered();
      ui.showRewardCard(card, (play) => {
        if (play) {
          platform.measure('panic', 'offer', 'accepted');
          gotoScene(this, 'Panic');
        } else this.showRewards(cards, token, done);
      });
    }
  }

  /** Instant retry: back to the preparation phase with the layout intact. */
  retry(): void {
    if (this.state === 'running') this.measureStop();
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
    if (this.level.sortAll && !this.level.plan) {
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

  /**
   * A run the player ended before it won or failed (STOP, restart, leaving). Poki's guide asks
   * for complete or fail only when an attempt really ends that way, so this gets its own action.
   */
  private measureStop(): void {
    platform.measure('level', String(this.levelIndex + 1), 'stop');
  }

  /**
   * The big button: RUN before a run, FAST (x3, tap again for normal speed) during one.
   * It never stops a run: in the v1.9.2 fit test 30% of players stopped a level-1 run, most
   * likely by tapping the button again. Stopping is the top bar's restart button (or R).
   */
  toggleRun(): void {
    if (this.state === 'prep') this.run();
    else if (this.state === 'running') this.toggleSpeed();
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
    platform.measure('level', String(this.levelIndex + 1), result === 'won' ? 'complete' : 'fail');
    this.speed = 1;
    const token = this.runToken;
    platform.gameplayStop();
    if (result === 'won') {
      const summary = { mistakes: this.rules.mistakes, lost: this.rules.lost, seconds: this.rules.elapsedSeconds };
      const stars = this.level.plan ? starsForRuns(this.runs) : computeStars(this.level, summary);
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
      // rewards earned by this win: a new outfit (only the newest if several), Panic mode unlocked
      const cards: RewardCard[] = [];
      const have = unlockedOutfits(save.totalStars);
      if (have.length > save.data.outfitsSeen) cards.push({ kind: 'outfit', id: have[have.length - 1].id });
      if (LevelManager.panicUnlocked && !save.data.panicOffered) cards.push({ kind: 'panic' });
      // No result dialog: celebrate briefly, show any rewards, then move straight on to the next level.
      this.time.delayedCall(2300, () => {
        if (token !== this.runToken) return;
        this.showRewards(cards, token, () => goOnAfterRewards());
      });
      const goOnAfterRewards = (): void => {
        const goOn = (): void => {
          if (token !== this.runToken) return;
          if (LevelManager.hasNext(this.levelIndex)) this.nextLevel();
          else gotoScene(this, 'Menu');
        };
        // no ad break after the first levels: 5-7% of players left at each early level change in the fit test
        if (this.levelIndex < NO_ADS_BEFORE_LEVEL) goOn();
        else void platform.commercialBreak().then(goOn);
      };
    } else {
      this.time.delayedCall(250, () => token === this.runToken && audio.fail());
      // No dialog either: show why it failed for a moment, then hand the layout straight back.
      this.time.delayedCall(this.level.plan ? 1700 : 1900, () => {
        if (token !== this.runToken) return;
        this.retry();
      });
    }
  }

  /**
   * Water worlds: two rolling waves. One behind the bins (the surface they float in) and one
   * in front of them, see-through, with a thick foam crest, moving the other way.
   */
  private drawWaves(time: number): void {
    const c = this.waveColors;
    if (!c || !this.waves || !this.backWaves) return;
    const x0 = GAME_W / 2 - view.w / 2 - 20;
    const x1 = GAME_W / 2 + view.w / 2 + 20;
    const wave = (g: Phaser.GameObjects.Graphics, top: number, amp: number, len: number, speed: number, fill: number, alpha: number, foam: number): void => {
      const yAt = (x: number): number => top + Math.sin(x / len + time * speed) * amp + Math.sin(x / (len * 0.47) - time * speed * 1.7) * amp * 0.35;
      g.fillStyle(fill, alpha);
      g.beginPath();
      g.moveTo(x0, PLAY_H + 60);
      for (let x = x0; x <= x1; x += 10) g.lineTo(x, yAt(x));
      g.lineTo(x1, PLAY_H + 60);
      g.closePath();
      g.fillPath();
      g.lineStyle(foam, c.foam, 0.95);
      g.beginPath();
      for (let x = x0; x <= x1; x += 10) {
        if (x === x0) g.moveTo(x, yAt(x));
        else g.lineTo(x, yAt(x));
      }
      g.strokePath();
    };
    this.backWaves.clear();
    wave(this.backWaves, WATER_Y - 2, 5, 46, -0.0016, c.top, 1, 3);
    this.waves.clear();
    wave(this.waves, WATER_Y + 34, 6, 34, 0.0021, c.top, 0.62, 5);
  }

  override update(_time: number, delta: number): void {
    this.drawWaves(_time);
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

  private pick(x: number, y: number, pad = 14): BaseMachine | null {
    let best: BaseMachine | null = null;
    let bestD = Infinity;
    for (const m of this.world.machines) {
      if (!m.configurable || !m.hitTest(x, y, pad)) continue;
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
    if (this.level.plan) {
      // Set up, then run: before RUN a tap changes the machine under the finger; while the toys
      // move nothing can be changed. A tap that hits nothing points the player at the right thing.
      const inField = p.y > safeTop() + HUD_H && p.y < PLAY_H;
      if (this.state === 'prep') {
        const m = this.pick(p.x, p.y, 34);
        if (m) this.tapMachine(m);
        else if (inField) {
          this.badgeFlashUntil = this.time.now + 1300;
          (this.scene.get('UI') as UIScene).nudgeControls();
        }
      } else if (this.state === 'running' && inField) (this.scene.get('UI') as UIScene).nudgeControls();
      return;
    }
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

  /**
   * One tap = one change: a belt flips, a bouncer turns to its next angle, a timer moves on one
   * step. Public so the tests can drive it.
   */
  tapMachine(m: BaseMachine): void {
    if (this.state !== 'prep' || !m.configurable) return;
    if (m instanceof ConveyorBelt && m.canFlip) {
      m.flip();
    } else if (m.canRotate) {
      const prev = m.angle;
      m.setTransform(m.x, m.y, m.nextAngle());
      if (!this.world.isPlacementValid(m)) {
        m.setTransform(m.x, m.y, prev);
        audio.buzz();
        return;
      }
      audio.boing(1.2);
    } else if (m instanceof Piston && m.canTime) {
      m.cycleTiming();
      audio.flip();
    } else if (m instanceof Fan && m.canBlow) {
      m.nextPower();
      audio.flip();
    }
    this.view.popMachine(m);
  }

  /** Tap a machine by id (tests, keyboard). */
  tapMachineId(id: string): void {
    const m = this.world.machine(id);
    if (m) this.tapMachine(m);
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
    if (this.level.plan) {
      audio.unlock();
      if (k === ' ' || k === 'enter') this.toggleRun();
      else if (k === 'r') this.retry();
      else if (this.state === 'prep' && /^[1-9]$/.test(k)) {
        // number keys tap the adjustable machines, left to right
        const list = this.world.machines.filter((m) => m.configurable).sort((a, b) => a.x - b.x || a.y - b.y);
        const m = list[parseInt(k, 10) - 1];
        if (m) this.tapMachine(m);
      }
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
    const live = !!this.level.sortAll && !this.level.plan && this.state === 'running';
    if (this.state !== 'prep' && !live) return;
    const flashing = this.time.now < this.badgeFlashUntil;
    const wave = flashing ? 0.5 + 0.5 * Math.sin(this.pulse / 70) : 0.5 + 0.5 * Math.sin(this.pulse / 260);

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
        const icon: IconName = m.canMove ? 'move' : m.canRotate ? 'rotR' : m.canFlip ? 'flip' : m.canBlow ? 'wind' : 'clock';
        const reach = Math.abs(Math.sin(m.rad)) * e.hw + Math.abs(Math.cos(m.rad)) * e.hh;
        const bx = m.x + (Math.abs(Math.cos(m.rad)) * e.hw + Math.abs(Math.sin(m.rad)) * e.hh) * 0.72;
        const by = m.y - reach - 16 - wave * 3;
        halo.save();
        halo.translateCanvas(bx, by);
        const r = flashing ? 18 + wave * 6 : 18;
        circle(halo, 0, 0, r, WORKSHOP.panel, 0);
        drawIcon(halo, icon, r * 0.56, accent);
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
      case 'blow':
        return m instanceof Fan && m.power === sol.power;
      case 'move':
        return Math.abs(m.x - (sol.x ?? m.x)) <= 30 && Math.abs(m.y - (sol.y ?? m.y)) <= 30;
    }
  }

  /** The first tutorial step not done yet (set-up levels, before the level is first won). */
  private tutorialStepPending(): TutorialStep | null {
    if (!this.level.tutorial || save.data.tutorialsDone[this.level.id]) return null;
    for (const step of this.level.tutorial) {
      const m = this.world.machine(step.machine);
      if (m && !this.stepDone(step, m)) return step;
    }
    return null;
  }

  /** Hints are offered after this many failed runs on a level. */
  static readonly HINT_AFTER_FAILS = 1;

  /** Should the HINT button show? */
  get hintAvailable(): boolean {
    return !!this.level.plan && this.state === 'prep' && !this.hintActive && !this.hintPending && this.runs >= GameScene.HINT_AFTER_FAILS && !this.runBlocked;
  }

  /** The HINT button: on Poki a rewarded ad, then the hand walks the player to the verified solution. */
  async requestHint(): Promise<void> {
    if (!this.hintAvailable) return;
    this.hintPending = true;
    const ok = await platform.rewardedBreak();
    this.hintPending = false;
    if (!this.scene.isActive()) return;
    platform.gameplayStart();
    if (!ok) {
      (this.scene.get('UI') as UIScene).flashStatus('NO HINT RIGHT NOW, TRY AGAIN LATER');
      return;
    }
    this.hintActive = true;
    platform.measure('hint', String(this.levelIndex + 1), 'used');
  }

  /** The machine the hint points at: the first one not yet set as in the verified solution. */
  private hintTarget(): BaseMachine | null {
    if (!this.hintTargets) {
      // the level's own starting settings, overridden by the solution: the full winning setup
      const fresh = new FactoryWorld(this.level);
      this.hintTargets = {};
      for (const m of fresh.machines) if (m.configurable) this.hintTargets[m.id] = { ...m.getConfig(), ...(this.level.solution[m.id] ?? {}) };
      fresh.destroy();
    }
    for (const m of this.world.machines) {
      const want = this.hintTargets[m.id];
      if (!m.configurable || !want) continue;
      const have = m.getConfig() as Record<string, number | undefined>;
      for (const [k, v] of Object.entries(want)) {
        if (typeof v === 'number' && Math.abs((have[k] ?? NaN) - v) > 0.5 && k !== 'x' && k !== 'y') return m;
        if (k === 'phase' && typeof v === 'number' && Math.abs((have[k] ?? NaN) - v) > 1e-6) return m;
      }
    }
    return null;
  }
  private hintTargets: Record<string, Record<string, unknown>> | null = null;

  /** What the tutorial hand should point at right now (null = no tutorial). */
  tutorialHint(): TutorialHint | null {
    if (this.hintActive && this.state === 'prep') {
      const m = this.hintTarget();
      if (m) return { kind: 'tap', machine: m.id, x: m.x, y: m.y, text: 'HINT: tap this one until the hand moves on' };
      return { kind: 'run', x: 0, y: 0, text: 'HINT: now press RUN!' };
    }
    const live = !!this.level.sortAll && !this.level.plan && this.state === 'running';
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
    if (this.level.sortAll && !this.level.plan) return null; // nothing to press: the factory runs by itself
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
