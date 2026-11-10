// Rank winning configurations of a level by robustness to spawn jitter.
import { search, simulateLevel } from './labkit';
import { LEVELS } from '../src/game/levels/levels';
const n = parseInt(process.argv[2], 10);
const step = parseInt(process.argv[3] ?? '20', 10);
const L = LEVELS[n - 1];
const rep = search(L, step, 20000);
console.log(`${rep.wins.length} wins of ${rep.total}`);
const scored = rep.wins.map((w) => {
  let ok = 0;
  for (let s = 1; s <= 8; s++) if (simulateLevel(L, w.cfg, { seed: s, jitter: 0.6 }).status === 'won') ok++;
  return { ...w, ok };
});
scored.sort((a, b) => b.ok - a.ok);
for (const w of scored.slice(0, 14)) console.log(w.ok + '/8', JSON.stringify(w.cfg), 't=' + w.r.seconds.toFixed(1), 'stars=' + w.r.stars);
