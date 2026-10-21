// Houses for the remastered look: a foundation plinth, walls built around real openings (so windows and doors are
// recessed, with casings, sills, head trim and sashes), corner boards and floor bands, roofs with an eave overhang,
// fascia, soffit, gutters and downspouts (hip, side gable, front gable or flat with parapet), porches with posts,
// railings and steps, chimneys, garage doors. Built in a house-local frame (origin at the footprint centre on the
// lot, street face toward +z) and rotated into place.

import * as THREE from 'three';
import { mat, tris } from './batch.js';
import { CURB_H, houseHeight } from '../../hero/layout.js';

const YAW = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };
const FL = 0.45, FH = 2.9, T = 0.24, E = 0.55, PITCH = 0.42;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export function buildHouse(B, h, rng) {
  const M = mat(h.x, CURB_H, h.z, YAW[h.front]);
  const W = h.w, D = h.d;
  // Axis-aligned box in house-local space.
  const box = (key, x0, y0, z0, x1, y1, z1, color = 0xffffff) => {
    _a.set(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)); _b.set(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1));
    B.boxM(key, _b.x - _a.x, _b.y - _a.y, _b.z - _a.z, M.clone().multiply(mat((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2)), color, key === 'window' ? { uv: 'native' } : undefined);
  };
  const boxR = (key, w, hh, d, m, color) => B.boxM(key, w, hh, d, M.clone().multiply(m), color);
  const trim = h.trim, wallKey = h.wall, Yt = h.roof === 'flat' ? (h.height ?? 3.6) : houseHeight(h);
  const floors = h.roof === 'flat' ? 1 : h.floors;
  const floorH = h.roof === 'flat' ? Yt - FL : FH;

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
      boxR('trim', front ? len : 0.05, 0.2, front ? 0.05 : len, mat(c[0], c[1], c[2], 0, front ? 0 : -t * ang, front ? t * ang : 0), trim);
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
  if (h.chimney) {
    const x = W / 2 - 1.6, z = -D / 2 + 1.2;
    box('brick', x - 0.5, 0, z - 0.4, x + 0.5, Yt + 2.6, z + 0.4, 0xffffff);
    box('concrete', x - 0.58, Yt + 2.6, z - 0.48, x + 0.58, Yt + 2.72, z + 0.48, 0x9a948c);
  }
  // Door path from the sidewalk and a mailbox.
  if (!h.garage) {
    const px = h.porch?.steps === 'left' ? -W / 2 + 2.2 : doorU(h, W) - W / 2;
    box('concrete', px - 0.6, 0.0, D / 2 + (h.porch ? h.porch.depth + 0.9 : 0.1), px + 0.6, 0.035, D / 2 + 9, 0xc8c4bc);
  }
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
    const gw = 3.0, n = h.garage, gap = (w.L - n * gw) / (n + 1);
    for (let i = 0; i < n; i++) out.push({ floor: 0, kind: 'garage', u0: gap + i * (gw + gap), u1: gap + i * (gw + gap) + gw, v0: 0, v1: 2.6 });
    return out;
  }
  if (h.garage) { if (!w.front && w.L < 12) out.push({ floor: 0, kind: 'door', u0: w.L / 2 - 0.45, u1: w.L / 2 + 0.45, v0: 0, v1: 2.1 }); return out; }
  const door = w.front ? doorU(h, w.L) : null;
  for (let f = 0; f < floors; f++) {
    const n = Math.max(1, Math.floor(w.L / 3.4)), sp = w.L / n;
    for (let i = 0; i < n; i++) {
      const c = sp * (i + 0.5), ww = w.front ? 1.2 : 1.0;
      if (f === 0 && door != null && Math.abs(c - door) < 1.6) continue;
      out.push({ floor: f, kind: 'window', u0: c - ww / 2, u1: c + ww / 2, v0: 0.9, v1: 2.35 });
    }
    if (f === 0 && door != null) out.push({ floor: 0, kind: 'door', u0: door - 0.48, u1: door + 0.48, v0: 0, v1: 2.15 });
  }
  return out;
}

// Fill one opening: recessed glass/door/garage panel, sash frame, casing, sill and head trim.
function opening(w, o, y0, piece, trim, h, rng, floor) {
  const { u0, u1 } = o, v0 = y0 + o.v0, v1 = y0 + o.v1;
  if (o.kind === 'garage') {
    piece(w, 'garageDoor', u0, u1, v0, v1, 0xe8e6e0, -0.18, 0.05);
    piece(w, 'trim', u0 - 0.12, u0, v0, v1 + 0.12, trim, 0.03, 0.08); piece(w, 'trim', u1, u1 + 0.12, v0, v1 + 0.12, trim, 0.03, 0.08);
    piece(w, 'trim', u0, u1, v1, v1 + 0.12, trim, 0.03, 0.08);
    return;
  }
  if (o.kind === 'door') {
    piece(w, 'trim', u0, u1, v0 + FL * 0, v1, h.door ?? 0x5a4030, -0.12, 0.05);
    // Raised panels on the door.
    for (const [a, b] of [[0.3, 0.95], [1.15, 1.9]]) { piece(w, 'trim', u0 + 0.14, (u0 + u1) / 2 - 0.05, v0 + a, v0 + b, h.door ?? 0x5a4030, -0.1, 0.03); piece(w, 'trim', (u0 + u1) / 2 + 0.05, u1 - 0.14, v0 + a, v0 + b, h.door ?? 0x5a4030, -0.1, 0.03); }
    piece(w, 'chrome', u1 - 0.16, u1 - 0.1, v0 + 0.95, v0 + 1.02, 0xffffff, -0.07, 0.04);
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
