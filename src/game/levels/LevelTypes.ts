import type { ObjType } from '../config';
import type { MaterialId } from '../physics/PhysicsMaterials';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** "blue" or "blue:bouncy" */
export type SpawnSpec = ObjType | `${ObjType}:${MaterialId}`;

export interface SpawnerDef {
  id: string;
  x: number;
  y: number;
  sequence: SpawnSpec[];
  /** ms between objects */
  interval: number;
  /** ms before the first object */
  delay?: number;
  vx?: number;
  vy?: number;
  /** Restart the sequence forever (menu backdrop). */
  loop?: boolean;
  /**
   * Tutorial: when the first object is due, keep it peeking out of the pipe until the player
   * flips a belt (then it drops a moment later), or until this many ms have passed.
   */
  holdFirstForFlip?: number;
}

export interface WallDef {
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
}

interface MachineCommon {
  id: string;
  x: number;
  y: number;
  /** degrees */
  angle?: number;
  /** Player may drag the machine inside `zone` (zone constrains the machine centre). */
  movable?: boolean;
  zone?: Rect;
  rotatable?: boolean;
  angleStep?: number;
  angleMin?: number;
  angleMax?: number;
}

export interface ConveyorDef extends MachineCommon {
  kind: 'conveyor';
  length: number;
  /** px per tick */
  speed: number;
  /** 1 = towards local +x (right when unrotated), -1 = reverse */
  dir?: 1 | -1;
  flippable?: boolean;
  /** Can be flipped while the factory is running (Panic mode). */
  interactive?: boolean;
  /** Colour of the belt face; its button at the bottom of the screen uses the same colour. */
  accent?: number;
}

export interface BumperDef extends MachineCommon {
  kind: 'bumper';
  shape: 'round' | 'pad';
  power?: number;
  radius?: number;
  width?: number;
}

export interface PistonDef extends MachineCommon {
  kind: 'piston';
  stroke?: number;
  /** ms for one full cycle */
  period?: number;
  /** 0..1 fraction of the period before the first push */
  phase?: number;
  /** Player may cycle the phase in quarter steps. */
  timing?: boolean;
  /** ticks spent extending (smaller = harder kick) */
  extendTicks?: number;
}

export interface FunnelDef extends MachineCommon {
  kind: 'funnel';
  topWidth?: number;
  bottomWidth?: number;
  height?: number;
}

export interface BinDef extends MachineCommon {
  kind: 'bin';
  accepts: ObjType;
  width?: number;
  height?: number;
}

export type MachineDef = ConveyorDef | BumperDef | PistonDef | FunnelDef | BinDef;

export interface MachineConfig {
  x?: number;
  y?: number;
  angle?: number;
  dir?: 1 | -1;
  phase?: number;
}
export type LevelConfig = Record<string, MachineConfig>;

export type TutorialOp = 'flip' | 'move' | 'rotate' | 'timing';
export interface TutorialStep {
  machine: string;
  op: TutorialOp;
  text: string;
}

export interface LevelDef {
  id: string;
  name: string;
  /** One short line shown at the start of the level. */
  hint?: string;
  width: number;
  height: number;
  /** Required correct deliveries per type. */
  objective: Partial<Record<ObjType, number>>;
  spawners: SpawnerDef[];
  machines: MachineDef[];
  walls: WallDef[];
  /** Wrong-bin deliveries tolerated before failing. */
  mistakesAllowed: number;
  /** Optional time limit in seconds (sim time after pressing Run). */
  timeLimit?: number;
  /** Seconds: finishing perfectly within this earns the third star. */
  par: number;
  tutorial?: TutorialStep[];
  /** Verified intended solution (also drives tutorials and automated checks). */
  solution: LevelConfig;
  /**
   * Sorting level: every toy must end up in a bin, and the level is won when all of them have,
   * with no more wrong deliveries than `mistakesAllowed`. Belts are flipped live while toys move.
   */
  sortAll?: boolean;
  /**
   * For sorting levels: which way each flippable belt must run for each toy type
   * (1 = towards +x). Drives the tutorial hand and the automated play-through bot.
   */
  routes?: Record<string, Partial<Record<ObjType, 1 | -1>>>;
}

export function parseSpawn(spec: SpawnSpec): { type: ObjType; material: MaterialId } {
  const [type, material] = spec.split(':') as [ObjType, MaterialId | undefined];
  return { type, material: material ?? 'standard' };
}

/** IDs of machines the player is allowed to modify. */
export function configurableIds(level: LevelDef): string[] {
  return level.machines
    .filter(
      (m) =>
        m.movable ||
        m.rotatable ||
        (m.kind === 'conveyor' && m.flippable) ||
        (m.kind === 'piston' && m.timing),
    )
    .map((m) => m.id);
}
