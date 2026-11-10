import { GAME_H, GAME_W } from '../config';
import type {
  BinDef,
  BumperDef,
  ConveyorDef,
  FunnelDef,
  LevelDef,
  PistonDef,
  SpawnSpec,
  SpawnerDef,
  WallDef,
} from './LevelTypes';

// --- tiny authoring helpers ---------------------------------------------------

type Extra<T> = Partial<Omit<T, 'id' | 'kind' | 'x' | 'y'>>;

const conveyor = (id: string, x: number, y: number, length: number, o: Extra<ConveyorDef> = {}): ConveyorDef => ({
  id, kind: 'conveyor', x, y, length, speed: 2.5, ...o,
});
const round = (id: string, x: number, y: number, o: Extra<BumperDef> = {}): BumperDef => ({
  id, kind: 'bumper', shape: 'round', x, y, ...o,
});
const pad = (id: string, x: number, y: number, angle: number, o: Extra<BumperDef> = {}): BumperDef => ({
  id, kind: 'bumper', shape: 'pad', x, y, angle, angleMin: -60, angleMax: 60, ...o,
});
const piston = (id: string, x: number, y: number, angle: number, o: Extra<PistonDef> = {}): PistonDef => ({
  id, kind: 'piston', x, y, angle, ...o,
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const funnel = (id: string, x: number, y: number, o: Extra<FunnelDef> = {}): FunnelDef => ({
  id, kind: 'funnel', x, y, ...o,
});
const bin = (id: string, x: number, y: number, accepts: BinDef['accepts'], o: Extra<BinDef> = {}): BinDef => ({
  id, kind: 'bin', x, y, accepts, ...o,
});
const wall = (x: number, y: number, w: number, h: number, angle = 0): WallDef => ({ x, y, w, h, angle });
const spawner = (id: string, x: number, sequence: SpawnSpec[], interval: number, o: Partial<SpawnerDef> = {}): SpawnerDef => ({
  id, x, y: 130, sequence, interval, ...o,
});
const rep = (spec: SpawnSpec, n: number): SpawnSpec[] => Array.from({ length: n }, () => spec);
const alt = (a: SpawnSpec, b: SpawnSpec, pairs: number): SpawnSpec[] =>
  Array.from({ length: pairs * 2 }, (_, i) => (i % 2 === 0 ? a : b));

const base = { width: GAME_W, height: GAME_H };

/**
 * The 15 handcrafted puzzle levels.
 *
 * Every level carries its intended `solution`. `npm run solve` and the test
 * suite replay each solution headlessly (plus jittered variants) to prove the
 * level is solvable, and check that the untouched default layout does NOT win.
 */
export const LEVELS: LevelDef[] = [
  // ---------------------------------------------------------------- 1-3 Learning
  {
    ...base,
    id: 'first-shift',
    name: 'First Shift',
    hint: 'Tap the belt to flip it',
    objective: { blue: 3 },
    mistakesAllowed: 0,
    par: 14,
    spawners: [spawner('s1', 300, rep('blue', 3), 1400)],
    walls: [],
    machines: [
      conveyor('belt', 400, 300, 360, { dir: -1, flippable: true }),
      round('bumper', 600, 470),
      bin('bin', 1090, 640, 'blue', { width: 240 }),
    ],
    tutorial: [{ machine: 'belt', op: 'flip', text: 'Tap the belt to flip it!' }],
    solution: { belt: { dir: 1 } },
  },
  {
    ...base,
    id: 'color-match',
    name: 'Color Match',
    hint: 'Send each toy to its own bin',
    objective: { blue: 3, pink: 3 },
    mistakesAllowed: 1,
    par: 16,
    spawners: [spawner('sA', 350, rep('blue', 3), 1500), spawner('sB', 930, rep('pink', 3), 1500, { delay: 1100 })],
    walls: [],
    machines: [
      conveyor('beltA', 350, 300, 300, { dir: 1, flippable: true }),
      conveyor('beltB', 930, 300, 300, { dir: 1, flippable: true }),
      bin('binBlue', 140, 640, 'blue', { width: 220 }),
      bin('binPink', 640, 640, 'pink', { width: 270 }),
    ],
    tutorial: [
      { machine: 'beltA', op: 'flip', text: 'Blue toys go in the blue bin' },
      { machine: 'beltB', op: 'flip', text: 'Pink toys go in the pink bin' },
    ],
    solution: { beltA: { dir: -1 }, beltB: { dir: -1 } },
  },
  {
    ...base,
    id: 'uphill',
    name: 'Uphill',
    hint: 'Tilt the belt',
    objective: { pink: 4 },
    mistakesAllowed: 0,
    par: 18,
    spawners: [spawner('s1', 400, rep('pink', 4), 1500)],
    walls: [wall(700, 603, 44, 236)],
    machines: [
      conveyor('belt', 430, 430, 340, { speed: 4, rotatable: true, angleMin: -30, angleMax: 30 }),
      bin('bin', 700, 420, 'pink', { width: 180, height: 120 }),
    ],
    tutorial: [{ machine: 'belt', op: 'rotate', text: 'Tilt the belt up' }],
    solution: { belt: { angle: -15 } },
  },
  // ---------------------------------------------------------------- 4-6 Bouncing
  {
    ...base,
    id: 'boing',
    name: 'Boing!',
    hint: 'Drag the spring under the toys',
    objective: { blue: 4 },
    mistakesAllowed: 0,
    par: 18,
    spawners: [spawner('s1', 300, rep('blue', 4), 1500)],
    walls: [],
    machines: [
      pad('spring', 480, 520, 30, { movable: true, zone: { x: 200, y: 520, w: 280, h: 0 } }),
      bin('bin', 700, 640, 'blue', { width: 250 }),
    ],
    tutorial: [{ machine: 'spring', op: 'move', text: 'Drag the spring under the toys' }],
    solution: { spring: { x: 300, y: 520 } },
  },
  {
    ...base,
    id: 'aim-high',
    name: 'Aim High',
    hint: 'Aim over the wall',
    objective: { yellow: 4 },
    mistakesAllowed: 0,
    par: 18,
    spawners: [spawner('s1', 260, rep('yellow', 4), 1600)],
    walls: [wall(500, 575, 30, 300)],
    machines: [
      pad('spring', 260, 520, -30, { rotatable: true }),
      bin('bin', 665, 640, 'yellow', { width: 270 }),
    ],
    tutorial: [{ machine: 'spring', op: 'rotate', text: 'Turn the spring to aim' }],
    solution: { spring: { angle: 30 } },
  },
  {
    ...base,
    id: 'double-bounce',
    name: 'Double Bounce',
    hint: 'Two springs, two colors',
    objective: { blue: 3, pink: 3 },
    mistakesAllowed: 1,
    par: 20,
    spawners: [spawner('sA', 160, rep('blue', 3), 1700), spawner('sB', 1200, rep('pink', 3), 1700, { delay: 1200 })],
    walls: [],
    machines: [
      pad('springA', 160, 540, -30, { rotatable: true }),
      pad('springC', 520, 540, 30),
      pad('springB', 1050, 500, -30, { power: 12.5, movable: true, zone: { x: 1050, y: 500, w: 150, h: 0 } }),
      bin('binPink', 725, 640, 'pink'),
      bin('binBlue', 935, 640, 'blue'),
    ],
    solution: { springA: { angle: 45 }, springB: { x: 1140, y: 500 } },
  },
  // ---------------------------------------------------------------- 7-9 Machinery
  {
    ...base,
    id: 'push-it',
    name: 'Push It',
    hint: 'Slide the pusher into place',
    objective: { pink: 4 },
    mistakesAllowed: 0,
    par: 22,
    spawners: [spawner('s1', 420, rep('pink', 4), 2000)],
    walls: [wall(410, 400, 160, 24), wall(770, 360, 30, 330)],
    machines: [
      piston('ram', 110, 350, 0, { stroke: 150, period: 2000, extendTicks: 26, movable: true, zone: { x: 110, y: 350, w: 100, h: 0 } }),
      bin('bin', 620, 640, 'pink', { width: 260 }),
    ],
    tutorial: [{ machine: 'ram', op: 'move', text: 'Slide the pusher up to the toys' }],
    solution: { ram: { x: 210, y: 350 } },
  },
  {
    ...base,
    id: 'take-turns',
    name: 'Take Turns',
    hint: 'Set the timer',
    objective: { blue: 3, pink: 3 },
    mistakesAllowed: 1,
    par: 30,
    spawners: [spawner('s1', 650, alt('blue', 'pink', 3), 2400, { delay: 900 })],
    walls: [wall(330, 400, 30, 300)],
    machines: [
      conveyor('belt', 690, 400, 160, { speed: 1.5 }),
      piston('ram', 961, 348, 180, { stroke: 150, period: 4800, extendTicks: 16, timing: true }),
      bin('binBlue', 475, 640, 'blue', { width: 250 }),
      bin('binPink', 830, 640, 'pink', { width: 210 }),
    ],
    tutorial: [{ machine: 'ram', op: 'timing', text: 'Tap the pusher to set its timer' }],
    solution: { ram: { phase: 0.5 } },
  },
  {
    ...base,
    id: 'assembly-line',
    name: 'Assembly Line',
    hint: 'Belt, pusher, spring!',
    objective: { pink: 4 },
    mistakesAllowed: 0,
    par: 26,
    spawners: [spawner('s1', 230, rep('pink', 4), 2000)],
    walls: [wall(520, 420, 160, 24), wall(705, 380, 30, 260)],
    machines: [
      conveyor('belt', 300, 250, 260, { dir: -1, flippable: true }),
      piston('ram', 270, 370, 0, { stroke: 150, period: 2000, extendTicks: 26 }),
      pad('spring', 640, 610, 0, { rotatable: true }),
      bin('bin', 290, 650, 'pink', { width: 260 }),
    ],
    solution: { belt: { dir: 1 }, spring: { angle: -45 } },
  },
  // ---------------------------------------------------------------- 10-12 Chain reactions
  {
    ...base,
    id: 'relay',
    name: 'Relay',
    hint: 'Split them up, then pass them on',
    objective: { blue: 3, yellow: 3 },
    mistakesAllowed: 1,
    par: 32,
    spawners: [spawner('s1', 650, alt('blue', 'yellow', 3), 2400, { delay: 1000 })],
    walls: [wall(330, 270, 30, 300)],
    machines: [
      conveyor('belt', 690, 270, 160, { speed: 1.5 }),
      piston('ram', 961, 220, 180, { stroke: 150, period: 4800, extendTicks: 16, timing: true }),
      pad('spring', 430, 570, -30, { rotatable: true }),
      conveyor('belt2', 840, 470, 220, { dir: -1, flippable: true }),
      bin('binBlue', 640, 640, 'blue'),
      bin('binYellow', 1030, 640, 'yellow'),
    ],
    solution: { ram: { phase: 0.5 }, spring: { angle: 15 }, belt2: { dir: 1 } },
  },
  {
    ...base,
    id: 'crossfire',
    name: 'Crossfire',
    hint: 'Swap sides over the wall',
    objective: { blue: 3, pink: 3 },
    mistakesAllowed: 1,
    par: 24,
    spawners: [spawner('sA', 110, rep('blue', 3), 1800), spawner('sB', 1170, rep('pink', 3), 1800, { delay: 1300 })],
    walls: [wall(640, 575, 30, 300)],
    machines: [
      conveyor('beltA', 150, 250, 180, { dir: -1, flippable: true }),
      conveyor('beltB', 1130, 250, 180, { dir: 1, flippable: true }),
      pad('springA', 330, 540, 0, { rotatable: true, power: 12.5 }),
      pad('springB', 950, 540, 0, { rotatable: true, power: 12.5 }),
      bin('binPink', 500, 645, 'pink', { width: 180 }),
      bin('binBlue', 780, 645, 'blue', { width: 180 }),
    ],
    solution: { beltA: { dir: 1 }, beltB: { dir: -1 }, springA: { angle: 30 }, springB: { angle: -30 } },
  },
  {
    ...base,
    id: 'up-and-over',
    name: 'Up and Over',
    hint: 'Timer, tilt and spring',
    objective: { blue: 3, pink: 3 },
    mistakesAllowed: 1,
    par: 34,
    spawners: [spawner('s1', 650, alt('blue', 'pink', 3), 2400, { delay: 1000 })],
    walls: [wall(330, 270, 30, 300), wall(640, 682, 44, 76)],
    machines: [
      conveyor('belt', 690, 270, 160, { speed: 1.5 }),
      piston('ram', 961, 220, 180, { stroke: 150, period: 4800, extendTicks: 16, timing: true }),
      conveyor('tilt', 380, 560, 320, { speed: 4, rotatable: true, angleMin: -30, angleMax: 30 }),
      bin('binBlue', 640, 580, 'blue', { width: 180, height: 120 }),
      pad('spring', 1010, 500, 30, { power: 10, movable: true, zone: { x: 850, y: 500, w: 160, h: 0 } }),
      bin('binPink', 1160, 640, 'pink'),
    ],
    solution: { ram: { phase: 0.5 }, tilt: { angle: -15 }, spring: { x: 860, y: 500 } },
  },
  // ---------------------------------------------------------------- 13-15 Factory panic
  {
    ...base,
    id: 'heavyweights',
    name: 'Heavyweights',
    hint: 'Heavy toys do not fly far',
    objective: { blue: 3, pink: 3 },
    mistakesAllowed: 1,
    par: 26,
    spawners: [spawner('s1', 230, alt('blue', 'pink:heavy', 3), 1900)],
    walls: [],
    machines: [
      conveyor('belt', 300, 260, 260, { dir: -1, flippable: true }),
      pad('spring', 400, 540, 0, { power: 13, rotatable: true, movable: true, zone: { x: 400, y: 540, w: 160, h: 0 } }),
      bin('binPink', 740, 640, 'pink', { width: 180 }),
      bin('binBlue', 1050, 640, 'blue'),
    ],
    solution: { belt: { dir: 1 }, spring: { x: 480, y: 540, angle: 30 } },
  },
  {
    ...base,
    id: 'slip-n-slide',
    name: 'Slip and Slide',
    hint: 'Icy toys slide downhill',
    objective: { pink: 3, yellow: 3 },
    mistakesAllowed: 1,
    par: 28,
    spawners: [spawner('s1', 520, alt('pink', 'yellow:slippery', 3), 2000)],
    walls: [wall(760, 603, 44, 236)],
    machines: [
      conveyor('tilt', 520, 400, 280, { speed: 3, rotatable: true, angleMin: -30, angleMax: 30 }),
      bin('binPink', 760, 420, 'pink', { width: 180, height: 120 }),
      pad('spring', 440, 600, -30, { power: 8, movable: true, zone: { x: 280, y: 600, w: 160, h: 0 } }),
      bin('binYellow', 130, 645, 'yellow', { width: 220 }),
    ],
    solution: { tilt: { angle: -30 }, spring: { x: 320, y: 600 } },
  },
  {
    ...base,
    id: 'factory-panic',
    name: 'Factory Panic',
    hint: 'Everything at once!',
    objective: { blue: 3, pink: 3, yellow: 3, green: 3 },
    mistakesAllowed: 2,
    par: 36,
    spawners: [
      spawner('s1', 855, alt('blue', 'pink', 3), 2400, { delay: 1000 }),
      spawner('s2', 100, alt('yellow', 'green:heavy', 3), 2400, { delay: 300 }),
    ],
    walls: [wall(555, 270, 30, 300)],
    machines: [
      conveyor('belt', 895, 270, 160, { speed: 1.5 }),
      piston('ram', 1166, 220, 180, { stroke: 150, period: 4800, extendTicks: 16, timing: true }),
      pad('springB', 650, 560, -30, { rotatable: true }),
      conveyor('belt2', 1040, 470, 200, { dir: -1, flippable: true }),
      pad('springH', 100, 480, 0, { rotatable: true }),
      bin('binGreen', 270, 645, 'green', { width: 170 }),
      bin('binYellow', 485, 645, 'yellow', { width: 170 }),
      bin('binBlue', 870, 645, 'blue', { width: 170 }),
      bin('binPink', 1190, 645, 'pink', { width: 170 }),
    ],
    solution: { ram: { phase: 0.5 }, springB: { angle: 15 }, belt2: { dir: 1 }, springH: { angle: 30 } },
  },
];
