import Phaser from 'phaser';
import { COLORS, GAME_W, TEXT, WORKSHOP } from '../config';
import { LEVELS } from '../levels/levels';
import { drawFactoryBackground, setupCamera } from '../rendering/Background';
import { drawIcon } from '../rendering/Icons';
import { roundRect } from '../rendering/VectorFactory';
import { LevelManager } from '../systems/LevelManager';
import { save } from '../systems/SaveManager';
import { Button, drawStar, fadeIn, gotoScene, txt } from '../ui/UIComponents';

const CHAPTERS = ['Learning', 'Bouncing', 'Machinery', 'Chain Reactions', 'Factory Panic'];
const CHAPTER_COLORS = [COLORS.blue, COLORS.pink, COLORS.yellow, COLORS.mint, COLORS.lavender];

/** Level grid: 5 chapters of 3 levels, with stars and locked states. */
export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelect');
  }

  create(): void {
    setupCamera(this);
    drawFactoryBackground(this, false);
    fadeIn(this);

    new Button(this, 62, 56, { w: 64, h: 52, icon: 'back', color: COLORS.lavender, radius: 18, onClick: () => gotoScene(this, 'Menu') });
    txt(this, GAME_W / 2, 56, 'Choose a Level', 42, WORKSHOP.text);

    // total stars
    const total = this.add.container(GAME_W - 118, 56);
    const tg = this.add.graphics();
    roundRect(tg, -84, -27, 168, 54, 22, 0xffffff, 3);
    total.add([tg, drawStar(this, -50, 0, 16, true), txt(this, 20, 0, `${save.totalStars} / ${LEVELS.length * 3}`, 22)]);

    const colW = 236;
    const x0 = GAME_W / 2 - colW * 2;
    const rowY = [262, 422, 582];
    const next = LevelManager.nextUnfinished;

    CHAPTERS.forEach((name, c) => {
      const x = x0 + c * colW;
      // chapter header
      const hg = this.add.graphics();
      roundRect(hg, x - 100, 132, 200, 38, 19, CHAPTER_COLORS[c], 3);
      txt(this, x, 151, name, 17);

      for (let r = 0; r < 3; r++) {
        const index = c * 3 + r;
        const level = LEVELS[index];
        if (!level) continue;
        const unlocked = LevelManager.isUnlocked(index);
        const stars = save.starsFor(level.id);
        const y = rowY[r];
        const btn = new Button(this, x, y, {
          w: 200, h: 128, radius: 26,
          color: unlocked ? 0xffffff : 0x4a3f8f,
          onClick: () => gotoScene(this, 'Game', { level: index }),
        });
        btn.setEnabled(unlocked);
        if (unlocked) {
          const num = txt(this, 0, -30, `${index + 1}`, 40, TEXT.dark);
          const nm = txt(this, 0, 6, level.name, 16, TEXT.soft);
          btn.addToFace(num, nm);
          for (let s = 0; s < 3; s++) btn.addToFace(drawStar(this, (s - 1) * 36, 38, 14, s < stars));
          if (index === next && stars === 0 && !save.settings.reducedMotion) {
            // gently bounce the next level to play
            this.tweens.add({ targets: btn, y: y - 6, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          }
        } else {
          const lock = this.add.graphics();
          drawIcon(lock, 'lock', 20, 0x9d92dc);
          lock.y = -6;
          btn.addToFace(lock, txt(this, 0, 38, `Level ${index + 1}`, 15, '#9D92DC'));
        }
      }
    });

    this.input.keyboard?.on('keydown-ESC', () => gotoScene(this, 'Menu'));
  }
}
