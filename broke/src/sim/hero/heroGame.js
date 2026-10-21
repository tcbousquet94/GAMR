// The "h" test neighbourhood's simulation: the kept player movement and physics on the fixed module neighbourhood
// (city/kitdata/hood.js). No turf, waves or exit; it exists to walk and compare the remastered look.

import { DT } from '../../core/config.js';
import { Game, EMPTY_INPUT } from '../game.js';
import { hoodCity } from '../../city/kitdata/hood.js';
import { DOWNTOWN } from '../../city/turf/districts/downtown.js';

export class HeroGame extends Game {
  constructor({ survivor }) {
    super({ seed: 'hero', district: DOWNTOWN, survivor, city: hoodCity() });
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
