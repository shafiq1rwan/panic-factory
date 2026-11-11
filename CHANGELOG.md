# Changelog

How the game got to its current design, newest first. The version shown in the corner of the title screen is in brackets where one was set.

## New shapes and a room per chapter (v1.8.0)

After the owner played v1.7.0 and asked for new levels with a different background and different shapes.

- Chapter 4, "New Shapes", four levels that bring in new toys one at a time:
  - **Hex Nuts:** the green hexagon, sorted with two belts into four bins.
  - **Heavy Load:** heavy toys (darker, a little bigger, with rivets). A bouncer throws them only about half as far, so one bouncer angle sends pink to the right bin and heavy blue to the middle.
  - **Boing:** bouncy toys (white ring). They fly further than plain ones off the same bouncer.
  - **Night Shift:** timer and bouncer with green hexagons and heavy blues across four bins; 1 of 12 setups wins.
- Each chapter is played in its own room: mint wall sheets (Belts), warm wooden planks (Bouncers), cool blue tiles (Timers), lavender bricks (New Shapes). The title screen, level select and Panic mode keep the mint workshop.
- The level-select chapter label for New Shapes is lavender to match its room.
- All 16 levels pass the solver; every run still ends within 11 s.

## Set up, then run (v1.7.0)

The live one-button version kept players under a minute in playtests and the first fit test result was weak, so the owner asked to go back to setting up the factory before pressing RUN, as in the first design, without the problems that sank it then (too many controls, levels too hard).

- One gesture: tap a machine wearing a badge to change it. A belt flips, a bouncer turns to its next angle, a timer moves its pusher on one step. No dragging, no toolbars.
- RUN drops the toys; nothing can be changed while they move; STOP ends a run early. One wrong toy stops the run, says which toy went in which bin, and hands the setup back exactly as it was. Retries are free; stars count runs (first run 3, up to three runs 2).
- 12 new levels in three chapters, one new kind of machine at a time: belts, then bouncers, then timers, then combinations. A brute-force solver (`sim/planSolver.ts`) tries every setup of every level: the starting setup always fails, each solution wins and survives random spawn offsets, the harder levels are won by only 1 of 8, 12 or 32 setups, and every run ends within 11 s.
- New bottom HUD: the stars still on offer, a status line, and one big RUN / STOP button the full width of the screen. A tap on empty space flashes the badges.
- Panic mode is unchanged and keeps the live belt buttons.
- Level design tools: `scripts/plan-lab.ts`, `plan-trace.ts`, `plan-watch.ts`.
- Fixed "Framebuffer status: Incomplete Attachment": in a very wide, short window (a desktop browser with the inspector docked at the bottom) the canvas grew to over 12,000 px, past the GPU texture limit. The visible area now stops at 2,560 logical px on each axis and the render size at 4,096 px per side; beyond that the page shows plain margins. The canvas was also being centred twice (by the page and by Phaser), which only showed once it no longer filled the window.

## Toys announce themselves (v1.6.5)

Changes after playtesters were left waiting and wondering when the first toy suddenly dropped in level 1.

- In every level the next toy slides out of the pipe mouth about 0.6 s before it drops, so drops never come out of nowhere.
- Level 1: the first toy appears after 1.5 s instead of 3.4 s and waits at the pipe, wiggling, until the player presses the button (or 7 s pass, so doing nothing still fails). It drops a moment after the press, so the player sees the belt turn first.
- Poki analytics: level start / complete / fail and Panic start / end are sent with `PokiSDK.measure`, so test results show where players stop.
- Poki build zipped: `output/poki/tiny-factory-panic-poki-v1.6.5.zip`.

## Clearer belt buttons (v1.6.4)

Changes after playtesters did not realise the buttons flip the belts, and some tried to drag the springs.

- Belt buttons read "⇄ FLIP" (an action) instead of "RIGHT >>>" (which looked like a status). The ⇄ badge is the one the belt wears.
- Each belt's outline and ⇄ badge use the belt's accent colour, the same colour as its button.
- Tapping the play field anywhere but a belt bounces the buttons, points the hand at them and shows "TAP A BUTTON TO FLIP ITS BELT" for a moment. It never moves anything. Works in Panic mode too.
- The control strip uses the same 16 px side margin as the top bar; one belt gets a full-width button.
- Poki build zipped: `output/poki/tiny-factory-panic-poki-v1.6.4.zip`.

## Poki iframe fixes (v1.6.3)

- Inside an iframe (as on Poki) the browser always reports a camera inset of 0. On an upright touch screen in an iframe the game now assumes a 44 px camera area at the top, so the top bar no longer sits under the camera.
- Poki's mobile "Pill" button is moved with `PokiSDK.movePill` to just below each screen's top controls, so it no longer covers the pause button or the level-select back button.
- New `scripts/iframe-check.mjs` loads the build in a cross-origin iframe on an emulated phone and reports the inset and the pill call.
- Poki build zipped: `output/poki/tiny-factory-panic-poki-v1.6.3.zip`.

