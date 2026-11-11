/**
 * Trace one level under every setup: where each toy ended up.   npx tsx scripts/plan-trace.ts <level number>
 */
import './labkit';
import { LEVELS } from '../src/game/levels/levels';
import { allConfigs } from '../src/game/sim/planSolver';
import { FactoryWorld } from '../src/game/sim/FactoryWorld';
import { PuzzleRules } from '../src/game/systems/PuzzleRules';

const level = LEVELS[parseInt(process.argv[2] ?? '1', 10) - 1];
for (const cfg of allConfigs(level)) {
  const world = new FactoryWorld(level);
  const rules = new PuzzleRules(world, { ...level, mistakesAllowed: 99 });
  world.applyConfig(cfg);
  const log: string[] = [];
  world.events.on('deliver', (o: { type: string; x: number }, b: { id: string }, ok: boolean) => log.push(`${o.type}->${b.id}${ok ? '' : '!'}@${world.tick}`));
  world.events.on('lost', (o: { type: string }) => log.push(`${o.type} lost@${world.tick}`));
  world.events.on('spawn', (o: { type: string }) => log.push(`+${o.type}@${world.tick}`));
  world.start();
  let s = 'running';
  for (let i = 0; i < 60 * 60 && s === 'running'; i++) {
    world.step();
    s = rules.update();
  }
  console.log(JSON.stringify(cfg), s, log.join(' '));
  world.destroy();
}
