# Tiny Factory Panic — notes for Claude

A one-button sorting game: toys drop into a factory and the player flips belts (one big button per belt at the bottom of the screen) so each toy lands in the bin of its own colour. TypeScript, Phaser 3, Matter.js (the build bundled inside Phaser), Vite. Portrait, 720 x 1280 logical screen. Read `README.md` for the full picture and `PROGRESS.md` for what is open.

## Commands

```bash
npm run dev      # dev server on port 5273
npm test         # headless tests (Vitest, Node)
npm run solve    # verify all levels with the route bot
npm run build    # tsc --noEmit, then vite build into dist/
npm run smoke    # browser test of the production build; run build first
```

After any change to physics, machines, levels or rules, run `npm run solve` and `npm test`. After any change to scenes, HUD or input, also run `npm run build` and `npm run smoke`.

## Rules of the design

- **One mechanic.** The player flips a belt with its button at the bottom of the screen. Do not add anything else to learn (no dragging, rotating, timers or special toy types) without the owner asking. New variety should be fixed scenery.
- **At most two belts per level**, so at most two buttons. Buttons sit left to right in the same order as their belts and share the belt's accent colour.
- **Gentle pace.** The owner found the earlier set rushed after level 5. Keep at least 2.4 s between toys on one belt and add toys gradually; the pacing tests enforce both.
- **Safe area.** HUD elements pin to `safeTop()` / `safeBottom()`, never to the raw window edge.
- **Portrait only on mobile.** Phones held sideways get a turn-upright prompt. Do not add a landscape layout.
- **Toys must never be lost.** Bins span the whole floor in every level; the tests check it.
- **Every level must pass `npm run solve`**: doing nothing fails, the bot clears it with no slips, and the bot still wins with 200 ms and 300 ms reaction delays.

## Architecture rules

- `src/game/sim`, `machines`, `entities`, `physics`, `levels` and the rule systems must not import Phaser. They get Matter through `physics/MatterLib.ts` so the same code runs in Node for tests. Rendering lives in `rendering/` and only reads simulation state.
- Physics advances in fixed 1/60 s ticks. Express gameplay timing in ticks, not wall-clock time.
- Levels are data in `src/game/levels/levels.ts`, built with `sortLevel({...})` from a layout, a toy sequence and an interval. Each layout has a `routes` table used by the tutorial and by the bot.
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
- **Emulation is not a phone.** The smoke test and `scripts/phone.mjs` use Chromium's emulation. Say so when reporting, and do not describe something as tested on mobile on that basis.

## Working agreements with the owner

- Commit only when asked. Commit on a new branch, then fast-forward `main`. Push only when asked.
- GitHub Pages deploys from `main` through `.github/workflows/deploy.yml`.
- The owner tests on a real phone through the Pages link, so tell them plainly when something is committed but not yet pushed.
