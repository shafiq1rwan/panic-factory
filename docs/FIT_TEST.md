# Poki player fit test

What is being tested, the results so far, and how to read the event export when it arrives.

## Result: v1.0.0 (web fit test build)

- **Build tested:** `output/poki/tiny-factory-panic-poki-v1.0.0.zip`. 500 players, average play time **3 min 18 s** (v1.12.1: 3 min 6 s). The owner's goal is **5 minutes**.
- **Every level is reached by more players:** level 3 72% of loaded (v1.12.1 57%), level 10 30% (23%), level 13 22% (13%), level 19 10% (7%).
- **The v1.0.0 fixes worked:** level 1 failed at least once by 0% (35%), Two Belts 15% (43%). RUN waiting for the tutorial step removed the early failures.
- **Hints are used:** 56 gameplays watched at least one rewarded ad for a hint; most hints on Flip Stack, Sort Line, Full Shift (8 each) and Heavy Belt (7).
- **Between-level losses stayed at 3-7%** in levels 1-6, also after levels 1-3 where no ad is shown, so ads are not the cause.
- **Panic mode is still unseen:** 4 plays. A first visit never shows the title screen, where Panic lives.

Where players are lost now (opened level N, never opened N+1):

| Level | Lost | Quit in level | Failed once | Runs per win | Opened, never pressed RUN |
| --- | --- | --- | --- | --- | --- |
| 1 First Flip | 50 (10%) | 8% | 0% | 1.1 | 26 |
| 2 Two Belts | 74 (17%) | 11% | 15% | 1.3 | 27 |
| **3 Flip Stack** | **77 (21%)** | 17% | 36% | 1.9 | 19 |
| 5 Belt Bounce | 35 (14%) | 8% | 25% | 1.7 | 9 |
| 6 Bank Shot | 34 (15%) | 11% | 65% | 2.2 | 6 |
| **12 Full Shift** | 27 (20%) | **21%** | 69% | **3.5** | 1 |
| **18 Heavy Belt** | 23 (32%) | **32%** | 65% | **3.5** | 7 |
| 19 Crossroads | 9 (18%) | 18% | 39% | 1.8 | 4 |
| 21 Boing | 8 (23%) | 23% | 67% | 2.4 | 2 |

375 of the 483 players who opened level 1 had stopped before level 13.

Changes in response (v1.1.0): Flip Stack one tap, Full Shift and Heavy Belt eased, a waiting RUN says what to do, hint after one failed run, Panic mode offered when it unlocks, and **toy outfits** unlocked by stars as a reason to keep playing. In a new test, look at reach past level 3 and level 12, and at the `outfit` and `panic offer` events.

## Result: v1.12.1 passed the player fit test

- **Build tested:** `output/poki/tiny-factory-panic-poki-v1.12.1.zip` (40 levels in four worlds; the v1.12 fit-test fixes).
- **Result:** 500 players, average play time **3 min 6 s**: passed. The next step is Poki's web fit test, which scores click-through rate (thumbnail), conversion to play and time on page.

Compared with v1.9.2 (levels matched by position for reach, by name for the rest; levels 5-8 were reordered in v1.12):

| | v1.9.2 | v1.12.1 |
| --- | --- | --- |
| Loaded but never opened level 1 | 10.5% | **2.6%** (first visit opens level 1) |
| Loaded and won level 1 | 79% | 80% |
| Level-1 runs stopped early / players who stopped one | 40% / 30% | **5% / 5%** (FAST instead of STOP) |
| Reach level 6 / 10 / 13 (share of loaded) | 29% / 17% / 11% | **37% / 23% / 13%** |
| Bank Shot: quit there, failed once, runs per win | 24%, 68%, 3.2 | 17%, 58%, 2.3 |
| Meet in the Middle: quit there, failed once | 19%, 58% | 8%, 55% |

What is still losing players (v1.12.1):

