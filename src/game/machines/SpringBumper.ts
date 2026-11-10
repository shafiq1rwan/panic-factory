import type { FactoryObject } from '../entities/FactoryObject';
import type { BumperDef } from '../levels/LevelTypes';
import { FILTER } from '../physics/CollisionCategories';
import { M } from '../physics/MatterLib';
import { MATERIALS } from '../physics/PhysicsMaterials';
import { BaseMachine } from './BaseMachine';

export const PAD_THICKNESS = 34;
const COOLDOWN_TICKS = 10;

/**
 * Spring bumper.
 *  - round: launches objects directly away from its centre.
 *  - pad:   launches objects along the pad's surface normal (aimable by rotating).
 * The launch speed is fixed (scaled by material), which keeps trajectories predictable.
 */
export class SpringBumper extends BaseMachine<BumperDef> {
  /** tick of the last launch, for the view's compression animation */
  lastBumpTick = -999;

  get power(): number {
    return this.def.power ?? 11;
  }
  get radius(): number {
    return this.def.radius ?? 42;
  }
  get width(): number {
    return this.def.width ?? 150;
  }

  protected buildBodies(): void {
    const common = {
      isStatic: true,
      friction: 0.2,
      restitution: 0.4,
      collisionFilter: { ...FILTER.machine },
    };
    if (this.def.shape === 'round') {
      this.addBody(M.Bodies.circle(this.x, this.y, this.radius, common), 'bumper');
    } else {
      this.addBody(
        M.Bodies.rectangle(this.x, this.y, this.width, PAD_THICKNESS, {
          ...common,
          angle: this.rad,
          chamfer: { radius: 9 },
        }),
        'bumper',
      );
    }
  }

  extents(): { hw: number; hh: number } {
    return this.def.shape === 'round'
      ? { hw: this.radius, hh: this.radius }
      : { hw: this.width / 2, hh: PAD_THICKNESS / 2 + 6 };
  }

  override onContact(obj: FactoryObject): void {
    if (obj.bumpCooldown > 0 || this.disabled) return;
    let nx: number;
    let ny: number;
    let keep: number;
    if (this.def.shape === 'round') {
      const dx = obj.x - this.x;
      const dy = obj.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      nx = dx / d;
      ny = dy / d;
      keep = 0.55;
    } else {
      // Pad normal = local "up".
      nx = Math.sin(this.rad);
      ny = -Math.cos(this.rad);
      const side = (obj.x - this.x) * nx + (obj.y - this.y) * ny;
      if (side < PAD_THICKNESS / 2 - 2) return; // touching an edge or the underside
      keep = 0.2;
    }
    const body = obj.body;
    const vn = body.velocity.x * nx + body.velocity.y * ny;
    const tx = body.velocity.x - vn * nx;
    const ty = body.velocity.y - vn * ny;
    const launch = this.power * MATERIALS[obj.material].launch;
    M.Body.setVelocity(body, { x: tx * keep + nx * launch, y: ty * keep + ny * launch });
    obj.bumpCooldown = COOLDOWN_TICKS;
    this.lastBumpTick = this.world.tick;
    this.world.events.emit('bump', this, obj);
  }
}
