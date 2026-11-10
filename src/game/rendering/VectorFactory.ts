import Phaser from 'phaser';
import { COLORS, type ObjType, TYPE_COLORS } from '../config';
import { OBJ_SHAPE } from '../entities/FactoryObject';
import { MATERIALS, type MaterialId } from '../physics/PhysicsMaterials';

export type G = Phaser.GameObjects.Graphics;
type V2 = Phaser.Math.Vector2;

export const OUTLINE_W = 3;
/** Flat art style: shapes drawn with the default ink outline get no outline at all. */
const inked = (lw: number, outline: number): boolean => lw > 0 && outline !== COLORS.outline;

// --- colour helpers -------------------------------------------------------------

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
export const lighten = (c: number, t: number): number => mix(c, 0xffffff, t);
export const darken = (c: number, t: number): number => mix(c, COLORS.outline, t);

// --- primitives -----------------------------------------------------------------

/** World-space drop shadow offset expressed in a rotated object's local space. */
export function shadowOffset(rad: number, dx = 4, dy = 6): { x: number; y: number } {
  const c = Math.cos(-rad);
  const s = Math.sin(-rad);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

export function roundRect(g: G, x: number, y: number, w: number, h: number, r: number, fill: number, lw = OUTLINE_W, outline: number = COLORS.outline, alpha = 1): void {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, w, h, r);
  if (inked(lw, outline)) {
    g.lineStyle(lw, outline, 1);
    g.strokeRoundedRect(x, y, w, h, r);
  }
}

export function circle(g: G, x: number, y: number, r: number, fill: number, lw = OUTLINE_W, outline: number = COLORS.outline): void {
  g.fillStyle(fill, 1);
  g.fillCircle(x, y, r);
  if (inked(lw, outline)) {
    g.lineStyle(lw, outline, 1);
    g.strokeCircle(x, y, r);
  }
}

/** Thick rounded line segment with an outline (used for funnel walls, levers...). */
export function capsule(g: G, x1: number, y1: number, x2: number, y2: number, thickness: number, fill: number, lw = OUTLINE_W, outline: number = COLORS.outline): void {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const pts = capsulePoints(x1, y1, x2, y2, thickness / 2, ang);
  g.fillStyle(fill, 1);
  g.fillPoints(pts, true);
  if (inked(lw, outline)) {
    g.lineStyle(lw, outline, 1);
    g.strokePoints(pts, true, true);
  }
}

export function capsulePoints(x1: number, y1: number, x2: number, y2: number, r: number, ang: number): V2[] {
  const pts: V2[] = [];
  const seg = 8;
  for (let i = 0; i <= seg; i++) {
    const a = ang + Math.PI / 2 + (Math.PI * i) / seg;
    pts.push(new Phaser.Math.Vector2(x1 + Math.cos(a) * r, y1 + Math.sin(a) * r));
  }
  for (let i = 0; i <= seg; i++) {
    const a = ang - Math.PI / 2 + (Math.PI * i) / seg;
    pts.push(new Phaser.Math.Vector2(x2 + Math.cos(a) * r, y2 + Math.sin(a) * r));
  }
  return pts;
}

/** Polygon with rounded corners, returned as a point list. */
export function roundedPoly(pts: { x: number; y: number }[], radius: number, seg = 6): V2[] {
  const out: V2[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i + n - 1) % n];
    const b = pts[(i + 1) % n];
    let ux = a.x - p.x, uy = a.y - p.y;
    let vx = b.x - p.x, vy = b.y - p.y;
    const ul = Math.hypot(ux, uy), vl = Math.hypot(vx, vy);
    ux /= ul; uy /= ul; vx /= vl; vy /= vl;
    const theta = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    const d = Math.min(radius / Math.tan(theta / 2), ul / 2, vl / 2);
    const r = d * Math.tan(theta / 2);
    let bx = ux + vx, by = uy + vy;
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl; by /= bl;
    const cl = r / Math.sin(theta / 2);
    const cx = p.x + bx * cl, cy = p.y + by * cl;
    const t1x = p.x + ux * d, t1y = p.y + uy * d;
    const t2x = p.x + vx * d, t2y = p.y + vy * d;
    const a1 = Math.atan2(t1y - cy, t1x - cx);
    let a2 = Math.atan2(t2y - cy, t2x - cx);
    let da = a2 - a1;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    a2 = a1 + da;
    for (let k = 0; k <= seg; k++) {
      const t = a1 + ((a2 - a1) * k) / seg;
      out.push(new Phaser.Math.Vector2(cx + Math.cos(t) * r, cy + Math.sin(t) * r));
    }
  }
  return out;
}

