import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W, view } from '../config';
import { setupCamera } from '../rendering/Background';

/**
 * Always-on top scene that plays the wipe between screens: three coloured
 * curtains sweep in from the right, the scene underneath is swapped while the
 * screen is covered, then they sweep out to the left.
 */
export class TransitionScene extends Phaser.Scene {
  private curtain!: Phaser.GameObjects.Container;
  private blocker!: Phaser.GameObjects.Zone;
  private busy = false;

  constructor() {
    super('Transition');
  }

  create(): void {
    setupCamera(this);
    this.curtain = this.add.container(0, 0).setVisible(false);
    this.blocker = this.add.zone(GAME_W / 2, GAME_H / 2, 6000, 6000);
  }

  get running(): boolean {
    return this.busy;
  }

  /** Cover the screen, run `swap` while nothing is visible, then reveal. */
  cover(swap: () => void): void {
    if (this.busy) {
      swap();
      return;
    }
    this.busy = true;
    this.blocker.setInteractive(); // swallow taps while the curtain moves
    const w = view.w + 200;
    const h = view.h + 200;
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    this.curtain.removeAll(true);
    const colors = [COLORS.yellow, COLORS.pink, COLORS.outline];
    const bands = colors.map((c, i) => {
      const g = this.add.graphics();
      g.fillStyle(c, 1);
      // leading and trailing edges are rounded so the wipe feels soft
      g.fillRoundedRect(-w / 2 - 80, -h / 2, w + 160, h, 80);
      g.x = cx + w + 200 + i * 120;
      g.y = cy;
      return g;
    });
    this.curtain.add(bands);
    this.curtain.setVisible(true);

    this.tweens.add({
      targets: bands,
      x: cx,
      duration: 300,
      ease: 'Cubic.easeIn',
      delay: this.tweens.stagger(55, {}),
      onComplete: () => {
        swap();
        this.time.delayedCall(140, () => {
          this.tweens.add({
            targets: bands.slice().reverse(),
            x: cx - w - 200,
            duration: 320,
            ease: 'Cubic.easeOut',
            delay: this.tweens.stagger(55, {}),
            onComplete: () => {
              this.curtain.setVisible(false);
              this.blocker.disableInteractive();
              this.busy = false;
            },
          });
        });
      },
    });
  }
}
