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

    new Button(this, 66, 70, { w: 84, h: 72, icon: 'back', color: COLORS.lavender, radius: 18, onClick: () => gotoScene(this, 'Menu') });
    txt(this, GAME_W / 2, 70, 'Levels', 48, WORKSHOP.text);

    // total stars
    const total = this.add.container(GAME_W - 106, 70);
    const tg = this.add.graphics();
    roundRect(tg, -84, -27, 168, 54, 22, 0xffffff, 3);
    total.add([tg, drawStar(this, -50, 0, 16, true), txt(this, 20, 0, `${save.totalStars} / ${LEVELS.length * 3}`, 22)]);

    // portrait: one chapter per row, three levels across
    const colW = 228;
    const blockH = 208;
    const next = LevelManager.nextUnfinished;

    CHAPTERS.forEach((name, c) => {
      const by = 150 + c * blockH;
      // chapter header
      const hg = this.add.graphics();
      roundRect(hg, GAME_W / 2 - 130, by, 260, 38, 19, CHAPTER_COLORS[c], 3);
      txt(this, GAME_W / 2, by + 19, name, 19);

      for (let r = 0; r < 3; r++) {
        const index = c * 3 + r;
        const level = LEVELS[index];
        if (!level) continue;
        const unlocked = LevelManager.isUnlocked(index);
        const stars = save.starsFor(level.id);
        const x = GAME_W / 2 + (r - 1) * colW;
        const y = by + 118;
        const btn = new Button(this, x, y, {
          w: 208, h: 132, radius: 28,
          color: unlocked ? 0xffffff : 0x4a3f8f,
          onClick: () => gotoScene(this, 'Game', { level: index }),
        });
        btn.setEnabled(unlocked);
        if (unlocked) {
          const num = txt(this, 0, -32, `${index + 1}`, 44, TEXT.dark);
          const nm = txt(this, 0, 6, level.name, 18, TEXT.soft);
          btn.addToFace(num, nm);
          for (let s = 0; s < 3; s++) btn.addToFace(drawStar(this, (s - 1) * 40, 40, 16, s < stars));
          if (index === next && stars === 0 && !save.settings.reducedMotion) {
            // gently bounce the next level to play
            this.tweens.add({ targets: btn, y: y - 6, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          }
        } else {
          const lock = this.add.graphics();
          drawIcon(lock, 'lock', 24, 0x9d92dc);
          lock.y = -6;
          btn.addToFace(lock, txt(this, 0, 38, `Level ${index + 1}`, 18, '#9D92DC'));
        }
      }
    });

    this.input.keyboard?.on('keydown-ESC', () => gotoScene(this, 'Menu'));
  }
}
