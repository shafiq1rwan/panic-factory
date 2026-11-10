# Progress checklist

Status of the development plan. Update this file when work is picked up again.

## Phase 1: Foundation — done
- [x] Vite + TypeScript + Phaser 3 project, production build
- [x] Responsive canvas: portrait 720x1280 screen (top bar, play field, bottom control strip), view extended on one axis so the canvas fills any window shape; render resolution up to 2x for high-DPI
- [x] Procedural vector helpers and texture baking (`rendering/`)
- [x] Scene structure: Boot, Menu, LevelSelect, Game, Panic, UI, Result, Pause, Settings

## Phase 2: Physics prototype — done
- [x] Toys: circle, rounded square, rounded triangle, hexagon; four material presets
- [x] Fixed 60 Hz timestep, speed cap, out-of-play removal, object cap
- [x] Conveyor, spring bumper (round and pad), delivery bin

## Phase 3: Core loop — done
- [x] Data-driven level loading
- [x] Preparation phase: select, drag in zones, rotate, flip, piston timer; overlap and zone checks
- [x] Run / Stop / instant Retry (layout preserved)
- [x] Objectives, mistakes, win and all failure conditions (wrong bins, lost toys, stuck, time limit, overtime)

## Phase 4: More machines — done
- [x] Piston (moving static ram with velocity transfer, adjustable timer)
- [x] Funnel
- [x] Configurable spawners with authored sequences and queue preview

## Phase 5: Levels — done
- [x] 15 handcrafted levels, each with a verified solution (`npm run solve`)
- [x] Default layouts verified NOT to win; solutions verified against jittered spawns

## Phase 6: Polish — done
- [x] Cute pastel art direction: faces with expressions, squash and stretch, soft shadows
- [x] Particles, floating text, camera shake (rare), win zoom punch, confetti
- [x] Procedural sound effects and a small generative music loop
- [x] HUD, menus, level-complete and failure screens, settings
- [x] Tutorials with a pointing hand (levels 1-5, 7, 8)
- [x] Mouse, keyboard and touch controls; turn-upright prompt for phones held sideways

## Phase 7: Panic Factory — done
- [x] Endless spawning with rising difficulty
- [x] Live belt flipping
- [x] Telegraphed malfunctions: reverse, rush, turbo, low gravity, jam
- [x] Score, streak multiplier, chain bonus, high score

## Phase 8: Release prep — done, with open items below
- [x] Versioned LocalStorage save with validation
- [x] Platform adapter layer (standalone + Poki)
- [x] Automated tests (`npm test`) and browser smoke test (`npm run smoke`)
- [x] README with deployment instructions

## Open items / ideas
- [ ] Test on real phones and tablets, Safari and Firefox
- [ ] Run the `VITE_PLATFORM=poki` build in Poki's inspector
- [ ] Have someone listen to the audio mix and tune volumes
- [ ] Levels 13-15 could use a time-limit or interactive-machine variant for more "panic"
- [ ] The Phaser bundle is about 1.3 MB (350 kB gzipped); a custom Phaser build would shrink it
- [ ] More levels: the solver makes new ones cheap to verify
