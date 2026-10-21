// District edges: the map is framed by things you can see, never invisible walls. Downtown: the river on the east
// (promenade, railing, quay drop into the water), a rail yard behind a tall fence on the north, an elevated highway
// behind a sound wall on the south, and a row of warehouses on the west. Some streets run out through the edge;
// each is closed by a barrier or gate under a green sign naming the neighbouring district.

import { MAT, TAG } from '../kit.js';
import { G, building } from '../modules/building.js';
import { placeProp } from '../modules/streets.js';

const WALL_H = 6, COLLIDE_H = 8; // visible barrier height; colliders stop a stacked jump + mantle

export function edges(kit, city) {
  const L = city.layout, cfg = city.district, rng = kit.rng;
  const { inner } = city;
  const sx = L.sizeX, sz = L.sizeZ;
  // Two exits per side, on interior street lines.
  const pick2 = (n) => rng.shuffle(Array.from({ length: n - 1 }, (_, i) => i + 1)).slice(0, 2).sort((a, b) => a - b);
  const exits = { n: pick2(L.cols), s: pick2(L.cols), w: pick2(L.rows), e: pick2(L.rows) };
  city.connections = [];
  const build = { river, railyard, highway, warehouses };
  for (const side of ['n', 's', 'w', 'e']) build[cfg.edges[side]](kit, city, side, exits[side]);
  // World-space extent of the walkable map (physics bounds sit just inside the far side of each edge zone).
  city.bounds = { x0: 0.5, z0: 0.5, x1: sx - 0.5, z1: sz - 0.5 };
}

// Geometry helpers for an edge side. `a` runs along the edge, `d` is depth outward from the inner street grid.
function sideFrame(city, side) {
  const { inner } = city, L = city.layout;
  if (side === 'n') return { len: L.sizeX, rect: (a0, a1, d0, d1) => ({ x0: a0, x1: a1, z0: inner.z0 - d1, z1: inner.z0 - d0 }), out: { x: 0, z: -1 } };
  if (side === 's') return { len: L.sizeX, rect: (a0, a1, d0, d1) => ({ x0: a0, x1: a1, z0: inner.z1 + d0, z1: inner.z1 + d1 }), out: { x: 0, z: 1 } };
  if (side === 'w') return { len: L.sizeZ, rect: (a0, a1, d0, d1) => ({ z0: a0, z1: a1, x0: inner.x0 - d1, x1: inner.x0 - d0 }), out: { x: -1, z: 0 } };
  return { len: L.sizeZ, rect: (a0, a1, d0, d1) => ({ z0: a0, z1: a1, x0: inner.x1 + d0, x1: inner.x1 + d1 }), out: { x: 1, z: 0 } };
}
// Street centre lines crossing an edge (along-coordinate of the street's span).
function exitSpan(city, side, k) {
  const L = city.layout;
  const v = side === 'n' || side === 's' ? L.X[k] : L.Z[k];
  return [v, v + L.S];
}
const solidR = (kit, r, y0, y1, color, mat = MAT.STD, tag = TAG.BOUNDARY) => kit.solid(r.x0, y0, r.z0, r.x1, y1, r.z1, color, mat, tag);
const boxR = (kit, r, y0, y1, color, mat = MAT.STD) => kit.box(r.x0, y0, r.z0, r.x1, y1, r.z1, color, mat);

// A barrier line along the edge at depth d, with gate segments at exits. style: 'fence' | 'wall' | 'rail'
function barrier(kit, city, side, d, spans, style) {
  const F = sideFrame(city, side);
  const cuts = spans.slice().sort((p, q) => p[0] - q[0]);
  let a = 0;
  const seg = (a0, a1) => {
    if (a1 - a0 < 0.1) return;
    const r = F.rect(a0, a1, d, d + 0.35);
    if (style === 'wall') solidR(kit, r, 0, WALL_H, 0x8a8590);
    else { kit.collider(r.x0, 0, r.z0, r.x1, COLLIDE_H, r.z1, TAG.BOUNDARY); boxR(kit, r, 0, WALL_H, 0x9a9ca4, MAT.GLASS); } // chain-link: see-through
    if (style === 'wall') boxR(kit, F.rect(a0, a1, d - 0.05, d + 0.4), WALL_H - 0.3, WALL_H, 0xa8a4ae);
    else for (let t = a0; t < a1; t += 3) boxR(kit, F.rect(t, t + 0.12, d - 0.05, d + 0.4), 0, WALL_H + 0.4, 0x5a5860, MAT.METAL);
    if (style !== 'wall') boxR(kit, F.rect(a0, a1, d - 0.1, d + 0.45), WALL_H, WALL_H + 0.08, 0x3a3840, MAT.METAL); // barbed top
    kit.collider(r.x0, 0, r.z0, r.x1, COLLIDE_H, r.z1, TAG.BOUNDARY);
  };
  for (const [c0, c1] of cuts) { seg(a, c0); a = c1; }
  seg(a, F.len);
}

