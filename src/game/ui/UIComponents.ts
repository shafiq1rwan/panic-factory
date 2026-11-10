import Phaser from 'phaser';
import { COLORS, FONT, TEXT, view } from '../config';
import { drawIcon, type IconName } from '../rendering/Icons';
import { darken, lighten, roundRect, star } from '../rendering/VectorFactory';
import { audio } from '../systems/AudioManager';
import { save } from '../systems/SaveManager';

export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  color: string = TEXT.dark,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, ...extra })
    .setOrigin(0.5)
    .setResolution(Math.min(3, view.res * 1.5));
}

export interface ButtonOpts {
  w: number;
  h: number;
  label?: string;
  icon?: IconName;
  color?: number;
  textColor?: string;
  iconColor?: number;
  fontSize?: number;
  radius?: number;
  /** Low-profile controls for the workshop HUD. */
  style?: 'panel';
  onClick: () => void;
}

/**
 * Chunky toy-like button: a coloured face sitting on a darker "lip" that it
 * presses into, with a bouncy release. Works identically for mouse and touch.
 */
export class Button extends Phaser.GameObjects.Container {
  private lip: Phaser.GameObjects.Graphics;
  private face: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private iconG: Phaser.GameObjects.Graphics | null = null;
  private labelT: Phaser.GameObjects.Text | null = null;
  private pressed = false;
  private enabled = true;
  private color: number;
  private opts: ButtonOpts;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOpts) {
    super(scene, x, y);
    this.opts = opts;
    this.color = opts.color ?? COLORS.white;
    this.lip = scene.add.graphics();
    this.bg = scene.add.graphics();
    this.face = scene.add.container(0, 0, [this.bg]);
    this.add([this.lip, this.face]);
    this.drawBg();
    this.setContent(opts.label, opts.icon);

    // Keep HUD touch targets generous even though their faces are compact.
    this.setSize(Math.max(opts.w + 8, opts.style === 'panel' ? 68 : 0), Math.max(opts.h + 12, opts.style === 'panel' ? 68 : 0));
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      audio.unlock();
      this.pressed = true;
      this.face.y = 4;
    });
    this.on('pointerout', () => this.release(false));
    this.on('pointerup', () => this.release(true));
    scene.add.existing(this);
  }

  private release(click: boolean): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.scene.tweens.add({ targets: this.face, y: 0, duration: 220, ease: 'Back.easeOut' });
    if (click && this.enabled) {
      audio.click();
      if (!save.settings.reducedMotion) {
        this.setScale(1.07, 0.94);
        this.scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 300, ease: 'Elastic.easeOut' });
      }
      this.opts.onClick();
    }
  }

  private drawBg(): void {
    const { w, h } = this.opts;
    const r = this.opts.radius ?? Math.min(h / 2, 20);
    const c = this.enabled ? this.color : 0x8f8ab0;
    this.lip.clear();
    this.bg.clear();
    if (this.opts.style === 'panel') {
      this.lip.fillStyle(0x294d43, 0.16);
      this.lip.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, r);
      this.bg.fillStyle(c, 1);
      this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      this.bg.lineStyle(1, 0x375f51, 0.2);
      this.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
      return;
    }
    roundRect(this.lip, -w / 2, -h / 2 + 5, w, h, r, darken(c, 0.38), 3);
    roundRect(this.bg, -w / 2, -h / 2, w, h, r, c, 3);
    this.bg.fillStyle(0xffffff, 0.35);
    this.bg.fillRoundedRect(-w / 2 + 7, -h / 2 + 5, w - 14, Math.min(8, h * 0.18), Math.min(4, h * 0.09));
  }

  setContent(label?: string, icon?: IconName): this {
    const o = this.opts;
    o.label = label;
    o.icon = icon;
    this.iconG?.destroy();
    this.labelT?.destroy();
    this.iconG = null;
    this.labelT = null;
    const iconSize = Math.min(o.h * 0.26, 15);
    const textColor = o.textColor ?? TEXT.dark;
    const iconColor = o.iconColor ?? Phaser.Display.Color.HexStringToColor(textColor).color;
    let textX = 0;
    if (icon) {
      this.iconG = this.scene.add.graphics();
      drawIcon(this.iconG, icon, iconSize, iconColor);
      this.face.add(this.iconG);
    }
    if (label) {
      this.labelT = txt(this.scene, 0, 0, label, o.fontSize ?? Math.round(o.h * 0.4), textColor);
      this.face.add(this.labelT);
      if (this.iconG) {
        const total = iconSize * 2 + 10 + this.labelT.width;
        this.iconG.x = -total / 2 + iconSize;
        textX = -total / 2 + iconSize * 2 + 10 + this.labelT.width / 2;
      }
      this.labelT.x = textX;
    }
    return this;
  }

  /** Add custom content (stars, numbers...) that should press down together with the button face. */
  addToFace(...objs: Phaser.GameObjects.GameObject[]): this {
    this.face.add(objs);
    return this;
  }

  setColor(color: number): this {
    this.color = color;
    this.drawBg();
    return this;
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.drawBg();
    this.face.setAlpha(on ? 1 : 0.7);
    return this;
  }
}

