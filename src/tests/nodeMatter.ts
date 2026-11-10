import { createRequire } from 'node:module';
import { provideMatter } from '../game/physics/MatterLib';

/** Load the exact Matter.js build bundled inside Phaser, without loading Phaser (no DOM needed). */
const require = createRequire(import.meta.url);
provideMatter(require('phaser/src/physics/matter-js/CustomMain.js'));
