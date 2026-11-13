import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W, HUD_H, STEP_MS, TEXT, WORKSHOP } from '../config';
import type { LevelDef } from '../levels/LevelTypes';
import { drawFactoryBackground, keepOverlayBelow, safeTop, setupCamera } from '../rendering/Background';
import { WorldView } from '../rendering/WorldView';
import { dressedToy } from '../rendering/ObjectView';
import { FactoryWorld } from '../sim/FactoryWorld';
import { audio } from '../systems/AudioManager';
import { LevelManager, PANIC_UNLOCK_LEVELS } from '../systems/LevelManager';
import { save } from '../systems/SaveManager';
import { Button, drawStar, gotoScene, txt } from '../ui/UIComponents';

/** A tiny self-running factory on both sides of the title (real physics, looping spawners). */
const DEMO: LevelDef = {
  id: 'menu-demo',
  name: 'demo',
  width: GAME_W,
  height: GAME_H,
  objective: {},
  mistakesAllowed: 99,
  par: 0,
  solution: {},
  walls: [],
  spawners: [
    { id: 'a', x: 110, y: 210, sequence: ['blue', 'pink'], interval: 2100, delay: 300, loop: true },
    { id: 'b', x: 610, y: 210, sequence: ['yellow', 'green'], interval: 2300, delay: 1200, loop: true },
  ],
  machines: [
    { id: 'padA', kind: 'bumper', shape: 'pad', x: 110, y: 1040, angle: 30, power: 8 },
    { id: 'padB', kind: 'bumper', shape: 'pad', x: 610, y: 1040, angle: -30, power: 8 },
  ],
};

/**
 * Title screen. Deliberately minimal: one big PLAY button that drops the
 * player straight into their next level, plus three small round buttons.
 */
export class MenuScene extends Phaser.Scene {
  private world!: FactoryWorld;
  private view!: WorldView;
  private acc = 0;

  constructor() {
    super('Menu');
  }

  create(): void {
    setupCamera(this);
    keepOverlayBelow(() => safeTop() + HUD_H);
    drawFactoryBackground(this, false);

    // toys bouncing around at the sides
    this.acc = 0;
    this.world = new FactoryWorld(DEMO);
    this.view = new WorldView(this, this.world, { sound: false, queues: false });
    this.world.start();

    const cx = GAME_W / 2;
    const t1 = txt(this, cx, 300, 'Tiny Factory', 76, TEXT.white, { stroke: TEXT.dark, strokeThickness: 12 }).setDepth(91);
    const t2 = txt(this, cx, 420, 'PANIC!', 156, '#FF4F9A', { stroke: TEXT.dark, strokeThickness: 16 }).setDepth(91).setAngle(-3);
    if (!save.settings.reducedMotion) {
      this.tweens.add({ targets: t2, angle: 3, scale: 1.05, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: t1, y: 294, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // PLAY: straight into the next unfinished level
    const next = LevelManager.nextUnfinished;
    const allDone = LevelManager.completedCount === LevelManager.count;
    const play = new Button(this, cx, 680, {
      w: 420, h: 130, label: 'PLAY', icon: 'play', color: COLORS.yellow, fontSize: 64, radius: 48,
      onClick: () => gotoScene(this, allDone ? 'LevelSelect' : 'Game', { level: next }),
    }).setDepth(91);
    if (!save.settings.reducedMotion) {
      this.tweens.add({ targets: play, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    txt(this, cx, 776, allDone ? 'All levels complete!' : `Level ${next + 1}`, 30, WORKSHOP.text).setDepth(91);

    // small round buttons
    const y = 900;
    const dx = 158;
    new Button(this, cx - dx * 1.5, y, { w: 116, h: 104, icon: 'grid', color: COLORS.white, radius: 38, onClick: () => gotoScene(this, 'LevelSelect') }).setDepth(91);
    const panicOpen = LevelManager.panicUnlocked;
    new Button(this, cx - dx * 0.5, y, {
      w: 116, h: 104, icon: panicOpen ? 'bolt' : 'lock', color: COLORS.pink, radius: 38,
      onClick: () => gotoScene(this, 'Panic'),
    })
      .setDepth(91)
      .setEnabled(panicOpen);
    // outfits: a toy wearing the current outfit (or a party hat as a teaser)
    const ob = new Button(this, cx + dx * 0.5, y, { w: 116, h: 104, color: COLORS.yellow, radius: 38, onClick: () => this.scene.launch('Wardrobe') }).setDepth(91);
    ob.addToFace(dressedToy(this, 'blue', save.data.outfit || 'party', 0.95).setPosition(0, 8));
    new Button(this, cx + dx * 1.5, y, { w: 116, h: 104, icon: 'gear', color: COLORS.white, radius: 38, onClick: () => this.scene.launch('Settings') }).setDepth(91);
    txt(this, cx - dx * 1.5, y + 82, 'Levels', 22, WORKSHOP.muted).setDepth(91);
    txt(this, cx - dx * 0.5, y + 82, panicOpen ? `Panic · ${save.data.panicBest}` : `Panic ${Math.min(LevelManager.completedCount, PANIC_UNLOCK_LEVELS)}/${PANIC_UNLOCK_LEVELS}`, 22, WORKSHOP.muted).setDepth(91);
    txt(this, cx + dx * 0.5, y + 82, 'Outfits', 22, WORKSHOP.muted).setDepth(91);
    txt(this, cx + dx * 1.5, y + 82, 'Settings', 22, WORKSHOP.muted).setDepth(91);

    // progress, top right
    const prog = this.add.container(cx, 1060).setDepth(91);
    prog.add([drawStar(this, -46, 0, 18, true), txt(this, 22, 1, `${save.totalStars}/${LevelManager.count * 3}`, 26, WORKSHOP.text)]);
    txt(this, 40, GAME_H - 44, 'v1.1.0', 16, WORKSHOP.muted).setDepth(91);

    // keyboard: Space / Enter starts too
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (this.scene.isActive('Settings') || this.scene.isActive('Wardrobe')) return;
      if (ev.key === ' ' || ev.key === 'Enter') {
        audio.unlock();
        gotoScene(this, allDone ? 'LevelSelect' : 'Game', { level: next });
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.view.destroy();
      this.world.destroy();
    });
  }

  override update(_t: number, delta: number): void {
    const dt = Math.min(delta, 100);
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP_MS && n < 5) {
      this.acc -= STEP_MS;
      n++;
      this.world.step();
    }
    if (n === 5) this.acc = 0;
    this.view.update(dt, false);
  }
}
