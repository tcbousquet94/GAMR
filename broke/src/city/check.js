// Per-city checks, run by the tests on generated cities (and usable from tools): can you walk from the spawn to every
// door, do any buildings overlap, and how big is the city (a budget so phones stay smooth).
//
// Reachability: a flood fill over a 0.25 m grid of the ground you can stand on, starting at the spawn. A step to a
// neighbour finds the ground under it (up to a step-up of PHYS.stepHeight above where you stand), and the body must
// fit there. Same rules as walking, without jumping or climbing.

import { PHYS } from '../core/config.js';
import { isHome, homeLayout, homeToWorld } from './kitdata/home.js';
import { isWalkIn, storeToWorld } from './kitdata/bodega.js';
import { houseYaw } from './kitdata/data.js';

// A 0.25 m grid and a body just inside the player's (0.4 m footprint): a 1.06 m doorway leaves 0.26 m of play, so a
// coarser grid could step right over the only spots where the body fits.
const G = 0.25, R = 0.38, H = 1.75;

export function walkable(world, start, bounds) {
  const nx = Math.ceil((bounds.x1 - bounds.x0) / G), nz = Math.ceil((bounds.z1 - bounds.z0) / G);
  const ys = new Float32Array(nx * nz).fill(NaN);
  const idx = (i, k) => k * nx + i;
  const si = Math.floor((start.x - bounds.x0) / G), sk = Math.floor((start.z - bounds.z0) / G);
  const sy = world.groundBelow(bounds.x0 + (si + 0.5) * G, start.y + 1, bounds.z0 + (sk + 0.5) * G, 0.05, 50);
  const q = [[si, sk]];
  ys[idx(si, sk)] = sy;
  while (q.length) {
    const [i, k] = q.pop(), y = ys[idx(i, k)];
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = k + dk;
      if (a < 0 || b < 0 || a >= nx || b >= nz || !Number.isNaN(ys[idx(a, b)])) continue;
      const x = bounds.x0 + (a + 0.5) * G, z = bounds.z0 + (b + 0.5) * G;
      const g = world.groundBelow(x, y + PHYS.stepHeight + 0.02, z, R + 0.005, 3); // the highest ground under the body (a hair wider than it), as stepping does
      if (!(g > y - 2.5) || !world.fits(x, g + 0.05, z, R, H)) continue;
      ys[idx(a, b)] = g;
      q.push([a, b]);
    }
  }
  return { ys, nx, nz, at: (x, z) => { const i = Math.floor((x - bounds.x0) / G), k = Math.floor((z - bounds.z0) / G); return i < 0 || k < 0 || i >= nx || k >= nz ? NaN : ys[idx(i, k)]; } };
}

// Points just inside every door a player should be able to walk through.
export function doors(city) {
  const out = [];
  for (const b of city.businesses || []) if (b.doorInside) out.push({ kind: `business:${b.type}`, name: b.name, x: b.doorInside.x, z: b.doorInside.z });
  const D = city.kitData;
  if (D) {
    for (const h of D.houses) if (isHome(h)) { const L = homeLayout(h), p = homeToWorld(h, L.doorX + 0.1, h.d / 2 - 1.0); out.push({ kind: 'home', x: p.x, z: p.z }); }
    for (const s of D.stores) if (isWalkIn(s)) { const p = storeToWorld(s, 0, s.d / 2 - 1.2); out.push({ kind: 'market', name: s.name, x: p.x, z: p.z }); }
  }
  return out;
}

// A door counts as reached when the walkable ground reaches within a metre of the point just inside it.
export function reachDoors(city, W) {
  const res = { total: 0, ok: 0, missing: [] };
  for (const d of doors(city)) {
    res.total++;
    let hit = false;
    for (let dx = -1; dx <= 1 && !hit; dx += 0.5) for (let dz = -1; dz <= 1 && !hit; dz += 0.5) if (!Number.isNaN(W.at(d.x + dx, d.z + dz))) hit = true;
    if (hit) res.ok++; else res.missing.push(d);
  }
  return res;
}

// Building footprints that overlap one another. Square-on buildings are compared as rectangles; an angled one (on a
// curving lane) as the circle that fits inside it, which is enough to catch one building standing in another.
export function overlaps(city) {
  const D = city.kitData, rects = [], circles = [];
  if (!D) return [];
  const add = (kind, o) => {
    const yaw = houseYaw(o), c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    if (Math.min(c, s) > 1e-3) { circles.push({ kind, x: o.x, z: o.z, r: Math.min(o.w, o.d) / 2 - 0.3, x0: o.x, z0: o.z }); return; }
    const hw = (c > 0.5 ? o.w : o.d) / 2 - 0.15, hd = (c > 0.5 ? o.d : o.w) / 2 - 0.15;
    rects.push({ kind, x0: o.x - hw, x1: o.x + hw, z0: o.z - hd, z1: o.z + hd });
  };
  for (const h of D.houses) add('house', h);
  for (const a of D.apartments) add('apartment', a);
  for (const s of D.stores) add('store', s);
  for (const w of D.warehouses) add('warehouse', w);
  for (const b of D.blocks || []) add('block', b);
  for (const t of (D.towers || []).filter((q) => !q.far)) add('tower', t);
  const out = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 0) out.push([a, b]);
  }
  for (let i = 0; i < circles.length; i++) {
    const a = circles[i];
    for (let j = i + 1; j < circles.length; j++) if (Math.hypot(a.x - circles[j].x, a.z - circles[j].z) < a.r + circles[j].r) out.push([a, circles[j]]);
    for (const b of rects) { const dx = Math.max(b.x0 - a.x, 0, a.x - b.x1), dz = Math.max(b.z0 - a.z, 0, a.z - b.z1); if (Math.hypot(dx, dz) < a.r) out.push([a, b]); }
  }
  return out;
}

// Size of the city: what the renderer has to batch and draw.
export function budget(city) {
  const D = city.kitData || {};
  const n = (k) => (D[k] || []).length;
  return {
    boxes: city.kit.boxes.length,
    buildings: n('houses') + n('apartments') + n('stores') + n('warehouses') + n('blocks') + n('towers') + n('sheds'),
    props: n('props') + n('cars') + n('trees') + n('palms') + n('shrubs') + n('bins'),
    people: n('people'),
    lights: city.kit.lights.length,
  };
}
