import './nodeMatter';
import { describe, expect, it } from 'vitest';
import { MAX_OBJECT_SPEED } from '../game/config';
import type { LevelDef, MachineDef, SpawnerDef, WallDef } from '../game/levels/LevelTypes';
import { Piston } from '../game/machines/Piston';
import { FactoryWorld } from '../game/sim/FactoryWorld';
import { PuzzleRules } from '../game/systems/PuzzleRules';

function level(machines: MachineDef[], spawners: SpawnerDef[] = [], walls: WallDef[] = [], extra: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test', name: 'test', width: 1280, height: 720, objective: {}, mistakesAllowed: 0, par: 99, solution: {},
    machines, spawners, walls, ...extra,
  };
}

function run(world: FactoryWorld, ticks: number, each?: () => void): void {
  for (let i = 0; i < ticks; i++) {
    world.step();
    each?.();
  }
}

describe('basic physics', () => {
  it('objects fall under gravity and come to rest on a platform', () => {
    const world = new FactoryWorld(level([], [], [{ x: 640, y: 500, w: 400, h: 30 }]));
    world.start();
    const ball = world.spawnObject('blue', 'standard', 640, 150)!;
    run(world, 30);
    expect(ball.y).toBeGreaterThan(160); // falling
    run(world, 300);
    expect(ball.y).toBeGreaterThan(455);
    expect(ball.y).toBeLessThan(470); // resting on top (platform top = 485, radius 17)
    expect(ball.body.speed).toBeLessThan(0.2);
    world.destroy();
  });

  it('objects collide with each other instead of overlapping', () => {
    const world = new FactoryWorld(level([], [], [{ x: 640, y: 500, w: 400, h: 30 }]));
    world.start();
    const a = world.spawnObject('blue', 'standard', 640, 400)!;
    const b = world.spawnObject('pink', 'standard', 640, 250)!;
    let impacts = 0;
    world.events.on('impact', () => impacts++);
    run(world, 400);
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    expect(d).toBeGreaterThan(28);
    expect(impacts).toBeGreaterThan(0);
    world.destroy();
  });

  it('every toy shape and material can be created and stays finite', () => {
    const world = new FactoryWorld(level([], [], [{ x: 640, y: 600, w: 1300, h: 30 }]));
    world.start();
    let x = 100;
    for (const type of ['blue', 'pink', 'yellow', 'green'] as const) {
      for (const mat of ['standard', 'bouncy', 'heavy', 'slippery'] as const) {
        world.spawnObject(type, mat, x, 200);
        x += 64;
      }
    }
    run(world, 500);
    expect(world.objects.length).toBe(16);
    for (const o of world.objects) {
      expect(Number.isFinite(o.x) && Number.isFinite(o.y)).toBe(true);
      expect(o.y).toBeLessThan(600);
    }
    world.destroy();
  });

  it('never exceeds the speed limit and thin-ish walls do not tunnel', () => {
    const world = new FactoryWorld(level([], [], [{ x: 640, y: 650, w: 600, h: 24 }]));
    world.start();
    const ball = world.spawnObject('blue', 'heavy', 640, 100, 0, 60)!;
    run(world, 200, () => expect(ball.body.speed).toBeLessThanOrEqual(MAX_OBJECT_SPEED + 0.5));
    expect(ball.state).toBe('active');
    expect(ball.y).toBeLessThan(650);
    world.destroy();
  });

  it('objects leaving the factory are removed and reported lost', () => {
    const world = new FactoryWorld(level([]));
    world.start();
    let lost = 0;
    world.events.on('lost', () => lost++);
    world.spawnObject('blue', 'standard', 640, 600);
    run(world, 200);
    expect(lost).toBe(1);
    expect(world.objects.length).toBe(0);
    world.destroy();
  });
});

