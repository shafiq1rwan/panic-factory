# Progress

Where the project stands and what is still open. Update this when work is picked up again.

## Picking this up on another machine

1. `git pull`, then `npm install`.
2. Run commands from a path that starts with an upper-case `C:` (see the Vitest gotcha in `CLAUDE.md`).
3. `npm test`, `npm run solve`, `npm run build`, `npm run smoke` should all pass (numbers below).
4. Read `docs/FIT_TEST.md`: the Poki player fit test is running on v1.9.2 and its event CSV is the next thing to analyse.

Owner preferences that matter for the next steps (they were kept in a local assistant memory on the first PC, so they are written here too):

- The dev server runs on port **5273**; 5173 belongs to another project on the owner's machine.
- **The version was reset to v1.0.0 after the player fit test passed** (v1.12.1 was the last 1.x build). Old zips (v1.5.0 to v1.12.1) are in `output/poki/archive/`; submit the newest zip at the top of `output/poki/`.
- Poki zip names must contain the version, `v1.?.?`.
- Commit on a new branch, fast-forward `main`; push only when asked. The owner tests on a real phone through the GitHub Pages link, so say plainly when something is committed but not pushed.

## Current state

`main` is **v1.0.0** (see `CHANGELOG.md`). The Poki player fit test of **v1.12.1 passed** (500 players, 3 min 6 s); v1.9.2 had failed (2 min 35 s). Next is the web fit test; see `docs/FIT_TEST.md`.

The game is a set-up-then-run puzzle in portrait: the player taps machines to set them up (a belt flips, a bouncer turns, a timer moves its pusher on a step, a fan switches on), presses RUN, and every toy has to land in the bin of its own colour. A wrong toy, or one that misses the bins, stops the run and hands the setup back. Panic mode keeps the earlier live play (two belts, two buttons).

40 levels in four worlds of ten, each with its own wall, pipe colour and new things, and a NEW card wherever something new first appears:

| Levels | World | New |
| --- | --- | --- |
| 1-10 | Workshop (mint) | belts, bouncers, timers; plain toys |
| 11-20 | Toy Room (wooden planks) | green hexagon, heavy toys |
| 21-30 | Night Shift (blue bricks) | bouncy toys, purple pill |
| 31-40 | Harbour (sky, water) | bins float on water, misses splash and sink; the fan |

What changed after the fit-test build (v1.9.2): previews no longer overlap and round buttons lost their corner "ears" (v1.9.1, included in v1.9.2); empty bins removed and misses pop with X eyes (v1.9.3); world 4 (v1.10.0, drifting bins); bins float in place with cartoon water and world 4 rebuilt around the fan (v1.11.0). Details in `CHANGELOG.md`.

| Area | Status |
| --- | --- |
| Core engine (fixed-step Matter.js physics, belts, springs, bumpers, pushers, funnels, bins, chutes) | Done |
| 40 set-up levels in 4 worlds of ten (Workshop, Toy Room, Night Shift, Harbour), each with its own wall, pipe colour and toys; world 4 is on water (floating bins, splashing misses) and adds the fan | Done, every setup of every level tried by the solver |
| Tap-to-set machines, RUN / FAST (restart stops a run), free retries that keep the setup, stars by runs | Done |
| Panic Factory (endless live mode with announced malfunctions) | Done |
| Title screen, level select, pause, settings, Panic game-over screen | Done |
| Auto-advance after a win, curtain wipe | Done |
| Portrait layout that fills any window; turn-upright prompt for phones held sideways | Done |
| Procedural art and synthesised audio (no asset files) | Done |
| LocalStorage save (stars, unlocked levels, settings, Panic best) with validation | Done |
| Platform layer (standalone + Poki adapter, Pill placement, analytics events) | Done; Poki build checked in an emulated iframe, not in Poki's own tools |
| Headless tests, level verification, browser smoke test | Done |
| GitHub Pages workflow | Written; check the Actions tab for the latest run |
| Portal thumbnail (`output/poki/`) | Present (shows the old one-button design) |

