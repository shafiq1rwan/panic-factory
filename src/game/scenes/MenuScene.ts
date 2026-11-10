import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W, STEP_MS, TEXT } from '../config';
import type { LevelDef } from '../levels/LevelTypes';
import { drawFactoryBackground, setupCamera } from '../rendering/Background';
import { roundRect } from '../rendering/VectorFactory';
import { WorldView } from '../rendering/WorldView';
import { FactoryWorld } from '../sim/FactoryWorld';
import { LevelManager, PANIC_UNLOCK_LEVELS } from '../systems/LevelManager';
import { save } from '../systems/SaveManager';
import { Button, drawStar, fadeIn, gotoScene, txt } from '../ui/UIComponents';

/** A tiny self-running factory used as the animated menu backdrop (real physics, looping spawners). */
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
    { id: 'a', x: 640, y: 112, sequence: ['blue'], interval: 1900, delay: 300, loop: true },
    { id: 'b', x: 1180, y: 112, sequence: ['yellow', 'yellow:bouncy'], interval: 2300, delay: 1200, loop: true },
  ],
  machines: [
    { id: 'padA', kind: 'bumper', shape: 'pad', x: 640, y: 610, angle: 30, power: 9 },
    { id: 'binA', kind: 'bin', x: 880, y: 652, accepts: 'blue', width: 180, height: 116 },
    { id: 'padB', kind: 'bumper', shape: 'pad', x: 1180, y: 340, angle: -30 },
    { id: 'funB', kind: 'funnel', x: 800, y: 340, topWidth: 260, bottomWidth: 140, height: 60 },
    { id: 'binB', kind: 'bin', x: 800, y: 425, accepts: 'yellow' },
  ],
};

export class MenuScene extends Phaser.Scene {
  private world!: FactoryWorld;
  private view!: WorldView;
  private acc = 0;

  constructor() {
    super('Menu');
  }

  create(): void {
    setupCamera(this);
    drawFactoryBackground(this);
    fadeIn(this);

    // animated mini factory
    this.acc = 0;
    this.world = new FactoryWorld(DEMO);
    this.view = new WorldView(this, this.world, { sound: false, queues: false });
    this.world.start();

    // title card
    const cx = 310;
    const card = this.add.graphics().setDepth(90);
    card.fillStyle(COLORS.shadow, 0.14);
    card.fillRoundedRect(cx - 250 + 6, 96 + 10, 500, 560, 40);
    roundRect(card, cx - 250, 96, 500, 560, 40, 0xffffff, 4);

    const t1 = txt(this, cx, 158, 'Tiny Factory', 50).setDepth(91);
    const t2 = txt(this, cx, 232, 'PANIC!', 92, '#FF4F9A', { stroke: TEXT.dark, strokeThickness: 10 }).setDepth(91).setAngle(-4);
    if (!save.settings.reducedMotion) {
      this.tweens.add({ targets: t2, angle: 4, scale: 1.06, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: t1, y: 154, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    const done = LevelManager.completedCount;
    new Button(this, cx, 352, {
      w: 320, h: 78, label: done > 0 ? 'CONTINUE' : 'PLAY', icon: 'play', color: COLORS.mint, fontSize: 34,
      onClick: () => gotoScene(this, 'LevelSelect'),
    }).setDepth(91);

    const panicOpen = LevelManager.panicUnlocked;
    const panicBtn = new Button(this, cx, 452, {
      w: 320, h: 64, label: 'PANIC MODE', icon: panicOpen ? 'bolt' : 'lock', color: COLORS.pink, fontSize: 26,
      onClick: () => gotoScene(this, 'Panic'),
    }).setDepth(91);
    panicBtn.setEnabled(panicOpen);
    if (!panicOpen) {
      txt(this, cx, 500, `Finish ${PANIC_UNLOCK_LEVELS} levels to unlock  (${Math.min(done, PANIC_UNLOCK_LEVELS)}/${PANIC_UNLOCK_LEVELS})`, 15, TEXT.soft).setDepth(91);
    } else {
      txt(this, cx, 500, `Best score: ${save.data.panicBest}`, 16, TEXT.soft).setDepth(91);
    }

    new Button(this, cx - 96, 580, { w: 128, h: 58, icon: 'gear', label: '', color: COLORS.lavender, onClick: () => this.scene.launch('Settings') }).setDepth(91);
    // progress
    const prog = this.add.container(cx + 70, 578).setDepth(91);
    const pg = this.add.graphics();
    roundRect(pg, -86, -29, 172, 58, 22, 0xece6ff, 0);
    prog.add([pg, drawStar(this, -52, 0, 17, true), txt(this, 22, 0, `${save.totalStars} / ${LevelManager.count * 3}`, 24)]);

    txt(this, cx, 636, 'v1.2', 13, TEXT.soft).setDepth(91);

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
