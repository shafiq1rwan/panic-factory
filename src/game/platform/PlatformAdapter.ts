/**
 * Abstraction over the hosting platform (Poki, standalone web, ...).
 * Game code only ever talks to this interface, never to a platform SDK.
 */
export interface PlatformAdapter {
  readonly name: string;
  /** Load / initialise the platform SDK. Must resolve even if the SDK is blocked. */
  init(): Promise<void>;
  /** The game has finished loading and is ready to play. */
  loadingFinished(): void;
  /** The player is now actively playing (run started / resumed). */
  gameplayStart(): void;
  /** Active play stopped (menus, pause, level end). */
  gameplayStop(): void;
  /**
   * Natural break between levels. May show an ad. `onStart` is invoked if an
   * ad actually begins (use it to mute audio). Resolves when the game may continue.
   */
  commercialBreak(onStart?: () => void): Promise<void>;
  /** Opt-in rewarded ad. Resolves true if the reward should be granted. Not used by the MVP. */
  rewardedBreak(onStart?: () => void): Promise<boolean>;
  /**
   * Keep the platform's own overlay button clear of the game's top bar: place it
   * `topPx` CSS px from the top of the game area. No-op where there is none.
   */
  placeOverlayButton(topPx: number): void;
  /**
   * Analytics event for the portal's dashboard, e.g. ('level', '3', 'start'). For one attempt
   * send either 'complete' or 'fail', never both. No '/' or '^' in any argument.
   */
  measure(category: string, what: string, action: string): void;
}
