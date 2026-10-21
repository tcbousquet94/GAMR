// The hero scene's simulation: the kept player movement and physics on the hand-made street from hero/layout.js.
// No turf, waves or exit; it exists to walk the look-development street.

import { DT } from '../../core/config.js';
import { Game, EMPTY_INPUT } from '../game.js';
import { heroCity } from '../../hero/layout.js';
import { DOWNTOWN } from '../../city/turf/districts/downtown.js';

export class HeroGame extends Game {
  constructor({ survivor }) {
    super({ seed: 'hero', district: DOWNTOWN, survivor, city: heroCity() });
    this.mode = 'hero';
    this.director.enabled = false;
  }

  step(input = EMPTY_INPUT, dt = DT) {
    this.time += dt;
    if (this.state === 'playing') this.player.update(dt, input || EMPTY_INPUT);
    this.projectiles.update(dt);
    this.pickups.update(dt);
  }
}
