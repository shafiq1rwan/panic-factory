import './nodeMatter';
import { describe, expect, it } from 'vitest';
import { GAME_W, HUD_H, OBJ_TYPES, PLAY_H } from '../game/config';
import { parseSpawn } from '../game/levels/LevelTypes';
import { LEVELS } from '../game/levels/levels';
import { PANIC_LEVEL } from '../game/levels/panicLevel';
import { ConveyorBelt } from '../game/machines/ConveyorBelt';
import { FactoryWorld } from '../game/sim/FactoryWorld';
import { makeRouteBot } from '../game/sim/routeBot';
import { simulateLevel } from '../game/sim/simulate';
import { PanicDirector } from '../game/systems/PanicDirector';
import { computeStars, PanicScore } from '../game/systems/ScoreManager';

describe('level data', () => {
  it('has 20 levels with unique ids', () => {
    expect(LEVELS.length).toBe(20);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(20);
  });

  it('asks the player to learn exactly one thing: tapping belts', () => {
    for (const level of LEVELS) {
      expect(level.sortAll).toBe(true);
      for (const m of level.machines) {
        // nothing is dragged, rotated or timed
        expect(m.movable ?? false).toBe(false);
        expect(m.rotatable ?? false).toBe(false);
        if (m.kind === 'piston') expect(m.timing ?? false).toBe(false);
      }
      expect(level.machines.some((m) => m.kind === 'conveyor' && m.flippable)).toBe(true);
      // plain toys only: no special materials to learn
      for (const s of level.spawners) for (const spec of s.sequence) expect(parseSpawn(spec).material).toBe('standard');
    }
  });

  for (const [i, level] of LEVELS.entries()) {
    describe(`L${i + 1} ${level.name}`, () => {
      it('is structurally valid', () => {
        const ids = level.machines.map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length);
        // every toy type that drops has a bin
        for (const type of OBJ_TYPES) {
          const drops = level.spawners.flatMap((s) => s.sequence).some((s) => parseSpawn(s).type === type);
          if (drops) expect(level.machines.some((m) => m.kind === 'bin' && m.accepts === type)).toBe(true);
        }
        // the routes table only names flippable belts
        for (const id of Object.keys(level.routes ?? {})) {
          expect(level.machines.some((m) => m.id === id && m.kind === 'conveyor' && m.flippable)).toBe(true);
        }
        for (const step of level.tutorial ?? []) expect(ids).toContain(step.machine);
        // everything sits inside the portrait play field
        for (const m of level.machines) {
          expect(m.x).toBeGreaterThan(0);
          expect(m.x).toBeLessThan(GAME_W);
          expect(m.y).toBeGreaterThan(HUD_H);
          expect(m.y).toBeLessThan(PLAY_H);
        }
        for (const s of level.spawners) {
          expect(s.x).toBeGreaterThan(40);
          expect(s.x).toBeLessThan(GAME_W - 40);
        }
      });

      it('is not won by doing nothing', () => {
        const r = simulateLevel(level, {});
        expect(r.status).toBe('failed');
        expect(r.seconds).toBeLessThan(60);
      });

      it('can be cleared perfectly, and no toy can ever fall out of play', () => {
        const r = simulateLevel(level, {}, {}, 60 * 240, makeRouteBot(level, 1));
        expect(r.status).toBe('won');
        expect(r.mistakes).toBe(0);
        expect(r.lost).toBe(0);
        expect(r.stars).toBe(3);
        // even with every belt left alone, toys only ever end up in bins
        const idle = simulateLevel(level, {});
        expect(idle.lost).toBe(0);
      });

      it('is fair for human reactions (200 ms and 300 ms delayed play still wins)', () => {
        for (const reaction of [12, 18]) {
          const r = simulateLevel(level, {}, { seed: reaction, jitter: 0.6 }, 60 * 240, makeRouteBot(level, reaction));
          expect(r.status, `reaction ${reaction} ticks: ${r.reason}`).toBe('won');
        }
      });

      it('is deterministic', () => {
        const a = simulateLevel(level, {}, {}, 60 * 240, makeRouteBot(level, 1));
        const b = simulateLevel(level, {}, {}, 60 * 240, makeRouteBot(level, 1));
        expect(a.ticks).toBe(b.ticks);
      });
    });
  }
});

