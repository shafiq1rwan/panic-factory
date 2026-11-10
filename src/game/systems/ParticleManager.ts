import Phaser from 'phaser';
import { COLORS, TEX_SCALE } from '../config';
import { save } from './SaveManager';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
const S = 1 / TEX_SCALE;

/**
 * A handful of pooled particle emitters shared by all effects in a scene.
 * Each emitter has a hard cap on live particles, so chain reactions can never
 * flood the screen (or the frame budget).
 */
export class ParticleManager {
  private dots: Emitter;
  private stars: Emitter;
  private confetti: Emitter;
  private puffs: Emitter;
  private rings: Emitter;

  constructor(scene: Phaser.Scene, depth = 60) {
    const mk = (tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig): Emitter =>
      scene.add.particles(0, 0, tex, { emitting: false, ...cfg }).setDepth(depth);

    this.dots = mk('p_dot', {
      lifespan: { min: 300, max: 600 },
      speed: { min: 60, max: 260 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7 * S * 2, end: 0 },
      gravityY: 500,
      maxAliveParticles: 140,
    });
    this.stars = mk('p_star', {
      lifespan: { min: 450, max: 800 },
      speed: { min: 70, max: 230 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.9 * S * 2, end: 0 },
      rotate: { min: 0, max: 360 },
      gravityY: 420,
      maxAliveParticles: 80,
    });
    this.confetti = mk('p_rect', {
      lifespan: { min: 1200, max: 2200 },
      speedX: { min: -260, max: 260 },
      speedY: { min: -620, max: -180 },
      scale: { start: 1.1 * S * 2, end: 0.6 * S * 2 },
      rotate: { start: 0, end: 720 },
      gravityY: 620,
      tint: [COLORS.pink, COLORS.blue, COLORS.yellow, COLORS.mint, COLORS.lavender],
      maxAliveParticles: 220,
    });
    this.puffs = mk('p_puff', {
      lifespan: { min: 260, max: 420 },
      speed: { min: 20, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5 * S * 2, end: 1.3 * S * 2 },
      alpha: { start: 0.8, end: 0 },
      tint: 0xd9cdb8,
      maxAliveParticles: 60,
    });
    this.rings = mk('p_ring', {
      lifespan: 320,
      speed: 0,
      scale: { start: 0.5 * S * 2, end: 2.2 * S * 2 },
      alpha: { start: 0.9, end: 0 },
      maxAliveParticles: 20,
    });
  }

  private get scale(): number {
    return save.settings.reducedMotion ? 0.4 : 1;
  }

  /** Colourful burst (deliveries, bumper hits). */
  burst(x: number, y: number, color: number, count = 10): void {
    this.dots.setParticleTint(color);
    this.dots.explode(Math.max(2, Math.round(count * this.scale)), x, y);
  }

  sparkle(x: number, y: number, color: number = COLORS.yellow, count = 5): void {
    this.stars.setParticleTint(color);
    this.stars.explode(Math.max(1, Math.round(count * this.scale)), x, y);
  }

  puff(x: number, y: number, count = 3): void {
    this.puffs.explode(Math.max(1, Math.round(count * this.scale)), x, y);
  }

  ring(x: number, y: number, color: number): void {
    this.rings.setParticleTint(color);
    this.rings.explode(1, x, y);
  }

  celebrate(x: number, y: number, count = 60): void {
    this.confetti.explode(Math.round(count * this.scale), x, y);
  }

  destroy(): void {
    for (const e of [this.dots, this.stars, this.confetti, this.puffs, this.rings]) e.destroy();
  }
}
