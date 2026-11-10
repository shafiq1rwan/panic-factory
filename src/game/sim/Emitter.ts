// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fn = (...args: any[]) => void;

/** Minimal event emitter so the simulation has no Phaser dependency. */
export class Emitter {
  private map = new Map<string, Fn[]>();

  on(event: string, fn: Fn): this {
    const list = this.map.get(event);
    if (list) list.push(fn);
    else this.map.set(event, [fn]);
    return this;
  }

  off(event: string, fn: Fn): this {
    const list = this.map.get(event);
    if (list) {
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    }
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: string, ...args: any[]): void {
    const list = this.map.get(event);
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](...args);
  }

  removeAll(): void {
    this.map.clear();
  }
}

/** Small deterministic PRNG (mulberry32). */
export class Rng {
  private s: number;
  constructor(seed = 1) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}