## Belt-style buttons (v1.6.2)

- Each belt button is drawn as a small copy of its belt: navy frame, the belt's colour on the face, cyan top strip, white rollers at both ends and white chevrons, with a darker lip it presses into. The dark console from v1.6.1 is replaced by the light workshop strip.
- The direction word ("LEFT" / "RIGHT") and its chevrons are centred together on the button, so the padding is even on both sides. The chevrons sit on the side the belt is moving towards.
- With one belt the button is 480 wide instead of nearly the full width.
- Poki build zipped: `output/poki/tiny-factory-panic-poki-v1.6.2.zip`.

## Control console, pause screen and desktop fix (v1.6.1)

- The bottom HUD is a dark control console: lives on the left, and each belt button labelled ("BELT 01", "Left"/"Right") with an arrow showing its direction. A jammed belt in Panic mode shows a lock.
- The pause screen is redesigned and centred in the safe area.
- The "turn your device upright" prompt now appears only on touch devices held sideways. A short desktop window, such as one with the browser's inspector docked at the bottom, plays normally.
- Poki build zipped: `output/poki/tiny-factory-panic-poki-v1.6.1.zip`.

## Buttons, safe area and a gentler level set (v1.6.0)

Changes after the owner play-tested v1.5.0 on a phone.

- Belts are flipped with big buttons in the control strip at the bottom of the screen: one button for one belt, two for two. Each button has its belt's colour and shows which way the belt is running. Tapping a belt still works.
- No level has more than two belts. The three-belt junction layout is gone; a new two-step layout sorts three colours with two belts.
- The HUD respects the device safe area, so the top bar no longer sits under the camera cut-out and the buttons stay above the home indicator.
- All 20 levels redesigned for a slow, steady ramp: 3 toys rising to 12, never less than 2.5 s between toys on one belt. The earlier set jumped in speed after level 5.
- The pusher is back as fixed scenery: toys land on a ledge and are shoved into the bin.
- Posts between the bins in the two-belt layouts, so a toy cannot sail past its bin.
- Panic Factory now uses two belts, two chutes and the same two buttons.
- Levels are verified with reaction delays up to half a second.
- Poki build zipped: `output/poki/tiny-factory-panic-poki-v1.6.0.zip`.

## Varied layouts (v1.5.0)

- First Poki build zipped: `output/poki/tiny-factory-panic-poki-v1.5.0.zip`.
- Six level layouts instead of one repeated: springs, ramps, cross-over springs, pinball bumpers, twin belts and the three-belt junction.
- Springs, ramps and bumpers are fixed scenery. They add bouncing and sliding without adding anything to learn.
- The chute pipe reaches further into the play field.

## One mechanic: tap a belt to flip it (v1.5)

- All levels rebuilt as sorting levels with a single verb. Nothing is dragged, rotated or timed.
- 20 levels in 5 chapters. Difficulty comes from longer, faster toy sequences.
- Levels start by themselves; the RUN button is gone. Belts can be flipped while toys are moving.
- A level is won when every toy is in a bin within the allowed slips. Stars are rated on accuracy alone.
- Bins span the whole floor, so a toy can never fall out of play.
- A route-following bot verifies every level, including with 200 ms and 300 ms reaction delays.
- Panic Factory unlocks after 5 levels instead of 6.

## Portrait layout (v1.4)

- The logical screen became 720 x 1280: top bar, play field, bottom strip.
- Larger HUD. A big RUN button moved to the bottom strip (later removed with the one-mechanic redesign).
- All levels, the Panic arena, the title screen, level select and the dialogs re-laid out.
- Phones held sideways get a turn-upright prompt. There is no landscape mode on mobile.

## Straight into play (v1.3)

- Title screen reduced to one PLAY button that starts the next unfinished level, plus small Levels, Panic and Settings buttons.
- No result dialogs for levels: a short star card, then a curtain wipe to the next level. A failure shows the reason and restarts.
- New always-on transition scene for the curtain wipe.

## Workshop look

- Light workshop wall, redesigned top bar and panel-style buttons. This restyle was made outside the sessions that wrote the rest of this file.

## Bold flat art

- Saturated flat colours, no outlines, googly-eyed toys, orange springs and bumpers, dark belts with a bright carrying strip.

## Fill the window, bigger everything (v1.2)

- The canvas fills the window at any shape instead of letterboxing.
- Toys and machines about 75% larger than the first version; thicker belts with large arrows.
- Faces removed from bins, pipes and pistons; the icon removed from bins.
- Levels re-laid out for the larger parts.

## First playable

- Physics puzzle with conveyors, springs, pistons, funnels and bins: arrange machines, press RUN, watch.
- 15 levels with verified solutions, three-star ratings, tutorials, Panic Factory endless mode.
- Procedural art and audio, LocalStorage save, platform adapter layer, headless tests, browser smoke test, GitHub Pages workflow.
