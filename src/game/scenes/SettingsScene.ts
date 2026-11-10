import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W, TEXT } from '../config';
import { setupCamera } from '../rendering/Background';
import { audio } from '../systems/AudioManager';
import { save } from '../systems/SaveManager';
import { Button, dimmer, panel, Slider, Toggle, txt } from '../ui/UIComponents';

/** Settings overlay (volumes + comfort options). Changes apply and save immediately. */
export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create(): void {
    setupCamera(this);
    dimmer(this);
    const s = save.settings;
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const box = this.add.container(cx, cy);
    box.add(panel(this, 0, 0, 560, 520));
    box.add(txt(this, 0, -210, 'Settings', 40));

    const apply = () => {
      audio.setVolumes(s.master, s.music, s.sfx);
      save.save();
    };
    const row = (y: number, label: string): void => {
      box.add(txt(this, -230, y, label, 22).setOrigin(0, 0.5));
    };

    row(-140, 'Volume');
    box.add(new Slider(this, 110, -140, 230, s.master, (v) => { s.master = v; apply(); }, COLORS.lavender));
    row(-82, 'Music');
    box.add(new Slider(this, 110, -82, 230, s.music, (v) => { s.music = v; apply(); }, COLORS.blue));
    row(-24, 'Sounds');
    box.add(new Slider(this, 110, -24, 230, s.sfx, (v) => { s.sfx = v; apply(); audio.ding(2); }, COLORS.pink));

    row(44, 'Less screen shake');
    box.add(new Toggle(this, 190, 44, s.reducedShake, (v) => { s.reducedShake = v; apply(); }));
    row(104, 'Less motion');
    box.add(new Toggle(this, 190, 104, s.reducedMotion, (v) => { s.reducedMotion = v; apply(); }));
    box.add(txt(this, -230, 132, 'Fewer particles, no bouncy transitions', 14, TEXT.soft).setOrigin(0, 0.5));

    box.add(new Button(this, 0, 200, { w: 220, h: 58, label: 'Done', color: COLORS.mint, onClick: () => this.scene.stop() }));
    // portrait: dialogs are enlarged to stay comfortable on a phone
    box.setScale(0.9);
    this.tweens.add({ targets: box, scale: 1.18, duration: 220, ease: 'Back.easeOut' });

    this.input.keyboard?.on('keydown-ESC', () => this.scene.stop());
  }
}
