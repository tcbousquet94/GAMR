// Handcrafted neighbourhood modules in the remastered look. Each fills one block (cell) of the street grid with
// lots, buildings, lanes, yards and street life, laid out in the block's local frame (u across the front street,
// v deep from it) and returned as kit data in world coordinates, plus the kerb cuts its lanes and alleys need.
//   crescent    a curving residential lane through the block; the two-storey porch house sits at the bend
//   culdesac    a lane ending in a turning bulb with a planted island, houses fanned around it
//   cornerstore a corner store with its own parking lot, an apartment walk-up and houses
//   alley       houses back onto a service alley: fences, garages, bins, laundry, a hoop, poles and wires
//   warehouse   a tilt-up warehouse yard behind chain-link and barbed wire, trucks, pallets, a container
// All layouts are original (no real or game location is reproduced).

import { CURB, emptyKitData, frame } from './data.js';

export const WALL_COLORS = { stucco: [0xd8c3a0, 0xcfc6b4, 0xb8b6ae, 0xc8b89c, 0xd0c8b4, 0xb4ac9c, 0xc4b498, 0xe0cfb0, 0xbcc0b4], siding: [0x8a7a68, 0x9a9c98, 0x6e7a6a, 0x7e8a92, 0xa08a70, 0x7a8278, 0x9a8a72, 0x6a5242, 0x8a8070] };
const ROOFS = [0x8a7f74, 0x6e655e, 0x5e5a58, 0x7a6a5e, 0x5a524c, 0x6a625c, 0x80766c];
export const TRIMS = [0xd8d0c0, 0xd6cfc0, 0xdcd6ca, 0xd2cabc, 0xd6d0c4];
const DOORS = [0x5a4030, 0x7a3a2a, 0x3a4a5a, 0x2a3a2a, 0x6a2a2a, 0x2a2a30, 0x4a3426];
const CAR_COLORS = [0x56606a, 0x8a8678, 0x6a2e2a, 0x2e3a4a, 0xb8b4a8, 0x4a5a3a, 0x7a6a50, 0x9a9a98, 0x3a3a3e];
const BIN_COLORS = [0x2e4a32, 0x2a3a5a, 0x252528];

