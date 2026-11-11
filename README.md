# Tiny Factory Panic

A one-button physics sorting game for the browser. Toys drop into a little factory and ride the belts; **press a belt's button to flip it** so every toy lands in the bin of its own colour.

- **20 levels** in 5 chapters, three-star ratings. There is one thing to learn (flip a belt) and nothing to drag, rotate or time. A level has one or two belts, so one or two big buttons.
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

The game is portrait. The logical screen is 720 x 1280: a top bar, the play field, and a control strip at the bottom with the lives and one big button per belt, in thumb reach. On a phone it fills the screen held upright; on a desktop it shows as a centred column with the workshop wall on both sides. A phone held sideways gets a prompt to turn it upright; there is no landscape mode on mobile.

The layout respects the device safe area: the top bar starts below a camera cut-out and the buttons stay above the home indicator. Add `?safe=47,34` (top and bottom insets in CSS px) to the URL to check this on a desktop.

## How to play

1. PLAY drops you straight into your next level. The factory starts by itself; there is no RUN button.
2. Toys fall from the chute onto a belt. **Press the belt's button at the bottom of the screen to flip its direction**, before or while toys are riding it. The button has the same colour as its belt and shows which way the belt is running. Tapping the belt itself works too.
3. Get every toy into the bin of its own colour. A toy in the wrong bin costs a life; three lives per level (two on the first levels).
4. When the last toy is sorted the game moves on to the next level by itself. If you run out of lives it shows why and restarts the level.

Stars: 3 for no slips, 2 for one, 1 for two.

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Flip a belt | Press its button (or tap the belt) | First button: `Space`, `A`, `Left` or `1`. Second button: `D`, `Right` or `2` |
| Restart level | Restart button | `R` |
| Pause | Pause button | `Esc` or `P` |

**Panic Factory**: toys never stop. Two belts, two chutes, two buttons. Blue goes left, pink to the middle, yellow right. Three wrong deliveries end the run. Malfunctions (belt reverse, toy rush, turbo belts, low gravity, belt jam) are announced about two seconds before they start.

Springs, ramps, pushers and bumpers appear in the levels as fixed scenery: they bounce, slide and shove the toys but are never controlled. The engine also still contains heavy / bouncy / icy toys, drag / rotate / timer editing and a RUN-button puzzle flow from the earlier design. No current level uses those.

## Project layout

```
src/
  main.ts                 Phaser bootstrap, page-level input guards, render resolution
  game/
    config.ts             Constants and palette (no Phaser imports)
    sim/                  FactoryWorld (Matter engine + fixed-step loop), headless simulateLevel(),
                          routeBot (the stand-in player used by the tests)
    physics/              Matter access layer, collision categories, material presets
    entities/             FactoryObject (toy), ObjectSpawner
    machines/             BaseMachine, ConveyorBelt, SpringBumper, Piston, Funnel, DeliveryBin
    systems/              PuzzleRules, ScoreManager, PanicDirector, LevelManager, SaveManager,
                          AudioManager, ParticleManager
    levels/               LevelTypes, the 20 levels, the Panic arena
    rendering/            Vector drawing, texture baking, machine/toy views, WorldView (all the juice)
    scenes/               Boot, Menu, LevelSelect, Game, Panic, UI (HUD), Result, Pause, Settings,
                          Transition (the curtain wipe between screens)
    ui/                   Buttons, sliders, toggles, panels
    platform/             PlatformAdapter interface, StandaloneAdapter, PokiAdapter
  tests/                  Vitest suites
scripts/
  solve.ts, labkit.ts              Level verification with the route bot; physics trace helper
  smoke.mjs                        End-to-end browser test of the production build
  shot.mjs, phone.mjs              Screenshot helpers (desktop viewport, emulated phones)
  boot-check.mjs                   Confirms the current dist/ boots and starts level 1 on an emulated phone
.github/workflows/deploy.yml       Tests, builds and publishes to GitHub Pages on every push to main
output/poki/                       Portal thumbnail and the prompt it was generated from
docs/POKI_SUBMISSION.md            Listing copy and pre-submission checklist
```

Two design decisions shape everything else:

- **Simulation and rendering are separate.** `sim/`, `machines/`, `entities/` and the rule systems never import Phaser. They use Phaser's bundled Matter.js through a small injection point (`physics/MatterLib.ts`), so the exact game physics runs headlessly in Node. That is what makes the level tests and the solver possible.
- **Fixed timestep.** The world advances in 1/60 s ticks, and all gameplay timing (spawners, pistons, rules) is counted in ticks. Runs are reproducible for the same inputs at the same ticks.

