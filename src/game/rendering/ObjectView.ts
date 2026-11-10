import Phaser from 'phaser';
import { TEX_SCALE } from '../config';
import type { FactoryObject } from '../entities/FactoryObject';
import { save } from '../systems/SaveManager';
import { DEPTH } from './MachineViews';
import { faceKey, toyKey, toyShadowKey } from './Textures';
import type { Expression } from './VectorFactory';

const S = 1 / TEX_SCALE;

/**
 * The cute visible half of a FactoryObject: body sprite, reactive face, soft
 * shadow, squash-and-stretch. It follows the physics body every frame.
 */
export class ObjectView {
  readonly container: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Image;
  private face: Phaser.GameObjects.Image;
  // squash spring
  private sq = 0;
  private sqVel = 0;
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
    const faceScale = obj.type === 'yellow' ? 1.4 : 1.75;
    this.face = scene.add.image(0, this.faceY, faceKey('surprised')).setScale(S * faceScale);
    this.container = scene.add.container(obj.x, obj.y, [body, this.face]).setDepth(DEPTH.toys);
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

  /** Kick the squash spring. `speed` is the impact speed in px / tick. */
  impact(speed: number): void {
    if (save.settings.reducedMotion) return;
    this.sqVel += Math.min(0.9, speed * 0.075) * 0.006;
    if (speed > 6) this.setExpression('surprised', 420);
  }

  update(dt: number): void {
    this.clock += dt;
    const b = this.obj.body;
    this.container.setPosition(b.position.x, b.position.y);
    this.container.setRotation(b.angle);
    this.shadow.setPosition(b.position.x + 4, b.position.y + 6);
    this.shadow.setRotation(b.angle);

    // spawn pop-in + damped squash spring
    if (this.pop < 1) this.pop = Math.min(1, this.pop + dt / 160);
    const k = 0.00042;
    const c = 0.014;
    this.sqVel += (-k * this.sq - c * this.sqVel) * dt;
    this.sq += this.sqVel * dt;
    if (this.sq > 0.35) this.sq = 0.35;
    if (this.sq < -0.35) this.sq = -0.35;
    const pop = this.pop < 1 ? 1 + Math.sin(this.pop * Math.PI) * 0.18 - (1 - this.pop) * 0.4 : 1;
    this.container.setScale(pop * (1 + this.sq), pop * (1 - this.sq));

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
