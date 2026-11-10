import type { ObjType } from '../config';
import type { LevelConfig, LevelDef } from '../levels/LevelTypes';
import { PuzzleRules } from '../systems/PuzzleRules';
import { computeStars } from '../systems/ScoreManager';
import { FactoryWorld, type WorldOptions } from './FactoryWorld';

export interface SimResult {
  status: 'won' | 'failed' | 'timeout';
  reason: string;
  ticks: number;
  seconds: number;
  mistakes: number;
  lost: number;
  stars: number;
  delivered: Record<ObjType, number>;
  /** false when the supplied configuration puts a machine somewhere illegal */
  validPlacement: boolean;
}

/**
 * Run a level headlessly to completion with the given machine configuration.
 * Used by automated tests and the level solver to prove levels are solvable.
 */
export function simulateLevel(level: LevelDef, config: LevelConfig = {}, opts: WorldOptions = {}, maxTicks = 60 * 120): SimResult {
  const world = new FactoryWorld(level, opts);
  const rules = new PuzzleRules(world, level);
  world.applyConfig(config);
  let validPlacement = true;
  for (const m of world.machines) {
    if (!m.configurable) continue;
    if (!world.isPlacementValid(m)) validPlacement = false;
    const z = m.def.zone;
    if (m.canMove && z && (m.x < z.x || m.x > z.x + z.w || m.y < z.y || m.y > z.y + z.h)) validPlacement = false;
  }
  world.start();
  let status: SimResult['status'] = 'timeout';
  for (let i = 0; i < maxTicks; i++) {
    world.step();
    const s = rules.update();
    if (s !== 'running') {
      status = s;
      break;
    }
  }
  const seconds = rules.elapsedSeconds;
  const result: SimResult = {
    status,
    reason: rules.failReason,
    ticks: world.tick,
    seconds,
    mistakes: rules.mistakes,
    lost: rules.lost,
    stars: status === 'won' ? computeStars(level, { mistakes: rules.mistakes, lost: rules.lost, seconds }) : 0,
    delivered: { ...rules.delivered },
    validPlacement,
  };
  world.destroy();
  return result;
}
