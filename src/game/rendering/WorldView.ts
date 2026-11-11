import Phaser from 'phaser';
import { COLORS, FONT, TEXT, TYPE_COLORS, view } from '../config';
import type { FactoryObject } from '../entities/FactoryObject';
import type { BaseMachine } from '../machines/BaseMachine';
import type { DeliveryBin } from '../machines/DeliveryBin';
import type { SpringBumper } from '../machines/SpringBumper';
import type { FactoryWorld } from '../sim/FactoryWorld';
import { audio } from '../systems/AudioManager';
import { ParticleManager } from '../systems/ParticleManager';
import { save } from '../systems/SaveManager';
import { BumperView, createMachineView, DEPTH, type MachineView, SpawnerView } from './MachineViews';
import { layoutQueues } from './queueLayout';
import { ObjectView } from './ObjectView';
import { lighten, roundRect, shadowOffset, type G } from './VectorFactory';

export interface WorldViewOptions {
  /** Play sounds for physics events (off for the menu backdrop). */
  sound?: boolean;
  /** Show the upcoming-toy preview next to spawners. */
  queues?: boolean;
  /** y where spawner pipes start (default: just under the HUD bar). */
  pipeTop?: number;
  /** pipe body and rim colours (each world has its own) */
  pipe?: { body: number; rim: number };
  /** the floor is water: a missed toy splashes and sinks instead of popping */
  water?: boolean;
}

/**
 * Renders a FactoryWorld and turns its physics events into juice: squashes,
 * particles, sounds, floating numbers and (rarely) camera shake.
 */
export class WorldView {
  readonly particles: ParticleManager;
  private objViews = new Map<FactoryObject, ObjectView>();
  private machineViews = new Map<BaseMachine, MachineView>();
  private spawnerViews: SpawnerView[] = [];
  private wallG: G[] = [];
  private sound: boolean;
  private water: boolean;
  /** recent strong impacts, used to escalate feedback during chain reactions */
  private chain = 0;
  private chainDecay = 0;
  private streak = 0;
  private lastBumped: FactoryObject | null = null;

  constructor(
    private scene: Phaser.Scene,
    readonly world: FactoryWorld,
    opts: WorldViewOptions = {},
  ) {
    this.sound = opts.sound ?? true;
    this.water = opts.water ?? false;
    this.particles = new ParticleManager(scene, DEPTH.fx);
    this.drawWalls();
    for (const m of world.machines) this.machineViews.set(m, createMachineView(scene, world, m));
    for (const s of world.spawners) this.spawnerViews.push(new SpawnerView(scene, world, s, opts.queues ?? true, opts.pipeTop, opts.pipe));
    // preview bubbles: pick sides for all pipes together so they never overlap a pipe or each other
    const slots = layoutQueues(world.spawners.map((s) => ({ x: s.def.x, toys: s.def.sequence.length })), world.width);
    this.spawnerViews.forEach((v, i) => v.setQueueSlot(slots[i]));
    this.bind();
  }

  private drawWalls(): void {
    for (const w of this.world.level.walls) {
      const g = this.scene.add.graphics().setDepth(DEPTH.walls).setPosition(w.x, w.y);
      const rad = ((w.angle ?? 0) * Math.PI) / 180;
      g.setRotation(rad);
      const r = Math.min(9, Math.min(w.w, w.h) / 2);
      const so = shadowOffset(rad);
      g.fillStyle(COLORS.shadow, 0.24);
      g.fillRoundedRect(-w.w / 2 + so.x, -w.h / 2 + so.y, w.w, w.h, r);
      roundRect(g, -w.w / 2, -w.h / 2, w.w, w.h, r, COLORS.outline, 0);
      // lit edge
      g.fillStyle(COLORS.lavenderDark, 1);
      if (w.w >= w.h) g.fillRoundedRect(-w.w / 2, -w.h / 2, w.w, Math.min(7, w.h / 2), Math.min(r, 3.5));
      else g.fillRoundedRect(-w.w / 2, -w.h / 2, Math.min(7, w.w / 2), w.h, Math.min(r, 3.5));
      // candy stripes
      g.lineStyle(5, COLORS.lavender, 0);
      const long = Math.max(w.w, w.h);
      const horizontal = w.w >= w.h;
      for (let d = -long / 2 + 16; d < long / 2 - 10; d += 26) {
        if (horizontal) g.lineBetween(d, w.h / 2 - 5, d + Math.min(10, w.h - 10), -w.h / 2 + 5);
        else g.lineBetween(-w.w / 2 + 5, d + Math.min(10, w.w - 10), w.w / 2 - 5, d);
      }
      this.wallG.push(g);
    }
  }