export class MB {
  constructor(rect, front, rng, sides) {
    this.fr = frame(rect, front); this.rng = rng; this.sides = sides; this.D = emptyKitData(); this.cuts = [];
    this.W = this.fr.W; this.Dp = this.fr.D;
  }
  P(u, v) { return this.fr.at(u, v); }
  Y(a) { return this.fr.yawOf(a); }
  // Local yaw that faces a local direction (du, dv); the front street is toward -v.
  face(du, dv) { return Math.atan2(du, -dv); }
  house(u, v, w, d, yaw, style = {}) { const p = this.P(u, v); const h = { ...randomHouse(this.rng), ...style, x: p.x, z: p.z, w, d, yaw: this.Y(yaw) }; this.D.houses.push(h); return h; }
  apartment(u, v, w, d, yaw, style = {}) { const p = this.P(u, v); this.D.apartments.push({ floors: 2, wallColor: this.rng.pick(WALL_COLORS.stucco), trim: this.rng.pick(TRIMS), roofColor: 0x6a6660, ...style, x: p.x, z: p.z, w, d, yaw: this.Y(yaw) }); }
  store(u, v, w, d, yaw, style = {}) { const p = this.P(u, v); this.D.stores.push({ ...style, x: p.x, z: p.z, w, d, yaw: this.Y(yaw) }); }
  warehouse(u, v, w, d, yaw, style = {}) { const p = this.P(u, v); this.D.warehouses.push({ h: 8, doors: 3, ...style, x: p.x, z: p.z, w, d, yaw: this.Y(yaw) }); }
  shed(u, v, w, d, yaw, style = {}) { const p = this.P(u, v); this.D.sheds.push({ ...style, x: p.x, z: p.z, w, d, yaw: this.Y(yaw) }); }
  pad(surf, pts, y0 = CURB - 0.02, y1 = CURB + 0.03, tint = 0xffffff) { this.D.pads.push({ surf, poly: pts.map(([u, v]) => this.fr.pt(u, v)), y0, y1, tint }); }
  rect(surf, u0, v0, u1, v1, y0, y1, tint) { this.pad(surf, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], y0, y1, tint); }
  ribbon(surf, pts, width, y = CURB + 0.03, tint = 0xffffff) { this.D.ribbons.push({ surf, pts: pts.map(([u, v]) => this.P(u, v)), width, y, tint }); }
  kerb(pts, red = []) { this.D.kerbs.push({ pts: pts.map(([u, v]) => this.P(u, v)), red, y: CURB, rolled: true }); }
  fence(kind, u0, v0, u1, v1, h) { this.D.fences.push({ kind, a: this.P(u0, v0), b: this.P(u1, v1), h: h ?? (kind === 'chain' ? 1.2 : kind === 'barbed' ? 2.4 : kind === 'block' ? 1.0 : 1.5) }); }
  palm(u, v, h) { const p = this.P(u, v); this.D.palms.push({ ...p, y: CURB, h: h ?? this.rng.range(11, 16), lean: [this.rng.range(-0.8, 0.8), this.rng.range(-0.8, 0.8)] }); }
  tree(u, v, r, h) { const p = this.P(u, v); this.D.trees.push({ ...p, y: CURB, r: r ?? this.rng.range(3.5, 5.5), h: h ?? this.rng.range(6.5, 9) }); }
  shrub(u, v, r) { const p = this.P(u, v); this.D.shrubs.push({ ...p, y: CURB, r: r ?? this.rng.range(0.6, 1.0) }); }
  car(u, v, yaw, color) { const p = this.P(u, v); this.D.cars.push({ ...p, y: CURB, yaw: this.Y(yaw), color: color ?? this.rng.pick(CAR_COLORS) }); }
  truck(u, v, yaw, color) { const p = this.P(u, v); this.D.trucks.push({ ...p, y: CURB, yaw: this.Y(yaw), color: color ?? 0xe8e4dc }); }
  bin(u, v) { const p = this.P(u, v); this.D.bins.push({ ...p, y: CURB, c: this.rng.pick(BIN_COLORS) }); }
  prop(type, u, v, yaw = 0, color) { const p = this.P(u, v); this.D.props.push({ type, ...p, y: CURB, yaw: this.Y(yaw), color }); }
  light(u, v, yaw) { const p = this.P(u, v); this.D.lights.push({ ...p, y: CURB, yaw: this.Y(yaw) }); }
  poles(pts) { this.D.poleLines.push(pts.map(([u, v]) => this.P(u, v))); }
  person(u, v, yaw) { const p = this.P(u, v); this.D.people.push({ ...p, y: CURB, yaw: this.Y(yaw), seed: this.rng.int(1, 1e6) }); }
  // A kerb cut where a lane / alley / driveway meets the street: the street kerb is dropped over [a, b] (local u or v
  // along that side) and an apron is paved across the sidewalk.
  cut(side, a, b) { this.cuts.push({ side: side === 'front' ? this.fr.front : sideOf(this.fr.front, side), a: this.P(...cutPt(side, a, this)), b: this.P(...cutPt(side, b, this)) }); }
  // Front yard with a path to the door, a lawn, maybe a fence along the street and a hedge.
  yard(u0, u1, v0, v1, doorU, opts = {}) {
    this.ribbon('concrete', [[doorU, v1], [doorU, v0 + 0.2]], 1.2);
    if (opts.drive != null) this.rect('concrete', opts.drive - 1.6, v0, opts.drive + 1.6, v1 + 6, CURB - 0.02, CURB + 0.035, 0xd0ccc4);
    const f = opts.fence ?? (this.rng.chance(0.45) ? this.rng.pick(['chain', 'wood', 'block']) : null);
    if (f) { this.fence(f, u0 + 0.3, v0 + 0.4, doorU - 0.8, v0 + 0.4); this.fence(f, doorU + 0.8, v0 + 0.4, opts.drive != null ? opts.drive - 1.8 : u1 - 0.3, v0 + 0.4); }
    for (let u = u0 + 1.2; u < u1 - 1; u += 2.3) if (Math.abs(u - doorU) > 1.6 && (opts.drive == null || Math.abs(u - opts.drive) > 2.4) && this.rng.chance(0.55)) this.shrub(u, v1 - 0.9);
    if (this.rng.chance(0.3)) this.bin(u1 - 1.2, v0 + 1.2);
  }
}
const sideOf = (front, rel) => ({ s: { left: 'w', right: 'e', back: 'n' }, n: { left: 'e', right: 'w', back: 's' }, e: { left: 's', right: 'n', back: 'w' }, w: { left: 'n', right: 's', back: 'e' } })[front][rel];
const cutPt = (side, t, mb) => (side === 'front' ? [t, 0] : side === 'back' ? [t, mb.Dp] : side === 'left' ? [0, t] : [mb.W, t]);

