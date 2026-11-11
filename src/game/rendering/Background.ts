import Phaser from 'phaser';
import { GAME_H, GAME_W, HUD_H, PLAY_H, view, WORKSHOP } from '../config';
import { platform } from '../platform';
import { DEPTH } from './MachineViews';
import { mix } from './VectorFactory';

type G = Phaser.GameObjects.Graphics;

/**
 * A softly lit workshop: quiet wall panels, recessed utility rails and a
 * clearly marked collection pit. Repainted only when the window changes shape.
 */
export function drawFactoryBackground(scene: Phaser.Scene, withPit = true, arena = false): void {
  const g = scene.add.graphics().setDepth(DEPTH.bg);
  const draw = (): void => paint(g, withPit, arena);
  draw();
  scene.scale.on(Phaser.Scale.Events.RESIZE, draw);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, draw));
}

function paint(g: G, withPit: boolean, arena: boolean): void {
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
    const t = Phaser.Math.Clamp((top + (y1 - y0) / bands / 2) / GAME_H, 0, 1);
    g.fillStyle(mix(WORKSHOP.wallTop, WORKSHOP.wallBottom, t), 1);
    g.fillRect(x0, top, w, (y1 - y0) / bands + 1);
  }

  // Large wall sheets. Small paired rivets suggest a factory without adding
  // decorative shapes that could be mistaken for toys or interactive machines.
  for (let x = Math.floor(x0 / 256) * 256; x < x1; x += 256) {
    g.lineStyle(1, WORKSHOP.seam, 0.6);
    g.lineBetween(x, y0, x, y1);
    g.lineStyle(1, 0xffffff, 0.45);
    g.lineBetween(x + 2, y0, x + 2, y1);
    for (let y = 166; y < PLAY_H - 50; y += 240) {
      g.fillStyle(WORKSHOP.frame, 0.45);
      g.fillCircle(x - 9, y, 2);
      g.fillCircle(x + 11, y, 2);
    }
  }
  for (const sy of [406, 790]) {
    g.lineStyle(1, WORKSHOP.seam, 0.35);
    g.lineBetween(x0, sy, x1, sy);
    g.lineStyle(1, 0xffffff, 0.3);
    g.lineBetween(x0, sy + 2, x1, sy + 2);
  }

  // Recessed service rail and slim conduits live at the edges of the playfield.
  g.fillStyle(WORKSHOP.frame, 0.3);
  g.fillRect(x0, HUD_H + 8, w, 14);
  g.fillStyle(0xffffff, 0.5);
  g.fillRect(x0, HUD_H + 8, w, 3);
  for (const x of [28, GAME_W - 28]) {
    g.lineStyle(6, WORKSHOP.frame, 0.28);
    g.lineBetween(x, HUD_H + 22, x, PLAY_H - 44);
    g.lineStyle(2, 0xffffff, 0.4);
    g.lineBetween(x - 1, HUD_H + 22, x - 1, PLAY_H - 44);
    g.fillStyle(WORKSHOP.frame, 0.45);
    for (const y of [194, 434, 674, 914]) g.fillRoundedRect(x - 7, y, 14, 7, 2);
  }

  if (arena) {
    // Outside the play field (visible when the window is taller or wider than 16:9): dimmed,
    // with a ceiling beam and side posts exactly where the invisible walls are.
    g.fillStyle(WORKSHOP.floor, 0.18);
    g.fillRect(x0, y0, w, HUD_H - y0);
    if (x0 < 0) g.fillRect(x0, HUD_H, -x0, y1 - HUD_H);
    if (x1 > GAME_W) g.fillRect(GAME_W, HUD_H, x1 - GAME_W, y1 - HUD_H);
    g.fillStyle(WORKSHOP.frame, 1);
    g.fillRect(x0, HUD_H - 4, w, 4);
    g.fillRect(-8, HUD_H, 8, y1 - HUD_H);
    g.fillRect(GAME_W, HUD_H, 8, y1 - HUD_H);
  }

  if (withPit) {
    // open bottom: toys that fall here are lost
    const px0 = arena ? 0 : x0;
    const px1 = arena ? GAME_W : x1;
    g.fillStyle(WORKSHOP.floor, 1);
    g.fillRect(px0, PLAY_H - 24, px1 - px0, y1 - PLAY_H + 24);
    g.fillStyle(0xa7beb0, 1);
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
