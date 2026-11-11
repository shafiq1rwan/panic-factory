import { GAME_W, PLAY_H, type ObjType } from '../config';
import {
  parseSpawn,
  type BinDef,
  type BumperDef,
  type ConveyorDef,
  type FanDef,
  type LevelConfig,
  type LevelDef,
  type MachineDef,
  type NewToy,
  type Intro,
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
const BELT_C = 0xe0702a;

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
/** A fan (world 4): blows sideways over a band `reach` px long; a tap moves it to the next of `powers` (0 off, 1 right, -1 left). */
const fan = (id: string, x: number, y: number, reach: number, powers: number[], o: Extra<FanDef> = {}): FanDef => ({
  id, kind: 'fan', x, y, reach, powers, power: powers[0], ...o,
});
const wall = (x: number, y: number, w: number, h: number, angle = 0): WallDef => ({ x, y, w, h, angle });
const pipe = (id: string, x: number, sequence: SpawnSpec[], interval = 1500, delay = 500): SpawnerDef => ({ id, x, y: 210, sequence, interval, delay });

/** Two bins covering the whole floor. */
const twoBins = (left: ObjType, right: ObjType): MachineDef[] => [bin('binL', 180, left, 350), bin('binR', 540, right, 350)];
/** Three bins covering the whole floor. */
const threeBins = (a: ObjType, b: ObjType, c: ObjType): MachineDef[] => [bin('binL', 121, a, 232), bin('binM', 360, b, 232), bin('binR', 599, c, 232)];

/** Four bins covering the whole floor. */
const fourBins = (a: ObjType, b: ObjType, c: ObjType, d: ObjType): MachineDef[] => [
  bin('bin1', 91, a, 172), bin('bin2', 270, b, 172), bin('bin3', 450, c, 172), bin('bin4', 629, d, 172),
];

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
  newToy?: NewToy;
  intro?: Intro;
}

export function planLevel(spec: PlanSpec): LevelDef {
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
    // only bins for colours that drop; the bare floor between them is a miss
    machines: spec.machines.filter((m) => m.kind !== 'bin' || (objective[m.accepts] ?? 0) > 0),
    walls: spec.walls ?? [],
    mistakesAllowed: 0,
    par: 999,
    sortAll: true,
    plan: true,
    tutorial: spec.tutorial,
    solution: spec.solution,
    newToy: spec.newToy,
    intro: spec.intro,
  };
}

