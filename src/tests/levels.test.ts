import './nodeMatter';
import { describe, expect, it } from 'vitest';
import { GAME_H, GAME_W, HUD_H, OBJ_TYPES } from '../game/config';
import { configurableIds, parseSpawn } from '../game/levels/LevelTypes';
import { LEVELS } from '../game/levels/levels';
import { PANIC_LEVEL } from '../game/levels/panicLevel';
import { ConveyorBelt } from '../game/machines/ConveyorBelt';
import { FactoryWorld } from '../game/sim/FactoryWorld';
import { simulateLevel } from '../game/sim/simulate';
import { PanicDirector } from '../game/systems/PanicDirector';
import { computeStars, PanicScore } from '../game/systems/ScoreManager';

describe('level data', () => {
  it('has 15 levels with unique ids', () => {
    expect(LEVELS.length).toBe(15);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(15);
  });

  for (const [i, level] of LEVELS.entries()) {
    describe(`L${i + 1} ${level.name}`, () => {
      it('is structurally valid', () => {
        const ids = level.machines.map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length);
        // every required type has a bin and enough spawns
        for (const type of OBJ_TYPES) {
          const need = level.objective[type] ?? 0;
          if (!need) continue;
          expect(level.machines.some((m) => m.kind === 'bin' && m.accepts === type)).toBe(true);
          const supply = level.spawners.flatMap((s) => s.sequence).filter((s) => parseSpawn(s).type === type).length;
          expect(supply).toBeGreaterThanOrEqual(need);
        }
        // something for the player to do, and the solution only touches configurable machines
        const cfg = configurableIds(level);
        expect(cfg.length).toBeGreaterThan(0);
        for (const id of Object.keys(level.solution)) expect(cfg).toContain(id);
        // tutorial steps reference real configurable machines
        for (const step of level.tutorial ?? []) expect(cfg).toContain(step.machine);
        // machines and spawners are inside the play area
        for (const m of level.machines) {
          expect(m.x).toBeGreaterThan(0);
          expect(m.x).toBeLessThan(GAME_W);
          expect(m.y).toBeGreaterThan(HUD_H);
          expect(m.y).toBeLessThan(GAME_H);
          if (m.movable) expect(m.zone).toBeDefined();
        }
      });

      it('starts with every machine legally placed', () => {
        const world = new FactoryWorld(level);
        for (const m of world.machines) {
          if (!m.configurable) continue;
          expect(world.isPlacementValid(m), `${m.id} overlaps something`).toBe(true);
          const z = m.def.zone;
          if (m.canMove && z) {
            expect(m.x).toBeGreaterThanOrEqual(z.x);
            expect(m.x).toBeLessThanOrEqual(z.x + z.w);
            expect(m.y).toBeGreaterThanOrEqual(z.y);
            expect(m.y).toBeLessThanOrEqual(z.y + z.h);
          }
        }
        world.destroy();
      });

      it('is not already solved before the player does anything', () => {
        const r = simulateLevel(level, {});
        expect(r.status).toBe('failed');
        expect(r.reason.length).toBeGreaterThan(0);
        // and it fails in reasonable time instead of hanging
        expect(r.seconds).toBeLessThan(45);
      });

      it('intended solution wins with three stars', () => {
        const r = simulateLevel(level, level.solution);
        expect(r.validPlacement).toBe(true);
        expect(r.status).toBe('won');
        expect(r.mistakes).toBe(0);
        expect(r.lost).toBe(0);
        expect(r.stars).toBe(3);
      });

      it('solution is robust to small physics variations', () => {
        for (let seed = 1; seed <= 6; seed++) {
          const r = simulateLevel(level, level.solution, { seed, jitter: 0.6 });
          expect(r.status, `seed ${seed}: ${r.reason}`).toBe('won');
        }
      });

      it('is deterministic', () => {
        const a = simulateLevel(level, level.solution);
        const b = simulateLevel(level, level.solution);
        expect(a.ticks).toBe(b.ticks);
      });
    });
  }
});

describe('scoring', () => {
  const level = LEVELS[0];
  it('awards stars for clean, efficient runs', () => {
    expect(computeStars(level, { mistakes: 0, lost: 0, seconds: level.par - 1 })).toBe(3);
    expect(computeStars(level, { mistakes: 0, lost: 0, seconds: level.par + 5 })).toBe(2);
    expect(computeStars(level, { mistakes: 1, lost: 0, seconds: 1 })).toBe(2);
    expect(computeStars(level, { mistakes: 0, lost: 1, seconds: 1 })).toBe(2);
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
  const playPerfectly = playGreedy;

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
      playPerfectly(world);
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
