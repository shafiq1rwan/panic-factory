import './labkit';
import { FactoryWorld } from '../src/game/sim/FactoryWorld';
import { PANIC_LEVEL } from '../src/game/levels/panicLevel';
import { PanicDirector } from '../src/game/systems/PanicDirector';
const world = new FactoryWorld(PANIC_LEVEL, { seed: 9 });
const d = new PanicDirector(world);
d.eventsEnabled = false;
world.start();
world.events.on('deliver', (o: any, b: any, ok: boolean) => console.log(world.tick, 'deliver', o.type, b.id, ok));
world.events.on('lost', (o: any) => console.log(world.tick, 'lost', o.type, o.x.toFixed(0)));
for (let i = 0; i < 900; i++) { d.update(); world.step(); if (i % 100 === 0) console.log(i, world.objects.map((o) => `${o.type}@${o.x.toFixed(0)},${o.y.toFixed(0)}`).join(' ')); }
