import { describe, expect, it } from 'vitest';
import { LEVELS } from '../game/levels/levels';
import { nextOutfit, OUTFITS, outfitById, unlockedOutfits } from '../game/systems/Outfits';
import { SaveManager, sanitizeSave } from '../game/systems/SaveManager';

describe('toy outfits', () => {
  it('unlock at rising star milestones, all reachable', () => {
    const ids = OUTFITS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < OUTFITS.length; i++) expect(OUTFITS[i].stars).toBeGreaterThan(OUTFITS[i - 1].stars);
    expect(OUTFITS[OUTFITS.length - 1].stars).toBeLessThanOrEqual(LEVELS.length * 3);
    for (const o of OUTFITS) expect(o.id).toMatch(/^[a-z]{1,16}$/); // the save only keeps ids like this
  });

  it('the first one comes with level 1 (three stars), so every player meets them', () => {
    expect(unlockedOutfits(0)).toEqual([]);
    expect(unlockedOutfits(3).map((o) => o.id)).toEqual(['party']);
  });

  it('report the next one and the progress towards it', () => {
    expect(nextOutfit(0)).toEqual({ outfit: outfitById('party'), have: 0, need: 3 });
    expect(nextOutfit(10)?.outfit.id).toBe('cap');
    expect(nextOutfit(LEVELS.length * 3)).toBeNull();
  });

  it('are saved: worn outfit, unlock cards seen, Panic card offered', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const a = new SaveManager(storage);
    a.wearOutfit('party');
    a.markOutfitsSeen(2);
    a.markPanicOffered();
    const b = new SaveManager(storage);
    expect(b.data.outfit).toBe('party');
    expect(b.data.outfitsSeen).toBe(2);
    expect(b.data.panicOffered).toBe(true);
  });

  it('a save from before outfits, or a bad value, falls back safely', () => {
    const old = sanitizeSave({ v: 1, stars: { 'first-flip': 3 }, unlocked: 2 });
    expect(old.outfit).toBe('');
    expect(old.outfitsSeen).toBe(0);
    expect(old.panicOffered).toBe(false);
    expect(old.stars['first-flip']).toBe(3);
    const bad = sanitizeSave({ v: 1, outfit: '<script>', outfitsSeen: 'lots', panicOffered: 'yes' });
    expect(bad.outfit).toBe('');
    expect(bad.outfitsSeen).toBe(0);
    expect(bad.panicOffered).toBe(false);
  });
});
