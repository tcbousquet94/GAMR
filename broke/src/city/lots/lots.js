// Lot subdivision: fills every street frontage of a block with lots, each built from one catalogue asset sized to it.
//
// Per cell: corners first (where two streets meet), then each open side walked from end to end, cutting lots back to
// back so the street wall is continuous. Lot sizes are whole metres, matching the 1 m occupancy raster (cells are
// whole metres too), so lots tile exactly and never overlap. A lot's width comes from the chosen asset's frontage range, its depth from the
// asset's depth range, capped so lots on opposite sides of the cell meet in the middle instead of overlapping. Anything
// already on the block (businesses, warehouse compounds, garages, modules) is respected through the raster.

import { R } from '../turf/raster.js';
import { sideRect } from '../turf/fill.js';
import { mergeKitData } from '../kitdata/data.js';
import { CATALOGUE } from './catalogue.js';

const AVOID = R.DIAG | R.RESERVED | R.BUILT | R.STREET;
const NEXT = { n: 'e', e: 's', s: 'w', w: 'n' }; // clockwise: the corner at the end of a side starts the next side
const ALLEY_W = 6;

function serviceAlley(c, r, open, free, rng, raster, KP, city) {
  const W = r.x1 - r.x0, Dz = r.z1 - r.z0;
  const ns = open('n') && open('s') && Dz >= 46, ew = open('e') && open('w') && W >= 46;
  if (!(ns || ew) || !rng.chance(0.75)) return null;
  const axis = ns && (!ew || W >= Dz) ? 'x' : 'z'; // the alley runs along x between the n and s lots, or along z
  const mid = Math.round(axis === 'x' ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2);
  const q = axis === 'x' ? { x0: r.x0, x1: r.x1, z0: mid - ALLEY_W / 2, z1: mid + ALLEY_W / 2 } : { z0: r.z0, z1: r.z1, x0: mid - ALLEY_W / 2, x1: mid + ALLEY_W / 2 };
  if (!free(q)) return null;
  raster.mark(q, R.RESERVED);
  const CURB = 0.15, L = axis === 'x' ? W : Dz;
  const at = (t, o) => (axis === 'x' ? { x: r.x0 + t, z: mid + o } : { x: mid + o, z: r.z0 + t });
  KP.pads.push({ surf: 'concrete', poly: [[q.x0, q.z0], [q.x1, q.z0], [q.x1, q.z1], [q.x0, q.z1]], y0: CURB - 0.02, y1: CURB + 0.02, tint: 0xb4b0a8 });
  { const p = at(L / 2, 0); KP.paint.push({ ...p, w: 0.35, d: L, yaw: axis === 'x' ? Math.PI / 2 : 0, color: 0x6a6660, y: CURB + 0.022 }); } // centre drain
  for (let t = 7 + rng.range(0, 5); t < L - 7; t += rng.range(11, 16)) {
    const side = rng.chance(0.5) ? -1 : 1, p = at(t, side * (ALLEY_W / 2 - 0.75));
    KP.props.push({ type: 'dumpster', ...p, y: CURB, yaw: axis === 'x' ? 0 : Math.PI / 2, color: rng.pick([0x2e4a3a, 0x2a3a5a, 0x3a3a3c]) });
    if (rng.chance(0.4)) { const b = at(t + 2.2, side * (ALLEY_W / 2 - 0.5)); KP.bins.push({ ...b, y: CURB, c: rng.pick([0x2e4a32, 0x2a3a5a, 0x252528]) }); }
  }
  for (const t of [L * 0.3, L * 0.7]) { const p = at(t, ALLEY_W / 2 - 0.3); KP.lights.push({ ...p, y: CURB, yaw: axis === 'x' ? Math.PI : -Math.PI / 2 }); }
  // Kerbs drop where the alley meets its streets.
  const ends = axis === 'x' ? [['w', r.x0], ['e', r.x1]] : [['n', r.z0], ['s', r.z1]];
  for (const [side, v] of ends) if (open(side)) city.kitCuts.push(axis === 'x' ? { side, a: { x: v, z: q.z0 }, b: { x: v, z: q.z1 }, cell: c } : { side, a: { x: q.x0, z: v }, b: { x: q.x1, z: v }, cell: c });
  (city.alleys ||= []).push({ rect: q, axis });
  return { axis, mid };
}

// The block's own zone key: core (commercial in the downtown core), commercial, inner (residential close in: denser,
// more walk-ups), residential (the outer suburbs), industrial, civic.
export function zoneKeyOf(city, b) {
  const mc = { x: city.layout.sizeX / 2, z: city.layout.sizeZ / 2 };
  const d = Math.hypot(b.center.x - mc.x, b.center.z - mc.z);
  if (b.zone === 'commercial') return d < city.layout.size * 0.24 ? 'core' : 'commercial';
  if (b.zone === 'residential') return d < city.layout.size * 0.36 ? 'inner' : 'residential';
  return b.zone;
}
// What a frontage is used for depends on its street too: anything on an avenue is main street (shops, walk-ups and
// mid-rises; the core stays core), and a commercial block's narrow residential streets get houses and walk-ups.
export function frontageKey(blockKey, streetKind) {
  if (streetKind === 'avenue') return blockKey === 'core' || blockKey === 'industrial' ? blockKey : 'mainstreet';
  if (streetKind === 'local' && blockKey === 'commercial') return 'inner';
  return blockKey;
}

