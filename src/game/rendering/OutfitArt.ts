import type { ObjType } from '../config';
import { lighten, roundRect, type G } from './VectorFactory';

/**
 * Outfit drawings, flat like the toys. Head outfits are drawn with their base at y = 0 and
 * rise into negative y; the face outfit (sunglasses) is centred on the eyes.
 * Textures.ts bakes them; ObjectView puts one on every toy.
 */

const INK = 0x1e1650;

/** Baked texture size and where the drawing's anchor sits inside it (from the texture centre). */
export const OUTFIT_TEX = { w: 92, h: 92, headBase: 26 } as const;

/** Where a head outfit sits on each toy (its top, before material scale), and how big it is. */
export const HEAD_ANCHOR: Record<ObjType, { y: number; scale: number }> = {
  blue: { y: -25, scale: 1 },
  pink: { y: -24, scale: 1 },
  yellow: { y: -21, scale: 0.85 },
  green: { y: -25, scale: 0.95 },
  purple: { y: -18, scale: 0.85 },
};

/** Eye line of the face texture at its normal 1.75 scale (sunglasses sit here). */
export const FACE_EYES_Y = -4.4;

const tri = (g: G, pts: number[], color: number): void => {
  g.fillStyle(color, 1);
  g.fillTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
};

export function drawOutfit(g: G, id: string): void {
  switch (id) {
    case 'party': {
      // striped cone with a pompom
      tri(g, [-17, 2, 17, 2, 0, -40], 0xd92e7a);
      tri(g, [-15, -1, 15, -1, 0, -40], 0xff4f9a);
      g.fillStyle(0xffcf33, 1);
      g.fillPoints([{ x: -11, y: -12 }, { x: 6, y: -18 }, { x: 4, y: -24 }, { x: -8, y: -19 }] as never, true);
      g.fillPoints([{ x: -6, y: -27 }, { x: 3, y: -31 }, { x: 1, y: -35 }, { x: -3, y: -33 }] as never, true);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(0, -41, 6);
      break;
    }
    case 'bow': {
      const red = 0xff4d5e;
      tri(g, [0, -8, -24, -20, -24, 4], 0xd63848);
      tri(g, [0, -8, 24, -20, 24, 4], 0xd63848);
      tri(g, [0, -9, -21, -18, -21, 1], red);
      tri(g, [0, -9, 21, -18, 21, 1], red);
      g.fillStyle(0xd63848, 1);
      g.fillCircle(0, -8, 7);
      g.fillStyle(lighten(red, 0.35), 1);
      g.fillCircle(-1, -10, 3);
      break;
    }
    case 'cap': {
      const c = 0xff7a3d;
      g.fillStyle(0xd85a20, 1);
      g.fillRoundedRect(4, -4, 30, 8, 4); // brim
      g.fillStyle(c, 1);
      g.beginPath();
      g.arc(0, 2, 19, Math.PI, 0, false);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(0, -17, 3);
      g.fillStyle(0xffffff, 0.3);
      g.fillEllipse(-7, -9, 10, 5);
      break;
    }
    case 'hardhat': {
      const y = 0xffcf33;
      g.fillStyle(0xf2a51e, 1);
      g.fillRoundedRect(-27, -3, 54, 8, 4); // brim
      g.fillStyle(y, 1);
      g.beginPath();
      g.arc(0, 0, 21, Math.PI, 0, false);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xf2a51e, 1);
      g.fillRoundedRect(-4, -21, 8, 21, 3); // ridge
      g.fillStyle(0xffffff, 0.35);
      g.fillEllipse(-10, -11, 9, 5);
      break;
    }
    case 'shades': {
      // centred on the eyes (eye centres at +-11.5)
      g.fillStyle(INK, 1);
      g.fillRoundedRect(-24, -8, 21, 15, 6);
      g.fillRoundedRect(3, -8, 21, 15, 6);
      g.fillRect(-4, -5, 8, 3);
      g.fillStyle(0xffffff, 0.75);
      g.fillRoundedRect(-20, -5, 6, 3, 1.5);
      g.fillRoundedRect(7, -5, 6, 3, 1.5);
      break;
    }
    case 'flower': {
      const petals = [0xff8fc4, 0xffffff];
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        g.fillStyle(petals[i % 2], 1);
        g.fillCircle(Math.cos(a) * 9, -12 + Math.sin(a) * 9, 7);
      }
      g.fillStyle(0xffcf33, 1);
      g.fillCircle(0, -12, 6);
      g.fillStyle(0x3ee08a, 1);
      tri(g, [3, -2, 16, -6, 9, 4], 0x1fb866);
      break;
    }
    case 'chef': {
      g.fillStyle(0xd9dde6, 1);
      g.fillRoundedRect(-16, -14, 32, 15, 3);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(-15, -16, 30, 14, 3);
      for (const [x, yy, r] of [[-10, -24, 11], [10, -24, 11], [0, -31, 13]] as const) g.fillCircle(x, yy, r);
      g.fillStyle(0xd9dde6, 0.8);
      g.fillRect(-15, -5, 30, 2);
      break;
    }
    case 'tophat': {
      const c = 0x2a1f6b;
      g.fillStyle(c, 1);
      g.fillRoundedRect(-25, -4, 50, 8, 4); // brim
      g.fillRoundedRect(-15, -40, 30, 38, 4);
      g.fillStyle(0xff4d5e, 1);
      g.fillRect(-15, -13, 30, 7); // band
      g.fillStyle(0xffffff, 0.18);
      g.fillRect(-11, -37, 5, 22);
      break;
    }
    case 'crown': {
      const gold = 0xffcf33;
      g.fillStyle(0xf2a51e, 1);
      g.fillRoundedRect(-19, -10, 38, 12, 3);
      g.fillStyle(gold, 1);
      g.fillPoints([{ x: -19, y: -8 }, { x: -19, y: -30 }, { x: -9, y: -17 }, { x: 0, y: -34 }, { x: 9, y: -17 }, { x: 19, y: -30 }, { x: 19, y: -8 }] as never, true);
      g.fillStyle(0xff4f9a, 1);
      g.fillCircle(0, -4, 4);
      g.fillStyle(0x2bb8ff, 1);
      g.fillCircle(-11, -4, 3);
      g.fillCircle(11, -4, 3);
      g.fillStyle(0xffffff, 0.9);
      for (const x of [-19, 0, 19]) g.fillCircle(x, x === 0 ? -34 : -30, 3);
      break;
    }
    case 'halo': {
      g.lineStyle(9, 0xf2a51e, 1);
      g.strokeEllipse(0, -18, 44, 13);
      g.lineStyle(5, 0xffe066, 1);
      g.strokeEllipse(0, -19, 44, 13);
      break;
    }
  }
}

/** A small round tile behind an outfit (wardrobe, cards). */
export function outfitTile(g: G, size: number, color: number): void {
  roundRect(g, -size / 2, -size / 2, size, size, size * 0.28, color, 0);
}
