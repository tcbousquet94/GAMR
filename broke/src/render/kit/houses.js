// Houses for the remastered look: a foundation plinth, walls built around real openings (so windows and doors are
// recessed, with casings, sills, head trim and sashes), corner boards and floor bands, roofs with an eave overhang,
// fascia, soffit, gutters and downspouts (hip, side gable, front gable or flat with parapet), porches with posts,
// railings and steps, chimneys, garage doors. Built in a house-local frame (origin at the footprint centre on the
// lot, street face toward +z) and rotated into place.

import * as THREE from 'three';
import { mat, tris } from './batch.js';
import { CURB, houseHeight, houseYaw } from '../../city/kitdata/data.js';
import { HOME, isHome, homeLayout } from '../../city/kitdata/home.js';

const FH = 2.9, T = 0.24, E = 0.55, PITCH = 0.42;
let FL = 0.45; // foundation height of the building being built (sheds and warehouses sit lower)
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

// Extra fields beyond a plain house: fl (foundation), height + floors for flat roofs, garage n with doorW / doorH /
// doorKey (roll-up doors), storefront (wide glazing), units (apartment doors on every floor), industrial (high windows).
export function buildHouse(B, h, rng) {
  FL = h.fl ?? 0.45;
  if (isHome(h) && !h.home) h = { ...h, home: true };
  const M = mat(h.x, h.y ?? CURB, h.z, houseYaw(h));
  const W = h.w, D = h.d;
  // Axis-aligned box in house-local space.
  const box = (key, x0, y0, z0, x1, y1, z1, color = 0xffffff) => {
    _a.set(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)); _b.set(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1));
    B.boxM(key, _b.x - _a.x, _b.y - _a.y, _b.z - _a.z, M.clone().multiply(mat((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2)), color, key === 'window' ? { uv: 'native' } : undefined);
  };
  const boxR = (key, w, hh, d, m, color) => B.boxM(key, w, hh, d, M.clone().multiply(m), color);
  const trim = h.trim, wallKey = h.wall, floors = h.floors || 1;
  const Yt = h.roof === 'flat' ? (h.height ?? FL + floors * FH) : houseHeight(h);
  const floorH = h.roof === 'flat' ? (Yt - FL) / floors : FH;

  // Foundation plinth, a touch proud of the walls.
  box('concrete', -W / 2 - 0.06, 0, -D / 2 - 0.06, W / 2 + 0.06, FL, D / 2 + 0.06, 0xb0aca4);

  // ---- walls with openings ------------------------------------------------------------------------------------------
  // A wall: origin (x,z) of its left end seen from outside, direction (dx,dz) along it, outward normal (nx,nz).
  const walls = [
    { o: [-W / 2, D / 2], d: [1, 0], n: [0, 1], L: W, front: true },
    { o: [W / 2, D / 2], d: [0, -1], n: [1, 0], L: D },
    { o: [W / 2, -D / 2], d: [-1, 0], n: [0, -1], L: W },
    { o: [-W / 2, -D / 2], d: [0, 1], n: [-1, 0], L: D },
  ];
  // Piece of wall between u0..u1 (along) and v0..v1 (height above lot), from the outer face inward by `t`.
  const piece = (w, key, u0, u1, v0, v1, color, out = 0, t = T) => {
    const [ox, oz] = w.o, [dx, dz] = w.d, [nx, nz] = w.n;
    box(key, ox + dx * u0 + nx * out, v0, oz + dz * u0 + nz * out, ox + dx * u1 - nx * (t - out), v1, oz + dz * u1 - nz * (t - out), color);
  };
  for (const w of walls) {
    const ops = openings(h, w, floors, floorH);
    for (let f = 0; f < floors; f++) {
      const y0 = FL + f * floorH, y1 = y0 + floorH;
      const key = f === 0 && h.wall2 ? h.wall2 : wallKey, color = f === 0 && h.wall2 ? h.wall2Color ?? 0xffffff : h.wallColor;
      const fo = ops.filter((o) => o.floor === f);
      // Slice the floor's wall into columns at every opening edge; fill each column except where an opening is.
      const cuts = [0, w.L, ...fo.flatMap((o) => [o.u0, o.u1])].sort((a, b) => a - b);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i], b = cuts[i + 1];
        if (b - a < 1e-3) continue;
        const o = fo.find((q) => q.u0 <= a + 1e-3 && q.u1 >= b - 1e-3);
        if (!o) { piece(w, key, a, b, y0, y1, color); continue; }
        if (o.v0 > 0) piece(w, key, a, b, y0, y0 + o.v0, color);
        piece(w, key, a, b, y0 + o.v1, y1, color);
      }
      for (const o of fo) opening(w, o, y0, piece, trim, h, rng, f);
      if (h.home && f === 0) {
        // Inside the home: the same columns lined in two-tone paint (dark wainscot, pale above) with a chair rail,
        // skirting and a crown moulding, leaving the openings clear.
        for (let i = 0; i < cuts.length - 1; i++) {
          const a = cuts[i], b = cuts[i + 1];
          if (b - a < 1e-3) continue;
          const o = fo.find((q) => q.u0 <= a + 1e-3 && q.u1 >= b - 1e-3);
          const spans = o ? [[0, o.v0], [o.v1, floorH]].filter(([p, q]) => q - p > 1e-3) : [[0, floorH]];
          const ia = Math.max(a, T - 0.001), ib = Math.min(b, w.L - T + 0.001); // inside the corners
          if (ib - ia < 1e-3) continue;
          for (const [p, q] of spans) lining(w, piece, ia, ib, y0 + p, y0 + q, y0);
        }
      }
      // Floor band between storeys.
      if (f > 0) piece(w, 'trim', -0.05, w.L + 0.05, y0 - 0.1, y0 + 0.12, trim, 0.035, 0.06);
    }
    // Corner board at the wall's left end (each corner gets one from each wall it joins).
    if (h.roof !== 'flat') { piece(w, 'trim', -0.04, 0.12, FL, Yt, trim, 0.03, 0.06); piece(w, 'trim', w.L - 0.12, w.L + 0.04, FL, Yt, trim, 0.03, 0.06); }
    // Skirt board at the bottom of the siding.
    piece(w, 'trim', -0.04, w.L + 0.04, FL - 0.02, FL + 0.16, trim, 0.025, 0.06);
  }

  // ---- roof ---------------------------------------------------------------------------------------------------------
  const roofFaces = [];
  const gutters = [];
  if (h.roof === 'hip') {
    const a = W / 2 + E, b = D / 2 + E, y = Yt + 0.12;
    const r = Math.min(a, b), Yr = y + r * PITCH;
    const rx = a - r, rz = b - r;
    roofFaces.push(
      [[-a, y, b], [a, y, b], [rx, Yr, rz]], [[-a, y, b], [rx, Yr, rz], [-rx, Yr, rz]],
      [[a, y, -b], [-a, y, -b], [-rx, Yr, -rz]], [[a, y, -b], [-rx, Yr, -rz], [rx, Yr, -rz]],
      [[a, y, b], [a, y, -b], [rx, Yr, -rz]], [[a, y, b], [rx, Yr, -rz], [rx, Yr, rz]],
      [[-a, y, -b], [-a, y, b], [-rx, Yr, rz]], [[-a, y, -b], [-rx, Yr, rz], [-rx, Yr, -rz]],
    );
    gutters.push(['x', b], ['x', -b], ['z', a], ['z', -a]);
    eaves(box, a, b, Yt, trim);
  } else if (h.roof === 'gable' || h.roof === 'gableFront') {
    // Ridge along x for 'gable' (eaves front and back), along z for 'gableFront' (gable faces the street).
    const front = h.roof === 'gableFront';
    const a = (front ? D : W) / 2 + E * 0.6, b = (front ? W : D) / 2 + E, y = Yt + 0.12, Yr = y + b * PITCH;
    const sw = (p) => (front ? [p[2], p[1], p[0]] : p); // swap x/z for a front gable
    roofFaces.push(
      [sw([-a, y, b]), sw([a, y, b]), sw([a, Yr, 0])], [sw([-a, y, b]), sw([a, Yr, 0]), sw([-a, Yr, 0])],
      [sw([a, y, -b]), sw([-a, y, -b]), sw([-a, Yr, 0])], [sw([a, y, -b]), sw([-a, Yr, 0]), sw([a, Yr, 0])],
    );
    gutters.push(front ? ['z', b] : ['x', b], front ? ['z', -b] : ['x', -b]);
    // Gable ends: wall material up to the ridge, set in from the rake.
    const g = (front ? D : W) / 2, hb = (front ? W : D) / 2, yE = y + E * PITCH;
    for (const s of [-1, 1]) {
      const pts = [[s * g, Yt, -hb], [s * g, Yt, hb], [s * g, yE, hb], [s * g, Yr - 0.05, 0], [s * g, yE, -hb]].map(sw);
      const faces = [[pts[0], pts[1], pts[2]], [pts[0], pts[2], pts[4]], [pts[4], pts[2], pts[3]]];
      B.add(wallKey === 'stucco' ? 'stucco' : 'siding', orient(tris(faces), sw([s * 99, 0, 0])), M, h.wallColor);
      // Gable vent.
      const vc = sw([s * (g + 0.02), (Yt + Yr) / 2, 0]);
      box('trim', vc[0] - (front ? 0.35 : 0.03), vc[1] - 0.25, vc[2] - (front ? 0.03 : 0.35), vc[0] + (front ? 0.35 : 0.03), vc[1] + 0.25, vc[2] + (front ? 0.03 : 0.35), trim);
    }
    // Rake boards along the sloped edges.
    for (const s of [-1, 1]) for (const t of [-1, 1]) {
      const len = Math.hypot(b, Yr - y), ang = Math.atan2(Yr - y, b);
      const c = sw([s * a, (y + Yr) / 2 - 0.05, t * b / 2]);
      boxR('trim', front ? len : 0.05, 0.2, front ? 0.05 : len, mat(c[0], c[1], c[2], 0, front ? 0 : t * ang, front ? -t * ang : 0), trim); // slopes down toward its eave
    }
    eaves(box, front ? b : a, front ? a : b, Yt, trim);
  } else {
    // Flat roof: tar and gravel inside a parapet with a coping.
    box('tarGravel', -W / 2 + T, Yt - 0.05, -D / 2 + T, W / 2 - T, Yt, D / 2 - T, 0xffffff);
    for (const w of walls) piece(w, wallKey, -0.001, w.L, Yt, Yt + 0.6, h.wallColor);
    for (const w of walls) piece(w, 'trim', -0.05, w.L + 0.05, Yt + 0.6, Yt + 0.68, trim, 0.05, T + 0.1);
    // Rooftop AC unit and vent stacks.
    box('metal', -2, Yt, -2, 0.2, Yt + 1.1, -0.6, 0xb8b8b4);
    box('metalPaint', 2.5, Yt, -1.5, 2.7, Yt + 0.9, -1.3, 0x6a6a68);
  }
  if (roofFaces.length) B.add('shingles', orient(tris(roofFaces), null, [0, Yt - 5, 0]), M, h.roofColor);
  // Gutters and downspouts.
  for (const [axis, at] of gutters) {
    const len = axis === 'x' ? W + 2 * E : D + 2 * E;
    if (axis === 'x') box('metalPaint', -len / 2, Yt - 0.1, at - 0.02, len / 2, Yt + 0.04, at + Math.sign(at) * 0.12, trim);
    else box('metalPaint', at - 0.02, Yt - 0.1, -len / 2, at + Math.sign(at) * 0.12, Yt + 0.04, len / 2, trim);
  }
  if (h.roof !== 'flat') for (const [sx, sz] of [[1, 1], [-1, -1]]) {
    const x = sx * (W / 2 + 0.06), z = sz * (D / 2 + 0.06);
    box('metalPaint', x - 0.05, 0.05, z - 0.05, x + 0.05, Yt - 0.05, z + 0.05, trim);
  }

  // ---- porch --------------------------------------------------------------------------------------------------------
  if (h.porch) porch(box, boxR, h, W, D, Yt, trim);
  if (h.home) {
    homeInterior(box, boxR, h, rng);
    // No porch: a concrete stoop up to the door.
    if (!h.porch) { const L = homeLayout(h); box('concrete', L.doorX - 0.8, 0, D / 2, L.doorX + 0.8, FL * 0.5, D / 2 + 0.7, 0xb0aca4); box('concrete', L.doorX - 0.8, 0, D / 2, L.doorX + 0.8, FL - 0.01, D / 2 + 0.35, 0xb0aca4); }
  }
  if (h.chimney) {
    const x = W / 2 - 1.6, z = -D / 2 + 1.2;
    box('brick', x - 0.5, 0, z - 0.4, x + 0.5, Yt + 2.6, z + 0.4, 0xffffff);
    box('concrete', x - 0.58, Yt + 2.6, z - 0.48, x + 0.58, Yt + 2.72, z + 0.48, 0x9a948c);
  }
}