function exitGate(kit, city, side, d, span, name, kind) {
  const F = sideFrame(city, side);
  const [a0, a1] = span;
  const r = F.rect(a0, a1, d, d + 0.4);
  // Closed gate / barrier: jersey barriers in front, a rolling gate behind.
  kit.collider(r.x0, 0, r.z0, r.x1, COLLIDE_H, r.z1, TAG.BOUNDARY);
  boxR(kit, r, 0, kind === 'bridge' ? 3.2 : 4.2, 0x8e9098, MAT.METAL);
  for (let t = a0 + 0.6; t < a1 - 0.6; t += 2.2) {
    const j = F.rect(t, t + 1.9, d - 1.1, d - 0.4);
    kit.solid(j.x0, 0, j.z0, j.x1, 0.85, j.z1, 0xc8c4bc, MAT.STD, TAG.PROP);
    boxR(kit, F.rect(t + 0.2, t + 1.7, d - 1.15, d - 0.35), 0.5, 0.62, t % 4.4 < 2.2 ? 0xd84a3a : 0xe8e4dc);
  }
  // Gantry with the green district sign, facing back into the map.
  const pa = F.rect(a0 - 0.3, a0, d - 0.6, d - 0.3), pb = F.rect(a1, a1 + 0.3, d - 0.6, d - 0.3);
  boxR(kit, pa, 0, 6.4, 0x4a4650, MAT.METAL); boxR(kit, pb, 0, 6.4, 0x4a4650, MAT.METAL);
  boxR(kit, F.rect(a0, a1, d - 0.55, d - 0.35), 5.9, 6.2, 0x4a4650, MAT.METAL);
  const c = F.rect((a0 + a1) / 2, (a0 + a1) / 2, d - 0.7, d - 0.7);
  const arrow = side === 'n' ? '↑' : side === 's' ? '↓' : side === 'w' ? '←' : '→';
  kit.sign(`${name.toUpperCase()} ${arrow}`, 'wayfind', c.x0, 5.2, c.z0, Math.min(9, a1 - a0 - 1), 1.4, -F.out.x, -F.out.z, 0xffffff);
  kit.sign(kind === 'bridge' ? 'BRIDGE CLOSED' : 'ROAD CLOSED', 'paint', F.rect(a0, a1, d - 0.45, d - 0.45).x0 + (F.out.x === 0 ? (a1 - a0) / 2 : 0), 2.2, F.rect(a0, a1, d - 0.45, d - 0.45).z0 + (F.out.z === 0 ? (a1 - a0) / 2 : 0), 4.5, 0.8, -F.out.x, -F.out.z, 0xd84a3a);
  const p = F.rect((a0 + a1) / 2, (a0 + a1) / 2, d - 2, d - 2);
  city.connections.push({ side, name, x: p.x0, z: p.z0 });
}

// Edge-zone ground (and the road carried through to each exit).
function edgeGround(kit, city, side, depth, color, exits) {
  const F = sideFrame(city, side);
  solidR(kit, F.rect(-40, F.len + 40, 0, depth), -1, 0, color, MAT.STD, TAG.GROUND);
  for (const k of exits) { const [a0, a1] = exitSpan(city, side, k); kit.box(...flat(F.rect(a0, a1, 0, depth)), kit.pal.asphalt); }
}
const flat = (r) => [r.x0, 0, r.z0, r.x1, 0.012, r.z1];