| Level | Opened | Quit in level | Failed once | Runs per win |
| --- | --- | --- | --- | --- |
| 1 First Flip | 527 | **18%** | **35%** | 1.6 |
| 2 Two Belts | 410 | **21%** | **43%** | 2.0 |
| 6 Bank Shot | 199 | 17% | 58% | 2.3 |
| 10 Sort Line | 123 | 14% | 52% | 2.9 |
| 11 Kick and Bounce | 103 | 12% | 38% | 2.2 |
| 12 Full Shift | 92 | **22%** | **65%** | **3.5** |
| 18 Heavy Belt | 47 | 19% | 56% | 2.6 |
| 21 Boing | 29 | 17% | 62% | 2.0 |
| 28-30 Pill Pong, Bouncy Pills, Last Shift | 17 to 12 | 14-18% | 88-92% | 3.1-4.6 |

- **Level 1 is now the biggest leak.** The players who used to leave at the title screen now leave inside level 1: 35% fail it at least once (mostly pressing RUN before tapping the belt), 18% never win it.
- **Two Belts got worse at teaching.** With one belt already right (v1.12), 43% fail at least once (v1.9.2: 35%); players flip both belts.
- **Players are lost inside levels far more than between them:** 356 vs 102 players over levels 1-12. Between-level loss is 5-7% at each of the first five transitions (where ad breaks are requested).
- **The late game is not the problem:** 10 players (2%) reached world 4 and 9 finished all 40 levels.
- **About 4% leave while the game loads** (566 loading, 541 loaded).
- **Panic mode is unused** (3 plays).

### Changes made in response (v1.0.0)

Items 2-5 below and a loading animation were made in v1.0.0. Item 1: on review the thumbnail (a bouncing blue toy, a belt, a bin) still matches the game, so it was kept; the web fit test's click-through score will judge it. Item 6 (a smaller bundle) was not done.

### Suggested next changes (before the web fit test)