export function randomHouse(rng) {
  const wall = rng.chance(0.5) ? 'stucco' : 'siding';
  const floors = rng.chance(0.22) ? 2 : 1;
  return {
    floors, wall, wallColor: rng.pick(WALL_COLORS[wall]), trim: rng.pick(TRIMS), roofColor: rng.pick(ROOFS), door: rng.pick(DOORS),
    roof: rng.pick(['hip', 'hip', 'gable', 'gableFront']), bars: rng.chance(0.3),
    porch: rng.chance(0.35) ? { depth: 2.1, steps: 'center', railing: rng.chance(0.6) } : null,
    chimney: floors === 2 && rng.chance(0.4),
  };
}

// Points on a quadratic Bezier.
const bez = (a, c, b, n) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, s = 1 - t; return [s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]; });
// Offset a local polyline sideways (positive = to the right of travel).
function offset(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let du = b[0] - a[0], dv = b[1] - a[1]; const l = Math.hypot(du, dv) || 1; du /= l; dv /= l;
    return [p[0] - dv * d, p[1] + du * d];
  });
}
// A lane: asphalt ribbon at lot level with rolled kerbs, verges and walks either side.
function lane(mb, pts, width = 6.2, { walkL = true, walkR = true } = {}) {
  mb.ribbon('asphalt', pts, width, CURB + 0.005, 0xc8c6c2);
  for (const s of [-1, 1]) {
    mb.kerb(offset(pts, s * (width / 2 + 0.15)), mb.rng.chance(0.15) ? [1, 2, 3] : []);
    if ((s < 0 && walkL) || (s > 0 && walkR)) mb.ribbon('concrete', offset(pts, s * (width / 2 + 1.7 + 0.8)), 1.5);
  }
}

// ---- 1. Crescent ----------------------------------------------------------------------------------------------------
export function crescent(rect, front, rng, sides) {
  const mb = new MB(rect, front, rng, sides), W = mb.W, D = mb.Dp;
  const exitSide = sides.right ? 'right' : 'left';
  const ux = exitSide === 'right' ? W : 0, u0 = exitSide === 'right' ? W * 0.24 : W * 0.76;
  const A = [u0, 0], B = [ux, D * 0.62], C = [u0, D * 0.66];
  const pts = bez(A, C, B, 18);
  lane(mb, pts);
  mb.cut('front', u0 - 4.5, u0 + 4.5);
  mb.cut(exitSide, D * 0.62 - 4.5, D * 0.62 + 4.5);
  const dir = exitSide === 'right' ? 1 : -1;
  // Outer side of the bend: houses facing the lane, the two-storey porch house at the apex.
  const outer = offset(pts, -dir * 13.5);
  const ts = [3, 6, 9, 12, 15];
  ts.forEach((ti, i) => {
    const [u, v] = outer[ti], [lu, lv] = pts[ti];
    if (u < 7 || u > W - 7 || v > D - 6 || v < 8) return;
    const apex = i === 2;
    const yaw = mb.face(lu - u, lv - v);
    mb.house(u, v, apex ? 17 : 11.5, apex ? 11.5 : 10, yaw, apex ? { floors: 2, wall: 'siding', wallColor: 0x6a5242, wall2: 'brick', wall2Color: 0xa08474, roof: 'hip', roofColor: 0x5e5854, trim: 0xd2cabc, porch: { depth: 2.5, steps: 'left', railing: true }, chimney: true } : {});
    // Front walk to the lane and a lot fence on the far side.
    mb.ribbon('concrete', [[u + (lu - u) * 0.35, v + (lv - v) * 0.35], [lu + (u - lu) * 0.3, lv + (v - lv) * 0.3]], 1.1);
    if (rng.chance(0.6)) mb.shrub(u + (lu - u) * 0.45 + 2, v + (lv - v) * 0.45);
    if (rng.chance(0.5)) mb.palm(u + (lu - u) * 0.55 - 3, v + (lv - v) * 0.55);
  });
  // Inside the bend: two houses facing the front street, one facing the exit street, and a pocket green with a big
  // tree and a bench where the lane turns.
  const inU = (t) => (exitSide === 'right' ? u0 + 7 + t : u0 - 7 - t);
  for (const t of [1.5, 18]) { const u = inU(t); if (u > 6 && u < W - 6) { mb.house(u, 9.5, 10.5, 9.5, 0); mb.yard(u - 5.5, u + 5.5, 0, 4.5, u + (rng.chance(0.5) ? 2 : -2)); } }
  mb.house(exitSide === 'right' ? W - 8.5 : 8.5, D * 0.36, 9.5, 11, mb.face(dir, 0));
  const gu = exitSide === 'right' ? u0 + 14 : u0 - 14;
  mb.tree(gu, D * 0.42, 6, 10); mb.prop('bench', gu - 3, D * 0.42 + 2.5, mb.face(-dir, 0)); mb.shrub(gu + 3, D * 0.36, 1.1);
  // Lane furniture: palms along the outer verge, poles with wires, two streetlights, cars at the kerb, people.
  for (const ti of [2, 7, 12, 17]) { const [u, v] = offset(pts, -dir * 4.4)[ti]; if (u > 2 && u < W - 2 && v > 2) mb.palm(u, v); }
  mb.poles(offset(pts, dir * 4.2).filter((_, i) => i % 6 === 1));
  for (const ti of [5, 14]) { const [u, v] = offset(pts, dir * 4.1)[ti], [lu, lv] = pts[ti]; mb.light(u, v, mb.face(lu - u, lv - v)); }
  { const [u, v] = offset(pts, -dir * 2.0)[10], [u2, v2] = pts[11]; mb.car(u, v, mb.face(u2 - pts[10][0], v2 - pts[10][1])); }
  { const [u, v] = offset(pts, -dir * 5.2)[8]; mb.person(u, v, rng.range(-3, 3)); mb.person(u + 1.2, v + 0.5, rng.range(-3, 3)); }
  // Back strip (beyond the lane): houses facing the back street if it is open, backyard fences otherwise.
  if (sides.back) for (let u = 10; u < W - 8; u += 15) { mb.house(u, D - 9, 11, 9.5, Math.PI); mb.yard(u - 6, u + 6, D - 4.5, D, u); }
  return mb;
}

