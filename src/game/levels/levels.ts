import { GAME_W, PLAY_H, type ObjType } from '../config';
import {
  parseSpawn,
  type BinDef,
  type BumperDef,
  type ConveyorDef,
  type LevelDef,
  type MachineDef,
  type PistonDef,
  type SpawnSpec,
  type SpawnerDef,
  type TutorialStep,
  type WallDef,
} from './LevelTypes';

/**
 * The 20 sorting levels (portrait, 720 wide).
 *
 * One thing to learn: FLIP A BELT. Each belt has its own big button at the
 * bottom of the screen (tapping the belt works too). Toys drop in, ride the
 * belts and end up in the bins; the player flips belts so every toy reaches
 * the bin of its own colour. A level never has more than two belts, so there
 * are never more than two buttons.
 *
 * Variety comes from fixed scenery between the belts and the bins, which needs
 * no controls: springs that pop toys up, ramps they slide down, pushers that
 * shove them off a ledge, bumpers they ricochet off, springs that throw them
 * across to the other side.
 *
 * The pace rises slowly: more toys per level and a slightly shorter gap between
 * them, never a sudden jump. Every level carries a `routes` table (which way
 * each belt must run for each colour); the tests play every level with a bot
 * that follows it, instantly and with human-like reaction delays up to half a second.
 */

// --- pieces ---------------------------------------------------------------------

/** Centre y for a bin standing on the floor. */
const BIN_Y = PLAY_H - 78;
const SPEED = 2.2;
/** Belt accent colours: the matching button at the bottom uses the same colour. */
export const BELT_A = 0x7a56f0;
export const BELT_B = 0x12a594;

const belt = (id: string, x: number, y: number, length: number, dir: 1 | -1, accent = BELT_A): ConveyorDef => ({
  id, kind: 'conveyor', x, y, length, speed: SPEED, dir, flippable: true, accent,
});
const bin = (id: string, x: number, accepts: ObjType, width: number): BinDef => ({ id, kind: 'bin', x, y: BIN_Y, accepts, width });
const spring = (id: string, x: number, y: number, angle: number, power: number): BumperDef => ({ id, kind: 'bumper', shape: 'pad', x, y, angle, power });
const bumper = (id: string, x: number, y: number, power = 6): BumperDef => ({ id, kind: 'bumper', shape: 'round', x, y, power });
/** A pusher that shoves on its own, on a steady beat. `angle` 0 pushes right, 180 pushes left. */
const pusher = (id: string, x: number, y: number, angle: number): PistonDef => ({
  id, kind: 'piston', x, y, angle, stroke: 90, period: 1800, extendTicks: 22,
});
const wall = (x: number, y: number, w: number, h: number, angle = 0): WallDef => ({ x, y, w, h, angle });
const spawner = (id: string, x: number, sequence: SpawnSpec[], interval: number, delay = 1800): SpawnerDef => ({
  id, x, y: 210, sequence, interval, delay,
});

/** Two bins covering the whole floor. */
const twoBins = (left: ObjType, right: ObjType): MachineDef[] => [bin('binL', 180, left, 350), bin('binR', 540, right, 350)];
/** Three bins covering the whole floor. */
const threeBins = (a: ObjType, b: ObjType, c: ObjType): MachineDef[] => [bin('binL', 121, a, 232), bin('binM', 360, b, 232), bin('binR', 599, c, 232)];

type Routes = NonNullable<LevelDef['routes']>;
interface Layout {
  machines: MachineDef[];
  routes: Routes;
  walls?: WallDef[];
}

// --- layouts (one belt) ---------------------------------------------------------

/** Springs: toys drop off the belt onto a spring that pops them up before they land in the bin. */
const layoutSprings = (dir: 1 | -1): Layout => ({
  machines: [belt('belt', 360, 500, 300, dir), spring('springL', 100, 780, 20, 7), spring('springR', 620, 780, -20, 7), ...twoBins('blue', 'pink')],
  routes: { belt: { blue: -1, pink: 1 } },
});

