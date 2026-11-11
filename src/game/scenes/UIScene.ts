import Phaser from 'phaser';
import { COLORS, FOOTER_H, GAME_H, GAME_W, HUD_H, OBJ_TYPES, PLAY_H, TEX_SCALE, TEXT, TYPE_COLORS, WORKSHOP, type ObjType } from '../config';
import { parseSpawn } from '../levels/LevelTypes';
import { BELT_A } from '../levels/levels';
import type { ConveyorBelt } from '../machines/ConveyorBelt';
import { keepOverlayBelow, safeBottom, safeTop, setupCamera } from '../rendering/Background';
import { drawIcon } from '../rendering/Icons';
import { toyKey } from '../rendering/Textures';
import { heart, roundRect, star } from '../rendering/VectorFactory';
import { audio } from '../systems/AudioManager';
import { LevelManager } from '../systems/LevelManager';
import { save } from '../systems/SaveManager';
import { starsForRuns } from '../systems/ScoreManager';
import { Button, drawStar, txt } from '../ui/UIComponents';
import type { GameScene, GameState } from './GameScene';
import type { PanicScene } from './PanicScene';

interface Chip {
  type: ObjType;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  box: Phaser.GameObjects.Container;
  shown: number;
}

/** One big button per belt in the control strip. */
interface BeltButton {
  belt: ConveyorBelt;
  button: Button;
  /** button width, needed to place the end rollers */
  w: number;
  /** label and chevrons, centred together on the face */
  content: Phaser.GameObjects.Container;
  /** flip icon (or the lock when jammed) */
  marks: Phaser.GameObjects.Graphics;
  /** end rollers, drawn like the belt's */
  rollers: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  shownDir: number;
  shownOff: boolean;
}

const CX = GAME_W / 2;
const BAR_Y = HUD_H / 2;
/** Side margin shared by the top bar and the control strip (the pause button's left edge). */
const SIDE = 16;
/** Rows inside the control strip, measured from its top edge. */
const LIVES_ROW = 34;
const BUTTON_ROW = 122;
const BUTTON_H = 112;
/** Shown when the player taps the play field instead of a button. */
const NUDGE_TEXT = 'TAP A BUTTON TO FLIP ITS BELT';
/** Set-up levels: what the status line says in each state. */
const PLAN_TEXT = {
  first: 'TAP THE MACHINES, THEN RUN',
  again: 'CHANGE THE SETUP, THEN RUN',
  missPrep: 'TAP A MACHINE WITH A BADGE',
  missRun: 'PRESS STOP TO CHANGE THE SETUP',
  won: 'ALL SORTED!',
  failed: 'NOT QUITE...',
};
const NUDGE_MS = 2600;
/** Centre of the first heart, just after the LIVES label. */
const HEARTS_X = SIDE + 86;

/**
 * Heads-up display for the portrait layout, rendered in its own scene above
 * the factory so camera shake never moves it.
 *
 *   top bar        pause, restart, level name, delivery counters
 *   play field
 *   control strip  light workshop surface with lives and labelled belt controls
 *
 * The top bar is pinned to the top of the device's safe area and the controls
 * stay clear of the bottom inset, so nothing sits under a camera cut-out or
 * the home indicator. It polls the gameplay scene each frame and only redraws
 * what changed.
 */
