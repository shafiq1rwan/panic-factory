import { HUD_H, MAX_ACTIVE_OBJECTS, MAX_OBJECT_SPEED, STEP_MS, type ObjType } from '../config';
import { FactoryObject } from '../entities/FactoryObject';
import { ObjectSpawner } from '../entities/ObjectSpawner';
import type { LevelConfig, LevelDef, MachineDef } from '../levels/LevelTypes';
import type { BaseMachine } from '../machines/BaseMachine';
import { ConveyorBelt } from '../machines/ConveyorBelt';
import { DeliveryBin } from '../machines/DeliveryBin';
import { Fan } from '../machines/Fan';
import { Funnel } from '../machines/Funnel';
import { Piston } from '../machines/Piston';
import { SpringBumper } from '../machines/SpringBumper';
import { FILTER } from '../physics/CollisionCategories';
import { M, type Body, type Pair } from '../physics/MatterLib';
import type { MaterialId } from '../physics/PhysicsMaterials';
import { Emitter, Rng } from './Emitter';

export interface WorldOptions {
  seed?: number;
  /** Random horizontal spawn offset in px (robustness testing only). */
  jitter?: number;
}

function createMachine(world: FactoryWorld, def: MachineDef): BaseMachine {
  switch (def.kind) {
    case 'conveyor':
      return new ConveyorBelt(world, def);
    case 'bumper':
      return new SpringBumper(world, def);
    case 'piston':
      return new Piston(world, def);
    case 'funnel':
      return new Funnel(world, def);
    case 'bin':
      return new DeliveryBin(world, def);
    case 'fan':
      return new Fan(world, def);
  }
}

/**
 * Set-up levels have bins only for the colours that drop, with bare floor between them.
 * A toy whose centre gets this close to the bottom of the play field outside every bin has
 * hit the floor: it is out (and pops on screen).
 */
const MISS_ABOVE_FLOOR = 56;

/**
 * The complete physical factory for one level: Matter engine, walls, machines,
 * spawners and objects. Advances in fixed ticks and is fully deterministic for
 * a given configuration, which is what makes puzzle levels fair and verifiable.
 *
 * Events: spawn(obj, spawner) | deliver(obj, bin, correct) | lost(obj) |
 * impact(obj, speed, other) | bump(bumper, obj) | pistonFire(piston) |
 * conveyorFlip(conveyor) | machineChanged(machine) | cleared()
 */
export class FactoryWorld {
  readonly events = new Emitter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly engine: any;
  readonly rng: Rng;
  readonly jitter: number;
  readonly width: number;
  readonly height: number;

  tick = 0;
  running = false;
  objects: FactoryObject[] = [];
  machines: BaseMachine[] = [];
  spawners: ObjectSpawner[] = [];
  wallBodies: Body[] = [];
  /** Multiplier applied to conveyor speeds (Panic mode "turbo"). */
  machineSpeedScale = 1;
  /** Belt flips since the last reset (a spawner can hold its first toy until the first one). */
  flipCount = 0;
  lostCount = 0;

  private onCollisionStart: (e: { pairs: Pair[] }) => void;

  constructor(
    readonly level: LevelDef,
    opts: WorldOptions = {},
  ) {
    this.width = level.width;
    this.height = level.height;
    this.rng = new Rng(opts.seed ?? 12345);
    this.jitter = opts.jitter ?? 0;
    this.engine = M.Engine.create({ positionIterations: 8, velocityIterations: 6, enableSleeping: false });
    this.engine.gravity.x = 0;
    this.engine.gravity.y = 1;

    this.buildWalls();
    for (const def of level.machines) {
      const m = createMachine(this, def);
      m.create();
      this.machines.push(m);
    }
    for (const def of level.spawners) this.spawners.push(new ObjectSpawner(this, def));

    this.onCollisionStart = (e) => this.handleCollisionStart(e.pairs);
    M.Events.on(this.engine, 'collisionStart', this.onCollisionStart);
  }

