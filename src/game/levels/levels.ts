import { GAME_W, PLAY_H, type ObjType } from '../config';
import {
  parseSpawn,
  type BinDef,
  type BumperDef,
  type ConveyorDef,
  type LevelConfig,
  type LevelDef,
  type MachineDef,
  type PistonDef,
  type SpawnSpec,
  type SpawnerDef,
  type TutorialStep,
  type WallDef,
} from './LevelTypes';

/**
 * Set-up-then-run levels (portrait, 720 wide).
 *
 * Before pressing RUN the player taps the machines that wear a badge:
 *   - a belt flips direction,
 *   - a bouncer turns to its next angle,
 *   - a timer moves its pusher's timing on one step.
 * Then RUN drops the toys. Nothing can be changed while they move. Every toy must
 * land in the bin of its own colour; one wrong toy stops the run and hands the
 * setup back, as the player left it, to try again.
 *
 * Each level has a `solution`. The tests try EVERY possible setup of every level
 * (see sim/planSolver.ts): the starting setup must fail, the solution must win
 * (also with small random spawn offsets), and only a few setups may win.
 */

// --- pieces ---------------------------------------------------------------------

/** Centre y for a bin standing on the floor. */
const BIN_Y = PLAY_H - 78;
const SPEED = 2.2;
/** Belt accent colours (Panic mode's buttons use the same ones). */
export const BELT_A = 0x7a56f0;
export const BELT_B = 0x12a594;

type Extra<T> = Partial<Omit<T, 'id' | 'kind' | 'x' | 'y'>>;

/** A belt the player can flip. */
const belt = (id: string, x: number, y: number, length: number, dir: 1 | -1, o: Extra<ConveyorDef> = {}): ConveyorDef => ({
  id, kind: 'conveyor', x, y, length, speed: SPEED, dir, flippable: true, accent: BELT_A, ...o,
});
/** A belt that cannot be changed. */
const fixedBelt = (id: string, x: number, y: number, length: number, dir: 1 | -1, o: Extra<ConveyorDef> = {}): ConveyorDef => ({
  id, kind: 'conveyor', x, y, length, speed: SPEED, dir, accent: 0x8f8ab0, ...o,
});
/** A bouncer the player can turn: a tap moves it to the next of `angles`. */
const bouncer = (id: string, x: number, y: number, angles: number[], o: Extra<BumperDef> = {}): BumperDef => ({
  id, kind: 'bumper', shape: 'pad', x, y, angle: angles[0], angles, rotatable: true, power: 9, ...o,
});
/** A bouncer fixed in place. */
const spring = (id: string, x: number, y: number, angle: number, power = 8): BumperDef => ({ id, kind: 'bumper', shape: 'pad', x, y, angle, power });
/** A pusher on a timer the player can set (angle 0 pushes right, 180 pushes left). */
const timer = (id: string, x: number, y: number, angle: number, period: number, o: Extra<PistonDef> = {}): PistonDef => ({
  id, kind: 'piston', x, y, angle, stroke: 150, period, extendTicks: 14, timing: true, timingSteps: 4, phase: 0, ...o,
});
const bin = (id: string, x: number, accepts: ObjType, width: number): BinDef => ({ id, kind: 'bin', x, y: BIN_Y, accepts, width });
const wall = (x: number, y: number, w: number, h: number, angle = 0): WallDef => ({ x, y, w, h, angle });
const pipe = (id: string, x: number, sequence: SpawnSpec[], interval = 1500, delay = 500): SpawnerDef => ({ id, x, y: 210, sequence, interval, delay });

/** Two bins covering the whole floor. */
const twoBins = (left: ObjType, right: ObjType): MachineDef[] => [bin('binL', 180, left, 350), bin('binR', 540, right, 350)];
/** Three bins covering the whole floor. */
const threeBins = (a: ObjType, b: ObjType, c: ObjType): MachineDef[] => [bin('binL', 121, a, 232), bin('binM', 360, b, 232), bin('binR', 599, c, 232)];

const rep = (t: SpawnSpec, n: number): SpawnSpec[] => Array.from({ length: n }, () => t);
const alt = (a: SpawnSpec, b: SpawnSpec, n: number): SpawnSpec[] => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? a : b));

// --- level builder --------------------------------------------------------------

interface PlanSpec {
  id: string;
  name: string;
  hint: string;
  machines: MachineDef[];
  walls?: WallDef[];
  spawners: SpawnerDef[];
  solution: LevelConfig;
  tutorial?: TutorialStep[];
}

function planLevel(spec: PlanSpec): LevelDef {
  const objective: Partial<Record<ObjType, number>> = {};
  for (const sp of spec.spawners) for (const s of sp.sequence) objective[parseSpawn(s).type] = (objective[parseSpawn(s).type] ?? 0) + 1;
  return {
    id: spec.id,
    name: spec.name,
    hint: spec.hint,
    width: GAME_W,
    height: PLAY_H,
    objective,
    spawners: spec.spawners,
    machines: spec.machines,
    walls: spec.walls ?? [],
    mistakesAllowed: 0,
    par: 999,
    sortAll: true,
    plan: true,
    tutorial: spec.tutorial,
    solution: spec.solution,
  };
}

