import { GAME_H, GAME_W } from '../config';
import type { LevelDef } from './LevelTypes';

/**
 * The fixed arena for Panic Factory (endless mode).
 * A toy lands on the top belt, which feeds the two lower belts; every belt can
 * be flipped by tapping. Blue goes far left, yellow far right, pink in the middle.
 * The little roofs between the funnels make sure nothing can fall out of play,
 * so the only way to lose a life is sending a toy to the wrong bin.
 */
export const PANIC_LEVEL: LevelDef = {
  id: 'panic',
  name: 'Panic Factory',
  width: GAME_W,
  height: GAME_H,
  objective: {},
  mistakesAllowed: 0,
  par: 0,
  solution: {},
  // decorative only: gives the drop point its pipe. PanicDirector does the actual spawning.
  spawners: [{ id: 'chute', x: 640, y: 130, sequence: [], interval: 1000 }],
  walls: [
    // roofs between the funnels and guards at the screen edges: nothing can fall out of play
    { x: 388, y: 536, w: 76, h: 16, angle: -22 },
    { x: 447, y: 536, w: 76, h: 16, angle: 22 },
    { x: 833, y: 536, w: 76, h: 16, angle: -22 },
    { x: 892, y: 536, w: 76, h: 16, angle: 22 },
    { x: 66, y: 512, w: 160, h: 16, angle: 26 },
    { x: 1214, y: 512, w: 160, h: 16, angle: -26 },
  ],
  machines: [
    { id: 'top', kind: 'conveyor', x: 640, y: 230, length: 240, speed: 2.2, dir: 1, interactive: true },
    { id: 'left', kind: 'conveyor', x: 400, y: 400, length: 200, speed: 2.2, dir: -1, interactive: true },
    { id: 'right', kind: 'conveyor', x: 880, y: 400, length: 200, speed: 2.2, dir: 1, interactive: true },
    { id: 'fL', kind: 'funnel', x: 240, y: 532, topWidth: 250, bottomWidth: 130, height: 70 },
    { id: 'fC', kind: 'funnel', x: 640, y: 532, topWidth: 330, bottomWidth: 130, height: 70 },
    { id: 'fR', kind: 'funnel', x: 1040, y: 532, topWidth: 250, bottomWidth: 130, height: 70 },
    { id: 'binBlue', kind: 'bin', x: 240, y: 646, accepts: 'blue' },
    { id: 'binPink', kind: 'bin', x: 640, y: 646, accepts: 'pink' },
    { id: 'binYellow', kind: 'bin', x: 1040, y: 646, accepts: 'yellow' },
  ],
};

export const PANIC_SPAWN = { x: 640, y: 130 };