export function starPoints(x: number, y: number, outer: number, inner: number, points = 5, rot = -Math.PI / 2): V2[] {
  const raw: { x: number; y: number }[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (Math.PI * i) / points;
    raw.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  return roundedPoly(raw, outer * 0.14, 3);
}

export function star(g: G, x: number, y: number, outer: number, fill: number, lw = OUTLINE_W, outline: number = COLORS.outline): void {
  const pts = starPoints(x, y, outer, outer * 0.52);
  g.fillStyle(fill, 1);
  g.fillPoints(pts, true);
  if (inked(lw, outline)) {
    g.lineStyle(lw, outline, 1);
    g.strokePoints(pts, true, true);
  }
}

export function heart(g: G, x: number, y: number, size: number, fill: number, lw = 2.5, outline: number = COLORS.outline): void {
  const pts: V2[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = (Math.PI * 2 * i) / 28;
    const px = 16 * Math.pow(Math.sin(t), 3);
    const py = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push(new Phaser.Math.Vector2(x + (px * size) / 32, y + (py * size) / 32));
  }
  g.fillStyle(fill, 1);
  g.fillPoints(pts, true);
  if (inked(lw, outline)) {
    g.lineStyle(lw, outline, 1);
    g.strokePoints(pts, true, true);
  }
}

// --- toys -----------------------------------------------------------------------

/** Outline points of a toy in local space (null = circle). Matches the Matter colliders. */
export function toyOutline(type: ObjType, s: number): V2[] | null {
  switch (type) {
    case 'blue':
      return null;
    case 'pink': {
      const h = (OBJ_SHAPE.pink.size * s) / 2;
      return roundedPoly([{ x: -h, y: -h }, { x: h, y: -h }, { x: h, y: h }, { x: -h, y: h }], OBJ_SHAPE.pink.chamfer * s + 1);
    }
    case 'yellow': {
      const r = OBJ_SHAPE.yellow.radius * s;
      return roundedPoly(
        [{ x: 0, y: -r }, { x: r * 0.866, y: r * 0.5 }, { x: -r * 0.866, y: r * 0.5 }],
        OBJ_SHAPE.yellow.chamfer * s + 1,
      );
    }
    default: {
      const r = OBJ_SHAPE.green.radius * s;
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      return roundedPoly(pts, OBJ_SHAPE.green.chamfer * s + 1);
    }
  }
}

function fillToyShape(g: G, type: ObjType, s: number, grow = 0): void {
  const pts = toyOutline(type, s);
  if (!pts) g.fillCircle(0, 0, OBJ_SHAPE.blue.radius * s + grow);
  else g.fillPoints(pts, true);
}

function strokeToyShape(g: G, type: ObjType, s: number): void {
  const pts = toyOutline(type, s);
  if (!pts) g.strokeCircle(0, 0, OBJ_SHAPE.blue.radius * s);
  else g.strokePoints(pts, true, true);
}

/** Flat silhouette used for soft drop shadows. */
export function drawToyShadow(g: G, type: ObjType, material: MaterialId): void {
  g.fillStyle(COLORS.shadow, 1);
  fillToyShape(g, type, MATERIALS[material].scale, 1);
}

/** A toy body (without face): flat colour with a darker underside. Each material reads differently. */
export function drawToy(g: G, type: ObjType, material: MaterialId): void {
  const s = MATERIALS[material].scale;
  const col = TYPE_COLORS[type];
  let fill: number = col.fill;
  let under: number = col.dark;
  if (material === 'heavy') {
    fill = mix(col.dark, COLORS.outline, 0.3);
    under = mix(col.dark, COLORS.outline, 0.6);
  }
  if (material === 'slippery') {
    fill = lighten(col.fill, 0.5);
    under = lighten(col.dark, 0.25);
  }

  // underside first, then the face colour nudged up: reads as a chunky 3D lip
  g.fillStyle(under, 1);
  fillToyShape(g, type, s);
  g.save();
  g.translateCanvas(0, -4);
  g.scaleCanvas(0.97, 0.94);
  g.fillStyle(fill, 1);
  fillToyShape(g, type, s);
  g.restore();

  const size = (type === 'blue' ? OBJ_SHAPE.blue.radius : type === 'pink' ? OBJ_SHAPE.pink.size / 2 : type === 'yellow' ? OBJ_SHAPE.yellow.radius * 0.6 : OBJ_SHAPE.green.radius * 0.85) * s;
  const oy = type === 'yellow' ? 6 : 0;

  if (material === 'bouncy') {
    g.lineStyle(3, 0xffffff, 0.8);
    g.strokeCircle(0, oy - 2, size * 0.78);
  }
  if (material === 'heavy') {
    g.fillStyle(lighten(fill, 0.5), 1);
    const d = size * 0.66;
    for (const [rx, ry] of [[-d, -d * 0.35], [d, -d * 0.35], [-d * 0.6, d * 0.7], [d * 0.6, d * 0.7]] as const) g.fillCircle(rx, ry + oy - 2, 3);
  }
  // soft top highlight
  g.fillStyle(0xffffff, material === 'slippery' ? 0.8 : material === 'heavy' ? 0.18 : 0.35);
  g.fillEllipse(-size * 0.36, -size * 0.52 + oy * 1.3, size * 0.5, size * 0.24);
  if (material === 'slippery') g.fillCircle(size * 0.5, size * 0.34 + oy * 0.4, 3);
}

export type Expression = 'happy' | 'blink' | 'surprised' | 'dizzy' | 'worried' | 'joy';
export const EXPRESSIONS: Expression[] = ['happy', 'blink', 'surprised', 'dizzy', 'worried', 'joy'];

/** Big googly-eyed face, centred on 0,0 and about 26 x 20 px. */
export function drawFace(g: G, expr: Expression): void {
  const ink = 0x16103d;
  const ex = 6.6;
  const ey = -2.5;
  const eye = (x: number, r: number, px: number, py: number, pr: number): void => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x, ey, r);
    g.fillStyle(ink, 1);
    g.fillCircle(x + px, ey + py, pr);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x + px + pr * 0.35, ey + py - pr * 0.4, pr * 0.3);
  };
  g.lineStyle(2, ink, 1);
  switch (expr) {
    case 'happy':
      eye(-ex, 5.6, 1, 0.8, 2.9);
      eye(ex, 5.6, -1, 0.8, 2.9);
      g.beginPath();
      g.arc(0, 5.4, 3, 0.15 * Math.PI, 0.85 * Math.PI, false);
      g.strokePath();
      break;
    case 'blink':
      g.lineStyle(2.4, ink, 1);
      g.lineBetween(-ex - 4, ey, -ex + 4, ey);
      g.lineBetween(ex - 4, ey, ex + 4, ey);
      g.lineStyle(2, ink, 1);
      g.beginPath();
      g.arc(0, 5.4, 3, 0.15 * Math.PI, 0.85 * Math.PI, false);
      g.strokePath();
      break;
    case 'surprised':
      eye(-ex, 6.2, 0, 0, 2.2);
      eye(ex, 6.2, 0, 0, 2.2);
      g.fillStyle(ink, 1);
      g.fillEllipse(0, 8.6, 4.4, 5.2);
      break;
    case 'dizzy':
      for (const x of [-ex, ex]) {
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x, ey, 5.6);
        g.lineStyle(2, ink, 1);
        g.lineBetween(x - 2.8, ey - 2.8, x + 2.8, ey + 2.8);
        g.lineBetween(x - 2.8, ey + 2.8, x + 2.8, ey - 2.8);
      }
      g.beginPath();
      g.moveTo(-3.6, 8.4);
      g.lineTo(-1.2, 7);
      g.lineTo(1.2, 8.8);
      g.lineTo(3.6, 7.4);
      g.strokePath();
      break;
    case 'worried':
      eye(-ex, 5.6, 0.6, -1.8, 2.3);
      eye(ex, 5.6, -0.6, -1.8, 2.3);
      g.lineStyle(2.2, ink, 1);
      g.lineBetween(-ex - 5, ey - 6.6, -ex + 2.5, ey - 9);
      g.lineBetween(ex + 5, ey - 6.6, ex - 2.5, ey - 9);
      g.lineStyle(2, ink, 1);
      g.beginPath();
      g.arc(0, 10, 3, 1.2 * Math.PI, 1.8 * Math.PI, false);
      g.strokePath();
      break;
    case 'joy':
      g.lineStyle(2.6, ink, 1);
      for (const x of [-ex, ex]) {
        g.beginPath();
        g.arc(x, ey + 2, 4.2, 1.1 * Math.PI, 1.9 * Math.PI, false);
        g.strokePath();
      }
      g.fillStyle(ink, 1);
      g.beginPath();
      g.arc(0, 4.6, 4, 0, Math.PI, false);
      g.closePath();
      g.fillPath();
      break;
  }
}
