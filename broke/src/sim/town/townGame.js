// The mayor game: you walk Palmetto Bay (the map baked from a seed, src/maps) and run it from City Hall. It reuses
// the turf game's sim (commands, movement, combat feel); the city's books and neighbourhoods live in sim/mayor.
import { TurfGame } from '../turf/turfGame.js';
import { Mayor } from '../mayor/mayor.js';
import { DT } from '../../core/config.js';

export class TownGame extends TurfGame {
  constructor({ city, survivor }) {
    super({ seed: city.baked?.seed ?? 'town', district: city.district, survivor, city });
    this.variant = 'town';
    this.town = city.town;
    // You are the mayor: the city's books, its neighbourhoods and its shops (sim/mayor).
    this.mayor = new Mayor(this.city, city.baked?.seed ?? 'town', (x, z) => this.blockAt(x, z));
  }

  step(input = null, dt = DT) {
    super.step(input, dt);
    // The week only runs in play (not behind the title screen): main sets mayorLive when a run starts.
    const r = this.mayorLive && this.state === 'playing' ? this.mayor.update(dt) : null;
    if (r) this.events.emit('mayorWeek', r);
  }

  // HUD line: the neighbourhood and the nearest town place.
  objective() {
    const P = this.player.pos, b = this.blockAt(P.x, P.z);
    let best = null, bd = 60 * 60;
    for (const p of this.town?.places || []) { const d = (p.x - P.x) ** 2 + (p.z - P.z) ** 2; if (d < bd) { bd = d; best = p; } }
    return `${b?.hood ?? this.town?.name ?? ''}${best ? ` · ${best.name}` : ''}`;
  }
}
