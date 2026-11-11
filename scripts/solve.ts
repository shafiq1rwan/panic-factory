/**
 * Level verification for set-up-then-run levels.   npx tsx scripts/solve.ts [level number]
 *
 * For every level it tries every possible setup and checks that:
 *   - pressing RUN without changing anything does NOT win,
 *   - the level's solution wins, also with small random spawn offsets,
 *   - at least one setup wins, and how many do (fewer = harder),
 *   - every run, won or lost, is over within 13 seconds.
 */
import './labkit';
import { LEVELS } from '../src/game/levels/levels';
import { allConfigs, robust, solvePlan } from '../src/game/sim/planSolver';
import { simulateLevel } from '../src/game/sim/simulate';

const only = process.argv[2] ? parseInt(process.argv[2], 10) : 0;
let bad = 0;
let totalSolved = 0;
LEVELS.forEach((level, i) => {
  if (only && only !== i + 1) return;
  const rep = solvePlan(level);
  const sol = simulateLevel(level, level.solution);
  const solid = robust(level, level.solution);
  let longest = 0;
  for (const c of allConfigs(level)) longest = Math.max(longest, simulateLevel(level, c).seconds);
  const ok = rep.idle.status !== 'won' && sol.status === 'won' && solid && rep.wins.length > 0 && longest < 13;
  if (!ok) bad++;
  totalSolved += sol.seconds;
  const toys = level.spawners.reduce((n, s) => n + s.sequence.length, 0);
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} L${String(i + 1).padStart(2)} ${level.name.padEnd(19)} toys=${String(toys).padStart(2)} ` +
      `wins ${rep.wins.length}/${rep.total}  min taps ${rep.minTaps}  idle:${rep.idle.status}  solution:${sol.status}${solid ? '' : ' (FRAGILE)'} in ${sol.seconds.toFixed(1)}s  longest run ${longest.toFixed(1)}s`,
  );
});
if (bad) {
  console.log(`\n${bad} level(s) need attention`);
  process.exit(1);
}
console.log(`\nAll levels verified. One winning run of every level: ${totalSolved.toFixed(0)} s.`);
