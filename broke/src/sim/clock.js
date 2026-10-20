// Difficulty clock: elapsed run time -> coefficient, tier label, enemy level, price scale, time of day.

import { TIERS } from '../core/config.js';

export class Clock {
  constructor(startMinutes = 0) {
    this.time = startMinutes * 60; // seconds of run time (pauses don't count)
    this.update(0);
  }
  update(dt) {
    this.time += dt;
    const m = this.time / 60;
    this.minutes = m;
    this.coeff = 1 + 0.12 * m;
    let t = 0;
    for (let i = 0; i < TIERS.length; i++) if (m >= TIERS[i].at) t = i;
    if (this.tier !== undefined && t > this.tier) this.tierChanged = true;
    this.tier = t;
    this.label = TIERS[t].name;
    this.level = Math.max(1, Math.floor(1 + (this.coeff - 1) * 3.2));
  }
  priceMul() { return this.coeff; }
}
