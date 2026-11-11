import type { FactoryObject } from '../entities/FactoryObject';
import type { ConveyorDef, MachineConfig } from '../levels/LevelTypes';
import { FILTER } from '../physics/CollisionCategories';
import { M } from '../physics/MatterLib';
import { MATERIALS } from '../physics/PhysicsMaterials';
import { BaseMachine } from './BaseMachine';

/** Chunky belt body: easy to see and to tap. */
export const BELT_THICKNESS = 54;
/** The carrying surface sits this far above the machine origin (the body hangs below it). */
export const BELT_TOP = 14;
/** Local y of the belt body centre. */
export const BELT_CY = BELT_THICKNESS / 2 - BELT_TOP;
/** Max change in along-belt speed per tick: keeps belts from injecting sudden energy. */
const BELT_ACCEL = 0.8;

/**
 * Conveyor belt. Objects resting on the top surface are accelerated towards
 * the belt speed along the belt direction (contact based: only bodies that are
 * actually touching the belt are affected). Works at any rotation.
 */
export class ConveyorBelt extends BaseMachine<ConveyorDef> {
  dir: 1 | -1;
  /** Accumulated belt travel in px, for the view's belt animation. */
  travel = 0;

  constructor(world: BaseMachine['world'], def: ConveyorDef) {
    super(world, def);
    this.dir = def.dir ?? 1;
  }

  protected buildBodies(): void {
    const c = this.toWorld(0, BELT_CY);
    const body = M.Bodies.rectangle(c.x, c.y, this.def.length, BELT_THICKNESS, {
      isStatic: true,
      angle: this.rad,
      chamfer: { radius: BELT_TOP - 1 },
      friction: 0.05,
      frictionStatic: 0.05,
      restitution: 0.05,
      collisionFilter: { ...FILTER.machine },
    });
    this.addBody(body, 'belt');
  }

  extents(): { hw: number; hh: number } {
    // symmetric around the origin and tall enough to cover the whole body: a generous tap target
    return { hw: this.def.length / 2, hh: BELT_THICKNESS - BELT_TOP };
  }

  /** Signed surface speed in px / tick (0 when idle or powered off). */
  get surfaceSpeed(): number {
    if (!this.active || this.disabled) return 0;
    return this.def.speed * this.dir * this.world.machineSpeedScale;
  }

  override get canFlip(): boolean {
    return !!this.def.flippable;
  }

  flip(): void {
    this.dir = this.dir === 1 ? -1 : 1;
    this.world.flipCount++;
    this.world.events.emit('conveyorFlip', this);
    this.world.events.emit('machineChanged', this);
  }

  override update(): void {
    this.travel += this.surfaceSpeed;
  }

  override onContact(obj: FactoryObject): void {
    if (!this.active) return;
    const p = this.toLocal(obj.x, obj.y);
    // Only objects sitting on the top surface are carried (not ones hitting the ends or underside).
    if (p.y > -BELT_TOP + 4 || Math.abs(p.x) > this.def.length / 2 + 4) return;

    const tx = Math.cos(this.rad);
    const ty = Math.sin(this.rad);
    const body = obj.body;
    const grip = MATERIALS[obj.material].grip;
    const along = body.velocity.x * tx + body.velocity.y * ty;
    const target = this.surfaceSpeed;
    let dv = target - along;
    const maxDv = BELT_ACCEL * grip;
    if (dv > maxDv) dv = maxDv;
    else if (dv < -maxDv) dv = -maxDv;
    // Rubber belts are grippy: soak up most of the bounce away from the surface so
    // objects settle onto the belt instead of skipping along it.
    const nx = ty;
    const ny = -tx;
    const away = body.velocity.x * nx + body.velocity.y * ny;
    const damp = away > 0 ? -away * 0.6 : 0;
    if (dv !== 0 || damp !== 0) {
      M.Body.setVelocity(body, {
        x: body.velocity.x + tx * dv + nx * damp,
        y: body.velocity.y + ty * dv + ny * damp,
      });
    }
    // Round things roll with the belt.
    if (body.circleRadius) {
      const roll = (along + dv) / body.circleRadius;
      M.Body.setAngularVelocity(body, body.angularVelocity + (roll - body.angularVelocity) * 0.25);
    }
  }

  override reset(): void {
    super.reset();
  }

  override getConfig(): MachineConfig {
    return { ...super.getConfig(), dir: this.dir };
  }

  override applyConfig(c: MachineConfig): void {
    super.applyConfig(c);
    if (c.dir !== undefined && c.dir !== this.dir) {
      this.dir = c.dir;
      this.world.events.emit('machineChanged', this);
    }
  }
}