describe('conveyor belt', () => {
  const belt = (dir: 1 | -1, angle = 0): MachineDef => ({ id: 'c', kind: 'conveyor', x: 640, y: 400, length: 500, speed: 3, dir, angle });

  it('carries objects in the belt direction', () => {
    for (const dir of [1, -1] as const) {
      const world = new FactoryWorld(level([belt(dir)]));
      world.start();
      const box = world.spawnObject('pink', 'standard', 640, 330)!;
      run(world, 60);
      expect(Math.sign(box.x - 640)).toBe(dir);
      expect(Math.abs(box.body.velocity.x)).toBeGreaterThan(2.5);
      expect(Math.abs(box.body.velocity.x)).toBeLessThan(3.3); // does not inject extra energy
      world.destroy();
    }
  });

  it('works when rotated: carries a box uphill', () => {
    const world = new FactoryWorld(level([belt(1, -20)]));
    world.start();
    const box = world.spawnObject('pink', 'standard', 560, 340)!;
    run(world, 70);
    const y1 = box.y;
    const x1 = box.x;
    run(world, 30);
    expect(box.x).toBeGreaterThan(x1 + 40);
    expect(box.y).toBeLessThan(y1 - 10); // moving up the slope
    world.destroy();
  });

  it('only moves objects that are actually on the belt', () => {
    const world = new FactoryWorld(level([belt(1)], [], [{ x: 640, y: 600, w: 300, h: 30 }]));
    world.start();
    const bystander = world.spawnObject('pink', 'standard', 640, 560)!; // on a platform below the belt
    run(world, 120);
    expect(Math.abs(bystander.x - 640)).toBeLessThan(2);
    world.destroy();
  });

  it('a stopped belt holds objects still', () => {
    const world = new FactoryWorld(level([belt(1)]));
    world.start();
    world.machines[0].disabled = true;
    const box = world.spawnObject('pink', 'standard', 640, 340)!;
    run(world, 120);
    expect(Math.abs(box.x - 640)).toBeLessThan(6);
    world.destroy();
  });
});

describe('spring bumper', () => {
  it('launches along the pad normal with a stable, repeatable speed', () => {
    const def: MachineDef = { id: 'p', kind: 'bumper', shape: 'pad', x: 640, y: 500, angle: 30, power: 11 };
    const speeds: number[] = [];
    for (let n = 0; n < 2; n++) {
      const world = new FactoryWorld(level([def]));
      world.start();
      world.events.on('bump', (_b: unknown, o: { body: { speed: number; velocity: { x: number; y: number } } }) => {
        speeds.push(o.body.speed);
        expect(o.body.velocity.x).toBeGreaterThan(3);
        expect(o.body.velocity.y).toBeLessThan(-6);
      });
      world.spawnObject('blue', 'standard', 640, 200);
      run(world, 120);
      world.destroy();
    }
    expect(speeds.length).toBe(2);
    expect(speeds[0]).toBeGreaterThan(10);
    expect(speeds[0]).toBeLessThan(14);
    expect(speeds[0]).toBe(speeds[1]); // deterministic
  });

  it('has a cooldown: one contact gives exactly one impulse and bounces never grow', () => {
    const world = new FactoryWorld(level([{ id: 'p', kind: 'bumper', shape: 'pad', x: 640, y: 500, angle: 0 }]));
    world.start();
    const ticks: number[] = [];
    let maxSpeed = 0;
    world.events.on('bump', () => ticks.push(world.tick));
    const ball = world.spawnObject('blue', 'standard', 640, 300)!;
    run(world, 600, () => (maxSpeed = Math.max(maxSpeed, ball.body.speed)));
    expect(ticks.length).toBeGreaterThan(3);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i] - ticks[i - 1]).toBeGreaterThan(10);
    expect(maxSpeed).toBeLessThan(16);
    world.destroy();
  });

  it('round bumper pushes away from its centre; heavy toys launch less', () => {
    const def: MachineDef = { id: 'r', kind: 'bumper', shape: 'round', x: 640, y: 500 };
    const launch = (material: 'standard' | 'heavy'): number => {
      const world = new FactoryWorld(level([def]));
      world.start();
      let s = 0;
      world.events.on('bump', (_b: unknown, o: { body: { speed: number; velocity: { x: number } } }) => {
        s = o.body.speed;
        expect(o.body.velocity.x).toBeGreaterThan(0);
      });
      world.spawnObject('blue', material, 655, 300);
      run(world, 100);
      world.destroy();
      return s;
    };
    expect(launch('heavy')).toBeLessThan(launch('standard') * 0.8);
  });
});