// ---- 2. Cul-de-sac ------------------------------------------------------------------------------------------------------
export function culdesac(rect, front, rng, sides) {
  const mb = new MB(rect, front, rng, sides), W = mb.W, D = mb.Dp;
  const cu = W / 2, R = 10.5, end = Math.min(D * 0.58, D - 24);
  lane(mb, [[cu, 0], [cu, end - R + 1]]);
  mb.cut('front', cu - 4.5, cu + 4.5);
  // Bulb: asphalt disc ringed by a rolled kerb, a planted island in the middle.
  const ring = (r, n = 28) => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cu + Math.cos(a) * r, end + Math.sin(a) * r]; });
  mb.pad('asphalt', ring(R, 32), CURB - 0.02, CURB + 0.005, 0xc8c6c2);
  mb.kerb(ring(R + 0.15, 40).filter(([u, v]) => v > end - R + 2 || Math.abs(u - cu) > 3.4));
  mb.pad('grass', ring(3.2, 20), CURB, CURB + 0.16);
  mb.kerb(ring(3.3, 24), rng.chance(0.5) ? [2, 3, 4, 14, 15, 16] : []);
  mb.palm(cu, end, 14);
  // Houses fanned around the bulb, driveways converging on it.
  const n = 5;
  for (let i = 0; i < n; i++) {
    const ang = Math.PI + (i / (n - 1)) * Math.PI; // pi .. 2pi: from the left, round the back, to the right
    const r = R + 12;
    const u = cu + Math.cos(ang) * r, v = end - Math.sin(ang) * r * 0.95;
    if (u < 6 || u > W - 6 || v > D - 6) continue;
    const yaw = mb.face(cu - u, end - v);
    mb.house(u, v, 10.5, 9.5, yaw);
    const du = (cu - u) / r, dv = (end - v) / r;
    mb.ribbon('concrete', [[u + du * 5.5, v + dv * 5.5], [cu - du * (R + 0.3), end - dv * (R + 0.3)]], 3.2, CURB + 0.03, 0xd0ccc4); // driveway
    if (rng.chance(0.55)) mb.car(u + du * 8.5, v + dv * 8.5, mb.face(du, dv));
    if (rng.chance(0.5)) mb.bin(u + du * 9.5 + dv * 2, v + dv * 9.5 - du * 2);
    if (rng.chance(0.4)) mb.shrub(u + du * 6 - dv * 3, v + dv * 6 + du * 3);
  }
  // Along the lane: a house each side facing it; perimeter houses facing the outer streets.
  for (const s of [-1, 1]) {
    const u = cu + s * 13;
    mb.house(u, 13, 10, 9.5, mb.face(-s, 0));
    mb.ribbon('concrete', [[u - s * 5, 13], [cu - s * 4.6, 13]], 1.1);
    if (rng.chance(0.6)) mb.palm(cu + s * 5.6, 8 + rng.range(0, 6));
  }
  if (sides.left) for (let v = 9; v < D - 8; v += 14) { mb.house(8, v, 9.5, 10.5, mb.face(-1, 0)); }
  if (sides.right) for (let v = 9; v < D - 8; v += 14) { mb.house(W - 8, v, 9.5, 10.5, mb.face(1, 0)); }
  if (sides.back) for (let u = 22; u < W - 20; u += 14) mb.house(u, D - 8, 11, 9.5, Math.PI);
  mb.light(cu + 4.3, end - R - 3, mb.face(-1, 0));
  mb.light(cu - R - 1.6, end, mb.face(1, 0));
  mb.poles([[cu + 4.6, 2], [cu + 4.6, end - R - 1], [cu + R + 1.5, end + 4]]);
  mb.person(cu + R - 2, end + 2, rng.range(-3, 3));
  return mb;
}