// Interior wall finish for one span of a home's wall (heights v0..v1 absolute, floor at y0).
const WAIN = 0x3a4652, UPPER = 0x8a8678, WOOD = 0x4a3020;
function lining(w, piece, u0, u1, v0, v1, y0) {
  const band = (key, lo, hi, col, depth) => { const p = Math.max(v0, lo), q = Math.min(v1, hi); if (q - p > 1e-3) piece(w, key, u0, u1, p, q, col, -T, depth); };
  band('plaster', y0, y0 + 0.95, WAIN, 0.015);
  band('plaster', y0 + 0.95, y0 + FH, UPPER, 0.015);
  band('trim', y0 + 0.9, y0 + 1.0, WOOD, 0.045); // chair rail
  band('trim', y0, y0 + 0.13, WOOD, 0.035); // skirting
  band('trim', y0 + FH - 0.14, y0 + FH, WOOD, 0.05); // crown
}

// The home's rooms (layout from kitdata/home.js): wood floor and rug, ceiling with pendant lamps, the partition with a
// cased opening, sofa, coffee table with a bottle and ashtray, TV on a low unit between tall speakers, a poster and a
// framed picture, a potted plant; stairs with a banister up the left wall in two-storey houses; through the opening,
// a kitchen-diner with a green checker floor, honey-oak cabinets on two walls, sink, stove, an old fridge, a table and
// four chairs under a hanging lamp.
function homeInterior(box, boxR, h, rng) {
  const L = homeLayout(h), { a, b, zp, p, xo, zl, kz0, kz1, kz, tx } = L, F = FL, C = FL + FH;
  const fx = Object.fromEntries(L.fixtures.map((f) => [f.name, f]));
  // Floors: dark varnished boards in the living room, worn green-and-cream checker in the kitchen.
  box('planks', -a, F, zp - p, a, F + 0.012, b, 0x5a3a24);
  const sq = 0.5;
  for (let x = -a, i = 0; x < a - 0.01; x += sq, i++) for (let z = kz0, j = 0; z < kz1 - 0.01; z += sq, j++) box('tile', x, F, z, Math.min(a, x + sq), F + 0.014, Math.min(kz1, z + sq), (i + j) % 2 ? 0x3e5a48 : 0xb0ae98);
  // Ceiling.
  box('plaster', -a, C - 0.05, -b, a, C, b, 0x6e6a60);
  // Partition, lined both sides, with a cased opening.
  for (const [x0, x1] of [[-a, xo - HOME.openHalf], [xo + HOME.openHalf, a]]) {
    box('plaster', x0, F, zp - p, x1, C, zp + p, UPPER);
    for (const s of [-1, 1]) {
      const z = zp + s * p;
      box('plaster', x0, F, z, x1, F + 0.95, z + s * 0.015, WAIN);
      box('trim', x0, F + 0.9, z, x1, F + 1.0, z + s * 0.045, WOOD); box('trim', x0, F, z, x1, F + 0.13, z + s * 0.035, WOOD); box('trim', x0, C - 0.14, z, x1, C, z + s * 0.05, WOOD);
    }
  }
  box('plaster', xo - HOME.openHalf, F + 2.2, zp - p, xo + HOME.openHalf, C, zp + p, UPPER);
  for (const s of [-1, 1]) { // casing round the opening
    box('trim', xo - HOME.openHalf - 0.1, F, zp + s * p, xo - HOME.openHalf, F + 2.3, zp + s * (p + 0.04), WOOD);
    box('trim', xo + HOME.openHalf, F, zp + s * p, xo + HOME.openHalf + 0.1, F + 2.3, zp + s * (p + 0.04), WOOD);
    box('trim', xo - HOME.openHalf - 0.1, F + 2.2, zp + s * p, xo + HOME.openHalf + 0.1, F + 2.32, zp + s * (p + 0.04), WOOD);
  }
  for (const x of [xo - HOME.openHalf, xo + HOME.openHalf - 0.04]) box('trim', x, F, zp - p, x + 0.04, F + 2.2, zp + p, WOOD);
  box('trim', xo - HOME.openHalf, F + 2.16, zp - p, xo + HOME.openHalf, F + 2.2, zp + p, WOOD);
  // Pendant lamps: a cone shade on a cord.
  const pendant = (x, z, drop) => {
    box('metalPaint', x - 0.01, C - drop, z - 0.01, x + 0.01, C, z + 0.01, 0x2a2a2a);
    box('metalPaint', x - 0.28, C - drop - 0.22, z - 0.28, x + 0.28, C - drop - 0.12, z + 0.28, 0x6a6458);
    box('metalPaint', x - 0.16, C - drop - 0.12, z - 0.16, x + 0.16, C - drop, z + 0.16, 0x6a6458);
    box('trim', x - 0.22, C - drop - 0.24, z - 0.22, x + 0.22, C - drop - 0.22, z + 0.22, 0xfff0c8);
  };
  pendant((a - 3.0 + xo) / 2, zl + 0.3, 0.35);
  pendant(tx, kz, 0.5);

  // ---- living room ---------------------------------------------------------------------------------------------------
  box('trim', a - 3.9, F + 0.012, zl - 1.6, a - 0.9, F + 0.025, zl + 1.6, 0x3a3028); // rug
  box('trim', a - 3.75, F + 0.025, zl - 1.45, a - 1.05, F + 0.03, zl + 1.45, 0x4a3e30);
  // Sofa: worn olive fabric, back to the room, facing the TV (+x).
  const so = fx.sofa, SOFA = 0x5a5440;
  box('plaster', so.x0 + 0.05, F + 0.08, so.z0, so.x1, F + 0.45, so.z1, SOFA);
  box('plaster', so.x0, F + 0.08, so.z0, so.x0 + 0.28, F + 0.85, so.z1, SOFA); // back
  for (const z of [so.z0, so.z1 - 0.22]) box('plaster', so.x0, F + 0.08, z, so.x1, F + 0.62, z + 0.22, SOFA); // arms
  for (const z of [so.z0 + 0.24, (so.z0 + so.z1) / 2 + 0.01]) box('plaster', so.x0 + 0.28, F + 0.45, z, so.x1 - 0.04, F + 0.55, z + (so.z1 - so.z0) / 2 - 0.26, 0x625c48); // cushions
  for (const [x, z] of [[so.x0 + 0.1, so.z0 + 0.1], [so.x1 - 0.1, so.z0 + 0.1], [so.x0 + 0.1, so.z1 - 0.1], [so.x1 - 0.1, so.z1 - 0.1]]) box('trim', x - 0.04, F, z - 0.04, x + 0.04, F + 0.08, z + 0.04, 0x2a1e14);
  // Coffee table: a heavy wood top on legs, a bottle, an ashtray, a magazine.
  const ct = fx.table;
  box('planks', ct.x0, F + 0.36, ct.z0, ct.x1, F + 0.42, ct.z1, 0x6a4428);
  for (const [x, z] of [[ct.x0 + 0.06, ct.z0 + 0.06], [ct.x1 - 0.06, ct.z0 + 0.06], [ct.x0 + 0.06, ct.z1 - 0.06], [ct.x1 - 0.06, ct.z1 - 0.06]]) box('planks', x - 0.04, F, z - 0.04, x + 0.04, F + 0.36, z + 0.04, 0x5a3820);
  box('carGlass', (ct.x0 + ct.x1) / 2 - 0.04, F + 0.42, zl + 0.2, (ct.x0 + ct.x1) / 2 + 0.04, F + 0.66, zl + 0.28, 0x2a5a2a);
  box('metalPaint', ct.x0 + 0.2, F + 0.42, zl - 0.35, ct.x0 + 0.36, F + 0.45, zl - 0.19, 0x2a2a2c);
  box('trim', ct.x0 + 0.15, F + 0.42, zl - 0.05, ct.x0 + 0.45, F + 0.43, zl + 0.15, 0xd8d0c0);
  // TV on a low unit with a VCR, a tall speaker either side.
  const tv = fx.tv;
  box('planks', tv.x0, F, tv.z0, tv.x1, F + 0.5, tv.z1, 0x4a2c1a);
  box('metalPaint', tv.x0 + 0.08, F + 0.3, tv.z0 + 0.4, tv.x0 + 0.1, F + 0.38, tv.z1 - 0.4, 0x1a1a1c); // VCR face
  box('metalPaint', tv.x0 + 0.05, F + 0.5, zl - 0.6, tv.x1 - 0.02, F + 1.22, zl + 0.6, 0x18181a);
  box('carGlass', tv.x0 + 0.03, F + 0.56, zl - 0.52, tv.x0 + 0.05, F + 1.16, zl + 0.52, 0x5a7a9a); // screen
  for (const sp of [fx.speakerA, fx.speakerB]) {
    box('metalPaint', sp.x0, F, sp.z0, sp.x1, F + 1.05, sp.z1, 0x141416);
    for (const [y, r] of [[0.75, 0.1], [0.35, 0.14]]) box('rubber', sp.x0 - 0.01, F + y - r, (sp.z0 + sp.z1) / 2 - r, sp.x0, F + y + r, (sp.z0 + sp.z1) / 2 + r, 0x2a2a2c);
  }
  // Poster by the TV, a framed picture on the partition, a potted plant by the front window.
  box('trim', a - 0.015, F + 1.4, zl + 1.6, a, F + 2.3, zl + 2.2, rng.pick([0xc8a070, 0x6a8aa8, 0xb86a4a]));
  box('trim', a - 0.02, F + 1.45, zl + 1.65, a - 0.012, F + 2.25, zl + 2.15, rng.pick([0xe0b890, 0x2a6a8a, 0xd8c8a0]));
  const px = Math.min(a - 0.6, xo + HOME.openHalf + 1.2);
  box('trim', px - 0.35, F + 1.3, zp + p, px + 0.35, F + 1.8, zp + p + 0.04, 0x3a2414);
  box('trim', px - 0.28, F + 1.36, zp + p + 0.04, px + 0.28, F + 1.74, zp + p + 0.045, rng.pick([0x7a8a6a, 0x9a7a5a, 0x6a7a8a]));
  const pl = fx.plant;
  box('concrete', pl.x0 + 0.05, F, pl.z0 + 0.05, pl.x1 - 0.05, F + 0.32, pl.z1 - 0.05, 0xc8c0b0);
  for (let i = 0; i < 7; i++) { const ang = i * 0.9; box('trim', (pl.x0 + pl.x1) / 2 + Math.cos(ang) * 0.08 - 0.02, F + 0.3, (pl.z0 + pl.z1) / 2 + Math.sin(ang) * 0.08 - 0.02, (pl.x0 + pl.x1) / 2 + Math.cos(ang) * 0.12 + 0.02, F + 0.75 + (i % 3) * 0.12, (pl.z0 + pl.z1) / 2 + Math.sin(ang) * 0.12 + 0.02, 0x4a6a32); }
  // Stairs and banister.
  if (L.stairs) {
    const S = L.stairs, n = 12, run = (S.z1 - S.z0) / n, rise = FH / (n + 1);
    for (let i = 0; i < n; i++) {
      const z1 = S.z1 - i * run, y = F + (i + 1) * rise;
      box('planks', S.x0, F, z1 - run, S.x1, y, z1, 0x3a2a1e);
      box('trim', S.x0, y - 0.02, z1 - 0.03, S.x1, y + 0.01, z1 + 0.01, 0x2a1e14);
    }
    const x = S.x1 - 0.06, ang = Math.atan2(FH, S.z1 - S.z0), len = Math.hypot(FH, S.z1 - S.z0);
    box('planks', x - 0.07, F, S.z1 - 0.07, x + 0.07, F + 1.15, S.z1 + 0.07, 0x5a3a24); // newel post
    for (let k = 1; k < 8; k++) { const z = S.z1 - k * (S.z1 - S.z0) / 8, y = F + (k / 8) * FH * (n / (n + 1)); box('trim', x - 0.02, y, z - 0.02, x + 0.02, y + 0.85, z + 0.02, 0x5a3a24); }
    boxR('planks', 0.08, 0.08, len, mat(x, F + FH / 2 + 0.9, (S.z0 + S.z1) / 2, 0, ang), 0x5a3a24); // handrail
    box('planks', S.x1 - 0.03, F, S.z0, S.x1, F + 0.25, S.z1, 0x3a2a1e); // stringer
  }

  // ---- kitchen-diner -------------------------------------------------------------------------------------------------
  const OAK = 0xb08a4a, TOP = 0xc8c0a8;
  const cb = fx.counterBack, cs = fx.counterSide;
  const base = (x0, z0, x1, z1) => {
    box('planks', x0, F + 0.1, z0, x1, F + 0.88, z1, OAK);
    box('trim', x0, F, z0, x1, F + 0.1, z1, 0x2a2018); // toe kick
    box('concrete', x0 - 0.02, F + 0.88, z0 - 0.02, x1 + 0.02, F + 0.93, z1 + 0.02, TOP);
  };
  base(cb.x0, cb.z0, cb.x1, cb.z1); base(cs.x0, cs.z0, cs.x1, cs.z1);
  for (let x = cb.x0 + 0.6; x < cb.x1 - 0.1; x += 0.6) box('trim', x - 0.01, F + 0.14, cb.z1, x + 0.01, F + 0.84, cb.z1 + 0.01, 0x6a4a24); // door seams
  for (let z = cs.z0 + 0.6; z < cs.z1 - 0.1; z += 0.6) box('trim', cs.x1, F + 0.14, z - 0.01, cs.x1 + 0.01, F + 0.84, z + 0.01, 0x6a4a24);
  // Windows on the back wall: the sink under the middle one, upper cabinets between them.
  const n = Math.max(1, Math.floor(h.w / 3.4)), sp = h.w / n, wins = Array.from({ length: n }, (_, i) => h.w / 2 - sp * (i + 0.5));
  const sinkX = wins.reduce((q, x) => (Math.abs(x) < Math.abs(q) && x < cb.x1 - 0.6 ? x : q), wins[0]);
  box('metal', sinkX - 0.4, F + 0.8, cb.z0 + 0.12, sinkX + 0.4, F + 0.935, cb.z1 - 0.1, 0xb8b8b4);
  box('chrome', sinkX - 0.02, F + 0.93, cb.z0 + 0.06, sinkX + 0.02, F + 1.2, cb.z0 + 0.1, 0xffffff);
  box('chrome', sinkX - 0.02, F + 1.16, cb.z0 + 0.06, sinkX + 0.02, F + 1.2, cb.z0 + 0.28, 0xffffff);
  const stoveX = cb.x1 - 0.45;
  box('metalPaint', stoveX - 0.38, F + 0.1, cb.z0, stoveX + 0.38, F + 0.94, cb.z1 + 0.01, 0xd8d0c0);
  box('metalPaint', stoveX - 0.3, F + 0.25, cb.z1 + 0.01, stoveX + 0.3, F + 0.7, cb.z1 + 0.02, 0x2a2a2c); // oven door
  for (const [ox, oz] of [[-0.18, 0.18], [0.18, 0.18], [-0.18, 0.42], [0.18, 0.42]]) box('metalPaint', stoveX + ox - 0.1, F + 0.94, cb.z0 + oz - 0.1, stoveX + ox + 0.1, F + 0.96, cb.z0 + oz + 0.1, 0x1a1a1a);
  for (let x = cb.x0; x < cb.x1 - 0.05; x += 0.7) {
    const x1 = Math.min(cb.x1, x + 0.7);
    if (wins.some((w) => x1 > w - 0.75 && x < w + 0.75)) continue;
    box('planks', x + 0.01, F + 1.5, cb.z0, x1 - 0.01, F + 2.25, cb.z0 + 0.34, OAK);
    box('trim', (x + x1) / 2 - 0.01, F + 1.55, cb.z0 + 0.34, (x + x1) / 2 + 0.01, F + 2.2, cb.z0 + 0.35, 0x6a4a24);
  }
  const sn = Math.max(1, Math.floor(h.d / 3.4)), ssp = h.d / sn, sideWins = Array.from({ length: sn }, (_, i) => -h.d / 2 + ssp * (i + 0.5));
  for (let z = cs.z0; z < cs.z1 - 0.05; z += 0.7) {
    const z1 = Math.min(cs.z1, z + 0.7);
    if (sideWins.some((w) => z1 > w - 0.7 && z < w + 0.7)) continue;
    box('planks', cs.x0, F + 1.5, z + 0.01, cs.x0 + 0.34, F + 2.25, z1 - 0.01, OAK);
  }
  // Old almond fridge.
  const fr = fx.fridge;
  box('metalPaint', fr.x0, F, fr.z0, fr.x1, F + 1.8, fr.z1, 0xd8d2bc);
  box('trim', fr.x0, F + 1.18, fr.z1, fr.x1, F + 1.2, fr.z1 + 0.01, 0x8a8678);
  box('chrome', fr.x0 + 0.08, F + 0.8, fr.z1, fr.x0 + 0.11, F + 1.1, fr.z1 + 0.04, 0xffffff);
  // Clutter on the counter: a kettle, a toaster, a bread box.
  box('metalPaint', cb.x0 + 0.4, F + 0.93, cb.z0 + 0.15, cb.x0 + 0.65, F + 1.15, cb.z0 + 0.4, 0xc8c4bc);
  box('metalPaint', sinkX + 0.7, F + 0.93, cb.z0 + 0.12, sinkX + 1.0, F + 1.12, cb.z0 + 0.32, 0x8a8a88);
  // Table and chairs.
  const dt = fx.dining;
  box('planks', dt.x0, F + 0.7, dt.z0, dt.x1, F + 0.76, dt.z1, 0x3a2416);
  for (const [x, z] of [[dt.x0 + 0.06, dt.z0 + 0.06], [dt.x1 - 0.06, dt.z0 + 0.06], [dt.x0 + 0.06, dt.z1 - 0.06], [dt.x1 - 0.06, dt.z1 - 0.06]]) box('planks', x - 0.03, F, z - 0.03, x + 0.03, F + 0.7, z + 0.03, 0x2a1a10);
  for (const [x, z, fxd, fzd] of L.chairs) {
    box('planks', x - 0.21, F + 0.44, z - 0.21, x + 0.21, F + 0.48, z + 0.21, 0x2a1a10);
    for (const [ox, oz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box('planks', x + ox - 0.02, F, z + oz - 0.02, x + ox + 0.02, F + 0.44, z + oz + 0.02, 0x2a1a10);
    // Ladder back on the side away from the table.
    const bx = x - fxd * 0.19, bz = z - fzd * 0.19;
    if (fxd) for (const y of [0.62, 0.78, 0.92]) box('planks', bx - 0.02, F + y, z - 0.2, bx + 0.02, F + y + 0.05, z + 0.2, 0x2a1a10);
    else for (const y of [0.62, 0.78, 0.92]) box('planks', x - 0.2, F + y, bz - 0.02, x + 0.2, F + y + 0.05, bz + 0.02, 0x2a1a10);
    for (const s of [-1, 1]) { if (fxd) box('planks', bx - 0.02, F + 0.44, z + s * 0.18 - 0.02, bx + 0.02, F + 0.98, z + s * 0.18 + 0.02, 0x2a1a10); else box('planks', x + s * 0.18 - 0.02, F + 0.44, bz - 0.02, x + s * 0.18 + 0.02, F + 0.98, bz + 0.02, 0x2a1a10); }
  }
  box('trim', dt.x0 + 0.3, F + 0.76, dt.z0 + 0.2, dt.x0 + 0.6, F + 0.77, dt.z0 + 0.45, 0xe8e4dc); // newspaper
  // Kitchen walls a paler cream above the counters.
  box('plaster', -a + 0.016, F + 0.93, kz0 + 0.016, a - 0.016, F + 1.5, kz0 + 0.02, 0xb8b096);
}

// Eave soffit (under the overhang) and fascia boards around it.
function eaves(box, a, b, Yt, trim) {
  box('trim', -a, Yt - 0.06, -b, a, Yt + 0.1, b, trim);
  box('trim', -a - 0.04, Yt - 0.12, b, a + 0.04, Yt + 0.18, b + 0.05, trim);
  box('trim', -a - 0.04, Yt - 0.12, -b - 0.05, a + 0.04, Yt + 0.18, -b, trim);
  box('trim', a, Yt - 0.12, -b, a + 0.05, Yt + 0.18, b, trim);
  box('trim', -a - 0.05, Yt - 0.12, -b, -a, Yt + 0.18, b, trim);
}

// Flip each triangle so its normal points away from `center` (or along `dir` if given).
function orient(g, dir, center = [0, 0, 0]) {
  const p = g.attributes.position;
  const A = new THREE.Vector3(), Bv = new THREE.Vector3(), C = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    A.fromBufferAttribute(p, i); Bv.fromBufferAttribute(p, i + 1); C.fromBufferAttribute(p, i + 2);
    n.subVectors(Bv, A).cross(C.clone().sub(A));
    const want = dir ? new THREE.Vector3(...dir) : c.addVectors(A, Bv).add(C).multiplyScalar(1 / 3).sub(new THREE.Vector3(...center));
    if (n.dot(want) < 0) { p.setXYZ(i + 1, C.x, C.y, C.z); p.setXYZ(i + 2, Bv.x, Bv.y, Bv.z); }
  }
  g.computeVertexNormals();
  return g;
}

const doorU = (h, W) => (h.porch?.steps === 'left' ? 2.2 : W / 2 + (h.w > 14 ? -1.6 : 0.4));

// Openings for one wall: windows evenly spaced per floor, the front door, garage doors.
function openings(h, w, floors, floorH) {
  const out = [];
  if (h.garage && w.front) {
    const gw = h.doorW ?? 3.0, n = h.garage, gap = (w.L - n * gw) / (n + 1);
    for (let i = 0; i < n; i++) out.push({ floor: 0, kind: 'garage', u0: gap + i * (gw + gap), u1: gap + i * (gw + gap) + gw, v0: 0, v1: h.doorH ?? 2.6 });
    return out;
  }
  if (h.garage) {
    if (!w.front && w.L < 12) out.push({ floor: 0, kind: 'door', u0: w.L / 2 - 0.45, u1: w.L / 2 + 0.45, v0: 0, v1: 2.1 });
    if (h.industrial) for (let u = 3; u < w.L - 3; u += 6) out.push({ floor: 0, kind: 'window', u0: u, u1: u + 2.2, v0: floorH - 1.7, v1: floorH - 0.9 });
    return out;
  }
  if (h.storefront && w.front) {
    const dc = w.L / 2;
    out.push({ floor: 0, kind: 'door', u0: dc - 0.9, u1: dc + 0.9, v0: 0, v1: 2.3, glass: true });
    for (const [a, b] of [[0.7, dc - 1.3], [dc + 1.3, w.L - 0.7]]) { const n = Math.max(1, Math.round((b - a) / 2.6)), pw = (b - a) / n; for (let i = 0; i < n; i++) out.push({ floor: 0, kind: 'window', u0: a + i * pw + 0.06, u1: a + (i + 1) * pw - 0.06, v0: 0.45, v1: 2.75, shop: true }); }
    // Upper floors of a storefront block: ordinary windows.
    const ww = h.winW ?? 1.2, wsp = h.winSp ?? 3.2;
    for (let f = 1; f < floors; f++) { const n = Math.max(1, Math.floor(w.L / wsp)), sp = w.L / n; for (let i = 0; i < n; i++) out.push({ floor: f, kind: 'window', u0: sp * (i + 0.5) - ww / 2, u1: sp * (i + 0.5) + ww / 2, v0: h.winTall ? 0.6 : 0.9, v1: 2.35 }); }
    return out;
  }
  if (h.units && w.front) {
    const n = Math.max(1, Math.floor(w.L / 5.5)), uw = w.L / n;
    for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) {
      out.push({ floor: f, kind: 'door', u0: i * uw + 0.7, u1: i * uw + 1.62, v0: 0, v1: 2.15 });
      out.push({ floor: f, kind: 'window', u0: i * uw + 2.4, u1: i * uw + uw - 0.8, v0: 0.95, v1: 2.25 });
    }
    return out;
  }
  const door = w.front ? doorU(h, w.L) : null;
  for (let f = 0; f < floors; f++) {
    const n = Math.max(1, Math.floor(w.L / 3.4)), sp = w.L / n;
    for (let i = 0; i < n; i++) {
      const c = sp * (i + 0.5), ww = w.front ? 1.2 : 1.0;
      if (f === 0 && door != null && Math.abs(c - door) < 1.6) continue;
      out.push({ floor: f, kind: 'window', u0: c - ww / 2, u1: c + ww / 2, v0: 0.9, v1: 2.35 });
    }
    if (f === 0 && door != null) out.push({ floor: 0, kind: 'door', u0: door - (h.home ? HOME.doorHalf : 0.48), u1: door + (h.home ? HOME.doorHalf : 0.48), v0: 0, v1: h.home ? HOME.doorH : 2.15 });
  }
  return out;
}

