import Phaser from 'phaser';
import { COLORS, GAME_W, TEXT, WORKSHOP } from '../config';
import { platform } from '../platform';
import { safeBottom, safeTop, setupCamera } from '../rendering/Background';
import { drawIcon } from '../rendering/Icons';
import { roundRect } from '../rendering/VectorFactory';
import { save } from '../systems/SaveManager';
import { Button, dimmer, gotoScene, txt } from '../ui/UIComponents';
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
    dimmer(this, 0.38);
    const box = this.add.container();
    const place = (): void => { box.setPosition(GAME_W / 2, (safeTop() + safeBottom()) / 2); };
    place();
    this.scale.on(Phaser.Scale.Events.RESIZE, place);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, place));

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.shadow, 0.16);
    bg.fillRoundedRect(-280, -300, 560, 624, 36);
    roundRect(bg, -280, -312, 560, 624, 36, WORKSHOP.panel, 0);
    bg.lineStyle(2, WORKSHOP.border, 1);
    bg.strokeRoundedRect(-280, -312, 560, 624, 36);
    bg.fillStyle(0xeee8ff, 1);
    bg.fillCircle(0, -221, 42);
    box.add(bg);

    const pauseIcon = this.add.graphics().setPosition(0, -221);
    drawIcon(pauseIcon, 'pause', 21, COLORS.lavenderDark);
    box.add([
      pauseIcon,
      txt(this, 0, -139, 'Paused', 44, WORKSHOP.text),
    ]);
    const puzzle = this.from === 'Game';
    const game = puzzle ? this.scene.get('Game') as GameScene : null;
    const context = txt(this, 0, -92, game ? `Level ${game.levelIndex + 1} · ${game.level.name}` : 'Panic Factory · Endless mode', 20, WORKSHOP.muted);
    if (context.width > 472) context.setFontSize(20 * 472 / context.width);
    box.add(context);
    box.add([
      new Button(this, 0, 0, {
        w: 480, h: 88, radius: 22, label: 'Resume', icon: 'play', iconSize: 22,
        color: COLORS.lavenderDark, textColor: TEXT.white, fontSize: 30, onClick: () => this.resume(),
      }),
      new Button(this, -124, 108, {
        w: 232, h: 80, radius: 20, style: 'panel', label: 'Restart', icon: 'restart', iconSize: 18,
        color: WORKSHOP.inset, textColor: WORKSHOP.text, fontSize: 24,
        onClick: () => {
          if (puzzle) {
            this.resume();
            (this.scene.get('Game') as GameScene).retry();
          } else gotoScene(this, 'Panic');
        },
      }),
      new Button(this, 124, 108, {
        w: 232, h: 80, radius: 20, style: 'panel', label: 'Settings', icon: 'gear', iconSize: 18,
        color: WORKSHOP.inset, textColor: WORKSHOP.text, fontSize: 24, onClick: () => this.scene.launch('Settings'),
      }),
      new Button(this, 0, 210, {
        w: 480, h: 68, radius: 20, style: 'panel', label: puzzle ? 'Level select' : 'Main menu',
        icon: puzzle ? 'grid' : 'home', iconSize: 18, color: WORKSHOP.panel, textColor: WORKSHOP.muted, fontSize: 24,
        onClick: () => gotoScene(this, puzzle ? 'LevelSelect' : 'Menu'),
      }),
      txt(this, 0, 276, 'Your toys can wait.', 18, WORKSHOP.muted),
    ]);
    if (!save.settings.reducedMotion) {
      box.setScale(0.96).setAlpha(0);
      this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });
    }

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
