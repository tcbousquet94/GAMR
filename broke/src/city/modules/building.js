// Shared building builder: body, windows, storefront + neon sign, fire escapes (street -> mid -> roof),
// parapets, roof clutter and roof-door spawn points. Used by every module.

import { MAT, TAG } from '../kit.js';
import { shopName } from '../names.js';
import { furnishCafe } from './cafe.js';

export const FACES = {
  n: { nx: 0, nz: -1 }, s: { nx: 0, nz: 1 }, w: { nx: -1, nz: 0 }, e: { nx: 1, nz: 0 },
};

export const G = 0.15; // lot / sidewalk height

// Points along a face: returns {ax, az, bx, bz, len, nx, nz} with a->b running left to right seen from outside.
export function faceLine(r, f) {
  if (f === 'n') return { ax: r.x1, az: r.z0, bx: r.x0, bz: r.z0, len: r.x1 - r.x0, ...FACES.n };
  if (f === 's') return { ax: r.x0, az: r.z1, bx: r.x1, bz: r.z1, len: r.x1 - r.x0, ...FACES.s };
  if (f === 'w') return { ax: r.x0, az: r.z0, bx: r.x0, bz: r.z1, len: r.z1 - r.z0, ...FACES.w };
  return { ax: r.x1, az: r.z1, bx: r.x1, bz: r.z0, len: r.z1 - r.z0, ...FACES.e };
}
export const facePoint = (L, t, out = 0) => ({ x: L.ax + (L.bx - L.ax) * t + L.nx * out, z: L.az + (L.bz - L.az) * t + L.nz * out });

// Axis-aligned rect sticking out of a face: from s0..s1 along the face (meters from a), d0..d1 outward.
export function faceRect(L, s0, s1, d0, d1) {
  const t0 = s0 / L.len, t1 = s1 / L.len;
  const p0 = facePoint(L, t0, d0), p1 = facePoint(L, t1, d1);
  return { x0: Math.min(p0.x, p1.x), z0: Math.min(p0.z, p1.z), x1: Math.max(p0.x, p1.x), z1: Math.max(p0.z, p1.z) };
}

export function building(kit, r, h, opts = {}) {
  const { rng, pal } = kit;
  const style = opts.style || rng.pick(['brick', 'brick', 'concrete']);
  const color = opts.color ?? (style === 'glass' ? rng.pick(pal.tower) : style === 'brick' ? rng.pick(pal.brick) : rng.pick(pal.concrete));
  const base = opts.base ?? 0;
  const body = { solid: kit.solid(r.x0, base - 0.5, r.z0, r.x1, h, r.z1, color, MAT.STD, TAG.BUILDING), box: kit.boxes[kit.boxes.length - 1] };
  // Cornice band.
  const trim = style === 'glass' ? pal.trim : shade(color, 1.18);
  kit.box(r.x0 - 0.25, h - 0.6, r.z0 - 0.25, r.x1 + 0.25, h, r.z1 + 0.25, trim);
  const faces = opts.faces || ['n', 's', 'w', 'e'];
  const store = new Set(opts.storefront || []);
  for (const f of faces) windows(kit, r, f, h, style, store.has(f) ? 4.5 : 3.5, opts.windowStart);
  const rooms = [];
  for (const f of store) storefront(kit, r, f, opts, rooms);
  if (rooms.length) carveRooms(kit, r, body, base, h, color, rooms);
  for (const f of opts.fireEscape || []) fireEscape(kit, r, f, h, opts.feAt);
  if (opts.roof !== false) roof(kit, r, h, opts);
  return { h, color };
}

export function shade(c, k) {
  const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k);
  return (r << 16) | (g << 8) | b;
}

