import Phaser from 'phaser';
import { GAME_H, GAME_W, HUD_H, PLAY_H, view, WORKSHOP } from '../config';
import { platform } from '../platform';
import { DEPTH } from './MachineViews';
import { mix } from './VectorFactory';

type G = Phaser.GameObjects.Graphics;

/** A world of the factory: its name, wall colours, wall pattern and pipe colour. */
export interface Theme {
  name: string;
  /** colour of the world's label on the level-select screen */
  tag: number;
  wallTop: number;
  wallBottom: number;
  seam: number;
  frame: number;
  floor: number;
  pattern: 'sheets' | 'planks' | 'bricks' | 'sky';
  pipe: number;
  pipeRim: number;
  /** the floor is water: bins float, a missed toy splashes */
  water?: { top: number; deep: number; foam: number };
}

/** Levels per world. Every world has its own look and brings in new toys. */
export const WORLD_SIZE = 10;

export const THEMES: Theme[] = [
  // levels 1-10: the mint workshop, lavender pipes; plain toys
  {
    name: 'Workshop', tag: 0x2bb8ff,
    wallTop: WORKSHOP.wallTop, wallBottom: WORKSHOP.wallBottom, seam: WORKSHOP.seam, frame: WORKSHOP.frame, floor: WORKSHOP.floor,
    pattern: 'sheets', pipe: 0x9b7bff, pipeRim: 0xd9ccff,
  },
  // levels 11-20: a warm wooden toy room, coral pipes; green hexagons and heavy toys
  {
    name: 'Toy Room', tag: 0xff8a5c,
    wallTop: 0xf8eee2, wallBottom: 0xecd6c1, seam: 0xdcc0a6, frame: 0xc09a7c, floor: 0x8c6c58,
    pattern: 'planks', pipe: 0xf2675c, pipeRim: 0xffcbc4,
  },
  // levels 21-30: a cool blue brick hall on the night shift, teal pipes; bouncy toys and purple pills
  {
    name: 'Night Shift', tag: 0x22b5a4,
    wallTop: 0xe3e8f6, wallBottom: 0xbfc9e8, seam: 0xaab5dc, frame: 0x7f8cc0, floor: 0x4f5b8e,
    pattern: 'bricks', pipe: 0x1fb3a3, pipeRim: 0xaaeee4,
  },
  // levels 31-40: a harbour under open sky, golden pipes; bins float on the water, the fan
  {
    name: 'Harbour', tag: 0x2b9fe0,
    wallTop: 0xe4f4fc, wallBottom: 0xc6e6f5, seam: 0xb0d6ea, frame: 0x7fb2cf, floor: 0x2f8fc4,
    pattern: 'sky', pipe: 0xf5a524, pipeRim: 0xffe0a3,
    water: { top: 0x58c0ef, deep: 0x2a86c2, foam: 0xe9f8ff },
  },
];

/** y of the water surface in a water world (bins float with their lower part under it). */
export const WATER_Y = PLAY_H - 66;

/** The world a level belongs to. */
export const worldOf = (levelIndex: number): number => Math.min(THEMES.length - 1, Math.floor(levelIndex / WORLD_SIZE));
export const themeForLevel = (levelIndex: number): Theme => THEMES[worldOf(levelIndex)];

/**
 * A softly lit workshop: quiet wall pattern, recessed utility rails and a
 * clearly marked collection pit. Repainted only when the window changes shape.
 */
export function drawFactoryBackground(scene: Phaser.Scene, withPit = true, arena = false, theme: Theme = THEMES[0]): void {
  const g = scene.add.graphics().setDepth(DEPTH.bg);
  const draw = (): void => paint(g, withPit, arena, theme);
  draw();
  scene.scale.on(Phaser.Scale.Events.RESIZE, draw);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, draw));
}

