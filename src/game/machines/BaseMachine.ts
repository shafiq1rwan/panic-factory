import type { FactoryObject } from '../entities/FactoryObject';
import type { MachineConfig, MachineDef } from '../levels/LevelTypes';
import { M, type Body } from '../physics/MatterLib';
import type { FactoryWorld } from '../sim/FactoryWorld';

export const DEG = Math.PI / 180;

/**
 * Base class for every factory machine (simulation side).
 *
 * Lifecycle: create -> (activate -> update* -> deactivate) -> reset -> destroy.
 * Rendering lives in rendering/MachineViews.ts and only reads machine state.
 */
export abstract class BaseMachine<D extends MachineDef = MachineDef> {
  bodies: Body[] = [];
  x: number;
  y: number;
  /** degrees */
  angle: number;
  active = false;
  /** Temporarily powered off (Panic mode malfunction). */
  disabled = false;

  constructor(
    readonly world: FactoryWorld,
    readonly def: D,
  ) {
    this.x = def.x;
    this.y = def.y;
    this.angle = def.angle ?? 0;
  }

  get id(): string {
    return this.def.id;
  }
  get kind(): D['kind'] {
    return this.def.kind;
  }
  get rad(): number {
    return this.angle * DEG;
  }

  create(): void {
    this.buildBodies();
  }

  /** Create the Matter bodies for the current x / y / angle. */
  protected abstract buildBodies(): void;

  /** Half extents in machine-local space, used for hit testing and zone drawing. */
  abstract extents(): { hw: number; hh: number };

  protected addBody(body: Body, role: string): Body {
    body.ref = { kind: 'machine', machine: this, role };
    M.Composite.add(this.world.engine.world, body);
    this.bodies.push(body);
    return body;
  }

  protected removeBodies(): void {
    for (const b of this.bodies) M.Composite.remove(this.world.engine.world, b);
    this.bodies.length = 0;
  }

  /** Local (machine space) -> world coordinates. */
  toWorld(lx: number, ly: number): { x: number; y: number } {
    const c = Math.cos(this.rad);
    const s = Math.sin(this.rad);
    return { x: this.x + lx * c - ly * s, y: this.y + lx * s + ly * c };
  }

  /** World -> local (machine space) coordinates. */
  toLocal(wx: number, wy: number): { x: number; y: number } {
    const c = Math.cos(this.rad);
    const s = Math.sin(this.rad);
    const dx = wx - this.x;
    const dy = wy - this.y;
    return { x: dx * c + dy * s, y: -dx * s + dy * c };
  }

  hitTest(wx: number, wy: number, pad = 10): boolean {
    const p = this.toLocal(wx, wy);
    const e = this.extents();
    return Math.abs(p.x) <= e.hw + pad && Math.abs(p.y) <= e.hh + pad;
  }

  /** Move / rotate the machine (preparation phase only). */
  setTransform(x: number, y: number, angle: number): void {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.removeBodies();
    this.buildBodies();
    this.world.events.emit('machineChanged', this);
  }

  /** Called once per tick before the physics step while the factory runs. */
  update(_tick: number): void {}

  /** Called once per tick for every object touching one of this machine's bodies. */
  onContact(_obj: FactoryObject, _role: string): void {}

  activate(): void {
    this.active = true;
  }

  deactivate(): void {
    this.active = false;
  }

  /** Return to the idle preparation state (keeps player configuration). */
  reset(): void {
    this.active = false;
    this.disabled = false;
  }

  destroy(): void {
    this.removeBodies();
  }

  // --- player configuration -------------------------------------------------

  get canMove(): boolean {
    return !!this.def.movable && !!this.def.zone;
  }
  get canRotate(): boolean {
    return !!this.def.rotatable;
  }
  get canFlip(): boolean {
    return false;
  }
  get canTime(): boolean {
    return false;
  }
  get configurable(): boolean {
    return this.canMove || this.canRotate || this.canFlip || this.canTime;
  }

  getConfig(): MachineConfig {
    return { x: this.x, y: this.y, angle: this.angle };
  }

  applyConfig(c: MachineConfig): void {
    const x = c.x ?? this.x;
    const y = c.y ?? this.y;
    const a = c.angle ?? this.angle;
    if (x !== this.x || y !== this.y || a !== this.angle) this.setTransform(x, y, a);
  }

  /** Next allowed angle when rotating by one step in `dir` (wraps inside min/max). */
  steppedAngle(dir: 1 | -1): number {
    const step = this.def.angleStep ?? 15;
    const min = this.def.angleMin ?? -45;
    const max = this.def.angleMax ?? 45;
    let a = this.angle + dir * step;
    if (a > max) a = max;
    if (a < min) a = min;
    return a;
  }
}
