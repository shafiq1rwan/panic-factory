/**
 * Level lab for set-up-then-run levels.   npx tsx scripts/plan-lab.ts [level number]
 * Tries every setup of each level and prints which ones win.
 */
import './labkit';
import { LEVELS } from '../src/game/levels/levels';
import { allConfigs, robust, solvePlan, tapsFor } from '../src/game/sim/planSolver';
import { simulateLevel } from '../src/game/sim/simulate';

const only = process.argv[2] ? parseInt(process.argv[2], 10) : 0;
LEVELS.forEach((level, i) => {
  if (only && only !== i + 1) return;
  const t0 = Date.now();
  const rep = solvePlan(level);
  const sol = simulateLevel(level, level.solution);
  console.log(`L${i + 1} ${level.name}: ${rep.wins.length}/${rep.total} setups win, idle=${rep.idle.status} (${rep.idle.reason}), min taps=${rep.minTaps}, solution=${sol.status} ${sol.reason} [${Date.now() - t0} ms]`);
  let longest = 0;
  for (const c of allConfigs(level)) longest = Math.max(longest, simulateLevel(level, c).seconds);
  console.log(`   longest run: ${longest.toFixed(1)} s`);
  for (const w of rep.wins) console.log(`   win (${tapsFor(level, w)} taps, robust=${robust(level, w)}): ${JSON.stringify(w)}`);
});
