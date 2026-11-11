/**
 * Where each pipe's "next toys" bubble goes: to the left or right of its pipe, and on
 * which row. Pure (no Phaser) so the tests can check every level.
 */

/** Bubble geometry, shared with SpawnerView. */
export const QUEUE = {
  /** most toys shown */
  max: 4,
  step: 36,
  pad: 14,
  /** gap from the pipe's centre to the bubble's near edge */
  offset: 62,
  /** pipe rim half-width: a bubble must stay clear of other pipes */
  pipeHalf: 52,
  /** row height when bubbles have to stack */
  rowH: 50,
  margin: 8,
} as const;

export interface QueueSlot {
  side: 1 | -1;
  row: number;
}

export const queueWidth = (toys: number): number => Math.min(QUEUE.max, toys) * QUEUE.step + QUEUE.pad;

/** Horizontal extent of a bubble. */
export function queueSpan(x: number, toys: number, side: 1 | -1): [number, number] {
  const w = queueWidth(toys);
  const near = x + side * QUEUE.offset;
  return side === 1 ? [near, near + w] : [near - w, near];
}

/**
 * Pick a side for every pipe so no bubble leaves the screen, covers another pipe or
 * overlaps another bubble. Prefers the right-hand side (the default) and the fewest
 * changes; if nothing fits on one row, later bubbles move down a row.
 */
export function layoutQueues(pipes: { x: number; toys: number }[], width: number): QueueSlot[] {
  const n = pipes.length;
  if (n === 0) return [];
  const preferred = (x: number, toys: number): 1 | -1 => (queueSpan(x, toys, 1)[1] > width - QUEUE.margin ? -1 : 1);
  const fits = (sides: (1 | -1)[]): boolean => {
    const spans = pipes.map((p, i) => queueSpan(p.x, p.toys, sides[i]));
    for (let i = 0; i < n; i++) {
      const [a, b] = spans[i];
      if (a < QUEUE.margin || b > width - QUEUE.margin) return false;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const px = pipes[j].x;
        if (b > px - QUEUE.pipeHalf && a < px + QUEUE.pipeHalf) return false;
        const [c, d] = spans[j];
        if (j > i && b + QUEUE.margin > c && a < d + QUEUE.margin) return false;
      }
    }
    return true;
  };
  const base = pipes.map((p) => preferred(p.x, p.toys));
  const options: (1 | -1)[][] = [];
  for (let mask = 0; mask < 1 << n; mask++) options.push(base.map((s, i) => ((mask >> i) & 1 ? (-s as 1 | -1) : s)));
  options.sort((p, q) => p.filter((s, i) => s !== base[i]).length - q.filter((s, i) => s !== base[i]).length);
  const found = options.find(fits);
  if (found) return found.map((side) => ({ side, row: 0 }));
  // no room on one row: keep the preferred sides and stack bubbles that would overlap
  return base.map((side, i) => ({ side, row: i }));
}