// Fill one opening: recessed glass/door/garage panel, sash frame, casing, sill and head trim.
function opening(w, o, y0, piece, trim, h, rng, floor) {
  const { u0, u1 } = o, v0 = y0 + o.v0, v1 = y0 + o.v1;
  if (o.kind === 'garage') {
    piece(w, h.doorKey ?? 'garageDoor', u0, u1, v0, v1, h.doorColor ?? 0xe8e6e0, -0.18, 0.05);
    piece(w, 'trim', u0 - 0.12, u0, v0, v1 + 0.12, trim, 0.03, 0.08); piece(w, 'trim', u1, u1 + 0.12, v0, v1 + 0.12, trim, 0.03, 0.08);
    piece(w, 'trim', u0, u1, v1, v1 + 0.12, trim, 0.03, 0.08);
    return;
  }
  if (o.kind === 'door' && h.walkIn && o.glass) {
    // A walk-in shop's door stands open: just the aluminium frame (jambs, head) around the doorway.
    piece(w, 'metalPaint', u0, u0 + 0.06, v0, v1, 0x8a8e94, 0.02, T + 0.04); piece(w, 'metalPaint', u1 - 0.06, u1, v0, v1, 0x8a8e94, 0.02, T + 0.04);
    piece(w, 'metalPaint', u0, u1, v1 - 0.08, v1, 0x8a8e94, 0.02, T + 0.04);
    return;
  }
  if (o.kind === 'door' && h.home) {
    // The front door stands open, swung in against its hinge side: jambs, head, threshold and the door leaf.
    piece(w, 'trim', u0, u0 + 0.07, v0, v1, trim, 0.02, T + 0.04); piece(w, 'trim', u1 - 0.07, u1, v0, v1, trim, 0.02, T + 0.04);
    piece(w, 'trim', u0, u1, v1 - 0.07, v1, trim, 0.02, T + 0.04); piece(w, 'planks', u0, u1, v0, v0 + 0.02, 0x5a3a24, 0.02, T + 0.04);
    const [ox, oz] = w.o, [dx, dz] = w.d, [nx, nz] = w.n, hx = ox + dx * (u0 + 0.08), hz = oz + dz * (u0 + 0.08), col = h.door ?? 0x5a4030;
    const leaf = (along0, along1, y0, y1, out0, out1, c) => piece({ o: [hx - nx * T, hz - nz * T], d: [-nx, -nz], n: [dx, dz], L: 1 }, 'trim', along0, along1, y0, y1, c, out0, out1);
    leaf(0, 1.06, v0 + 0.02, v1 - 0.08, 0.05, 0.05, col);
    for (const [a, b] of [[0.3, 0.95], [1.15, 1.9]]) { leaf(0.14, 0.48, v0 + a, v0 + b, 0.07, 0.03, col); leaf(0.58, 0.92, v0 + a, v0 + b, 0.07, 0.03, col); }
    leaf(0.9, 0.96, v0 + 0.95, v0 + 1.02, 0.09, 0.04, 0xc8b878);
    piece(w, 'trim', u0 - 0.09, u0, v0, v1, trim, 0.025, 0.05); piece(w, 'trim', u1, u1 + 0.09, v0, v1, trim, 0.025, 0.05);
    piece(w, 'trim', u0 - 0.13, u1 + 0.13, v1, v1 + 0.13, trim, 0.04, 0.07);
    return;
  }
  if (o.kind === 'window' && h.home) {
    // Glass you can see through, a sash frame, venetian blinds part-drawn inside, sill and casing.
    piece(w, 'shopGlass', u0, u1, v0, v1, 0xffffff, -0.13, 0.03);
    piece(w, 'trim', u0, u0 + 0.06, v0, v1, trim, -0.07, 0.07); piece(w, 'trim', u1 - 0.06, u1, v0, v1, trim, -0.07, 0.07);
    piece(w, 'trim', u0, u1, v1 - 0.06, v1, trim, -0.07, 0.07); piece(w, 'trim', u0, u1, v0, v0 + 0.06, trim, -0.07, 0.07);
    piece(w, 'trim', u0, u1, (v0 + v1) / 2 - 0.03, (v0 + v1) / 2 + 0.03, trim, -0.09, 0.05);
    const drop = v1 - (v1 - v0) * (0.35 + rng.next() * 0.35);
    for (let y = v1 - 0.06; y > drop; y -= 0.07) piece(w, 'trim', u0 + 0.02, u1 - 0.02, y - 0.03, y, 0xd8d0bc, -T + 0.06, 0.04);
    piece(w, 'trim', u0 - 0.02, u1 + 0.02, drop - 0.05, drop, 0xc8c0ac, -T + 0.07, 0.06);
    piece(w, 'trim', u0 - 0.1, u1 + 0.1, v0 - 0.06, v0, trim, 0.07, 0.12);
    if (floor === 0 && h.bars) for (let b = u0 + 0.12; b < u1 - 0.05; b += 0.13) piece(w, 'metalPaint', b - 0.012, b + 0.012, v0, v1, 0x2a2a2c, 0.06, 0.03);
    piece(w, 'trim', u0 - 0.09, u0, v0, v1, trim, 0.025, 0.05); piece(w, 'trim', u1, u1 + 0.09, v0, v1, trim, 0.025, 0.05);
    piece(w, 'trim', u0 - 0.13, u1 + 0.13, v1, v1 + 0.13, trim, 0.04, 0.07);
    // Inside: an interior sill and casing.
    piece(w, 'trim', u0 - 0.08, u1 + 0.08, v0 - 0.05, v0, WOOD, -T + 0.0, 0.08);
    return;
  }
  if (o.kind === 'door') {
    piece(w, 'trim', u0, u1, v0 + FL * 0, v1, h.door ?? 0x5a4030, -0.12, 0.05);
    // Raised panels on the door.
    for (const [a, b] of [[0.3, 0.95], [1.15, 1.9]]) { piece(w, 'trim', u0 + 0.14, (u0 + u1) / 2 - 0.05, v0 + a, v0 + b, h.door ?? 0x5a4030, -0.1, 0.03); piece(w, 'trim', (u0 + u1) / 2 + 0.05, u1 - 0.14, v0 + a, v0 + b, h.door ?? 0x5a4030, -0.1, 0.03); }
    piece(w, 'chrome', u1 - 0.16, u1 - 0.1, v0 + 0.95, v0 + 1.02, 0xffffff, -0.07, 0.04);
  } else if (h.walkIn && o.shop) {
    // Shop glass you can see the room through, in a slim aluminium frame.
    piece(w, 'shopGlass', u0, u1, v0, v1, 0xffffff, -0.13, 0.03);
    piece(w, 'metalPaint', u0, u0 + 0.06, v0, v1, 0x8a8e94, -0.07, 0.07); piece(w, 'metalPaint', u1 - 0.06, u1, v0, v1, 0x8a8e94, -0.07, 0.07);
    piece(w, 'metalPaint', u0, u1, v1 - 0.06, v1, 0x8a8e94, -0.07, 0.07); piece(w, 'metalPaint', u0, u1, v0, v0 + 0.06, 0x8a8e94, -0.07, 0.07);
    piece(w, 'trim', u0 - 0.1, u1 + 0.1, v0 - 0.06, v0, trim, 0.07, 0.12);
    return;
  } else {
    piece(w, 'window', u0, u1, v0, v1, 0xffffff, -0.13, 0.03);
    // Sash frame inside the reveal: sides, head, sill rail and the meeting rail of a double-hung window.
    piece(w, 'trim', u0, u0 + 0.06, v0, v1, trim, -0.07, 0.07); piece(w, 'trim', u1 - 0.06, u1, v0, v1, trim, -0.07, 0.07);
    piece(w, 'trim', u0, u1, v1 - 0.06, v1, trim, -0.07, 0.07); piece(w, 'trim', u0, u1, v0, v0 + 0.06, trim, -0.07, 0.07);
    piece(w, 'trim', u0, u1, (v0 + v1) / 2 - 0.03, (v0 + v1) / 2 + 0.03, trim, -0.09, 0.05);
    // Sill, proud of the wall.
    piece(w, 'trim', u0 - 0.1, u1 + 0.1, v0 - 0.06, v0, trim, 0.07, 0.12);
    // Lived-in details: security bars on some ground floors, the odd window AC unit.
    if (floor === 0 && h.bars) for (let b = u0 + 0.12; b < u1 - 0.05; b += 0.13) piece(w, 'metalPaint', b - 0.012, b + 0.012, v0, v1, 0x2a2a2c, 0.06, 0.03);
    if (floor === 0 && h.bars) for (const yy of [v0 + 0.3, v1 - 0.3]) piece(w, 'metalPaint', u0, u1, yy - 0.015, yy + 0.015, 0x2a2a2c, 0.06, 0.03);
    else if (rng.chance(0.14)) { piece(w, 'metal', u0 + 0.15, u1 - 0.15, v0 + 0.02, v0 + 0.42, 0xc8c6c0, 0.42, 0.5); piece(w, 'trim', u0 + 0.12, u1 - 0.12, v0 - 0.08, v0 - 0.02, 0x6a6a68, 0.3, 0.32); }
  }
  // Casing and head trim on the face.
  piece(w, 'trim', u0 - 0.09, u0, v0, v1, trim, 0.025, 0.05); piece(w, 'trim', u1, u1 + 0.09, v0, v1, trim, 0.025, 0.05);
  piece(w, 'trim', u0 - 0.13, u1 + 0.13, v1, v1 + 0.13, trim, 0.04, 0.07);
}

