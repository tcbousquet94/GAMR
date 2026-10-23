// Lot subdivision: fills every street frontage of a block with lots, each sized for one catalogue asset.
//
// Per block: an optional rear service alley first, then the corners (where two streets meet), then each side walked
// from end to end, cutting lots side by side so the street wall is continuous. Lot sizes are whole metres (as is the
// raster), so lots tile exactly and never overlap. A lot's width comes from the chosen asset's frontage range and its
// depth from the asset's depth range, capped so lots on opposite sides of the block meet in the middle (or at the
// alley) instead of overlapping. Ground already taken (landmarks, alleys) is respected through the raster.

import { R } from './raster.js';
import { sideRect, sideLength, center, FRONT_YAW, NEXT, OPPOSITE, NORMAL } from './geom.js';
import { frontageZone } from './zoning.js';

const AVOID = R.RESERVED | R.BUILT | R.STREET;

export function fillBlock(plan, b, cfg, rng, raster) {
  const r = b.rect, cat = cfg.catalogue, A = cfg.alleys;
  const len = (s) => sideLength(r, s);
  const zoneOf = (s) => (cfg.frontage || frontageZone)(b.zone, b.streets[s]);
  const free = (q) => raster.test(q, R.BLOCK, AVOID);
  const minFront = Math.min(...cat.map((a) => a.front[0])), maxRun = Math.max(...cat.map((a) => a.front[1])) + 4;

  // A rear service alley between two opposite sides whose lots back onto it.
  let alley = null;
  if (A && A.zones.includes(b.zone) && rng.chance(A.chance)) {
    const W = r.x1 - r.x0, D = r.z1 - r.z0, ns = D >= A.minDepth, ew = W >= A.minDepth;
    if (ns || ew) {
      const axis = ns && (!ew || W >= D) ? 'x' : 'z'; // runs along x between the north and south lots, or along z
      const mid = Math.round(axis === 'x' ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2);
      const q = axis === 'x' ? { x0: r.x0, x1: r.x1, z0: mid - A.width / 2, z1: mid + A.width / 2 } : { z0: r.z0, z1: r.z1, x0: mid - A.width / 2, x1: mid + A.width / 2 };
      if (free(q)) { raster.mark(q, R.RESERVED); alley = { axis, rect: q, block: b.id, width: A.width }; plan.alleys.push(alley); }
    }
  }
  const backsOnAlley = (s) => alley && (alley.axis === 'x' ? s === 'n' || s === 's' : s === 'e' || s === 'w');
  const maxDepth = (s) => Math.floor(backsOnAlley(s) ? (len(NEXT[s]) - A.width) / 2 : len(NEXT[s]) / 2);

  // Variety: never an asset within its spacing of another of its kind, at most perBlock of one asset per block, and
  // the same asset as the lot just placed on this side is much less likely (identical neighbours read as copy-paste).
  const used = new Map();
  const spaced = (a, near) => !a.spacing || plan.lots.every((l) => l.asset !== a.id || Math.hypot(l.center.x - near.x, l.center.z - near.z) > a.spacing);
  let last = null;
  const pick = (zone, maxFront, maxD, corner, near) => {
    const opts = cat.filter((a) => (a.zones[zone] || 0) > 0 && a.front[0] <= maxFront && a.depth[0] <= maxD
      && (corner ? a.corner !== 0 : !a.cornerOnly) && (!a.perBlock || (used.get(a.id) || 0) < a.perBlock) && spaced(a, near));
    if (!opts.length) return null;
    return rng.weighted(opts.map((a) => ({ v: a, w: a.zones[zone] * (corner ? (a.cornerOnly ? 1 : a.corner ?? 1) : 1) * (a.id === last ? cfg.repeatPenalty : 1) })));
  };
  const place = (a, rect, front, cornerSide) => {
    raster.mark(rect, R.BUILT);
    used.set(a.id, (used.get(a.id) || 0) + 1);
    last = a.id;
    const yaw = FRONT_YAW[front], lx = [Math.cos(yaw), -Math.sin(yaw)];
    const corner = cornerSide ? { side: cornerSide, street: b.streets[cornerSide], localX: Math.sign(NORMAL[cornerSide][0] * lx[0] + NORMAL[cornerSide][1] * lx[1]) } : null;
    plan.lots.push({ id: plan.lots.length, block: b.id, asset: a.id, zone: zoneOf(front), front, street: b.streets[front], streetId: b.streetIds[front], yaw, rect, center: center(rect), width: sideLength(rect, front), depth: sideLength(rect, NEXT[front]), corner, alley: alley && backsOnAlley(front) ? plan.alleys.indexOf(alley) : null });
  };

  // ---- corners ----
  for (const s of ['n', 'e', 's', 'w']) {
    const t = NEXT[s];
    for (let tries = 0; tries < 4; tries++) {
      // A corner faces its avenue if it has one, else usually the longer street.
      const av = b.streets[s] === 'avenue' ? s : b.streets[t] === 'avenue' ? t : null;
      const front = av && rng.chance(0.85) ? av : rng.chance(len(s) >= len(t) ? 0.6 : 0.4) ? s : t, other = front === s ? t : s;
      const probe = front === s ? sideRect(r, s, len(s) - 12, len(s), 0, 12) : sideRect(r, t, 0, 12, 0, 12);
      const a = pick(zoneOf(front), Math.min(maxDepth(other), len(front) / 2), maxDepth(front), true, center(probe));
      if (!a) break;
      const f = Math.min(Math.round(rng.range(a.front[0], a.front[1])), maxDepth(other)), d = Math.min(Math.round(rng.range(a.depth[0], a.depth[1])), maxDepth(front));
      // The corner lot sits at the end of side s, which is the start of side t.
      const q = front === s ? sideRect(r, s, len(s) - f, len(s), 0, d) : sideRect(r, t, 0, f, 0, d);
      if (!free(q)) continue;
      place(a, q, front, other);
      break;
    }
  }

  // ---- frontage ----
  for (const s of ['n', 'e', 's', 'w']) {
    const L = len(s), md = maxDepth(s);
    let u = 0;
    last = null;
    while (u < L - minFront) {
      // Skip ground that is taken (corner lots, landmarks, alleys).
      if (!free(sideRect(r, s, u, u + 1, 0, 3))) { u += 1; continue; }
      let e = 1;
      while (u + e < L && e < maxRun && free(sideRect(r, s, u + e, u + e + 1, 0, 3))) e++;
      if (e < minFront) { u += e; continue; }
      const a = pick(zoneOf(s), e, md, false, center(sideRect(r, s, u, u + Math.min(e, 14), 0, 10)));
      if (!a) { u += e; continue; }
      let f = Math.min(Math.round(rng.range(a.front[0], a.front[1])), e);
      if (e - f < minFront && e - f > 0 && e <= a.front[1] + minFront) f = e; // absorb a leftover too small for another lot
      let d = Math.min(Math.round(rng.range(a.depth[0], a.depth[1])), md), q = sideRect(r, s, u, u + f, 0, d);
      while (!free(q) && d > a.depth[0]) { d -= 1; q = sideRect(r, s, u, u + f, 0, d); }
      if (!free(q)) { u += 2; continue; }
      place(a, q, s, null);
      u += f;
    }
  }
}