describe('scoring', () => {
  it('rates sorting levels on accuracy alone', () => {
    const level = LEVELS[0];
    expect(computeStars(level, { mistakes: 0, lost: 0, seconds: 500 })).toBe(3);
    expect(computeStars(level, { mistakes: 1, lost: 0, seconds: 1 })).toBe(2);
    expect(computeStars(level, { mistakes: 2, lost: 0, seconds: 1 })).toBe(1);
  });

  it('rates classic puzzle levels on slips and par time', () => {
    const level = { ...LEVELS[0], sortAll: false, par: 10 };
    expect(computeStars(level, { mistakes: 0, lost: 0, seconds: 9 })).toBe(3);
    expect(computeStars(level, { mistakes: 0, lost: 0, seconds: 15 })).toBe(2);
    expect(computeStars(level, { mistakes: 1, lost: 0, seconds: 1 })).toBe(2);
    expect(computeStars(level, { mistakes: 1, lost: 1, seconds: 1 })).toBe(1);
  });

  it('panic score rewards streaks and chains', () => {
    const s = new PanicScore();
    expect(s.correct(100).points).toBe(10);
    expect(s.correct(120)).toEqual({ points: 15, chain: true }); // quick follow-up
    s.correct(400);
    s.correct(800);
    expect(s.multiplier).toBe(2);
    expect(s.correct(1200).points).toBe(20);
    s.mistake();
    expect(s.multiplier).toBe(1);
    expect(s.bestCombo).toBe(5);
  });
});

describe('panic factory', () => {
  /**
   * A simple greedy bot: on each belt, serve whichever toy is closest to the exit it needs.
   * It is not an optimal player, but if even this survives, the mode is fair.
   */
  function playGreedy(world: FactoryWorld): void {
    const want: Record<string, Record<string, 1 | -1 | 0>> = {
      top: { blue: -1, yellow: 1, pink: 0 },
      left: { blue: -1, pink: 1, yellow: 1 },
      right: { yellow: 1, pink: -1, blue: -1 },
    };
    for (const id of ['top', 'left', 'right']) {
      const b = world.machine(id) as ConveyorBelt;
      let best = Infinity;
      let dir = 0;
      for (const o of world.objects) {
        if (Math.abs(o.y - (b.y - 44)) > 30 || Math.abs(o.x - b.x) > b.def.length / 2 + 10) continue;
        const w = want[id][o.type];
        if (!w) continue;
        const dist = w === 1 ? b.x + b.def.length / 2 - o.x : o.x - (b.x - b.def.length / 2);
        if (dist < best) {
          best = dist;
          dir = w;
        }
      }
      if (dir && dir !== b.dir && !b.disabled) b.flip();
    }
  }

  it('is fair: a simple greedy bot survives three minutes of malfunctions and no toy can fall out', () => {
    for (const seed of [3, 11, 42]) {
      const world = new FactoryWorld(PANIC_LEVEL, { seed });
      const director = new PanicDirector(world);
      world.start();
      let lost = 0;
      world.events.on('lost', () => lost++);
      for (let i = 0; i < 60 * 180; i++) {
        director.update();
        playGreedy(world);
        world.step();
      }
      expect(lost, 'seed ' + seed + ': toys fell out').toBe(0);
      expect(director.over).toBe(false);
      expect(director.lives, 'seed ' + seed).toBeGreaterThanOrEqual(2);
      expect(director.score.delivered).toBeGreaterThan(100);
      expect(world.objects.length).toBeLessThan(12); // no pile-ups
      world.destroy();
    }
  });

  it('gets harder over time and announces malfunctions before they start', () => {
    const world = new FactoryWorld(PANIC_LEVEL, { seed: 5 });
    const director = new PanicDirector(world);
    world.start();
    const early = director.spawnInterval;
    let warnings = 0;
    let sawWarningText = false;
    world.events.on('panicWarning', () => warnings++);
    for (let i = 0; i < 60 * 100; i++) {
      director.update();
      playGreedy(world);
      world.step();
      if (director.warning) sawWarningText = true;
    }
    expect(director.spawnInterval).toBeLessThan(early);
    expect(warnings).toBeGreaterThan(2);
    expect(sawWarningText).toBe(true);
    world.destroy();
  });

  it('ends after three wrong deliveries', () => {
    const world = new FactoryWorld(PANIC_LEVEL, { seed: 9 });
    const director = new PanicDirector(world);
    director.eventsEnabled = false;
    world.start();
    for (let i = 0; i < 60 * 120 && !director.over; i++) {
      director.update();
      world.step(); // nobody touches the belts
    }
    expect(director.over).toBe(true);
    expect(director.lives).toBe(0);
    world.destroy();
  });
});
