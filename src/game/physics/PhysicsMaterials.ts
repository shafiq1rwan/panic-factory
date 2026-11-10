export type MaterialId = 'standard' | 'bouncy' | 'heavy' | 'slippery';

export interface PhysicsMaterial {
  density: number;
  friction: number;
  frictionStatic: number;
  frictionAir: number;
  restitution: number;
  /** Multiplier on bumper / launch speed (heavy things launch less). */
  launch: number;
  /** Multiplier on how strongly conveyor belts grip the object. */
  grip: number;
  /** Visual + collider scale. */
  scale: number;
}

/** Reusable material presets. Each one is also drawn differently (see Textures.ts). */
export const MATERIALS: Record<MaterialId, PhysicsMaterial> = {
  standard: { density: 0.0012, friction: 0.35, frictionStatic: 0.5, frictionAir: 0.004, restitution: 0.28, launch: 1, grip: 1, scale: 1 },
  bouncy: { density: 0.001, friction: 0.3, frictionStatic: 0.5, frictionAir: 0.004, restitution: 0.8, launch: 1.12, grip: 1, scale: 1 },
  heavy: { density: 0.004, friction: 0.6, frictionStatic: 0.8, frictionAir: 0.004, restitution: 0.05, launch: 0.62, grip: 1, scale: 1.12 },
  slippery: { density: 0.0012, friction: 0.005, frictionStatic: 0.01, frictionAir: 0.004, restitution: 0.15, launch: 1, grip: 0.12, scale: 1 },
};
