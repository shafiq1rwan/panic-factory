# Changelog

How the game got to its current design, newest first. The version shown in the corner of the title screen is in brackets where one was set.

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
