import type { PlatformAdapter } from './PlatformAdapter';

/** No-op adapter for local development and plain static hosting. */
export class StandaloneAdapter implements PlatformAdapter {
  readonly name = 'standalone';
  private log(msg: string): void {
    if (import.meta.env.DEV) console.debug(`[platform] ${msg}`);
  }
  async init(): Promise<void> {
    this.log('init');
  }
  loadingFinished(): void {
    this.log('loadingFinished');
  }
  gameplayStart(): void {
    this.log('gameplayStart');
  }
  gameplayStop(): void {
    this.log('gameplayStop');
  }
  async commercialBreak(): Promise<void> {
    this.log('commercialBreak (skipped)');
  }
  placeOverlayButton(): void {}
  async rewardedBreak(): Promise<boolean> {
    this.log('rewardedBreak (unavailable)');
    return false;
  }
}