function paint(g: G, withPit: boolean, arena: boolean, t: Theme): void {
  g.clear();
  // visible logical rectangle plus a margin for camera shake
  const x0 = GAME_W / 2 - view.w / 2 - 40;
  const x1 = GAME_W / 2 + view.w / 2 + 40;
  const y0 = view.cy - view.h / 2 - 40;
  const y1 = view.cy + view.h / 2 + 40;
  const w = x1 - x0;

  // gradient, drawn as bands so it also works with the canvas renderer
  const bands = 28;
  for (let i = 0; i < bands; i++) {
    const top = y0 + ((y1 - y0) * i) / bands;
    // anchor the gradient to the play field so every level looks the same in any window
    const k = Phaser.Math.Clamp((top + (y1 - y0) / bands / 2) / GAME_H, 0, 1);
    g.fillStyle(mix(t.wallTop, t.wallBottom, k), 1);
    g.fillRect(x0, top, w, (y1 - y0) / bands + 1);
  }

  drawPattern(g, t, x0, x1, y0, y1);

  // Recessed service rail and slim conduits live at the edges of the playfield.
  g.fillStyle(t.frame, 0.3);
  g.fillRect(x0, HUD_H + 8, w, 14);
  g.fillStyle(0xffffff, 0.5);
  g.fillRect(x0, HUD_H + 8, w, 3);
  for (const x of [28, GAME_W - 28]) {
    g.lineStyle(6, t.frame, 0.28);
    g.lineBetween(x, HUD_H + 22, x, PLAY_H - 44);
    g.lineStyle(2, 0xffffff, 0.4);
    g.lineBetween(x - 1, HUD_H + 22, x - 1, PLAY_H - 44);
    g.fillStyle(t.frame, 0.45);
    for (const y of [194, 434, 674, 914]) g.fillRoundedRect(x - 7, y, 14, 7, 2);
  }

  if (arena) {
    // Outside the play field (visible when the window is taller or wider than 16:9): dimmed,
    // with a ceiling beam and side posts exactly where the invisible walls are.
    g.fillStyle(t.floor, 0.18);
    g.fillRect(x0, y0, w, HUD_H - y0);
    if (x0 < 0) g.fillRect(x0, HUD_H, -x0, y1 - HUD_H);
    if (x1 > GAME_W) g.fillRect(GAME_W, HUD_H, x1 - GAME_W, y1 - HUD_H);
    g.fillStyle(t.frame, 1);
    g.fillRect(x0, HUD_H - 4, w, 4);
    g.fillRect(-8, HUD_H, 8, y1 - HUD_H);
    g.fillRect(GAME_W, HUD_H, 8, y1 - HUD_H);
  }

  if (withPit && t.water) {
    // water instead of a pit: deep blue with a lighter surface band
    const wx0 = arena ? 0 : x0;
    const wx1 = arena ? GAME_W : x1;
    const bands = 5;
    for (let i = 0; i < bands; i++) {
      const top = WATER_Y + 18 + i * 22;
      g.fillStyle(mix(t.water.top, t.water.deep, (i + 1) / bands), 1);
      g.fillRect(wx0, top, wx1 - wx0, (i === bands - 1 ? y1 : top + 22) - top + 1);
    }
    g.fillStyle(t.water.top, 1);
    g.fillRect(wx0, WATER_Y, wx1 - wx0, 20);
    // light glints on the water
    g.fillStyle(0xffffff, 0.28);
    for (let x = Math.floor(wx0 / 90) * 90; x < wx1; x += 90) {
      g.fillRoundedRect(x + 12, WATER_Y + 46, 34, 5, 2.5);
      g.fillRoundedRect(x + 56, WATER_Y + 74, 22, 4, 2);
    }
  } else if (withPit) {
    // open bottom: toys that fall here are lost
    const px0 = arena ? 0 : x0;
    const px1 = arena ? GAME_W : x1;
    g.fillStyle(t.floor, 1);
    g.fillRect(px0, PLAY_H - 24, px1 - px0, y1 - PLAY_H + 24);
    g.fillStyle(mix(t.floor, t.wallBottom, 0.5), 1);
    g.fillRect(px0, PLAY_H - 24, px1 - px0, 4);
    g.lineStyle(3, 0xd8e1b8, 0.65);
    for (let x = Math.ceil((px0 + 20) / 64) * 64 - 34; x < px1 - 10; x += 64) {
      g.beginPath();
      g.moveTo(x - 9, PLAY_H - 18);
      g.lineTo(x, PLAY_H - 10);
      g.lineTo(x + 9, PLAY_H - 18);
      g.strokePath();
    }
  }
}

