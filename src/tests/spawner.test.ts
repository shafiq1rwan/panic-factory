import './nodeMatter';
import { describe, expect, it } from 'vitest';
import { msToTicks } from '../game/config';
import { LEVELS } from '../game/levels/levels';
import { ConveyorBelt } from '../game/machines/ConveyorBelt';
import { FactoryWorld } from '../game/sim/FactoryWorld';

/** Level 1 with its first toy held at the pipe until the first flip (the engine feature this file tests). */
const HOLD = { ...LEVELS[0], spawners: [{ ...LEVELS[0].spawners[0], delay: 1500, holdFirstForFlip: 7000 }] };

/** Ticks until the first toy appears, optionally flipping the belt at `flipAt`. */
function firstSpawnTick(flipAt = -1, limit = 900): number {
  const world = new FactoryWorld(HOLD);
  world.start();
  const belt = world.machine('belt') as ConveyorBelt;
  for (let t = 0; t < limit; t++) {
    if (t === flipAt) belt.flip();
    world.step();
    if (world.objects.length > 0) return world.tick;
  }
  return -1;
}

describe('a spawner can hold its first toy until the first press', () => {
  const def = HOLD.spawners[0];
  const due = msToTicks(def.delay ?? 0);

  it('holds the first toy at the pipe until the belt is flipped', () => {
    const world = new FactoryWorld(HOLD);
    world.start();
    for (let t = 0; t < due + 60; t++) world.step();
    expect(world.objects.length).toBe(0);
    expect(world.spawners[0].holding).toBe(true);
    expect(world.spawners[0].ticksToNext()).toBe(0);
  });

  it('drops it a beat after the press', () => {
    const at = firstSpawnTick(due + 60);
    expect(at).toBeGreaterThan(due + 60);
    expect(at).toBeLessThanOrEqual(due + 60 + 20);
  });

  it('drops it on time when the player flipped before it was due', () => {
    expect(Math.abs(firstSpawnTick(10) - due)).toBeLessThanOrEqual(1);
  });

  it('drops it anyway after the hold limit, so doing nothing still fails', () => {
    const at = firstSpawnTick();
    expect(at).toBeGreaterThan(due + msToTicks(def.holdFirstForFlip ?? 0) - 2);
    expect(at).toBeLessThan(due + msToTicks(def.holdFirstForFlip ?? 0) + 4);
  });

  it('holds again after a reset', () => {
    const world = new FactoryWorld(HOLD);
    world.start();
    (world.machine('belt') as ConveyorBelt).flip();
    world.reset();
    world.start();
    for (let t = 0; t < due + 30; t++) world.step();
    expect(world.spawners[0].holding).toBe(true);
  });
});
