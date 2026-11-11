# Poki submission notes

Listing copy to paste into the submission form, and a checklist of what to do before submitting. Nothing here has been reviewed or approved by Poki.

## Listing copy

**Title:** Tiny Factory Panic

**Main category:** Puzzle

**Secondary tags:** Physics, Casual, Sorting

**One-line description:**
Set up the factory, press RUN, and get every toy into the bin of its own colour.

**Description:**
The toys are about to come down the pipes, and every one has to end up in the bin of its own colour. Tap the machines to set the factory up: flip the belts, turn the bouncers, set the pushers' timers. Then press RUN and watch it go. Got one wrong? Change the setup and run it again.

It starts with a single belt. Then come bouncers that fling toys across the room, timed pushers that kick only the right toys, and factories where all of them have to work together. Solve a level on your first run for three stars, then see how long you can last in Panic mode, where the toys never stop and the machines start to misbehave.

**How to play:**
- Tap a machine with a badge to change it: belts flip, bouncers turn, timers change when their pusher fires.
- Press RUN to drop the toys. One wrong toy stops the run and gives you your setup back to try again.
- Blue toys go in the blue bin, pink in the pink bin, yellow in the yellow bin.
- Keyboard: number keys tap the machines left to right, Space runs.

**Orientation:** Portrait on mobile. Desktop shows the same portrait play field in the centre of the window.

**Thumbnail:** `output/poki/tiny-factory-panic-thumbnail.png`. The prompt and the size rules it was checked against are recorded in `output/poki/thumbnail-prompt.md`.

## What the game does with the Poki SDK

The calls below are the ones in Poki's HTML5 guide (https://developers.poki.com/guide/sdk-html5). They are made only in a build created with `VITE_PLATFORM=poki`.

| SDK call | When the game makes it |
| --- | --- |
| `PokiSDK.init()` | At boot. If it fails or takes more than 2.5 s the game starts anyway. |
| `PokiSDK.gameLoadingFinished()` | When the title screen is ready. |
| `PokiSDK.gameplayStart()` | When a level or a Panic run becomes active, and on resume from pause. |
| `PokiSDK.gameplayStop()` | On pause, on a win, on a failure, and when leaving a level. |
| `PokiSDK.commercialBreak()` | After a level is won, just before the wipe to the next level, and from the Panic game-over screen when the player moves on. Never while toys are moving. |
| `PokiSDK.rewardedBreak()` | Implemented in the adapter, not used by the game. |

Audio is muted and keyboard input is ignored for the length of a commercial break, and both are restored afterwards even if the SDK never calls back. Arrow keys, Space and the mouse wheel do not scroll the page.

## Before submitting

- [x] Build with the Poki adapter and zip it. Done for v1.9.1: `output/poki/tiny-factory-panic-poki-v1.9.1.zip` (`index.html` at the root of the zip, about 350 kB). It was checked to boot to the title screen and into level 1 on an emulated phone, with the Poki SDK loading.
- [ ] To rebuild after a change: bump `version` in `package.json` and the label in `MenuScene.ts`, run `$env:VITE_PLATFORM = 'poki'; npm run build` (PowerShell) or `VITE_PLATFORM=poki npm run build` (bash), check it with `node scripts/boot-check.mjs`, then zip the contents of `dist/` (not the folder itself) under a new versioned name.
- [ ] Load that build in Poki's inspector (https://inspector.poki.dev) and confirm the SDK events appear in the order in the table above.
- [ ] Play the whole game on a real phone held upright. This has only been done in a desktop browser's phone emulation so far.
- [ ] Listen to the sound and music. Nobody has yet.
- [ ] Check play time. One winning run of each of the 30 levels is 218 s of toys moving; real play time depends on thinking and retries and has not been measured. The owner's earlier submission needed roughly 9 minutes of average play to pass Poki's fit test; that figure is from experience, not from Poki's documentation, and average play time across real players is not known for this game.
- [ ] Re-read Poki's current requirements for game size, thumbnail and mobile support. They were not all checked while building this.

## Known gaps to mention or fix first

- No landscape mode on mobile: a phone held sideways is asked to turn upright.
- `output/poki/` also still holds the v1.5.0 zip, which predates the bottom buttons, safe-area handling and the gentler level set. The v1.6.0 to v1.6.4 zips are also kept for reference. Submit the newest one.
- The JavaScript bundle is about 1.3 MB (350 kB gzipped), nearly all of it Phaser.