/** Ramps: toys land on a slope and slide down to their bin. */
const layoutRamps = (dir: 1 | -1): Layout => ({
  machines: [belt('belt', 360, 460, 260, dir), ...twoBins('blue', 'pink')],
  walls: [wall(200, 690, 240, 22, -28), wall(520, 690, 240, 22, 28)],
  routes: { belt: { blue: -1, pink: 1 } },
});

/** Pushers: toys land on a ledge and a pusher shoves them off into the bin. */
const layoutPushers = (dir: 1 | -1): Layout => ({
  machines: [belt('belt', 360, 450, 200, dir), pusher('pushL', 285, 691, 180), pusher('pushR', 435, 691, 0), ...twoBins('blue', 'pink')],
  walls: [wall(170, 740, 160, 22), wall(550, 740, 160, 22)],
  routes: { belt: { blue: -1, pink: 1 } },
});

/** Pinball: toys ricochet through bumpers on their side of a divider. */
const layoutPinball = (dir: 1 | -1): Layout => ({
  machines: [
    belt('belt', 360, 430, 260, dir),
    // gaps beside each bumper are either wide (100+) or closed, so a toy can never get wedged
    bumper('b1', 150, 640), bumper('b2', 200, 790),
    bumper('b3', 570, 640), bumper('b4', 520, 790),
    ...twoBins('blue', 'pink'),
  ],
  walls: [wall(360, 720, 24, 400)],
  routes: { belt: { blue: -1, pink: 1 } },
});

/** Cross over: big springs throw toys clean across, so each belt end feeds the OPPOSITE bin. */
const layoutCross = (dir: 1 | -1): Layout => ({
  machines: [belt('belt', 360, 490, 280, dir), spring('springL', 95, 810, 30, 10), spring('springR', 625, 810, -30, 10), ...twoBins('blue', 'pink')],
  routes: { belt: { blue: 1, pink: -1 } },
});

// --- layouts (two belts, two buttons) -------------------------------------------

/** Twin: two belts side by side, each under its own chute, over three bins. */
const layoutTwin = (): Layout => ({
  machines: [belt('beltL', 190, 600, 180, 1, BELT_A), belt('beltR', 530, 600, 180, -1, BELT_B), ...threeBins('blue', 'pink', 'yellow')],
  // posts between the bins keep every toy over the bin it was sent to
  walls: [wall(240, BIN_Y - 200, 20, 260), wall(480, BIN_Y - 200, 20, 260)],
  routes: { beltL: { blue: -1, pink: 1 }, beltR: { pink: -1, yellow: 1 } },
});

/** Two step: the top belt sends toys right into the yellow bin, or left onto a second belt that picks blue or pink. */
const layoutTwoStep = (): Layout => ({
  machines: [belt('lower', 190, 660, 200, 1, BELT_A), belt('top', 400, 450, 240, 1, BELT_B), ...threeBins('blue', 'pink', 'yellow')],
  routes: { top: { blue: -1, pink: -1, yellow: 1 }, lower: { blue: -1, pink: 1 } },
});

// --- toy sequences --------------------------------------------------------------

/** Deterministic shuffled sequence of `n` toys from `types`, never three alike in a row. */
function mixed(seed: number, n: number, types: ObjType[]): SpawnSpec[] {
  let s = seed >>> 0;
  const rnd = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out: SpawnSpec[] = [];
  for (let i = 0; i < n; i++) {
    let t = types[Math.floor(rnd() * types.length)];
    if (i >= 2 && out[i - 1] === t && out[i - 2] === t) t = types[(types.indexOf(t) + 1) % types.length];
    out.push(t);
  }
  return out;
}
const BP: ObjType[] = ['blue', 'pink'];
const PY: ObjType[] = ['pink', 'yellow'];
const BPY: ObjType[] = ['blue', 'pink', 'yellow'];

