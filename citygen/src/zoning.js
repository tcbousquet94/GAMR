// Zoning: landmarks first (whole blocks, or a footprint on a block), then industry against chosen edges, then every
// other block by its distance from the centre: a commercial core thinning out to residential suburbs.
//
// Block zones (the default zoneOf): core, commercial, inner (residential close in), residential, industrial, plus
// whatever zones the landmarks name. A lot's zone also depends on its street (frontageZone): anything on an avenue
// is 'mainstreet' (core and industrial stay themselves), and a commercial block's local streets are 'inner'.

import { sideRect, sideLength, center, FRONT_YAW, SIDES } from './geom.js';
import { R } from './raster.js';

export function defaultZoneOf(block, z) {
  if (block.d < z.commercial) return block.d < z.core ? 'core' : 'commercial';
  return block.d < z.inner ? 'inner' : 'residential';
}

export function frontageZone(blockZone, streetKind) {
  if (streetKind === 'avenue') return blockZone === 'core' || blockZone === 'industrial' ? blockZone : 'mainstreet';
  if (streetKind === 'local' && blockZone === 'commercial') return 'inner';
  return blockZone;
}

const RANK = { avenue: 3, street: 2, local: 1 };
const WHERE = {
  center: (bs) => [...bs].sort((a, b) => a.d - b.d),
  ring: (bs, rng) => rng.shuffle(bs.filter((b) => b.d > 0.45 && b.d < 0.95)).sort((a, b) => Math.abs(a.d - 0.7) - Math.abs(b.d - 0.7)),
  edge: (bs, rng) => rng.shuffle(bs.filter((b) => b.edges.length)),
  any: (bs, rng) => rng.shuffle([...bs]),
};

export function zone(plan, cfg, rng, raster) {
  const Z = cfg.zoning, blocks = plan.blocks;
  const cellW = (cfg.grid.cell[0] + cfg.grid.cell[1]) / 2 + cfg.streets.width.street;
  // ---- landmarks ----
  for (const L of cfg.landmarks) {
    const n = Array.isArray(L.count) ? rng.int(L.count[0], L.count[1]) : L.count ?? 1;
    const order = (WHERE[L.where] || WHERE.any)(blocks.filter((b) => !b.zone), rng);
    const mine = [];
    for (const b of order) {
      if (mine.length >= n) break;
      // Two of the same landmark never side by side.
      if (mine.some((m) => Math.hypot(m.center.x - b.center.x, m.center.z - b.center.z) < cellW * 1.6)) continue;
      if (L.footprint && !placeFootprint(plan, L, b, rng, raster)) continue;
      b.zone = L.zone ?? L.id;
      b.landmark = L.id;
      mine.push(b);
    }
  }
  // ---- industry against chosen edges ----
  const I = Z.industry;
  if (I) for (const b of blocks) if (!b.zone && b.d >= (I.beyond ?? 0.6) && b.edges.some((s) => I.sides.includes(s)) && rng.chance(I.chance ?? 0.3)) b.zone = 'industrial';
  // ---- the rest ----
  for (const b of blocks) if (!b.zone) b.zone = (Z.zoneOf && Z.zoneOf(b, Z, rng)) || defaultZoneOf(b, Z);
}

// A landmark building on part of a block: facing the block's most important street, set back behind a forecourt
// that stays clear; the rest of the block is filled with lots as usual.
function placeFootprint(plan, L, b, rng, raster) {
  const sides = rng.shuffle([...SIDES]).sort((p, q) => RANK[b.streets[q]] - RANK[b.streets[p]]);
  const [fw, fd] = L.footprint.map(Math.round), sb = Math.round(L.setback ?? 6);
  for (const front of sides) {
    const len = sideLength(b.rect, front), deep = sideLength(b.rect, front === 'n' || front === 's' ? 'e' : 'n');
    if (fw > len - 4 || sb + fd > deep - 4) continue;
    const u0 = Math.round((len - fw) / 2);
    const reserve = sideRect(b.rect, front, u0 - 2, u0 + fw + 2, 0, sb + fd + 2);
    if (!raster.test(reserve, R.BLOCK, R.RESERVED | R.BUILT)) continue;
    raster.mark(reserve, R.RESERVED);
    const rect = sideRect(b.rect, front, u0, u0 + fw, sb, sb + fd);
    plan.landmarks.push({ id: L.id, block: b.id, rect, reserved: reserve, front, yaw: FRONT_YAW[front], center: center(rect), width: fw, depth: fd });
    return true;
  }
  return false;
}
