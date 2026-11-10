/**
 * Procedural audio: every sound is synthesised with the Web Audio API, so the
 * game ships without a single audio file. The context is created lazily on the
 * first user gesture to respect browser autoplay rules.
 */
type Wave = OscillatorType;

interface ToneOpts {
  freq: number;
  /** glide target frequency */
  to?: number;
  dur: number;
  type?: Wave;
  vol?: number;
  attack?: number;
  delay?: number;
  bus?: 'sfx' | 'music';
}

const NOTE = (semitonesFromA4: number): number => 440 * Math.pow(2, semitonesFromA4 / 12);
// C major pentatonic around C5
const PENTA = [-9, -7, -5, -2, 0, 3, 5, 7, 10, 12].map(NOTE);

class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private vol = { master: 0.8, music: 0.5, sfx: 0.9 };
  private last: Record<string, number> = {};
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicNext = 0;
  private wantMusic = false;
  private adMuted = false;
  private noiseBuf: AudioBuffer | null = null;

  /** Call from a pointer / key handler. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.applyVolumes();
      if (this.wantMusic) this.startMusic();
    }
    if (this.ctx.state === 'suspended' && !this.adMuted) void this.ctx.resume();
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.vol = { master, music, sfx };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.adMuted ? 0 : this.vol.master, t, 0.02);
    this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.02);
    this.music.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.02);
  }

  /** Silence everything while the platform shows an ad / the tab is hidden. */
  setAdMuted(muted: boolean): void {
    this.adMuted = muted;
    if (!this.ctx) return;
    this.applyVolumes();
    if (muted) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  private limited(name: string, minGapMs: number): boolean {
    const now = performance.now();
    if (now - (this.last[name] ?? -1e9) < minGapMs) return true;
    this.last[name] = now;
    return false;
  }

  private tone(o: ToneOpts): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
    const vol = o.vol ?? 0.2;
    const attack = o.attack ?? 0.005;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(gain);
    gain.connect(o.bus === 'music' ? this.music : this.sfx);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.03);
  }

  private noise(dur: number, vol: number, freq: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfx);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  private vary(f: number, amount = 0.06): number {
    return f * (1 + (Math.random() * 2 - 1) * amount);
  }

  // --- sound effects ---------------------------------------------------------

  click(): void {
    if (this.limited('click', 40)) return;
    this.tone({ freq: this.vary(720, 0.03), to: 980, dur: 0.07, type: 'triangle', vol: 0.18 });
  }

  /** Soft toy-on-something knock. `speed` is the impact speed in px / tick. */
  pop(speed: number): void {
    if (this.limited('pop', 55)) return;
    const v = Math.min(0.2, 0.04 + speed * 0.012);
    this.tone({ freq: this.vary(190 + speed * 14, 0.12), to: 110, dur: 0.09, type: 'sine', vol: v });
    this.noise(0.03, v * 0.4, 1800);
  }

  boing(power = 1): void {
    if (this.limited('boing', 60)) return;
    const f = this.vary(260 * power, 0.08);
    this.tone({ freq: f, to: f * 2.3, dur: 0.22, type: 'sine', vol: 0.24 });
    this.tone({ freq: f * 1.5, to: f * 3, dur: 0.16, type: 'triangle', vol: 0.08, delay: 0.02 });
  }

  /** Factory powering up. */
  whirr(): void {
    this.tone({ freq: 90, to: 260, dur: 0.45, type: 'sawtooth', vol: 0.07 });
    this.tone({ freq: 180, to: 520, dur: 0.45, type: 'triangle', vol: 0.08 });
    this.noise(0.3, 0.03, 900);
  }

  powerDown(): void {
    this.tone({ freq: 300, to: 90, dur: 0.3, type: 'triangle', vol: 0.1 });
  }

  spawn(): void {
    if (this.limited('spawn', 60)) return;
    this.tone({ freq: this.vary(380), to: 620, dur: 0.1, type: 'sine', vol: 0.14 });
  }

  thunk(): void {
    if (this.limited('thunk', 80)) return;
    this.tone({ freq: this.vary(130), to: 60, dur: 0.16, type: 'triangle', vol: 0.22 });
    this.noise(0.08, 0.08, 500);
  }

  flip(): void {
    this.tone({ freq: 520, to: 340, dur: 0.08, type: 'square', vol: 0.06 });
    this.tone({ freq: 340, to: 620, dur: 0.1, type: 'triangle', vol: 0.14, delay: 0.07 });
  }

  /** Correct delivery. Pitch climbs with the current streak. */
  ding(streak = 0): void {
    const base = PENTA[Math.min(PENTA.length - 3, 2 + (streak % 6))];
    this.tone({ freq: base, dur: 0.32, type: 'sine', vol: 0.22 });
    this.tone({ freq: base * 1.5, dur: 0.38, type: 'sine', vol: 0.14, delay: 0.07 });
    this.tone({ freq: base * 3, dur: 0.2, type: 'triangle', vol: 0.04, delay: 0.07 });
  }

  /** Wrong bin: a soft, friendly "bonk". */
  buzz(): void {
    this.tone({ freq: 220, to: 150, dur: 0.22, type: 'triangle', vol: 0.2 });
    this.tone({ freq: 233, to: 160, dur: 0.22, type: 'sine', vol: 0.12 });
  }

  /** A toy fell out of the factory. */
  drop(): void {
    if (this.limited('drop', 90)) return;
    this.tone({ freq: 420, to: 140, dur: 0.3, type: 'sine', vol: 0.12 });
  }

  win(): void {
    [0, 2, 4, 7].forEach((i, n) => {
      this.tone({ freq: PENTA[i + 2], dur: 0.28, type: 'triangle', vol: 0.2, delay: n * 0.1 });
      this.tone({ freq: PENTA[i + 2] * 2, dur: 0.2, type: 'sine', vol: 0.07, delay: n * 0.1 });
    });
    this.tone({ freq: PENTA[9], dur: 0.6, type: 'sine', vol: 0.2, delay: 0.42 });
  }

  starPop(i: number): void {
    this.tone({ freq: PENTA[4 + i * 2], dur: 0.3, type: 'sine', vol: 0.22 });
    this.tone({ freq: PENTA[4 + i * 2] * 2, dur: 0.2, type: 'triangle', vol: 0.08 });
  }

  fail(): void {
    this.tone({ freq: 392, to: 370, dur: 0.22, type: 'triangle', vol: 0.18 });
    this.tone({ freq: 294, to: 262, dur: 0.4, type: 'triangle', vol: 0.18, delay: 0.2 });
  }

  /** Panic mode malfunction warning. */
  warn(): void {
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: 880, dur: 0.1, type: 'square', vol: 0.07, delay: i * 0.22 });
      this.tone({ freq: 660, dur: 0.1, type: 'square', vol: 0.07, delay: i * 0.22 + 0.11 });
    }
  }

  combo(level: number): void {
    this.tone({ freq: PENTA[Math.min(9, 3 + level)], to: PENTA[Math.min(9, 5 + level)], dur: 0.18, type: 'triangle', vol: 0.16 });
  }

  // --- music -----------------------------------------------------------------

  /** A gentle generative toy-piano loop. */
  startMusic(): void {
    this.wantMusic = true;
    if (!this.ctx || this.musicTimer !== null) return;
    this.musicNext = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 120);
  }

  stopMusic(): void {
    this.wantMusic = false;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const stepDur = 0.27;
    if (this.musicNext < ctx.currentTime) this.musicNext = ctx.currentTime + 0.05;
    const melody = [4, -1, 6, 5, 4, -1, 2, 3, 4, -1, 6, 7, 8, 6, 5, -1, 3, -1, 5, 4, 3, -1, 1, 2, 3, 5, 4, 2, 1, -1, 0, -1];
    const bass = [0, 0, 3, 3, 1, 1, 2, 2];
    while (this.musicNext < ctx.currentTime + 0.4) {
      const s = this.musicStep;
      const delay = this.musicNext - ctx.currentTime;
      const m = melody[s % melody.length];
      if (m >= 0) this.tone({ freq: PENTA[m], dur: 0.32, type: 'triangle', vol: 0.09, delay, bus: 'music' });
      if (s % 4 === 0) {
        const b = PENTA[bass[(s / 4) % bass.length]] / 2;
        this.tone({ freq: b, dur: 0.7, type: 'sine', vol: 0.12, delay, bus: 'music' });
      }
      if (s % 2 === 1) this.tone({ freq: PENTA[(m >= 0 ? m : 2) % 5] * 2, dur: 0.08, type: 'sine', vol: 0.025, delay, bus: 'music' });
      this.musicStep++;
      this.musicNext += stepDur;
    }
  }
}

export const audio = new AudioManager();
