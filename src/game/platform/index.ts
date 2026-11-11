import { audio } from '../systems/AudioManager';
import type { PlatformAdapter } from './PlatformAdapter';
import { PokiAdapter } from './PokiAdapter';
import { StandaloneAdapter } from './StandaloneAdapter';

const adapter: PlatformAdapter = import.meta.env.VITE_PLATFORM === 'poki' ? new PokiAdapter() : new StandaloneAdapter();

let playing = false;
let inBreak = false;

/** Game-facing platform facade: de-duplicates gameplay events and handles audio / input around breaks. */
export const platform = {
  get name(): string {
    return adapter.name;
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
    if (playing) return;
    playing = true;
    adapter.gameplayStart();
  },
  gameplayStop(): void {
    if (!playing) return;
    playing = false;
    adapter.gameplayStop();
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
