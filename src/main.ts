import Phaser from 'phaser';
import './styles/main.css';
import { GAME_H, GAME_W, view, WORKSHOP } from './game/config';
import { LEVELS } from './game/levels/levels';
import { provideMatter } from './game/physics/MatterLib';
import { platform } from './game/platform';
import { placeOverlay } from './game/rendering/Background';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import { LevelSelectScene } from './game/scenes/LevelSelectScene';
import { MenuScene } from './game/scenes/MenuScene';
import { PanicScene } from './game/scenes/PanicScene';
import { PauseScene } from './game/scenes/PauseScene';
import { ResultScene } from './game/scenes/ResultScene';
import { SettingsScene } from './game/scenes/SettingsScene';
import { TransitionScene } from './game/scenes/TransitionScene';
import { UIScene } from './game/scenes/UIScene';
import { audio } from './game/systems/AudioManager';
import { save } from './game/systems/SaveManager';

// The simulation uses the Matter.js build bundled with Phaser, driven with our own fixed timestep.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
provideMatter((Phaser.Physics.Matter as any).Matter);

// Render resolution: draw the 720x1280 logical scene at up to 2x so vectors stay crisp on
// high-DPI screens, without paying for more pixels than the display can show.
//
// Visible area: the 720x1280 portrait play field always fits, and the view is extended on one axis so the
// canvas fills the whole window (no letterbox bars) whatever its shape.
//
// Safe area: phones can draw the page under a camera cut-out or the home indicator. The 720x1280
// screen is fitted inside the safe rectangle, and the HUD is pinned to the safe edges, so nothing
// important ever sits under the camera.
/** Assumed camera cut-out height (CSS px) when the browser cannot tell us. */
const FALLBACK_TOP = 44;

function safeInsets(): { top: number; bottom: number } {
  // ?safe=top,bottom (CSS px) lets the layout be checked on a desktop
  const forced = new URLSearchParams(location.search).get('safe');
  if (forced) {
    const [t, b] = forced.split(',').map((n) => parseFloat(n) || 0);
    return { top: t, bottom: b ?? 0 };
  }
  let probe = document.getElementById('safe-probe');
  if (!probe) {
    probe = document.createElement('div');
    probe.id = 'safe-probe';
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  let top = parseFloat(cs.paddingTop) || 0;
  const bottom = parseFloat(cs.paddingBottom) || 0;
  // Browsers report no inset when the page covers the whole screen without asking for it
  // (fullscreen, installed app), and an iframe ALWAYS reads 0, even when the portal hosting it
  // (Poki) runs fullscreen under the camera. On an upright touch screen in either case, assume
  // a typical cut-out height rather than risk the top bar sitting under the camera.
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const upright = window.innerHeight > window.innerWidth;
  const coversScreen = window.innerHeight >= window.screen.height - 2;
  let framed = false;
  try {
    framed = window.self !== window.top;
  } catch {
    framed = true; // cross-origin parent
  }
  if (touch && upright && (coversScreen || framed) && top < 1) top = FALLBACK_TOP;
  return { top, bottom };
}

/**
 * Limits on the canvas. In a very wide, short window (a desktop browser with its inspector docked
 * at the bottom) the visible area would otherwise grow to many thousands of pixels, beyond the GPU's
 * texture limit, and WebGL fails with "Framebuffer status: Incomplete Attachment". Past these sizes
 * the canvas stops growing and the page shows plain margins instead.
 */
const MAX_VIEW = 2560; // logical units on either axis
const MAX_CANVAS_PX = 4096; // render pixels on either side, safe on phones and integrated GPUs

function computeView(): void {
  const ww = Math.max(window.innerWidth, 1);
  const wh = Math.max(window.innerHeight, 1);
  const inset = safeInsets();
  const safeH = Math.max(wh - inset.top - inset.bottom, 1);
  // CSS px per logical unit: the whole 720x1280 screen must fit inside the safe rectangle
  const fit = Math.min(ww / GAME_W, safeH / GAME_H);
  view.w = Math.round(Math.min(ww / fit, MAX_VIEW));
  view.h = Math.round(Math.min(wh / fit, MAX_VIEW));
  view.safeTop = inset.top / fit;
  view.safeBottom = inset.bottom / fit;
  view.cy = GAME_H / 2 + (view.safeBottom - view.safeTop) / 2;
  const sharp = Phaser.Math.Clamp(Math.round(fit * (window.devicePixelRatio || 1) * 4) / 4, 1, 2);
  view.res = Math.min(sharp, Math.floor((MAX_CANVAS_PX / Math.max(view.w, view.h)) * 4) / 4);
  // the portal's own overlay button (Poki Pill) stays below the current screen's top controls
  placeOverlay();
}
computeView();

const K = Phaser.Input.Keyboard.KeyCodes;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: WORKSHOP.wallTop,
  banner: false,
  disableContextMenu: true,
  audio: { noAudio: true }, // all audio is synthesised by AudioManager
  render: { antialias: true, powerPreference: 'high-performance' },
  // Phaser calls preventDefault on these keys itself (after reading them), which stops the page
  // from scrolling. Do NOT preventDefault them in a separate window listener: Phaser ignores
  // key events that were already default-prevented.
  input: {
    activePointers: 3,
    keyboard: { capture: [K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT, K.TAB] },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    // #game is a centring flexbox; Phaser's own centring would add a second offset
    autoCenter: Phaser.Scale.NO_CENTER,
    width: Math.round(view.w * view.res),
    height: Math.round(view.h * view.res),
  },
  // Order matters: later scenes render (and receive input) on top.
  scene: [BootScene, MenuScene, LevelSelectScene, GameScene, PanicScene, UIScene, ResultScene, PauseScene, SettingsScene, TransitionScene],
});

