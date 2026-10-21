// The superhero / town-management game (first pass): the hero walks Palmetto Bay, the handcrafted map baked from a
// seed (src/maps). It reuses the turf game's sim (commands, movement, combat feel); town systems come next.
import { TurfGame } from '../turf/turfGame.js';

export class TownGame extends TurfGame {
  constructor({ city, survivor }) {
    super({ seed: city.baked?.seed ?? 'town', district: city.district, survivor, city });
    this.variant = 'town';
    this.town = city.town;
  }

  // HUD line: the neighbourhood and the nearest town place.
  objective() {
    const P = this.player.pos, b = this.blockAt(P.x, P.z);
    let best = null, bd = 60 * 60;
    for (const p of this.town?.places || []) { const d = (p.x - P.x) ** 2 + (p.z - P.z) ** 2; if (d < bd) { bd = d; best = p; } }
    return `${b?.hood ?? this.town?.name ?? ''}${best ? ` · ${best.name}` : ''}`;
  }
}
