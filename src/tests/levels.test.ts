import './nodeMatter';
import { describe, expect, it } from 'vitest';
import { GAME_W, HUD_H, OBJ_TYPES, PLAY_H } from '../game/config';
import { parseSpawn } from '../game/levels/LevelTypes';
import { LEVELS } from '../game/levels/levels';
import { PANIC_LEVEL } from '../game/levels/panicLevel';
import { FactoryWorld } from '../game/sim/FactoryWorld';
import { makeRouteBot } from '../game/sim/routeBot';
import { simulateLevel } from '../game/sim/simulate';
import { PanicDirector } from '../game/systems/PanicDirector';
import { computeStars, PanicScore, starsForRuns } from '../game/systems/ScoreManager';
import { allConfigs, planOptions, robust, solvePlan } from '../game/sim/planSolver';

describe('level data', () => {
  it('has 12 levels with unique ids', () => {
    expect(LEVELS.length).toBe(12);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
  });

  it('is set up, then run: only belts flip, bouncers turn and timers change, all by tapping', () => {
    for (const level of LEVELS) {
      expect(level.plan).toBe(true);
      expect(level.sortAll).toBe(true);
      expect(level.mistakesAllowed).toBe(0);
      for (const m of level.machines) {
        expect(m.movable ?? false).toBe(false); // nothing is dragged
        if (m.rotatable) expect(m.kind === 'bumper' && (m.angles?.length ?? 0) >= 2).toBe(true);
      }
      // a handful of things to set, never a wall of options
      const adjustable = planOptions(level);
      expect(adjustable.length).toBeGreaterThanOrEqual(1);
      expect(adjustable.length).toBeLessThanOrEqual(3);
      // plain toys only: no special materials to learn
      for (const s of level.spawners) for (const spec of s.sequence) expect(parseSpawn(spec).material).toBe('standard');
    }
  });

  it('introduces one new kind of machine at a time', () => {
    const kindsOf = (i: number): Set<string> => new Set(planOptions(LEVELS[i]).map((o) => LEVELS[i].machines.find((m) => m.id === o.id)!.kind));
    const seen = new Set<string>();
    for (let i = 0; i < LEVELS.length; i++) {
      const fresh = [...kindsOf(i)].filter((k) => !seen.has(k));
      expect(fresh.length, LEVELS[i].name).toBeLessThanOrEqual(1);
      // a level that introduces something new has nothing else to set
      if (fresh.length && i > 0) expect(kindsOf(i).size, LEVELS[i].name).toBe(1);
      for (const k of kindsOf(i)) seen.add(k);
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
        // the solution and the tutorial only name machines the player can change
        const adjustable = planOptions(level).map((o) => o.id);
        for (const id of Object.keys(level.solution)) expect(adjustable).toContain(id);
        for (const step of level.tutorial ?? []) expect(adjustable).toContain(step.machine);
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

      it('is not won by pressing RUN without setting anything up', () => {
        const r = simulateLevel(level, {});
        expect(r.status).toBe('failed');
      });

      it('is won by its solution, also with small random spawn offsets', () => {
        const r = simulateLevel(level, level.solution);
        expect(r.status, r.reason).toBe('won');
        expect(r.lost).toBe(0);
        expect(robust(level, level.solution)).toBe(true);
      });

      it('is a puzzle, not a coin toss: most setups lose, every run ends quickly and no toy falls out', () => {
        const rep = solvePlan(level);
        expect(rep.wins.length).toBeGreaterThan(0);
        // a level with several things to set must not be won by most of them
        if (rep.total >= 4 && i !== LEVELS.findIndex((l) => l.id === 'either-way')) expect(rep.wins.length / rep.total).toBeLessThanOrEqual(0.5);
        for (const c of allConfigs(level)) {
          const r = simulateLevel(level, c);
          expect(r.status).not.toBe('timeout');
          expect(r.seconds, JSON.stringify(c)).toBeLessThan(13);
          expect(r.lost, JSON.stringify(c)).toBe(0);
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

describe('pacing', () => {
  it('starts easy: the first levels need two taps at most', () => {
    for (let i = 0; i < 4; i++) expect(solvePlan(LEVELS[i]).minTaps, LEVELS[i].name).toBeLessThanOrEqual(2);
  });

  it('keeps runs short: a handful of toys per level', () => {
    for (const level of LEVELS) {
      const toys = level.spawners.reduce((n, sp) => n + sp.sequence.length, 0);
      expect(toys, level.name).toBeLessThanOrEqual(8);
    }
  });
});

describe('scoring', () => {
  it('rates set-up levels on how many runs it took', () => {
    expect(starsForRuns(1)).toBe(3);
    expect(starsForRuns(2)).toBe(2);
    expect(starsForRuns(3)).toBe(2);
    expect(starsForRuns(4)).toBe(1);
    expect(starsForRuns(12)).toBe(1);
  });

  it('rates live sorting levels on accuracy alone', () => {
    const level = { ...LEVELS[0], plan: false };
    expect(computeStars(level, { mistakes: 0, lost: 0, seconds: 500 })).toBe(3);
    expect(computeStars(level, { mistakes: 1, lost: 0, seconds: 1 })).toBe(2);
    expect(computeStars(level, { mistakes: 2, lost: 0, seconds: 1 })).toBe(1);
  });

  it('rates classic puzzle levels on slips and par time', () => {
    const level = { ...LEVELS[0], sortAll: false, plan: false, par: 10 };
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
  it('is fair: a simple bot survives three minutes of malfunctions and no toy can fall out', () => {
    for (const seed of [3, 11, 42]) {
      const world = new FactoryWorld(PANIC_LEVEL, { seed });
      const director = new PanicDirector(world);
      const bot = makeRouteBot(PANIC_LEVEL, 6);
      world.start();
      let lost = 0;
      world.events.on('lost', () => lost++);
      for (let i = 0; i < 60 * 180; i++) {
        director.update();
        bot(world);
        world.step();
      }
      expect(lost, 'seed ' + seed + ': toys fell out').toBe(0);
      expect(director.over).toBe(false);
      expect(director.lives, 'seed ' + seed).toBeGreaterThanOrEqual(2);
      expect(director.score.delivered).toBeGreaterThan(80);
      expect(world.objects.length).toBeLessThan(12); // no pile-ups
      world.destroy();
    }
  });

  it('uses two belts, so two buttons', () => {
    const belts = PANIC_LEVEL.machines.filter((m) => m.kind === 'conveyor');
    expect(belts.length).toBe(2);
  });

  it('gets harder over time and announces malfunctions before they start', () => {
    const world = new FactoryWorld(PANIC_LEVEL, { seed: 5 });
    const director = new PanicDirector(world);
    const bot = makeRouteBot(PANIC_LEVEL, 6);
    world.start();
    const early = director.spawnInterval;
    let warnings = 0;
    let sawWarningText = false;
    world.events.on('panicWarning', () => warnings++);
    for (let i = 0; i < 60 * 100; i++) {
      director.update();
      bot(world);
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
