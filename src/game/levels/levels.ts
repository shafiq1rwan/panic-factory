import { GAME_W, PLAY_H, type ObjType } from '../config';
import {
  parseSpawn,
  type BinDef,
  type BumperDef,
  type ConveyorDef,
  type LevelDef,
  type MachineDef,
  type SpawnSpec,
  type SpawnerDef,
  type TutorialStep,
  type WallDef,
} from './LevelTypes';

/**
 * The 20 sorting levels (portrait, 720 wide).
 *
 * One thing to learn: TAP A BELT TO FLIP IT. Toys drop in, ride the belts and
 * end up in the bins; the player flips belts (before or while toys are moving)
 * so every toy reaches the bin of its own colour. Nothing is dragged, rotated
 * or timed, and the bins span the whole floor so a toy can never be lost: the
 * only way to slip is a wrong bin.
 *
 * Variety comes from the scenery between the belts and the bins, which needs
 * no extra controls: springs that fling toys, ramps they slide down, bumpers
 * they ricochet off, springs that throw them clean across to the other side.
 * Difficulty comes from longer, faster toy sequences.
 *
 * Each level carries a `routes` table (which way each belt must run for each
 * colour). The test suite plays every level with a bot that follows it, both
 * instantly and with a human-like reaction delay.
 */

// --- pieces ---------------------------------------------------------------------

/** Centre y for a bin standing on the floor. */
const BIN_Y = PLAY_H - 78;
const SPEED = 2.2;

