import { OBJ_TYPES, STEP_MS, TYPE_COLORS, msToTicks, type ObjType } from '../config';
import type { LevelDef } from '../levels/LevelTypes';
import type { FactoryWorld } from '../sim/FactoryWorld';

export type RuleStatus = 'running' | 'won' | 'failed';

/** If everything has spawned and nothing moves for this long, the run is stuck. */
const STUCK_TICKS = msToTicks(2500);
/** Hard cap after the final spawn so a run can never hang forever. */
const OVERTIME_TICKS = msToTicks(40000);

/**
 * Win / lose rules for a puzzle level. Pure logic driven by world events, so
 * the exact same rules run in the game, in tests and in the level solver.
 */
export class PuzzleRules {
  status: RuleStatus = 'running';
  failReason = '';
  delivered: Record<ObjType, number> = { blue: 0, pink: 0, yellow: 0, green: 0 };
  mistakes = 0;
  lost = 0;
  /** tick at which the run was decided */
  endTick = 0;
  private lastSpawnTick = 0;
  /** how the most recent toy of each type was wasted, for a helpful failure message */
  private lastSlip: Partial<Record<ObjType, 'wrong' | 'lost'>> = {};

  constructor(
    readonly world: FactoryWorld,
    readonly level: LevelDef,
  ) {
    world.events.on('deliver', (obj: { type: ObjType }, _bin: unknown, correct: boolean) => {
      if (this.status !== 'running') return;
      if (correct) this.delivered[obj.type]++;
      else {
        this.mistakes++;
        this.lastSlip[obj.type] = 'wrong';
      }
    });
    world.events.on('lost', (obj: { type: ObjType }) => {
      if (this.status !== 'running') return;
      this.lost++;
      this.lastSlip[obj.type] = 'lost';
    });
    world.events.on('spawn', () => {
      this.lastSpawnTick = world.tick;
    });
    world.events.on('cleared', () => this.reset());
  }

  reset(): void {
    this.status = 'running';
    this.failReason = '';
    this.delivered = { blue: 0, pink: 0, yellow: 0, green: 0 };
    this.mistakes = 0;
    this.lost = 0;
    this.endTick = 0;
    this.lastSpawnTick = 0;
    this.lastSlip = {};
  }

  needed(type: ObjType): number {
    return this.level.objective[type] ?? 0;
  }

  remaining(type: ObjType): number {
    return Math.max(0, this.needed(type) - this.delivered[type]);
  }

  get mistakesLeft(): number {
    return Math.max(0, this.level.mistakesAllowed - this.mistakes);
  }

  get elapsedSeconds(): number {
    const t = this.status === 'running' ? this.world.tick : this.endTick;
    return (t * STEP_MS) / 1000;
  }

  get timeLeft(): number | null {
    if (!this.level.timeLimit) return null;
    return Math.max(0, this.level.timeLimit - this.elapsedSeconds);
  }

  private fail(reason: string): void {
    this.status = 'failed';
    this.failReason = reason;
    this.endTick = this.world.tick;
  }

  /** Evaluate end conditions. Call once per tick after world.step(). */
  update(): RuleStatus {
    if (this.status !== 'running' || !this.world.running) return this.status;
    const world = this.world;

    let complete = true;
    for (const type of OBJ_TYPES) if (this.remaining(type) > 0) complete = false;
    if (complete) {
      this.status = 'won';
      this.endTick = world.tick;
      return this.status;
    }

    if (this.mistakes > this.level.mistakesAllowed) {
      this.fail('Too many mix-ups!');
      return this.status;
    }

    for (const type of OBJ_TYPES) {
      const need = this.remaining(type);
      if (need > 0 && world.availableOf(type) < need) {
        const name = TYPE_COLORS[type].name;
        this.fail(this.lastSlip[type] === 'wrong' ? `${name} toys went in the wrong bin!` : `Too many ${name.toLowerCase()} toys fell out!`);
        return this.status;
      }
    }

    if (this.level.timeLimit && this.elapsedSeconds >= this.level.timeLimit) {
      this.fail('Out of time!');
      return this.status;
    }

    if (world.allSpawned) {
      let stuck = world.objects.length > 0;
      for (const o of world.objects) if (o.restTicks < STUCK_TICKS) stuck = false;
      if (stuck) this.fail('The toys got stuck!');
      else if (world.tick - this.lastSpawnTick > OVERTIME_TICKS) this.fail('That took too long!');
    }
    return this.status;
  }
}
