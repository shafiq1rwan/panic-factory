/** Collision categories (bit flags) and the masks each kind of body uses. */
export const CAT = {
  WALL: 0x0001,
  OBJECT: 0x0002,
  MACHINE: 0x0004,
  SENSOR: 0x0008,
} as const;

export const FILTER = {
  wall: { category: CAT.WALL, mask: CAT.OBJECT, group: 0 },
  machine: { category: CAT.MACHINE, mask: CAT.OBJECT, group: 0 },
  object: { category: CAT.OBJECT, mask: CAT.WALL | CAT.OBJECT | CAT.MACHINE | CAT.SENSOR, group: 0 },
  /** Sensors only ever see factory objects. */
  sensor: { category: CAT.SENSOR, mask: CAT.OBJECT, group: 0 },
} as const;
