/**
 * Global constants. This file must stay free of Phaser imports because the
 * headless simulation (tests, level solver) imports it from Node.
 */
/** Portrait layout: the logical screen is 720 x 1280. */
export const GAME_W = 720;
export const GAME_H = 1280;
/** Height of the top bar. */
export const HUD_H = 96;
/** Height of the bottom control strip (the big RUN button lives here, in thumb reach). */
export const FOOTER_H = 104;
/** Bottom edge of the play field: toys falling past this are lost. */
export const PLAY_H = GAME_H - FOOTER_H;

/** Fixed physics timestep. All gameplay timing is expressed in sim ticks. */
export const STEP_MS = 1000 / 60;
export const msToTicks = (ms: number): number => Math.round(ms / STEP_MS);

export const MAX_OBJECT_SPEED = 24;
export const MAX_ACTIVE_OBJECTS = 40;

/**
 * Bold arcade palette: saturated flat colours on a deep violet backdrop, with
 * dark-indigo "ink" for text. (The key names are historical: "cream" is the
 * backdrop family.)
 */
export const COLORS = {
  cream: 0x5b3fd9,
  creamDark: 0x4a31bd,
  creamDeep: 0x35228f,
  bgTop: 0x3423a6,
  bgBottom: 0x8b4fe6,
  pink: 0xff4f9a,
  pinkDark: 0xd92e7a,
  blue: 0x2bb8ff,
  blueDark: 0x1290db,
  yellow: 0xffcf33,
  yellowDark: 0xf2a51e,
  mint: 0x3ee08a,
  mintDark: 0x1fb866,
  lavender: 0x9b7bff,
  lavenderDark: 0x7a56f0,
  lavenderLight: 0xd9ccff,
  outline: 0x1e1650,
  outlineSoft: 0x8f82d6,
  white: 0xffffff,
  belt: 0x2a1f6b,
  beltDark: 0x1e1650,
  panel: 0xffffff,
  red: 0xff4d5e,
  shadow: 0x0e0933,
} as const;

export const TEXT = {
  dark: '#1E1650',
  soft: '#8F82D6',
  white: '#FFFFFF',
  pink: '#FF4F9A',
  /** secondary text on the dark backdrop */
  light: '#D9CCFF',
};

/** Quiet workshop surfaces keep the colourful toys and machines in the foreground. */
export const WORKSHOP = {
  wallTop: 0xe7efec,
  wallBottom: 0xcbdcd8,
  seam: 0xb9ceca,
  frame: 0x8faeaa,
  floor: 0x668780,
  panel: 0xfffcf5,
  border: 0xd2dcd5,
  inset: 0xeaf0e9,
  accent: 0x39796b,
  text: '#293F3C',
  muted: '#5E7770',
} as const;

export const FONT =
  '"Arial Rounded MT Bold","Varela Round","Nunito","Fredoka","Baloo 2","Trebuchet MS","Segoe UI",system-ui,sans-serif';

export type ObjType = 'blue' | 'pink' | 'yellow' | 'green';
export const OBJ_TYPES: ObjType[] = ['blue', 'pink', 'yellow', 'green'];

export const TYPE_COLORS: Record<ObjType, { fill: number; dark: number; name: string }> = {
  blue: { fill: COLORS.blue, dark: COLORS.blueDark, name: 'Blue' },
  pink: { fill: COLORS.pink, dark: COLORS.pinkDark, name: 'Pink' },
  yellow: { fill: COLORS.yellow, dark: COLORS.yellowDark, name: 'Yellow' },
  green: { fill: COLORS.mint, dark: COLORS.mintDark, name: 'Green' },
};

/** Mutable view settings resolved at boot (render resolution multiplier). */
export const view = {
  /** render pixels per logical unit */
  res: 1,
  /** visible logical size: at least GAME_W x GAME_H, larger on one axis to fill the window */
  w: GAME_W,
  h: GAME_H,
};

/** Textures are rasterised at this scale and displayed at 1 / TEX_SCALE. */
export const TEX_SCALE = 2;
