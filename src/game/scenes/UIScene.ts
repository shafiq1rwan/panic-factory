import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W, HUD_H, OBJ_TYPES, TEX_SCALE, TEXT, TYPE_COLORS, WORKSHOP, type ObjType } from '../config';
import { setupCamera, viewBottom, viewTop } from '../rendering/Background';
import { toyKey } from '../rendering/Textures';
import { heart, roundRect } from '../rendering/VectorFactory';
import { save } from '../systems/SaveManager';
import { Button, txt } from '../ui/UIComponents';
import type { GameScene, GameState } from './GameScene';
import type { PanicScene } from './PanicScene';

interface Chip {
  type: ObjType;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  box: Phaser.GameObjects.Container;
  shown: number;
}

/** Centre of the RUN button and the vertical centre of the HUD bar (bar-local coordinates). */
export const RUN_X = 1172;
export const BAR_Y = HUD_H / 2;
const FF_X = 1036;

/**
 * Heads-up display, rendered in its own scene above the factory so camera
 * shake never moves it. It polls the active gameplay scene each frame and only
 * redraws what changed. The bar is pinned to the top edge of whatever is
 * visible, so it sits correctly in windows of any shape.
 */
export class UIScene extends Phaser.Scene {
  private mode: 'puzzle' | 'panic' = 'puzzle';
  /** everything in the top bar; moved to the visible top edge every frame */
  private bar!: Phaser.GameObjects.Container;
  // puzzle
  private chips: Chip[] = [];
  private heartsG!: Phaser.GameObjects.Graphics;
  private heartsKey = '';
  private runBtn: Button | null = null;
  private ffBtn: Button | null = null;
  private lastState: GameState | '' = '';
  private lastSpeed = 0;
  private hint!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private hintBg!: Phaser.GameObjects.Graphics;
  private hintShown = '';
  private hintTop = false;
  private hand!: Phaser.GameObjects.Image;
  private clock = 0;
  private timerT: Phaser.GameObjects.Text | null = null;
  private phaseT: Phaser.GameObjects.Text | null = null;
  // panic
  private scoreT: Phaser.GameObjects.Text | null = null;
  private multT: Phaser.GameObjects.Text | null = null;
  private lastScore = -1;
  private lastMult = 0;
  private banner: Phaser.GameObjects.Container | null = null;
  private bannerT: Phaser.GameObjects.Text | null = null;
  private bannerBg: Phaser.GameObjects.Graphics | null = null;
  private bannerShown = '';
  private effectT: Phaser.GameObjects.Text | null = null;
  private tip: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('UI');
  }

  init(data: { mode?: 'puzzle' | 'panic' }): void {
    this.mode = data.mode ?? 'puzzle';
    this.chips = [];
    this.heartsKey = '';
    this.lastState = '';
    this.lastSpeed = 0;
    this.hintShown = '';
    this.lastScore = -1;
    this.lastMult = 0;
    this.bannerShown = '';
    this.runBtn = this.ffBtn = null;
    this.timerT = this.scoreT = this.multT = this.bannerT = this.effectT = this.tip = null;
    this.phaseT = null;
    this.banner = null;
    this.bannerBg = null;
  }

  private get game_(): GameScene {
    return this.scene.get('Game') as GameScene;
  }
  private get panic(): PanicScene {
    return this.scene.get('Panic') as PanicScene;
  }

  create(): void {
    setupCamera(this);
    this.bar = this.add.container(0, viewTop());
    const bg = this.add.graphics();
    bg.fillStyle(WORKSHOP.panel, 1);
    bg.fillRect(-1400, -1400, GAME_W + 2800, HUD_H + 1400);
    bg.fillStyle(0x294d43, 0.1);
    bg.fillRect(-1400, HUD_H, GAME_W + 2800, 5);
    bg.fillStyle(WORKSHOP.border, 1);
    bg.fillRect(-1400, HUD_H - 1, GAME_W + 2800, 1);
    bg.lineStyle(1, WORKSHOP.border, 1);
    for (const x of this.mode === 'puzzle' ? [164, 458, 856, 998] : [88, 242, 514, 864, 1082]) {
      bg.lineBetween(x, 22, x, HUD_H - 22);
    }
    this.bar.add(bg);

    this.bar.add(
      new Button(this, 50, BAR_Y - 2, {
        w: 52, h: 46, icon: 'pause', color: WORKSHOP.inset, radius: 12, style: 'panel', textColor: WORKSHOP.text,
        onClick: () => (this.mode === 'puzzle' ? this.game_.pause() : this.panic.pause()),
      }),
    );
    this.heartsG = this.add.graphics();
    this.bar.add(this.heartsG);
    this.hand = this.add.image(0, 0, 'hand').setScale(1.3 / TEX_SCALE).setDepth(50).setVisible(false).setAngle(-18);

    if (this.mode === 'puzzle') this.createPuzzleHud();
    else this.createPanicHud();
  }

  // --- puzzle HUD -----------------------------------------------------------------

  private createPuzzleHud(): void {
    const g = this.game_;
    const bar = this.bar;
    bar.add(new Button(this, 120, BAR_Y - 2, { w: 52, h: 46, icon: 'restart', color: WORKSHOP.inset, radius: 12, style: 'panel', textColor: WORKSHOP.text, onClick: () => g.retry() }));
    bar.add(txt(this, 184, 23, `PUZZLE / ${String(g.levelIndex + 1).padStart(2, '0')}`, 12, WORKSHOP.muted).setOrigin(0, 0.5).setLetterSpacing(1.5));
    const title = txt(this, 184, 49, g.level.name, 23, WORKSHOP.text).setOrigin(0, 0.5);
    if (title.width > 256) title.setFontSize(23 * 256 / title.width);
    bar.add(title);
    bar.add(txt(this, 650, 18, 'DELIVER', 11, WORKSHOP.muted).setLetterSpacing(2));
    bar.add(txt(this, 926, 18, 'LIVES', 11, WORKSHOP.muted).setLetterSpacing(2));

    // objective chips
    const types = OBJ_TYPES.filter((t) => (g.level.objective[t] ?? 0) > 0);
    const cw = 90;
    const startX = 650 - ((types.length - 1) * cw) / 2;
    types.forEach((type, i) => {
      const box = this.add.container(startX + i * cw, 49);
      const cbg = this.add.graphics();
      const icon = this.add.image(-23, 0, toyKey(type, 'standard')).setScale(0.4 / TEX_SCALE);
      const label = txt(this, 13, 0, '', 21, WORKSHOP.text);
      box.add([cbg, icon, label]);
      bar.add(box);
      this.chips.push({ type, bg: cbg, label, box, shown: -1 });
    });

    if (g.level.timeLimit) {
      this.timerT = txt(this, 926, 70, '', 12, WORKSHOP.muted);
      bar.add(this.timerT);
    }

    this.phaseT = txt(this, FF_X, BAR_Y - 1, 'SETUP', 11, WORKSHOP.muted).setLetterSpacing(1);
    bar.add(this.phaseT);
    this.ffBtn = new Button(this, FF_X, BAR_Y - 2, { w: 52, h: 46, icon: 'ff', color: WORKSHOP.inset, radius: 12, style: 'panel', textColor: WORKSHOP.text, onClick: () => g.toggleSpeed() });
    this.runBtn = new Button(this, RUN_X, BAR_Y - 2, { w: 184, h: 48, label: 'RUN', icon: 'play', color: 0x9cddb0, fontSize: 24, radius: 13, style: 'panel', textColor: WORKSHOP.text, onClick: () => g.toggleRun() });
    bar.add([this.ffBtn, this.runBtn]);

    // hint pill
    this.hintBg = this.add.graphics();
    this.hintText = txt(this, 14, 0, '', 20, WORKSHOP.text);
    this.hint = this.add.container(GAME_W / 2, GAME_H - 40, [this.hintBg, this.hintText]).setDepth(40);

    // level intro card
    if (!save.settings.reducedMotion) {
      const card = this.add.container(GAME_W / 2, 230).setDepth(60);
      const cbg = this.add.graphics();
      const title = txt(this, 0, 10, g.level.name, 48);
      const sub = txt(this, 0, -36, `LEVEL ${g.levelIndex + 1}`, 21, TEXT.pink);
      const w = Math.max(340, title.width + 100);
      roundRect(cbg, -w / 2, -68, w, 136, 24, WORKSHOP.panel, 4);
      card.add([cbg, sub, title]);
      card.setScale(0.5).setAlpha(0);
      this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({ targets: card, alpha: 0, y: 200, duration: 260, delay: 1150, onComplete: () => card.destroy() });
    }
  }

  private updatePuzzle(dt: number): void {
    const g = this.game_;
    if (!g.rules) return;

    for (const c of this.chips) {
      const need = g.rules.needed(c.type);
      const have = Math.min(need, g.rules.delivered[c.type]);
      if (have === c.shown) continue;
      const done = have >= need;
      c.label.setText(`${have}/${need}`);
      c.bg.clear();
      roundRect(c.bg, -42, -19, 84, 38, 10, done ? 0xccebd0 : WORKSHOP.inset, 0);
      c.bg.fillStyle(done ? WORKSHOP.accent : TYPE_COLORS[c.type].fill, 1);
      c.bg.fillRoundedRect(-42, -11, 3, 22, 1);
      if (c.shown >= 0 && have > c.shown && !save.settings.reducedMotion) {
        c.box.setScale(1.1);
        this.tweens.add({ targets: c.box, scale: 1, duration: 320, ease: 'Back.easeOut' });
      }
      c.shown = have;
    }

    // lives = allowed mistakes + 1
    const total = g.level.mistakesAllowed + 1;
    const left = Math.max(0, total - g.rules.mistakes);
    this.drawHearts(total, left, 926 - (total - 1) * 13);

    if (this.timerT) {
      const t = g.state === 'prep' ? g.level.timeLimit! : (g.rules.timeLeft ?? 0);
      this.timerT.setText(`${Math.ceil(t)}s`);
    }

    if (g.state !== this.lastState) {
      this.lastState = g.state;
      const b = this.runBtn!;
      if (g.state === 'prep') b.setColor(0x9cddb0).setContent('RUN', 'play');
      else if (g.state === 'running') b.setColor(0xf1b6a6).setContent('STOP', 'stop');
      else b.setColor(0xf1d58e).setContent('RETRY', 'restart');
      this.ffBtn!.setVisible(g.state === 'running');
      this.phaseT!.setVisible(g.state !== 'running').setText(g.state === 'prep' ? 'SETUP' : 'DONE');
    }
    if (g.speed !== this.lastSpeed) {
      this.lastSpeed = g.speed;
      this.ffBtn!.setColor(g.speed > 1 ? 0xf1d58e : WORKSHOP.inset);
    }

    // hint + tutorial hand
    const tut = g.tutorialHint();
    const text = g.state === 'prep' ? (tut?.text ?? g.level.hint ?? '') : '';
    if (text !== this.hintShown) {
      this.hintShown = text;
      this.hint.setVisible(!!text);
      if (text) {
        this.hintText.setText(text);
        const w = this.hintText.width + 80;
        this.hintBg.clear();
        this.hintBg.fillStyle(0x294d43, 0.12);
        this.hintBg.fillRoundedRect(-w / 2, -21, w, 48, 14);
        roundRect(this.hintBg, -w / 2, -24, w, 48, 14, WORKSHOP.panel, 0);
        this.hintBg.lineStyle(1, WORKSHOP.border, 1);
        this.hintBg.strokeRoundedRect(-w / 2, -24, w, 48, 14);
        this.hintBg.fillStyle(WORKSHOP.accent, 1);
        this.hintBg.fillCircle(-w / 2 + 24, 0, 4);
        this.hint.x = this.freeHintX(w);
        if (!save.settings.reducedMotion) {
          this.hint.setScale(0.8);
          this.tweens.add({ targets: this.hint, scale: 1, duration: 220, ease: 'Back.easeOut' });
        }
      }
    }
    // in tall windows there is free room under the play field: park the hint there
    this.hint.y = this.hintTop ? HUD_H + 82 : Math.min(viewBottom() - 40, GAME_H + 44);

    this.clock += dt;
    if (!tut) {
      this.hand.setVisible(false);
      return;
    }
    this.hand.setVisible(true);
    let hx = tut.x;
    let hy = tut.y;
    if (tut.kind === 'run') {
      hx = RUN_X;
      hy = this.bar.y + BAR_Y + 34;
    }
    const base = 1.3 / TEX_SCALE;
    if (tut.kind === 'drag') {
      const cycle = (this.clock % 2000) / 2000;
      const k = Phaser.Math.Easing.Cubic.InOut(Phaser.Math.Clamp((cycle - 0.2) / 0.55, 0, 1));
      hx = tut.x + (tut.x2! - tut.x) * k;
      hy = tut.y + (tut.y2! - tut.y) * k + 4;
      this.hand.setScale((cycle < 0.15 || cycle > 0.85 ? 1.12 : 1) * base);
      this.hand.setAlpha(cycle > 0.9 ? (1 - cycle) * 10 : 1);
    } else {
      const bob = Math.abs(Math.sin(this.clock / 230));
      hy += 8 + bob * 16;
      hx += bob * 6;
      this.hand.setScale(base).setAlpha(1);
    }
    this.hand.setPosition(hx, hy);
  }

  /** Pick a spot along the bottom edge where the hint pill does not cover a machine. */
  private freeHintX(w: number): number {
    this.hintTop = false;
    if (viewBottom() > GAME_H + 70) return GAME_W / 2; // the pill sits below the play field
    const y0 = GAME_H - 40 - 28;
    const machines = this.game_.world.machines;
    for (const x of [640, 400, 880, 220, 1060]) {
      let clear = true;
      for (const m of machines) {
        const e = m.extents();
        const rx = Math.abs(Math.cos(m.rad)) * e.hw + Math.abs(Math.sin(m.rad)) * e.hh;
        const ry = Math.abs(Math.sin(m.rad)) * e.hw + Math.abs(Math.cos(m.rad)) * e.hh;
        if (m.y + ry > y0 && Math.abs(m.x - x) < rx + w / 2 + 6) clear = false;
      }
      if (clear) return x;
    }
    // nothing free along the bottom: use the top, away from the spawner pipes
    this.hintTop = true;
    const pipes = this.game_.world.spawners.map((s) => s.def.x);
    let best = 640;
    let bestD = -1;
    for (const x of [640, 420, 860, 250, 1030]) {
      const d = Math.min(...pipes.map((p) => Math.abs(p - x)), 9999);
      if (d > bestD) {
        bestD = d;
        best = x;
      }
    }
    return best;
  }

  private drawHearts(total: number, left: number, x0: number): void {
    const key = `${total}|${left}|${x0}`;
    if (key === this.heartsKey) return;
    const wobble = this.heartsKey !== '' && !save.settings.reducedMotion;
    this.heartsKey = key;
    const g = this.heartsG;
    g.clear();
    for (let i = 0; i < total; i++) heart(g, x0 + i * 26, 49, 22, i < left ? 0xd96d78 : 0xd3dbd2, 0);
    if (wobble) {
      g.setPosition(0, 0);
      this.tweens.add({ targets: g, y: 4, duration: 70, yoyo: true, repeat: 2 });
    }
  }

  // --- panic HUD ------------------------------------------------------------------

  private createPanicHud(): void {
    const bar = this.bar;
    bar.add(txt(this, 112, 23, 'PERSONAL BEST', 11, WORKSHOP.muted).setOrigin(0, 0.5).setLetterSpacing(1));
    bar.add(txt(this, 112, 50, `${save.data.panicBest}`, 26, WORKSHOP.text).setOrigin(0, 0.5));
    bar.add(txt(this, 378, 20, 'PANIC MODE', 11, WORKSHOP.muted).setLetterSpacing(2));
    bar.add(txt(this, GAME_W / 2, 18, 'SCORE', 11, WORKSHOP.muted).setLetterSpacing(2));
    bar.add(txt(this, 974, 18, 'COMBO', 11, WORKSHOP.muted).setLetterSpacing(2));
    bar.add(txt(this, 1164, 18, 'LIVES', 11, WORKSHOP.muted).setLetterSpacing(2));
    this.scoreT = txt(this, GAME_W / 2, 49, '0', 34, WORKSHOP.text);
    this.multT = txt(this, 974, 49, 'x1', 25, WORKSHOP.muted);
    this.effectT = txt(this, 378, 49, '', 17, WORKSHOP.text);
    bar.add([this.scoreT, this.multT, this.effectT]);

    this.bannerBg = this.add.graphics();
    this.bannerT = txt(this, 0, 0, '', 30, TEXT.white);
    this.banner = this.add.container(GAME_W / 2, HUD_H + 52, [this.bannerBg, this.bannerT]).setDepth(40).setVisible(false);
    this.tip = txt(this, GAME_W / 2, 318, 'Tap a belt to flip it', 22, WORKSHOP.text, { backgroundColor: '#FFFCF5', padding: { x: 18, y: 10 } });
  }

  private updatePanic(): void {
    const p = this.panic;
    if (!p.score) return;
    if (p.score.score !== this.lastScore) {
      this.lastScore = p.score.score;
      this.scoreT!.setText(`${p.score.score}`);
      if (!save.settings.reducedMotion) {
        this.scoreT!.setScale(1.25);
        this.tweens.add({ targets: this.scoreT, scale: 1, duration: 240, ease: 'Back.easeOut' });
      }
    }
    if (p.score.multiplier !== this.lastMult) {
      const up = p.score.multiplier > this.lastMult;
      this.lastMult = p.score.multiplier;
      this.multT!.setText(`x${p.score.multiplier}`);
      if (up && !save.settings.reducedMotion) {
        this.multT!.setScale(1.6);
        this.tweens.add({ targets: this.multT, scale: 1, duration: 320, ease: 'Back.easeOut' });
      }
    }
    this.drawHearts(p.maxLives, p.lives, 1164 - (p.maxLives - 1) * 13);
    this.effectT!.setText(p.activeEffect || 'Keep the orders moving');
    // the tip only shows for the first few seconds
    this.tip!.setVisible(p.director.seconds < 8);

    const w = p.warning;
    if (w !== this.bannerShown) {
      this.bannerShown = w;
      this.banner!.setVisible(!!w);
      if (w) {
        this.bannerT!.setText(w);
        const bw = this.bannerT!.width + 70;
        this.bannerBg!.clear();
        roundRect(this.bannerBg!, -bw / 2, -30, bw, 60, 30, COLORS.red, 4);
      }
    }
    if (w) this.banner!.setScale(1 + 0.05 * Math.sin(this.time.now / 90));
  }

  override update(_t: number, delta: number): void {
    this.bar.y = viewTop();
    if (this.mode === 'puzzle') this.updatePuzzle(delta);
    else this.updatePanic();
  }
}
