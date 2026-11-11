import { msToTicks, type ObjType } from '../config';
import type { FactoryObject } from '../entities/FactoryObject';
import type { BinDef } from '../levels/LevelTypes';
import { FILTER } from '../physics/CollisionCategories';
import { M } from '../physics/MatterLib';
import { BaseMachine } from './BaseMachine';

export const BIN_WALL = 16;

/**
 * Delivery bin: a U-shaped container with a sensor deep inside. Because the
 * sensor sits below the rim and between the walls, objects brushing the
 * outside can never be counted. Each object is counted exactly once.
 */
export class DeliveryBin extends BaseMachine<BinDef> {
  correct = 0;
  wrong = 0;
  /** tick + result of the last delivery (view animation) */
  lastTick = -999;
  lastCorrect = true;

  get accepts(): ObjType {
    return this.def.accepts;
  }
  get width(): number {
    return this.def.width ?? 196;
  }
  get height(): number {
    return this.def.height ?? 140;
  }

  protected buildBodies(): void {
    const w = this.width;
    const h = this.height;
    const wall = { isStatic: true, friction: 0.2, restitution: 0.1, collisionFilter: { ...FILTER.machine }, chamfer: { radius: 4 } };
    const add = (lx: number, ly: number, bw: number, bh: number, role: string, extra: object = {}) => {
      const p = this.toWorld(lx, ly);
      this.addBody(M.Bodies.rectangle(p.x, p.y, bw, bh, { ...wall, angle: this.rad, ...extra }), role);
    };
    add(-w / 2 + BIN_WALL / 2, 0, BIN_WALL, h, 'wall');
    add(w / 2 - BIN_WALL / 2, 0, BIN_WALL, h, 'wall');
    add(0, h / 2 - BIN_WALL / 2, w, BIN_WALL, 'wall');
    // Sensor: lower half of the interior.
    add(0, h * 0.14, w - BIN_WALL * 2 - 8, h * 0.44, 'sensor', {
      isSensor: true,
      chamfer: undefined,
      collisionFilter: { ...FILTER.sensor },
    });
  }

  extents(): { hw: number; hh: number } {
    return { hw: this.width / 2, hh: this.height / 2 };
  }

  /** Where a floating bin is at a given tick of the run (its own x if it does not float). */
  driftX(tick: number): number {
    const d = this.def.drift;
    if (!d) return this.def.x;
    return this.def.x + d.range * Math.sin(2 * Math.PI * (tick / msToTicks(d.period) + (d.phase ?? 0)));
  }

  /** Slide the whole bin (walls and sensor) sideways. */
  private slideTo(x: number): void {
    const dx = x - this.x;
    if (dx === 0) return;
    for (const b of this.bodies) M.Body.setPosition(b, { x: b.position.x + dx, y: b.position.y });
    this.x = x;
  }

  override create(): void {
    super.create();
    this.slideTo(this.driftX(0));
  }

  override update(tick: number): void {
    if (this.def.drift) this.slideTo(this.driftX(tick));
  }

  override onContact(obj: FactoryObject, role: string): void {
    if (role !== 'sensor' || obj.state !== 'active') return;
    const ok = obj.type === this.accepts;
    if (ok) this.correct++;
    else this.wrong++;
    this.lastTick = this.world.tick;
    this.lastCorrect = ok;
    this.world.deliver(obj, this, ok);
  }

  override reset(): void {
    super.reset();
    this.slideTo(this.driftX(0));
    this.correct = 0;
    this.wrong = 0;
    this.lastTick = -999;
  }
}
