/**
 * Level verification + design aid.
 *   npx tsx scripts/solve.ts            -> check every level (default fails, solution wins, robustness)
 *   npx tsx scripts/solve.ts 4          -> one level (1-based), plus brute-force search of the config space
 *   npx tsx scripts/solve.ts 4 trace    -> also print a physics event trace of the intended solution
 */
import { fmt, search, simulateLevel, trace } from './labkit';
import { LEVELS } from '../src/game/levels/levels';

const arg = process.argv[2];
const only = arg ? parseInt(arg, 10) : 0;
const mode = process.argv[3] ?? '';
let bad = 0;

LEVELS.forEach((level, i) => {
  if (only && only !== i + 1) return;
  const def = simulateLevel(level, {});
  const sol = simulateLevel(level, level.solution);
  let robust = 0;
  const N = 8;
  for (let s = 1; s <= N; s++) if (simulateLevel(level, level.solution, { seed: s, jitter: 0.6 }).status === 'won') robust++;
  const ok = sol.status === 'won' && sol.validPlacement && def.status !== 'won' && robust === N && sol.stars === 3;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} L${i + 1} ${level.name}`);
  console.log(`     default : ${fmt(def)}`);
  console.log(`     solution: ${fmt(sol)}  robust ${robust}/${N}  par=${level.par}`);
  if (only) {
    const rep = search(level, mode === 'fine' ? 20 : 40);
    console.log(`     search: ${rep.wins.length} winning of ${rep.total} configurations`);
    for (const w of rep.wins.slice(0, 12)) console.log('       ', JSON.stringify(w.cfg), fmt(w.r));
    if (mode === 'trace') trace(level, level.solution);
    if (mode === 'trace0') trace(level, {});
  }
});
if (bad) {
  console.log(`\n${bad} level(s) need attention`);
  process.exit(1);
}
console.log('\nAll levels verified.');
