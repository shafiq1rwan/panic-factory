import { msToTicks, STEP_MS, type ObjType } from '../config';
import { PANIC_SPAWN } from '../levels/panicLevel';
import { ConveyorBelt } from '../machines/ConveyorBelt';
import type { FactoryWorld } from '../sim/FactoryWorld';
import { PanicScore } from './ScoreManager';

export type PanicEventKind = 'reverse' | 'rush' | 'turbo' | 'lowgrav' | 'jam';

const EVENT_INFO: Record<PanicEventKind, { warn: string; label: string; duration: number }> = {
  reverse: { warn: 'BELT REVERSE!', label: '', duration: 0 },
  rush: { warn: 'TOY RUSH!', label: 'Toy rush', duration: 7000 },
  turbo: { warn: 'TURBO BELTS!', label: 'Turbo belts', duration: 8000 },
  lowgrav: { warn: 'LOW GRAVITY!', label: 'Low gravity', duration: 7000 },
  jam: { warn: 'BELT JAM!', label: 'Belt jam', duration: 4000 },
};
const KINDS = Object.keys(EVENT_INFO) as PanicEventKind[];
const WARN_TICKS = msToTicks(2200);
const TYPES: ObjType[] = ['blue', 'pink', 'yellow'];

/**
 * Runs Panic Factory: endless spawning that slowly speeds up, plus telegraphed
 * malfunctions. Every malfunction is announced about two seconds ahead and none
 * of them can cost a life by itself, so a lost life is always a fixable mistake.
 * Pure logic (no rendering) so it can be tested headlessly.
 */
export class PanicDirector {
  readonly score = new PanicScore();
  readonly maxLives = 3;
  lives = 3;
  over = false;
  /** text of the malfunction currently being announced ('' = none) */
  warning = '';
  /** label + countdown of the running malfunction ('' = none) */
  activeEffect = '';
  /** set false to disable malfunctions (tests) */
  eventsEnabled = true;

  private nextSpawn = msToTicks(900);
  private nextEvent = msToTicks(20000);
  private pending: PanicEventKind | null = null;
  private pendingAt = 0;
  private active: PanicEventKind | null = null;
  private activeEnd = 0;
  private lastKind: PanicEventKind | null = null;
  private jammed: ConveyorBelt | null = null;
  private lastTypes: ObjType[] = [];

  constructor(private world: FactoryWorld) {
    world.events.on('deliver', (_obj: unknown, _bin: unknown, correct: boolean) => {
      if (this.over) return;
      if (correct) {
        const r = this.score.correct(world.tick);
        world.events.emit('panicScore', r.points, r.chain, this.score.multiplier);
      } else {
        this.score.mistake();
        this.lives--;
        if (this.lives <= 0) this.over = true;
      }
    });
  }

  get seconds(): number {
    return (this.world.tick * STEP_MS) / 1000;
  }

  private get belts(): ConveyorBelt[] {
    return this.world.machines.filter((m): m is ConveyorBelt => m instanceof ConveyorBelt);
  }

  /** ms between spawns: starts relaxed, tightens over ~90 s, never becomes unreadable. */
  get spawnInterval(): number {
    const base = Math.max(1300, 2700 - this.seconds * 16);
    return this.active === 'rush' ? base * 0.7 : base;
  }

  private pickType(): ObjType {
    let t = this.world.rng.pick(TYPES);
    // never three of the same colour in a row
    const n = this.lastTypes.length;
    if (n >= 2 && this.lastTypes[n - 1] === t && this.lastTypes[n - 2] === t) {
      t = TYPES[(TYPES.indexOf(t) + 1 + Math.floor(this.world.rng.next() * 2)) % 3];
    }
    this.lastTypes.push(t);
    if (this.lastTypes.length > 4) this.lastTypes.shift();
    return t;
  }

  private startEvent(kind: PanicEventKind): void {
    const info = EVENT_INFO[kind];
    const world = this.world;
    if (kind === 'reverse') {
      world.rng.pick(this.belts).flip();
      return;
    }
    this.active = kind;
    this.activeEnd = world.tick + msToTicks(info.duration);
    if (kind === 'lowgrav') world.engine.gravity.y = 0.42;
    if (kind === 'jam') {
      this.jammed = world.rng.pick(this.belts.filter((b) => b.id !== 'top'));
      this.jammed.disabled = true;
      world.events.emit('machineChanged', this.jammed);
    }
  }

  private endEvent(): void {
    const world = this.world;
    if (this.active === 'lowgrav') world.engine.gravity.y = 1;
    if (this.jammed) {
      this.jammed.disabled = false;
      world.events.emit('machineChanged', this.jammed);
      this.jammed = null;
    }
    this.active = null;
    this.activeEffect = '';
  }

  /** Call once per tick, before world.step(). */
  update(): void {
    if (this.over) return;
    const world = this.world;
    const tick = world.tick;

    // belts gradually speed up; turbo adds a temporary boost
    world.machineSpeedScale = (1 + Math.min(0.55, this.seconds / 220)) * (this.active === 'turbo' ? 1.5 : 1);

    if (tick >= this.nextSpawn) {
      // hold back if the factory is crowded or the drop point is blocked
      const blocked = world.objects.some((o) => Math.abs(o.x - PANIC_SPAWN.x) < 80 && o.y < PANIC_SPAWN.y + 90);
      if (world.objects.length < 14 && !blocked) {
        world.spawnObject(this.pickType(), 'standard', PANIC_SPAWN.x, PANIC_SPAWN.y, 0, 0, world.spawners[0] ?? null);
        if (world.spawners[0]) world.spawners[0].lastSpawnTick = tick;
        this.nextSpawn = tick + msToTicks(this.spawnInterval);
      } else {
        this.nextSpawn = tick + 10;
      }
    }

    if (!this.eventsEnabled) return;

    if (this.active) {
      const left = Math.ceil(((this.activeEnd - tick) * STEP_MS) / 1000);
      this.activeEffect = `${EVENT_INFO[this.active].label} ${left}s`;
      if (tick >= this.activeEnd) this.endEvent();
    }

    if (this.pending) {
      if (tick >= this.pendingAt) {
        this.startEvent(this.pending);
        this.pending = null;
        this.warning = '';
        this.nextEvent = tick + msToTicks(13000 + world.rng.next() * 6000);
      }
    } else if (!this.active && tick >= this.nextEvent) {
      let kind = world.rng.pick(KINDS);
      if (kind === this.lastKind) kind = KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length];
      this.lastKind = kind;
      this.pending = kind;
      this.pendingAt = tick + WARN_TICKS;
      this.warning = EVENT_INFO[kind].warn;
      world.events.emit('panicWarning', kind);
    }
  }
}
