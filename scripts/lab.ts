import { simulateLevel, trace } from './labkit';
import { LEVELS } from '../src/game/levels/levels';
const n = parseInt(process.argv[2], 10);
const L = JSON.parse(JSON.stringify(LEVELS[n - 1]));
if (process.argv[3] === 'trace') { trace(L, L.solution, parseInt(process.argv[4] ?? '0', 10)); process.exit(0); }
for (let delay = 400; delay <= 2800; delay += 100) {
  L.spawners[0].delay = delay;
  const out: string[] = [];
  for (const phase of [0, 0.25, 0.5, 0.75]) {
    const cfg = { ...L.solution, ram: { phase } };
    const r = simulateLevel(L, cfg);
    let rob = 0;
    if (r.status === 'won') for (let s = 1; s <= 8; s++) if (simulateLevel(L, cfg, { seed: s, jitter: 0.6 }).status === 'won') rob++;
    out.push(r.status === 'won' ? `W${rob}` : `${r.delivered.blue}${r.delivered.pink + r.delivered.yellow}m${r.mistakes}l${r.lost}`);
  }
  console.log(delay, out.join('  '));
}