function windows(kit, r, f, h, style, startY = 3.5, override) {
  const { rng, pal } = kit;
  const L = faceLine(r, f);
  const floorH = style === 'glass' ? 3.6 : 4;
  const colW = style === 'glass' ? 2.6 : 3.4;
  const winW = style === 'glass' ? 2.3 : 1.6;
  const winH = style === 'glass' ? 2.8 : 2.1;
  const cols = Math.floor((L.len - 2) / colW);
  if (cols < 1) return;
  const pad = (L.len - cols * colW) / 2;
  const litP = style === 'glass' ? 0.55 : 0.5;
  for (let y = override ?? startY + 0.6; y + winH < h - 0.8; y += floorH) {
    // Whole floors tend to be lit or dark together, like real offices at night.
    const floorLit = rng.next();
    for (let i = 0; i < cols; i++) {
      const p = facePoint(L, (pad + colW * (i + 0.5)) / L.len, 0.03);
      const lit = rng.next() < litP * (0.5 + floorLit);
      const day = rng.pick(pal.windowDay);
      const night = lit ? rng.pick(pal.windowNight) : pal.windowDark;
      kit.quad(p.x, y + winH / 2, p.z, winW, winH, L.nx, L.nz, day, night);
    }
  }
}

function storefront(kit, r, f, opts, rooms) {
  const { rng, pal } = kit;
  const L = faceLine(r, f);
  const n = Math.max(1, Math.floor(L.len / 14));
  const seg = L.len / n;
  for (let i = 0; i < n; i++) {
    const t = (seg * (i + 0.5)) / L.len;
    const p = facePoint(L, t, 0.04);
    const w = Math.min(seg - 3, 10);
    // Draw this storefront's random choices in the original order (window glow, awning, sign, name, colour) before
    // building anything, so whether it turns out to be a walk-in cafe never changes the rest of the city.
    const warm = rng.pick([0xffc98a, 0xffd8a8, 0xffe0b0]);
    const awn = rng.pick([0x5c3a78, 0x6e2f5c, 0x4b3f6e, 0x3f4f66]);
    const hasSign = opts.signs !== false && rng.chance(0.85);
    const name = hasSign ? shopName(rng) : null, neon = hasSign ? rng.pick(pal.neon) : null;
    const depth = f === 'n' || f === 's' ? r.z1 - r.z0 : r.x1 - r.x0;
    const cafe = name && / CAFE$/.test(name) && depth >= 9 && seg >= 8 && (opts.base ?? 0) === 0;
    if (cafe) rooms.push({ L, s0: seg * i + 0.5, s1: seg * (i + 1) - 0.5, depth: Math.min(depth - 2.5, 10), name, f });
    else kit.quad(p.x, G + 1.7, p.z, w, 2.6, L.nx, L.nz, 0x4a5670, warm);
    // Awning (environment accents only: purple / magenta / dusty mauve).
    const ap = facePoint(L, t, 0.9);
    const along = L.nx === 0;
    kit.boxC(ap.x, G + 3.55, ap.z, along ? w + 0.6 : 1.8, 0.18, along ? 1.8 : w + 0.6, awn, MAT.STD, {
      rx: along ? L.nz * 0.32 : 0, rz: along ? 0 : -L.nx * 0.32,
    });
    // Neon sign above the awning.
    if (hasSign) {
      const sp = facePoint(L, t, 0.12);
      kit.sign(name, 'neon', sp.x, G + 4.7, sp.z, Math.min(w, 8), 1.2, L.nx, L.nz, neon);
    }
    // Door and a spawn point in front of it.
    const dp = facePoint(L, t, 1.6);
    kit.spawn(dp.x, G, dp.z, 'door');
    kit.slot(facePoint(L, t + 2.8 / L.len, 0.9).x, G, facePoint(L, t + 2.8 / L.len, 0.9).z, Math.atan2(L.nx, L.nz), ['front']);
  }
}

