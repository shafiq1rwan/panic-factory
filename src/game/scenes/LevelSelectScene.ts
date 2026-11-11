import Phaser from 'phaser';
import { COLORS, GAME_W, TEXT, WORKSHOP } from '../config';
import { LEVELS } from '../levels/levels';
import { drawFactoryBackground, setupCamera, keepOverlayBelow, THEMES, WORLD_SIZE } from '../rendering/Background';
import { drawIcon } from '../rendering/Icons';
import { roundRect } from '../rendering/VectorFactory';
import { LevelManager } from '../systems/LevelManager';
import { save } from '../systems/SaveManager';
import { Button, drawStar, fadeIn, gotoScene, txt } from '../ui/UIComponents';

const PER_ROW = 5;
const CARD_W = 122;
const CARD_H = 112;
const COL_W = 134;
const ROW_H = 124;
/** world panel: label strip + two rows of five */
const PANEL_H = 56 + Math.ceil(WORLD_SIZE / PER_ROW) * ROW_H + 8;
const PANEL_GAP = 22;

/** Level grid: one panel per world of ten levels, tinted like the world's own wall. */
export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelect');
  }

  create(): void {
    setupCamera(this);
    drawFactoryBackground(this, false);
    fadeIn(this);

    // the portal's overlay button goes under the header row, clear of this back button
    keepOverlayBelow(() => 70 + 36 + 10);
    new Button(this, 66, 70, { w: 84, h: 72, icon: 'back', color: COLORS.lavender, radius: 18, onClick: () => gotoScene(this, 'Menu') });
    txt(this, GAME_W / 2, 70, 'Levels', 48, WORKSHOP.text);

    // total stars
    const total = this.add.container(GAME_W - 106, 70);
    const tg = this.add.graphics();
    roundRect(tg, -84, -27, 168, 54, 22, 0xffffff, 3);
    total.add([tg, drawStar(this, -50, 0, 16, true), txt(this, 20, 0, `${save.totalStars} / ${LEVELS.length * 3}`, 22)]);

    const next = LevelManager.nextUnfinished;
    const worlds = Math.ceil(LEVELS.length / WORLD_SIZE);
    for (let w = 0; w < worlds; w++) {
      const theme = THEMES[Math.min(w, THEMES.length - 1)];
      const top = 136 + w * (PANEL_H + PANEL_GAP);
      const panelW = PER_ROW * COL_W + 20;
      // panel in the world's wall colours, with its pipe colour as the edge
      const pg = this.add.graphics();
      pg.fillStyle(0x294d43, 0.1);
      pg.fillRoundedRect(GAME_W / 2 - panelW / 2, top + 6, panelW, PANEL_H, 26);
      pg.fillStyle(theme.wallBottom, 1);
      pg.fillRoundedRect(GAME_W / 2 - panelW / 2, top, panelW, PANEL_H, 26);
      pg.lineStyle(3, theme.pipe, 0.9);
      pg.strokeRoundedRect(GAME_W / 2 - panelW / 2, top, panelW, PANEL_H, 26);
      // label
      const first = w * WORLD_SIZE + 1;
      const last = Math.min(LEVELS.length, (w + 1) * WORLD_SIZE);
      roundRect(pg, GAME_W / 2 - panelW / 2 + 16, top + 12, 220, 36, 18, theme.tag, 0);
      txt(this, GAME_W / 2 - panelW / 2 + 126, top + 30, theme.name, 20, TEXT.white);
      txt(this, GAME_W / 2 + panelW / 2 - 20, top + 30, `LEVELS ${first}-${last}`, 15, WORKSHOP.muted).setOrigin(1, 0.5).setLetterSpacing(1.5);

      for (let k = 0; k < WORLD_SIZE; k++) {
        const index = w * WORLD_SIZE + k;
        const level = LEVELS[index];
        if (!level) continue;
        const r = Math.floor(k / PER_ROW);
        const c = k % PER_ROW;
        const x = GAME_W / 2 + (c - (PER_ROW - 1) / 2) * COL_W;
        const y = top + 56 + r * ROW_H + CARD_H / 2;
        const unlocked = LevelManager.isUnlocked(index);
        const stars = save.starsFor(level.id);
        const btn = new Button(this, x, y, {
          w: CARD_W, h: CARD_H, radius: 22,
          color: unlocked ? 0xffffff : 0x4a3f8f,
          onClick: () => gotoScene(this, 'Game', { level: index }),
        });
        btn.setEnabled(unlocked);
        if (unlocked) {
          btn.addToFace(txt(this, 0, -14, `${index + 1}`, 40, TEXT.dark));
          for (let s = 0; s < 3; s++) btn.addToFace(drawStar(this, (s - 1) * 30, 30, 12, s < stars));
          if (level.newToy) {
            // a dot in the toy's colour marks the level that brings in a new toy
            const dot = this.add.graphics();
            roundRect(dot, 18, -48, 38, 20, 10, COLORS.pink, 0);
            btn.addToFace(dot, txt(this, 37, -38, 'NEW', 11, TEXT.white));
          }
          if (index === next && stars === 0 && !save.settings.reducedMotion) {
            // gently bounce the next level to play
            this.tweens.add({ targets: btn, y: y - 6, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          }
        } else {
          const lock = this.add.graphics();
          drawIcon(lock, 'lock', 20, 0x9d92dc);
          lock.y = -12;
          btn.addToFace(lock, txt(this, 0, 30, `${index + 1}`, 18, '#9D92DC'));
        }
      }
    }

    this.input.keyboard?.on('keydown-ESC', () => gotoScene(this, 'Menu'));
  }
}
