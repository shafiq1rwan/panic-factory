# Poki submission notes

Listing copy to paste into the submission form, and a checklist of what to do before submitting. Nothing here has been reviewed or approved by Poki.

## Listing copy

**Title:** Tiny Factory Panic

**Main category:** Puzzle

**Secondary tags:** Physics, Casual, Sorting

**One-line description:**
Flip the belts and get every toy into the bin of its own colour.

**Description:**
The toy factory is running and the toys are coming. Each one rides a conveyor belt and drops into a bin, and it is your job to make sure it is the right bin. Press the big button to flip the belt. That is the only thing you need to learn.

It starts with one belt and two bins. Then the springs arrive and fling toys clean across the room, the pushers shove them off their ledges, the bumpers send them pinballing, and two belts are feeding three bins at once. Sort every toy without a slip to earn three stars on each of the 20 levels, then see how long you can last in Panic mode, where the toys never stop and the machines start to misbehave.

**How to play:**
- Press the big button at the bottom to flip its belt. Two belts means two buttons, each in the colour of its belt.
- Blue toys go in the blue bin, pink in the pink bin, yellow in the yellow bin.
- A toy in the wrong bin costs a life.
- Keyboard: Space, A or Left for the first button; D or Right for the second.

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

- [x] Build with the Poki adapter and zip it. Done for v1.6.4: `output/poki/tiny-factory-panic-poki-v1.6.4.zip` (`index.html` at the root of the zip, about 350 kB). It was checked to boot to the title screen and into level 1 on an emulated phone, with the Poki SDK loading.
- [ ] To rebuild after a change: bump `version` in `package.json` and the label in `MenuScene.ts`, run `$env:VITE_PLATFORM = 'poki'; npm run build` (PowerShell) or `VITE_PLATFORM=poki npm run build` (bash), check it with `node scripts/boot-check.mjs`, then zip the contents of `dist/` (not the folder itself) under a new versioned name.
- [ ] Load that build in Poki's inspector (https://inspector.poki.dev) and confirm the SDK events appear in the order in the table above.
- [ ] Play the whole game on a real phone held upright. This has only been done in a desktop browser's phone emulation so far.
- [ ] Listen to the sound and music. Nobody has yet.
- [ ] Check play time. A flawless run of all 20 levels is about 8 minutes of play plus transitions, measured with a bot. The owner's earlier submission needed roughly 9 minutes of average play to pass Poki's fit test; that figure is from experience, not from Poki's documentation, and average play time across real players is not known for this game.
- [ ] Re-read Poki's current requirements for game size, thumbnail and mobile support. They were not all checked while building this.

## Known gaps to mention or fix first

- No landscape mode on mobile: a phone held sideways is asked to turn upright.
- `output/poki/` also still holds the v1.5.0 zip, which predates the bottom buttons, safe-area handling and the gentler level set. The v1.6.0 to v1.6.3 zips are also kept for reference. Submit the newest one.
- The JavaScript bundle is about 1.3 MB (350 kB gzipped), nearly all of it Phaser.
