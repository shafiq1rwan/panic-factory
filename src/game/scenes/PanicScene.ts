import Phaser from 'phaser';
import { GAME_W, HUD_H, PLAY_H, STEP_MS } from '../config';
import { PANIC_LEVEL } from '../levels/panicLevel';
import { ConveyorBelt } from '../machines/ConveyorBelt';
import { platform } from '../platform';
import { drawFactoryBackground, safeTop, setupCamera } from '../rendering/Background';
import { WorldView } from '../rendering/WorldView';
import { FactoryWorld } from '../sim/FactoryWorld';
import { audio } from '../systems/AudioManager';
import { PanicDirector } from '../systems/PanicDirector';
import { save } from '../systems/SaveManager';
import type { PanicScore } from '../systems/ScoreManager';
import { fadeIn } from '../ui/UIComponents';
import type { UIScene } from './UIScene';

/**
 * Panic Factory: the endless arcade mode. Toys keep coming, belts are flipped
 * live by tapping them, and telegraphed malfunctions stir things up.
 */
export class PanicScene extends Phaser.Scene {
  world!: FactoryWorld;
  director!: PanicDirector;
  private view!: WorldView;
  private acc = 0;
  private ended = false;

  constructor() {
    super('Panic');
  }

  // --- read by the HUD ------------------------------------------------------------
  get score(): PanicScore {
    return this.director?.score;
  }
  get lives(): number {
    return this.director.lives;
  }
  get maxLives(): number {
    return this.director.maxLives;
  }
  get warning(): string {
    return this.director.warning;
  }
  get activeEffect(): string {
    return this.director.activeEffect;
  }
  /** Belts left to right: the same order as their buttons at the bottom of the screen. */
  get belts(): ConveyorBelt[] {
    return this.world.machines.filter((m): m is ConveyorBelt => m instanceof ConveyorBelt).sort((a, b) => a.x - b.x);
  }

  create(): void {
    setupCamera(this);
    drawFactoryBackground(this, false, true);
    fadeIn(this);
    this.acc = 0;
    this.ended = false;

    this.world = new FactoryWorld(PANIC_LEVEL, { seed: (Date.now() & 0xffff) + 1 });
    this.director = new PanicDirector(this.world);
    this.view = new WorldView(this, this.world, { queues: false });

    const ev = this.world.events;
    ev.on('panicScore', (points: number, chain: boolean, mult: number) => {
      if (chain) {
        this.view.floatText(GAME_W / 2, HUD_H + 96, `Chain! +${points}`, '#9479e0', 24);
        audio.combo(mult);
      }
    });
    ev.on('panicWarning', () => audio.warn());
    this.events.on('chain', () => undefined);

    this.input.on('pointerdown', this.onDown, this);
    this.input.keyboard?.on('keydown', this.onKey, this);

    if (this.scene.isActive('UI')) this.scene.stop('UI');
    this.scene.launch('UI', { mode: 'panic' });

    this.world.start();
    audio.whirr();
    platform.gameplayStart();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.onDown, this);
      this.input.keyboard?.off('keydown', this.onKey, this);
      this.events.off('chain');
      this.time.removeAllEvents();
      this.view.destroy();
      this.world.destroy();
      platform.gameplayStop();
    });
  }

  /** Flip a belt (bottom buttons, taps on the belt and the keyboard all end up here). */
  flip(id: string): void {
    if (this.ended) return;
    const belt = this.world.machine(id);
    if (!(belt instanceof ConveyorBelt)) return;
    if (belt.disabled) {
      audio.buzz();
      this.view.floatText(belt.x, belt.y - 34, 'Jammed!', '#e2566b', 18);
      return;
    }
    belt.flip();
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    audio.unlock();
    const p = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    let best: ConveyorBelt | null = null;
    let bestD = Infinity;
    for (const m of this.world.machines) {
      // generous touch target: belts are the only controls in this mode
      if (!(m instanceof ConveyorBelt) || !m.hitTest(p.x, p.y, 46)) continue;
      const d = Math.abs(m.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    if (best) this.flip(best.id);
    // a tap that hit no belt: point at the buttons
    else if (!this.ended && p.y > safeTop() + HUD_H && p.y < PLAY_H) (this.scene.get('UI') as UIScene).nudgeControls();
  }

  private onKey(ev: KeyboardEvent): void {
    if (platform.inBreak) return;
    const k = ev.key.toLowerCase();
    if (k === 'escape' || k === 'p') this.pause();
    else if (k === 'a' || k === 'arrowleft' || k === '1') this.flip('beltL');
    else if (k === 'd' || k === 'arrowright' || k === '2') this.flip('beltR');
  }

  pause(): void {
    if (this.ended || this.scene.isActive('Pause')) return;
    platform.gameplayStop();
    this.scene.launch('Pause', { from: 'Panic' });
    this.scene.pause();
  }

  private gameOver(): void {
    this.ended = true;
    platform.gameplayStop();
    audio.fail();
    const score = this.director.score.score;
    const newBest = save.recordPanic(score);
    this.time.delayedCall(900, () => {
      this.scene.launch('Result', {
        mode: 'panic',
        score,
        best: save.data.panicBest,
        newBest,
        delivered: this.director.score.delivered,
        bestCombo: this.director.score.bestCombo,
        seconds: this.director.seconds,
      });
    });
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP_MS && n < 6) {
      this.acc -= STEP_MS;
      n++;
      if (!this.ended) this.director.update();
      this.world.step();
      if (!this.ended && this.director.over) this.gameOver();
    }
    if (n === 6) this.acc = 0;
    this.view.update(dt, false);
  }
}
