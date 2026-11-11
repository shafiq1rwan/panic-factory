import type { FanDef, MachineConfig } from '../levels/LevelTypes';
import { FILTER } from '../physics/CollisionCategories';
import { M } from '../physics/MatterLib';
import { MATERIALS } from '../physics/PhysicsMaterials';
import { BaseMachine } from './BaseMachine';

/** Housing size (the round fan the player taps). */
export const FAN_R = 34;
/** Wind push on a standard toy, px / tick per tick. Heavier toys get less, lighter ones more. */
const DEFAULT_STRENGTH = 0.3;
/** Fastest sideways speed the wind can give (px / tick). */
const MAX_WIND_SPEED = 9;
const STANDARD_DENSITY = MATERIALS.standard.density;

/**
 * Fan (world 4): blows sideways across a band of the room while the factory runs.
 * A tap moves it to the next of its `powers`: 0 is off, 1 blows right, -1 blows left.
 * The push scales with 1 / density, so heavy toys barely move and light ones fly far.
 */
export class Fan extends BaseMachine<FanDef> {
  power: number;

  constructor(world: ConstructorParameters<typeof BaseMachine<FanDef>>[0], def: FanDef) {
    super(world, def);
    this.power = def.power ?? def.powers[0] ?? 0;
  }

  override get canBlow(): boolean {
    return this.def.powers.length > 1;
  }

  get band(): number {
    return this.def.band ?? 150;
  }

  protected buildBodies(): void {
    this.addBody(
      M.Bodies.circle(this.x, this.y, FAN_R, { isStatic: true, friction: 0.2, restitution: 0.2, collisionFilter: { ...FILTER.machine } }),
      'housing',
    );
  }

  extents(): { hw: number; hh: number } {
    return { hw: FAN_R, hh: FAN_R };
  }

  /** The wind band for a setting (null when off). */
  windZone(power = this.power): { x0: number; x1: number; y0: number; y1: number } | null {
    if (!power) return null;
    const near = this.x + Math.sign(power) * FAN_R;
    const far = near + Math.sign(power) * this.def.reach;
    return { x0: Math.min(near, far), x1: Math.max(near, far), y0: this.y - this.band / 2, y1: this.y + this.band / 2 };
  }

  override update(): void {
    const z = this.windZone();
    if (!z || this.disabled) return;
    const push = Math.sign(this.power) * (this.def.strength ?? DEFAULT_STRENGTH);
    for (const o of this.world.objects) {
      if (o.state !== 'active' || o.x < z.x0 || o.x > z.x1 || o.y < z.y0 || o.y > z.y1) continue;
      const b = o.body;
      const k = STANDARD_DENSITY / MATERIALS[o.material].density;
      let vx = b.velocity.x + push * k;
      if (Math.abs(vx) > MAX_WIND_SPEED && Math.sign(vx) === Math.sign(push)) vx = Math.sign(vx) * Math.max(MAX_WIND_SPEED, Math.abs(b.velocity.x));
      M.Body.setVelocity(b, { x: vx, y: b.velocity.y });
    }
  }

  /** Every setting the player can choose, in tap order. */
  powerOptions(): number[] {
    return [...this.def.powers];
  }

  /** A tap: the next setting, wrapping round. */
  nextPower(): void {
    const opts = this.def.powers;
    const i = opts.indexOf(this.power);
    this.power = opts[(i + 1) % opts.length];
    this.world.events.emit('machineChanged', this);
  }

  override getConfig(): MachineConfig {
    return { power: this.power };
  }

  override applyConfig(c: MachineConfig): void {
    if (c.power !== undefined && this.def.powers.includes(c.power)) this.power = c.power;
  }
}
