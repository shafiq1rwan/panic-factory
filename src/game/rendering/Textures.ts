import Phaser from 'phaser';
import { COLORS, OBJ_TYPES, TEX_SCALE, WORKSHOP, type ObjType } from '../config';
import type { MaterialId } from '../physics/PhysicsMaterials';
import { OUTFITS } from '../systems/Outfits';
import { drawOutfit, OUTFIT_TEX } from './OutfitArt';
import { capsule, drawFace, drawToy, drawToyShadow, EXPRESSIONS, roundRect, star, type Expression, type G } from './VectorFactory';

const MATERIAL_IDS: MaterialId[] = ['standard', 'bouncy', 'heavy', 'slippery'];
export const TOY_TEX_SIZE = 112;

export const toyKey = (type: ObjType, material: MaterialId): string => `toy_${type}_${material}`;
export const toyShadowKey = (type: ObjType, material: MaterialId): string => `toyshadow_${type}_${material}`;
export const faceKey = (expr: Expression): string => `face_${expr}`;
export const outfitKey = (id: string): string => `outfit_${id}`;

/**
 * Rasterise a vector drawing into a cached texture (centred on the texture).
 * Everything the game shows is drawn by code; there are no image files.
 */
function bake(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.scaleCanvas(TEX_SCALE, TEX_SCALE);
  g.translateCanvas(w / 2, h / 2);
  draw(g);
  g.generateTexture(key, Math.ceil(w * TEX_SCALE), Math.ceil(h * TEX_SCALE));
  g.destroy();
}

export function generateTextures(scene: Phaser.Scene): void {
  for (const type of OBJ_TYPES) {
    for (const material of MATERIAL_IDS) {
      bake(scene, toyKey(type, material), TOY_TEX_SIZE, TOY_TEX_SIZE, (g) => drawToy(g, type, material));
      bake(scene, toyShadowKey(type, material), TOY_TEX_SIZE, TOY_TEX_SIZE, (g) => drawToyShadow(g, type, material));
    }
  }
  for (const expr of EXPRESSIONS) bake(scene, faceKey(expr), 36, 34, (g) => drawFace(g, expr));
  // outfits: head ones baked with their base below the texture centre, the face one centred
  for (const o of OUTFITS) {
    bake(scene, outfitKey(o.id), OUTFIT_TEX.w, OUTFIT_TEX.h, (g) => {
      if (o.slot === 'head') g.translateCanvas(0, OUTFIT_TEX.headBase);
      drawOutfit(g, o.id);
    });
  }

  // particles (white, tinted at runtime)
  bake(scene, 'p_dot', 16, 16, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, 0, 6);
  });
  bake(scene, 'p_star', 24, 24, (g) => star(g, 0, 0, 10, 0xffffff, 0));
  bake(scene, 'p_rect', 14, 10, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(-6, -3.5, 12, 7, 2);
  });
  bake(scene, 'p_puff', 28, 28, (g) => {
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(0, 0, 12);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(0, 0, 8);
  });
  bake(scene, 'p_ring', 40, 40, (g) => {
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(0, 0, 16);
  });

  // tutorial hand: fingertip sits at the texture centre
  bake(scene, 'hand', 72, 88, (g) => {
    const white = 0xffffff;
    capsule(g, 0, 6, 0, 30, 15, white, 3, WORKSHOP.accent);
    roundRect(g, -10, 22, 32, 30, 11, white, 3, WORKSHOP.accent);
    capsule(g, -14, 34, -8, 42, 12, white, 3, WORKSHOP.accent);
    // cover inner outlines so the glove reads as one shape
    g.fillStyle(white, 1);
    g.fillRect(-5.5, 20, 11, 12);
    g.fillRect(-9, 33, 8, 10);
    g.lineStyle(2, WORKSHOP.accent, 0.6);
    g.lineBetween(8, 30, 8, 40);
    g.lineBetween(14.5, 31, 14.5, 40);
  });
}
