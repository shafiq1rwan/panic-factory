/**
 * Level verification.   npx tsx scripts/solve.ts [level number]
 *
 * For every sorting level it checks that:
 *   - doing nothing does NOT win,
 *   - a bot that follows the level's routes instantly wins with no slips,
 *   - the same bot with a human-like reaction delay still wins within the allowed slips.
 */
import './labkit';
import { LEVELS } from '../src/game/levels/levels';
import { makeRouteBot } from '../src/game/sim/routeBot';
import { simulateLevel } from '../src/game/sim/simulate';

const only = process.argv[2] ? parseInt(process.argv[2], 10) : 0;
let bad = 0;
LEVELS.forEach((level, i) => {
  if (only && only !== i + 1) return;
  const idle = simulateLevel(level, {});
  const perfect = simulateLevel(level, {}, {}, 60 * 240, makeRouteBot(level, 1));
  const slow: string[] = [];
  let slowOk = true;
  for (const reaction of [12, 18, 24]) {
    const r = simulateLevel(level, {}, { seed: reaction, jitter: 0.6 }, 60 * 240, makeRouteBot(level, reaction));
    slow.push(`${Math.round((reaction * 1000) / 60)}ms:${r.status === 'won' ? r.mistakes + ' slips' : 'FAILED'}`);
    if (r.status !== 'won' && reaction <= 18) slowOk = false;
  }
  const ok = idle.status !== 'won' && perfect.status === 'won' && perfect.mistakes === 0 && perfect.lost === 0 && slowOk;
  if (!ok) bad++;
  const toys = level.spawners.reduce((n, s) => n + s.sequence.length, 0);
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} L${String(i + 1).padStart(2)} ${level.name.padEnd(14)} toys=${String(toys).padStart(2)} ` +
      `idle:${idle.status} perfect:${perfect.status}/${perfect.mistakes}+${perfect.lost} in ${perfect.seconds.toFixed(0)}s  delayed ${slow.join('  ')}`,
  );
});
if (bad) {
  console.log(`\n${bad} level(s) need attention`);
  process.exit(1);
}
console.log('\nAll levels verified.');
