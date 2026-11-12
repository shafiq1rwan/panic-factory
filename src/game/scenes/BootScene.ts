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
      document.getElementById('loading')?.remove(); // the page's own loading animation
      this.scene.launch('Transition'); // stays running on top for the whole session
      // A first visit goes straight into level 1: in the v1.9.2 fit test 10% of players never
      // left the title screen. Returning players (or ?menu, for tests) get the title screen.
      const firstVisit = save.data.unlocked <= 1 && save.totalStars === 0 && !new URLSearchParams(location.search).has('menu');
      if (firstVisit) this.scene.start('Game', { level: 0 });
      else this.scene.start('Menu');
    });
  }
}
