import { audio } from '../systems/AudioManager';
import type { PlatformAdapter } from './PlatformAdapter';
import { PokiAdapter } from './PokiAdapter';
import { StandaloneAdapter } from './StandaloneAdapter';

const adapter: PlatformAdapter = import.meta.env.VITE_PLATFORM === 'poki' ? new PokiAdapter() : new StandaloneAdapter();

let playing = false;
let inBreak = false;
/** The game is in active play (a level or a Panic run), whether or not the portal has been told yet. */
let wanted = false;
/**
 * Poki wants gameplayStart only after the player has interacted with the game. A first visit
 * opens level 1 straight away (no PLAY tap), so until the first tap, click or key press a
 * gameplay start is held back and sent at that first input.
 */
let interacted = false;
if (typeof window !== 'undefined') {
  const onFirstInput = (): void => {
    if (interacted) return;
    interacted = true;
    for (const t of ['pointerdown', 'touchstart', 'keydown']) window.removeEventListener(t, onFirstInput, true);
    if (wanted && !playing) {
      playing = true;
      adapter.gameplayStart();
    }
  };
  // capture phase, passive: sees the input before the game does and never blocks it
  for (const t of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(t, onFirstInput, { capture: true, passive: true });
}

/** Game-facing platform facade: de-duplicates gameplay events and handles audio / input around breaks. */
export const platform = {
  get name(): string {
    return adapter.name;
  },
  /** For tests: whether the portal has been told gameplay is on, the game wants it, the player has interacted. */
  get debugState(): { playing: boolean; wanted: boolean; interacted: boolean } {
    return { playing, wanted, interacted };
  },
  /** True while an ad break is in progress: the game must ignore keyboard input. */
  get inBreak(): boolean {
    return inBreak;
  },
  init: (): Promise<void> => adapter.init(),
  placeOverlayButton: (topPx: number): void => adapter.placeOverlayButton(topPx),
  /** Analytics funnel event, e.g. ('level', '3', 'start'); see PlatformAdapter.measure. */
  measure: (category: string, what: string, action: string): void => adapter.measure(category, what, action),
  loadingFinished: (): void => adapter.loadingFinished(),
  gameplayStart(): void {
    wanted = true;
    if (playing || !interacted) return; // before the first input: sent at that input instead
    playing = true;
    adapter.gameplayStart();
  },
  gameplayStop(): void {
    wanted = false;
    if (!playing) return;
    playing = false;
    adapter.gameplayStop();
  },
  /**
   * Rewarded ad for an optional reward (a hint). Resolves true when the reward should be
   * given. Outside Poki there is no ad to show, so the reward is simply given.
   */
  async rewardedBreak(): Promise<boolean> {
    if (inBreak) return false;
    if (adapter.name === 'standalone') return true;
    this.gameplayStop();
    inBreak = true;
    audio.setAdMuted(true);
    try {
      return await adapter.rewardedBreak();
    } finally {
      inBreak = false;
      audio.setAdMuted(false);
    }
  },
  /**
   * Call at natural pauses only (between levels / before a retry after the
   * result screen), never while physics is running. Audio is muted for the
   * whole break and always restored afterwards, even if the SDK never calls back.
   */
  async commercialBreak(): Promise<void> {
    if (inBreak) return;
    this.gameplayStop();
    if (adapter.name === 'standalone') return; // nothing to show, so leave audio alone
    inBreak = true;
    audio.setAdMuted(true);
    try {
      await adapter.commercialBreak();
    } finally {
      inBreak = false;
      audio.setAdMuted(false);
    }
  },
};