## Adding or changing a level

Levels are data in `src/game/levels/levels.ts`, built from seven small layouts plus a toy sequence and a drop interval. Five layouts have one belt (springs, ramps, pushers, pinball bumpers, cross-over springs) and two have two belts (twin belts, two step). The springs, ramps, pushers and bumpers are fixed scenery: they add bouncing and shoving without adding anything to learn.

1. Add a `sortLevel({...})` entry: pick a layout, give it a sequence (`mixed(seed, count, colours)`) and an interval.
2. Each layout carries a `routes` table saying which way every belt must run for each colour. The tutorial hand and the test bot both use it.
3. Run `npm run solve`. A level is accepted when doing nothing fails, the bot clears it with no slips, and the bot still wins when it only reacts every 200, 300, 400 and 500 ms.
4. `npm test` re-checks all levels.

Keep the bins spanning the whole floor (the tests check that a toy can never fall out of play), keep to one or two belts per level, and keep at least 2.4 seconds between toys on one belt (the tests check both).

## Deployment

`npm run build` produces a fully static site in `dist/` (`index.html` plus hashed JS and CSS). The build uses relative paths, so it can be hosted from any folder: upload `dist/` to any static host, or zip its contents for a web game portal.

### GitHub Pages

`.github/workflows/deploy.yml` runs the headless tests, builds, and publishes `dist/` on every push to `main`. One-time setup: in the repository settings, set **Pages → Source** to **GitHub Actions**. The game is then served at `https://<user>.github.io/<repo>/`.

### Poki

The game talks to the hosting platform only through `platform/PlatformAdapter.ts`. The default `StandaloneAdapter` does nothing. To build with the Poki SDK:

```bash
# PowerShell
$env:VITE_PLATFORM = 'poki'; npm run build
# bash
VITE_PLATFORM=poki npm run build
```

`PokiAdapter` loads `https://game-cdn.poki.com/scripts/v2/poki-sdk.js` at runtime and maps to the calls in Poki's HTML5 guide (`init`, `gameLoadingFinished`, `gameplayStart`, `gameplayStop`, `commercialBreak`, `rewardedBreak`).

- `gameplayStart` / `gameplayStop` fire when a level or Panic run becomes active or stops (pause, win, failure, leaving).
- `commercialBreak` is requested only between runs: after a level is won, just before the wipe to the next level, and from the Panic game-over screen when the player moves on. It is never requested while toys are moving. Audio is muted and keyboard input ignored for the duration.
- Rewarded breaks are implemented in the adapter but not used by the game.

**This integration has not been run inside Poki's inspector or QA flow, and the game has not been reviewed by Poki.** Before submitting, test the `poki` build at https://inspector.poki.dev and check Poki's current requirements.

## Testing status

Run on Windows 11 with Node 26 and headless Microsoft Edge:

- `npm test`: 146 tests pass. They cover the physics and machines, win/lose rules, save/load including corrupted data, scoring, pacing (toy gaps and how fast the toy count grows), and for each of the 20 levels: structure, that doing nothing fails, that a bot following the routes clears it with no slips and no toy ever leaves play, that the bot still wins with reactions as slow as half a second, and determinism. Panic mode is checked with the same bot over three simulated minutes.
- `npm run smoke`: 43 checks pass against the production build: PLAY straight into level 1, the level starting by itself, the bottom button flipping the belt, auto-advance after a win, auto-restart after a failure, pause and settings, level 3 won with the keyboard, level 10 won by clicking its two buttons, level 13 won with touch taps on the buttons at phone size, safe-area insets keeping the top bar and buttons clear, save persistence, a corrupted save, Panic mode, six window shapes and the turn-upright prompt, with no console errors.

Not tested, so treat as unverified:

- Real phones and tablets, Safari and Firefox. Touch was exercised only through Chromium's touch emulation.
- How the levels feel to a person. They have been cleared by a bot and by scripted taps, never by a human playing cold.
- Behaviour on non-Chromium engines. The physics should not depend on the browser, but that has not been measured.
- Frame rate on low-end mobile hardware.
- Audio was not listened to by a person; the headless runs only confirm it produces no errors.
- The Poki build (see above).

See `PROGRESS.md` for current status and open items, `CHANGELOG.md` for how the design got here, and `docs/POKI_SUBMISSION.md` for the portal listing and checklist.
