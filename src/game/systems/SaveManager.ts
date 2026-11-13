const KEY = 'tiny-factory-panic-save';
const VERSION = 1;

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  reducedShake: boolean;
  reducedMotion: boolean;
}

export interface SaveData {
  v: number;
  /** best stars per level id */
  stars: Record<string, number>;
  /** number of levels unlocked (>= 1) */
  unlocked: number;
  settings: Settings;
  panicBest: number;
  tutorialsDone: Record<string, boolean>;
  /** the outfit every toy wears ('' = none) */
  outfit: string;
  /** how many outfit unlocks have been announced (cards shown) */
  outfitsSeen: number;
  /** the "Panic mode unlocked" card has been shown */
  panicOffered: boolean;
}

function defaults(): SaveData {
  return {
    v: VERSION,
    stars: {},
    unlocked: 1,
    settings: { master: 0.8, music: 0.5, sfx: 0.9, reducedShake: false, reducedMotion: false },
    panicBest: 0,
    tutorialsDone: {},
    outfit: '',
    outfitsSeen: 0,
    panicOffered: false,
  };
}

const num = (v: unknown, fallback: number, min: number, max: number): number =>
  typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** Validate untrusted JSON field by field so a corrupted save can never crash the game. */
export function sanitizeSave(raw: unknown): SaveData {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  if (r.v !== VERSION) return d; // future: migrate older versions here
  if (r.stars && typeof r.stars === 'object') {
    for (const [k, v] of Object.entries(r.stars as Record<string, unknown>)) {
      const n = num(v, 0, 0, 3);
      if (n > 0) d.stars[k] = Math.round(n);
    }
  }
  d.unlocked = Math.round(num(r.unlocked, 1, 1, 999));
  d.panicBest = Math.round(num(r.panicBest, 0, 0, 1e9));
  if (r.settings && typeof r.settings === 'object') {
    const s = r.settings as Record<string, unknown>;
    d.settings.master = num(s.master, d.settings.master, 0, 1);
    d.settings.music = num(s.music, d.settings.music, 0, 1);
    d.settings.sfx = num(s.sfx, d.settings.sfx, 0, 1);
    d.settings.reducedShake = s.reducedShake === true;
    d.settings.reducedMotion = s.reducedMotion === true;
  }
  if (r.tutorialsDone && typeof r.tutorialsDone === 'object') {
    for (const [k, v] of Object.entries(r.tutorialsDone as Record<string, unknown>)) if (v === true) d.tutorialsDone[k] = true;
  }
  // (fields added in 1.1: absent in older saves, which keep their defaults)
  if (typeof r.outfit === 'string' && /^[a-z]{0,16}$/.test(r.outfit)) d.outfit = r.outfit;
  d.outfitsSeen = Math.round(num(r.outfitsSeen, 0, 0, 99));
  d.panicOffered = r.panicOffered === true;
  return d;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Versioned LocalStorage persistence. Falls back to in-memory if storage is unavailable. */
export class SaveManager {
  data: SaveData;
  private storage: StorageLike | null;

  constructor(storage?: StorageLike | null) {
    if (storage !== undefined) this.storage = storage;
    else {
      try {
        this.storage = typeof localStorage !== 'undefined' ? localStorage : null;
      } catch {
        this.storage = null;
      }
    }
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const txt = this.storage?.getItem(KEY);
      if (!txt) return defaults();
      return sanitizeSave(JSON.parse(txt));
    } catch {
      return defaults();
    }
  }

  save(): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage full or blocked: keep playing with in-memory data */
    }
  }

  get settings(): Settings {
    return this.data.settings;
  }

  starsFor(levelId: string): number {
    return this.data.stars[levelId] ?? 0;
  }

  get totalStars(): number {
    return Object.values(this.data.stars).reduce((a, b) => a + b, 0);
  }

  /** Record a level result. Returns true if this beat the previous best. */
  recordLevel(levelId: string, levelIndex: number, stars: number): boolean {
    const prev = this.starsFor(levelId);
    const better = stars > prev;
    if (better) this.data.stars[levelId] = stars;
    this.data.unlocked = Math.max(this.data.unlocked, levelIndex + 2);
    this.save();
    return better;
  }

  recordPanic(score: number): boolean {
    if (score <= this.data.panicBest) return false;
    this.data.panicBest = score;
    this.save();
    return true;
  }

  /** Wear an outfit ('' for none). */
  wearOutfit(id: string): void {
    this.data.outfit = id;
    this.save();
  }

  markOutfitsSeen(n: number): void {
    this.data.outfitsSeen = Math.max(this.data.outfitsSeen, n);
    this.save();
  }

  markPanicOffered(): void {
    this.data.panicOffered = true;
    this.save();
  }

  markTutorial(levelId: string): void {
    if (this.data.tutorialsDone[levelId]) return;
    this.data.tutorialsDone[levelId] = true;
    this.save();
  }

  reset(): void {
    const settings = this.data.settings;
    this.data = defaults();
    this.data.settings = settings;
    this.save();
  }
}

export const save = new SaveManager();
