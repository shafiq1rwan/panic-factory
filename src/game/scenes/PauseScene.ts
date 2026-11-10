import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W } from '../config';
import { platform } from '../platform';
import { setupCamera } from '../rendering/Background';
import { Button, dimmer, gotoScene, panel, txt } from '../ui/UIComponents';
import type { GameScene } from './GameScene';

/** Pause overlay. The gameplay scene underneath is fully paused (physics, timers, input). */
export class PauseScene extends Phaser.Scene {
  private from: 'Game' | 'Panic' = 'Game';

  constructor() {
    super('Pause');
  }

  init(data: { from?: 'Game' | 'Panic' }): void {
    this.from = data.from ?? 'Game';
  }

  create(): void {
    setupCamera(this);
    dimmer(this);
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const box = this.add.container(cx, cy);
    box.add(panel(this, 0, 0, 400, 430));
    box.add(txt(this, 0, -160, 'Paused', 40));
    const puzzle = this.from === 'Game';
    box.add([
      new Button(this, 0, -80, { w: 280, h: 62, label: 'Resume', icon: 'play', color: COLORS.mint, onClick: () => this.resume() }),
      new Button(this, 0, -2, {
        w: 280, h: 56, label: 'Restart', icon: 'restart', color: COLORS.yellow,
        onClick: () => {
          if (puzzle) {
            this.resume();
            (this.scene.get('Game') as GameScene).retry();
          } else gotoScene(this, 'Panic');
        },
      }),
      new Button(this, 0, 70, { w: 280, h: 56, label: 'Settings', icon: 'gear', color: COLORS.white, onClick: () => this.scene.launch('Settings') }),
      new Button(this, 0, 142, {
        w: 280, h: 56, label: puzzle ? 'Levels' : 'Menu', icon: puzzle ? 'grid' : 'home', color: COLORS.lavender,
        onClick: () => gotoScene(this, puzzle ? 'LevelSelect' : 'Menu'),
      }),
    ]);
    box.setScale(0.8);
    this.tweens.add({ targets: box, scale: 1, duration: 220, ease: 'Back.easeOut' });

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (platform.inBreak || this.scene.isActive('Settings')) return;
      if (ev.key === 'Escape' || ev.key.toLowerCase() === 'p') this.resume();
    });
  }

  private resume(): void {
    this.scene.resume(this.from);
    platform.gameplayStart();
    this.scene.stop();
  }
}