// Re-fit when the window changes shape. Scenes re-centre their cameras on the scale RESIZE event.
let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    computeView();
    game.scale.setGameSize(Math.round(view.w * view.res), Math.round(view.h * view.res));
    game.scale.refresh();
  }, 80);
});

// --- page-level behaviour ---------------------------------------------------------

// Keep the page from scrolling / zooming under the game (also required by web portals).
// Scroll keys are handled by Phaser's keyboard capture list in the game config above.
window.addEventListener('wheel', (ev) => ev.preventDefault(), { passive: false });
window.addEventListener('touchmove', (ev) => ev.preventDefault(), { passive: false });
window.addEventListener('gesturestart', (ev) => ev.preventDefault());
window.addEventListener('contextmenu', (ev) => ev.preventDefault());

// Audio may only start after a user gesture.
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// Silence + freeze when the tab is hidden or a phone is held sideways.
// The game is portrait: a phone held sideways gets a "turn upright" prompt instead of a tiny field.
const portraitQuery = window.matchMedia('(orientation: landscape) and (max-height: 520px) and (pointer: coarse) and (hover: none)');
let frozen = false;
function refreshFreeze(): void {
  const shouldFreeze = document.hidden || portraitQuery.matches;
  if (shouldFreeze === frozen) return;
  frozen = shouldFreeze;
  if (frozen) {
    game.loop.sleep();
    if (!platform.inBreak) audio.setAdMuted(true);
  } else {
    game.loop.wake();
    if (!platform.inBreak) audio.setAdMuted(false);
  }
}
document.addEventListener('visibilitychange', refreshFreeze);
portraitQuery.addEventListener('change', refreshFreeze);
refreshFreeze();

// Hook for automated browser tests (dev builds, or any build opened with ?tfptest).
if (import.meta.env.DEV || new URLSearchParams(location.search).has('tfptest')) {
  (window as unknown as { __TFP: unknown }).__TFP = { game, save, audio, view, levelCount: LEVELS.length };
}
