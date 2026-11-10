// Level design helpers shared by scripts/solve.ts and scratch experiments.
import '../src/tests/nodeMatter';
import { FactoryWorld } from '../src/game/sim/FactoryWorld';
import { simulateLevel, type SimResult } from '../src/game/sim/simulate';
import type { LevelConfig, LevelDef, MachineConfig, MachineDef } from '../src/game/levels/LevelTypes';

/** Print the key physics events of one run. */
export function trace(level: LevelDef, cfg: LevelConfig = {}, every = 0, maxTicks = 2400): void {
  const w = new FactoryWorld(level);
  w.applyConfig(cfg);
  const f = (n: number) => n.toFixed(0);
  w.events.on('spawn', (o: any) => console.log(w.tick, 'spawn', o.id, o.type));
  w.events.on('bump', (m: any, o: any) => console.log(w.tick, 'bump', m.id, o.id, f(o.x), f(o.y), 'v', o.body.velocity.x.toFixed(1), o.body.velocity.y.toFixed(1)));
  w.events.on('deliver', (o: any, b: any, ok: boolean) => console.log(w.tick, 'deliver', o.id, o.type, '->', b.id, ok ? 'OK' : 'WRONG'));
  w.events.on('lost', (o: any) => console.log(w.tick, 'lost', o.id, o.type, f(o.x), f(o.y)));
  w.events.on('pistonFire', (p: any) => console.log(w.tick, 'fire', p.id));
  w.start();
  for (let i = 0; i < maxTicks; i++) {
    w.step();
    if (every && i % every === 0)
      for (const o of w.objects) console.log('   ', w.tick, o.id, o.type, f(o.x), f(o.y), 'v', o.body.velocity.x.toFixed(1), o.body.velocity.y.toFixed(1));
    if (w.allSpawned && w.objects.length === 0) break;
  }
  if (w.objects.length) console.log('still active:', w.objects.map((o) => `${o.type}@${f(o.x)},${f(o.y)}`).join(' '));
  w.destroy();
}

function optionsFor(m: MachineDef, moveStep: number): MachineConfig[] {
  let opts: MachineConfig[] = [{}];
  const mul = (vals: MachineConfig[]) => {
    const out: MachineConfig[] = [];
    for (const a of opts) for (const b of vals) out.push({ ...a, ...b });
    opts = out;
  };
  if (m.kind === 'conveyor' && m.flippable) mul([{ dir: 1 }, { dir: -1 }]);
  if (m.kind === 'piston' && m.timing) mul([{ phase: 0 }, { phase: 0.25 }, { phase: 0.5 }, { phase: 0.75 }]);
  if (m.rotatable) {
    const step = m.angleStep ?? 15;
    const vals: MachineConfig[] = [];
    for (let a = m.angleMin ?? -45; a <= (m.angleMax ?? 45); a += step) vals.push({ angle: a });
    mul(vals);
  }
  if (m.movable && m.zone) {
    const z = m.zone;
    const vals: MachineConfig[] = [];
    for (let x = z.x; x <= z.x + z.w; x += moveStep) for (let y = z.y; y <= z.y + z.h; y += moveStep) vals.push({ x, y });
    mul(vals);
  }
  return opts;
}

export interface SearchReport {
  total: number;
  wins: { cfg: LevelConfig; r: SimResult }[];
}

/** Brute-force the player's configuration space of a level. */
export function search(level: LevelDef, moveStep = 40, limit = 6000): SearchReport {
  const ms = level.machines.filter((m) => optionsFor(m, moveStep).length > 1);
  const lists = ms.map((m) => optionsFor(m, moveStep));
  const total = lists.reduce((a, l) => a * l.length, 1);
  const wins: SearchReport['wins'] = [];
  if (total > limit) {
    console.log(`  search space ${total} > limit ${limit}, skipping`);
    return { total, wins };
  }
  const idx = lists.map(() => 0);
  for (let n = 0; n < total; n++) {
    const cfg: LevelConfig = {};
    ms.forEach((m, i) => (cfg[m.id] = lists[i][idx[i]]));
    const r = simulateLevel(level, cfg);
    if (r.status === 'won' && r.validPlacement) wins.push({ cfg, r });
    for (let i = 0; i < idx.length; i++) {
      if (++idx[i] < lists[i].length) break;
      idx[i] = 0;
    }
  }
  return { total, wins };
}

export const fmt = (r: SimResult): string =>
  `${r.status}${r.reason ? ' (' + r.reason + ')' : ''} t=${r.seconds.toFixed(1)}s mistakes=${r.mistakes} lost=${r.lost} stars=${r.stars}${r.validPlacement ? '' : ' INVALID-PLACEMENT'}`;

export { simulateLevel };