// --- level builder --------------------------------------------------------------

interface SortSpec {
  id: string;
  name: string;
  hint: string;
  layout: Layout;
  spawners: SpawnerDef[];
  tutorial?: TutorialStep[];
}

function sortLevel(spec: SortSpec): LevelDef {
  const objective: Partial<Record<ObjType, number>> = {};
  for (const sp of spec.spawners) for (const s of sp.sequence) objective[parseSpawn(s).type] = (objective[parseSpawn(s).type] ?? 0) + 1;
  // the tutorial hand needs the "right" resting direction of each belt it points at
  const solution: LevelDef['solution'] = {};
  for (const step of spec.tutorial ?? []) {
    const first = spec.spawners.flatMap((sp) => sp.sequence).map((s) => parseSpawn(s).type).find((t) => spec.layout.routes[step.machine]?.[t]);
    const dir = first ? spec.layout.routes[step.machine]?.[first] : undefined;
    if (dir) solution[step.machine] = { dir };
  }
  return {
    id: spec.id,
    name: spec.name,
    hint: spec.hint,
    width: GAME_W,
    height: PLAY_H,
    objective,
    spawners: spec.spawners,
    machines: spec.layout.machines,
    walls: spec.layout.walls ?? [],
    mistakesAllowed: 2,
    par: 999,
    sortAll: true,
    routes: spec.layout.routes,
    tutorial: spec.tutorial,
    solution,
  };
}

/** One chute over the middle. */
const chute = (sequence: SpawnSpec[], interval: number): SpawnerDef[] => [spawner('s1', 360, sequence, interval)];
/** Two chutes for the twin layout: the right one runs half a beat behind the left one. */
const twoChutes = (left: SpawnSpec[], right: SpawnSpec[], interval: number): SpawnerDef[] => [
  spawner('sL', 190, left, interval),
  spawner('sR', 530, right, interval, 1800 + interval / 2),
];
/** One chute over the top belt of the two-step layout. */
const stepChute = (sequence: SpawnSpec[], interval: number): SpawnerDef[] => [spawner('s1', 400, sequence, interval)];

