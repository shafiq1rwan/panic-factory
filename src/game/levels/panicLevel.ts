import { GAME_W, PLAY_H } from '../config';
import type { LevelDef } from './LevelTypes';
import { BELT_A, BELT_B } from './levels';

const BIN_Y = PLAY_H - 78;

/**
 * The fixed arena for Panic Factory (endless mode), portrait layout.
 * Two belts side by side, each under its own chute and each with its own
 * button, over three bins: the left chute drops blue and pink toys, the right
 * chute pink and yellow. Blue goes left, pink to the middle, yellow right.
 * The bins span the whole floor, so nothing can fall out of play: the only
 * way to lose a life is sending a toy to the wrong bin.
 */
export const PANIC_LEVEL: LevelDef = {
  id: 'panic',
  name: 'Panic Factory',
  width: GAME_W,
  height: PLAY_H,
  objective: {},
  mistakesAllowed: 0,
  par: 0,
  solution: {},
  // decorative only: they give the drop points their pipes. PanicDirector does the actual spawning.
  spawners: [
    { id: 'chuteL', x: 190, y: 210, sequence: [], interval: 1000 },
    { id: 'chuteR', x: 530, y: 210, sequence: [], interval: 1000 },
  ],
  // posts between the bins: even with turbo belts or low gravity a toy cannot sail past its bin
  walls: [
    { x: 240, y: BIN_Y - 200, w: 20, h: 260 },
    { x: 480, y: BIN_Y - 200, w: 20, h: 260 },
  ],
  machines: [
    { id: 'beltL', kind: 'conveyor', x: 190, y: 600, length: 180, speed: 2.2, dir: 1, flippable: true, interactive: true, accent: BELT_A },
    { id: 'beltR', kind: 'conveyor', x: 530, y: 600, length: 180, speed: 2.2, dir: -1, flippable: true, interactive: true, accent: BELT_B },
    { id: 'binBlue', kind: 'bin', x: 121, y: BIN_Y, accepts: 'blue', width: 232 },
    { id: 'binPink', kind: 'bin', x: 360, y: BIN_Y, accepts: 'pink', width: 232 },
    { id: 'binYellow', kind: 'bin', x: 599, y: BIN_Y, accepts: 'yellow', width: 232 },
  ],
  routes: { beltL: { blue: -1, pink: 1 }, beltR: { pink: -1, yellow: 1 } },
};

/** Where toys appear, and which colours each chute drops. */
export const PANIC_CHUTES = [
  { x: 190, y: 210, types: ['blue', 'pink'] as const },
  { x: 530, y: 210, types: ['pink', 'yellow'] as const },
];