const belt = (id: string, x: number, y: number, length: number, dir: 1 | -1): ConveyorDef => ({
  id, kind: 'conveyor', x, y, length, speed: SPEED, dir, flippable: true,
});
const bin = (id: string, x: number, accepts: ObjType, width: number): BinDef => ({ id, kind: 'bin', x, y: BIN_Y, accepts, width });
const spring = (id: string, x: number, y: number, angle: number, power: number): BumperDef => ({ id, kind: 'bumper', shape: 'pad', x, y, angle, power });
const bumper = (id: string, x: number, y: number, power = 6): BumperDef => ({ id, kind: 'bumper', shape: 'round', x, y, power });
const wall = (x: number, y: number, w: number, h: number, angle = 0): WallDef => ({ x, y, w, h, angle });
const spawner = (id: string, x: number, sequence: SpawnSpec[], interval: number, delay = 1500): SpawnerDef => ({
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

// --- layouts --------------------------------------------------------------------

/** Springs: toys drop off the belt onto a spring that pops them up before they land in the bin. */
const layoutSprings = (dir: 1 | -1): Layout => ({
  machines: [belt('belt', 360, 560, 300, dir), spring('springL', 100, 880, 20, 7), spring('springR', 620, 880, -20, 7), ...twoBins('blue', 'pink')],
  routes: { belt: { blue: -1, pink: 1 } },
});

/** Ramps: toys land on a slope and slide down to their bin. */
const layoutRamps = (dir: 1 | -1): Layout => ({
  machines: [belt('belt', 360, 480, 260, dir), ...twoBins('blue', 'pink')],
  walls: [wall(200, 750, 240, 22, -28), wall(520, 750, 240, 22, 28)],
  routes: { belt: { blue: -1, pink: 1 } },
});

/** Cross over: big springs throw toys clean across, so each belt end feeds the OPPOSITE bin. */
const layoutCross = (dir: 1 | -1): Layout => ({
  machines: [belt('belt', 360, 520, 280, dir), spring('springL', 95, 900, 30, 9), spring('springR', 625, 900, -30, 9), ...twoBins('blue', 'pink')],
  routes: { belt: { blue: 1, pink: -1 } },
});

/** Pinball: toys ricochet through bumpers on their side of a divider. */
const layoutPinball = (dir: 1 | -1): Layout => ({
  machines: [
    belt('belt', 360, 440, 260, dir),
    // gaps beside each bumper are either wide (100+) or closed, so a toy can never get wedged
    bumper('b1', 150, 720), bumper('b2', 200, 890),
    bumper('b3', 570, 720), bumper('b4', 520, 890),
    ...twoBins('blue', 'pink'),
  ],
  walls: [wall(360, 800, 24, 460)],
  routes: { belt: { blue: -1, pink: 1 } },
});

/** Side by side: two belts at different heights, each with its own chute, over three bins. */
const layoutTwin = (): Layout => ({
  machines: [belt('beltL', 190, 700, 180, 1), belt('beltR', 530, 820, 180, -1), ...threeBins('blue', 'pink', 'yellow')],
  routes: { beltL: { blue: -1, pink: 1 }, beltR: { pink: -1, yellow: 1 } },
});

/** Junction: a top belt feeding two lower belts, over three bins (same arena as Panic mode). */
const layoutJunction = (): Layout => ({
  machines: [
    belt('top', 360, 560, 200, 1),
    belt('left', 165, 740, 190, 1),
    belt('right', 555, 740, 190, -1),
    { id: 'funnel', kind: 'funnel', x: 360, y: BIN_Y - 116, topWidth: 330, bottomWidth: 140, height: 84 },
    bin('binL', 100, 'blue', 190),
    bin('binM', 360, 'pink', 190),
    bin('binR', 620, 'yellow', 190),
  ],
  routes: {
    top: { blue: -1, yellow: 1 },
    left: { blue: -1, pink: 1, yellow: 1 },
    right: { yellow: 1, pink: -1, blue: -1 },
  },
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
  mistakesAllowed?: number;
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
    mistakesAllowed: spec.mistakesAllowed ?? 2,
    par: 999,
    sortAll: true,
    routes: spec.layout.routes,
    tutorial: spec.tutorial,
    solution,
  };
}

/** Two chutes for the twin layout: the right one runs half a beat behind the left one. */
const twoChutes = (seedL: number, seedR: number, each: number, interval: number): SpawnerDef[] => [
  spawner('sL', 190, mixed(seedL, each, BP), interval),
  spawner('sR', 530, mixed(seedR, each, PY), interval, 1500 + interval / 2),
];

export const LEVELS: LevelDef[] = [
  // ---------------------------------------------------------------- Warm Up
  sortLevel({
    id: 'first-flip',
    name: 'First Flip',
    hint: 'Tap the belt to flip it',
    layout: layoutSprings(1),
    spawners: [spawner('s1', 360, ['blue', 'blue', 'blue'], 1900, 2200)],
    mistakesAllowed: 1,
    tutorial: [{ machine: 'belt', op: 'flip', text: 'Tap the belt to flip it!' }],
  }),
  sortLevel({
    id: 'two-lines',
    name: 'Two Lines',
    hint: 'Match each toy to its bin',
    layout: {
      machines: [belt('beltL', 190, 620, 180, 1), belt('beltR', 530, 800, 180, -1), ...twoBins('blue', 'pink')],
      routes: { beltL: { blue: -1 }, beltR: { pink: 1 } },
    },
    spawners: [spawner('sL', 190, ['blue', 'blue', 'blue'], 2000, 2200), spawner('sR', 530, ['pink', 'pink', 'pink'], 2000, 3200)],
    mistakesAllowed: 1,
    tutorial: [
      { machine: 'beltL', op: 'flip', text: 'Blue toys go in the blue bin' },
      { machine: 'beltR', op: 'flip', text: 'Pink toys go in the pink bin' },
    ],
  }),
  sortLevel({
    id: 'slide-down',
    name: 'Slide Down',
    hint: 'Flip the belt for each colour',
    layout: layoutRamps(-1),
    spawners: [spawner('s1', 360, ['blue', 'pink', 'blue', 'pink', 'blue', 'pink'], 2700, 1800)],
  }),
  sortLevel({
    id: 'cross-over',
    name: 'Cross Over',
    hint: 'The springs throw toys across!',
    layout: layoutCross(-1),
    spawners: [spawner('s1', 360, mixed(11, 8, BP), 2500)],
  }),
  // ---------------------------------------------------------------- Speed Up
  sortLevel({
    id: 'pinball',
    name: 'Pinball',
    hint: 'Watch them bounce',
    layout: layoutPinball(1),
    spawners: [spawner('s1', 360, mixed(23, 10, BP), 2100)],
  }),
  sortLevel({
    id: 'rush-hour',
    name: 'Rush Hour',
    hint: 'Stay sharp!',
    layout: layoutSprings(-1),
    spawners: [spawner('s1', 360, mixed(37, 12, BP), 1700)],
  }),
  sortLevel({
    id: 'side-by-side',
    name: 'Side by Side',
    hint: 'Two belts, three bins',
    layout: layoutTwin(),
    spawners: twoChutes(5, 9, 4, 3000),
  }),
  sortLevel({
    id: 'double-duty',
    name: 'Double Duty',
    hint: 'Keep an eye on both belts',
    layout: layoutTwin(),
    spawners: twoChutes(41, 43, 6, 2500),
  }),
  // ---------------------------------------------------------------- Three Ways
  sortLevel({
    id: 'junction',
    name: 'Junction',
    hint: 'The top belt feeds the lower two',
    layout: layoutJunction(),
    spawners: [spawner('s1', 360, ['blue', 'blue', 'yellow', 'yellow', 'pink', 'pink'], 2900, 2000)],
  }),
  sortLevel({
    id: 'crossroads',
    name: 'Crossroads',
    hint: 'Pink goes to the middle',
    layout: layoutJunction(),
    spawners: [spawner('s1', 360, mixed(51, 8, BPY), 2600)],
  }),
  sortLevel({
    id: 'slip-stream',
    name: 'Slip Stream',
    hint: 'Slides and quick flips',
    layout: layoutRamps(1),
    spawners: [spawner('s1', 360, mixed(63, 12, BP), 1800)],
  }),
  sortLevel({
    id: 'gridlock',
    name: 'Gridlock',
    hint: 'Keep them moving',
    layout: layoutJunction(),
    spawners: [spawner('s1', 360, mixed(77, 12, BPY), 2050)],
  }),
  // ---------------------------------------------------------------- Overtime
  sortLevel({
    id: 'twin-shift',
    name: 'Twin Shift',
    hint: 'Both chutes are busy',
    layout: layoutTwin(),
    spawners: twoChutes(81, 83, 8, 2200),
  }),
  sortLevel({
    id: 'crossfire',
    name: 'Crossfire',
    hint: 'Left belt end, right bin',
    layout: layoutCross(1),
    spawners: [spawner('s1', 360, mixed(91, 12, BP), 1900)],
  }),
  sortLevel({
    id: 'bumper-storm',
    name: 'Bumper Storm',
    hint: 'Fourteen toys through the bumpers',
    layout: layoutPinball(-1),
    spawners: [spawner('s1', 360, mixed(101, 14, BP), 1800)],
  }),
  sortLevel({
    id: 'full-load',
    name: 'Full Load',
    hint: 'Sixteen toys, three bins',
    layout: layoutJunction(),
    spawners: [spawner('s1', 360, mixed(113, 16, BPY), 1750)],
  }),
  // ---------------------------------------------------------------- Factory Panic
  sortLevel({
    id: 'double-time',
    name: 'Double Time',
    hint: 'Two chutes at full speed',
    layout: layoutTwin(),
    spawners: twoChutes(121, 123, 12, 1800),
  }),
  sortLevel({
    id: 'sky-high',
    name: 'Sky High',
    hint: 'Sixteen toys flying across',
    layout: layoutCross(-1),
    spawners: [spawner('s1', 360, mixed(131, 16, BP), 1700)],
  }),
  sortLevel({
    id: 'meltdown',
    name: 'Meltdown',
    hint: 'Twenty toys, no breaks',
    layout: layoutJunction(),
    spawners: [spawner('s1', 360, mixed(141, 20, BPY), 1700)],
  }),
  sortLevel({
    id: 'factory-panic',
    name: 'Factory Panic',
    hint: 'The final shift!',
    layout: layoutJunction(),
    spawners: [spawner('s1', 360, mixed(151, 24, BPY), 1650)],
  }),
];
