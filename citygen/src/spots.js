// Street furniture spots: evenly spaced points along every sidewalk, for whatever the game puts there (street
// lights, trees, hydrants, benches, bus stops). Kept clear of the intersections. Each spot faces its street.
//
// sidewalkSpots(plan, { spacing = 24, kerb = 0.6, clear = 4, kinds = null, rng = null, jitter = 0 })
//   kerb: metres in from the kerb line (toward the block); clear: metres kept clear of each block corner;
//   kinds: only streets of these kinds; jitter: random +/- metres along the street (needs rng).

import { sideRect, sideLength, NORMAL, FRONT_YAW } from './geom.js';

export function sidewalkSpots(plan, { spacing = 24, kerb = 0.6, clear = 4, kinds = null, rng = null, jitter = 0 } = {}) {
  const out = [];
  for (const b of plan.blocks) for (const s of ['n', 'e', 's', 'w']) {
    if (kinds && !kinds.includes(b.streets[s])) continue;
    const L = sideLength(b.rect, s), n = Math.max(1, Math.floor((L - 2 * clear) / spacing)), step = (L - 2 * clear) / n;
    const off = plan.sidewalk - kerb; // distance out from the block edge
    for (let k = 0; k <= n; k++) {
      const u = clear + k * step + (rng && jitter ? rng.range(-jitter, jitter) : 0);
      const p = sideRect(b.rect, s, u, u, 0, 0);
      out.push({ x: p.x0 + NORMAL[s][0] * off, z: p.z0 + NORMAL[s][1] * off, yaw: FRONT_YAW[s], side: s, block: b.id, street: b.streets[s], streetId: b.streetIds[s] });
    }
  }
  return out;
}
