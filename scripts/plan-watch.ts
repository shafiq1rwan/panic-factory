/** Print toy positions and pusher extension over time.   npx tsx scripts/plan-watch.ts <level> '<config json>' [from] [to] [every] */
import './labkit';
import { LEVELS } from '../src/game/levels/levels';
import { FactoryWorld } from '../src/game/sim/FactoryWorld';
import { Piston } from '../src/game/machines/Piston';

const level = LEVELS[parseInt(process.argv[2], 10) - 1];
const cfg = JSON.parse(process.argv[3] ?? '{}');
const from = +(process.argv[4] ?? 0), to = +(process.argv[5] ?? 400), every = +(process.argv[6] ?? 5);
const world = new FactoryWorld(level);
world.applyConfig(cfg);
world.start();
for (let t = 0; t < to; t++) {
  world.step();
  if (t >= from && t % every === 0) {
    const ram = world.machines.find((m) => m instanceof Piston) as Piston | undefined;
    const toys = world.objects.map((o) => `${o.type[0]}(${o.x.toFixed(0)},${o.y.toFixed(0)} v${o.body.velocity.x.toFixed(1)},${o.body.velocity.y.toFixed(1)})`).join(' ');
    console.log(`${world.tick} ram=${ram ? ram.ext.toFixed(2) : '-'} ${toys}`);
  }
}