describe('piston', () => {
  it('pushes objects ahead of it and never passes through them', () => {
    const world = new FactoryWorld(
      level([{ id: 'ram', kind: 'piston', x: 300, y: 350, angle: 0, stroke: 150, period: 2000, extendTicks: 20 }], [], [{ x: 800, y: 400, w: 960, h: 24 }]),
    );
    world.start();
    const piston = world.machines[0] as Piston;
    const box = world.spawnObject('pink', 'standard', 440, 350)!;
    let maxExt = 0;
    run(world, 400, () => {
      maxExt = Math.max(maxExt, piston.ext);
      const front = piston.x + piston.headFront();
      // the box's left edge must stay in front of the ram's face (small solver tolerance)
      expect(box.x - 27).toBeGreaterThan(front - 6);
    });
    expect(maxExt).toBe(1);
    expect(box.x).toBeGreaterThan(540); // it was shoved along
    expect(box.state).toBe('active');
    world.destroy();
  });

  it('follows a predictable cycle and returns to rest on reset', () => {
    const world = new FactoryWorld(level([{ id: 'ram', kind: 'piston', x: 300, y: 300, angle: 0, period: 2000 }]));
    world.start();
    const piston = world.machines[0] as Piston;
    const fires: number[] = [];
    world.events.on('pistonFire', () => fires.push(world.tick));
    run(world, 300);
    expect(fires).toEqual([30, 150, 270]);
    world.reset();
    expect(piston.ext).toBe(0);
    world.destroy();
  });

  it('timing can be cycled in quarter steps', () => {
    const world = new FactoryWorld(level([{ id: 'ram', kind: 'piston', x: 300, y: 300, angle: 0, timing: true }]));
    const piston = world.machines[0] as Piston;
    const seen = [piston.phase];
    for (let i = 0; i < 4; i++) {
      piston.cycleTiming();
      seen.push(piston.phase);
    }
    expect(seen).toEqual([0, 0.25, 0.5, 0.75, 0]);
    world.destroy();
  });
});

describe('funnel', () => {
  it('guides off-centre objects into the gap', () => {
    const world = new FactoryWorld(level([{ id: 'f', kind: 'funnel', x: 640, y: 400, topWidth: 300, bottomWidth: 80, height: 120 }]));
    world.start();
    const xs: number[] = [];
    for (const x of [540, 700, 760]) {
      const o = world.spawnObject('blue', 'standard', x, 150)!;
      run(world, 160, () => {
        if (o.state === 'active' && o.y > 452 && o.y < 466) xs.push(o.x);
      });
    }
    expect(xs.length).toBeGreaterThan(0);
    for (const x of xs) expect(Math.abs(x - 640)).toBeLessThan(26); // gap is 80 wide, ball radius 17
    world.destroy();
  });
});