// Walk-in rooms on the ground floor (cafes): the building's single solid body is replaced by an upper block from the
// room ceiling up plus ground-floor blocks around the rooms, then each room is furnished (modules/cafe.js).
const ROOM_H = 4.2;
function carveRooms(kit, r, body, base, h, color, rooms) {
  const si = kit.solids.indexOf(body.solid), bi = kit.boxes.indexOf(body.box);
  if (si >= 0) kit.solids.splice(si, 1);
  if (bi >= 0) kit.boxes.splice(bi, 1);
  kit.solid(r.x0, ROOM_H, r.z0, r.x1, h, r.z1, color, MAT.STD, TAG.BUILDING);
  const holes = rooms.map((q) => faceRect(q.L, q.s0, q.s1, -q.depth, 0));
  for (const p of subtractRects(r, holes)) kit.solid(p.x0, base - 0.5, p.z0, p.x1, ROOM_H, p.z1, color, MAT.STD, TAG.BUILDING);
  for (const q of rooms) furnishCafe(kit, q, ROOM_H);
}

// Footprint minus axis-aligned holes, as a list of axis-aligned rects (a simple grid split on the holes' edges).
function subtractRects(r, holes) {
  const xs = [...new Set([r.x0, r.x1, ...holes.flatMap((q) => [q.x0, q.x1])])].filter((x) => x >= r.x0 && x <= r.x1).sort((a, b) => a - b);
  const zs = [...new Set([r.z0, r.z1, ...holes.flatMap((q) => [q.z0, q.z1])])].filter((z) => z >= r.z0 && z <= r.z1).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < xs.length - 1; i++) {
    // Merge runs of free cells down each column to keep the box count low.
    let start = null;
    for (let j = 0; j <= zs.length - 1; j++) {
      const free = j < zs.length - 1 && !holes.some((q) => (xs[i] + xs[i + 1]) / 2 > q.x0 && (xs[i] + xs[i + 1]) / 2 < q.x1 && (zs[j] + zs[j + 1]) / 2 > q.z0 && (zs[j] + zs[j + 1]) / 2 < q.z1);
      if (free && start == null) start = zs[j];
      if (!free && start != null) { out.push({ x0: xs[i], x1: xs[i + 1], z0: start, z1: zs[j] }); start = null; }
    }
  }
  return out.filter((p) => p.x1 - p.x0 > 0.01 && p.z1 - p.z0 > 0.01);
}

// Fire escape: landings every 4 m plus a ladder column beside them that runs from the street to the roof.
// Requests are queued and built after every module, so each can be placed where it doesn't clip into a
// neighbouring building or prop (see buildFireEscapes).
export function fireEscape(kit, r, f, h, at) {
  (kit.pendingFE = kit.pendingFE || []).push({ r, f, h, at, module: kit.module });
}

export function buildFireEscapes(kit) {
  const list = kit.pendingFE || [];
  kit.pendingFE = [];
  const placed = new Map(); // building rect -> placed any?
  const tryFace = (q, f, fixedAt) => {
    const L = faceLine(q.r, f);
    if (L.len < 10) return false;
    const w = 5.5;
    const tries = fixedAt != null ? [fixedAt] : [];
    for (let k = 0; k < 6; k++) tries.push(kit.rng.range(2, L.len - w - 3));
    for (const s0 of tries) {
      const deck = faceRect(L, s0, s0 + w, 0, 1.6);
      const ladder = faceRect(L, s0 + w + 0.5, s0 + w + 1.6, 0, 1.2);
      if (clips(kit, deck, 0.3, q.h) || clips(kit, ladder, 0, q.h + 1)) continue;
      buildFE(kit, q.r, f, q.h, s0, L, w);
      return true;
    }
    return false;
  };
  for (const q of list) {
    kit.module = q.module;
    const ok = tryFace(q, q.f, q.at);
    placed.set(q.r, (placed.get(q.r) || false) || ok);
  }
  // Every building that asked for roof access gets it on some face, or loses its roof shops and spawns.
  for (const q of list) {
    if (placed.get(q.r)) continue;
    kit.module = q.module;
    let ok = false;
    for (const f of ['n', 's', 'w', 'e']) if (f !== q.f && (ok = tryFace(q, f))) break;
    placed.set(q.r, true);
    if (!ok) {
      const on = (p) => p.x >= q.r.x0 && p.x <= q.r.x1 && p.z >= q.r.z0 && p.z <= q.r.z1 && p.y >= q.h - 0.2;
      kit.slots = kit.slots.filter((p) => !on(p));
      kit.spawns = kit.spawns.filter((p) => !on(p));
    }
  }
  kit.module = null;
}