// ---- 3. Corner store ------------------------------------------------------------------------------------------------
export function cornerstore(rect, front, rng, sides) {
  const mb = new MB(rect, front, rng, sides), W = mb.W, D = mb.Dp;
  const left = sides.left || !sides.right; // the store takes the corner of the front street and an open side street
  const su = left ? 10.5 : W - 10.5, sideDir = left ? -1 : 1;
  // Parking lot between the store and the sidewalk, striped stalls with wheel stops.
  const pu0 = left ? 1 : W - 23, pu1 = left ? 23 : W - 1;
  mb.rect('asphalt', pu0, 0, pu1, 9, CURB - 0.02, CURB + 0.01, 0xb8b6b2);
  for (let u = pu0 + 2; u <= pu1 - 2; u += 2.8) { const p = mb.P(u, 5.5); mb.D.paint.push({ x: p.x, z: p.z, w: 0.12, d: 5, yaw: mb.Y(0), color: 0xe8e6e0, y: CURB + 0.012 }); mb.prop('wheelstop', u + 1.4, 7.6, 0); }
  mb.cut('front', pu0 + 3, pu1 - 3);
  const kind = rng.pick(['market', 'market', 'taco', 'discount']);
  const NAMES = { market: ['PALMETTO MART', 'LUCKY 7 MARKET', 'SUNRISE LIQUOR', 'EZ STOP', 'CORNER KING'], taco: ['TACOS LA PALMA', 'EL GALLO TACOS', 'TAQUERIA SOL', 'BURRITO HUT'], discount: ["MORALES DISCOUNT", "VEGA'S DISCOUNT", 'BIG SAVE', "RUIZ DISCOUNT"] };
  const sw0 = kind === 'taco' ? 11 : 19, sd0 = kind === 'taco' ? 8 : 12;
  mb.store(su, 15, sw0, sd0, 0, { kind, name: rng.pick(NAMES[kind]), wallColor: rng.pick([0xe0d6c0, 0xd8c8a8, 0xcfc8bc, 0xe6dcc6]), awning: rng.pick([0x2a5a3a, 0x8a2a24, 0x2a3a6a, 0xb8902a, 0xc83a2a]) });
  for (const [type, du, dv, yaw] of [['ice', 7.5, 8.4, 0], ['phone', -8.6, 8.5, 0], ['newsbox', 3.4, 8.6, 0], ['newsbox', 4.1, 8.6, 0], ['bench', -4, 8.7, 0], ['bollard', -2, 8.9, 0], ['bollard', 0, 8.9, 0], ['bollard', 2, 8.9, 0]]) mb.prop(type, su + du * (left ? 1 : -1), dv, yaw);
  mb.prop('dumpster', su + 6 * (left ? 1 : -1), 23.5, Math.PI);
  mb.car(su - 3 * sideDir, 4.5, Math.PI); mb.car(su + 5 * sideDir, 4.5, Math.PI);
  mb.person(su - 1, 9.3, 0.4); mb.person(su + 6 * (left ? 1 : -1), 9.6, -2.2); mb.person(su + 8 * (left ? 1 : -1), 9.2, 2.6);
  // Walk-up apartments next door, then houses.
  const au = left ? 37 : W - 37;
  mb.apartment(au, 13, 20, 12, 0, { floors: 2 });
  mb.rect('concrete', au - 9, 0, au + 9, 6.5, CURB - 0.02, CURB + 0.03, 0xd6d2ca);
  mb.palm(au - 11, 3); mb.palm(au + 11, 3);
  for (let u = left ? 58 : W - 58; left ? u < W - 6 : u > 6; u += left ? 13 : -13) { mb.house(u, 10.5, 10.5, 9.5, 0); mb.yard(u - 6, u + 6, 0, 5.5, u + 2); }
  // Houses along the side street and the back.
  const sideOpen = left ? sides.left : sides.right;
  if (sideOpen) for (let v = 33; v < D - 8; v += 13) mb.house(left ? 8 : W - 8, v, 9.5, 10.5, mb.face(sideDir, 0));
  if (sides.back) for (let u = 22; u < W - 10; u += 14) mb.house(u, D - 8.5, 11, 9.5, Math.PI);
  mb.tree(left ? 30 : W - 30, D * 0.6, 6, 10);
  mb.D.hydrants.push({ ...mb.P(left ? 1.2 : W - 1.2, 1.2), y: CURB });
  return mb;
}

