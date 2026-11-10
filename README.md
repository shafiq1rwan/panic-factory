# Tiny Factory Panic

A one-tap physics sorting game for the browser. Toys drop into a little factory and ride the belts; **tap a belt to flip it** so every toy lands in the bin of its own colour.

- **20 levels** in 5 chapters, three-star ratings. There is one thing to learn (tap a belt) and nothing to drag, rotate or time.
- **Panic Factory**: an endless mode with malfunctions, unlocked after 5 levels.
- Portrait layout, built for phones and playable on desktop.
- Built with TypeScript, Phaser 3, Matter.js (the build bundled with Phaser) and Vite.
- No image, font or audio files: all graphics are drawn by code and all sound is synthesised with the Web Audio API.
- No backend. Progress is stored in LocalStorage.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5273
```

Requires Node 20 or newer.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload. Add `?debug` to the URL for FPS, body count, game state and physics outlines. |
| `npm run build` | Type-check, then build static files into `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm test` | Headless physics, rules, save and level tests (Vitest, runs in Node). |
| `npm run solve` | Verify every level with a bot: doing nothing must fail, following the level's routes must win with no slips, and the same bot with a human-like reaction delay must still win. |
| `npm run smoke` | End-to-end test of the production build in headless Edge or Chrome (mouse, keyboard and touch). Run `npm run build` first. Screenshots go to `test-artifacts/`. |

## Layout

The game is portrait. The logical screen is 720 x 1280: a top bar, the play field, and a strip at the bottom showing lives. On a phone it fills the screen held upright; on a desktop it shows as a centred column with the workshop wall on both sides. A phone held sideways gets a prompt to turn it upright; there is no landscape mode on mobile.

## How to play

1. PLAY drops you straight into your next level. The factory starts by itself; there is no RUN button.
2. Toys fall from the chute onto a belt. **Tap a belt to flip its direction**, before or while toys are riding it.
3. Get every toy into the bin of its own colour. A toy in the wrong bin costs a life; three lives per level (two on the first levels).
4. When the last toy is sorted the game moves on to the next level by itself. If you run out of lives it shows why and restarts the level.

Stars: 3 for no slips, 2 for one, 1 for two.

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Flip a belt | Tap it | `Space` flips the first belt; `1` `2` `3` flip belts top to bottom, left to right |
| Restart level | Restart button | `R` |
| Pause | Pause button | `Esc` or `P` |

**Panic Factory**: toys never stop. Tap a belt to flip it (or `W`/`A`/`D`, or the arrow keys). Blue goes left, pink to the middle, yellow right. Three wrong deliveries end the run. Malfunctions (belt reverse, toy rush, turbo belts, low gravity, belt jam) are announced about two seconds before they start.

The engine still contains springs, pistons, funnels, drag / rotate / timer editing and a RUN-button puzzle flow from the earlier design. No current level uses them.

## Project layout

```
src/
  main.ts                 Phaser bootstrap, page-level input guards, render resolution
  game/
    config.ts             Constants and palette (no Phaser imports)
    sim/                  FactoryWorld (Matter engine + fixed-step loop), headless simulateLevel()
    physics/              Matter access layer, collision categories, material presets
    entities/             FactoryObject (toy), ObjectSpawner
    machines/             BaseMachine, ConveyorBelt, SpringBumper, Piston, Funnel, DeliveryBin
    systems/              PuzzleRules, ScoreManager, PanicDirector, LevelManager, SaveManager,
                          AudioManager, ParticleManager
    levels/               LevelTypes, the 20 levels, the Panic arena
    rendering/            Vector drawing, texture baking, machine/toy views, WorldView (all the juice)
    scenes/               Boot, Menu, LevelSelect, Game, Panic, UI (HUD), Result, Pause, Settings
    ui/                   Buttons, sliders, toggles, panels
    platform/             PlatformAdapter interface, StandaloneAdapter, PokiAdapter
  tests/                  Vitest suites
scripts/
  solve.ts, robust.ts, labkit.ts   Level verification and design tools
  smoke.mjs, shot.mjs              Browser test and screenshot helper