export const LEVELS: LevelDef[] = [
  // ---------------------------------------------------------------- Belts
  planLevel({
    id: 'first-flip',
    name: 'First Flip',
    hint: 'Tap the belt, then press RUN',
    machines: [belt('belt', 360, 500, 300, 1), spring('springL', 100, 780, 20, 7), spring('springR', 620, 780, -20, 7), ...twoBins('blue', 'pink')],
    spawners: [pipe('s1', 360, rep('blue', 3))],
    solution: { belt: { dir: -1 } },
    tutorial: [{ machine: 'belt', op: 'flip', text: 'Tap the belt to flip it' }],
  }),
  planLevel({
    id: 'two-belts',
    name: 'Two Belts',
    hint: 'Every belt with a badge can be flipped',
    machines: [
      belt('beltL', 190, 600, 180, 1),
      belt('beltR', 530, 600, 180, -1, { accent: BELT_B }),
      ...threeBins('blue', 'pink', 'yellow'),
    ],
    walls: [wall(240, BIN_Y - 200, 20, 260), wall(480, BIN_Y - 200, 20, 260)],
    spawners: [pipe('sL', 190, rep('blue', 3)), pipe('sR', 530, rep('yellow', 3), 1500, 1250)],
    solution: { beltL: { dir: -1 }, beltR: { dir: 1 } },
  }),
  planLevel({
    id: 'flip-stack',
    name: 'Flip Stack',
    hint: 'The top belt feeds the lower one',
    machines: [belt('lower', 190, 660, 200, 1), belt('top', 400, 450, 240, 1, { accent: BELT_B }), ...threeBins('blue', 'pink', 'yellow')],
    spawners: [pipe('s1', 400, rep('blue', 3))],
    solution: { top: { dir: -1 }, lower: { dir: -1 } },
  }),
  // ---------------------------------------------------------------- Bouncers
  planLevel({
    id: 'aim-it',
    name: 'Aim It',
    hint: 'Tap the bouncer to turn it',
    machines: [bouncer('pad', 360, 720, [0, -30, 30]), ...twoBins('blue', 'pink')],
    spawners: [pipe('s1', 360, rep('pink', 3))],
    solution: { pad: { angle: 30 } },
    tutorial: [{ machine: 'pad', op: 'rotate', text: 'Tap the bouncer to turn it' }],
  }),
  planLevel({
    id: 'bank-shot',
    name: 'Bank Shot',
    hint: 'Pink goes in the middle',
    machines: [bouncer('pad', 250, 720, [-30, -10, 10, 30]), ...threeBins('blue', 'pink', 'yellow')],
    spawners: [pipe('s1', 250, rep('pink', 3))],
    solution: { pad: { angle: 10 } },
  }),
  planLevel({
    id: 'belt-bounce',
    name: 'Belt Bounce',
    hint: 'Belt first, then the bouncer',
    machines: [belt('belt', 360, 450, 300, 1), bouncer('pad', 125, 740, [-20, 15, 30]), ...threeBins('blue', 'pink', 'yellow')],
    spawners: [pipe('s1', 360, rep('pink', 3))],
    solution: { belt: { dir: -1 }, pad: { angle: 15 } },
  }),
  planLevel({
    id: 'meet-in-the-middle',
    name: 'Meet in the Middle',
    hint: 'Two pipes, one bin',
    machines: [bouncer('padL', 200, 700, [-30, 10, 30]), bouncer('padR', 520, 700, [30, -10, -30]), ...threeBins('blue', 'pink', 'yellow')],
    spawners: [pipe('sL', 200, rep('pink', 3)), pipe('sR', 520, rep('pink', 3), 1500, 1250)],
    solution: { padL: { angle: 10 }, padR: { angle: -10 } },
  }),
  planLevel({
    id: 'either-way',
    name: 'Either Way',
    hint: 'There is more than one way',
    machines: [belt('belt', 360, 450, 300, 1), bouncer('padL', 125, 740, [-20, 15, 30]), bouncer('padR', 595, 740, [20, -15, -30]), ...threeBins('blue', 'pink', 'yellow')],
    spawners: [pipe('s1', 360, rep('pink', 4))],
    solution: { padR: { angle: -15 } },
  }),
  // ---------------------------------------------------------------- Timers
  planLevel({
    id: 'take-turns',
    name: 'Take Turns',
    hint: 'Tap the pusher to set its timer',
    machines: [timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }), ...twoBins('blue', 'pink')],
    spawners: [pipe('s1', 300, alt('blue', 'pink', 4), 1500, 350)],
    solution: { ram: { phase: 0.75 } },
    tutorial: [{ machine: 'ram', op: 'timing', text: 'Tap the pusher to set its timer' }],
  }),
  planLevel({
    id: 'sort-line',
    name: 'Sort Line',
    hint: 'Kick the pink ones, belt the blue ones',
    machines: [timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }), belt('belt', 240, 830, 200, 1), ...threeBins('blue', 'yellow', 'pink')],
    spawners: [pipe('s1', 300, alt('blue', 'pink', 4), 1500, 350)],
    solution: { ram: { phase: 0.75 }, belt: { dir: -1 } },
  }),
  planLevel({
    id: 'kick-and-bounce',
    name: 'Kick and Bounce',
    hint: 'Only the yellow ones get kicked',
    machines: [timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }), bouncer('pad', 300, 840, [0, -30, 30]), ...threeBins('blue', 'pink', 'yellow')],
    spawners: [pipe('s1', 300, alt('blue', 'yellow', 4), 1500, 350)],
    solution: { ram: { phase: 0.75 }, pad: { angle: -30 } },
  }),
  planLevel({
    id: 'full-shift',
    name: 'Full Shift',
    hint: 'Timer, belt and bouncer',
    machines: [
      timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }),
      belt('belt', 300, 840, 200, 1),
      bouncer('pad', 640, 860, [0, 30, -12, -30]),
      ...threeBins('blue', 'pink', 'yellow'),
    ],
    spawners: [pipe('s1', 300, alt('blue', 'pink', 4), 1500, 350)],
    solution: { ram: { phase: 0.75 }, belt: { dir: -1 }, pad: { angle: -12 } },
  }),
];