// ---- 4. Alley of backyards -----------------------------------------------------------------------------------------
export function alley(rect, front, rng, sides) {
  const mb = new MB(rect, front, rng, sides), W = mb.W, D = mb.Dp;
  const av = D / 2, aw = 5.2;
  mb.rect('concrete', 0, av - aw / 2, W, av + aw / 2, CURB - 0.02, CURB + 0.02, 0xbab6ae);
  const c0 = mb.P(0, av), c1 = mb.P(W, av);
  mb.D.paint.push({ x: (c0.x + c1.x) / 2, z: (c0.z + c1.z) / 2, w: W, d: 0.35, yaw: mb.Y(0), color: 0x6a6660, y: CURB + 0.022 }); // centre drain
  if (sides.left) mb.cut('left', av - aw / 2, av + aw / 2);
  if (sides.right) mb.cut('right', av - aw / 2, av + aw / 2);
  const n = Math.max(3, Math.floor(W / 14)), lw = W / n;
  for (const row of [0, 1]) {
    const facesBack = row === 1;
    for (let i = 0; i < n; i++) {
      const u0 = i * lw, u1 = u0 + lw, uc = (u0 + u1) / 2;
      const hv = facesBack ? D - 8.5 : 8.5;
      if (facesBack && !sides.back) { /* back row faces the alley instead */ }
      const yaw = facesBack ? (sides.back ? Math.PI : 0) : 0;
      mb.house(uc, hv, Math.min(11, lw - 2.5), 9, yaw);
      if (!facesBack) mb.yard(u0, u1, 0, 4, uc + (rng.chance(0.5) ? 2.2 : -2.2));
      // Backyard: fence along the alley with a gate, a garage or shed, laundry line, bins at the gate.
      const fv = facesBack ? av + aw / 2 + 0.3 : av - aw / 2 - 0.3;
      const kind = rng.pick(['wood', 'wood', 'block', 'chain']);
      const gu = uc + rng.range(-2, 2);
      mb.fence(kind, u0 + 0.2, fv, gu - 0.7, fv); mb.fence(kind, gu + 0.7, fv, u1 - 0.2, fv);
      mb.fence(kind, u1 - 0.1, fv, u1 - 0.1, hv + (facesBack ? -4.5 : 4.5));
      if (rng.chance(0.5)) mb.shed(u0 + 3.6, fv + (facesBack ? 3.2 : -3.2), 5.6, 5.8, facesBack ? 0 : Math.PI, { kind: 'garage', color: rng.pick(WALL_COLORS.stucco) });
      else if (rng.chance(0.5)) mb.shed(u1 - 2.2, fv + (facesBack ? 2.4 : -2.4), 2.4, 2.0, facesBack ? 0 : Math.PI, { kind: 'shed', color: 0x8a8a7a, h: 2.3 });
      if (rng.chance(0.55)) { const a = mb.P(u0 + 2, (fv + hv) / 2), b = mb.P(u1 - 2, (fv + hv) / 2 + 0.5); mb.D.props.push({ type: 'laundry', a, b, y: CURB }); }
      mb.bin(gu + 1.2, fv + (facesBack ? -0.7 : 0.7));
      if (rng.chance(0.3)) mb.bin(gu + 2.0, fv + (facesBack ? -0.7 : 0.7));
    }
  }
  mb.prop('hoop', W * 0.55, av + aw / 2 - 0.2, Math.PI);
  mb.car(W * 0.3, av, mb.face(1, 0));
  mb.poles([[2, av + aw / 2 - 0.4], [W * 0.36, av + aw / 2 - 0.4], [W * 0.68, av + aw / 2 - 0.4], [W - 2, av + aw / 2 - 0.4]]);
  mb.person(W * 0.5, av + 0.5, 1.2); mb.person(W * 0.55, av - 0.8, -1.9);
  return mb;
}