export const LEVELS: LevelDef[] = [
  // ---------------------------------------------------------------- World 1: Workshop (levels 1-10)
  // Belts
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
  // Bouncers
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
  // Timers
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
  // ---------------------------------------------------------------- World 2: Toy Room (levels 11-20)
  // The two harder plain-toy timer levels open world 2 (kick-and-bounce, full-shift above);
  // then the green hexagon and heavy toys arrive, one at a time.
  planLevel({
    id: 'hex-nuts',
    name: 'Hex Nuts',
    hint: 'Green hexagons go in the green bin',
    machines: [
      belt('beltL', 200, 600, 200, 1),
      belt('beltR', 520, 600, 200, -1, { accent: BELT_B }),
      ...fourBins('green', 'blue', 'yellow', 'pink'),
    ],
    spawners: [pipe('sL', 200, rep('green', 3)), pipe('sR', 520, rep('pink', 3), 1500, 1250)],
    solution: { beltL: { dir: -1 }, beltR: { dir: 1 } },
    newToy: { spec: 'green', title: 'Green hexagon', text: 'It rolls a little, then stops on a flat side.' },
  }),
  planLevel({
    id: 'hex-kick',
    name: 'Hex Kick',
    hint: 'Kick the pink ones, belt the green ones',
    machines: [timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }), belt('belt', 340, 830, 160, 1), ...fourBins('yellow', 'green', 'pink', 'blue')],
    spawners: [pipe('s1', 300, alt('green', 'pink', 4), 1500, 350)],
    solution: { ram: { phase: 0.75 }, belt: { dir: -1 } },
  }),
  planLevel({
    id: 'heavy-load',
    name: 'Heavy Load',
    hint: 'Heavy toys do not fly as far',
    machines: [bouncer('pad', 220, 720, [0, 10, 30, -30]), ...threeBins('yellow', 'blue', 'pink')],
    spawners: [pipe('s1', 220, alt('pink', 'blue:heavy', 4))],
    solution: { pad: { angle: 30 } },
    newToy: { spec: 'blue:heavy', title: 'Heavy toy', text: 'Dark with rivets. Bouncers throw it only half as far.' },
  }),
  planLevel({
    id: 'two-weights',
    name: 'Two Weights',
    hint: 'One side heavy, one side light',
    machines: [bouncer('padL', 200, 720, [-20, 0, 20]), bouncer('padR', 520, 720, [20, 0, -20]), ...threeBins('yellow', 'blue', 'pink')],
    spawners: [pipe('sL', 200, rep('blue:heavy', 3)), pipe('sR', 520, rep('pink', 3), 1500, 1250)],
    solution: { padL: { angle: 20 }, padR: { angle: 20 } },
  }),
  planLevel({
    id: 'night-shift',
    name: 'Heavy Kick',
    hint: 'Kick the heavy ones, bounce the green ones',
    machines: [
      timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }),
      bouncer('pad', 300, 840, [0, -30, 30]),
      ...fourBins('green', 'pink', 'yellow', 'blue'),
    ],
    spawners: [pipe('s1', 300, alt('green', 'blue:heavy', 4), 1500, 350)],
    solution: { ram: { phase: 0.75 }, pad: { angle: -30 } },
  }),
  planLevel({
    id: 'heavy-belt',
    name: 'Heavy Belt',
    hint: 'Pick a side, then aim',
    machines: [belt('belt', 360, 450, 300, 1), bouncer('padL', 125, 740, [-20, 15, 40]), bouncer('padR', 595, 740, [20, -15, -40]), ...threeBins('pink', 'blue', 'yellow')],
    spawners: [pipe('s1', 360, alt('pink', 'blue:heavy', 4))],
    solution: { padR: { angle: -40 } },
  }),
  planLevel({
    id: 'crossroads',
    name: 'Crossroads',
    hint: 'Three belts, two pipes',
    machines: [
      belt('top', 360, 420, 260, 1),
      belt('lowL', 170, 640, 200, 1, { accent: BELT_B }),
      belt('lowR', 550, 640, 200, 1, { accent: BELT_C }),
      ...fourBins('green', 'blue', 'yellow', 'pink'),
    ],
    spawners: [pipe('s1', 360, rep('green', 3)), pipe('s2', 600, rep('pink', 3), 1500, 1250)],
    solution: { top: { dir: -1 }, lowL: { dir: -1 } },
  }),
  planLevel({
    id: 'full-house',
    name: 'Full House',
    hint: 'Timer, belt and bouncer, heavy and green',
    machines: [
      timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }),
      belt('belt', 300, 840, 200, 1),
      bouncer('pad', 640, 860, [-30, 0, 30, 15]),
      ...threeBins('green', 'pink', 'blue'),
    ],
    spawners: [pipe('s1', 300, alt('green', 'blue:heavy', 4), 1500, 350)],
    solution: { ram: { phase: 0.75 }, belt: { dir: -1 } },
  }),
  // ---------------------------------------------------------------- World 3: Night Shift (levels 21-30)
  // Bouncy toys, then the purple pill.
  planLevel({
    id: 'boing',
    name: 'Boing',
    hint: 'Bouncy toys fly further',
    machines: [belt('belt', 360, 450, 300, 1), bouncer('pad', 125, 740, [-20, 15, 30]), ...threeBins('blue', 'pink', 'yellow')],
    spawners: [pipe('s1', 360, alt('pink', 'yellow:bouncy', 4))],
    solution: { belt: { dir: -1 }, pad: { angle: 30 } },
    newToy: { spec: 'yellow:bouncy', title: 'Bouncy toy', text: 'White ring. Flies further off a bouncer.' },
  }),
  planLevel({
    id: 'bounce-house',
    name: 'Bounce House',
    hint: 'Bouncy on the left, plain on the right',
    machines: [bouncer('padL', 200, 720, [-30, 10, 30]), bouncer('padR', 520, 720, [30, -10, -30]), ...threeBins('blue', 'yellow', 'pink')],
    spawners: [pipe('sL', 200, rep('yellow:bouncy', 3)), pipe('sR', 520, rep('pink', 3), 1500, 1250)],
    solution: { padL: { angle: 10 } },
  }),
  planLevel({
    id: 'bouncy-kick',
    name: 'Bouncy Kick',
    hint: 'Kick one kind, bounce the other',
    machines: [timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }), bouncer('pad', 300, 840, [0, -30, 30]), ...threeBins('blue', 'yellow', 'pink')],
    spawners: [pipe('s1', 300, alt('blue', 'yellow:bouncy', 4), 1500, 350)],
    solution: { ram: { phase: 0.75 }, pad: { angle: -30 } },
  }),
  planLevel({
    id: 'pill-box',
    name: 'Pill Box',
    hint: 'Purple pills go in the purple bin',
    machines: [
      belt('beltL', 200, 560, 240, 1),
      belt('beltR', 520, 680, 160, -1, { accent: BELT_B }),
      ...fourBins('purple', 'blue', 'yellow', 'pink'),
    ],
    spawners: [pipe('sL', 200, rep('purple', 3)), pipe('sR', 520, rep('pink', 3), 1500, 1250)],
    solution: { beltL: { dir: -1 }, beltR: { dir: 1 } },
    newToy: { spec: 'purple', title: 'Purple pill', text: 'Long and flat. It slides instead of rolling.' },
  }),
  planLevel({
    id: 'pill-kick',
    name: 'Pill Kick',
    hint: 'Watch which ones the pusher hits',
    machines: [timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }), belt('belt', 300, 830, 200, 1), ...threeBins('yellow', 'purple', 'blue')],
    spawners: [pipe('s1', 300, alt('purple', 'blue', 4), 1500, 350)],
    solution: { ram: { phase: 0.75 } },
  }),
  planLevel({
    id: 'pill-bounce',
    name: 'Pill Bounce',
    hint: 'Light pills, heavy balls',
    machines: [bouncer('pad', 220, 720, [0, 20, 40, -20]), ...threeBins('yellow', 'blue', 'purple')],
    spawners: [pipe('s1', 220, alt('purple', 'blue:heavy', 4))],
    solution: { pad: { angle: 40 } },
  }),
  planLevel({
    id: 'junction',
    name: 'Junction',
    hint: 'Heavy from the middle, pills from the side',
    machines: [
      belt('top', 360, 420, 260, 1),
      belt('lowL', 170, 640, 200, 1, { accent: BELT_B }),
      belt('lowR', 550, 640, 200, -1, { accent: BELT_C }),
      ...fourBins('blue', 'yellow', 'green', 'purple'),
    ],
    spawners: [pipe('s1', 360, rep('blue:heavy', 3)), pipe('s2', 600, rep('purple', 3), 1500, 1250)],
    solution: { top: { dir: -1 }, lowL: { dir: -1 }, lowR: { dir: 1 } },
  }),
  planLevel({
    id: 'pill-pong',
    name: 'Pill Pong',
    hint: 'Both toys land in the middle?',
    machines: [bouncer('padL', 200, 720, [30, -10, 10, -30]), bouncer('padR', 520, 720, [-30, 10, -10, 30]), ...threeBins('blue', 'purple', 'yellow')],
    spawners: [pipe('sL', 200, rep('purple', 3)), pipe('sR', 520, rep('yellow:bouncy', 3), 1500, 1250)],
    solution: { padL: { angle: 10 }, padR: { angle: 10 } },
  }),
  planLevel({
    id: 'bouncy-pills',
    name: 'Bouncy Pills',
    hint: 'A new time for the pusher',
    machines: [timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }), belt('belt', 330, 830, 200, 1), ...threeBins('purple', 'blue', 'yellow')],
    spawners: [pipe('s1', 300, alt('purple', 'yellow:bouncy', 4), 1500, 350)],
    solution: { ram: { phase: 0.5 }, belt: { dir: -1 } },
  }),
  planLevel({
    id: 'last-shift',
    name: 'Last Shift',
    hint: 'Everything you have learned',
    machines: [
      timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }),
      belt('belt', 300, 840, 200, 1),
      bouncer('pad', 640, 860, [-30, 0, 30, 15]),
      ...threeBins('yellow', 'pink', 'purple'),
    ],
    spawners: [pipe('s1', 300, alt('purple', 'yellow:bouncy', 4), 1500, 350)],
    solution: { ram: { phase: 0.25 }, belt: { dir: -1 }, pad: { angle: 0 } },
  }),
  // ---------------------------------------------------------------- World 4: Harbour (levels 31-40)
  // The bins float on the water (they bob, they do not move); a toy that misses them sinks. Then the fan.
  planLevel({
    id: 'afloat',
    name: 'Afloat',
    hint: 'Miss the bins and the toys sink',
    machines: [belt('belt', 360, 520, 300, 1), bin('bin', 150, 'blue', 200)],
    spawners: [pipe('s1', 360, rep('blue', 3))],
    solution: { belt: { dir: -1 } },
    intro: { picture: 'float', title: 'On the water', text: 'The bins float here. A toy that misses them sinks.' },
  }),
  planLevel({
    id: 'breeze',
    name: 'Breeze',
    hint: 'Tap the fan to switch it on',
    machines: [fan('fan', 220, 520, 300, [0, 1]), bin('bin', 600, 'blue', 200)],
    spawners: [pipe('s1', 420, rep('blue', 3))],
    solution: { fan: { power: 1 } },
    tutorial: [{ machine: 'fan', op: 'blow', text: 'Tap the fan to switch it on' }],
    intro: { picture: 'fan', title: 'Fan', text: 'It blows toys sideways. Tap it to switch it on.' },
  }),
  planLevel({
    id: 'weigh-the-wind',
    name: 'Weigh the Wind',
    hint: 'Heavy toys hardly feel the wind',
    machines: [fan('fan', 170, 480, 300, [-1, 0, 1]), bin('binH', 290, 'blue', 172), bin('binL', 520, 'purple', 172)],
    spawners: [pipe('s1', 260, alt('purple', 'blue:heavy', 4))],
    solution: { fan: { power: 1 } },
  }),
  planLevel({
    id: 'crosswind',
    name: 'Crosswind',
    hint: 'Belt first, then the wind',
    machines: [belt('belt', 360, 480, 300, 1), fan('fan', 80, 780, 380, [-1, 0, 1]), bin('binB', 270, 'blue', 172), bin('binP', 450, 'pink', 172)],
    spawners: [pipe('s1', 360, alt('pink', 'blue:heavy', 4))],
    solution: { belt: { dir: -1 }, fan: { power: 1 } },
  }),
  planLevel({
    id: 'sea-breeze',
    name: 'Sea Breeze',
    hint: 'Bounce, then blow',
    machines: [bouncer('pad', 260, 780, [0, -20, 20]), fan('fan', 80, 540, 520, [0, 1]), bin('binB', 450, 'blue', 172), bin('binP', 624, 'pink', 172)],
    spawners: [pipe('s1', 260, alt('blue:heavy', 'pink', 4))],
    solution: { pad: { angle: 20 }, fan: { power: 1 } },
  }),
  planLevel({
    id: 'kick-wind',
    name: 'Kick Wind',
    hint: 'Kick one kind, blow the other',
    machines: [
      timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }),
      fan('fan', 640, 800, 420, [0, -1, 1], { strength: 0.4 }),
      bin('binP', 96, 'pink', 172),
      bin('binY', 270, 'yellow', 172),
    ],
    spawners: [pipe('s1', 300, alt('yellow:bouncy', 'pink', 4), 1500, 350)],
    solution: { ram: { phase: 0.75 }, fan: { power: -1 } },
  }),
  planLevel({
    id: 'updraft',
    name: 'Updraft',
    hint: 'Belts down, wind across',
    machines: [
      belt('top', 400, 420, 240, 1),
      belt('lower', 220, 640, 220, 1, { accent: BELT_B }),
      fan('fan', 640, 760, 420, [0, -1], { strength: 0.4 }),
      bin('binP', 270, 'purple', 172),
      bin('binB', 450, 'blue', 172),
    ],
    spawners: [pipe('s1', 400, alt('purple', 'blue:heavy', 4))],
    solution: { top: { dir: -1 }, fan: { power: -1 } },
  }),
  planLevel({
    id: 'headwind',
    name: 'Headwind',
    hint: 'Into the wind',
    machines: [bouncer('pad', 460, 780, [0, 15, 30, -15]), fan('fan', 640, 440, 520, [0, -1], { strength: 0.4 }), bin('binP', 270, 'purple', 172), bin('binB', 620, 'blue', 172)],
    spawners: [pipe('s1', 460, alt('purple', 'blue:heavy', 4))],
    solution: { pad: { angle: 15 }, fan: { power: -1 } },
  }),
  planLevel({
    id: 'tailwind',
    name: 'Tailwind',
    hint: 'Time the pusher, set the fan',
    machines: [
      timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }),
      fan('fan', 640, 800, 420, [-1, 0], { strength: 0.4 }),
      bin('binP', 96, 'pink', 172),
      bin('binU', 270, 'purple', 172),
    ],
    spawners: [pipe('s1', 300, alt('pink', 'purple', 4), 1500, 350)],
    solution: { ram: { phase: 0.25 }, fan: { power: -1 } },
  }),
  planLevel({
    id: 'storm',
    name: 'Storm',
    hint: 'Pusher, belt and fan',
    machines: [
      timer('ram', 128, 620, 0, 3000, { stroke: 180, extendTicks: 10 }),
      belt('belt', 240, 840, 200, 1),
      fan('fan', 80, 520, 420, [0, 1, -1], { strength: 0.4 }),
      bin('binB', 100, 'blue', 172),
      bin('binP', 620, 'purple', 172),
    ],
    spawners: [pipe('s1', 300, alt('purple', 'blue:heavy', 4), 1500, 350)],
    solution: { ram: { phase: 0.25 }, belt: { dir: -1 }, fan: { power: 1 } },
  }),
];

/** The building blocks, for the level-design scripts. */
export const LEVEL_KIT = { fan, belt, fixedBelt, bouncer, spring, timer, bin, wall, pipe, twoBins, threeBins, fourBins, rep, alt, planLevel, BIN_Y };
