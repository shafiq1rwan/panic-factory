import Phaser from 'phaser';
import { GAME_H, GAME_W, HUD_H, PLAY_H, view, WORKSHOP } from '../config';
import { platform } from '../platform';
import { DEPTH } from './MachineViews';
import { mix } from './VectorFactory';

type G = Phaser.GameObjects.Graphics;

/** A room of the factory: wall colours and the pattern on the wall. Each chapter has its own. */
export interface Theme {
  wallTop: number;
  wallBottom: number;
  seam: number;
  frame: number;
  floor: number;
  pattern: 'sheets' | 'planks' | 'tiles' | 'bricks';
}

export const THEMES: Theme[] = [
  // Belts: the mint workshop
  { wallTop: WORKSHOP.wallTop, wallBottom: WORKSHOP.wallBottom, seam: WORKSHOP.seam, frame: WORKSHOP.frame, floor: WORKSHOP.floor, pattern: 'sheets' },
  // Bouncers: a warm wooden toy room
  { wallTop: 0xf8eee2, wallBottom: 0xecd6c1, seam: 0xdcc0a6, frame: 0xc09a7c, floor: 0x8c6c58, pattern: 'planks' },
  // Timers: a cool tiled machine hall
  { wallTop: 0xe8f0f8, wallBottom: 0xcbdaec, seam: 0xb4c7de, frame: 0x8ba3c2, floor: 0x5c7494, pattern: 'tiles' },
  // New shapes: a lavender night shift
  { wallTop: 0xefe9f7, wallBottom: 0xd5c9ea, seam: 0xc3b4dd, frame: 0x9c88c2, floor: 0x67578c, pattern: 'bricks' },
];

/** The room a level is played in: one theme per chapter of four levels. */
export const themeForLevel = (levelIndex: number): Theme => THEMES[Math.floor(levelIndex / 4) % THEMES.length];

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

  if (withPit) {
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
    case 'tiles': {
      // Big square tiles with a faint bevel.
      const s = 120;
      for (let x = Math.floor(x0 / s) * s; x < x1; x += s) seam(x, y0, x, y1, 0.4);
      for (let y = Math.floor(y0 / s) * s; y < y1; y += s) seam(x0, y, x1, y, 0.4);
      g.fillStyle(0xffffff, 0.16);
      for (let x = Math.floor(x0 / s) * s; x < x1; x += s) for (let y = Math.floor(y0 / s) * s; y < y1; y += s) g.fillRect(x + 8, y + 8, s - 16, 6);
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