// ---- 5. Warehouse block --------------------------------------------------------------------------------------------
export function warehouseBlock(rect, front, rng, sides) {
  const mb = new MB(rect, front, rng, sides), W = mb.W, D = mb.Dp;
  mb.rect('concrete', 1, 1, W - 1, D - 1, CURB - 0.02, CURB + 0.02, 0xa8a49c); // cracked yard
  const ww = Math.min(W - 14, 38), wd = Math.min(D * 0.48, 26);
  mb.warehouse(W / 2, D - wd / 2 - 4, ww, wd, 0, { doors: Math.max(2, Math.floor(ww / 11)), color: rng.pick([0xc0bcb2, 0xb4b0a6, 0xc8c0ae]), stripe: rng.pick([0x2a4a6a, 0x8a2a24, 0x3a5a3a]) });
  mb.shed(W / 2 - ww / 2 + 4, D - wd - 4 - 3, 7, 5, 0, { kind: 'office', color: 0xd0ccc0, h: 3.2 });
  // Fence with barbed wire along the street sides, a rolling gate on the front.
  const g0 = W / 2 - 5, g1 = W / 2 + 5;
  mb.fence('barbed', 0.6, 0.6, g0, 0.6); mb.fence('barbed', g1, 0.6, W - 0.6, 0.6);
  mb.cut('front', g0, g1);
  if (sides.left) mb.fence('barbed', 0.6, 0.6, 0.6, D - 0.6);
  if (sides.right) mb.fence('barbed', W - 0.6, 0.6, W - 0.6, D - 0.6);
  mb.truck(W / 2 - ww / 4, D - wd - 12, 0); mb.truck(W / 2 + ww / 4, D - wd - 9.5, 0.1, 0xb8b4a8);
  mb.prop('container', W - 7, D * 0.35, Math.PI / 2, rng.pick([0x8a3a2a, 0x2a5a7a, 0x4a6a3a]));
  for (let i = 0; i < 5; i++) mb.prop('pallets', 5 + rng.range(0, 8), 9 + i * 2.6, rng.range(-0.2, 0.2));
  mb.prop('dumpster', W - 5, 8, 0);
  mb.light(4, D * 0.5, mb.face(1, 0)); mb.light(W - 4, D * 0.65, mb.face(-1, 0));
  mb.person(W / 2 + 2, D - wd - 7, 0.3);
  return mb;
}

// ---- filler: a plain row of houses along one street, trees behind (city edges, leftover strips) ----------------------
export function houseRow(rect, front, rng) {
  const mb = new MB(rect, front, rng, { front: true }), W = mb.W, D = mb.Dp;
  const lot = 14;
  for (let u = 4 + lot / 2; u < W - lot / 2; u += lot + rng.range(0, 3)) {
    const d = Math.min(10, D - 8);
    if (d < 6) break;
    mb.house(u, 4.5 + d / 2, lot - 3, d, 0);
    mb.yard(u - lot / 2, u + lot / 2, 0, 4.5, u + (rng.chance(0.5) ? 2 : -2));
    if (D > 22 && rng.chance(0.6)) mb.tree(u + rng.range(-4, 4), Math.min(D - 4, 4.5 + d + 5), rng.range(4.5, 7), rng.range(8, 12));
    else if (D > 18 && rng.chance(0.4)) mb.palm(u + 5, 4.5 + d + 3);
  }
  return mb;
}