function clips(kit, R, y0, y1) {
  const e = 0.02;
  for (const b of kit.solids) {
    if (b.tag & 1) continue; // ground slabs
    if (R.x1 - e > b.minX && R.x0 + e < b.maxX && R.z1 - e > b.minZ && R.z0 + e < b.maxZ && y1 > b.minY && y0 + 0.3 < b.maxY) return true;
  }
  return false;
}

function buildFE(kit, r, f, h, s0, L, w) {
  const { pal } = kit;
  const deck = faceRect(L, s0, s0 + w, 0, 1.5);
  // A half-metre gap keeps the ladder column clear of the landings, so climbing never snags on them.
  const ladder = faceRect(L, s0 + w + 0.5, s0 + w + 1.6, 0, 1.1);
  const c = pal.metal;
  let mid = false;
  for (let y = 4; y < h - 1.5; y += 4) {
    kit.solid(deck.x0, y - 0.15, deck.z0, deck.x1, y, deck.z1, c, MAT.METAL, TAG.PLATFORM);
    // Railing (visual) with a low collider so you don't slide off by accident.
    const rail = faceRect(L, s0, s0 + w, 1.4, 1.5);
    kit.box(rail.x0, y, rail.z0, rail.x1, y + 1.0, rail.z1, c, MAT.METAL);
    kit.box(rail.x0, y + 0.95, rail.z0, rail.x1, y + 1.05, rail.z1, c, MAT.METAL);
    // Zig-zag stair visual between landings.
    if (y + 4 < h - 1.5) {
      const sc = facePoint(L, (s0 + w / 2) / L.len, 0.75);
      kit.boxC(sc.x, y + 2, sc.z, L.nx === 0 ? w * 0.9 : 0.12, 0.12, L.nx === 0 ? 0.12 : w * 0.9, c, MAT.METAL, {
        rz: L.nx === 0 ? 0.62 * (((y / 4) | 0) % 2 ? 1 : -1) : 0, rx: L.nx === 0 ? 0 : 0.62 * (((y / 4) | 0) % 2 ? 1 : -1),
      });
    }
    if (y >= 6 && y <= 10) mid = true;
  }
  kit.climb(ladder.x0, 0, ladder.z0, ladder.x1, h + 0.7, ladder.z1, 'ladder', 'street', 'roof');
  if (mid) kit.link('fireescape', 'street', 'mid', (deck.x0 + deck.x1) / 2, (deck.z0 + deck.z1) / 2);
  // The bottom of the ladder is a good spot for an alley spawn.
  const sp = facePoint(L, (s0 + w / 2) / L.len, 2.6);
  kit.spawn(sp.x, G, sp.z, 'alley');
}

