# Tiny Factory Panic

A set-up-then-run physics puzzle for the browser. **Tap the machines to set them up, then press RUN**: the toys drop, bounce and ride through the factory, and every one has to land in the bin of its own colour.

- **30 levels** in 3 worlds of ten (Workshop, Toy Room, Night Shift). Each world has its own wall, pipe colour and new toys (green hexagon and heavy toys in the Toy Room, bouncy toys and the purple pill on the Night Shift); a level that brings in a new toy shows a NEW TOY card before the first run; three-star ratings for solving a level in few runs. One gesture: tap a machine to change it. Nothing to drag.
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

The game is portrait. The logical screen is 720 x 1280: a top bar, the play field, and a control strip at the bottom with the stars still on offer and one big RUN button, in thumb reach. On a phone it fills the screen held upright; on a desktop it shows as a centred column with the workshop wall on both sides. A phone held sideways gets a prompt to turn it upright; there is no landscape mode on mobile.

The layout respects the device safe area: the top bar starts below a camera cut-out and the RUN button stays above the home indicator. Inside an iframe (as on Poki) the browser reports no inset, so on an upright touch screen the game assumes a 44 px camera area. Add `?safe=47,34` (top and bottom insets in CSS px) to the URL to check this on a desktop.

## How to play

1. PLAY drops you straight into your next level. Nothing moves until you press RUN.
2. **Set up the factory by tapping the machines that wear a badge:**
   - a **belt** flips direction,
   - a **bouncer** turns to its next angle,
   - a **timer** moves its pusher's timing on one step (the clock on the pusher shows it).
3. **Press RUN.** The toys drop from the pipes. While they move nothing can be changed; STOP ends the run early.
4. Every toy must land in the bin of its own colour. One wrong toy stops the run, says which toy went where, and hands your setup back exactly as you left it.
5. When every toy is sorted the game moves on to the next level by itself.

Stars count runs: solved on the first run 3, within three runs 2, otherwise 1. The row above RUN shows the stars still on offer.

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Change a machine | Tap it | `1`–`9` tap the adjustable machines, left to right |
| Run / stop | RUN / STOP button | `Space` or `Enter` |
| Back to setup | Restart button | `R` |
| Pause | Pause button | `Esc` or `P` |

A tap on empty space before RUN makes the badges flash, so it is clear what can be tapped.

**Panic Factory** (unlocked after 5 levels) is the live mode: toys never stop, two belts, two chutes and two buttons to flip them. Blue goes left, pink to the middle, yellow right. Three wrong deliveries end the run. Malfunctions (belt reverse, toy rush, turbo belts, low gravity, belt jam) are announced about two seconds before they start.

## Project layout

```
src/
  main.ts                 Phaser bootstrap, page-level input guards, render resolution
  game/
    config.ts             Constants and palette (no Phaser imports)
    sim/                  FactoryWorld (Matter engine + fixed-step loop), headless simulateLevel(),
                          planSolver (tries every setup of a level), routeBot (Panic mode's test player)
    physics/              Matter access layer, collision categories, material presets
    entities/             FactoryObject (toy), ObjectSpawner
    machines/             BaseMachine, ConveyorBelt, SpringBumper, Piston, Funnel, DeliveryBin
    systems/              PuzzleRules, ScoreManager, PanicDirector, LevelManager, SaveManager,
                          AudioManager, ParticleManager
    levels/               LevelTypes, the 30 levels, the Panic arena
    rendering/            Vector drawing, texture baking, machine/toy views, WorldView (all the juice)
    scenes/               Boot, Menu, LevelSelect, Game, Panic, UI (HUD), Result, Pause, Settings,
                          Transition (the curtain wipe between screens)
    ui/                   Buttons, sliders, toggles, panels
    platform/             PlatformAdapter interface, StandaloneAdapter, PokiAdapter
  tests/                  Vitest suites
scripts/
  solve.ts, labkit.ts              Level verification (every setup of every level); Node physics bootstrap
  plan-lab.ts, plan-trace.ts,      Level design: which setups win, where every toy lands,
  plan-watch.ts                    toy positions tick by tick
  iframe-check.mjs                 The build inside a cross-origin iframe on an emulated phone (as on Poki)
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

Levels are data in `src/game/levels/levels.ts`, each built with `planLevel({...})` from machines (adjustable: `belt`, `bouncer` with its list of `angles`, `timer` with its period; fixed: `fixedBelt`, `spring`), pipes (`pipe(id, x, toys, interval, delay)`), bins covering the floor, and a verified `solution`.

1. Sketch the level, then run `npx tsx scripts/plan-lab.ts <n>`. It tries every setup and lists the ones that win, the fewest taps needed, whether the win survives small random spawn offsets, and the longest run.
2. If toys do not go where you expect, `npx tsx scripts/plan-trace.ts <n>` shows where every toy lands under every setup, and `plan-watch.ts` prints positions tick by tick.
3. Make sure the starting setup fails, the solution is robust, and (with four or more setups) no more than half of them win.
4. `npm run solve` and `npm test` check all of that for every level, plus: one new kind of machine at a time, at most three adjustable machines, and every run over within 13 s.

Timer levels need care: the pusher only hits a toy if the toy reaches it as the pusher fires. Tune the pipe's `delay` in 50 ms steps until the solution is robust.

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

- `npm test`: 234 tests pass. They cover the physics and machines, win/lose rules, save/load including corrupted data, scoring, that new toys arrive one at a time after world 1 and always with a NEW TOY card, and for each of the 30 levels: that the next-toy previews of its pipes never overlap a pipe or each other, structure, that RUN without changes fails, that the solution wins and survives random spawn offsets, that most setups lose, that every possible run ends within 13 s with no toy leaving play, and determinism. Panic mode is checked with a bot over three simulated minutes.
- `npm run solve`: tries all setups of every level (2 to 32 per level).
- `npm run smoke`: 44 checks pass against the production build: PLAY into level 1 waiting in setup, a tap on empty space flashing the badges, tapping the belt, RUN, machines locked during a run, auto-advance after a win, a failed run handing the setup back with fewer stars on offer, pause and settings mid-run, level 3 set up and won with the keyboard, level 12 with the mouse, level 7 with touch taps at phone size, safe-area insets, save persistence, a corrupted save, Panic mode, six window shapes and the turn-upright prompt, with no console errors.

Not tested, so treat as unverified:

- Real phones and tablets, Safari and Firefox. Touch was exercised only through Chromium's touch emulation.
- How the levels feel to a person. They have been solved by the solver and by scripted taps, never by a human playing cold; difficulty is judged only from how many setups win.
- Behaviour on non-Chromium engines. The physics should not depend on the browser, but that has not been measured.
- Frame rate on low-end mobile hardware.
- Audio was not listened to by a person; the headless runs only confirm it produces no errors.
- The Poki build (see above).

See `PROGRESS.md` for current status and open items, `CHANGELOG.md` for how the design got here, and `docs/POKI_SUBMISSION.md` for the portal listing and checklist.