/** The wall pattern. Kept faint and large so nothing on the wall looks like a toy or a machine. */
function drawPattern(g: G, t: Theme, x0: number, x1: number, y0: number, y1: number): void {
  const seam = (ax: number, ay: number, bx: number, by: number, a = 0.6): void => {
    g.lineStyle(1, t.seam, a);
    g.lineBetween(ax, ay, bx, by);
    g.lineStyle(1, 0xffffff, a * 0.75);
    g.lineBetween(ax + (ax === bx ? 2 : 0), ay + (ay === by ? 2 : 0), bx + (ax === bx ? 2 : 0), by + (ay === by ? 2 : 0));
  };
  switch (t.pattern) {
    case 'sheets': {
      // Large wall sheets with small paired rivets.
      for (let x = Math.floor(x0 / 256) * 256; x < x1; x += 256) {
        seam(x, y0, x, y1);
        for (let y = 166; y < PLAY_H - 50; y += 240) {
          g.fillStyle(t.frame, 0.45);
          g.fillCircle(x - 9, y, 2);
          g.fillCircle(x + 11, y, 2);
        }
      }
      for (const sy of [406, 790]) seam(x0, sy, x1, sy, 0.35);
      break;
    }
    case 'planks': {
      // Horizontal boards with staggered joints and a nail at each end.
      const h = 72;
      for (let y = Math.floor(y0 / h) * h, row = 0; y < y1; y += h, row++) {
        seam(x0, y, x1, y, 0.5);
        const off = (((Math.floor(y / h) % 3) + 3) % 3) * 150;
        for (let x = Math.floor((x0 - off) / 450) * 450 + off; x < x1; x += 450) {
          seam(x, y, x, y + h, 0.45);
          g.fillStyle(t.frame, 0.4);
          g.fillCircle(x - 10, y + h / 2, 2);
          g.fillCircle(x + 12, y + h / 2, 2);
        }
      }
      break;
    }
    case 'sky': {
      // open sky: a few large, faint clouds and a pier rail
      const clouds = [[120, 300, 1], [520, 210, 1.3], [330, 520, 0.9], [640, 640, 1.1], [60, 760, 0.8]];
      g.fillStyle(0xffffff, 0.55);
      for (const [cx, cy, s] of clouds) {
        for (const [dx, dy, r] of [[-38, 6, 26], [0, -8, 34], [40, 4, 28], [0, 12, 30]]) g.fillCircle(cx + dx * s, cy + dy * s, r * s);
      }
      g.lineStyle(6, t.frame, 0.35);
      g.lineBetween(x0, PLAY_H - 150, x1, PLAY_H - 150);
      for (let x = Math.floor(x0 / 180) * 180 + 90; x < x1; x += 180) g.lineBetween(x, PLAY_H - 150, x, PLAY_H - 70);
      break;
    }
    case 'bricks': {
      // Long bricks in a running bond.
      const h = 56;
      const w = 168;
      for (let y = Math.floor(y0 / h) * h; y < y1; y += h) {
        seam(x0, y, x1, y, 0.45);
        const off = Math.floor(y / h) % 2 === 0 ? 0 : w / 2;
        for (let x = Math.floor((x0 - off) / w) * w + off; x < x1; x += w) seam(x, y, x, y + h, 0.35);
      }
      break;
    }
  }
}

/**
 * Shared camera setup. Scenes are authored in a 720x1280 (portrait) logical space; the
 * camera zooms by the render resolution and keeps that space centred, and it
 * re-centres itself whenever the window (and so the canvas) changes shape.
 */
export function setupCamera(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  const apply = (): void => {
    cam.setViewport(0, 0, scene.scale.width, scene.scale.height);
    cam.setZoom(view.res);
    cam.centerOn(GAME_W / 2, view.cy);
  };
  cam.setBackgroundColor('rgba(0,0,0,0)');
  apply();
  scene.scale.on(Phaser.Scale.Events.RESIZE, apply);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, apply));
}

/** Logical y of the top / bottom edge of what is currently visible (may be under a camera cut-out). */
export const viewTop = (): number => view.cy - view.h / 2;
export const viewBottom = (): number => view.cy + view.h / 2;
/** Logical y of the top / bottom edge of the safe area: pin HUD elements to these. */
export const safeTop = (): number => viewTop() + view.safeTop;
export const safeBottom = (): number => viewBottom() - view.safeBottom;

/**
 * Portals can draw their own button over the game (Poki's "Pill" sits at the top left on
 * mobile). Each screen says which logical y it must stay below, e.g. the bottom of its top
 * bar, and the button is moved there. Re-applied whenever the window is resized.
 */
let overlayLine: () => number = () => safeTop() + HUD_H;
export function keepOverlayBelow(line: () => number): void {
  overlayLine = line;
  placeOverlay();
}
export function placeOverlay(): void {
  const cssPerUnit = window.innerWidth / view.w;
  platform.placeOverlayButton(Math.round((overlayLine() - viewTop()) * cssPerUnit + 10));
}