export const LEVELS: LevelDef[] = [
  // ---------------------------------------------------------------- Warm Up
  sortLevel({
    id: 'first-flip',
    name: 'First Flip',
    hint: 'Press the button to flip the belt',
    layout: layoutSprings(1),
    spawners: [spawner('s1', 360, ['blue', 'blue', 'blue'], 3200, 3400)],
    tutorial: [{ machine: 'belt', op: 'flip', text: 'Press the button to flip the belt!' }],
  }),
  sortLevel({
    id: 'two-colours',
    name: 'Two Colours',
    hint: 'Blue goes left, pink goes right',
    layout: layoutSprings(-1),
    spawners: chute(['blue', 'pink', 'blue', 'pink', 'blue', 'pink'], 3200),
  }),
  sortLevel({
    id: 'slide-down',
    name: 'Slide Down',
    hint: 'Look at the queue to see what is next',
    layout: layoutRamps(1),
    spawners: chute(mixed(3, 5, BP), 3100),
  }),
  sortLevel({
    id: 'push-it',
    name: 'Push It',
    hint: 'The pushers shove toys into the bins',
    layout: layoutPushers(-1),
    spawners: chute(mixed(11, 6, BP), 3100),
  }),
  // ---------------------------------------------------------------- Bounce
  sortLevel({
    id: 'pinball',
    name: 'Pinball',
    hint: 'Watch them bounce',
    layout: layoutPinball(1),
    spawners: chute(mixed(23, 6, BP), 3000),
  }),
  sortLevel({
    id: 'two-belts',
    name: 'Two Belts',
    hint: 'Two belts, two buttons',
    layout: layoutTwin(),
    // extra time before the first toys: this is where the second button is introduced
    spawners: [spawner('sL', 190, ['blue', 'blue', 'blue'], 3600, 4200), spawner('sR', 530, ['yellow', 'yellow', 'yellow'], 3600, 6000)],
    tutorial: [
      { machine: 'beltL', op: 'flip', text: 'The left button flips the left belt' },
      { machine: 'beltR', op: 'flip', text: 'The right button flips the right belt' },
    ],
  }),
  sortLevel({
    id: 'cross-over',
    name: 'Cross Over',
    hint: 'These springs throw toys to the other side!',
    layout: layoutCross(-1),
    spawners: chute(mixed(31, 6, BP), 3100),
  }),
  sortLevel({
    id: 'side-by-side',
    name: 'Side by Side',
    hint: 'Pink goes to the middle',
    layout: layoutTwin(),
    spawners: twoChutes(mixed(5, 4, BP), mixed(9, 4, PY), 3800),
  }),
  // ---------------------------------------------------------------- Three Bins
  sortLevel({
    id: 'spring-time',
    name: 'Spring Time',
    hint: 'A longer run',
    layout: layoutSprings(1),
    spawners: chute(mixed(37, 8, BP), 2900),
  }),
  sortLevel({
    id: 'two-step',
    name: 'Two Step',
    hint: 'Yellow goes right. Blue and pink take the lower belt.',
    layout: layoutTwoStep(),
    spawners: stepChute(['yellow', 'yellow', 'blue', 'blue', 'pink', 'pink'], 3400),
  }),
  sortLevel({
    id: 'slip-stream',
    name: 'Slip Stream',
    hint: 'Slides and steady flips',
    layout: layoutRamps(-1),
    spawners: chute(mixed(63, 8, BP), 2800),
  }),
  sortLevel({
    id: 'shove-off',
    name: 'Shove Off',
    hint: 'Eight toys for the pushers',
    layout: layoutPushers(1),
    spawners: chute(mixed(71, 8, BP), 2900),
  }),
  // ---------------------------------------------------------------- Overtime
  sortLevel({
    id: 'step-by-step',
    name: 'Step by Step',
    hint: 'Three colours, two belts',
    layout: layoutTwoStep(),
    spawners: stepChute(mixed(77, 8, BPY), 3200),
  }),
  sortLevel({
    id: 'bumper-storm',
    name: 'Bumper Storm',
    hint: 'Nine toys through the bumpers',
    layout: layoutPinball(-1),
    spawners: chute(mixed(101, 9, BP), 2700),
  }),
  sortLevel({
    id: 'twin-shift',
    name: 'Twin Shift',
    hint: 'Both chutes are busy',
    layout: layoutTwin(),
    spawners: twoChutes(mixed(81, 5, BP), mixed(83, 5, PY), 3500),
  }),
  sortLevel({
    id: 'crossfire',
    name: 'Crossfire',
    hint: 'Left end of the belt, right bin',
    layout: layoutCross(1),
    spawners: chute(mixed(91, 9, BP), 2700),
  }),
  // ---------------------------------------------------------------- Factory Panic
  sortLevel({
    id: 'triple-sort',
    name: 'Triple Sort',
    hint: 'Ten toys, three bins',
    layout: layoutTwoStep(),
    spawners: stepChute(mixed(113, 10, BPY), 3000),
  }),
  sortLevel({
    id: 'spring-rush',
    name: 'Spring Rush',
    hint: 'Ten toys, a little quicker',
    layout: layoutSprings(-1),
    spawners: chute(mixed(121, 10, BP), 2500),
  }),
  sortLevel({
    id: 'double-time',
    name: 'Double Time',
    hint: 'Six toys from each chute',
    layout: layoutTwin(),
    spawners: twoChutes(mixed(131, 6, BP), mixed(133, 6, PY), 3200),
  }),
  sortLevel({
    id: 'factory-panic',
    name: 'Factory Panic',
    hint: 'The final shift!',
    layout: layoutTwoStep(),
    spawners: stepChute(mixed(151, 12, BPY), 2800),
  }),
];