describe('delivery bin + rules', () => {
  const binLevel = (extra: Partial<LevelDef> = {}): LevelDef =>
    level(
      [
        { id: 'blueBin', kind: 'bin', x: 400, y: 600, accepts: 'blue' },
        { id: 'pinkBin', kind: 'bin', x: 800, y: 600, accepts: 'pink' },
      ],
      // a far-future supply so the rules know more toys are still coming
      [{ id: 'later', x: 1200, y: 112, sequence: ['blue', 'blue', 'blue'], interval: 1000, delay: 9e6 }],
      [],
      { objective: { blue: 2 }, mistakesAllowed: 1, ...extra },
    );

  it('counts each object exactly once', () => {
    const world = new FactoryWorld(binLevel());
    const rules = new PuzzleRules(world, world.level);
    world.start();
    let delivered = 0;
    world.events.on('deliver', () => delivered++);
    world.spawnObject('blue', 'standard', 400, 300);
    run(world, 300, () => rules.update());
    expect(delivered).toBe(1);
    expect(rules.delivered.blue).toBe(1);
    expect(world.bins[0].correct).toBe(1);
    expect(world.objects.length).toBe(0); // body removed, cannot score again
    world.destroy();
  });

  it('does not count objects touching the outside of the bin', () => {
    const world = new FactoryWorld(binLevel());
    world.start();
    let delivered = 0;
    world.events.on('deliver', () => delivered++);
    world.spawnObject('blue', 'standard', 272, 300); // slides down the outside of the left wall
    world.spawnObject('blue', 'standard', 528, 300); // and the right wall
    run(world, 300);
    expect(delivered).toBe(0);
    world.destroy();
  });

  it('tracks correct and incorrect deliveries, then wins', () => {
    const world = new FactoryWorld(binLevel());
    const rules = new PuzzleRules(world, world.level);
    world.start();
    world.spawnObject('pink', 'standard', 400, 300); // wrong bin
    run(world, 200, () => rules.update());
    expect(rules.mistakes).toBe(1);
    expect(rules.mistakesLeft).toBe(0);
    expect(rules.status).toBe('running');
    world.spawnObject('blue', 'standard', 400, 300);
    run(world, 200, () => rules.update());
    world.spawnObject('blue', 'standard', 400, 300);
    run(world, 200, () => rules.update());
    expect(rules.delivered.blue).toBe(2);
    expect(rules.status).toBe('won');
    world.destroy();
  });

  it('fails when too many wrong deliveries happen', () => {
    const world = new FactoryWorld(binLevel({ mistakesAllowed: 0 }));
    const rules = new PuzzleRules(world, world.level);
    world.start();
    world.spawnObject('pink', 'standard', 400, 300);
    run(world, 200, () => rules.update());
    expect(rules.status).toBe('failed');
    expect(rules.failReason).toMatch(/mix-ups/);
    world.destroy();
  });

  it('fails promptly when required objects are lost (never hangs)', () => {
    const lvl = level([{ id: 'blueBin', kind: 'bin', x: 400, y: 600, accepts: 'blue' }], [{ id: 's', x: 900, y: 112, sequence: ['blue', 'blue'], interval: 500 }], [], {
      objective: { blue: 2 },
    });
    const world = new FactoryWorld(lvl);
    const rules = new PuzzleRules(world, lvl);
    world.start();
    run(world, 400, () => rules.update());
    expect(rules.status).toBe('failed');
    expect(rules.failReason).toMatch(/blue toys fell out/);
    expect(rules.endTick).toBeLessThan(200);
    world.destroy();
  });

  it('fails when the remaining objects are stuck', () => {
    const lvl = level([{ id: 'blueBin', kind: 'bin', x: 400, y: 600, accepts: 'blue' }], [{ id: 's', x: 900, y: 112, sequence: ['pink'], interval: 500 }], [{ x: 900, y: 500, w: 300, h: 30 }], {
      objective: { pink: 1 },
    });
    const world = new FactoryWorld(lvl);
    const rules = new PuzzleRules(world, lvl);
    world.start();
    run(world, 900, () => rules.update());
    expect(rules.status).toBe('failed');
    expect(rules.failReason).toMatch(/stuck/);
    world.destroy();
  });

  it('enforces an optional time limit', () => {
    const lvl = level([{ id: 'blueBin', kind: 'bin', x: 400, y: 600, accepts: 'blue' }], [{ id: 's', x: 900, y: 112, sequence: ['blue', 'blue', 'blue', 'blue'], interval: 3000 }], [{ x: 900, y: 500, w: 300, h: 30 }], {
      objective: { blue: 1 },
      timeLimit: 2,
    });
    const world = new FactoryWorld(lvl);
    const rules = new PuzzleRules(world, lvl);
    world.start();
    run(world, 200, () => rules.update());
    expect(rules.status).toBe('failed');
    expect(rules.failReason).toMatch(/time/);
    world.destroy();
  });
});

describe('spawner', () => {
  it('follows the authored sequence and rhythm without overlapping spawns', () => {
    const lvl = level([], [{ id: 's', x: 400, y: 112, sequence: ['blue', 'pink:heavy', 'yellow'], interval: 1000, delay: 500 }]);
    const world = new FactoryWorld(lvl);
    world.start();
    const log: string[] = [];
    world.events.on('spawn', (o: { type: string; material: string }) => log.push(`${world.tick}:${o.type}:${o.material}`));
    run(world, 300);
    expect(log).toEqual(['30:blue:standard', '90:pink:heavy', '150:yellow:standard']);
    expect(world.allSpawned).toBe(true);
    world.destroy();
  });

  it('waits while the spawn point is blocked', () => {
    const lvl = level([], [{ id: 's', x: 400, y: 112, sequence: ['blue', 'blue'], interval: 100, delay: 0 }], [{ x: 400, y: 160, w: 200, h: 20 }]);
    const world = new FactoryWorld(lvl);
    world.start();
    run(world, 200);
    // the first ball rests right under the spawner, so the second must not be created inside it
    expect(world.objects.length).toBe(1);
    world.destroy();
  });
});

