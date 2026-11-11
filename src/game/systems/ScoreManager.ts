import type { LevelDef } from '../levels/LevelTypes';

export interface RunSummary {
  mistakes: number;
  lost: number;
  seconds: number;
}

/**
 * Three-star rating. Because the simulation is deterministic, the rating
 * depends on the player's configuration, never on lucky timing.
 *  1 star: objective complete
 *  2 stars: at most one slip (wrong bin or lost toy)
 *  3 stars: no slips at all, finished within the level's par time
 */
/** Set-up-then-run levels are rated on how many runs it took: first run 3 stars, up to 3 runs 2. */
export function starsForRuns(runs: number): 1 | 2 | 3 {
  return runs <= 1 ? 3 : runs <= 3 ? 2 : 1;
}

export function computeStars(level: LevelDef, run: RunSummary): 1 | 2 | 3 {
  const slips = run.mistakes + run.lost;
  // sorting levels are rated purely on accuracy
  if (level.sortAll) return slips === 0 ? 3 : slips === 1 ? 2 : 1;
  if (slips === 0 && run.seconds <= level.par) return 3;
  if (slips <= 1) return 2;
  return 1;
}

/** Panic mode scoring: streaks raise a multiplier, quick successive deliveries add a chain bonus. */
export class PanicScore {
  score = 0;
  combo = 0;
  bestCombo = 0;
  delivered = 0;
  private lastDeliveryTick = -9999;

  get multiplier(): number {
    return Math.min(5, 1 + Math.floor(this.combo / 4));
  }

  /** Returns the points awarded and whether a chain bonus triggered. */
  correct(tick: number): { points: number; chain: boolean } {
    this.combo++;
    this.delivered++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const chain = tick - this.lastDeliveryTick < 50;
    this.lastDeliveryTick = tick;
    const points = 10 * this.multiplier + (chain ? 5 : 0);
    this.score += points;
    return { points, chain };
  }

  mistake(): void {
    this.combo = 0;
  }
}