## Verified

- `npm test`: 297 tests pass.
- `npm run solve`: all 40 levels pass. Pressing RUN without changes fails every level; each solution wins and survives random spawn offsets; in the harder levels only 1 of 8, 12 or 32 setups wins; every possible run ends within 11 s.
- `npm run smoke`: 51 checks pass against the production build in headless Edge, including a level set up and won with the keyboard, one with the mouse, one with touch taps at phone size, and the safe-area insets.
- One winning run of every level adds up to 291 s of toys moving. Real play time depends on thinking and failed runs, which no one has measured.

## Not verified

- No person has played the current levels start to finish. Difficulty, pacing and how long a real first playthrough takes are unknown.
- Real phones and tablets, Safari and Firefox. Touch has only been exercised through Chromium's emulation.
- The audio has not been listened to.
- Frame rate on low-end phones.
- The Poki build (`VITE_PLATFORM=poki`) in Poki's inspector.

## Open items

- [x] Owner played v1.7.0 on a phone: "looks interesting", asked for new levels with a different background and shape (v1.8.0).
- [x] Owner played v1.8.0: the new toys need introducing; asked for up to 30 levels with a new look every 10 (v1.9.0).
- [x] Owner played v1.9.x: some levels feel repetitive; asked for a fourth world with bins floating on water and a new prop (v1.10.0), then for bins that only float (no drifting) and cartoon water (v1.11.0).
- [x] Analysed the v1.9.2 fit-test event CSV (`docs/FIT_TEST.md`): players leave early, inside levels 1-7, at difficulty spikes (5, 7) and in levels 2-3; 30% of players stop a run on level 1.
- [x] Acted on the fit-test findings (v1.12.0): FAST instead of STOP, world 1 reordered and eased, quicker world-1 runs, first visit straight into level 1.
- [x] Poki zip of v1.12.1: `output/poki/tiny-factory-panic-poki-v1.12.1.zip` (v1.12.0 reported gameplay start before any player input; fixed).
- [x] **v1.12.1 passed the Poki player fit test** (500 players, 3 min 6 s). Analysis in `docs/FIT_TEST.md`.
- [x] Acted on the v1.12.1 findings and reset the version: **v1.0.0** (RUN waits for tutorial steps, level-2 hand, HINT button, no ads after levels 1-3, loading animation). Thumbnail kept: on review it still matches the game.
- [ ] Submit `output/poki/tiny-factory-panic-poki-v1.0.0.zip` for the **web fit test** (click-through rate, conversion to play, time on page). Older zips are in `output/poki/archive/`.
- [ ] Smaller bundle (custom Phaser build) if loading still loses players.
- [ ] Owner to try world 4 (v1.11.0) on a phone: the water, the splash, the fan's wind streaks.
- [ ] Some world 2 and 3 levels share layouts with world 1 (the owner noticed repetition). Rework the ones the owner names.
- [ ] Make a Poki zip of the newest `main` when the next submission is due (none exists for v1.9.3 to v1.11.0).
- [ ] Play-test on a real phone, cold, with two or three people; note where they stop.
- [ ] Panic mode still uses the live flip mechanic. Decide whether it stays as a separate mode.
- [ ] The Poki thumbnail shows the old design.
- [ ] Safe area: confirm on the owner's phone (and on Poki) that the camera no longer overlaps the top bar.
- [ ] Faint vertical line near the left edge of each level-select card (cause not found).
- [ ] On very tall phones there is a band of plain wall between the top bar and the play field.
- [ ] Remove the engine parts no level uses any more: the slippery toy material, dragging, the selection toolbar in `GameScene.ts`, the win and fail dialogs in `ResultScene.ts`, the spawner's hold-first-toy feature.
- [ ] Run the Poki build in Poki's inspector before submitting.
- [ ] The Phaser bundle is about 1.3 MB (350 kB gzipped); a custom Phaser build would shrink it.