```

Two design decisions shape everything else:

- **Simulation and rendering are separate.** `sim/`, `machines/`, `entities/` and the rule systems never import Phaser. They use Phaser's bundled Matter.js through a small injection point (`physics/MatterLib.ts`), so the exact game physics runs headlessly in Node. That is what makes the level tests and the solver possible.
- **Fixed timestep.** The world advances in 1/60 s ticks, and all gameplay timing (spawners, pistons, rules) is counted in ticks. Runs are reproducible, and fast-forward is simply more ticks per frame.

## Adding or changing a level

Levels are data in `src/game/levels/levels.ts`, built from six small layouts (springs, ramps, cross-over springs, pinball bumpers, twin belts, a three-belt junction) plus a toy sequence and a drop interval. The springs, ramps and bumpers are fixed scenery: they add bouncing and sliding without adding anything to learn.

1. Add a `sortLevel({...})` entry: pick a layout, give it a sequence (`mixed(seed, count, colours)`) and an interval.
2. Each layout carries a `routes` table saying which way every belt must run for each colour. The tutorial hand and the test bot both use it.
3. Run `npm run solve`. A level is accepted when doing nothing fails, the bot clears it with no slips, and the bot still wins when it only reacts every 200 ms and 300 ms.
4. `npm test` re-checks all levels.

Keep the bins spanning the whole floor: the tests also check that a toy can never fall out of play.

## Deployment

`npm run build` produces a fully static site in `dist/` (`index.html` plus hashed JS and CSS). The build uses relative paths, so it can be hosted from any folder: upload `dist/` to any static host, or zip its contents for a web game portal.

### Poki

The game talks to the hosting platform only through `platform/PlatformAdapter.ts`. The default `StandaloneAdapter` does nothing. To build with the Poki SDK:

```bash
# PowerShell
$env:VITE_PLATFORM = 'poki'; npm run build
# bash
VITE_PLATFORM=poki npm run build
```

`PokiAdapter` loads `https://game-cdn.poki.com/scripts/v2/poki-sdk.js` at runtime and maps to the calls in Poki's HTML5 guide (`init`, `gameLoadingFinished`, `gameplayStart`, `gameplayStop`, `commercialBreak`, `rewardedBreak`).

- `gameplayStart` / `gameplayStop` fire when a level or Panic run becomes active or stops (pause, result screen, leaving).
- `commercialBreak` is requested only from the result screen when the player moves on (next level, level select, play again), never during physics. Audio is muted and keyboard input ignored for the duration.
- Rewarded breaks are implemented in the adapter but not used by the game.

**This integration has not been run inside Poki's inspector or QA flow, and the game has not been reviewed by Poki.** Before submitting, test the `poki` build at https://inspector.poki.dev and check Poki's current requirements.

## Testing status

Run on Windows 11 with Node 26 and headless Microsoft Edge:

- `npm test`: 143 tests pass. They cover the physics and machines, win/lose rules, save/load including corrupted data, scoring, and for each of the 20 levels: structure, that doing nothing fails, that a bot following the routes clears it with no slips and no toy ever leaves play, that the bot still wins with 200 ms and 300 ms reaction delays, and determinism. Panic mode is checked with a greedy bot over three simulated minutes.
- `npm run smoke`: 39 checks pass against the production build: PLAY straight into level 1, the level starting by itself, one tap flipping the belt, auto-advance after a win, auto-restart after a failure, pause and settings, level 3 won with the keyboard, level 9 won with mouse clicks on three belts, level 10 won with touch taps at phone size, save persistence, a corrupted save, Panic mode, six window shapes and the turn-upright prompt, with no console errors.

Not tested, so treat as unverified:

- Real phones and tablets, Safari and Firefox. Touch was exercised only through Chromium's touch emulation.
- Whether level solutions hold on non-Chromium engines. The physics is deterministic within one engine and the solutions have margin (they pass with jittered spawns), but tiny floating-point differences between browsers have not been measured.
- Frame rate on low-end mobile hardware.
- Audio was not listened to by a person; the headless runs only confirm it produces no errors.
- The Poki build (see above).

See `PROGRESS.md` for the development checklist.
