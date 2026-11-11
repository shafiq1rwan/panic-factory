import { capsulePoints, heart, star, type G } from './VectorFactory';

export type IconName =
  | 'play' | 'pause' | 'restart' | 'home' | 'gear' | 'rotL' | 'rotR' | 'flip' | 'clock'
  | 'lock' | 'star' | 'ff' | 'stop' | 'next' | 'close' | 'grid' | 'heart' | 'bolt' | 'back' | 'move' | 'arrowL' | 'arrowR' | 'wind';

function tri(g: G, x: number, y: number, r: number, rot: number): void {
  const p = [0, 1, 2].map((i) => {
    const a = rot + (i * Math.PI * 2) / 3;
    return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
  });
  g.fillTriangle(p[0].x, p[0].y, p[1].x, p[1].y, p[2].x, p[2].y);
}

function thick(g: G, x1: number, y1: number, x2: number, y2: number, w: number): void {
  g.fillPoints(capsulePoints(x1, y1, x2, y2, w / 2, Math.atan2(y2 - y1, x2 - x1)), true);
}

function arcArrow(g: G, r: number, w: number, start: number, end: number, ccw: boolean, color: number): void {
  g.lineStyle(w, color, 1);
  g.beginPath();
  g.arc(0, 0, r, start, end, ccw);
  g.strokePath();
  const ex = Math.cos(end) * r;
  const ey = Math.sin(end) * r;
  tri(g, ex, ey, w * 1.7, end + (ccw ? -Math.PI / 2 : Math.PI / 2));
}

/** Draw a simple single-colour icon centred on 0,0. `s` is roughly the icon's half size. */
export function drawIcon(g: G, name: IconName, s: number, color: number): void {
  g.fillStyle(color, 1);
  g.lineStyle(s * 0.28, color, 1);
  const w = s * 0.3;
  switch (name) {
    case 'play':
      tri(g, -s * 0.1, 0, s, 0);
      break;
    case 'pause':
      g.fillRoundedRect(-s * 0.75, -s * 0.8, s * 0.55, s * 1.6, s * 0.18);
      g.fillRoundedRect(s * 0.2, -s * 0.8, s * 0.55, s * 1.6, s * 0.18);
      break;
    case 'stop':
      g.fillRoundedRect(-s * 0.72, -s * 0.72, s * 1.44, s * 1.44, s * 0.25);
      break;
    case 'restart':
      arcArrow(g, s * 0.72, w, -0.35 * Math.PI, 1.25 * Math.PI, false, color);
      break;
    case 'rotR':
      arcArrow(g, s * 0.7, w, 1.1 * Math.PI, 0.05 * Math.PI, false, color);
      break;
    case 'rotL':
      arcArrow(g, s * 0.7, w, -0.1 * Math.PI, 0.95 * Math.PI, true, color);
      break;
    case 'flip':
      thick(g, -s * 0.8, -s * 0.35, s * 0.3, -s * 0.35, w);
      tri(g, s * 0.55, -s * 0.35, s * 0.5, 0);
      thick(g, s * 0.8, s * 0.35, -s * 0.3, s * 0.35, w);
      tri(g, -s * 0.55, s * 0.35, s * 0.5, Math.PI);
      break;
    case 'move':
      thick(g, -s * 0.5, 0, s * 0.5, 0, w);
      thick(g, 0, -s * 0.5, 0, s * 0.5, w);
      tri(g, s * 0.72, 0, s * 0.38, 0);
      tri(g, -s * 0.72, 0, s * 0.38, Math.PI);
      tri(g, 0, s * 0.72, s * 0.38, Math.PI / 2);
      tri(g, 0, -s * 0.72, s * 0.38, -Math.PI / 2);
      break;
    case 'wind':
      // three gusts of different lengths, the top one curling at its end
      g.lineStyle(w * 0.8, color, 1);
      g.lineBetween(-s * 0.95, -s * 0.45, s * 0.35, -s * 0.45);
      g.beginPath();
      g.arc(s * 0.35, -s * 0.72, s * 0.27, Math.PI / 2, -Math.PI * 0.6, true);
      g.strokePath();
      g.lineBetween(-s * 0.95, s * 0.05, s * 0.9, s * 0.05);
      g.lineBetween(-s * 0.6, s * 0.55, s * 0.5, s * 0.55);
      break;
    case 'clock':
      g.lineStyle(w * 0.9, color, 1);
      g.strokeCircle(0, 0, s * 0.8);
      thick(g, 0, 0, 0, -s * 0.48, w * 0.8);
      thick(g, 0, 0, s * 0.36, s * 0.12, w * 0.8);
      break;
    case 'home':
      g.fillTriangle(-s, -s * 0.05, 0, -s * 0.95, s, -s * 0.05);
      g.fillRoundedRect(-s * 0.68, -s * 0.15, s * 1.36, s * 1.0, s * 0.15);
      break;
    case 'grid':
      for (const gx of [-1, 1]) for (const gy of [-1, 1]) g.fillRoundedRect(gx * s * 0.45 - s * 0.36, gy * s * 0.45 - s * 0.36, s * 0.72, s * 0.72, s * 0.16);
      break;
    case 'gear': {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        thick(g, Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5, Math.cos(a) * s * 0.92, Math.sin(a) * s * 0.92, s * 0.34);
      }
      g.fillCircle(0, 0, s * 0.66);
      break;
    }
    case 'lock':
      g.lineStyle(w, color, 1);
      g.beginPath();
      g.arc(0, -s * 0.2, s * 0.42, Math.PI, 0, false);
      g.strokePath();
      g.fillRoundedRect(-s * 0.7, -s * 0.2, s * 1.4, s * 1.1, s * 0.22);
      break;
    case 'star':
      star(g, 0, 0, s, color, 0);
      break;
    case 'heart':
      heart(g, 0, s * 0.1, s * 2.1, color, 0);
      break;
    case 'ff':
      tri(g, -s * 0.5, 0, s * 0.68, 0);
      tri(g, s * 0.42, 0, s * 0.68, 0);
      break;
    case 'next':
      tri(g, -s * 0.25, 0, s * 0.85, 0);
      g.fillRoundedRect(s * 0.5, -s * 0.75, s * 0.32, s * 1.5, s * 0.12);
      break;
    case 'back':
      thick(g, -s * 0.2, 0, s * 0.8, 0, w);
      tri(g, -s * 0.45, 0, s * 0.62, Math.PI);
      break;
    case 'arrowL':
    case 'arrowR': {
      // chunky direction arrow for the belt buttons
      const d = name === 'arrowR' ? 1 : -1;
      thick(g, -d * s * 1.15, 0, d * s * 0.2, 0, s * 0.55);
      tri(g, d * s * 0.55, 0, s * 0.95, d === 1 ? 0 : Math.PI);
      break;
    }
    case 'close':
      thick(g, -s * 0.6, -s * 0.6, s * 0.6, s * 0.6, w);
      thick(g, -s * 0.6, s * 0.6, s * 0.6, -s * 0.6, w);
      break;
    case 'bolt':
      g.fillPoints(
        [
          { x: s * 0.15, y: -s }, { x: -s * 0.6, y: s * 0.12 }, { x: -s * 0.05, y: s * 0.12 },
          { x: -s * 0.2, y: s }, { x: s * 0.6, y: -s * 0.2 }, { x: s * 0.05, y: -s * 0.2 },
        ] as Phaser.Math.Vector2[],
        true,
      );
      break;
  }
}
