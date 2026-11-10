import { GAME_W, PLAY_H } from '../config';
import type { LevelDef } from './LevelTypes';

const BIN_Y = PLAY_H - 78;

/**
 * The fixed arena for Panic Factory (endless mode), portrait layout.
 * A toy lands on the top belt, which feeds the two lower belts; every belt can
 * be flipped by tapping. Blue goes left, yellow right, pink in the middle.
 * The bins and the centre funnel span the full width, so nothing can fall out
 * of play: the only way to lose a life is sending a toy to the wrong bin.
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
  // decorative only: gives the drop point its pipe. PanicDirector does the actual spawning.
  spawners: [{ id: 'chute', x: 360, y: 210, sequence: [], interval: 1000 }],
  walls: [],
  machines: [
    { id: 'top', kind: 'conveyor', x: 360, y: 560, length: 200, speed: 2.2, dir: 1, interactive: true },
    { id: 'left', kind: 'conveyor', x: 165, y: 740, length: 190, speed: 2.2, dir: -1, interactive: true },
    { id: 'right', kind: 'conveyor', x: 555, y: 740, length: 190, speed: 2.2, dir: 1, interactive: true },
    { id: 'fC', kind: 'funnel', x: 360, y: BIN_Y - 116, topWidth: 330, bottomWidth: 140, height: 84 },
    { id: 'binBlue', kind: 'bin', x: 100, y: BIN_Y, accepts: 'blue', width: 190 },
    { id: 'binPink', kind: 'bin', x: 360, y: BIN_Y, accepts: 'pink', width: 190 },
    { id: 'binYellow', kind: 'bin', x: 620, y: BIN_Y, accepts: 'yellow', width: 190 },
  ],
};

export const PANIC_SPAWN = { x: 360, y: 210 };
