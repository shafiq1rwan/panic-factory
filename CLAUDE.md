# Tiny Factory Panic — notes for Claude

A set-up-then-run sorting puzzle: before pressing RUN the player taps machines to set them up (a belt flips, a bouncer turns, a timer moves on a step), then the toys drop and every one must land in the bin of its own colour. Panic mode is the exception: there the player flips two belts live with two buttons. TypeScript, Phaser 3, Matter.js (the build bundled inside Phaser), Vite. Portrait, 720 x 1280 logical screen. Read `README.md` for the full picture and `PROGRESS.md` for what is open.

## Commands

```bash
npm run dev      # dev server on port 5273
npm test         # headless tests (Vitest, Node)
npm run solve    # verify all levels by trying every possible setup
npm run build    # tsc --noEmit, then vite build into dist/
npm run smoke    # browser test of the production build; run build first
node scripts/iframe-check.mjs   # the build inside a cross-origin iframe on an emulated phone, as on Poki
npx tsx scripts/plan-lab.ts [n]   # level design: which setups win, how many taps, how long runs last
npx tsx scripts/plan-trace.ts n   # level design: where every toy lands under every setup
npx tsx scripts/plan-watch.ts n '<setup json>'   # level design: toy positions tick by tick
```

After any change to physics, machines, levels or rules, run `npm run solve` and `npm test`. After any change to scenes, HUD or input, also run `npm run build` and `npm run smoke`.

## Rules of the design

- **Set up, then run.** The owner chose this after the live one-button version kept players under a minute. One gesture only: tap a machine wearing a badge to change it (belt: flip; bouncer: next of its listed `angles`; timer: next of its `timingSteps`). No dragging. Nothing changes while toys move. Do not add new kinds of adjustable machine without the owner asking.
- **Teach one thing at a time.** A level that introduces a new kind of machine has nothing else to set; the tests enforce it. At most three adjustable machines per level. New toys appear only after world 1, one new kind per level, and that level sets `newToy` so a NEW TOY card explains it before the first run (tested).
- **A new look every ten levels.** Worlds are ten levels each (`WORLD_SIZE`); `THEMES` in `rendering/Background.ts` gives each its name, wall colours, pattern and pipe colour. Keep wall patterns faint and large so nothing looks like a toy or a machine.
- **Failing is cheap.** One wrong toy stops the run; the setup comes back exactly as the player left it. Stars count runs (first run 3, up to three runs 2, else 1). Keep runs short: every run, won or lost, ends within 13 s (tested).
- **Safe area.** HUD elements pin to `safeTop()` / `safeBottom()`, never to the raw window edge.
- **Portrait only on mobile.** Phones held sideways get a turn-upright prompt. Do not add a landscape layout.
- **Toys must never be lost.** Bins span the whole floor in every level; the tests check it.
- **Every level must pass `npm run solve`**: RUN without changes fails, the `solution` wins and keeps winning with random spawn offsets, and in levels with four or more setups at most half of them win.
- **Timers are precise.** A timer level only works if toys reach the pusher at the moment it fires. Tune the pipe's `delay` (in 50 ms steps) with `plan-trace` / `plan-watch` until the solution is robust; moving a pusher or pipe changes the timing.

## Architecture rules

- `src/game/sim`, `machines`, `entities`, `physics`, `levels` and the rule systems must not import Phaser. They get Matter through `physics/MatterLib.ts` so the same code runs in Node for tests. Rendering lives in `rendering/` and only reads simulation state.
- Physics advances in fixed 1/60 s ticks. Express gameplay timing in ticks, not wall-clock time.
- Levels are data in `src/game/levels/levels.ts`, built with `planLevel({...})`: machines, pipes, and the verified `solution` (also used by the tutorial hand). `sim/planSolver.ts` enumerates every setup. Panic mode is separate (`panicLevel.ts`, `routes` table, `sim/routeBot.ts`).
- Scenes are authored in 720 x 1280 logical coordinates. The camera zooms by `view.res`; the visible area can be larger than the logical screen on one axis, so use `viewTop()` / `viewBottom()` for anything pinned to a window edge.
- Scene order in `main.ts` is the draw and input order. Overlays go after gameplay scenes; `Transition` stays last.

## Gotchas found the hard way

- **Keyboard:** Phaser ignores key events that already had `preventDefault` called. Never add a window `keydown` listener that prevents default for Space, arrows or Tab; use the `input.keyboard.capture` list in the game config.
- **Port 5173 is taken** on the owner's machine by another project. This project uses 5273; `scripts/smoke.mjs` picks a free port by itself.
- **Drive-letter case breaks Vitest.** If the shell's working directory is `c:\...` (lower case), every test file fails with "Cannot read properties of undefined (reading 'config')". Run commands from `cd "C:/Users/..."` with an upper-case `C`.
- **Do not kill processes by PID.** It is blocked in this environment. Stop servers from the script that started them.
- **Shell heredocs containing apostrophes or backticks have failed here.** Write files with the Write tool, or write a small `.mjs` patch script and run it.
- **Line endings:** `.gitattributes` keeps LF. When patching files from a script, normalise `\r\n` first.
- **Machine views:** subclass fields are not initialised when the base constructor runs, so views are created through `createMachineView`, which calls `sync()` afterwards.
- **Other people edit this folder.** Check `git status` and re-read a file before rewriting it; do not assume it is as you left it.
- **Inside an iframe the safe-area inset always reads 0.** Poki embeds the game in an iframe and runs it fullscreen, so `main.ts` assumes a 44 px camera inset on an upright touch screen when framed. Poki also draws its "Pill" button over the top left on mobile; each screen calls `keepOverlayBelow()` (Background.ts) so the pill is moved (`PokiSDK.movePill`) below that screen's top controls.
- **Canvas size is capped** (`MAX_VIEW`, `MAX_CANVAS_PX` in `main.ts`). Without the cap a wide, short window made a canvas past the GPU texture limit and WebGL threw "Framebuffer status: Incomplete Attachment". `#game` centres the canvas with flexbox, so Phaser's `autoCenter` stays off.
- **A scene's `state` field is `prep` before the scene has started.** Tests that wait for a level must also check `scene.isActive('Game')`.
- **Emulation is not a phone.** The smoke test and `scripts/phone.mjs` use Chromium's emulation. Say so when reporting, and do not describe something as tested on mobile on that basis.

## Working agreements with the owner

- Commit only when asked. Commit on a new branch, then fast-forward `main`. Push only when asked.
- GitHub Pages deploys from `main` through `.github/workflows/deploy.yml`.
- The owner tests on a real phone through the Pages link, so tell them plainly when something is committed but not yet pushed.
