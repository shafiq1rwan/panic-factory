import { msToTicks, type ObjType } from '../config';
import { parseSpawn, type SpawnerDef } from '../levels/LevelTypes';
import type { FactoryWorld } from '../sim/FactoryWorld';

/** Drops an authored sequence of objects at a fixed rhythm (deterministic). */
export class ObjectSpawner {
  index = 0;
  active = false;
  private nextTick = 0;
  /** tick of the most recent spawn, for the view's squish animation */
  lastSpawnTick = -999;

  constructor(
    private world: FactoryWorld,
    readonly def: SpawnerDef,
  ) {}

  activate(): void {
    this.active = true;
    this.nextTick = this.world.tick + msToTicks(this.def.delay ?? 400);
  }

  deactivate(): void {
    this.active = false;
  }

  reset(): void {
    this.active = false;
    this.index = 0;
    this.lastSpawnTick = -999;
  }

  get done(): boolean {
    return !this.def.loop && this.index >= this.def.sequence.length;
  }

  /** How many objects of `type` are still waiting inside this spawner. */
  remainingOf(type: ObjType): number {
    if (this.def.loop) return Infinity;
    let n = 0;
    for (let i = this.index; i < this.def.sequence.length; i++) {
      if (parseSpawn(this.def.sequence[i]).type === type) n++;
    }
    return n;
  }

  /** Upcoming specs, for the queue preview. */
  upcoming(max: number): string[] {
    const seq = this.def.sequence;
    const out: string[] = [];
    for (let i = 0; i < max; i++) {
      const idx = this.index + i;
      if (this.def.loop) out.push(seq[idx % seq.length]);
      else if (idx < seq.length) out.push(seq[idx]);
    }
    return out;
  }

  update(): void {
    if (!this.active || this.done) return;
    const world = this.world;
    if (world.tick < this.nextTick) return;

    // Never spawn into another object.
    for (const o of world.objects) {
      const dx = o.x - this.def.x;
      const dy = o.y - this.def.y;
      if (dx * dx + dy * dy < 80 * 80) {
        this.nextTick = world.tick + 6;
        return;
      }
    }

    const seq = this.def.sequence;
    const spec = parseSpawn(seq[this.index % seq.length]);
    const j = world.jitter > 0 ? world.rng.range(-world.jitter, world.jitter) : 0;
    world.spawnObject(spec.type, spec.material, this.def.x + j, this.def.y, this.def.vx ?? 0, this.def.vy ?? 0, this);
    this.index++;
    this.lastSpawnTick = world.tick;
    this.nextTick = world.tick + msToTicks(this.def.interval);
  }
}
