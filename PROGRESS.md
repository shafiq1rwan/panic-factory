# Progress

Where the project stands and what is still open. Update this when work is picked up again.

## Current state

The game is a set-up-then-run puzzle in portrait: the player taps machines to set them up (a belt flips, a bouncer turns, a timer moves on a step), presses RUN, and every toy has to land in the bin of its own colour. A wrong toy stops the run and hands the setup back. Panic mode keeps the earlier live play (two belts, two buttons). v1.7.0 is on `main` and GitHub Pages; the live one-button game it replaced is v1.6.5 in the history.

| Area | Status |
| --- | --- |
| Core engine (fixed-step Matter.js physics, belts, springs, bumpers, pushers, funnels, bins, chutes) | Done |
| 12 set-up levels in 3 chapters (belts, bouncers, timers) | Done, every setup of every level tried by the solver |
| Tap-to-set machines, RUN / STOP, free retries that keep the setup, stars by runs | Done |
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

- `npm test`: 113 tests pass.
- `npm run solve`: all 12 levels pass. Pressing RUN without changes fails every level; each solution wins and survives random spawn offsets; in the harder levels only 1 of 8, 12 or 32 setups wins; every possible run ends within 11 s.
- `npm run smoke`: 44 checks pass against the production build in headless Edge, including a level set up and won with the keyboard, one with the mouse, one with touch taps at phone size, and the safe-area insets.
- One winning run of every level adds up to 86 s of toys moving. Real play time depends on thinking and failed runs, which no one has measured.

## Not verified

- No person has played the current levels start to finish. Difficulty, pacing and how long a real first playthrough takes are unknown.
- Real phones and tablets, Safari and Firefox. Touch has only been exercised through Chromium's emulation.
- The audio has not been listened to.
- Frame rate on low-end phones.
- The Poki build (`VITE_PLATFORM=poki`) in Poki's inspector.

## Open items

- [ ] Owner to play the 12 levels on a phone and decide whether to keep this design.
- [ ] More levels: 12 is a prototype set. The solver makes adding levels quick (`scripts/plan-lab.ts`).
- [ ] Play-test on a real phone, cold, with two or three people; note where they stop. The Poki build sends level start / complete / fail events, so a fit test shows where players drop.
- [ ] Panic mode still uses the live flip mechanic. Decide whether it stays as a separate mode.
- [ ] The Poki thumbnail shows the old design.
- [ ] Safe area: confirm on the owner's phone (and on Poki) that the camera no longer overlaps the top bar.
- [ ] Faint vertical line near the left edge of each level-select card (cause not found).
- [ ] On very tall phones there is a band of plain wall between the top bar and the play field.
- [ ] Remove the engine parts no level uses any more: special toy materials, dragging, the selection toolbar in `GameScene.ts`, the win and fail dialogs in `ResultScene.ts`.
- [ ] Run the Poki build in Poki's inspector before submitting.
- [ ] The Phaser bundle is about 1.3 MB (350 kB gzipped); a custom Phaser build would shrink it.
