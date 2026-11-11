import Phaser from 'phaser';
import { COLORS, FONT, HUD_H, TEX_SCALE, TEXT, TYPE_COLORS, view } from '../config';
import type { ObjectSpawner } from '../entities/ObjectSpawner';
import { parseSpawn, type SpawnSpec } from '../levels/LevelTypes';
import type { BaseMachine } from '../machines/BaseMachine';
import { BELT_CY, BELT_THICKNESS, BELT_TOP, ConveyorBelt } from '../machines/ConveyorBelt';
import { DeliveryBin } from '../machines/DeliveryBin';
import { Fan, FAN_R } from '../machines/Fan';
import { Funnel, FUNNEL_WALL } from '../machines/Funnel';
import { Piston, PISTON_HOUSING_H } from '../machines/Piston';
import { SpringBumper } from '../machines/SpringBumper';
import type { FactoryWorld } from '../sim/FactoryWorld';
import { save } from '../systems/SaveManager';
import { toyKey } from './Textures';
import { QUEUE, queueWidth, type QueueSlot } from './queueLayout';
import { capsule, capsulePoints, circle, darken, lighten, roundRect, shadowOffset, star, type G } from './VectorFactory';

export const DEPTH = {
  bg: 0,
  zone: 5,
  walls: 10,
  machineBack: 20,
  toyShadow: 29,
  toys: 40,
  machineFront: 50,
  fx: 60,
  float: 70,
  select: 80,
} as const;

const SHADOW_ALPHA = 0.24;
/** Springs and bumpers get their own colour so they never read as a toy. */
const BUMPER = 0xff8a3d;

/** Base class for the visual half of a machine. Views only read simulation state. */
export abstract class MachineView<M extends BaseMachine = BaseMachine> {
  protected g: G;
  constructor(
    protected scene: Phaser.Scene,
    readonly machine: M,
  ) {
    this.g = scene.add.graphics().setDepth(DEPTH.machineBack);
    // NOTE: subclasses' fields are not initialised yet here, so the factory calls sync() afterwards.
  }

  /** Re-position after the machine moved / rotated. */
  sync(): void {
    this.g.setPosition(this.machine.x, this.machine.y);
    this.g.setRotation(this.machine.rad);
    this.redraw();
  }

  abstract redraw(): void;

