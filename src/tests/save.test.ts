import { describe, expect, it } from 'vitest';
import { SaveManager, sanitizeSave } from '../game/systems/SaveManager';

class FakeStorage {
  map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
}

describe('save system', () => {
  it('starts with safe defaults when nothing is stored', () => {
    const s = new SaveManager(new FakeStorage());
    expect(s.data.unlocked).toBe(1);
    expect(s.totalStars).toBe(0);
    expect(s.settings.master).toBeGreaterThan(0);
  });

  it('persists progress, stars, settings, high score and tutorials', () => {
    const storage = new FakeStorage();
    const a = new SaveManager(storage);
    expect(a.recordLevel('first-shift', 0, 2)).toBe(true);
    expect(a.recordLevel('first-shift', 0, 1)).toBe(false); // never lowers the best
    expect(a.recordLevel('first-shift', 0, 3)).toBe(true);
    a.recordPanic(120);
    a.recordPanic(80);
    a.markTutorial('first-shift');
    a.settings.music = 0.25;
    a.settings.reducedShake = true;
    a.save();

    const b = new SaveManager(storage);
    expect(b.starsFor('first-shift')).toBe(3);
    expect(b.data.unlocked).toBe(2);
    expect(b.data.panicBest).toBe(120);
    expect(b.data.tutorialsDone['first-shift']).toBe(true);
    expect(b.settings.music).toBe(0.25);
    expect(b.settings.reducedShake).toBe(true);
  });

  it('survives corrupted or hostile data', () => {
    const storage = new FakeStorage();
    storage.setItem('tiny-factory-panic-save', '{not json');
    expect(new SaveManager(storage).data.unlocked).toBe(1);

    const weird = sanitizeSave({ v: 1, unlocked: 'lots', stars: { a: 99, b: -4, c: 'x' }, settings: { master: 7, sfx: null }, panicBest: NaN });
    expect(weird.unlocked).toBe(1);
    expect(weird.stars).toEqual({ a: 3 });
    expect(weird.settings.master).toBe(1);
    expect(weird.settings.sfx).toBe(0.9);
    expect(weird.panicBest).toBe(0);

    expect(sanitizeSave(null).unlocked).toBe(1);
    expect(sanitizeSave([1, 2, 3]).unlocked).toBe(1);
    expect(sanitizeSave({ v: 999, unlocked: 12 }).unlocked).toBe(1); // unknown version -> defaults
  });

  it('keeps working when storage is unavailable', () => {
    const broken = {
      getItem(): string | null {
        throw new Error('blocked');
      },
      setItem(): void {
        throw new Error('blocked');
      },
    };
    const s = new SaveManager(broken);
    expect(() => s.recordLevel('x', 0, 3)).not.toThrow();
    expect(s.starsFor('x')).toBe(3);
    expect(() => new SaveManager(null).save()).not.toThrow();
  });

  it('reset clears progress but keeps settings', () => {
    const s = new SaveManager(new FakeStorage());
    s.recordLevel('x', 4, 3);
    s.settings.sfx = 0.1;
    s.reset();
    expect(s.totalStars).toBe(0);
    expect(s.data.unlocked).toBe(1);
    expect(s.settings.sfx).toBe(0.1);
  });
});