  private bind(): void {
    const ev = this.world.events;
    const p = this.particles;

    ev.on('spawn', (obj: FactoryObject) => {
      this.objViews.set(obj, new ObjectView(this.scene, obj, this.world.height));
      p.puff(obj.x, obj.y + 6, 2);
      if (this.sound) audio.spawn();
    });

    ev.on('impact', (obj: FactoryObject, speed: number, other: FactoryObject | null) => {
      const v = this.objViews.get(obj);
      if (!v) return;
      v.impact(speed);
      if (speed > 3.2) {
        if (this.sound) audio.pop(speed);
        if (speed > 7) p.puff(obj.x, obj.y + 10, 2);
        if (other && speed > 5) {
          // toy-on-toy collisions feed the chain meter
          this.bumpChain();
          p.sparkle((obj.x + other.x) / 2, (obj.y + other.y) / 2, 0xffffff, 2);
        }
        if (speed > 15) this.shake(0.0025, 90);
      }
    });

    ev.on('bump', (bumper: SpringBumper, obj: FactoryObject) => {
      const v = this.objViews.get(obj);
      v?.impact(12);
      v?.setExpression('surprised', 520);
      p.ring(bumper.x, bumper.y, COLORS.pink);
      p.burst(obj.x, obj.y, COLORS.pink, 5);
      p.sparkle(obj.x, obj.y, COLORS.yellow, 2);
      // repeated bounces of the same toy on the same spring are not a chain
      if (obj !== this.lastBumped) this.bumpChain();
      this.lastBumped = obj;
      if (this.sound) audio.boing(1 + Math.min(4, this.chain) * 0.06);
    });

    ev.on('pistonFire', () => {
      if (this.sound) audio.thunk();
    });

    ev.on('conveyorFlip', () => {
      if (this.sound) audio.flip();
    });

    ev.on('deliver', (obj: FactoryObject, bin: DeliveryBin, correct: boolean) => {
      const v = this.objViews.get(obj);
      this.objViews.delete(obj);
      v?.finish(this.scene, correct ? 'correct' : 'wrong', bin.x, bin.y + 8);
      const topY = bin.y - bin.height / 2;
      if (correct) {
        this.streak++;
        const col = TYPE_COLORS[obj.type];
        p.burst(bin.x, topY, col.fill, 12);
        p.sparkle(bin.x, topY - 4, COLORS.yellow, 5);
        this.floatText(bin.x, topY - 14, '+1', '#3fae7c');
        if (this.sound) audio.ding(this.streak - 1);
      } else {
        this.streak = 0;
        p.burst(bin.x, topY, COLORS.red, 6);
        this.floatText(bin.x, topY - 14, 'Oops!', '#e2566b');
        if (this.sound) audio.buzz();
        this.shake(0.002, 110);
      }
    });

    ev.on('lost', (obj: FactoryObject) => {
      const v = this.objViews.get(obj);
      this.objViews.delete(obj);
      if (obj.missed && v && this.water) {
        const { x, y } = obj;
        v.sinkMissed(this.scene);
        p.burst(x, y + 16, 0x58c0ef, 14);
        p.burst(x, y + 16, 0xffffff, 6);
        if (this.sound) this.floatText(x, y - 46, 'splash!', '#2A86C2', 20);
        if (this.sound) audio.drop();
        return;
      }
      if (obj.missed && v) {
        const { x, y } = obj;
        v.popMissed(this.scene, () => {
          p.burst(x, y, TYPE_COLORS[obj.type].fill, 12);
          p.puff(x, y + 20, 3);
        });
        if (this.sound) this.floatText(x, y - 46, 'miss!', '#FF4D5E', 20);
        if (this.sound) audio.drop();
        return;
      }
      const x = Phaser.Math.Clamp(obj.x, 30, this.world.width - 30);
      v?.finish(this.scene, 'lost', x, this.world.height);
      p.puff(x, this.world.height - 8, 4);
      if (this.sound) this.floatText(x, this.world.height - 36, 'bye!', '#7A56F0', 17);
      if (this.sound) audio.drop();
    });

    ev.on('cleared', () => {
      for (const v of this.objViews.values()) v.destroy();
      this.objViews.clear();
      this.streak = 0;
      this.chain = 0;
    });

    ev.on('machineChanged', (m: BaseMachine) => this.machineViews.get(m)?.sync());
  }

  private bumpChain(): void {
    this.chain++;
    this.chainDecay = 900;
    if (this.chain === 4 || this.chain === 8) {
      this.scene.events.emit('chain', this.chain);
    }
  }

  shake(intensity: number, duration: number): void {
    if (save.settings.reducedShake) return;
    this.scene.cameras.main.shake(duration, intensity, false);
  }

  floatText(x: number, y: number, text: string, color: string, size = 22): void {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#ffffff', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(DEPTH.float)
      .setResolution(Math.min(3, view.res * 1.5));
    t.setScale(0.4);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, y: y - 42, alpha: 0, duration: 650, delay: 220, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
  }

  /** Play the little pop on a machine the player just changed. */
  popMachine(m: BaseMachine): void {
    this.machineViews.get(m)?.pop();
  }

  viewOf(m: BaseMachine): MachineView | undefined {
    return this.machineViews.get(m);
  }

  /** Show the aim dots on a pad bumper (only while it is selected). */
  setAim(m: BaseMachine | null): void {
    for (const [machine, v] of this.machineViews) if (v instanceof BumperView) v.setAim(machine === m);
  }

  get toyCount(): number {
    return this.objViews.size;
  }

  update(dt: number, prep: boolean): void {
    if (this.chainDecay > 0) {
      this.chainDecay -= dt;
      if (this.chainDecay <= 0) this.chain = 0;
    }
    for (const v of this.machineViews.values()) v.update(dt, prep);
    for (const s of this.spawnerViews) s.update(dt);
    for (const v of this.objViews.values()) v.update(dt);
  }

  destroy(): void {
    for (const v of this.objViews.values()) v.destroy();
    for (const v of this.machineViews.values()) v.destroy();
    for (const s of this.spawnerViews) s.destroy();
    for (const g of this.wallG) g.destroy();
    this.objViews.clear();
    this.machineViews.clear();
    this.particles.destroy();
  }
}