function roof(kit, r, h, opts) {
  const { rng, pal } = kit;
  const t = 0.35;
  const ph = 0.5;
  if (opts.parapet !== false) {
    kit.solid(r.x0, h, r.z0, r.x1, h + ph, r.z0 + t, pal.roof, MAT.STD, TAG.RAIL);
    kit.solid(r.x0, h, r.z1 - t, r.x1, h + ph, r.z1, pal.roof, MAT.STD, TAG.RAIL);
    kit.solid(r.x0, h, r.z0 + t, r.x0 + t, h + ph, r.z1 - t, pal.roof, MAT.STD, TAG.RAIL);
    kit.solid(r.x1 - t, h, r.z0 + t, r.x1, h + ph, r.z1 - t, pal.roof, MAT.STD, TAG.RAIL);
  }
  kit.box(r.x0 + t, h - 0.02, r.z0 + t, r.x1 - t, h + 0.02, r.z1 - t, pal.roof);
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  if (w < 8 || d < 8 || opts.clutter === false) return;
  // Roof door hut: an enemy spawn point.
  const dx = r.x0 + 2 + rng.next() * (w - 7), dz = r.z0 + 2 + rng.next() * (d - 7);
  kit.solid(dx, h, dz, dx + 2.6, h + 2.7, dz + 2.6, shade(pal.roof, 1.1), MAT.STD, TAG.PROP);
  kit.box(dx + 0.7, h, dz + 2.6, dx + 1.9, h + 2.1, dz + 2.65, pal.metal, MAT.METAL);
  kit.spawn(dx + 1.3, h, dz + 3.8, 'roof');
  // AC units for cover.
  const n = rng.int(1, 3);
  for (let i = 0; i < n; i++) {
    const ax = r.x0 + 1.5 + rng.next() * (w - 5), az = r.z0 + 1.5 + rng.next() * (d - 4);
    if (ax < dx + 3.5 && ax + 2.5 > dx - 1 && az < dz + 5 && az + 2 > dz - 1) continue;
    kit.solid(ax, h, az, ax + 2.4, h + 1.4, az + 1.8, 0x77747d, MAT.STD, TAG.PROP);
    kit.box(ax + 0.3, h + 1.4, az + 0.3, ax + 2.1, h + 1.46, az + 1.5, 0x3d3b44, MAT.METAL);
  }
  if (rng.chance(0.35) && w > 14 && d > 14) waterTower(kit, r.x1 - 6, r.z1 - 6, h);
  kit.slot(r.x0 + w / 2, h, r.z0 + d / 2, 0, ['roof']);
}

function waterTower(kit, x, z, h) {
  const c = 0x5a4a3c;
  for (const [ox, oz] of [[0, 0], [3, 0], [0, 3], [3, 3]]) kit.solid(x + ox - 0.1, h, z + oz - 0.1, x + ox + 0.1, h + 3, z + oz + 0.1, kit.pal.metal, MAT.METAL, TAG.PROP); // legs carry the tank
  kit.solid(x - 0.3, h + 3, z - 0.3, x + 3.3, h + 7, z + 3.3, c, MAT.STD, TAG.PROP);
  kit.boxC(x + 1.5, h + 7.6, z + 1.5, 3.2, 1.2, 3.2, shade(c, 0.8), MAT.STD, { ry: Math.PI / 4 });
}

// Wooden plank between two roofs so rooftop routes chain together.
export function plank(kit, x0, z0, x1, z1, y) {
  kit.solid(x0, y - 0.2, z0, x1, y, z1, 0x6e5a44, MAT.STD, TAG.PLATFORM);
  kit.link('plank', 'roof', 'roof', (x0 + x1) / 2, (z0 + z1) / 2);
}

// Lot ground slab (top at G) with an optional rectangular hole for sunken areas.
export function lotGround(kit, r, hole = null, color = kit.pal.sidewalk, y0 = -1) {
  if (!hole) { kit.solid(r.x0, y0, r.z0, r.x1, G, r.z1, color, 0, 1); return; }
  const parts = [
    [r.x0, r.z0, r.x1, hole.z0], [r.x0, hole.z1, r.x1, r.z1],
    [r.x0, hole.z0, hole.x0, hole.z1], [hole.x1, hole.z0, r.x1, hole.z1],
  ];
  for (const [a, b, c, d] of parts) if (c - a > 0.01 && d - b > 0.01) kit.solid(a, y0, b, c, G, d, color, 0, 1);
}
