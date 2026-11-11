import type { PlatformAdapter } from './PlatformAdapter';

/**
 * Poki SDK integration.
 *
 * API surface taken from the official HTML5 guide
 * (https://developers.poki.com/guide/sdk-html5, checked 2026-11):
 *   PokiSDK.init(): Promise
 *   PokiSDK.gameLoadingFinished()
 *   PokiSDK.gameplayStart() / PokiSDK.gameplayStop()
 *   PokiSDK.commercialBreak(onStart?): Promise
 *   PokiSDK.rewardedBreak(onStart?): Promise<boolean>
 *   PokiSDK.movePill(topPercent, topPx)   mobile only; default (0, 24); pill is 46 x 62 px
 *   PokiSDK.measure(category, what, action)   https://developers.poki.com/guide/game-events
 *
 * This adapter has NOT been verified inside Poki's inspector / QA tooling.
 * Build with `VITE_PLATFORM=poki` to enable it, then test at
 * https://inspector.poki.dev before submitting.
 */
const SDK_URL = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js';

interface PokiSDKGlobal {
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(onStart?: () => void): Promise<void>;
  rewardedBreak(onStart?: () => void): Promise<boolean>;
  movePill?(topPercent: number, topPx: number): void;
  measure?(category: string, what: string, action: string): void;
}

export class PokiAdapter implements PlatformAdapter {
  readonly name = 'poki';
  private sdk: PokiSDKGlobal | null = null;
  private pillTop: number | null = null;

  private loadScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Poki SDK failed to load'));
      document.head.appendChild(s);
    });
  }

  async init(): Promise<void> {
    try {
      await this.loadScript();
      const sdk = (window as unknown as { PokiSDK?: PokiSDKGlobal }).PokiSDK;
      if (!sdk) return;
      await sdk.init();
      this.sdk = sdk;
      this.applyPill();
    } catch {
      // Ad blockers etc: per Poki's guide, load the game anyway.
      this.sdk = null;
    }
  }

  /**
   * On mobile Poki draws its "Poki Pill" over the top-left of the game, which would
   * cover the pause button. Move it to just under the top bar instead.
   */
  placeOverlayButton(topPx: number): void {
    this.pillTop = topPx;
    this.applyPill();
  }
  private applyPill(): void {
    if (this.pillTop === null || typeof this.sdk?.movePill !== 'function') return;
    try {
      this.sdk.movePill(0, this.pillTop);
    } catch {
      /* cosmetic only */
    }
  }

  measure(category: string, what: string, action: string): void {
    if (typeof this.sdk?.measure !== 'function') return;
    try {
      this.sdk.measure(category, what, action);
    } catch {
      /* analytics only */
    }
  }

  loadingFinished(): void {
    this.sdk?.gameLoadingFinished();
  }
  gameplayStart(): void {
    this.sdk?.gameplayStart();
  }
  gameplayStop(): void {
    this.sdk?.gameplayStop();
  }
  async commercialBreak(onStart?: () => void): Promise<void> {
    if (!this.sdk) return;
    try {
      await this.sdk.commercialBreak(onStart);
    } catch {
      /* continue the game regardless */
    }
  }
  async rewardedBreak(onStart?: () => void): Promise<boolean> {
    if (!this.sdk) return false;
    try {
      return await this.sdk.rewardedBreak(onStart);
    } catch {
      return false;
    }
  }
}
