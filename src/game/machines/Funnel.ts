import type { FunnelDef } from '../levels/LevelTypes';
import { FILTER } from '../physics/CollisionCategories';
import { M } from '../physics/MatterLib';
import { BaseMachine } from './BaseMachine';

export const FUNNEL_WALL = 20;

/** Passive funnel: two static angled walls that objects slide down. */
export class Funnel extends BaseMachine<FunnelDef> {
  get topWidth(): number {
    return this.def.topWidth ?? 220;
  }
  get bottomWidth(): number {
    return this.def.bottomWidth ?? 70;
  }
  get height(): number {
    return this.def.height ?? 100;
  }

  /** Wall segments in local space: [x1, y1, x2, y2]. Shared with the view. */
  segments(): [number, number, number, number][] {
    const t = this.topWidth / 2;
    const b = this.bottomWidth / 2;
    const h = this.height / 2;
    return [
      [-t, -h, -b, h],
      [t, -h, b, h],
    ];
  }

  protected buildBodies(): void {
    for (const [x1, y1, x2, y2] of this.segments()) {
      const a = this.toWorld(x1, y1);
      const b = this.toWorld(x2, y2);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const body = M.Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, len + FUNNEL_WALL * 0.6, FUNNEL_WALL, {
        isStatic: true,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        chamfer: { radius: FUNNEL_WALL / 2 - 1 },
        friction: 0.02,
        frictionStatic: 0.02,
        restitution: 0.15,
        collisionFilter: { ...FILTER.machine },
      });
      this.addBody(body, 'funnel');
    }
  }

  extents(): { hw: number; hh: number } {
    return { hw: this.topWidth / 2, hh: this.height / 2 };
  }
}