1. Update the thumbnail: it still shows the old one-button design, and click-through rate is a web fit test score.
2. Level 1: RUN waits until the belt has been tapped (the hand points at the belt, then at RUN).
3. Level 2: the tutorial hand points at the belt that is wrong.
4. A HINT button after two failed runs on a level: the hand shows one machine to change (from the level's verified solution). It could be offered as a rewarded ad (`PokiSDK.rewardedBreak`, already in the adapter).
5. Try fewer ad breaks in the first few levels (5-7% leave at each early transition; the data cannot tell whether ads cause it).
6. Faster loading: the bundle is 1.3 MB, nearly all Phaser.

## Result: v1.9.2 failed (2026-11-12)

- **Build tested:** `output/poki/tiny-factory-panic-poki-v1.9.2.zip` (30 levels in three worlds, analytics events added in v1.9.2).
- **Final result:** 500 players, average play time **2 min 35 s**. Failed; Poki looks for an average of 3 minutes or more and 25% or more of plays over 3 minutes (from Poki's fit-test guidance as read during development). At 208 players it had been 2 min 16 s.
- **Earlier single-player signal:** one player in Japan played v1.8.0 for 11 min 15 s and finished all 16 levels with three stars each. The data below shows that player was the exception.

`main` has moved on since v1.9.2 (see `CHANGELOG.md`): no empty bins and misses pop (v1.9.3), world 4 with the fan and water (v1.10.0 to v1.11.0). None of that was in the test.

### What the event export shows

Computed from Poki's `progress-events` and `other-events` CSVs. "Quit in level" = opened the level but never completed it. "Failed once" = share of players with at least one failed run there. "Unfinished runs" = RUN presses that ended in neither a win nor a fail (STOP, restart, or leaving mid-run).

| Level | Opened | Quit in level | Failed once | Runs per win | Unfinished runs | Pressed STOP |
| --- | --- | --- | --- | --- | --- | --- |
| 1 First Flip | 486 | 12% | 23% | 2.2 | **40%** | **30%** |
| 2 Two Belts | 417 | **20%** | 35% | 2.0 | 18% | 15% |
| 3 Flip Stack | 316 | **17%** | 30% | 2.1 | 22% | 18% |
| 4 Aim It | 251 | 10% | 25% | 1.6 | 18% | 12% |
| 5 Bank Shot | 213 | **24%** | **68%** | **3.2** | 21% | 30% |
| 6 Belt Bounce | 157 | 8% | 15% | 1.6 | 20% | 15% |
| 7 Meet in the Middle | 136 | **19%** | **58%** | 2.5 | 21% | 24% |
| 8 Either Way | 107 | 10% | 0% | 1.2 | 19% | 15% |
| 9 Take Turns | 96 | 2% | 21% | 1.6 | 11% | 4% |
| 10 Sort Line | 93 | 13% | 46% | 2.3 | 14% | 19% |
| 11 Kick and Bounce | 82 | 5% | 29% | 1.6 | 5% | 7% |
| 12 Full Shift | 77 | **22%** | **58%** | **3.3** | 12% | 23% |
| 13-17 | 59 to 36 | 4-10% | 10-37% | 1.2-1.6 | | |
| 18 Heavy Belt | 32 | 22% | 61% | **3.8** | 25% | 31% |
| 19-29 | 25 to 13 | 0-19% | | | | |
| 30 Last Shift | 13 | 23% | 85% | **5.6** | | |

- **Players leave early.** Of the players who opened level 1, 86% reached level 2, 65% level 3, 44% level 5, 32% level 6, 19% level 10, 12% level 13 and 3% level 30. Past level 13 almost everyone carries on; the average is decided by levels 1-7.
- **They leave inside a level, not between levels.** Players who won level N but never opened N+1: 3-5% per level. So the star card, the ad break and the wipe are not the main leak.
- **Difficulty spikes cost players.** Levels 5, 7, 12 and 18 are where most players fail (58-68% fail at least once, 2.5-3.8 runs per win) and where 19-24% quit. Level 5 (Bank Shot) is the single biggest loss.
- **Levels 2 and 3 lose many players without being hard** (20% and 17% quit, but only 30-35% fail once, 2 runs per win): confusion or boredom rather than difficulty.
- **Runs get stopped a lot.** On level 1, 40% of RUN presses ended in neither a win nor a fail, and 30% of players pressed STOP at least once. During a run the RUN button turns into STOP in the same place, so a second tap (impatience, or a double tap) ends the run.
- **10% never start level 1** (543 loaded, 486 opened level 1); 4% opened level 1 but never pressed RUN.
- **Panic mode is unused** (4 plays).

### Changes made in response (v1.12.0)

All four suggestions below were made in v1.12.0: the big button is FAST during a run, world 1 is reordered (Bank Shot 5 -> 6, Meet in the Middle 7 -> 8, Either Way 8 -> 7, Belt Bounce 6 -> 5) and eased (Two Belts and Aim It need one tap, Bank Shot has three angles instead of four), world-1 belt and bouncer levels run quicker (toys 1.1 s apart instead of 1.5 s, first toy after 0.25 s), and a first visit opens level 1 directly. **Level numbers 5-8 in a new fit test therefore mean different levels than in the table above.**

### Suggested changes for the next submission

1. During a run, the big button becomes FAST (x3 speed) instead of STOP; stopping stays on the top bar's restart button.
2. Smooth levels 1-7: ease or move Bank Shot (5) and Meet in the Middle (7) later; make levels 2-3 quicker to read and quicker to run.
3. Shorter waits in world 1: first toy sooner, toys closer together where the level allows it.
4. Start straight in level 1 on a first visit instead of the title screen.
5. Later spikes (12, 18, 30) matter less: few players reach them.

World 4 (v1.10.0-v1.11.0) adds content at the end, which only 3% of players reached in this test; it will not move the average by itself.

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
