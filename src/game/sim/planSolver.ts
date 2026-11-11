import type { LevelConfig, LevelDef, MachineConfig } from '../levels/LevelTypes';
import { FactoryWorld } from './FactoryWorld';
import { simulateLevel, type SimResult } from './simulate';

/**
 * Brute-force solver for set-up-then-run levels.
 *
 * Every adjustable machine has a short list of settings (a belt: two directions,
 * a bouncer: its listed angles, a timer: its steps). The solver runs the level
 * once for every combination, so a level can be proven solvable, and its
 * difficulty judged by how few of the combinations work.
 */

export interface PlanOption {
  id: string;
  /** what a tap cycles through, in tap order, starting with the level's own setting */
  settings: MachineConfig[];
}

/** The settings each adjustable machine can take, read from a live world so every rule matches the game. */
export function planOptions(level: LevelDef): PlanOption[] {
  const world = new FactoryWorld(level);
  const out: PlanOption[] = [];
  for (const m of world.machines) {
    if (!m.configurable) continue;
    let settings: MachineConfig[] = [];
    if (m.canFlip) {
      const d = (m.getConfig().dir ?? 1) as 1 | -1;
      settings = [{ dir: d }, { dir: d === 1 ? -1 : 1 }];
    } else if (m.canRotate) {
      const opts = m.angleOptions();
      const start = Math.max(0, opts.findIndex((a) => Math.abs(a - m.angle) < 0.5));
      settings = [...opts.slice(start), ...opts.slice(0, start)].map((angle) => ({ angle }));
    } else if (m.canBlow && 'powerOptions' in m) {
      const opts = (m as unknown as { powerOptions(): number[]; power: number }).powerOptions();
      const cur = (m as unknown as { power: number }).power;
      const start = Math.max(0, opts.indexOf(cur));
      settings = [...opts.slice(start), ...opts.slice(0, start)].map((power) => ({ power }));
    } else if (m.canTime && 'phaseOptions' in m) {
      const opts = (m as unknown as { phaseOptions(): number[]; phase: number }).phaseOptions();
      const cur = (m as unknown as { phase: number }).phase;
      const start = Math.max(0, opts.findIndex((p) => Math.abs(p - cur) < 1e-6));
      settings = [...opts.slice(start), ...opts.slice(0, start)].map((phase) => ({ phase }));
    }
    if (settings.length) out.push({ id: m.id, settings });
  }
  world.destroy();
  return out;
}

/** Every combination of settings. */
export function allConfigs(level: LevelDef): LevelConfig[] {
  const opts = planOptions(level);
  let configs: LevelConfig[] = [{}];
  for (const o of opts) {
    const next: LevelConfig[] = [];
    for (const c of configs) for (const s of o.settings) next.push({ ...c, [o.id]: s });
    configs = next;
  }
  return configs;
}

/** Taps needed to get from the level's starting setup to `config`. */
export function tapsFor(level: LevelDef, config: LevelConfig): number {
  let taps = 0;
  for (const o of planOptions(level)) {
    const want = config[o.id];
    if (!want) continue;
    const i = o.settings.findIndex((s) => JSON.stringify(s) === JSON.stringify(want));
    taps += Math.max(0, i);
  }
  return taps;
}

export interface PlanReport {
  total: number;
  wins: LevelConfig[];
  idle: SimResult;
  /** fewest taps among the winning setups */
  minTaps: number;
}

export function solvePlan(level: LevelDef, maxTicks = 60 * 90): PlanReport {
  const configs = allConfigs(level);
  const wins: LevelConfig[] = [];
  for (const c of configs) {
    const r = simulateLevel(level, c, {}, maxTicks);
    if (r.status === 'won') wins.push(c);
  }
  const idle = simulateLevel(level, {}, {}, maxTicks);
  const minTaps = wins.length ? Math.min(...wins.map((w) => tapsFor(level, w))) : Infinity;
  return { total: configs.length, wins, idle, minTaps };
}

/** A winning setup must not be a fluke: it has to keep winning with small random spawn offsets. */
export function robust(level: LevelDef, config: LevelConfig, seeds = [1, 2, 3, 4, 5]): boolean {
  return seeds.every((seed) => simulateLevel(level, config, { seed, jitter: 6 }, 60 * 90).status === 'won');
}
