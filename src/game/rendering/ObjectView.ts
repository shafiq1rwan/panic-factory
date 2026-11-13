import Phaser from 'phaser';
import { TEX_SCALE } from '../config';
import type { FactoryObject } from '../entities/FactoryObject';
import { save } from '../systems/SaveManager';
import { DEPTH } from './MachineViews';
import { faceKey, outfitKey, toyKey, toyShadowKey } from './Textures';
import { FACE_EYES_Y, HEAD_ANCHOR, OUTFIT_TEX } from './OutfitArt';
import { outfitById } from '../systems/Outfits';
import { MATERIALS, type MaterialId } from '../physics/PhysicsMaterials';
import type { ObjType } from '../config';
import type { Expression } from './VectorFactory';

const S = 1 / TEX_SCALE;

/**
 * Jelly wobble (view only: the physics body stays rigid, so every level plays exactly as the
 * solver checked it). A landing kicks an under-damped spring, so a toy squashes and wobbles
 * back a few times; a fast fall stretches it a little.
 */
const JELLY_K = 0.0011; // stiffness: one wobble about every 0.19 s
const JELLY_DAMP = 0.008; // low damping: three or four visible wobbles
const JELLY_MAX = 0.3;
const FALL_STRETCH_MAX = 0.12;

/**
 * The cute visible half of a FactoryObject: body sprite, reactive face, soft
 * shadow, jelly squash-and-stretch. It follows the physics body every frame.
 * The outer container holds position and squash and never rotates, so a toy always squashes
 * upright like jelly; the inner one spins with the body.
 */
export class ObjectView {
  readonly container: Phaser.GameObjects.Container;
  private inner: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Image;
  private face: Phaser.GameObjects.Image;
  // jelly spring (positive = squashed: wider and shorter)
  private sq = 0;
  private sqVel = 0;
  private stretch = 0;
  private pop = 0.35;
  private expr: Expression = 'happy';
  private exprUntil = 0;
  private nextBlink: number;
  private spinMs = 0;
  private clock = 0;
  private faceY: number;

  constructor(
    scene: Phaser.Scene,
    readonly obj: FactoryObject,
    private worldHeight: number,
  ) {
    const body = scene.add.image(0, 0, toyKey(obj.type, obj.material)).setScale(S);
    // A triangle narrows above its short, flat base. Keep its entire face inside
    // that smaller area; the shared oversized face left the mouth below the toy.
    this.faceY = obj.type === 'yellow' ? -2 : 0;
    const faceScale = obj.type === 'yellow' ? 1.4 : obj.type === 'purple' ? 1.45 : 1.75;
    this.face = scene.add.image(0, this.faceY, faceKey('surprised')).setScale(S * faceScale);
    this.inner = scene.add.container(0, 0, [body, this.face]);
    const wear = outfitImage(scene, obj.type, obj.material, save.data.outfit, this.faceY, faceScale);
    if (wear) this.inner.add(wear);
    this.container = scene.add.container(obj.x, obj.y, [this.inner]).setDepth(DEPTH.toys);
    this.shadow = scene.add.image(obj.x + 4, obj.y + 6, toyShadowKey(obj.type, obj.material)).setScale(S).setAlpha(0.26).setDepth(DEPTH.toyShadow);
    this.nextBlink = 800 + Math.random() * 2500;
    this.expr = 'surprised';
    this.exprUntil = 350;
  }

  setExpression(expr: Expression, ms: number): void {
    this.exprUntil = this.clock + ms;
    this.apply(expr);
  }

  private apply(expr: Expression): void {
    if (expr === this.expr) return;
    this.expr = expr;
    this.face.setTexture(faceKey(expr));
  }

  /** Kick the jelly spring. `speed` is the impact speed in px / tick. */
  impact(speed: number): void {
    if (save.settings.reducedMotion) return;
    this.sqVel += Math.min(1, speed * 0.09) * 0.012;
    if (speed > 6) this.setExpression('surprised', 420);
  }

