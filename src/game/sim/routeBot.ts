import type { LevelDef } from '../levels/LevelTypes';
import { BELT_TOP, ConveyorBelt } from '../machines/ConveyorBelt';
import type { FactoryWorld } from './FactoryWorld';

/**
 * A simple stand-in player for sorting levels. For every flippable belt it
 * looks at the toys riding it (or about to land on it) and points the belt the
 * way the level's `routes` table says the most urgent toy needs to go.
 *
 * `reactionTicks` makes it act only every N ticks, like a person who needs a
 * moment to react. If this bot can clear a level, a human can.
 */
export function makeRouteBot(level: LevelDef, reactionTicks = 1): (world: FactoryWorld) => void {
  const routes = level.routes ?? {};
  return (world) => {
    if (reactionTicks > 1 && world.tick % reactionTicks !== 0) return;
    for (const m of world.machines) {
      if (!(m instanceof ConveyorBelt) || !m.canFlip) continue;
      const want = routes[m.id];
      if (!want) continue;
      const half = m.def.length / 2;
      let best = Infinity;
      let dir = 0;
      for (const o of world.objects) {
        if (Math.abs(o.x - m.x) > half + 14) continue;
        const w = want[o.type];
        if (!w) continue;
        const above = m.y - BELT_TOP - o.y; // > 0 while the toy is above the belt surface
        if (above < 10 || above > 420) continue;
        // toys already riding count by distance to their exit; falling toys queue behind them
        const toExit = w === 1 ? m.x + half - o.x : o.x - (m.x - half);
        const urgency = above < 80 ? toExit : 1000 + above;
        if (urgency < best) {
          best = urgency;
          dir = w;
        }
      }
      if (dir && dir !== m.dir) m.flip();
    }
  };
}
