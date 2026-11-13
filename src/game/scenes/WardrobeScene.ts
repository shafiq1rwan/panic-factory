import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W, TEXT, WORKSHOP } from '../config';
import { setupCamera } from '../rendering/Background';
import { drawIcon } from '../rendering/Icons';
import { dressedToy } from '../rendering/ObjectView';
import { roundRect } from '../rendering/VectorFactory';
import { platform } from '../platform';
import { audio } from '../systems/AudioManager';
import { LevelManager } from '../systems/LevelManager';
import { nextOutfit, OUTFITS } from '../systems/Outfits';
import { save } from '../systems/SaveManager';
import { Button, dimmer, drawStar, panel, txt } from '../ui/UIComponents';

const COLS = 4;
const TILE_W = 122;
const TILE_H = 134;
const GAP = 12;

/** Outfits overlay: every outfit, worn by a blue toy; tap an unlocked one to wear it. */
export class WardrobeScene extends Phaser.Scene {
  constructor() {
    super('Wardrobe');
  }

  create(): void {
    setupCamera(this);
    dimmer(this);
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const box = this.add.container(cx, cy);
    const rows = Math.ceil((OUTFITS.length + 1) / COLS);
    const H = 200 + rows * (TILE_H + GAP) + 90;
    box.add(panel(this, 0, 0, 600, H));
    const top = -H / 2;
    box.add(txt(this, 0, top + 48, 'Outfits', 40));

    const stars = save.totalStars;
    const next = nextOutfit(stars);
    const line = this.add.container(0, top + 96);
    line.add([drawStar(this, -150, 0, 13, true), txt(this, -134, 0, `${stars}/${LevelManager.count * 3}`, 20, WORKSHOP.text).setOrigin(0, 0.5)]);
    line.add(txt(this, 40, 0, next ? `Next: ${next.outfit.name} at ${next.need}` : 'Every outfit unlocked!', 20, WORKSHOP.muted).setOrigin(0, 0.5));
    box.add(line);

    // "None" first, then every outfit
    const entries: { id: string; name: string; need: number }[] = [{ id: '', name: 'None', need: 0 }, ...OUTFITS.map((o) => ({ id: o.id, name: o.name, need: o.stars }))];
    const gridW = COLS * TILE_W + (COLS - 1) * GAP;
    const tiles: { id: string; frame: Phaser.GameObjects.Graphics }[] = [];
    const drawFrames = (): void => {
      for (const t of tiles) {
        t.frame.clear();
        if (t.id === save.data.outfit) {
          t.frame.lineStyle(5, WORKSHOP.accent, 1);
          t.frame.strokeRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 22);
        }
      }
    };
    entries.forEach((e, i) => {
      const x = -gridW / 2 + TILE_W / 2 + (i % COLS) * (TILE_W + GAP);
      const y = top + 140 + TILE_H / 2 + Math.floor(i / COLS) * (TILE_H + GAP);
      const open = stars >= e.need;
      const tile = this.add.container(x, y);
      const bg = this.add.graphics();
      roundRect(bg, -TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 22, open ? WORKSHOP.inset : 0xdfe3e6, 0);
      tile.add(bg);
      if (open) {
        tile.add(dressedToy(this, 'blue', e.id, 1.15).setPosition(0, -4));
        tile.add(txt(this, 0, TILE_H / 2 - 20, e.name, 16, WORKSHOP.text));
      } else {
        // a faint preview of what is waiting, behind the lock
        tile.add(dressedToy(this, 'blue', e.id, 1.15).setPosition(0, -4).setAlpha(0.22));
        const lock = this.add.graphics().setPosition(0, -14);
        drawIcon(lock, 'lock', 20, 0xa8b3b0);
        tile.add([lock, drawStar(this, -14, TILE_H / 2 - 22, 11, true), txt(this, 2, TILE_H / 2 - 22, `${e.need}`, 18, WORKSHOP.muted).setOrigin(0, 0.5)]);
      }
      const frame = this.add.graphics();
      tile.add(frame);
      tiles.push({ id: e.id, frame });
      if (open) {
        tile.setSize(TILE_W, TILE_H).setInteractive({ useHandCursor: true });
        tile.on('pointerup', () => {
          save.wearOutfit(e.id);
          if (e.id) platform.measure('outfit', e.id, 'worn');
          audio.click();
          drawFrames();
          if (!save.settings.reducedMotion) {
            tile.setScale(1.08);
            this.tweens.add({ targets: tile, scale: 1, duration: 260, ease: 'Back.easeOut' });
          }
        });
      }
      box.add(tile);
    });
    drawFrames();

    box.add(
      new Button(this, 0, H / 2 - 56, {
        w: 260, h: 72, radius: 22, label: 'Done', color: COLORS.lavenderDark, textColor: TEXT.white, fontSize: 28,
        onClick: () => this.scene.stop(),
      }),
    );
    if (!save.settings.reducedMotion) {
      box.setScale(0.96).setAlpha(0);
      this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });
    }
    this.input.keyboard?.on('keydown-ESC', () => this.scene.stop());
  }
}
