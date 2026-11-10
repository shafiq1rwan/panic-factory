import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W, TEX_SCALE, TEXT } from '../config';
import { platform } from '../platform';
import { setupCamera } from '../rendering/Background';
import { faceKey, toyKey } from '../rendering/Textures';
import { audio } from '../systems/AudioManager';
import { LevelManager } from '../systems/LevelManager';
import { ParticleManager } from '../systems/ParticleManager';
import { save } from '../systems/SaveManager';
import { Button, dimmer, drawStar, gotoScene, panel, txt } from '../ui/UIComponents';
import type { GameScene } from './GameScene';

export interface ResultData {
  mode: 'win' | 'fail' | 'panic';
  levelIndex?: number;
  stars?: number;
  newBest?: boolean;
  seconds?: number;
  mistakes?: number;
  lost?: number;
  reason?: string;
  score?: number;
  best?: number;
  delivered?: number;
  bestCombo?: number;
}

/** Level complete / failure / Panic game-over overlay. */
export class ResultScene extends Phaser.Scene {
  private d!: ResultData;
  private busy = false;

  constructor() {
    super('Result');
  }

  init(data: ResultData): void {
    this.d = data;
    this.busy = false;
  }

  create(): void {
    setupCamera(this);
    dimmer(this, 0.32);
    const box = this.add.container(GAME_W / 2, GAME_H / 2 + 10);
    if (this.d.mode === 'win') this.buildWin(box);
    else if (this.d.mode === 'fail') this.buildFail(box);
    else this.buildPanic(box);

    if (save.settings.reducedMotion) return;
    box.setScale(0.7).setAlpha(0);
    this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
  }

  private get game_(): GameScene {
    return this.scene.get('Game') as GameScene;
  }

  private retryLevel(): void {
    if (this.busy) return;
    this.game_.retry(); // also closes this overlay
  }

  /** Between-level moment: the only place a commercial break may be requested. */
  private afterBreak(fn: () => void): void {
    if (this.busy) return;
    this.busy = true;
    void platform.commercialBreak().then(fn);
  }

