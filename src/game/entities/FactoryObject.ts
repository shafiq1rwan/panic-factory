import type { ObjType } from '../config';
import { FILTER } from '../physics/CollisionCategories';
import { M, type Body } from '../physics/MatterLib';
import { MATERIALS, type MaterialId } from '../physics/PhysicsMaterials';

/** Base collider sizes (before material scale). Visuals in Textures.ts use the same numbers. */
export const OBJ_SHAPE = {
  blue: { radius: 30 },
  pink: { size: 54, chamfer: 12 },
  yellow: { radius: 39, chamfer: 10 },
  green: { radius: 33, chamfer: 7 },
} as const;

export type ObjectState = 'active' | 'delivered' | 'lost';

function createBody(type: ObjType, material: MaterialId, x: number, y: number): Body {
  const mat = MATERIALS[material];
  const s = mat.scale;
  const opts = {
    density: mat.density,
    friction: mat.friction,
    frictionStatic: mat.frictionStatic,
    frictionAir: mat.frictionAir,
    restitution: mat.restitution,
    collisionFilter: { ...FILTER.object },
    slop: 0.04,
  };
  let body: Body;
  switch (type) {
    case 'blue':
      body = M.Bodies.circle(x, y, OBJ_SHAPE.blue.radius * s, opts);
      break;
    case 'pink':
      body = M.Bodies.rectangle(x, y, OBJ_SHAPE.pink.size * s, OBJ_SHAPE.pink.size * s, {
        ...opts,
        chamfer: { radius: OBJ_SHAPE.pink.chamfer * s },
      });
      break;
    case 'yellow':
      body = M.Bodies.polygon(x, y, 3, OBJ_SHAPE.yellow.radius * s, {
        ...opts,
        chamfer: { radius: OBJ_SHAPE.yellow.chamfer * s },
      });
      // Matter builds triangles pointing left; turn it point-up and make that the zero angle.
      M.Body.setAngle(body, Math.PI / 2);
      body.angle = 0;
      body.anglePrev = 0;
      break;
    default:
      body = M.Bodies.polygon(x, y, 6, OBJ_SHAPE.green.radius * s, {
        ...opts,
        chamfer: { radius: OBJ_SHAPE.green.chamfer * s },
      });
      break;
  }
  return body;
}

let nextId = 1;

/** A physical item travelling through the factory. Pure simulation state (no rendering). */
export class FactoryObject {
  readonly id = nextId++;
  readonly body: Body;
  state: ObjectState = 'active';
  /** ticks since spawn */
  age = 0;
  /** consecutive ticks spent (almost) motionless */
  restTicks = 0;
  anchorX = 0;
  anchorY = 0;
  /** ticks until a bumper may launch this object again */
  bumpCooldown = 0;

  constructor(
    readonly type: ObjType,
    readonly material: MaterialId,
    x: number,
    y: number,
  ) {
    this.body = createBody(type, material, x, y);
    this.body.ref = { kind: 'object', obj: this };
    this.anchorX = x;
    this.anchorY = y;
  }

  get x(): number {
    return this.body.position.x;
  }
  get y(): number {
    return this.body.position.y;
  }
}
