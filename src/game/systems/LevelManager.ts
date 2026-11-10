import type { LevelDef } from '../levels/LevelTypes';
import { LEVELS } from '../levels/levels';
import { save } from './SaveManager';

/** Puzzle levels that must be completed before Panic Factory unlocks. */
export const PANIC_UNLOCK_LEVELS = 6;

/** Level lookup and progression rules (which levels / modes are unlocked). */
export const LevelManager = {
  count: LEVELS.length,

  get(index: number): LevelDef {
    return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
  },

  isUnlocked(index: number): boolean {
    return index < save.data.unlocked;
  },

  hasNext(index: number): boolean {
    return index + 1 < LEVELS.length;
  },

  get completedCount(): number {
    return LEVELS.filter((l) => save.starsFor(l.id) > 0).length;
  },

  get panicUnlocked(): boolean {
    return this.completedCount >= PANIC_UNLOCK_LEVELS;
  },

  /** Index of the first level the player has not finished yet. */
  get nextUnfinished(): number {
    const i = LEVELS.findIndex((l) => save.starsFor(l.id) === 0);
    return i < 0 ? LEVELS.length - 1 : i;
  },
};
