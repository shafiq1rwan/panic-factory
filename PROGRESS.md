# Progress

Where the project stands and what is still open. Update this when work is picked up again.

## Current state

The game is a one-tap sorting game in portrait: toys drop into a small factory and the player taps belts to flip them so each toy lands in the bin of its own colour. It is deployed to GitHub Pages from `main`.

| Area | Status |
| --- | --- |
| Core engine (fixed-step Matter.js physics, belts, springs, bumpers, funnels, bins, chutes) | Done |
| 20 sorting levels in 5 chapters, six layouts | Done, verified by a bot |
| Panic Factory (endless mode with announced malfunctions) | Done |
| Title screen, level select, pause, settings, Panic game-over screen | Done |
| Auto-start, auto-advance after a win, auto-restart after a failure, curtain wipe | Done |
| Portrait layout that fills any window; turn-upright prompt for phones held sideways | Done |
| Procedural art and synthesised audio (no asset files) | Done |
| LocalStorage save (stars, unlocked levels, settings, Panic best) with validation | Done |
| Platform layer (standalone + Poki adapter) | Written; Poki build not yet run in Poki's tools |
| Headless tests, level verification, browser smoke test | Done |
| GitHub Pages workflow | Written; check the Actions tab for the latest run |
| Portal thumbnail (`output/poki/`) | Present |

## Verified

- `npm test`: 143 tests pass.
- `npm run solve`: all 20 levels are cleared with no slips by a bot that follows each level's routes, and are still won when the bot only reacts every 200 ms and 300 ms. Doing nothing fails every level, and no toy can leave play.
- `npm run smoke`: 39 checks pass against the production build in headless Edge, including a level won by keyboard, one by mouse and one by touch taps at phone size.
- A flawless run of all 20 levels is about 8 minutes of play (485 s measured with the bot), plus intro cards and transitions.

## Not verified

- No person has played the current levels start to finish. Difficulty, pacing and how long a real first playthrough takes are unknown.
- Real phones and tablets, Safari and Firefox. Touch has only been exercised through Chromium's emulation.
- The audio has not been listened to.
- Frame rate on low-end phones.
- The Poki build (`VITE_PLATFORM=poki`) in Poki's inspector.

## Open items

- [ ] Play-test on a real phone, cold, with two or three people; note where they stop.
- [ ] Decide whether play time is long enough for the portal. The owner's earlier Poki submission needed about 9 minutes of average play. Options: more levels, unlocking Panic mode earlier, a play-time counter in Settings for testing.
- [ ] Late-game variety: the junction layout is used for six of the last twelve levels.
- [ ] Faint vertical line near the left edge of each level-select card (cause not found).
- [ ] On very tall phones there is a band of plain wall between the top bar and the play field.
- [ ] Remove or reuse the engine parts no level uses any more: pistons, special toy materials, drag / rotate / timer editing, the RUN-button flow, the win and fail dialogs in `ResultScene.ts`.
- [ ] Run the Poki build in Poki's inspector before submitting.
- [ ] The Phaser bundle is about 1.3 MB (350 kB gzipped); a custom Phaser build would shrink it.
