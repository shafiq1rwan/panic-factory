import { GAME_W, PLAY_H } from '../config';
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
  id, x, y: 136, sequence, interval, ...o,
});
const rep = (spec: SpawnSpec, n: number): SpawnSpec[] => Array.from({ length: n }, () => spec);
const alt = (a: SpawnSpec, b: SpawnSpec, pairs: number): SpawnSpec[] =>
  Array.from({ length: pairs * 2 }, (_, i) => (i % 2 === 0 ? a : b));

/** Portrait play field: 720 wide, from the top bar down to the control strip. */
const base = { width: GAME_W, height: PLAY_H };
/** Centre y for a standard bin standing on the bottom edge. */
const BIN_Y = PLAY_H - 78;

/**
 * The 15 handcrafted puzzle levels (portrait, 720 wide).
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
    spawners: [spawner('s1', 250, rep('blue', 3), 1400)],
    walls: [],
    machines: [
      conveyor('belt', 300, 420, 320, { dir: -1, flippable: true }),
      round('bumper', 440, 600),
      bin('bin', 560, BIN_Y, 'blue', { width: 270 }),
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
    spawners: [spawner('sA', 200, rep('blue', 3), 1500), spawner('sB', 520, rep('pink', 3), 1500, { delay: 1100 })],
    walls: [],
    machines: [
      conveyor('beltA', 200, 380, 240, { dir: 1, flippable: true }),
      conveyor('beltB', 520, 560, 240, { dir: -1, flippable: true }),
      bin('binBlue', 125, BIN_Y, 'blue', { width: 230 }),
      bin('binPink', 595, BIN_Y, 'pink', { width: 230 }),
    ],
    tutorial: [
      { machine: 'beltA', op: 'flip', text: 'Blue toys go in the blue bin' },
      { machine: 'beltB', op: 'flip', text: 'Pink toys go in the pink bin' },
    ],
    solution: { beltA: { dir: -1 }, beltB: { dir: 1 } },
  },
  {
    ...base,
    id: 'uphill',
    name: 'Uphill',
    hint: 'Tilt the belt',
    objective: { pink: 4 },
    mistakesAllowed: 0,
    par: 18,
    spawners: [spawner('s1', 270, rep('pink', 4), 1500)],
    walls: [wall(570, 924, 44, 440)],
    machines: [
      conveyor('belt', 300, 640, 340, { speed: 4, rotatable: true, angleMin: -30, angleMax: 30 }),
      bin('bin', 570, 640, 'pink', { width: 170, height: 120 }),
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
    spawners: [spawner('s1', 180, rep('blue', 4), 1500)],
    walls: [],
    machines: [
      pad('spring', 420, 760, 30, { power: 8, movable: true, zone: { x: 150, y: 760, w: 270, h: 0 } }),
      bin('bin', 520, BIN_Y, 'blue', { width: 260 }),
    ],
    tutorial: [{ machine: 'spring', op: 'move', text: 'Drag the spring under the toys' }],
    solution: { spring: { x: 180, y: 760 } },
  },
  {
    ...base,
    id: 'aim-high',
    name: 'Aim High',
    hint: 'Aim over the wall',
    objective: { yellow: 4 },
    mistakesAllowed: 0,
    par: 18,
    spawners: [spawner('s1', 160, rep('yellow', 4), 1600)],
    walls: [wall(340, 870, 30, 360)],
    machines: [
      pad('spring', 160, 800, -30, { rotatable: true, power: 9 }),
      bin('bin', 545, BIN_Y, 'yellow', { width: 300 }),
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
    spawners: [spawner('sA', 120, rep('blue', 3), 1700), spawner('sB', 620, rep('pink', 3), 1700, { delay: 1200 })],
    walls: [],
    machines: [
      pad('springA', 120, 620, -30, { rotatable: true, power: 8 }),
      pad('springC', 410, 800, 30, { power: 8 }),
      pad('springB', 440, 420, -30, { power: 8, movable: true, zone: { x: 440, y: 420, w: 180, h: 0 } }),
      bin('binPink', 150, BIN_Y, 'pink', { width: 250 }),
      bin('binBlue', 590, BIN_Y, 'blue', { width: 220 }),
    ],
    solution: { springA: { angle: 30 }, springB: { x: 590, y: 420 } },
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
    spawners: [spawner('s1', 380, rep('pink', 4), 2000)],
    walls: [wall(380, 590, 150, 24), wall(650, 600, 30, 400)],
    machines: [
      piston('ram', 110, 540, 0, { stroke: 150, period: 2000, extendTicks: 26, movable: true, zone: { x: 110, y: 540, w: 80, h: 0 } }),
      bin('bin', 560, BIN_Y, 'pink', { width: 250 }),
    ],
    tutorial: [{ machine: 'ram', op: 'move', text: 'Slide the pusher up to the toys' }],
    solution: { ram: { x: 190, y: 540 } },
  },
  {
    ...base,
    id: 'take-turns',
    name: 'Take Turns',
    hint: 'Set the timer',
    objective: { blue: 3, pink: 3 },
    mistakesAllowed: 1,
    par: 30,
    spawners: [spawner('s1', 260, alt('blue', 'pink', 3), 2400, { delay: 650 })],
    walls: [],
    machines: [
      conveyor('belt', 300, 500, 160, { speed: 1.5 }),
      piston('ram', 571, 448, 180, { stroke: 150, period: 4800, extendTicks: 16, timing: true }),
      bin('binBlue', 115, BIN_Y, 'blue', { width: 220 }),
      bin('binPink', 440, BIN_Y, 'pink', { width: 210 }),
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
    spawners: [spawner('s1', 160, rep('pink', 4), 2000)],
    walls: [wall(440, 520, 160, 24)],
    machines: [
      conveyor('belt', 220, 330, 240, { dir: -1, flippable: true }),
      piston('ram', 250, 470, 0, { stroke: 150, period: 2000, extendTicks: 26 }),
      pad('spring', 640, 860, 0, { rotatable: true, power: 9 }),
      bin('bin', 200, BIN_Y, 'pink', { width: 270 }),
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
    spawners: [spawner('s1', 260, alt('blue', 'yellow', 3), 2400, { delay: 950 })],
    walls: [],
    machines: [
      conveyor('belt', 300, 330, 160, { speed: 1.5 }),
      piston('ram', 571, 278, 180, { stroke: 150, period: 4800, extendTicks: 16, timing: true }),
      pad('spring', 190, 900, -30, { rotatable: true, power: 9 }),
      conveyor('belt2', 430, 620, 220, { dir: -1, flippable: true }),
      bin('binBlue', 440, BIN_Y, 'blue', { width: 180 }),
      bin('binYellow', 620, BIN_Y, 'yellow', { width: 180 }),
    ],
    solution: { ram: { phase: 0.5 }, spring: { angle: 15 }, belt2: { dir: 1 } },
  },
  {
    ...base,
    id: 'crossfire',
    name: 'Crossfire',
    hint: 'Swap sides in mid-air',
    objective: { blue: 3, pink: 3 },
    mistakesAllowed: 1,
    par: 24,
    spawners: [spawner('sA', 90, rep('blue', 3), 1800), spawner('sB', 630, rep('pink', 3), 1800, { delay: 1300 })],
    walls: [],
    machines: [
      conveyor('beltA', 130, 330, 180, { dir: -1, flippable: true }),
      conveyor('beltB', 590, 330, 180, { dir: 1, flippable: true }),
      pad('springA', 270, 760, 0, { rotatable: true, power: 10 }),
      pad('springB', 450, 760, 0, { rotatable: true, power: 10 }),
      bin('binPink', 110, BIN_Y, 'pink', { width: 200 }),
      bin('binBlue', 610, BIN_Y, 'blue', { width: 200 }),
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
    spawners: [spawner('s1', 260, alt('blue', 'pink', 3), 2400, { delay: 950 })],
    walls: [wall(420, 1024, 44, 240)],
    machines: [
      conveyor('belt', 300, 330, 160, { speed: 1.5 }),
      piston('ram', 571, 278, 180, { stroke: 150, period: 4800, extendTicks: 16, timing: true }),
      conveyor('tilt', 180, 820, 280, { speed: 4, rotatable: true, angleMin: -30, angleMax: 30 }),
      bin('binBlue', 420, 840, 'blue', { width: 170, height: 120 }),
      pad('spring', 570, 540, 30, { power: 7, movable: true, zone: { x: 420, y: 540, w: 150, h: 0 } }),
      bin('binPink', 620, BIN_Y, 'pink', { width: 190 }),
    ],
    solution: { ram: { phase: 0.5 }, tilt: { angle: -30 }, spring: { x: 450, y: 540 } },
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
    spawners: [spawner('s1', 110, alt('blue', 'pink:heavy', 3), 1900)],
    walls: [],
    machines: [
      conveyor('belt', 150, 330, 200, { dir: -1, flippable: true }),
      pad('spring', 220, 900, 0, { power: 9, rotatable: true, movable: true, zone: { x: 220, y: 900, w: 160, h: 0 } }),
      bin('binPink', 430, BIN_Y, 'pink', { width: 170 }),
      bin('binBlue', 620, BIN_Y, 'blue', { width: 190 }),
    ],
    solution: { belt: { dir: 1 }, spring: { x: 300, y: 900, angle: 15 } },
  },
  {
    ...base,
    id: 'slip-n-slide',
    name: 'Slip and Slide',
    hint: 'Icy toys slide downhill',
    objective: { pink: 3, yellow: 3 },
    mistakesAllowed: 1,
    par: 28,
    spawners: [spawner('s1', 360, alt('pink', 'yellow:slippery', 3), 2000)],
    walls: [wall(600, 874, 44, 540)],
    machines: [
      conveyor('tilt', 360, 520, 280, { speed: 3, rotatable: true, angleMin: -30, angleMax: 30 }),
      bin('binPink', 600, 540, 'pink', { width: 170, height: 120 }),
      pad('spring', 300, 860, 30, { power: 7, movable: true, zone: { x: 80, y: 860, w: 220, h: 0 } }),
      bin('binYellow', 330, BIN_Y, 'yellow', { width: 220 }),
    ],
    solution: { tilt: { angle: -30 }, spring: { x: 80, y: 860 } },
  },
  {
    ...base,
    id: 'factory-panic',
    name: 'Factory Panic',
    hint: 'Everything at once!',
    objective: { blue: 4, pink: 4 },
    mistakesAllowed: 2,
    par: 44,
    spawners: [spawner('s1', 150, alt('blue', 'pink', 4), 2400, { delay: 900 })],
    walls: [wall(420, 1099, 44, 90)],
    machines: [
      conveyor('feeder', 200, 300, 200, { dir: -1, flippable: true }),
      conveyor('belt', 340, 480, 160, { speed: 1.5 }),
      piston('ram', 611, 428, 180, { stroke: 150, period: 4800, extendTicks: 16, timing: true }),
      conveyor('tilt', 180, 970, 280, { speed: 4, rotatable: true, angleMin: -30, angleMax: 30 }),
      bin('binBlue', 420, 990, 'blue', { width: 170, height: 120 }),
      pad('spring', 610, 690, 30, { power: 7, movable: true, zone: { x: 460, y: 690, w: 150, h: 0 } }),
      bin('binPink', 620, BIN_Y, 'pink', { width: 190 }),
    ],
    solution: { feeder: { dir: 1 }, ram: { phase: 0.5 }, tilt: { angle: -30 }, spring: { x: 470, y: 690 } },
  },
];