  private buildWalls(): void {
    const w = this.width;
    const h = this.height;
    const add = (x: number, y: number, bw: number, bh: number, angle = 0, chamfer = 0) => {
      const body: Body = M.Bodies.rectangle(x, y, bw, bh, {
        isStatic: true,
        angle: (angle * Math.PI) / 180,
        friction: 0.3,
        restitution: 0.1,
        chamfer: chamfer ? { radius: chamfer } : undefined,
        collisionFilter: { ...FILTER.wall },
      });
      body.ref = { kind: 'wall' };
      M.Composite.add(this.engine.world, body);
      this.wallBodies.push(body);
    };
    // Screen bounds: sides and ceiling. The bottom is open (objects that fall out are lost).
    add(-30, h / 2, 60, h * 3);
    add(w + 30, h / 2, 60, h * 3);
    add(w / 2, HUD_H - 30, w * 2, 60);
    for (const wall of this.level.walls) {
      add(wall.x, wall.y, wall.w, wall.h, wall.angle ?? 0, Math.min(8, Math.min(wall.w, wall.h) / 2 - 1));
    }
  }

  // --- lifecycle --------------------------------------------------------------

  /** Press "Run": lock configuration and start spawners + machinery. */
  start(): void {
    if (this.running) return;
    this.running = true;
    for (const m of this.machines) m.activate();
    for (const s of this.spawners) s.activate();
    this.events.emit('started');
  }

  /** Back to the preparation phase. Player configuration is preserved. */
  reset(): void {
    this.running = false;
    for (const o of this.objects) M.Composite.remove(this.engine.world, o.body);
    this.objects.length = 0;
    for (const m of this.machines) m.reset();
    for (const s of this.spawners) s.reset();
    this.tick = 0;
    this.lostCount = 0;
    this.flipCount = 0;
    this.machineSpeedScale = 1;
    this.engine.gravity.y = 1;
    this.events.emit('cleared');
  }

  destroy(): void {
    M.Events.off(this.engine, 'collisionStart', this.onCollisionStart);
    this.events.removeAll();
    M.Composite.clear(this.engine.world, false, true);
    M.Engine.clear(this.engine);
    this.objects.length = 0;
    this.machines.length = 0;
    this.spawners.length = 0;
    this.wallBodies.length = 0;
  }

  // --- stepping ---------------------------------------------------------------

  /** Advance exactly one fixed tick. */
  step(): void {
    if (!this.running) return;
    this.tick++;
    for (const s of this.spawners) s.update();
    for (const m of this.machines) m.update(this.tick);

    M.Engine.update(this.engine, STEP_MS);

    // Book-keeping straight after the solver (before belts/bumpers touch velocities).
    for (const o of this.objects) {
      o.age++;
      if (o.bumpCooldown > 0) o.bumpCooldown--;
      // "At rest" = has not left a small radius, so belt-jitter against a wall still counts.
      const dx = o.x - o.anchorX;
      const dy = o.y - o.anchorY;
      if (dx * dx + dy * dy > 25) {
        o.anchorX = o.x;
        o.anchorY = o.y;
        o.restTicks = 0;
      } else {
        o.restTicks++;
      }
    }

    // Contact-driven machine behaviour (conveyors, bumpers, bin sensors).
    const pairs: Pair[] = this.engine.pairs.list;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      if (!pair.isActive) continue;
      const ra = pair.bodyA.ref;
      const rb = pair.bodyB.ref;
      if (!ra || !rb) continue;
      if (ra.kind === 'object' && rb.kind === 'machine') {
        this.contact(ra.obj as FactoryObject, rb.machine as BaseMachine, rb.role!);
      } else if (rb.kind === 'object' && ra.kind === 'machine') {
        this.contact(rb.obj as FactoryObject, ra.machine as BaseMachine, ra.role!);
      }
    }