  /** A quick squash-and-grow when the player changes this machine. */
  pop(): void {
    if (save.settings.reducedMotion) return;
    this.scene.tweens.killTweensOf(this.g);
    this.g.setScale(1.14);
    this.scene.tweens.add({ targets: this.g, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  /** Per-frame animation. `prep` is true while the player is still arranging machines. */
  update(_dt: number, _prep: boolean): void {}

  destroy(): void {
    this.g.destroy();
  }
}

// ---------------------------------------------------------------------------------
// Conveyor
// ---------------------------------------------------------------------------------

export class ConveyorView extends MachineView<ConveyorBelt> {
  private idle = 0;
  private lastKey = '';

  redraw(): void {
    const m = this.machine;
    const g = this.g;
    const L = m.def.length;
    const T = BELT_THICKNESS;
    const top = -BELT_TOP;
    const bottom = top + T;
    const cy = BELT_CY;
    const rr = BELT_TOP; // corner radius, matches the collider
    const x1 = -L / 2 + 22;
    const x2 = L / 2 - 22;
    const off = m.disabled ? 0 : m.travel + this.idle;
    g.clear();

    const so = shadowOffset(m.rad);
    g.fillStyle(COLORS.shadow, SHADOW_ALPHA);
    g.fillRoundedRect(-L / 2 + so.x, top + so.y, L, T, rr);

    // belt loop
    roundRect(g, -L / 2, top, L, T, rr, m.disabled ? 0x6b6690 : COLORS.belt, 0);
    // inner frame
    // the belt face carries the belt's accent colour: its button at the bottom uses the same one
    g.fillStyle(m.disabled ? 0x8f8ab0 : (m.def.accent ?? COLORS.lavenderDark), 1);
    g.fillRoundedRect(-L / 2 + 9, top + 9, L - 18, T - 18, 9);
    // bright carrying surface
    g.fillStyle(m.disabled ? 0xb8b4d0 : 0x39d5ff, 1);
    g.fillRoundedRect(-L / 2 + rr - 5, top, L - rr * 2 + 10, 5, 2.5);

    // treads move along the top and return along the bottom
    const tx1 = -L / 2 + rr;
    const tx2 = L / 2 - rr;
    const gap = 16;
    g.lineStyle(2, COLORS.belt, 0.55);
    const n = Math.floor((tx2 - tx1) / gap);
    const shift = ((off % gap) + gap) % gap;
    for (let i = 0; i <= n; i++) {
      const tx = tx1 + i * gap + shift;
      if (tx <= tx2) g.lineBetween(tx, top, tx, top + 5);
      const bx = tx2 - i * gap - shift;
      g.lineStyle(2, COLORS.lavenderDark, 0.7);
      if (bx >= tx1) g.lineBetween(bx, bottom - 6, bx, bottom - 1.5);
      g.lineStyle(2, COLORS.belt, 0.55);
    }

    // rollers
    const spin = off / 11;
    for (const rx of [x1, x2]) {
      circle(g, rx, cy, 10.5, 0xffffff, 0);
      g.lineStyle(3, COLORS.lavenderDark, 1);
      g.lineBetween(rx - Math.cos(spin) * 7, cy - Math.sin(spin) * 7, rx + Math.cos(spin) * 7, cy + Math.sin(spin) * 7);
    }

    // big direction chevrons on the frame
    const dir = m.dir;
    g.lineStyle(4.5, 0xffffff, 1);
    const drift = (((off * dir) % 26) + 26) % 26;
    for (let i = -1; i <= 1; i++) {
      const cx = i * 26 + (drift - 13) * dir * 0.5;
      g.beginPath();
      g.moveTo(cx - 5 * dir, cy - 7);
      g.lineTo(cx + 4 * dir, cy);
      g.lineTo(cx - 5 * dir, cy + 7);
      g.strokePath();
    }
  }

  override update(dt: number, prep: boolean): void {
    // A slow idle crawl in the preparation phase shows which way the belt will run.
    if (prep) this.idle += this.machine.dir * dt * 0.02;
    const key = `${Math.round(this.machine.travel + this.idle)}|${this.machine.dir}|${this.machine.disabled}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.redraw();
    }
  }
}

// ---------------------------------------------------------------------------------
// Spring bumper
// ---------------------------------------------------------------------------------

export class BumperView extends MachineView<SpringBumper> {
  /** 1 right after a hit, decays to 0 */
  private punch = 0;
  private lastTick = -999;
  showAim = false;

  redraw(): void {
    const m = this.machine;
    const g = this.g;
    const p = this.punch;
    g.clear();
    const so = shadowOffset(m.rad);
    if (m.def.shape === 'round') {
      const R = m.radius;
      const k = 1 + p * 0.2;
      g.fillStyle(COLORS.shadow, SHADOW_ALPHA);
      g.fillCircle(so.x, so.y, R * k);
      g.fillStyle(darken(BUMPER, 0.35), 1);
      g.fillCircle(0, 4, R * k);
      circle(g, 0, -1, R * k - 2, mixPunch(BUMPER, p), 0);
      circle(g, 0, -1, R * 0.64 * k, 0xffffff, 0);
      star(g, 0, -1, R * 0.4 * k, BUMPER, 0);
    } else {
      const W = m.width;
      const lift = p * 9 - Math.max(0, p - 0.7) * 26; // quick squash, then pop up
      g.fillStyle(COLORS.shadow, SHADOW_ALPHA);
      g.fillRoundedRect(-W / 2 + so.x, -17 + so.y, W, 34, 10);
      // base
      roundRect(g, -W / 2 + 11, 5, W - 22, 12, 6, COLORS.belt, 0);
      // spring coils
      g.lineStyle(3.5, 0xffffff, 1);
      const top = -3 - lift;
      for (const sx of [-W * 0.26, 0, W * 0.26]) {
        g.beginPath();
        g.moveTo(sx - 9, 6);
        g.lineTo(sx + 9, 6 + (top - 6) * 0.33);
        g.lineTo(sx - 9, 6 + (top - 6) * 0.66);
        g.lineTo(sx + 9, top);
        g.strokePath();
      }
      // top plate
      g.fillStyle(darken(BUMPER, 0.35), 1);
      g.fillRoundedRect(-W / 2, -14 - lift, W, 14, 7);
      roundRect(g, -W / 2, -18 - lift, W, 14, 7, mixPunch(BUMPER, p), 0);
      g.fillStyle(0xffffff, 0.45);
      g.fillRoundedRect(-W / 2 + 11, -15 - lift, W - 22, 5, 2.5);
      if (this.showAim) {
        g.fillStyle(0xffffff, 0.85);
        for (let i = 1; i <= 4; i++) g.fillCircle(0, -26 - i * 21, 6.5 - i * 0.9);
      }
    }
  }

  setAim(on: boolean): void {
    if (this.showAim !== on) {
      this.showAim = on;
      this.redraw();
    }
  }

  override update(dt: number): void {
    const m = this.machine;
    if (m.lastBumpTick !== this.lastTick) {
      this.lastTick = m.lastBumpTick;
      if (m.lastBumpTick >= 0) this.punch = 1;
    }
    if (this.punch > 0) {
      this.punch = Math.max(0, this.punch - dt / 260);
      this.redraw();
    }
  }
}

function mixPunch(color: number, p: number): number {
  return lighten(color, Math.min(1, p) * 0.5);
}

// ---------------------------------------------------------------------------------
// Piston
// ---------------------------------------------------------------------------------

export class PistonView extends MachineView<Piston> {
  private lastExt = -1;
  private lastPhase = -1;

  redraw(): void {
    const m = this.machine;
    const g = this.g;
    const Lh = m.housingLength;
    const H = PISTON_HOUSING_H;
    const front = m.headFront();
    g.clear();

    const so = shadowOffset(m.rad);
    g.fillStyle(COLORS.shadow, SHADOW_ALPHA);
    g.fillRoundedRect(-Lh / 2 + so.x, -H / 2 + so.y, Lh, H, 10);
    g.fillRoundedRect(Lh / 2 + so.x, -32 + so.y, front - Lh / 2, 64, 7);

    // rod + bellows
    const x0 = Lh / 2 - 4;
    const x1 = front - 12;
    roundRect(g, x0 - 20, -13, x1 - x0 + 24, 26, 6, COLORS.belt, 0);
    const ribs = 5;
    for (let i = 0; i < ribs; i++) {
      const rx = x0 + 6 + ((x1 - x0 - 10) * i) / (ribs - 1);
      roundRect(g, rx - 5, -32, 10, 64, 5, COLORS.lavenderLight, 0);
    }
    // head plate
    roundRect(g, front - 18, -38, 18, 76, 8, 0xffffff, 0);

    // housing (drawn last so the ram slides out from inside it)
    g.fillStyle(COLORS.lavenderDark, 1);
    g.fillRoundedRect(-Lh / 2, -H / 2, Lh, H, 12);
    g.fillStyle(COLORS.lavender, 1);
    g.fillRoundedRect(-Lh / 2, -H / 2, Lh, H - 8, 12);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(-Lh / 2 + 8, -H / 2 + 7, Lh - 16, 8, 4);
    roundRect(g, Lh / 2 - 12, -H / 2 + 3, 12, H - 6, 5, COLORS.lavenderDark, 2.5);
    g.fillStyle(COLORS.outline, 0.55);
    for (const bx of [-Lh / 2 + 12, Lh / 2 - 24]) for (const by of [-H / 2 + 24, H / 2 - 11]) g.fillCircle(bx, by, 2.6);

    if (m.def.timing) {
      // timer dial: the wedge shows how long the piston waits before its first push
      const cx = -Lh * 0.12;
      const cy = 5;
      circle(g, cx, cy, 22, 0xffffff, 3);
      if (m.phase > 0) {
        g.fillStyle(COLORS.pink, 1);
        g.slice(cx, cy, 18, -Math.PI / 2, -Math.PI / 2 + m.phase * Math.PI * 2, false);
        g.fillPath();
      }
      g.fillStyle(COLORS.outline, 1);
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 2;
        g.fillCircle(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18, 2.2);
      }
      const ha = -Math.PI / 2 + m.phase * Math.PI * 2;
      g.lineStyle(3, COLORS.outline, 1);
      g.lineBetween(cx, cy, cx + Math.cos(ha) * 15, cy + Math.sin(ha) * 15);
      g.fillCircle(cx, cy, 3.2);
    }
  }

  override update(): void {
    const m = this.machine;
    if (m.ext !== this.lastExt || m.phase !== this.lastPhase) {
      this.lastExt = m.ext;
      this.lastPhase = m.phase;
      this.redraw();
    }
  }
}

// ---------------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------------

export class FunnelView extends MachineView<Funnel> {
  redraw(): void {
    const m = this.machine;
    const g = this.g;
    g.clear();
    const so = shadowOffset(m.rad);
    for (const [x1, y1, x2, y2] of m.segments()) {
      g.fillStyle(COLORS.shadow, SHADOW_ALPHA);
      g.fillPoints(capsulePoints(x1 + so.x, y1 + so.y, x2 + so.x, y2 + so.y, FUNNEL_WALL / 2, Math.atan2(y2 - y1, x2 - x1)), true);
    }
    for (const [x1, y1, x2, y2] of m.segments()) {
      capsule(g, x1, y1, x2, y2, FUNNEL_WALL, COLORS.mint, 3);
      // highlight stripe
      const a = Math.atan2(y2 - y1, x2 - x1);
      const nx = Math.sin(a) * 2.5 * Math.sign(x1);
      const ny = -Math.abs(Math.cos(a)) * 2.5;
      g.lineStyle(3, 0xffffff, 0.4);
      g.lineBetween(x1 + (x2 - x1) * 0.12 + nx, y1 + (y2 - y1) * 0.12 + ny, x1 + (x2 - x1) * 0.88 + nx, y1 + (y2 - y1) * 0.88 + ny);
    }
  }
}

// ---------------------------------------------------------------------------------
// Delivery bin
// ---------------------------------------------------------------------------------

export class BinView extends MachineView<DeliveryBin> {
  private front: G;
  private flash: G;
  private label: Phaser.GameObjects.Text;
  private lastTick = -999;
  private lastCount = -1;
  /** set by WorldView in a water world: the bin bobs on the waves */
  floating = false;
  private shake = { x: 0 };
  private clock = Math.random() * 3000;

  constructor(scene: Phaser.Scene, machine: DeliveryBin, private needed: number) {
    super(scene, machine);
    this.front = scene.add.graphics().setDepth(DEPTH.machineFront);
    this.flash = scene.add.graphics().setDepth(DEPTH.machineFront + 1).setAlpha(0);
    this.label = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: TEXT.white, stroke: TEXT.dark, strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(DEPTH.machineFront + 3)
      .setResolution(Math.min(3, view.res * 1.5));
    this.sync();
  }

  override sync(): void {
    super.sync();
    if (!this.front) return;
    this.place();
    this.redrawFront();
  }

  /** Stay on the bin, plus any shake; a floating bin also bobs and rocks a little on the waves. */
  private place(): void {
    const m = this.machine;
    const bob = this.floating ? Math.sin(this.clock / 480) * 4 : 0;
    const tilt = this.floating ? Math.sin(this.clock / 760) * 0.025 : 0;
    const x = m.x + this.shake.x;
    const y = m.y + bob;
    for (const o of [this.g, this.front, this.flash]) o.setPosition(x, y).setRotation(tilt);
    this.label.setPosition(x, y + 12);
  }

  redraw(): void {
    const m = this.machine;
    const g = this.g;
    const w = m.width;
    const h = m.height;
    const col = TYPE_COLORS[m.accepts];
    g.clear();
    const so = shadowOffset(0);
    g.fillStyle(COLORS.shadow, SHADOW_ALPHA);
    g.fillRoundedRect(-w / 2 + so.x, -h / 2 + so.y, w, h, 12);
    // inside (dark), visible through the opening
    roundRect(g, -w / 2, -h / 2, w, h, 14, darken(col.dark, 0.6), 0);
  }

  private redrawFront(): void {
    const m = this.machine;
    const w = m.width;
    const h = m.height;
    const col = TYPE_COLORS[m.accepts];
    const g = this.front;
    g.clear();
    const top = -h / 2 + 24;
    g.fillStyle(col.dark, 1);
    g.fillRoundedRect(-w / 2, top, w, h / 2 - top, { tl: 6, tr: 6, bl: 14, br: 14 });
    g.fillStyle(col.fill, 1);
    g.fillRoundedRect(-w / 2, top, w, h / 2 - top - 9, { tl: 6, tr: 6, bl: 14, br: 14 });
    // rim highlight + label plate
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(-w / 2 + 9, top + 7, w - 18, 6, 3);

    this.flash.clear();
    this.flash.fillStyle(0xffffff, 1);
    this.flash.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
  }

  override update(dt: number): void {
    const m = this.machine;
    this.clock += dt;
    this.place();
    if (m.correct !== this.lastCount) {
      this.lastCount = m.correct;
      this.label.setText(this.needed > 0 ? `${Math.min(m.correct, this.needed)}/${this.needed}` : m.correct > 0 ? `${m.correct}` : '');
    }
    if (m.lastTick !== this.lastTick) {
      this.lastTick = m.lastTick;
      if (m.lastTick < 0) return;
      const parts = [this.g, this.front, this.label];
      this.scene.tweens.killTweensOf(parts);
      this.scene.tweens.killTweensOf(this.flash);
      if (m.lastCorrect) {
        this.flash.setAlpha(0.75);
        this.flash.clear().fillStyle(0xffffff, 1).fillRoundedRect(-m.width / 2, -m.height / 2, m.width, m.height, 12);
        this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 380 });
        for (const p of parts) {
          const base = 1;
          p.setScale(base * 1.12, base * 0.9);
          this.scene.tweens.add({ targets: p, scaleX: base, scaleY: base, duration: 420, ease: 'Elastic.easeOut' });
        }
      } else {
        this.flash.setAlpha(0.6);
        this.flash.clear().fillStyle(COLORS.red, 1).fillRoundedRect(-m.width / 2, -m.height / 2, m.width, m.height, 12);
        this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 450 });
        this.scene.tweens.killTweensOf(this.shake);
        this.shake.x = -6;
        this.scene.tweens.add({ targets: this.shake, x: 0, duration: 380, ease: 'Elastic.easeOut' });
      }
    }
  }

  override destroy(): void {
    super.destroy();
    this.front.destroy();
    this.flash.destroy();
    this.label.destroy();
  }
}

// ---------------------------------------------------------------------------------
// Spawner (not a machine in the sim, but drawn like one)
// ---------------------------------------------------------------------------------

/** How long before a drop the next toy starts to slide out of the pipe (0.6 s). */
const PEEK_TICKS = 36;

export class SpawnerView {
  private g: G;
  /** the next toy, peeking out of the pipe mouth just before it drops */
  private peek: Phaser.GameObjects.Image;
  private peekKey = '';
  private clock = 0;
  private queue: Phaser.GameObjects.Container;
  /** which side of the pipe the preview bubble sits on, and its row (set by WorldView) */
  private slot: QueueSlot | null = null;
  private squish = 0;
  private lastTick = -999;
  private lastIndex = -1;

  constructor(
    private scene: Phaser.Scene,
    private world: FactoryWorld,
    readonly spawner: ObjectSpawner,
    private showQueue = true,
    private pipeTop = -1400,
    private colors = { body: COLORS.lavender as number, rim: COLORS.lavenderLight as number },
  ) {
    this.g = scene.add.graphics().setDepth(DEPTH.machineFront);
    // just behind the pipe, so it emerges from inside it
    this.peek = scene.add.image(0, 0, '__DEFAULT').setDepth(DEPTH.machineFront - 0.5).setVisible(false);
    this.queue = scene.add.container(0, 0).setDepth(DEPTH.machineFront + 1);
    this.redraw();
    this.refreshQueue();
  }

  private redraw(): void {
    const g = this.g;
    const { x, y } = this.spawner.def;
    const top = this.pipeTop;
    const bottom = y - 38;
    const k = this.squish;
    g.clear();
    g.fillStyle(COLORS.shadow, SHADOW_ALPHA);
    g.fillRect(x - 40 + 4, top, 80, bottom - top + 6);
    g.fillStyle(this.colors.body, 1);
    g.fillRect(x - 40, top, 80, bottom - top);
    g.fillStyle(0xffffff, 0.25);
    g.fillRect(x - 30, top, 10, bottom - top - 4);
    // rim (squishes when a toy pops out)
    const rw = 102 + k * 14;
    const rh = 20 - k * 5;
    roundRect(g, x - rw / 2, bottom - 6 + k * 4, rw, rh, 9, this.colors.rim, 0);
  }

  /** Place the preview bubble (chosen for all pipes together so bubbles never overlap). */
  setQueueSlot(slot: QueueSlot): void {
    this.slot = slot;
    this.refreshQueue();
  }

  /** Small preview of what will drop next, so players can plan. */
  private refreshQueue(): void {
    this.queue.removeAll(true);
    if (!this.showQueue) return;
    const upcoming = this.spawner.upcoming(QUEUE.max) as SpawnSpec[];
    if (upcoming.length === 0) return;
    const { x } = this.spawner.def;
    const side = this.slot?.side ?? (x > this.world.width - 160 ? -1 : 1);
    const step = QUEUE.step;
    const w = queueWidth(upcoming.length);
    const bx = x + side * (QUEUE.offset + w / 2);
    const by = HUD_H + 28 + (this.slot?.row ?? 0) * QUEUE.rowH;
    const bg = this.scene.add.graphics();
    roundRect(bg, -w / 2, -22, w, 44, 22, 0xffffff, 0, COLORS.outline, 0.95);
    this.queue.add(bg);
    upcoming.forEach((spec, i) => {
      const { type, material } = parseSpawn(spec);
      // the next toy to drop sits closest to the pipe
      const ix = side === 1 ? -w / 2 + 7 + step / 2 + i * step : w / 2 - 7 - step / 2 - i * step;
      const img = this.scene.add.image(ix, 0, toyKey(type, material)).setScale((i === 0 ? 0.46 : 0.38) / TEX_SCALE);
      if (i > 0) img.setAlpha(0.8);
      this.queue.add(img);
    });
    this.queue.setPosition(bx, by);
  }

  update(dt: number): void {
    const s = this.spawner;
    if (s.lastSpawnTick !== this.lastTick) {
      this.lastTick = s.lastSpawnTick;
      if (s.lastSpawnTick >= 0) this.squish = 1;
    }
    if (s.index !== this.lastIndex) {
      this.lastIndex = s.index;
      this.refreshQueue();
    }
    if (this.squish > 0) {
      this.squish = Math.max(0, this.squish - dt / 220);
      this.redraw();
    }
    this.updatePeek(dt);
  }

  private updatePeek(dt: number): void {
    this.clock += dt;
    const s = this.spawner;
    const next = s.upcoming(1)[0] as SpawnSpec | undefined;
    const t = s.ticksToNext();
    const p = !next || t === Infinity ? 0 : s.holding ? 1 : Phaser.Math.Clamp(1 - t / PEEK_TICKS, 0, 1);
    if (p <= 0 || !next) {
      this.peek.setVisible(false);
      return;
    }
    const { type, material } = parseSpawn(next);
    const key = toyKey(type, material);
    if (key !== this.peekKey) {
      this.peekKey = key;
      this.peek.setTexture(key).setScale(1 / TEX_SCALE);
    }
    const { x, y } = this.spawner.def;
    const bottom = y - 38;
    const calm = save.settings.reducedMotion;
    // held toys wiggle to say "I'm waiting for you"; arriving toys just slide out
    const wig = calm ? 0 : s.holding ? 1 : 0.35 * p;
    this.peek
      .setVisible(true)
      .setPosition(x + Math.sin(this.clock / 140) * 2.5 * wig, bottom - 34 + p * 50)
      .setAngle(Math.sin(this.clock / 90) * 9 * wig);
    if (s.holding && !calm) {
      this.squish = Math.max(this.squish, 0.18 + 0.12 * Math.sin(this.clock / 90));
      this.redraw();
    }
  }

  destroy(): void {
    this.peek.destroy();
    this.g.destroy();
    this.queue.destroy();
  }
}


// ---------------------------------------------------------------------------------
// Fan (world 4)
// ---------------------------------------------------------------------------------

const FAN_BODY = 0x2fa7d9;
const FAN_DARK = 0x1b6f9a;

export class FanView extends MachineView<Fan> {
  private blades: G;
  private wind: G;
  private spin = 0;
  private clock = 0;
  private shown = NaN;

  constructor(scene: Phaser.Scene, machine: Fan) {
    super(scene, machine);
    this.blades = scene.add.graphics().setDepth(DEPTH.machineBack + 1);
    this.wind = scene.add.graphics().setDepth(DEPTH.zone + 1);
  }

  override sync(): void {
    super.sync();
    if (!this.blades) return;
    this.blades.setPosition(this.machine.x, this.machine.y);
  }

  redraw(): void {
    const g = this.g;
    const r = FAN_R;
    g.clear();
    const so = shadowOffset(0);
    g.fillStyle(COLORS.shadow, SHADOW_ALPHA);
    g.fillCircle(so.x, so.y, r + 2);
    // stand + round housing with a white grille ring
    roundRect(g, -10, r - 6, 20, 18, 5, FAN_DARK, 0);
    g.fillStyle(FAN_DARK, 1);
    g.fillCircle(0, 0, r + 2);
    g.fillStyle(FAN_BODY, 1);
    g.fillCircle(0, -2, r);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(0, -2, r - 7);
    g.fillStyle(lighten(FAN_BODY, 0.55), 1);
    g.fillCircle(0, -2, r - 10);
    this.drawBlades();
  }

  private drawBlades(): void {
    const b = this.blades;
    if (!b) return;
    b.clear();
    for (let i = 0; i < 3; i++) {
      b.save();
      b.rotateCanvas((i * Math.PI * 2) / 3);
      b.fillStyle(FAN_DARK, 1);
      b.fillEllipse(0, -13, 13, 24);
      b.restore();
    }
    b.fillStyle(COLORS.white, 1);
    b.fillCircle(0, 0, 6);
    b.fillStyle(FAN_DARK, 1);
    b.fillCircle(0, 0, 3);
    b.y = this.machine.y - 2;
  }

  /** Wind streaks across the band the fan blows over (also before RUN, so the player sees where it reaches). */
  private drawWind(prep: boolean): void {
    const w = this.wind;
    w.clear();
    const m = this.machine;
    const z = m.windZone();
    if (!z) return;
    const dir = Math.sign(m.power);
    const len = z.x1 - z.x0;
    // faint band
    w.fillStyle(FAN_BODY, prep ? 0.1 : 0.06);
    w.fillRoundedRect(z.x0, z.y0, len, z.y1 - z.y0, 18);
    // streaks drifting along with the wind
    const rows = 4;
    const speed = prep ? 0.12 : 0.3;
    for (let i = 0; i < rows; i++) {
      const y = z.y0 + ((i + 0.5) * (z.y1 - z.y0)) / rows;
      for (let k = 0; k < 3; k++) {
        const t = (((this.clock * speed) / len + k / 3 + i * 0.17) % 1 + 1) % 1;
        const sx = dir > 0 ? z.x0 + t * len : z.x1 - t * len;
        const sl = 38;
        const ex = sx + dir * sl;
        if (Math.min(sx, ex) < z.x0 || Math.max(sx, ex) > z.x1) continue;
        const fade = Math.sin(t * Math.PI);
        w.lineStyle(5, FAN_BODY, 0.7 * fade);
        w.lineBetween(sx, y, ex, y);
        w.lineStyle(2, 0xffffff, 0.9 * fade);
        w.lineBetween(sx + dir * 4, y - 1, ex - dir * 8, y - 1);
      }
    }
    // chevrons at the far end show which way it blows
    const cx = dir > 0 ? z.x1 - 14 : z.x0 + 14;
    w.lineStyle(4, FAN_BODY, prep ? 0.8 : 0.45);
    for (const dy of [-16, 16]) {
      w.beginPath();
      w.moveTo(cx - dir * 10, m.y + dy - 10);
      w.lineTo(cx, m.y + dy);
      w.lineTo(cx - dir * 10, m.y + dy + 10);
      w.strokePath();
    }
  }

  override update(dt: number, prep: boolean): void {
    this.clock += dt;
    const m = this.machine;
    if (m.power !== 0) {
      this.spin += (dt / 1000) * (prep ? 3 : 14) * Math.sign(m.power);
      this.blades.setRotation(this.spin);
    }
    this.drawWind(prep);
    if (this.shown !== m.power) {
      this.shown = m.power;
      this.drawBlades();
    }
  }

  override destroy(): void {
    super.destroy();
    this.blades.destroy();
    this.wind.destroy();
  }
}

export function createMachineView(scene: Phaser.Scene, world: FactoryWorld, m: BaseMachine): MachineView {
  let v: MachineView;
  if (m instanceof ConveyorBelt) v = new ConveyorView(scene, m);
  else if (m instanceof SpringBumper) v = new BumperView(scene, m);
  else if (m instanceof Piston) v = new PistonView(scene, m);
  else if (m instanceof Funnel) v = new FunnelView(scene, m);
  else if (m instanceof Fan) v = new FanView(scene, m);
  else {
    const bin = m as DeliveryBin;
    v = new BinView(scene, bin, world.level.objective[bin.accepts] ?? 0);
  }
  v.sync();
  return v;
}