export class UIScene extends Phaser.Scene {
  private mode: 'puzzle' | 'panic' = 'puzzle';
  /** everything in the top bar; pinned to the top of the safe area every frame */
  private bar!: Phaser.GameObjects.Container;
  /** the control strip under the play field */
  private footer!: Phaser.GameObjects.Container;
  private controls!: Phaser.GameObjects.Container;
  private beltButtons: BeltButton[] = [];
  private heartsG!: Phaser.GameObjects.Graphics;
  private heartsKey = '';
  // puzzle
  private chips: Chip[] = [];
  private lastState: GameState | '' = '';
  private hint!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private hintBg!: Phaser.GameObjects.Graphics;
  private hintShown = '';
  /** introduces a toy the player has not met yet; up until the first RUN */
  private newToyCard: Phaser.GameObjects.Container | null = null;
  private hand!: Phaser.GameObjects.Image;
  private clock = 0;
  private resultCard: Phaser.GameObjects.Container | null = null;
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
  /** time (scene clock) until which the "use the buttons" nudge is showing */
  private nudgeUntil = 0;
  // set-up levels
  private runBtn: Button | null = null;
  private starsG: Phaser.GameObjects.Graphics | null = null;
  private starsShown = -1;
  private runShown = '';
  private tip: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('UI');
  }

  init(data: { mode?: 'puzzle' | 'panic' }): void {
    this.mode = data.mode ?? 'puzzle';
    this.chips = [];
    this.beltButtons = [];
    this.heartsKey = '';
    this.lastState = '';
    this.hintShown = '';
    this.newToyCard = null;
    this.lastScore = -1;
    this.lastMult = 0;
    this.bannerShown = '';
    this.scoreT = this.multT = this.bannerT = this.effectT = this.tip = null;
    this.nudgeUntil = 0;
    this.resultCard = null;
    this.runBtn = null;
    this.starsG = null;
    this.starsShown = -1;
    this.runShown = '';
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
    // the portal's overlay button goes just under the top bar, clear of pause and restart
    keepOverlayBelow(() => safeTop() + HUD_H);

    // top bar: its background runs far above, so the area under a camera cut-out is simply more bar
    this.bar = this.add.container(0, safeTop());
    const bg = this.add.graphics();
    bg.fillStyle(WORKSHOP.panel, 1);
    bg.fillRect(-3000, -1400, GAME_W + 6000, HUD_H + 1400);
    bg.fillStyle(0x294d43, 0.1);
    bg.fillRect(-3000, HUD_H, GAME_W + 6000, 5);
    bg.fillStyle(WORKSHOP.border, 1);
    bg.fillRect(-3000, HUD_H - 1, GAME_W + 6000, 1);
    this.bar.add(bg);
    this.bar.add(
      new Button(this, 52, BAR_Y - 2, {
        w: 72, h: 64, icon: 'pause', color: WORKSHOP.inset, radius: 16, style: 'panel', textColor: WORKSHOP.text,
        onClick: () => (this.mode === 'puzzle' ? this.game_.pause() : this.panic.pause()),
      }),
    );

    // control strip
    this.footer = this.add.container(0, PLAY_H);
    const fg = this.add.graphics();
    fg.fillStyle(WORKSHOP.panel, 1);
    fg.fillRect(-3000, 0, GAME_W + 6000, FOOTER_H + 1400);
    fg.fillStyle(WORKSHOP.border, 1);
    fg.fillRect(-3000, 0, GAME_W + 6000, 2);
    fg.fillStyle(0x294d43, 0.06);
    fg.fillRect(-3000, 2, GAME_W + 6000, 5);
    this.footer.add(fg);
    // controls sit in an inner group, centred in whatever safe space the strip has (tall phones have more)
    this.controls = this.add.container(0, 0);
    this.footer.add(this.controls);
    const plan = this.mode === 'puzzle' && !!this.game_.level.plan;
    this.controls.add(txt(this, SIDE + 4, LIVES_ROW, plan ? 'STARS' : 'LIVES', 16, WORKSHOP.muted).setOrigin(0, 0.5).setLetterSpacing(1.5));
    this.heartsG = this.add.graphics();
    this.controls.add(this.heartsG);
    this.effectT = txt(this, GAME_W - SIDE - 4, LIVES_ROW, plan ? PLAN_TEXT.first : 'TAP TO FLIP', 18, WORKSHOP.muted).setOrigin(1, 0.5);
    this.controls.add(this.effectT);

    this.hand = this.add.image(0, 0, 'hand').setScale(1.5 / TEX_SCALE).setDepth(50).setVisible(false).setAngle(-18);

    if (this.mode === 'puzzle') this.createPuzzleHud();
    else this.createPanicHud();
  }

  // --- belt buttons -----------------------------------------------------------------

  /**
   * One button per belt, laid out left to right in the same order as the belts
   * on screen. Each button is drawn as a small copy of its belt (navy frame,
   * accent face, rollers at the ends, white chevrons) and shows which way the
   * belt is running right now: the word and its chevrons, centred together.
   */
  private createBeltButtons(belts: ConveyorBelt[], onFlip: (belt: ConveyorBelt) => void): void {
    const n = belts.length;
    if (n === 0) return;
    // full width between the same side margins as the top bar
    const gap = 16;
    const w = (GAME_W - SIDE * 2 - (n - 1) * gap) / n;
    const x0 = CX - ((n - 1) * (w + gap)) / 2;
    belts.forEach((belt) => {
      const button = new Button(this, x0 + belts.indexOf(belt) * (w + gap), BUTTON_ROW, {
        w, h: BUTTON_H, radius: 30, style: 'belt', color: belt.def.accent ?? BELT_A,
        onClick: () => onFlip(belt),
      });
      const rollers = this.add.graphics();
      const marks = this.add.graphics();
      const label = txt(this, 0, 1, '', 34, TEXT.white, { stroke: '#2A1F6B', strokeThickness: 4 }).setLetterSpacing(1.5);
      const content = this.add.container(0, 0, [marks, label]);
      button.addToFace(rollers, content);
      this.controls.add(button);
      const control: BeltButton = { belt, button, w, content, marks, rollers, label, shownDir: belt.dir, shownOff: belt.disabled };
      this.beltButtons.push(control);
      this.drawBeltButton(control);
    });
  }

  private drawBeltButton(b: BeltButton): void {
    const off = b.belt.disabled;
    const dir = b.belt.dir;
    b.button.setColor(off ? 0x8f8ab0 : (b.belt.def.accent ?? BELT_A));

    // rollers sit just inside the frame, the same distance from each end
    const g = b.rollers;
    g.clear();
    const spin = dir === 1 ? Math.PI / 4 : -Math.PI / 4;
    for (const rx of [-b.w / 2 + 34, b.w / 2 - 34]) {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(rx, 0, 13);
      g.lineStyle(3.5, COLORS.lavenderDark, 1);
      g.lineBetween(rx - Math.cos(spin) * 8, -Math.sin(spin) * 8, rx + Math.cos(spin) * 8, Math.sin(spin) * 8);
    }

    // an action, not a status: the flip icon (the same badge the belt wears) and the word FLIP,
    // centred as one group. The belt itself shows which way it runs.
    b.label.setText(off ? 'JAMMED' : 'FLIP');
    const m = b.marks;
    m.clear();
    const iconW = 40;
    const space = 14;
    const total = iconW + space + b.label.width;
    m.setPosition(-total / 2 + iconW / 2, 0);
    b.label.x = total / 2 - b.label.width / 2;
    m.fillStyle(COLORS.belt, 0.35);
    m.fillCircle(0, 2, iconW / 2);
    m.fillStyle(0xffffff, 1);
    m.fillCircle(0, 0, iconW / 2);
    drawIcon(m, off ? 'lock' : 'flip', 11, off ? 0x8f8ab0 : (b.belt.def.accent ?? BELT_A));
  }

  private updateBeltButtons(): void {
    for (const b of this.beltButtons) {
      const off = b.belt.disabled;
      if (b.belt.dir === b.shownDir && off === b.shownOff) continue;
      const flipped = b.belt.dir !== b.shownDir;
      b.shownDir = b.belt.dir;
      b.shownOff = off;
      this.drawBeltButton(b);
      if (flipped && !save.settings.reducedMotion) {
        this.tweens.killTweensOf(b.content);
        b.content.setScale(0.85);
        this.tweens.add({ targets: b.content, scale: 1, duration: 220, ease: 'Back.easeOut' });
      }
    }
  }

  /**
   * The player tapped the play field instead of a button (people try to drag the springs, or
   * expect to touch the belts): bounce the buttons, point at them and say what they do.
   */
  nudgeControls(): void {
    const now = this.time.now;
    if (now < this.nudgeUntil - NUDGE_MS + 700) return; // not on every tap of a burst
    this.nudgeUntil = now + NUDGE_MS;
    audio.click();
    if (save.settings.reducedMotion) return;
    const targets: Button[] = this.beltButtons.map((b) => b.button);
    if (this.runBtn && this.game_.state === 'running') targets.push(this.runBtn);
    targets.forEach((btn, i) => {
      this.tweens.killTweensOf(btn);
      btn.setScale(1);
      this.tweens.add({ targets: btn, scale: 1.04, duration: 140, delay: i * 90, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    });
  }
  private get plan(): boolean {
    return this.mode === 'puzzle' && !!this.game_.level.plan;
  }
  private get nudging(): boolean {
    return this.time.now < this.nudgeUntil;
  }
  /** Shows the nudge text and hand while a nudge is active. Call after the mode's own update. */
  private updateNudge(): void {
    if (!this.effectT) return;
    if (this.nudging) {
      const running = this.game_?.state === 'running';
      this.effectT.setText(this.plan ? (running ? PLAN_TEXT.missRun : PLAN_TEXT.missPrep) : NUDGE_TEXT).setColor('#39796B');
      // set-up levels: the badges flash in the factory; while running, point at STOP
      const target = this.plan
        ? running && this.runBtn ? this.objectPos(this.runBtn) : null
        : this.beltButtons[0] ? this.beltButtonPos(this.beltButtons[0].belt.id) : null;
      if (target && !this.hand.visible) {
        const bob = Math.abs(Math.sin(this.time.now / 230));
        this.hand.setVisible(true).setScale(1.5 / TEX_SCALE).setAlpha(1);
        this.hand.setPosition(target.x + 70 + bob * 7, target.y + 14 + bob * 18);
      }
    } else if (this.mode === 'puzzle' && !this.plan) {
      this.effectT.setText('TAP TO FLIP').setColor(WORKSHOP.muted);
    }
  }

  private objectPos(o: Phaser.GameObjects.Container): { x: number; y: number } {
    const m = o.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }

  // --- set-up-then-run controls ----------------------------------------------------

  /** The control strip of a set-up level: the stars still on offer, a status line and one big RUN / STOP. */
  private createRunControls(): void {
    const g = this.game_;
    this.starsG = this.add.graphics();
    this.controls.add(this.starsG);
    this.runBtn = new Button(this, CX, BUTTON_ROW, {
      w: GAME_W - SIDE * 2, h: BUTTON_H, radius: 30, label: 'RUN', icon: 'play', iconSize: 24, fontSize: 48, color: COLORS.yellow,
      onClick: () => g.toggleRun(),
    });
    this.controls.add(this.runBtn);
  }

  private updateRunControls(): void {
    const g = this.game_;
    const btn = this.runBtn;
    if (!btn) return;
    const st = g.state;
    const key = `${st}|${g.runs}`;
    if (key !== this.runShown) {
      this.runShown = key;
      if (st === 'prep') btn.setContent('RUN', 'play').setColor(COLORS.yellow).setEnabled(true);
      else if (st === 'running') btn.setContent('STOP', 'stop').setColor(0xffb3c9).setEnabled(true);
      else btn.setEnabled(false);
      if (!this.nudging) {
        const text = st === 'prep' ? (g.runs === 0 ? PLAN_TEXT.first : PLAN_TEXT.again) : st === 'running' ? `RUN ${g.runs}` : st === 'won' ? PLAN_TEXT.won : PLAN_TEXT.failed;
        this.effectT?.setText(text).setColor(st === 'won' ? '#39796B' : WORKSHOP.muted);
      }
    }
    if (this.nudging) this.runShown = ''; // restore the status line when the nudge ends
    // the stars this level is still worth: a win on the coming (or current) run earns them
    const n = starsForRuns(st === 'prep' ? g.runs + 1 : g.runs);
    if (n !== this.starsShown && this.starsG) {
      const lost = this.starsShown > n && this.starsShown > 0;
      this.starsShown = n;
      this.starsG.clear();
      for (let i = 0; i < 3; i++) star(this.starsG, HEARTS_X + i * 36, LIVES_ROW, 14, i < n ? COLORS.yellow : 0xd3dbd2, 0);
      if (lost && !save.settings.reducedMotion) {
        this.tweens.add({ targets: this.starsG, y: 4, duration: 70, yoyo: true, repeat: 2 });
      }
    }
  }

  /** Logical position of the button that controls `beltId` (for the tutorial hand and tests). */
  beltButtonPos(beltId: string): { x: number; y: number } | null {
    const b = this.beltButtons.find((bb) => bb.belt.id === beltId);
    if (!b) return null;
    const m = b.button.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }

  // --- puzzle HUD -----------------------------------------------------------------

  private createPuzzleHud(): void {
    const g = this.game_;
    const bar = this.bar;
    bar.add(new Button(this, 136, BAR_Y - 2, { w: 72, h: 64, icon: 'restart', color: WORKSHOP.inset, radius: 16, style: 'panel', textColor: WORKSHOP.text, onClick: () => g.retry() }));
    bar.add(txt(this, 188, 30, `LEVEL ${g.levelIndex + 1}`, 15, WORKSHOP.muted).setOrigin(0, 0.5).setLetterSpacing(1.5));
    const title = txt(this, 188, 60, g.level.name, 28, WORKSHOP.text).setOrigin(0, 0.5);
    const types = OBJ_TYPES.filter((t) => (g.level.objective[t] ?? 0) > 0);
    const cw = types.length > 3 ? 92 : 112;
    const chipsLeft = GAME_W - 14 - types.length * cw;
    const room = chipsLeft - 188 - 12;
    if (title.width > room) title.setFontSize((28 * room) / title.width);
    bar.add(title);

    // delivery counters, right-aligned
    types.forEach((type, i) => {
      const box = this.add.container(chipsLeft + cw / 2 + i * cw, BAR_Y);
      const cbg = this.add.graphics();
      const icon = this.add.image(-cw / 2 + 28, 0, toyKey(type, 'standard')).setScale(0.52 / TEX_SCALE);
      const label = txt(this, 18, 0, '', 26, WORKSHOP.text);
      box.add([cbg, icon, label]);
      bar.add(box);
      this.chips.push({ type, bg: cbg, label, box, shown: -1 });
    });

    if (g.level.plan) this.createRunControls();
    else this.createBeltButtons(g.belts, (belt) => g.flipBelt(belt.id));

    // hint pill
    this.hintBg = this.add.graphics();
    this.hintText = txt(this, 14, 0, '', 24, WORKSHOP.text);
    this.hint = this.add.container(CX, PLAY_H - 52, [this.hintBg, this.hintText]).setDepth(40);

    // level intro card
    if (!save.settings.reducedMotion) {
      const card = this.add.container(CX, 360).setDepth(60);
      const cbg = this.add.graphics();
      const t = txt(this, 0, 12, g.level.name, 54);
      const sub = txt(this, 0, -42, `LEVEL ${g.levelIndex + 1}`, 24, TEXT.pink);
      const w = Math.min(680, Math.max(360, t.width + 100));
      roundRect(cbg, -w / 2, -78, w, 156, 28, WORKSHOP.panel, 4);
      card.add([cbg, sub, t]);
      card.setScale(0.5).setAlpha(0);
      this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({ targets: card, alpha: 0, y: 330, duration: 260, delay: 1150, onComplete: () => card.destroy() });
    }
    if (g.level.newToy) this.createNewToyCard(save.settings.reducedMotion ? 0 : 1350);
  }

  /**
   * "NEW TOY" card: a big picture of the toy with one line on how it behaves, so a heavy or
   * bouncy toy never surprises the player. It stays up while they set up and goes at RUN.
   */
  private createNewToyCard(delay: number): void {
    const g = this.game_;
    const info = g.level.newToy!;
    const { type, material } = parseSpawn(info.spec);
    const W = 620;
    const H = 132;
    const card = this.add.container(CX, this.freeBand(H)).setDepth(55);
    const bg = this.add.graphics();
    bg.fillStyle(0x294d43, 0.14);
    bg.fillRoundedRect(-W / 2, -H / 2 + 6, W, H, 24);
    roundRect(bg, -W / 2, -H / 2, W, H, 24, WORKSHOP.panel, 0);
    bg.lineStyle(3, TYPE_COLORS[type].fill, 1);
    bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 24);
    bg.fillStyle(TYPE_COLORS[type].fill, 0.16);
    bg.fillCircle(-W / 2 + 72, 0, 50);
    const toy = this.add.image(-W / 2 + 72, 0, toyKey(type, material)).setScale(1 / TEX_SCALE);
    const tagBg = this.add.graphics();
    roundRect(tagBg, -W / 2 + 144, -H / 2 + 16, 104, 28, 14, COLORS.pink, 0);
    const tag = txt(this, -W / 2 + 196, -H / 2 + 30, 'NEW TOY', 15, TEXT.white).setLetterSpacing(1.5);
    const title = txt(this, -W / 2 + 144, -2, info.title, 30, WORKSHOP.text).setOrigin(0, 0.5);
    const body = txt(this, -W / 2 + 144, 36, info.text, 19, WORKSHOP.muted).setOrigin(0, 0.5);
    const room = W - 144 - 22;
    if (body.width > room) body.setFontSize((19 * room) / body.width);
    card.add([bg, toy, tagBg, tag, title, body]);
    card.setAlpha(0).setScale(0.85);
    this.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 280, delay, ease: 'Back.easeOut' });
    if (!save.settings.reducedMotion) this.tweens.add({ targets: toy, angle: { from: -8, to: 8 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay });
    this.newToyCard = card;
  }

  /** A y for a full-width card of height h in the upper play field that covers no machine. */
  private freeBand(h: number): number {
    const world = this.game_.world;
    const candidates = [310, 350, 270, 390, 440];
    for (const y of candidates) {
      const clear = world.machines.every((m) => {
        if (m.kind === 'bin') return true;
        const e = m.extents();
        const ry = Math.abs(Math.sin(m.rad)) * e.hw + Math.abs(Math.cos(m.rad)) * e.hh;
        return m.y + ry < y - h / 2 - 6 || m.y - ry > y + h / 2 + 6;
      });
      if (clear) return y;
    }
    return candidates[0];
  }

  private updatePuzzle(dt: number): void {
    const g = this.game_;
    if (!g.rules) return;

    for (const c of this.chips) {
      const need = g.rules.needed(c.type);
      const have = Math.min(need, g.rules.delivered[c.type]);
      if (have === c.shown) continue;
      const done = have >= need;
      const hw = (this.chips.length > 3 ? 92 : 112) / 2 - 5;
      c.label.setText(`${have}/${need}`);
      c.bg.clear();
      roundRect(c.bg, -hw, -27, hw * 2, 54, 14, done ? 0xccebd0 : WORKSHOP.inset, 0);
      c.bg.fillStyle(done ? WORKSHOP.accent : TYPE_COLORS[c.type].fill, 1);
      c.bg.fillRoundedRect(-hw, -15, 4, 30, 2);
      if (c.shown >= 0 && have > c.shown && !save.settings.reducedMotion) {
        c.box.setScale(1.15);
        this.tweens.add({ targets: c.box, scale: 1, duration: 320, ease: 'Back.easeOut' });
      }
      c.shown = have;
    }

    if (g.level.plan) this.updateRunControls();
    else {
      // lives = allowed slips + 1
      const total = g.level.mistakesAllowed + 1;
      const left = Math.max(0, total - g.rules.mistakes - g.rules.lost);
      this.drawHearts(total, left, HEARTS_X, LIVES_ROW);
    }

    if (g.state !== this.lastState) {
      this.lastState = g.state;
      this.showResultCard(g.state);
    }

    if (this.newToyCard && !(g.state === 'prep' && g.runs === 0)) {
      const card = this.newToyCard;
      this.newToyCard = null;
      this.tweens.killTweensOf(card);
      this.tweens.add({ targets: card, alpha: 0, scale: 0.9, duration: 200, onComplete: () => card.destroy(true) });
    }

    // hint + tutorial hand
    const tut = g.tutorialHint();
    // the one-line hint stays up for the first few seconds of play
    // (the new-toy card, while it is up, takes the hint's place)
    const showHint = (g.state === 'prep' && !this.newToyCard) || (!g.level.plan && g.state === 'running' && (!!tut || g.world.tick < 420));
    const text = showHint ? (tut?.text ?? g.level.hint ?? '') : '';
    if (text !== this.hintShown) {
      this.hintShown = text;
      this.hint.setVisible(!!text);
      if (text) {
        this.hintText.setText(text);
        this.hintText.setFontSize(24);
        if (this.hintText.width > 590) this.hintText.setFontSize((24 * 590) / this.hintText.width);
        const w = this.hintText.width + 84;
        this.hintBg.clear();
        this.hintBg.fillStyle(0x294d43, 0.12);
        this.hintBg.fillRoundedRect(-w / 2, -24, w, 56, 16);
        roundRect(this.hintBg, -w / 2, -28, w, 56, 16, WORKSHOP.panel, 0);
        this.hintBg.lineStyle(1, WORKSHOP.border, 1);
        this.hintBg.strokeRoundedRect(-w / 2, -28, w, 56, 16);
        this.hintBg.fillStyle(WORKSHOP.accent, 1);
        this.hintBg.fillCircle(-w / 2 + 26, 0, 5);
        this.placeHint(w);
        if (!save.settings.reducedMotion) {
          this.hint.setScale(0.8);
          this.tweens.add({ targets: this.hint, scale: 1, duration: 220, ease: 'Back.easeOut' });
        }
      }
    }

    // the tutorial hand taps the machine to change (set-up levels), RUN, or the belt's button
    this.clock += dt;
    let target: { x: number; y: number } | null = null;
    if (tut && g.level.plan) {
      if (tut.kind === 'run' && this.runBtn) target = this.objectPos(this.runBtn);
      else if (tut.kind === 'tap') target = { x: tut.x - 50, y: tut.y - 6 };
    } else if (tut?.machine) target = this.beltButtonPos(tut.machine);
    if (!tut || !target) {
      this.hand.setVisible(false);
      return;
    }
    const bob = Math.abs(Math.sin(this.clock / 230));
    this.hand.setVisible(true).setScale(1.5 / TEX_SCALE).setAlpha(1);
    this.hand.setPosition(target.x + 70 + bob * 7, target.y + 14 + bob * 18);
  }

  /**
   * Arcade-style flow: no result dialog. A win shows a quick star card before the game moves
   * on by itself; a failure shows why for a moment before the level restarts.
   */
  private showResultCard(state: GameState): void {
    this.resultCard?.destroy();
    this.resultCard = null;
    if (state !== 'won' && state !== 'failed') return;
    const g = this.game_;
    const card = this.add.container(CX, 430).setDepth(70);
    const bg = this.add.graphics();
    card.add(bg);
    const plate = (w: number, h: number): void => {
      bg.fillStyle(COLORS.shadow, 0.18);
      bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 8, w, h, 44);
      roundRect(bg, -w / 2, -h / 2, w, h, 44, WORKSHOP.panel, 0);
    };
    if (state === 'won') {
      const last = g.levelIndex + 1 >= LevelManager.count;
      plate(600, 250);
      card.add(txt(this, 0, -66, last ? 'All levels complete!' : 'Level Complete!', 48, WORKSHOP.text));
      for (let i = 0; i < 3; i++) {
        const sx = (i - 1) * 120;
        card.add(drawStar(this, sx, 44, 48, false));
        if (i >= g.lastStars) continue;
        const s = drawStar(this, sx, 44, 48, true).setScale(0);
        card.add(s);
        this.tweens.add({ targets: s, scale: 1, duration: 320, delay: 420 + i * 260, ease: 'Back.easeOut', onStart: () => audio.starPop(i) });
      }
    } else {
      const reason = txt(this, 0, 30, g.rules.failReason || 'That did not work', 28, WORKSHOP.text);
      if (reason.width > 600) reason.setFontSize((28 * 600) / reason.width);
      plate(Math.min(680, Math.max(420, reason.width + 80)), 180);
      card.add([txt(this, 0, -36, 'Oops! Try again', 44, TEXT.pink), reason]);
    }
    this.resultCard = card;
    if (save.settings.reducedMotion) return;
    card.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 260, delay: state === 'won' ? 250 : 150, ease: 'Back.easeOut' });
  }

  /** Put the hint just above the control strip where it does not cover a machine, else under the top bar. */
  private placeHint(w: number): void {
    const world = this.game_.world;
    const half = w / 2;
    const y0 = PLAY_H - 52 - 34;
    const lo = half + 8;
    const hi = GAME_W - half - 8;
    for (const x of [CX, lo, hi]) {
      const cx = Phaser.Math.Clamp(x, lo, Math.max(lo, hi));
      let clear = true;
      for (const m of world.machines) {
        const e = m.extents();
        const rx = Math.abs(Math.cos(m.rad)) * e.hw + Math.abs(Math.sin(m.rad)) * e.hh;
        const ry = Math.abs(Math.sin(m.rad)) * e.hw + Math.abs(Math.cos(m.rad)) * e.hh;
        if (m.y + ry > y0 && Math.abs(m.x - cx) < rx + half + 6) clear = false;
      }
      if (clear) {
        this.hint.setPosition(cx, PLAY_H - 52);
        return;
      }
    }
    // nothing free along the bottom: go under the top bar, as far from the chute pipes as possible
    const pipes = world.spawners.map((s) => s.def.x);
    let best = CX;
    let bestD = -1;
    for (const x of [lo, CX, hi]) {
      const cx = Phaser.Math.Clamp(x, lo, Math.max(lo, hi));
      const d = Math.min(...pipes.map((p) => Math.abs(p - cx)), 9999);
      if (d > bestD) {
        bestD = d;
        best = cx;
      }
    }
    this.hint.setPosition(best, HUD_H + 190);
  }

  private drawHearts(total: number, left: number, x0: number, y: number): void {
    const key = `${total}|${left}|${x0}`;
    if (key === this.heartsKey) return;
    const wobble = this.heartsKey !== '' && !save.settings.reducedMotion;
    this.heartsKey = key;
    const g = this.heartsG;
    g.clear();
    for (let i = 0; i < total; i++) heart(g, x0 + i * 34, y, 27, i < left ? 0xe2566b : 0xd3dbd2, 0);
    if (wobble) {
      g.setPosition(0, 0);
      this.tweens.add({ targets: g, y: 5, duration: 70, yoyo: true, repeat: 2 });
    }
  }

  // --- panic HUD ------------------------------------------------------------------

  private createPanicHud(): void {
    const p = this.panic;
    const bar = this.bar;
    bar.add(txt(this, 110, 30, 'BEST', 14, WORKSHOP.muted).setOrigin(0, 0.5).setLetterSpacing(1.5));
    bar.add(txt(this, 110, 60, `${save.data.panicBest}`, 28, WORKSHOP.text).setOrigin(0, 0.5));
    bar.add(txt(this, CX, 24, 'SCORE', 14, WORKSHOP.muted).setLetterSpacing(2));
    bar.add(txt(this, 620, 24, 'COMBO', 14, WORKSHOP.muted).setLetterSpacing(2));
    this.scoreT = txt(this, CX, 60, '0', 44, WORKSHOP.text);
    this.multT = txt(this, 620, 60, 'x1', 32, WORKSHOP.muted);
    bar.add([this.scoreT, this.multT]);

    this.createBeltButtons(p.belts, (belt) => p.flip(belt.id));

    this.bannerBg = this.add.graphics();
    this.bannerT = txt(this, 0, 0, '', 34, TEXT.white);
    this.banner = this.add.container(CX, HUD_H + 240, [this.bannerBg, this.bannerT]).setDepth(40).setVisible(false);
    this.tip = txt(this, CX, 420, 'Each button flips its belt', 28, WORKSHOP.text, { backgroundColor: '#FFFCF5', padding: { x: 22, y: 12 } });
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
    this.drawHearts(p.maxLives, p.lives, HEARTS_X, LIVES_ROW);
    this.effectT!.setText(p.activeEffect || 'TAP TO FLIP');
    this.effectT!.setColor(p.activeEffect ? '#9A5C14' : WORKSHOP.muted);
    if (!this.nudging || p.activeEffect) this.hand.setVisible(false);
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
        roundRect(this.bannerBg!, -bw / 2, -34, bw, 68, 34, COLORS.red, 4);
      }
    }
    if (w) this.banner!.setScale(1 + 0.05 * Math.sin(this.time.now / 90));
  }

  override update(_t: number, delta: number): void {
    this.bar.y = safeTop();
    // centre the controls in the safe space under the play field
    this.controls.y = Math.max(0, (safeBottom() - GAME_H) / 2);
    this.updateBeltButtons();
    if (this.mode === 'puzzle') this.updatePuzzle(delta);
    else this.updatePanic();
    if (this.mode === 'puzzle' || !this.panic.activeEffect) this.updateNudge();
  }
}