  update(dt: number): void {
    this.clock += dt;
    const b = this.obj.body;
    this.container.setPosition(b.position.x, b.position.y);
    this.inner.setRotation(b.angle);
    this.shadow.setPosition(b.position.x + 4, b.position.y + 6);
    this.shadow.setRotation(b.angle);

    // spawn pop-in + jelly spring (stepped in small slices so a slow frame cannot blow it up)
    if (this.pop < 1) this.pop = Math.min(1, this.pop + dt / 160);
    for (let left = dt; left > 0; left -= 8) {
      const h = Math.min(8, left);
      this.sqVel += (-JELLY_K * this.sq - JELLY_DAMP * this.sqVel) * h;
      this.sq += this.sqVel * h;
    }
    if (this.sq > JELLY_MAX) this.sq = JELLY_MAX;
    if (this.sq < -JELLY_MAX) this.sq = -JELLY_MAX;
    // a fast fall stretches the toy a little (eased, so it never snaps)
    const want = save.settings.reducedMotion ? 0 : Math.min(FALL_STRETCH_MAX, Math.max(0, (b.velocity.y - 2) * 0.012));
    this.stretch += (want - this.stretch) * Math.min(1, dt / 70);
    const pop = this.pop < 1 ? 1 + Math.sin(this.pop * Math.PI) * 0.18 - (1 - this.pop) * 0.4 : 1;
    const sx = (1 + this.sq) * (1 - this.stretch * 0.6);
    const sy = (1 - this.sq) * (1 + this.stretch);
    this.container.setScale(pop * sx, pop * sy);

    // expressions react to what the body is doing
    if (this.clock >= this.exprUntil) {
      const spin = Math.abs(b.angularVelocity);
      this.spinMs = spin > 0.2 ? this.spinMs + dt : Math.max(0, this.spinMs - dt * 2);
      if (this.spinMs > 380) {
        this.spinMs = 0;
        this.setExpression('dizzy', 1100);
      } else if (b.velocity.y > 6 && b.position.y > this.worldHeight - 110) {
        this.apply('worried');
      } else if (this.clock >= this.nextBlink) {
        this.apply('blink');
        if (this.clock >= this.nextBlink + 130) this.nextBlink = this.clock + 1500 + Math.random() * 3000;
      } else {
        this.apply('happy');
      }
    }
  }

  /** It hit the floor outside every bin: X eyes, a shake, then it pops. */
  popMissed(scene: Phaser.Scene, onPop: () => void): void {
    this.shadow.destroy();
    this.face.setTexture(faceKey('ouch'));
    const c = this.container;
    const calm = save.settings.reducedMotion;
    scene.tweens.add({
      targets: c,
      x: c.x + (calm ? 0 : 5),
      duration: 50,
      yoyo: true,
      repeat: calm ? 0 : 3,
      onComplete: () => {
        onPop();
        scene.tweens.add({ targets: c, scaleX: 1.4, scaleY: 1.4, alpha: 0, duration: 170, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
      },
    });
  }

  /** It fell in the water outside every bin: X eyes, then it sinks out of sight. */
  sinkMissed(scene: Phaser.Scene): void {
    this.shadow.destroy();
    this.face.setTexture(faceKey('ouch'));
    const c = this.container;
    c.setDepth(DEPTH.machineFront + 1); // under the wave strip
    scene.tweens.add({ targets: c, y: c.y + 70, angle: c.angle + 25, alpha: 0, duration: 650, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
  }

  /** Detach from physics and play a short exit animation. */
  finish(scene: Phaser.Scene, kind: 'correct' | 'wrong' | 'lost', tx: number, ty: number): void {
    this.shadow.destroy();
    this.face.setTexture(faceKey(kind === 'correct' ? 'joy' : 'worried'));
    const c = this.container;
    if (kind === 'lost') {
      scene.tweens.add({ targets: c, alpha: 0, duration: 160, onComplete: () => c.destroy() });
      return;
    }
    c.setDepth(DEPTH.machineBack + 1); // slip behind the bin's front panel
    scene.tweens.add({
      targets: c,
      x: tx,
      y: ty,
      scaleX: 0.55,
      scaleY: 0.55,
      angle: c.angle + (kind === 'correct' ? 40 : -40),
      duration: 240,
      ease: 'Quad.easeIn',
      onComplete: () => c.destroy(),
    });
  }

  destroy(): void {
    this.container.destroy();
    this.shadow.destroy();
  }
}

/** The outfit image for a toy (null for none), placed in the toy's own (rotating) space. */
export function outfitImage(scene: Phaser.Scene, type: ObjType, material: MaterialId, id: string, faceY: number, faceScale: number): Phaser.GameObjects.Image | null {
  const o = outfitById(id);
  if (!o) return null;
  const s = MATERIALS[material].scale;
  const img = scene.add.image(0, 0, outfitKey(o.id));
  if (o.slot === 'face') {
    const k = faceScale / 1.75;
    img.setScale(S * k).setPosition(0, faceY + FACE_EYES_Y * k);
  } else {
    const a = HEAD_ANCHOR[type];
    const k = a.scale * s;
    img.setScale(S * k).setPosition(0, a.y * s - OUTFIT_TEX.headBase * k);
  }
  return img;
}

/** A standalone toy wearing an outfit, for the wardrobe and the reward cards. */
export function dressedToy(scene: Phaser.Scene, type: ObjType, outfitId: string, scale = 1): Phaser.GameObjects.Container {
  const faceY = type === 'yellow' ? -2 : 0;
  const faceScale = type === 'yellow' ? 1.4 : type === 'purple' ? 1.45 : 1.75;
  const c = scene.add.container(0, 0, [
    scene.add.image(0, 0, toyKey(type, 'standard')).setScale(S),
    scene.add.image(0, faceY, faceKey('happy')).setScale(S * faceScale),
  ]);
  const wear = outfitImage(scene, type, 'standard', outfitId, faceY, faceScale);
  if (wear) c.add(wear);
  return c.setScale(scale);
}
