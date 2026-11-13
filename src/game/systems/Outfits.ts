/**
 * Toy outfits: rewards for stars. Every toy that drops wears the outfit the player chose.
 * No Phaser here (tests import it); the drawings are in rendering/OutfitArt.ts.
 *
 * Unlocks are star milestones, not a shop: the first comes with level 1's three stars, so
 * every player meets the system at once, then one roughly every two or three levels.
 */
export type OutfitSlot = 'head' | 'face';

export interface Outfit {
  id: string;
  name: string;
  /** total stars needed */
  stars: number;
  /** on top of the toy, or over its eyes */
  slot: OutfitSlot;
}

export const OUTFITS: Outfit[] = [
  { id: 'party', name: 'Party hat', stars: 3, slot: 'head' },
  { id: 'bow', name: 'Bow', stars: 9, slot: 'head' },
  { id: 'cap', name: 'Cap', stars: 15, slot: 'head' },
  { id: 'hardhat', name: 'Hard hat', stars: 24, slot: 'head' },
  { id: 'shades', name: 'Sunglasses', stars: 33, slot: 'face' },
  { id: 'flower', name: 'Flower', stars: 45, slot: 'head' },
  { id: 'chef', name: 'Chef hat', stars: 57, slot: 'head' },
  { id: 'tophat', name: 'Top hat', stars: 72, slot: 'head' },
  { id: 'crown', name: 'Crown', stars: 90, slot: 'head' },
  { id: 'halo', name: 'Halo', stars: 108, slot: 'head' },
];

export const outfitById = (id: string): Outfit | undefined => OUTFITS.find((o) => o.id === id);

/** Outfits a player with this many stars has unlocked, in order. */
export const unlockedOutfits = (stars: number): Outfit[] => OUTFITS.filter((o) => stars >= o.stars);

/** The next outfit to earn and how far along the player is (null when all are unlocked). */
export function nextOutfit(stars: number): { outfit: Outfit; have: number; need: number } | null {
  const o = OUTFITS.find((x) => stars < x.stars);
  return o ? { outfit: o, have: stars, need: o.stars } : null;
}