// ---- single lot: one building on a frontage rectangle facing its street (fills leftovers around businesses etc.) ----
// kind: 'house' | 'apartment' | 'workshop'.
export function lotFill(rect, side, rng, kind) {
  const mb = new MB(rect, side, rng, { front: true }), W = mb.W, D = mb.Dp;
  if (kind === 'workshop') {
    const w = Math.min(W - 2, 24), d = Math.min(D - 6, 16);
    mb.rect('concrete', 0.5, 0.5, W - 0.5, D - 0.5, CURB - 0.02, CURB + 0.02, 0xa8a49c);
    mb.warehouse(W / 2, D - d / 2 - 1, w, d, 0, { h: 6, doors: Math.max(1, Math.floor(w / 10)), color: rng.pick([0xc0bcb2, 0xb4b0a6, 0xc8c0ae, 0x9aa0a6]), stripe: rng.pick([0x2a4a6a, 0x8a2a24, 0x3a5a3a, 0xb8902a]) });
    if (rng.chance(0.5)) mb.truck(W / 2 + rng.range(-3, 3), D - d - 5, 0);
    if (rng.chance(0.5)) mb.prop('pallets', 2.5, 3, 0);
    mb.fence('chain', 0.5, 0.5, W / 2 - 4, 0.5); mb.fence('chain', W / 2 + 4, 0.5, W - 0.5, 0.5);
    mb.cut('front', W / 2 - 4, W / 2 + 4);
    return mb;
  }
  if (kind === 'shop') {
    const sk = rng.pick(['taco', 'discount', 'market']), w = sk === 'taco' ? Math.min(W - 2, 11) : Math.min(W - 1.5, 16), d = Math.min(D - 5, sk === 'taco' ? 8 : 11);
    mb.store(W / 2, 4 + d / 2, w, d, 0, { kind: sk, name: rng.pick({ taco: ['TACOS LA PALMA', 'EL GALLO TACOS', 'TAQUERIA SOL', 'BURRITO HUT'], discount: ["MORALES DISCOUNT", "VEGA'S DISCOUNT", 'BIG SAVE'], market: ['EZ STOP', 'CORNER KING', 'LUCKY 7 MARKET'] }[sk]), wallColor: rng.pick([0xe0d6c0, 0xd8c8a8, 0xe6dcc6]), awning: rng.pick([0x2a5a3a, 0x8a2a24, 0x2a3a6a, 0xc83a2a]) });
    mb.rect('concrete', 0.5, 0, W - 0.5, 4, CURB - 0.02, CURB + 0.03, 0xd6d2ca);
    if (rng.chance(0.5)) mb.prop('newsbox', 1.5, 1.5, 0);
    return mb;
  }
  if (kind === 'apartment' && W >= 14) {
    mb.apartment(W / 2, Math.min(D - 7, 4 + 6.5), W - 3, Math.min(12, D - 5), 0, { floors: rng.chance(0.4) ? 3 : 2 });
    mb.rect('concrete', 1.5, 0, W - 1.5, 4, CURB - 0.02, CURB + 0.03, 0xd6d2ca);
    if (rng.chance(0.6)) mb.palm(1.2, 2);
    return mb;
  }
  const w = Math.min(W - 2.5, 12.5), d = Math.min(D - 6, 10.5);
  if (w < 7 || d < 6) return mb;
  mb.house(W / 2, 4.5 + d / 2, w, d, 0);
  mb.yard(0, W, 0, 4.5, W / 2 + (rng.chance(0.5) ? 2 : -2));
  if (D > 4.5 + d + 5 && rng.chance(0.5)) mb.tree(W / 2 + rng.range(-3, 3), Math.min(D - 3, 4.5 + d + 4), rng.range(3.5, 5.5), rng.range(7, 10));
  return mb;
}

export const MODULES = { crescent, culdesac, cornerstore, alley, warehouse: warehouseBlock };
// Which modules suit a zone (weights).
export const ZONE_MODULES = {
  residential: [['crescent', 3], ['culdesac', 3], ['alley', 3], ['cornerstore', 2]],
  commercial: [['cornerstore', 3], ['alley', 2]],
  industrial: [['warehouse', 1]],
};
