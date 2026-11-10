# Tiny Factory Panic

A cute 2D physics puzzle game for the browser. Arrange conveyors, springs and pistons, press **RUN**, and watch little toys roll, bounce and tumble into their bins.

- **Puzzle Factory**: 15 handcrafted levels in 5 chapters, three-star ratings.
- **Panic Factory**: an endless arcade mode that unlocks after 6 levels.
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
| `npm run solve` | Verify every level: the default layout must fail, the intended solution must win with 3 stars, and it must still win with jittered spawns. `npm run solve 7` also brute-forces level 7's whole configuration space. |
| `npm run smoke` | End-to-end test of the production build in headless Edge or Chrome (mouse, keyboard and touch). Run `npm run build` first. Screenshots go to `test-artifacts/`. |

## How to play

**Puzzle Factory**

1. Machines with a pulsing outline and a small badge can be changed. Tap one to select it.
2. Drag movable machines inside the dashed zone, use the round buttons to rotate, flip a belt, or change a piston's timer.
3. Press **RUN**. The layout locks and the factory starts. Press **STOP** (or **Retry**) to go straight back to arranging; your layout is kept.
4. Deliver the required toys to the bins with matching colour and shape.

Stars: 1 for finishing, 2 with at most one slip (wrong bin or lost toy), 3 for no slips within the level's par time. The simulation is deterministic, so the same layout always gives the same result.

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Select machine | Tap | `Tab` cycles |
| Move | Drag | Arrow keys |
| Rotate | Round arrow buttons | `Q` / `E` |
| Flip belt / change timer | Tap the machine or its button | `F` / `T` |
| Run / stop | RUN button | `Space` or `Enter` |
| Retry | Retry button | `R` |
| Fast-forward (while running) | `>>` button | `F` |
| Pause | Pause button | `Esc` or `P` |

**Panic Factory**: toys keep dropping. Tap a belt to flip it (or `W`/`A`/`D`, or the arrow keys). Blue goes left, pink to the middle, yellow right. Three wrong deliveries end the run. Malfunctions (belt reverse, toy rush, turbo belts, low gravity, belt jam) are announced about two seconds before they start.

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
    levels/               LevelTypes, the 15 levels, the Panic arena
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

Levels are plain data in `src/game/levels/levels.ts`. Each one lists spawners, machines, walls, the objective, the mistake allowance, a par time and its intended `solution`.

1. Add the level with a best-guess `solution`.
2. Run `npm run solve <number>`. It reports whether the default layout fails, whether the solution wins, and lists every winning configuration it found by brute force. `npm run solve <number> trace` prints the physics events of the solution run.
3. `npx tsx scripts/robust.ts <number>` ranks winning configurations by how well they survive small spawn variations. Prefer a solution that scores 8/8.
4. `npm test` re-checks all levels.

A handy trick while designing: temporarily mark a machine whose position you are unsure about as `movable` with a zone, and let the solver tell you where it works.

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

- `npm test`: 131 tests pass. They cover gravity and collisions, conveyors (both directions, rotated, stopped), bumper impulses and cooldown, pistons not passing through objects, funnels, bins counting once and ignoring outside touches, win/lose rules, spawner sequencing, full reset, cleanup across 20 world create/destroy cycles, placement rules, save/load including corrupted data, scoring, and for each of the 15 levels: structure, legal default placement, default layout fails, solution wins with 3 stars, solution survives jittered spawns, determinism. Panic mode is checked with a greedy bot over three simulated minutes.
- `npm run smoke`: 42 checks pass against the production build, including a full menu, level select, play, win, next level, fail, retry loop, pause and settings, drag and rotate, save persistence across reload, corrupted save, Panic mode, touch-only play at phone size, six window shapes (the canvas fills each one) and the portrait prompt, with no console errors.

Not tested, so treat as unverified:

- Real phones and tablets, Safari and Firefox. Touch was exercised only through Chromium's touch emulation.
- Whether level solutions hold on non-Chromium engines. The physics is deterministic within one engine and the solutions have margin (they pass with jittered spawns), but tiny floating-point differences between browsers have not been measured.
- Frame rate on low-end mobile hardware.
- Audio was not listened to by a person; the headless runs only confirm it produces no errors.
- The Poki build (see above).

See `PROGRESS.md` for the development checklist.