export function lotBuildings(kit, city, b, raster) {
  const { rng } = kit;
  const bkey = zoneKeyOf(city, b);
  const towerH = city.district.buildings.core.towerHeight;
  const KP = city.kitPending;
  for (const [i, j] of b.cells) {
    const c = city.layout.cellAt(i, j), r = c.rect;
    const len = (s) => (s === 'n' || s === 's' ? r.x1 - r.x0 : r.z1 - r.z0);
    const open = (s) => city.sideOpen(c, s);
    const kindOf = (s) => city.sideKind?.(c, s) ?? 'street';
    const keyOf = (s) => frontageKey(bkey, kindOf(s));
    const opp = { n: 's', s: 'n', e: 'w', w: 'e' };
    const used = new Map();
    const free = (q) => raster.test(q, R.BLOCK, AVOID);
    // A rear service alley through the middle of commercial and downtown cells, between the two opposite street sides
    // whose lots back onto it, open at both ends: deliveries, dumpsters, and a shortcut through the block.
    const alley = bkey === 'commercial' || bkey === 'core' || bkey === 'civic' ? serviceAlley(c, r, open, free, rng, raster, KP, city) : null;
    // Deepest a lot on side s may go: to the middle of the cell when the far side has lots too (to the alley's edge
    // when an alley runs between them).
    const backsOnAlley = (s) => alley && (alley.axis === 'x' ? s === 'n' || s === 's' : s === 'e' || s === 'w');
    const maxDepth = (s) => Math.floor(backsOnAlley(s) ? (len(NEXT[s]) - ALLEY_W) / 2 : open(opp[s]) ? len(NEXT[s]) / 2 : len(NEXT[s]) - 1.5);
    const pick = (key, maxFront, maxD, corner) => {
      const opts = CATALOGUE.filter((a) => (a.zones[key] || 0) > 0 && a.front[0] <= maxFront + 0.01 && a.depth[0] <= maxD + 0.01
        && (corner ? a.corner !== 0 : !a.cornerOnly) && (!a.perCell || (used.get(a.id) || 0) < a.perCell));
      if (!opts.length) return null;
      const w = opts.map((a) => a.zones[key] * (corner ? (a.cornerOnly ? 1 : a.corner ?? 1) : 1));
      let x = rng.range(0, w.reduce((p, q) => p + q, 0));
      for (let k = 0; k < opts.length; k++) { x -= w[k]; if (x <= 0) return opts[k]; }
      return opts[opts.length - 1];
    };
    const place = (a, q, front, corner) => {
      const mb = a.build(q, front, rng, { corner, zone: keyOf(front), towerH });
      mergeKitData(KP, mb.D);
      city.kitCuts.push(...mb.cuts.map((x) => ({ ...x, cell: c })));
      raster.mark(q, R.BUILT);
      used.set(a.id, (used.get(a.id) || 0) + 1);
      (city.buildings ||= []).push({ rect: q, h: a.h, block: b.id, side: front, asset: a.id });
      (city.lots ||= []).push({ rect: q, asset: a.id, front, block: b.id, corner: corner || null, street: kindOf(front), use: keyOf(front) });
    };

    // ---- corners ----
    for (const s of ['n', 'e', 's', 'w']) {
      const t = NEXT[s];
      if (!open(s) || !open(t)) continue;
      for (let tries = 0; tries < 4; tries++) {
        // A corner faces its avenue if it has one (a main-street corner), else usually the longer street.
        const av = kindOf(s) === 'avenue' ? s : kindOf(t) === 'avenue' ? t : null;
        const front = av && rng.chance(0.85) ? av : rng.chance(len(s) >= len(t) ? 0.6 : 0.4) ? s : t, other = front === s ? t : s;
        const a = pick(keyOf(front), Math.min(maxDepth(other), len(front) / 2), maxDepth(front), true);
        if (!a) break;
        const f = Math.min(Math.round(rng.range(a.front[0], a.front[1])), maxDepth(other)), d = Math.min(Math.round(rng.range(a.depth[0], a.depth[1])), maxDepth(front));
        // The corner sits at the end of side s (frame left) or the start of side t (frame right).
        const q = front === s ? sideRect(r, s, len(s) - f, len(s), 0, d) : sideRect(r, t, 0, f, 0, d);
        if (!free(q)) continue;
        place(a, q, front, front === s ? 'left' : 'right');
        break;
      }
    }

    // ---- frontage ----
    for (const s of ['n', 'e', 's', 'w']) {
      if (!open(s)) continue;
      const L = len(s), md = maxDepth(s);
      let u = 0;
      while (u < L - 9) {
        // Skip ground that is taken (corner lots, businesses, compounds).
        if (!free(sideRect(r, s, u, u + 1, 0, 3))) { u += 1; continue; }
        let e = 1;
        while (u + e < L && e < 46 && free(sideRect(r, s, u + e, u + e + 1, 0, 3))) e++;
        if (e < 9) { u += e; continue; }
        const a = pick(keyOf(s), e, md, false);
        if (!a) { u += e; continue; }
        let f = Math.min(Math.round(rng.range(a.front[0], a.front[1])), e);
        if (e - f < a.front[0] * 0.7 && e - f > 0 && e <= a.front[1] + 5) f = e; // absorb a leftover too small for another lot
        let d = Math.min(Math.round(rng.range(a.depth[0], a.depth[1])), md);
        let q = sideRect(r, s, u, u + f, 0, d);
        while (!free(q) && d > a.depth[0]) { d -= 1; q = sideRect(r, s, u, u + f, 0, d); }
        if (!free(q)) { u += 2; continue; }
        place(a, q, s, null);
        u += f;
      }
    }
  }
}
