import './labkit';
import { FactoryWorld } from '../src/game/sim/FactoryWorld';
import { LEVELS } from '../src/game/levels/levels';
import { makeRouteBot } from '../src/game/sim/routeBot';
const n = parseInt(process.argv[2], 10);
const L = LEVELS[n - 1];
const w = new FactoryWorld(L);
const bot = makeRouteBot(L, 1);
let bumps = 0;
w.events.on('bump', () => bumps++);
w.events.on('deliver', (o: any, b: any, ok: boolean) => console.log(w.tick, 'deliver', o.type, b.id, ok, 'bumps so far', bumps));
w.start();
for (let i = 0; i < 2400; i++) { bot(w); w.step(); if (i % 300 === 299) console.log(w.tick, w.objects.map((o) => `${o.type}@${o.x.toFixed(0)},${o.y.toFixed(0)} v${o.body.speed.toFixed(1)}`).join(' ')); }