  private buildWin(box: Phaser.GameObjects.Container): void {
    const d = this.d;
    const index = d.levelIndex ?? 0;
    const level = LevelManager.get(index);
    const stars = d.stars ?? 1;
    box.add(panel(this, 0, 0, 580, 450));
    box.add(txt(this, 0, -168, 'Level Complete!', 42));

    const fx = new ParticleManager(this, 20);
    for (let i = 0; i < 3; i++) {
      const sx = (i - 1) * 112;
      const sy = i === 1 ? -84 : -68;
      box.add(drawStar(this, sx, sy, 44, false));
      if (i >= stars) continue;
      const s = drawStar(this, sx, sy, 44, true).setScale(0).setAngle(-40);
      box.add(s);
      this.tweens.add({
        targets: s, scale: 1, angle: 0, duration: 380, delay: 330 + i * 300, ease: 'Back.easeOut',
        onStart: () => {
          audio.starPop(i);
          fx.sparkle(GAME_W / 2 + sx, GAME_H / 2 + 10 + sy, COLORS.yellow, 8);
        },
      });
    }

    const slips = (d.mistakes ?? 0) + (d.lost ?? 0);
    const line = `Time ${(d.seconds ?? 0).toFixed(1)}s     Slips ${slips}`;
    box.add(txt(this, 0, 6, line, 22));
    let tip = '';
    if (stars === 3) tip = d.newBest ? 'Perfect run! New best!' : 'Perfect run!';
    else if (slips > 0) tip = 'No slips earns more stars';
    else tip = `Finish under ${level.par}s for 3 stars`;
    box.add(txt(this, 0, 42, tip, 17, stars === 3 ? TEXT.pink : TEXT.soft));

    const y = 138;
    const hasNext = LevelManager.hasNext(index);
    box.add(new Button(this, -210, y, { w: 76, h: 64, icon: 'grid', color: COLORS.lavender, onClick: () => this.afterBreak(() => gotoScene(this, 'LevelSelect')) }));
    box.add(new Button(this, -86, y, { w: 150, h: 64, label: 'Retry', icon: 'restart', color: COLORS.yellow, fontSize: 24, onClick: () => this.retryLevel() }));
    if (hasNext) {
      box.add(new Button(this, 122, y, { w: 244, h: 70, label: 'Next Level', icon: 'next', color: COLORS.mint, fontSize: 28, onClick: () => this.afterBreak(() => gotoScene(this, 'Game', { level: index + 1 })) }));
    } else {
      box.add(new Button(this, 122, y, { w: 244, h: 70, label: 'Panic Mode', icon: 'bolt', color: COLORS.pink, fontSize: 26, onClick: () => this.afterBreak(() => gotoScene(this, 'Panic')) }));
      box.add(txt(this, 0, 76, 'You finished every level!', 18, TEXT.pink));
    }

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (platform.inBreak) return;
      if (ev.key === 'Enter' && hasNext) this.afterBreak(() => gotoScene(this, 'Game', { level: index + 1 }));
      else if (ev.key.toLowerCase() === 'r') this.retryLevel();
    });
  }

  private sadToy(box: Phaser.GameObjects.Container, y: number): void {
    const toy = this.add.image(0, y, toyKey('blue', 'standard')).setScale(1.3 / TEX_SCALE);
    const face = this.add.image(0, y, faceKey('worried')).setScale(2.2 / TEX_SCALE);
    box.add([toy, face]);
    if (!save.settings.reducedMotion) this.tweens.add({ targets: [toy, face], angle: { from: -8, to: 8 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private buildFail(box: Phaser.GameObjects.Container): void {
    const d = this.d;
    box.add(panel(this, 0, 0, 520, 400));
    box.add(txt(this, 0, -142, 'Oops!', 44));
    this.sadToy(box, -62);
    box.add(txt(this, 0, 10, d.reason || 'That did not work', 24));
    box.add(txt(this, 0, 44, 'Tweak the machines and try again', 16, TEXT.soft));
    box.add(new Button(this, -150, 124, { w: 76, h: 64, icon: 'grid', color: COLORS.lavender, onClick: () => this.afterBreak(() => gotoScene(this, 'LevelSelect')) }));
    box.add(new Button(this, 44, 124, { w: 270, h: 70, label: 'Try Again', icon: 'restart', color: COLORS.mint, fontSize: 28, onClick: () => this.retryLevel() }));
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (platform.inBreak) return;
      if (ev.key === 'Enter' || ev.key.toLowerCase() === 'r' || ev.key === ' ') this.retryLevel();
    });
  }

  private buildPanic(box: Phaser.GameObjects.Container): void {
    const d = this.d;
    box.add(panel(this, 0, 0, 540, 440));
    box.add(txt(this, 0, -164, 'Factory Jam!', 42));
    box.add(txt(this, 0, -108, 'SCORE', 16, TEXT.soft));
    const score = txt(this, 0, -62, `${d.score ?? 0}`, 72, TEXT.pink);
    box.add(score);
    if (d.newBest) {
      box.add(txt(this, 0, -6, 'New high score!', 22, TEXT.pink));
      new ParticleManager(this, 20).celebrate(GAME_W / 2, GAME_H / 2 - 40, 60);
      audio.win();
    } else {
      box.add(txt(this, 0, -6, `Best ${d.best ?? 0}`, 22));
    }
    box.add(txt(this, 0, 38, `${d.delivered ?? 0} toys sorted     Best streak ${d.bestCombo ?? 0}     ${Math.round(d.seconds ?? 0)}s`, 17, TEXT.soft));
    box.add(new Button(this, -160, 132, { w: 76, h: 64, icon: 'home', color: COLORS.lavender, onClick: () => this.afterBreak(() => gotoScene(this, 'Menu')) }));
    box.add(new Button(this, 44, 132, { w: 280, h: 70, label: 'Play Again', icon: 'restart', color: COLORS.mint, fontSize: 28, onClick: () => this.afterBreak(() => gotoScene(this, 'Panic')) }));
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (platform.inBreak) return;
      if (ev.key === 'Enter' || ev.key.toLowerCase() === 'r') this.afterBreak(() => gotoScene(this, 'Panic'));
    });
  }
}
