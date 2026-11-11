import { msToTicks } from '../config';
import type { MachineConfig, PistonDef } from '../levels/LevelTypes';
import { FILTER } from '../physics/CollisionCategories';
import { M, type Body } from '../physics/MatterLib';
import { BaseMachine } from './BaseMachine';

export const PISTON_HOUSING_H = 92;
export const PISTON_HEAD_H = 72;
const HOLD_TICKS = 12;
const RETRACT_TICKS = 30;

/**
 * Piston: a ram that slides out of its housing along the machine's angle
 * (0 deg = pushes right). The ram is a static body that is moved a little each
 * tick *with* a matching velocity, so Matter transfers momentum to whatever it
 * pushes and nothing is teleported through.
 *
 * The ram body is as long as the stroke, so an object can never drop behind
 * the head and get crushed on the way back.
 */
export class Piston extends BaseMachine<PistonDef> {
  /** 0 = retracted, 1 = fully extended */
  ext = 0;
  phase: number;
  private head: Body | null = null;
  private cycleStart = -1;
  /** tick the current push started (view: recoil animation) */
  lastFireTick = -999;

  constructor(world: BaseMachine['world'], def: PistonDef) {
    super(world, def);
    this.phase = def.phase ?? 0;
  }

  get stroke(): number {
    return this.def.stroke ?? 110;
  }
  get periodTicks(): number {
    return msToTicks(this.def.period ?? 3000);
  }
  get extendTicks(): number {
    return this.def.extendTicks ?? 22;
  }
  get housingLength(): number {
    return this.stroke + 30;
  }
  get ramLength(): number {
    return this.stroke + 24;
  }

  /** Local x of the ram centre for a given extension. */
  private ramCentre(ext: number): number {
    return this.housingLength / 2 + 16 - this.ramLength / 2 + ext * this.stroke;
  }

  /** Local x of the head's front face (for the view). */
  headFront(): number {
    return this.housingLength / 2 + 16 + this.ext * this.stroke;
  }

  protected buildBodies(): void {
    const opts = { isStatic: true, angle: this.rad, friction: 0.3, restitution: 0.05, collisionFilter: { ...FILTER.machine } };
    this.addBody(
      M.Bodies.rectangle(this.x, this.y, this.housingLength, PISTON_HOUSING_H, { ...opts, chamfer: { radius: 8 } }),
      'housing',
    );
    const c = this.toWorld(this.ramCentre(this.ext), 0);
    this.head = this.addBody(
      M.Bodies.rectangle(c.x, c.y, this.ramLength, PISTON_HEAD_H, { ...opts, chamfer: { radius: 6 } }),
      'head',
    );
  }

  extents(): { hw: number; hh: number } {
    return { hw: this.housingLength / 2 + 16, hh: PISTON_HOUSING_H / 2 };
  }

  override get canTime(): boolean {
    return !!this.def.timing;
  }

  /** Number of timer settings a tap cycles through. */
  get timingSteps(): number {
    return Math.max(2, this.def.timingSteps ?? 4);
  }

  /** Every timer setting (fraction of the period before the first push). */
  phaseOptions(): number[] {
    const n = this.timingSteps;
    return Array.from({ length: n }, (_, i) => i / n);
  }

  /** Move the timer on one step (wraps). */
  cycleTiming(): void {
    const n = this.timingSteps;
    this.phase = ((Math.round(this.phase * n) + 1) % n) / n;
    this.world.events.emit('machineChanged', this);
  }

  /** Trigger one push right now (interactive pistons). */
  fire(): void {
    if (this.cycleStart >= 0 && this.world.tick - this.cycleStart < this.extendTicks + HOLD_TICKS + RETRACT_TICKS) return;
    this.cycleStart = this.world.tick;
    this.lastFireTick = this.world.tick;
    this.world.events.emit('pistonFire', this);
  }

  override update(tick: number): void {
    if (!this.active || !this.head) return;
    if (!this.disabled) {
      const period = this.periodTicks;
      const t0 = Math.round(this.phase * period) + 30; // small lead-in after Run
      if (tick >= t0 && (tick - t0) % period === 0) this.fire();
    }

    let ext = 0;
    if (this.cycleStart >= 0) {
      const t = tick - this.cycleStart;
      const e = this.extendTicks;
      if (t < e) {
        const k = (t + 1) / e;
        ext = 1 - (1 - k) * (1 - k); // fast start, soft landing
      } else if (t < e + HOLD_TICKS) {
        ext = 1;
      } else if (t < e + HOLD_TICKS + RETRACT_TICKS) {
        const k = (t - e - HOLD_TICKS + 1) / RETRACT_TICKS;
        ext = 1 - k * k * (3 - 2 * k);
      } else {
        this.cycleStart = -1;
      }
    }
    this.ext = ext;
    const c = this.toWorld(this.ramCentre(ext), 0);
    // updateVelocity = true -> the solver sees the ram as moving and pushes objects properly.
    M.Body.setPosition(this.head, c, true);
  }

  override reset(): void {
    super.reset();
    this.ext = 0;
    this.cycleStart = -1;
    this.lastFireTick = -999;
    if (this.head) {
      const c = this.toWorld(this.ramCentre(0), 0);
      M.Body.setPosition(this.head, c, false);
      M.Body.setPosition(this.head, c, true);
    }
  }

  override getConfig(): MachineConfig {
    return { ...super.getConfig(), phase: this.phase };
  }

  override applyConfig(c: MachineConfig): void {
    super.applyConfig(c);
    if (c.phase !== undefined && c.phase !== this.phase) {
      this.phase = c.phase;
      this.world.events.emit('machineChanged', this);
    }
  }
}
