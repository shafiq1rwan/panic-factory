import Phaser from 'phaser';
import { platform } from '../platform';
import { generateTextures } from '../rendering/Textures';
import { audio } from '../systems/AudioManager';
import { save } from '../systems/SaveManager';

/** Bakes all procedural textures, applies saved settings and initialises the platform layer. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateTextures(this);
    const s = save.settings;
    audio.setVolumes(s.master, s.music, s.sfx);
    audio.startMusic(); // actually begins after the first user gesture

    // Never let a slow / blocked platform SDK keep the player from the game.
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2500));
    void Promise.race([platform.init(), timeout]).then(() => {
      platform.loadingFinished();
      this.scene.start('Menu');
    });
  }
}