function porch(box, boxR, h, W, D, Yt, trim) {
  const d = h.porch.depth, x0 = -W / 2 + 0.5, x1 = W / 2 - 0.5, z0 = D / 2, z1 = D / 2 + d;
  const deckY = FL, roofY = h.floors > 1 ? FL + FH - 0.15 : Yt - 0.05;
  box('planks', x0, 0, z0, x1, deckY, z1, 0xb8a890);
  box('trim', x0 - 0.03, 0, z1 - 0.02, x1 + 0.03, deckY - 0.04, z1 + 0.03, trim); // skirt board
  // Steps.
  const sx = h.porch.steps === 'left' ? x0 + 1.4 : (x0 + x1) / 2, sw = 1.5, n = 3;
  for (let i = 0; i < n; i++) box('planks', sx - sw / 2, 0, z1 + (n - 1 - i) * 0.3, sx + sw / 2, deckY * (i + 1) / n, z1 + (n - i) * 0.3, 0xa89880);
  // Posts and porch roof.
  const nPosts = Math.max(2, Math.round((x1 - x0) / 2.8) + 1);
  for (let i = 0; i < nPosts; i++) {
    const x = x0 + 0.1 + (x1 - x0 - 0.2) * i / (nPosts - 1);
    box('trim', x - 0.08, deckY, z1 - 0.26, x + 0.08, roofY, z1 - 0.1, trim);
    box('trim', x - 0.11, deckY, z1 - 0.29, x + 0.11, deckY + 0.2, z1 - 0.07, trim);
  }
  // Shed roof sloping away from the house.
  const rise = 0.45, len = Math.hypot(d + 0.4, rise), ang = Math.atan2(rise, d + 0.4);
  boxR('shingles', x1 - x0 + 0.6, 0.08, len, mat(0, roofY + rise / 2 + 0.12, z0 + (d + 0.4) / 2, 0, ang), h.roofColor);
  boxR('trim', x1 - x0 + 0.5, 0.06, len, mat(0, roofY + rise / 2 + 0.03, z0 + (d + 0.4) / 2, 0, ang), trim);
  box('trim', x0 - 0.3, roofY - 0.06, z1 + 0.32, x1 + 0.3, roofY + 0.2, z1 + 0.38, trim); // fascia
  box('metalPaint', x0 - 0.3, roofY - 0.05, z1 + 0.38, x1 + 0.3, roofY + 0.08, z1 + 0.5, trim); // gutter
  // Railing along the front (gap at the steps) and the ends.
  const rail = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), alongX = Math.abs(bx - ax) > Math.abs(bz - az);
    box('trim', Math.min(ax, bx), deckY + 0.86, Math.min(az, bz) - 0.04, Math.max(ax, bx), deckY + 0.94, Math.max(az, bz) + 0.04, trim);
    box('trim', Math.min(ax, bx), deckY + 0.08, Math.min(az, bz) - 0.03, Math.max(ax, bx), deckY + 0.14, Math.max(az, bz) + 0.03, trim);
    for (let t = 0.12; t < L - 0.05; t += 0.13) {
      const x = alongX ? Math.min(ax, bx) + t : ax, z = alongX ? az : Math.min(az, bz) + t;
      box('trim', x - 0.022, deckY + 0.14, z - 0.022, x + 0.022, deckY + 0.86, z + 0.022, trim);
    }
  };
  if (h.porch.railing !== false) {
    const rz = z1 - 0.18;
    if (sx - sw / 2 - x0 > 0.4) rail(x0, rz, sx - sw / 2, rz);
    if (x1 - (sx + sw / 2) > 0.4) rail(sx + sw / 2, rz, x1, rz);
    rail(x0 + 0.05, z0 + 0.05, x0 + 0.05, rz); rail(x1 - 0.05, z0 + 0.05, x1 - 0.05, rz);
    // Stair handrails.
    for (const s of [-1, 1]) {
      const hx = sx + s * (sw / 2 - 0.05), L = Math.hypot(0.9, deckY), ang = Math.atan2(deckY, 0.9);
      boxR('trim', 0.05, 0.07, L + 0.1, mat(hx, deckY / 2 + 0.88, z1 + 0.45, 0, ang), trim);
      box('trim', hx - 0.035, 0, z1 + 0.84, hx + 0.035, 0.95, z1 + 0.9, trim);
    }
  }
}
