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

export function zoneKeyOf(city, b) {
  const mc = { x: city.layout.sizeX / 2, z: city.layout.sizeZ / 2 };
  const core = Math.hypot(b.center.x - mc.x, b.center.z - mc.z) < city.layout.size * 0.24;
  return core && b.zone === 'commercial' ? 'core' : b.zone;
}

export function lotBuildings(kit, city, b, raster) {
  const { rng } = kit;
  const key = zoneKeyOf(city, b);
  const towerH = city.district.buildings.core.towerHeight;
  const KP = city.kitPending;
  for (const [i, j] of b.cells) {
    const c = city.layout.cellAt(i, j), r = c.rect;
    const len = (s) => (s === 'n' || s === 's' ? r.x1 - r.x0 : r.z1 - r.z0);
    const open = (s) => city.sideOpen(c, s);
    const opp = { n: 's', s: 'n', e: 'w', w: 'e' };
    // Deepest a lot on side s may go: to the middle of the cell when the far side has lots too.
    const maxDepth = (s) => Math.floor(open(opp[s]) ? len(NEXT[s]) / 2 : len(NEXT[s]) - 1.5);
    const used = new Map();
    const free = (q) => raster.test(q, R.BLOCK, AVOID);
    const pick = (maxFront, maxD, corner) => {
      const opts = CATALOGUE.filter((a) => (a.zones[key] || 0) > 0 && a.front[0] <= maxFront + 0.01 && a.depth[0] <= maxD + 0.01
        && (corner ? a.corner !== 0 : !a.cornerOnly) && (!a.perCell || (used.get(a.id) || 0) < a.perCell));
      if (!opts.length) return null;
      const w = opts.map((a) => a.zones[key] * (corner ? (a.cornerOnly ? 1 : a.corner ?? 1) : 1));
      let x = rng.range(0, w.reduce((p, q) => p + q, 0));
      for (let k = 0; k < opts.length; k++) { x -= w[k]; if (x <= 0) return opts[k]; }
      return opts[opts.length - 1];
    };
    const place = (a, q, front, corner) => {
      const mb = a.build(q, front, rng, { corner, zone: key, towerH });
      mergeKitData(KP, mb.D);
      city.kitCuts.push(...mb.cuts.map((x) => ({ ...x, cell: c })));
      raster.mark(q, R.BUILT);
      used.set(a.id, (used.get(a.id) || 0) + 1);
      (city.buildings ||= []).push({ rect: q, h: a.h, block: b.id, side: front, asset: a.id });
      (city.lots ||= []).push({ rect: q, asset: a.id, front, block: b.id, corner: corner || null });
    };

    // ---- corners ----
    for (const s of ['n', 'e', 's', 'w']) {
      const t = NEXT[s];
      if (!open(s) || !open(t)) continue;
      for (let tries = 0; tries < 4; tries++) {
        const front = rng.chance(len(s) >= len(t) ? 0.6 : 0.4) ? s : t, other = front === s ? t : s;
        const a = pick(Math.min(maxDepth(other), len(front) / 2), maxDepth(front), true);
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
        const a = pick(e, md, false);
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