function river(kit, city, side, exits) {
  const { pal, rng } = kit;
  const F = sideFrame(city, side);
  const depth = city.district.edgeDepth;
  const prom = 9;
  // Promenade at curb height along the river, bridge roads at street level through it.
  const spans = exits.map((k) => exitSpan(city, side, k));
  let a = -2;
  for (const [s0, s1] of spans.concat([[F.len + 2, F.len + 2]])) {
    if (s0 > a) solidR(kit, F.rect(a, s0, 0, prom), -1, G, 0x7c7884, MAT.STD, TAG.GROUND);
    a = s1;
  }
  // Railing with gaps at the bridges; quay wall below; water beyond (falling in = "you fell", back to land).
  let b = -2;
  for (const [s0, s1] of spans.concat([[F.len + 2, F.len + 2]])) {
    if (s0 - b > 0.5) {
      const r = F.rect(b, s0, prom - 0.25, prom);
      kit.solid(r.x0, G, r.z0, r.x1, G + 1.15, r.z1, null, MAT.METAL, TAG.RAIL);
      boxR(kit, r, G + 1.0, G + 1.12, 0x3a3840, MAT.METAL);
      for (let t = b; t < s0; t += 2.5) boxR(kit, F.rect(t, t + 0.1, prom - 0.2, prom - 0.05), G, G + 1.05, 0x3a3840, MAT.METAL);
    }
    b = s1;
  }
  boxR(kit, F.rect(-40, F.len + 40, prom, prom + 0.6), -5, G, 0x6a6670);
  boxR(kit, F.rect(-300, F.len + 300, prom + 0.6, depth + 320), -3.3, -3.1, pal.water);
  // Promenade dressing: trees, lamps, benches.
  for (let t = 8; t < F.len - 8; t += 12) {
    if (spans.some(([s0, s1]) => t > s0 - 3 && t < s1 + 3)) continue;
    const p = F.rect(t, t, prom - 2.2, prom - 2.2);
    const k = (t / 12) % 3;
    if (k < 1) { kit.prop('tree', p.x0, G, p.z0, rng.range(0, 6.28), rng.pick(pal.foliage)); kit.collider(p.x0 - 0.25, G, p.z0 - 0.25, p.x0 + 0.25, G + 3, p.z0 + 0.25, TAG.PROP); }
    else if (k < 2) { placeProp(kit, 'streetlight', p.x0, G, p.z0, Math.atan2(F.out.x, F.out.z)); kit.light(p.x0, 6.3, p.z0, pal.street, 9); }
    else placeProp(kit, 'bench', p.x0, G, p.z0, F.out.x === 0 ? 0 : Math.PI / 2);
  }
  // Bridges: decks over the water, closed by a barrier before the far bank, then render-only spans beyond.
  for (const k of exits) {
    const [s0, s1] = exitSpan(city, side, k);
    solidR(kit, F.rect(s0, s1, 0, depth - 2), -1, 0, pal.asphalt, MAT.STD, TAG.GROUND);
    for (const [p0, p1] of [[s0 - 0.6, s0], [s1, s1 + 0.6]]) solidR(kit, F.rect(p0, p1, prom, depth - 2), 0, 1.2, 0x8a8590, MAT.STD, TAG.RAIL);
    boxR(kit, F.rect(s0 - 0.6, s1 + 0.6, depth - 2, depth + 230), -1.2, 0, 0x6a6670);
    for (let t = depth + 10; t < depth + 230; t += 22) boxR(kit, F.rect(s0 + 2, s1 - 2, t, t + 3), -14, -1.2, 0x5a5660);
    exitGate(kit, city, side, depth - 5, [s0, s1], city.district.neighbors[side], 'bridge');
  }
  // Far bank skyline.
  for (let t = -60; t < F.len + 60;) {
    const w = rng.range(18, 40), h = rng.range(14, 60);
    boxR(kit, F.rect(t, t + w - 2, depth + 235, depth + 260), -3.2, h, rng.pick(pal.brick.concat(pal.concrete)));
    t += w;
  }
}

function railyard(kit, city, side, exits) {
  const { pal, rng } = kit;
  const F = sideFrame(city, side);
  const depth = city.district.edgeDepth;
  edgeGround(kit, city, side, depth + 2, 0x5a5450, exits);
  const spans = exits.map((k) => exitSpan(city, side, k));
  barrier(kit, city, side, 3, spans, 'fence');
  for (const k of exits) exitGate(kit, city, side, 3, exitSpan(city, side, k), city.district.neighbors[side], 'gate');
  // Tracks, freight cars and signal masts beyond the fence (out of reach, there to be seen).
  for (const d of [9, 15, 21, 27]) {
    boxR(kit, F.rect(-40, F.len + 40, d - 1.2, d + 1.2), 0.01, 0.12, 0x6a625a);
    for (const o of [-0.72, 0.72]) boxR(kit, F.rect(-40, F.len + 40, d + o - 0.06, d + o + 0.06), 0.12, 0.3, 0x5a5560, MAT.METAL);
  }
  for (let t = 10; t < F.len - 20; t += rng.range(14, 40)) {
    const d = rng.pick([9, 15, 21, 27]);
    for (let c = 0; c < rng.int(1, 4); c++) {
      const r = F.rect(t + c * 15, t + c * 15 + 14, d - 1.5, d + 1.5);
      boxR(kit, r, 0.3, 4.2, rng.pick([0x8a3a2a, 0x3a5a7a, 0x6a6a3a, 0x5a4a6a]));
    }
    t += 50;
  }
  for (let t = 30; t < F.len; t += 70) {
    const r = F.rect(t, t + 0.3, 12, 12.3);
    boxR(kit, r, 0, 7, 0x3a3840, MAT.METAL);
    kit.light(r.x0, 7, r.z0, 0xff3355, 0, 'beacon');
  }
}