describe('reset and cleanup', () => {
  const lvl = level(
    [
      { id: 'c', kind: 'conveyor', x: 500, y: 400, length: 400, speed: 3 },
      { id: 'r', kind: 'bumper', shape: 'round', x: 800, y: 520 },
      { id: 'ram', kind: 'piston', x: 200, y: 300, angle: 0 },
      { id: 'bin', kind: 'bin', x: 1000, y: 600, accepts: 'blue' },
    ],
    [{ id: 's', x: 450, y: 112, sequence: ['blue', 'pink', 'blue', 'yellow'], interval: 700 }],
    [{ x: 640, y: 700, w: 900, h: 20 }],
  );

  it('restart fully resets the physics world and is deterministic', () => {
    const world = new FactoryWorld(lvl);
    const initialBodies = world.bodyCount;
    const snapshot = (): string => world.objects.map((o) => `${o.type}:${o.x.toFixed(4)},${o.y.toFixed(4)}`).join('|');
    world.start();
    run(world, 400);
    const first = snapshot();
    expect(world.objects.length).toBeGreaterThan(0);

    world.reset();
    expect(world.tick).toBe(0);
    expect(world.running).toBe(false);
    expect(world.objects.length).toBe(0);
    expect(world.bodyCount).toBe(initialBodies);
    expect(world.bins[0].correct).toBe(0);

    world.start();
    run(world, 400);
    expect(snapshot()).toBe(first);
    world.destroy();
  });

  it('destroying worlds leaves no bodies or listeners behind (level transitions)', () => {
    for (let i = 0; i < 20; i++) {
      const world = new FactoryWorld(lvl);
      const rules = new PuzzleRules(world, lvl);
      world.start();
      run(world, 200, () => rules.update());
      const engine = world.engine;
      world.destroy();
      expect(engine.world.bodies.length).toBe(0);
      expect(world.objects.length).toBe(0);
      expect(world.machines.length).toBe(0);
      // a destroyed world no longer reacts to stray events
      world.events.emit('deliver', { type: 'blue' }, null, true);
      expect(rules.delivered.blue).toBe(0);
    }
  });

  it('caps the number of live objects', () => {
    const world = new FactoryWorld(level([], [], [{ x: 640, y: 700, w: 1300, h: 20 }]));
    world.start();
    let made = 0;
    for (let i = 0; i < 80; i++) if (world.spawnObject('blue', 'standard', 40 + (i % 30) * 40, 100 + Math.floor(i / 30) * 40)) made++;
    expect(made).toBe(40);
    world.destroy();
  });
});

describe('machine placement', () => {
  it('clamps movement to the zone and rejects overlaps', () => {
    const lvl = level(
      [
        { id: 'pad', kind: 'bumper', shape: 'pad', x: 300, y: 500, angle: 0, movable: true, zone: { x: 200, y: 500, w: 400, h: 0 } },
        { id: 'bin', kind: 'bin', x: 560, y: 500, accepts: 'blue' },
      ],
    );
    const world = new FactoryWorld(lvl);
    const pad = world.machine('pad')!;
    expect(world.clampToZone(pad, 50, 900)).toEqual({ x: 200, y: 500 });
    expect(world.clampToZone(pad, 9999, 0)).toEqual({ x: 600, y: 500 });
    expect(world.isPlacementValid(pad)).toBe(true);
    pad.setTransform(540, 500, 0);
    expect(world.isPlacementValid(pad)).toBe(false);
    world.destroy();
  });

  it('rotation steps stay within the allowed range', () => {
    const world = new FactoryWorld(level([{ id: 'c', kind: 'conveyor', x: 500, y: 400, length: 300, speed: 3, rotatable: true, angleMin: -30, angleMax: 30 }]));
    const c = world.machine('c')!;
    for (let i = 0; i < 10; i++) c.setTransform(c.x, c.y, c.steppedAngle(1));
    expect(c.angle).toBe(30);
    for (let i = 0; i < 10; i++) c.setTransform(c.x, c.y, c.steppedAngle(-1));
    expect(c.angle).toBe(-30);
    expect(world.bodyCount).toBe(4); // 3 bounds + 1 belt: rebuilding did not leak bodies
    world.destroy();
  });
});