/** Rounded white card used for dialogs. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill: number = COLORS.white): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setPosition(x, y);
  g.fillStyle(COLORS.shadow, 0.18);
  g.fillRoundedRect(-w / 2 + 6, -h / 2 + 10, w, h, 30);
  roundRect(g, -w / 2, -h / 2, w, h, 30, fill, 4);
  return g;
}

/** Full-screen dimmer that also swallows clicks behind a dialog. */
export function dimmer(scene: Phaser.Scene, alpha = 0.4): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(640, 360, 3000, 2000, COLORS.outline, alpha).setInteractive();
  r.setAlpha(0);
  scene.tweens.add({ targets: r, alpha: 1, duration: 180 });
  return r;
}

export function drawStar(scene: Phaser.Scene, x: number, y: number, size: number, filled: boolean): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setPosition(x, y);
  star(g, 0, 0, size, filled ? COLORS.yellow : 0xd9d4ee, 0);
  if (filled) {
    g.fillStyle(0xffffff, 0.6);
    g.fillEllipse(-size * 0.22, -size * 0.3, size * 0.3, size * 0.16);
  }
  return g;
}

export class Slider extends Phaser.GameObjects.Container {
  private knob: Phaser.GameObjects.Graphics;
  private fill: Phaser.GameObjects.Graphics;
  private dragging = false;
  private trackW: number;
  value: number;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, value: number, private onChange: (v: number) => void, private color: number = COLORS.blue) {
    super(scene, x, y);
    this.trackW = w;
    this.value = value;
    const track = scene.add.graphics();
    roundRect(track, -w / 2, -8, w, 16, 8, 0xe4defa, 0);
    this.fill = scene.add.graphics();
    this.knob = scene.add.graphics();
    roundRect(this.knob, -16, -16, 32, 32, 16, COLORS.outline, 0);
    this.knob.fillStyle(0xffffff, 1);
    this.knob.fillCircle(0, 0, 7);
    this.add([track, this.fill, this.knob]);
    this.setSize(w + 44, 48);
    this.setInteractive({ useHandCursor: true });
    const move = (p: Phaser.Input.Pointer) => {
      const wp = p.positionToCamera(scene.cameras.main) as Phaser.Math.Vector2;
      const m = this.getWorldTransformMatrix();
      this.set(Phaser.Math.Clamp((wp.x - m.tx + w / 2) / w, 0, 1), true);
    };
    this.on('pointerdown', (p: Phaser.Input.Pointer) => {
      audio.unlock();
      this.dragging = true;
      move(p);
    });
    const onMove = (p: Phaser.Input.Pointer) => this.dragging && move(p);
    const onUp = () => {
      if (this.dragging) {
        this.dragging = false;
        audio.click();
      }
    };
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    this.once('destroy', () => {
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
    });
    scene.add.existing(this);
    this.set(value, false);
  }

  set(v: number, notify: boolean): void {
    this.value = v;
    const w = this.trackW;
    this.knob.x = -w / 2 + v * w;
    this.fill.clear();
    if (v > 0.02) {
      this.fill.fillStyle(this.color, 1);
      this.fill.fillRoundedRect(-w / 2 + 2, -6, Math.max(12, v * w - 2), 12, 6);
    }
    if (notify) this.onChange(v);
  }
}

export class Toggle extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  value: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, value: boolean, private onChange: (v: boolean) => void) {
    super(scene, x, y);
    this.value = value;
    this.g = scene.add.graphics();
    this.add(this.g);
    this.setSize(84, 48);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      audio.unlock();
      this.value = !this.value;
      audio.click();
      this.draw();
      this.onChange(this.value);
    });
    scene.add.existing(this);
    this.draw();
  }

  private draw(): void {
    const g = this.g;
    g.clear();
    roundRect(g, -34, -17, 68, 34, 17, this.value ? COLORS.mint : 0xcfc8ee, 0);
    roundRect(g, this.value ? 3 : -31, -14, 28, 28, 14, COLORS.outline, 0);
  }
}

/** Soft fade between scenes (skipped when reduced motion is on). */
export function gotoScene(scene: Phaser.Scene, key: string, data?: object): void {
  const go = () => {
    // Stop everything else that is running (HUD, overlays, the level underneath), then switch.
    for (const other of scene.scene.manager.getScenes(false)) {
      const k = other.scene.key;
      if (k === scene.scene.key) continue;
      if (scene.scene.isActive(k) || scene.scene.isPaused(k)) scene.scene.stop(k);
    }
    scene.scene.start(key, data);
  };
  if (save.settings.reducedMotion) {
    go();
    return;
  }
  const cam = scene.cameras.main;
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
  cam.fadeOut(150, 52, 35, 166);
}

export function fadeIn(scene: Phaser.Scene): void {
  if (!save.settings.reducedMotion) scene.cameras.main.fadeIn(180, 52, 35, 166);
}

export { lighten };