function highway(kit, city, side, exits) {
  const { pal, rng } = kit;
  const F = sideFrame(city, side);
  const depth = city.district.edgeDepth;
  edgeGround(kit, city, side, depth + 2, 0x55525a, exits);
  const spans = exits.map((k) => exitSpan(city, side, k));
  barrier(kit, city, side, 3, spans, 'wall');
  for (const k of exits) exitGate(kit, city, side, 3, exitSpan(city, side, k), city.district.neighbors[side], 'road');
  // Elevated highway beyond the sound wall: deck, piers, lamps.
  boxR(kit, F.rect(-60, F.len + 60, 10, 26), 8.6, 9.8, 0x857f86);
  boxR(kit, F.rect(-60, F.len + 60, 9.7, 10.2), 9.8, 10.9, 0x8a8590);
  boxR(kit, F.rect(-60, F.len + 60, 25.8, 26.3), 9.8, 10.9, 0x8a8590);
  for (let t = 4; t < F.len; t += 24) { boxR(kit, F.rect(t, t + 2.2, 16.5, 19.5), 0, 8.6, 0x7e7680); boxR(kit, F.rect(t - 1, t + 3.2, 11, 25), 7.2, 8.6, 0x7e7680); }
  for (let t = 10; t < F.len; t += 30) { const p = F.rect(t, t + 0.2, 10.3, 10.5); boxR(kit, p, 9.8, 16, 0x4a4650, MAT.METAL); kit.light(p.x0, 16, p.z0, 0xffc070, 10, 'street'); }
}

function warehouses(kit, city, side, exits) {
  const { rng } = kit;
  const F = sideFrame(city, side);
  const depth = city.district.edgeDepth;
  edgeGround(kit, city, side, depth + 2, 0x5a5660, exits);
  const spans = exits.map((k) => exitSpan(city, side, k)).sort((p, q) => p[0] - q[0]);
  // Warehouses fill the edge between the exits, loading docks toward the city. Whatever a warehouse can't fill
  // (the corners, slivers next to an exit) gets fence; each exit gets a gate under its district sign.
  const fences = [[-40, city.inner.z0 - 3]];
  const runs = [];
  let a = city.inner.z0 - 3;
  for (const [s0, s1] of spans) { runs.push([a, s0]); a = s1; }
  runs.push([a, city.inner.z1 + 3]);
  fences.push([city.inner.z1 + 3, F.len + 40]);
  for (const [r0, r1] of runs) {
    let t = r0;
    while (r1 - t >= 12) {
      const w = Math.min(r1 - t, rng.range(24, 40));
      const r = F.rect(t, t + w - 0.4, 3, depth - 1);
      building(kit, r, rng.range(9, 14), { style: rng.chance(0.6) ? 'brick' : 'concrete', faces: [F.out.x < 0 ? 'e' : 'w'], clutter: false });
      for (let i = 0; i < Math.floor((w - 4) / 7); i++) {
        const q = F.rect(t + 3 + i * 7, t + 7.5 + i * 7, 2.95, 2.95);
        kit.quad((q.x0 + q.x1) / 2, 2.2, (q.z0 + q.z1) / 2, 4.5, 4.2, -F.out.x, -F.out.z, 0x6a6670, 0x4a4652);
      }
      t += w;
    }
    if (r1 - t > 0.1) fences.push([t, r1]);
  }
  for (const [f0, f1] of fences) fenceRun(kit, city, side, 3, f0, f1);
  for (const sp of spans) exitGate(kit, city, side, 3, sp, city.district.neighbors[side], 'gate');
}

function fenceRun(kit, city, side, d, a0, a1) {
  const F = sideFrame(city, side);
  const r = F.rect(a0, a1, d, d + 0.35);
  kit.collider(r.x0, 0, r.z0, r.x1, COLLIDE_H, r.z1, TAG.BOUNDARY);
  boxR(kit, r, 0, WALL_H, 0x9a9ca4, MAT.GLASS);
  for (let t = a0; t < a1; t += 3) boxR(kit, F.rect(t, t + 0.12, d - 0.05, d + 0.4), 0, WALL_H + 0.4, 0x5a5860, MAT.METAL);
}
