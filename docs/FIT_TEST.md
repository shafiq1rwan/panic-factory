# Poki player fit test

What is being tested, the results so far, and how to read the event export when it arrives.

## The test in progress

- **Build under test:** `output/poki/tiny-factory-panic-poki-v1.9.2.zip` (30 levels in three worlds, analytics events added in v1.9.2).
- **Results reported by the owner so far:** 208 players, average play time **2 min 16 s**.
- **What Poki looks for** (from Poki's fit-test guidance as read during development): an average of 3 minutes or more, and 25% or more of plays lasting over 3 minutes. The test sends about 500 players, so the 208-player figure is partial.
- **Earlier single-player signal:** one player in Japan played v1.8.0 for 11 min 15 s and finished all 16 levels of that version with three stars each (seen in a recording). Every level solved on the first run suggests the puzzles are clear but may be too easy for quick players.
- **Next step:** the owner will export the game-event CSV when the test completes. Analyse it as described below before changing levels.

`main` has moved on since v1.9.2 (see `CHANGELOG.md`): no empty bins and misses pop (v1.9.3), world 4 with the fan and water (v1.10.0 to v1.11.0). None of that is in the fit test.

## Events the v1.9.2 build sends

All with `PokiSDK.measure(category, what, action)`:

| category | what | action | when |
| --- | --- | --- | --- |
| `level` | level number, 1-30 | `open` | the level is opened, before any RUN |
| `level` | level number | `start` | each press of RUN (one level can send several) |
| `level` | level number | `complete` | a run is won |
| `level` | level number | `fail` | a run is lost (wrong bin or toy lost) |
| `level` | level number | `stop` | the player ends a run early: STOP, restart, or leaving mid-run |
| `panic` | `endless` | `start` / `complete` | Panic mode starts / ends |
| `panic-score` | score rounded down to 100 | `reached` | at the end of a Panic run |

Every `start` is followed by exactly one of `complete`, `fail` or `stop`, unless the player closed the page mid-run. Play time itself is measured by Poki from `gameplayStart` / `gameplayStop`, not from these events.

## How to read the CSV

For each level N, count players (or events, if the export has no player id) for each action. Then:

1. **Reach:** players with `open` for level N. Plotted against N this is the drop-off curve. The level where the curve falls most is where players quit.
2. **Gave up during setup:** players with `open` but no `start` on a level. A high share means the setup was not understood (what to tap, or what to aim for).
3. **Difficulty:** `fail` per `complete`, and `start` per `complete` (runs needed). Many fails and few completes on one level means it is too hard there; one start per complete on every level means the game is too easy.
4. **Stops:** many `stop` events means players start runs and abandon them, often because they see the run going wrong; compare with `fail`.
5. **Panic mode:** unlocks after 5 levels. How many players open it, and their scores.

Questions the analysis should answer:

- Do most players leave in the first few levels (fix levels 1-5, the hook) or do they leave late (add depth or content)?
- Which single levels lose the most players?
- Are levels being solved first try (too easy) or failed repeatedly (too hard)?

## Level numbers in the v1.9.2 build

| # | Level | What is new or tested |
| --- | --- | --- |
| 1 | First Flip | belt (tutorial hand) |
| 2 | Two Belts | two belts |
| 3 | Flip Stack | one belt feeding another |
| 4 | Aim It | bouncer (tutorial hand) |
| 5 | Bank Shot | bouncer aiming |
| 6 | Belt Bounce | belt + bouncer |
| 7 | Meet in the Middle | two bouncers |
| 8 | Either Way | several right answers |
| 9 | Take Turns | timer pusher (tutorial hand) |
| 10 | Sort Line | timer + belt |
| 11 | Kick and Bounce | timer + bouncer |
| 12 | Full Shift | timer + belt + bouncer |
| 13 | Hex Nuts | NEW TOY: green hexagon |
| 14 | Hex Kick | timer + belt |
| 15 | Heavy Load | NEW TOY: heavy |
| 16 | Two Weights | two bouncers |
| 17 | Heavy Kick | timer + bouncer |
| 18 | Heavy Belt | belt + two bouncers |
| 19 | Crossroads | three belts |
| 20 | Full House | timer + belt + bouncer |
| 21 | Boing | NEW TOY: bouncy |
| 22 | Bounce House | two bouncers |
| 23 | Bouncy Kick | timer + bouncer |
| 24 | Pill Box | NEW TOY: purple pill |
| 25 | Pill Kick | timer + belt |
| 26 | Pill Bounce | bouncer |
| 27 | Junction | three belts |
| 28 | Pill Pong | two bouncers |
| 29 | Bouncy Pills | timer + belt |
| 30 | Last Shift | timer + belt + bouncer |

Levels 1-30 keep the same numbers and names on `main`; levels 19 and 29 were re-tuned in v1.9.3 (empty bins removed), and levels 31-40 (world 4) exist only from v1.10.0.

## After the test

- If it passes, the owner resets the version to v1.0.0 (see `PROGRESS.md`).
- If it does not, use the analysis above to pick what to change, then submit a new build. The newest build on `main` is v1.11.0; a Poki zip for it has not been made yet.
