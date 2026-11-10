/**
 * Thin access layer over the Matter.js build that ships inside Phaser.
 *
 * The simulation never imports Phaser directly. The browser entry point
 * provides `Phaser.Physics.Matter.Matter`, while Node tests provide the same
 * library from `phaser/src/physics/matter-js/CustomMain.js`. This keeps the
 * whole physics/game-rule layer runnable headlessly.
 */
export interface Vec {
  x: number;
  y: number;
}

export interface BodyRef {
  kind: 'object' | 'machine' | 'wall';
  obj?: unknown;
  machine?: unknown;
  role?: string;
}

export interface Body {
  id: number;
  position: Vec;
  positionPrev: Vec;
  velocity: Vec;
  angle: number;
  anglePrev: number;
  angularVelocity: number;
  speed: number;
  mass: number;
  isStatic: boolean;
  isSensor: boolean;
  vertices: Vec[];
  bounds: { min: Vec; max: Vec };
  parent: Body;
  ref?: BodyRef;
  circleRadius?: number;
}

export interface Pair {
  bodyA: Body;
  bodyB: Body;
  isActive: boolean;
  isSensor: boolean;
  collision: { normal: Vec; supports: Vec[]; depth: number };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let M: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function provideMatter(lib: any): void {
  M = lib;
}