    // Speed limit (anti-tunnelling) and out-of-play removal.
    let removed = false;
    for (const o of this.objects) {
      if (o.state !== 'active') {
        removed = true;
        continue;
      }
      const b = o.body;
      if (b.speed > MAX_OBJECT_SPEED) {
        const k = MAX_OBJECT_SPEED / b.speed;
        M.Body.setVelocity(b, { x: b.velocity.x * k, y: b.velocity.y * k });
      }
      const missed = this.level.plan === true && o.y > this.height - MISS_ABOVE_FLOOR && !this.overBin(o.x);
      if (missed || o.y > this.height + 70 || o.x < -80 || o.x > this.width + 80 || o.y < -400) {
        o.missed = missed;
        o.state = 'lost';
        this.lostCount++;
        M.Composite.remove(this.engine.world, b);
        this.events.emit('lost', o);
        removed = true;
      }
    }
    if (removed) this.objects = this.objects.filter((o) => o.state === 'active');
  }

  private contact(obj: FactoryObject, machine: BaseMachine, role: string): void {
    if (obj.state !== 'active') return;
    machine.onContact(obj, role);
  }

  private handleCollisionStart(pairs: Pair[]): void {
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      if (pair.isSensor) continue;
      const a = pair.bodyA;
      const b = pair.bodyB;
      const oa = a.ref?.kind === 'object' ? (a.ref.obj as FactoryObject) : null;
      const ob = b.ref?.kind === 'object' ? (b.ref.obj as FactoryObject) : null;
      if (!oa && !ob) continue;
      const n = pair.collision.normal;
      const rel = Math.abs((a.velocity.x - b.velocity.x) * n.x + (a.velocity.y - b.velocity.y) * n.y);
      if (rel < 1.2) continue;
      if (oa) this.events.emit('impact', oa, rel, ob);
      if (ob) this.events.emit('impact', ob, rel, oa);
    }
  }

  // --- objects ----------------------------------------------------------------

  spawnObject(
    type: ObjType,
    material: MaterialId,
    x: number,
    y: number,
    vx = 0,
    vy = 0,
    spawner: ObjectSpawner | null = null,
  ): FactoryObject | null {
    if (this.objects.length >= MAX_ACTIVE_OBJECTS) return null;
    const obj = new FactoryObject(type, material, x, y);
    M.Composite.add(this.engine.world, obj.body);
    if (vx || vy) M.Body.setVelocity(obj.body, { x: vx, y: vy });
    this.objects.push(obj);
    this.events.emit('spawn', obj, spawner);
    return obj;
  }

  /** Called by a bin sensor. Removes the body so one object can only ever score once. */
  deliver(obj: FactoryObject, bin: DeliveryBin, correct: boolean): void {
    if (obj.state !== 'active') return;
    obj.state = 'delivered';
    M.Composite.remove(this.engine.world, obj.body);
    this.events.emit('deliver', obj, bin, correct);
  }

  get allSpawned(): boolean {
    return this.spawners.every((s) => s.done);
  }

  /** Objects of `type` that could still be delivered (in play or waiting to spawn). */
  availableOf(type: ObjType): number {
    let n = 0;
    for (const o of this.objects) if (o.state === 'active' && o.type === type) n++;
    for (const s of this.spawners) n += s.remainingOf(type);
    return n;
  }

  /** Is x above one of the bins (rim included)? */
  overBin(x: number): boolean {
    return this.bins.some((b) => Math.abs(x - b.x) <= b.width / 2 + 2);
  }

  get bins(): DeliveryBin[] {
    return this.machines.filter((m): m is DeliveryBin => m instanceof DeliveryBin);
  }

  machine(id: string): BaseMachine | undefined {
    return this.machines.find((m) => m.id === id);
  }

  get bodyCount(): number {
    return M.Composite.allBodies(this.engine.world).length;
  }

  // --- configuration ----------------------------------------------------------

  getConfig(): LevelConfig {
    const cfg: LevelConfig = {};
    for (const m of this.machines) if (m.configurable) cfg[m.id] = m.getConfig();
    return cfg;
  }

  applyConfig(cfg: LevelConfig): void {
    for (const id of Object.keys(cfg)) this.machine(id)?.applyConfig(cfg[id]);
  }

  /** Clamp a desired machine centre into its placement zone. */
  clampToZone(machine: BaseMachine, x: number, y: number): { x: number; y: number } {
    const z = machine.def.zone;
    if (!z) return { x: machine.x, y: machine.y };
    return {
      x: Math.min(z.x + z.w, Math.max(z.x, x)),
      y: Math.min(z.y + z.h, Math.max(z.y, y)),
    };
  }

  /** True when the machine does not intersect walls or other machines. */
  isPlacementValid(machine: BaseMachine): boolean {
    const others: Body[] = [...this.wallBodies];
    for (const m of this.machines) {
      if (m === machine) continue;
      for (const b of m.bodies) if (!b.isSensor) others.push(b);
    }
    for (const body of machine.bodies) {
      if (body.isSensor) continue;
      if (M.Query.collides(body, others).length > 0) return false;
    }
    return true;
  }
}
