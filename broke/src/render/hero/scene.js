// Builds the hero scene's meshes from hero/layout.js: ground (asphalt, kerbs with painted sections, verges, sidewalks,
// lawns, driveways, crosswalk and lane paint, manholes, patches), houses, fences, palms and broadleaf trees from leaf
// cards, shrubs, utility poles with sagging wires, streetlights, parked cars and bins. Everything is batched into one
// mesh per surface material.

import * as THREE from 'three';
import { Batch, mat, ribbon } from './batch.js';
import { heroMaterials } from './materials.js';
import { buildHouse } from './houses.js';
import { Rng } from '../../core/rng.js';
import * as L from '../../hero/layout.js';

const { CURB_H, AVENUE: AV, SIDE: SD, CORNER_R: CR, VERGE, WALK } = L;
const EXT = L.SIZE / 2 - 4;

export function buildHeroScene() {
  const B = new Batch(), rng = new Rng('hero-scene');
  ground(B, rng);
  for (const h of L.HOUSES) buildHouse(B, h, rng);
  for (const f of L.fences()) fence(B, f, rng);
  for (const p of L.PALMS) palm(B, p, rng);
  for (const t of L.TREES) tree(B, t, rng);
  for (const s of L.SHRUBS) shrub(B, s.x, CURB_H, s.z, s.r, rng);
  hedges(B, rng);
  tufts(B, rng);
  const lamps = [];
  for (const line of L.POLE_LINES) poleLine(B, line, rng);
  for (const s of L.STREETLIGHTS) lamps.push(streetlight(B, s));
  for (const c of L.CARS) car(B, c, rng);
  for (const b of L.BINS) bin(B, b);
  hydrant(B, 10.6, -9.6);
  const group = B.build(heroMaterials(), { noCast: ['roadPaint', 'grass', 'asphalt'] });
  group.position.set(L.O, 0, L.O);
  return { group, lamps: lamps.map((l) => ({ x: l.x + L.O, y: l.y, z: l.z + L.O })) };
}

// ---- ground ---------------------------------------------------------------------------------------------------------
function ground(B, rng) {
  // Asphalt everywhere at y=0; raised blocks sit on it.
  B.box('asphalt', -EXT, -0.2, -EXT, EXT, 0, EXT, 0xc4c2be);
  const top = CURB_H, CW = 0.32, KH = 0.17;
  const lawn = (x0, z0, x1, z1) => B.box('grass', x0, 0, z0, x1, top, z1, 0xffffff);
  const walk = (x0, z0, x1, z1, c = 0xe2ded6) => B.box('concrete', x0, top - 0.02, z0, x1, top + 0.03, z1, c);
  const kerb = (x0, z0, x1, z1, key = 'curb') => B.box(key, x0, 0, z0, x1, KH, z1, key === 'curb' ? 0xd8d4cc : 0xffffff);

  // North block: kerb, verge, sidewalk, then lots (lawn). Driveway cuts at the garage and h1.
  const zk = AV.z0, cuts = [[-21, -3], [-50.5, -46.5], [60, 64]];
  let x = -EXT;
  for (const [a, b] of [...cuts, [EXT, EXT]]) { if (a > x) kerb(x, zk - CW, a, zk); if (b < EXT) { B.box('concrete', a, 0, zk - CW, b, 0.05, zk, 0xcfcac2); } x = b; }
  lawn(-EXT, -EXT, EXT, zk - CW);
  walk(-EXT, zk - CW - VERGE - WALK, EXT, zk - CW - VERGE);
  for (const [a, b] of cuts) {
    B.box('concrete', a, top - 0.02, zk - CW - VERGE, b, top + 0.025, zk - CW, 0xd6d2ca); // apron across the verge
    B.box('concrete', a + 0.4, top - 0.02, b === -3 ? -40 : -44, b - 0.4, top + 0.025, zk - CW - VERGE - WALK, 0xd0ccc4); // driveway
  }
  // Red-painted kerb by the garage (no parking) and a run near the corner.
  kerb(-26, zk - CW, -21, zk, 'redCurb'); kerb(7 + CR, zk - CW, 7 + CR + 6, zk, 'redCurb');

  // South blocks (either side of the side street), with rounded kerbs at the junction.
  for (const s of [-1, 1]) {
    const xi = s * SD.x1, xo = s * EXT, cx = xi + s * CR, cz = AV.z1 + CR;
    const red = s > 0;
    // Straight kerbs.
    kerb(Math.min(cx, xo), AV.z1, Math.max(cx, xo), AV.z1 + CW, red ? 'curb' : 'curb');
    kerb(Math.min(xi, xi + s * CW), cz, Math.max(xi, xi + s * CW), EXT);
    // Kerb arc: short rotated segments, painted red on the east corner like the target's.
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI / 2, a1 = ((i + 1) / n) * Math.PI / 2, am = (a0 + a1) / 2;
      const rr = CR - CW / 2, px = cx - s * Math.cos(am) * rr, pz = cz - Math.sin(am) * rr;
      const len = 2 * CR * Math.sin((a1 - a0) / 2) + 0.03;
      B.boxM(red ? 'redCurb' : 'curb', len, KH, CW, mat(px, KH / 2, pz, s > 0 ? -am + Math.PI / 2 : am - Math.PI / 2), red ? 0xffffff : 0xd8d4cc);
    }
    if (red) for (let k = 0; k < 2; k++) kerb(xi, cz + k * 4, xi + CW, cz + k * 4 + 4, 'redCurb');
    // Lawn: two rectangles plus a quarter-disc fan in the corner.
    lawn(Math.min(cx, xo), AV.z1 + CW, Math.max(cx, xo), EXT);
    lawn(Math.min(xi + s * CW, cx), cz, Math.max(xi + s * CW, cx), EXT);
    const fan = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI / 2, a1 = ((i + 1) / n) * Math.PI / 2, r = CR - CW;
      fan.push([[cx, top, cz], [cx - s * Math.cos(a0) * r, top, cz - Math.sin(a0) * r], [cx - s * Math.cos(a1) * r, top, cz - Math.sin(a1) * r]]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(fan.flatMap((f) => (s > 0 ? [f[0], f[2], f[1]] : f).flat()), 3)); g.computeVertexNormals();
    B.add('grass', g, null, 0xffffff);
    // Sidewalk along the side street (both sides) beyond the corner.
    const w0 = xi + s * (CW + VERGE), w1 = w0 + s * WALK;
    walk(Math.min(w0, w1), cz + (s > 0 ? 9 : 0), Math.max(w0, w1), EXT);
    if (s < 0) {
      // West corner: the walk follows the kerb round the corner and along the avenue.
      walkArc(B, cx, cz, CR - CW - VERGE - WALK / 2, s);
      walk(-EXT, AV.z1 + CW + VERGE, cx, AV.z1 + CW + VERGE + WALK);
    }
  }
  // South-east corner: the curving walk through the lawn, meeting the side-street sidewalk.
  B.add('concrete', ribbon(L.cornerWalk(), WALK + 0.2, top + 0.03), null, 0xe2ded6);

  // Paint: avenue centre double yellow (broken at the junction), crosswalk and stop bar on the side street.
  const paint = (x0, z0, x1, z1, c = 0xffffff) => B.box('roadPaint', x0, 0, z0, x1, 0.006, z1, c);
  const cz = (AV.z0 + AV.z1) / 2;
  for (const [a, b] of [[-EXT, -14], [14, EXT]]) { paint(a, cz - 0.2, b, cz - 0.08, 0xe0b040); paint(a, cz + 0.08, b, cz + 0.2, 0xe0b040); }
  for (let xx = -6.2; xx < 6.4; xx += 1.1) paint(xx, AV.z1 + 1.0, xx + 0.55, AV.z1 + 4.0);
  paint(0.3, AV.z1 + 4.7, 6.6, AV.z1 + 5.15);
  paint(-0.08, AV.z1 + 6, 0.08, EXT, 0xe0b040);
  // Avenue edge lines.
  paint(-EXT, AV.z0 + 0.6, -7 - CR, AV.z0 + 0.72); paint(7 + CR, AV.z0 + 0.6, EXT, AV.z0 + 0.72);
  // Manholes and asphalt patches.
  for (const [mx, mz] of [[1.5, -23.5], [-24, -20.5], [30, -26], [-2.5, 30]]) {
    B.add('metalPaint', new THREE.CylinderGeometry(0.42, 0.42, 0.03, 20), mat(mx, 0.0, mz), 0x4a4846);
    B.add('metalPaint', new THREE.CylinderGeometry(0.5, 0.5, 0.012, 20), mat(mx, 0.0, mz), 0x7a7672);
  }
  void rng;
}

function walkArc(B, cx, cz, r, s) {
  const pts = [];
  for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI / 2; pts.push({ x: cx - s * Math.cos(a) * r, z: cz - Math.sin(a) * r }); }
  B.add('concrete', ribbon(s > 0 ? pts : pts.slice().reverse(), WALK, CURB_H + 0.03), null, 0xe2ded6);
}

// ---- fences ---------------------------------------------------------------------------------------------------------
function fence(B, f, rng) {
  const y = CURB_H, along = f.along === 'x', len = along ? f.x1 - f.x0 : f.z1 - f.z0;
  if (len < 0.3) return;
  const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2, yaw = along ? 0 : Math.PI / 2;
  if (f.kind === 'chain') {
    B.boxM('chainlink', len, f.h - 0.05, 0.01, mat(cx, y + (f.h - 0.05) / 2 + 0.04, cz, yaw), 0xffffff);
    B.add('metalPaint', new THREE.CylinderGeometry(0.022, 0.022, len, 6), mat(cx, y + f.h, cz, yaw, 0, Math.PI / 2), 0x9a9c9a, { uv: 'native' });
    for (let t = 0; t <= len + 0.01; t += 2.4) { const px = along ? f.x0 + t : cx, pz = along ? cz : f.z0 + t; B.add('metalPaint', new THREE.CylinderGeometry(0.03, 0.03, f.h + 0.05, 6), mat(px, y + (f.h + 0.05) / 2, pz), 0x9a9c9a, { uv: 'native' }); }
  } else if (f.kind === 'wood') {
    B.boxM('planks', len, f.h, 0.035, mat(cx, y + f.h / 2, cz, yaw), 0xc8b8a0);
    for (let t = 0; t <= len + 0.01; t += 2.2) { const px = along ? f.x0 + t : cx, pz = along ? cz : f.z0 + t; B.boxM('planks', 0.09, f.h + 0.08, 0.09, mat(px, y + (f.h + 0.08) / 2, pz), 0xa89880); }
    B.boxM('planks', len, 0.04, 0.12, mat(cx, y + f.h + 0.02, cz, yaw), 0xb8a890);
  } else {
    B.boxM('stucco', len, f.h, 0.2, mat(cx, y + f.h / 2, cz, yaw), 0xc8c4b8);
    B.boxM('concrete', len + 0.04, 0.07, 0.26, mat(cx, y + f.h + 0.035, cz, yaw), 0xb8b4ac);
    for (let t = 0; t <= len + 0.01; t += 3) { const px = along ? f.x0 + t : cx, pz = along ? cz : f.z0 + t; B.boxM('stucco', 0.34, f.h + 0.15, 0.3, mat(px, y + (f.h + 0.15) / 2, pz), 0xc0bcb0); }
  }
}

// ---- vegetation -----------------------------------------------------------------------------------------------------
// Palm: curved ringed trunk in segments, a crown of drooping frond cards (folded into a V) and a skirt of dead fronds.
function palm(B, p, rng) {
  const base = new THREE.Vector3(p.x, 0, p.z), lean = new THREE.Vector3(p.lean[0], 0, p.lean[1]), up = new THREE.Vector3(0, 1, 0);
  const at = (t) => base.clone().addScaledVector(up, p.h * t).addScaledVector(lean, t * t);
  const N = 10;
  let v = 0;
  for (let i = 0; i < N; i++) {
    const a = at(i / N), b = at((i + 1) / N), dir = b.clone().sub(a), len = dir.length();
    const r0 = (0.3 - 0.09 * (i / N)) * (i === 0 ? 1.35 : 1), r1 = 0.3 - 0.09 * ((i + 1) / N);
    const g = new THREE.CylinderGeometry(r1, r0, len, 10, 1, true);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    B.add('palmBark', g, m, 0xb8b0a4, { uv: 'native', uvScale: [2 * Math.PI * r0, len], uvOffset: [0, v] });
    v += len;
  }
  const top = at(1);
  B.add('bark', new THREE.SphereGeometry(0.42, 10, 8), mat(top.x, top.y + 0.1, top.z, 0, 0, 0, 1, 1.4, 1), 0x8a8a5a, { uv: 'native', uvScale: [1, 1] });
  const n = 22 + rng.int(0, 5), sz = (p.h / 13) ** 0.3;
  for (let i = 0; i < n; i++) frond(B, top, (i / n) * Math.PI * 2 + rng.range(-0.12, 0.12), rng.range(-0.3, 0.7), rng.range(4.6, 5.8) * sz, 0xffffff, rng);
  for (let i = 0; i < 6; i++) frond(B, top.clone().add(new THREE.Vector3(0, 0.2, 0)), rng.range(0, Math.PI * 2), rng.range(0.9, 1.25), rng.range(2.6, 3.4) * sz, 0xe0f0c8, rng);
  for (let i = 0; i < 7; i++) frond(B, top.clone().add(new THREE.Vector3(0, -0.3, 0)), rng.range(0, Math.PI * 2), rng.range(-1.35, -1.05), rng.range(2.2, 3.0), 0xd8a868, rng, 3.2);
}
function frond(B, top, az, elev, len, tint, rng, dead = 1) {
  const S = 9, dirH = new THREE.Vector3(Math.sin(az), 0, Math.cos(az)), side = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
  const pos = [], uv = [], idx = [];
  let p = top.clone(), e = elev;
  const width = 0.95 * len / 4;
  for (let i = 0; i <= S; i++) {
    const t = i / S, w = width * Math.sin(Math.min(1, t * 1.1 + 0.05) * Math.PI) + 0.02;
    const fold = 0.45 * w;
    const c = p.clone();
    pos.push(c.x + side.x * w, c.y + fold, c.z + side.z * w, c.x, c.y, c.z, c.x - side.x * w, c.y + fold, c.z - side.z * w);
    uv.push(t, 1, t, 0.5, t, 0);
    if (i) { const k = i * 3; idx.push(k - 3, k, k - 2, k - 2, k, k + 1, k - 2, k + 1, k - 1, k - 1, k + 1, k + 2); }
    const step = len / S;
    p.addScaledVector(dirH, Math.cos(e) * step).add(new THREE.Vector3(0, Math.sin(e) * step, 0));
    e -= (0.14 + rng.range(0, 0.06)) * (dead > 1 ? 0.3 : 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const out = B.add('frond', g, null, dead > 1 ? 0xffffff : tint, { uv: 'native' });
  // Bend normals toward the sky so the crown shades softly instead of by card orientation.
  bendNormals(out, null, 0.55);
  if (dead > 1) { const c = out.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, 2.6, 1.9, 1.5); }
}

// Broadleaf tree: trunk, a few limbs and ~100 leaf cards in an ellipsoid, normals pointing out of the crown.
function tree(B, t, rng) {
  const th = t.h * 0.55;
  B.add('bark', new THREE.CylinderGeometry(0.17, 0.26, th, 8), mat(t.x, th / 2, t.z), 0xffffff, { uv: 'native', uvScale: [1.4, th] });
  const c = new THREE.Vector3(t.x, t.h * 0.66, t.z);
  for (let i = 0; i < 4; i++) {
    const a = rng.range(0, Math.PI * 2), l = t.r * 0.7;
    const end = new THREE.Vector3(t.x + Math.cos(a) * l * 0.7, th + l * 0.6, t.z + Math.sin(a) * l * 0.7), s = new THREE.Vector3(t.x, th - 0.3, t.z);
    const dir = end.clone().sub(s);
    const m = new THREE.Matrix4().compose(s.clone().add(end).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), new THREE.Vector3(1, 1, 1));
    B.add('bark', new THREE.CylinderGeometry(0.06, 0.12, dir.length(), 6), m, 0xffffff, { uv: 'native', uvScale: [0.6, dir.length()] });
  }
  cards(B, c, t.r, t.r * 0.72, 150, 2.3, rng, 0xb0bc98);
}
function shrub(B, x, y, z, r, rng) { cards(B, new THREE.Vector3(x, y + r * 0.7, z), r, r * 0.75, 26, r * 1.1, rng, 0xd8e0c0); }
// Clipped hedges under the front windows of a few houses.
function hedges(B, rng) {
  for (const h of L.HOUSES.filter((q) => q.front === 's' && q.z > -60 && !q.garage)) {
    const z = h.z + h.d / 2 + (h.porch ? h.porch.depth + 0.6 : 0.7);
    for (let x = h.x - h.w / 2 + 0.8; x < h.x + h.w / 2 - 0.6; x += 1.2) if (rng.chance(0.7)) cards(B, new THREE.Vector3(x, CURB_H + 0.45, z), 0.65, 0.45, 9, 0.8, rng, 0xc8d8b0);
  }
}
function cards(B, c, rx, ry, n, size, rng, tint) {
  for (let i = 0; i < n; i++) {
    let p;
    do { p = new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)); } while (p.lengthSq() > 1);
    const pos = c.clone().add(new THREE.Vector3(p.x * rx, p.y * ry, p.z * rx));
    const g = new THREE.PlaneGeometry(size, size);
    const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-1.2, 1.2), rng.range(0, Math.PI * 2), rng.range(-0.6, 0.6))), new THREE.Vector3(1, 1, 1));
    const out = B.add('leaves', g, m, tint, { uv: 'native' });
    bendNormals(out, c, 0.8);
  }
}
// Grass tufts where lawns meet kerbs, walks, fences and walls, so verges have a ragged 3D edge.
function tufts(B, rng) {
  const spots = [];
  const line = (x0, z0, x1, z1, n) => { for (let i = 0; i < n; i++) { const t = rng.range(0, 1); spots.push([x0 + (x1 - x0) * t + rng.range(-0.15, 0.15), z0 + (z1 - z0) * t + rng.range(-0.15, 0.15)]); } };
  const zk = AV.z0 - 0.32;
  line(-90, zk - 0.12, 90, zk - 0.12, 520); line(-90, zk - VERGE + 0.1, 90, zk - VERGE + 0.1, 440); line(-90, zk - VERGE - WALK - 0.15, 90, zk - VERGE - WALK - 0.15, 440);
  for (const s of [-1, 1]) {
    const xi = s * (SD.x1 + 0.32 + 0.12);
    line(xi, AV.z1 + CR, xi, 90, 320);
    for (let i = 0; i < 120; i++) { const a = rng.range(0, Math.PI / 2), r = CR - 0.45; spots.push([s * SD.x1 + s * CR - s * Math.cos(a) * r, AV.z1 + CR - Math.sin(a) * r]); }
    line(s * (CR + SD.x1), AV.z1 + 0.45, s * 90, AV.z1 + 0.45, 320);
  }
  // Along both edges of the curving walk, offset along its normal onto the lawn.
  const cw = L.cornerWalk();
  for (let i = 1; i < cw.length; i++) {
    const a = cw[i - 1], b = cw[i], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    for (const o of [-1, 1]) for (let k = 0; k < 4; k++) { const t = rng.range(0, 1), off = o * (WALK / 2 + 0.16 + rng.range(0, 0.2)); spots.push([a.x + dx * t + nx * off, a.z + dz * t + nz * off]); }
  }
  for (const [x, z] of spots) {
    const h = rng.range(0.1, 0.2), w = h * 2.2, yaw = rng.range(0, Math.PI);
    for (const r of [0, Math.PI / 2]) B.add('tuft', new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), mat(x, CURB_H - 0.01, z, yaw + r), 0xd8f0b0, { uv: 'native' });
  }
}

// Replace a card's normals with a blend of "out of the crown centre" and "up".
function bendNormals(g, center, k) {
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < p.count; i++) {
    const out = center ? v.fromBufferAttribute(p, i).sub(center).normalize() : up.clone();
    const nn = new THREE.Vector3().fromBufferAttribute(n, i).lerp(out, k).normalize();
    n.setXYZ(i, nn.x, nn.y, nn.z);
  }
}

// ---- street furniture -------------------------------------------------------------------------------------------------
function poleLine(B, line, rng) {
  const H = 10.2;
  const tops = [];
  for (let i = 0; i < line.length; i++) {
    const p = line[i], q = line[Math.min(line.length - 1, i + 1)], o = line[Math.max(0, i - 1)];
    const dx = q.x - o.x, dz = q.z - o.z, yaw = Math.atan2(dx, dz);
    B.add('bark', new THREE.CylinderGeometry(0.12, 0.16, H, 8), mat(p.x, H / 2, p.z), 0x9a8a7a, { uv: 'native', uvScale: [0.9, H] });
    B.boxM('planks', 2.3, 0.11, 0.11, mat(p.x, H - 0.6, p.z, yaw + Math.PI / 2), 0x8a7a6a);
    for (const o2 of [-0.95, 0, 0.95]) {
      const ix = p.x + Math.cos(yaw) * o2 * (o2 ? 1 : 0), iz = p.z - Math.sin(yaw) * o2;
      B.add('trim', new THREE.CylinderGeometry(0.035, 0.05, 0.16, 8), mat(ix, H - 0.47, iz), 0x7a8a80, { uv: 'native' });
    }
    if (rng.chance(0.45)) B.add('metalPaint', new THREE.CylinderGeometry(0.28, 0.28, 0.85, 12), mat(p.x + 0.4, H - 2.2, p.z), 0x8a8c88, { uv: 'native', uvScale: [1.7, 0.85] });
    tops.push({ p, yaw });
  }
  for (let i = 0; i < tops.length - 1; i++) {
    const a = tops[i], b = tops[i + 1];
    for (const o of [-0.95, 0, 0.95]) {
      const A = new THREE.Vector3(a.p.x + Math.cos(a.yaw) * o, H - 0.4, a.p.z - Math.sin(a.yaw) * o);
      const Bp = new THREE.Vector3(b.p.x + Math.cos(b.yaw) * o, H - 0.4, b.p.z - Math.sin(b.yaw) * o);
      wire(B, A, Bp, 0.35 + A.distanceTo(Bp) * 0.018);
    }
    // A lower communications line.
    wire(B, new THREE.Vector3(a.p.x, H - 2.6, a.p.z), new THREE.Vector3(b.p.x, H - 2.6, b.p.z), 0.6 + a.p.x * 0);
  }
}
function wire(B, a, b, sag) {
  const pts = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0))); }
  B.add('wire', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.016, 4), null, 0xffffff, { uv: 'native' });
}

function streetlight(B, s) {
  const H = 7.6, c = 0x8e9092;
  B.add('metalPaint', new THREE.CylinderGeometry(0.08, 0.13, H, 10), mat(s.x, H / 2, s.z), c, { uv: 'native', uvScale: [0.6, H] });
  B.add('concrete', new THREE.CylinderGeometry(0.25, 0.3, 0.35, 10), mat(s.x, 0.17, s.z), 0xb0aca4, { uv: 'native' });
  const dx = Math.sin(s.yaw), dz = Math.cos(s.yaw);
  const pts = [new THREE.Vector3(s.x, H - 0.4, s.z), new THREE.Vector3(s.x, H + 0.2, s.z), new THREE.Vector3(s.x + dx * 0.9, H + 0.55, s.z + dz * 0.9), new THREE.Vector3(s.x + dx * 2.6, H + 0.6, s.z + dz * 2.6)];
  B.add('metalPaint', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.055, 6), null, c, { uv: 'native' });
  const hx = s.x + dx * 2.9, hz = s.z + dz * 2.9;
  B.boxM('metalPaint', 0.36, 0.16, 0.75, mat(hx, H + 0.56, hz, s.yaw), 0x9a9c9e);
  B.boxM('lamp', 0.28, 0.03, 0.55, mat(hx, H + 0.47, hz, s.yaw), 0xffffff);
  return { x: hx, y: H + 0.4, z: hz };
}

// Sedan: lower body, glass greenhouse with a painted roof and pillars, wheels with rims, bumpers and lights.
function car(B, c, rng) {
  const M = mat(c.x, 0, c.z, c.yaw);
  const part = (key, g, m, color, o) => B.add(key, g, M.clone().multiply(m), color, o);
  const box = (key, w, h, d, x, y, z, color, rx = 0) => part(key, new THREE.BoxGeometry(w, h, d), mat(x, y, z, 0, rx), color);
  const body = (pts, width) => { const s = new THREE.Shape(pts.map(([zz, y]) => new THREE.Vector2(zz, y))); const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }); g.translate(0, 0, -width / 2); g.rotateY(Math.PI / 2); return g; };
  const W = 1.74, col = c.color;
  // Profile in (length, height): x of the shape runs nose(-) to tail(+) after the rotation.
  part('carPaint', body([[-2.3, 0.32], [2.28, 0.32], [2.32, 0.62], [2.2, 0.86], [1.25, 0.92], [-1.0, 0.92], [-2.2, 0.78], [-2.34, 0.6]], W - 0.08), mat(0, 0, 0), col);
  part('carGlass', body([[-0.95, 0.9], [1.15, 0.9], [0.62, 1.34], [-0.38, 1.36]], W - 0.24), mat(0, 0, 0), 0xffffff);
  part('carPaint', body([[-0.42, 1.33], [0.66, 1.31], [0.6, 1.37], [-0.38, 1.39]], W - 0.2), mat(0, 0, 0), col);
  for (const s of [-1, 1]) {
    box('carPaint', 0.05, 0.42, 0.08, s * (W / 2 - 0.13), 1.12, 0.12, col); // B pillar
    box('chrome', 0.04, 0.03, 2.0, s * (W / 2 - 0.03), 0.9, 0.1, 0xffffff); // belt trim
    box('carPaint', 0.16, 0.08, 0.06, s * (W / 2 + 0.06), 0.98, -0.78, col); // mirror
    for (const zz of [-1.42, 1.38]) {
      part('rubber', new THREE.CylinderGeometry(0.33, 0.33, 0.22, 16), mat(s * (W / 2 - 0.1), 0.33, zz, 0, 0, Math.PI / 2), 0x1a1a1c, { uv: 'native' });
      part('chrome', new THREE.CylinderGeometry(0.19, 0.19, 0.23, 12), mat(s * (W / 2 - 0.1), 0.33, zz, 0, 0, Math.PI / 2), 0xb8b8b8, { uv: 'native' });
      box('trim', 0.12, 0.08, 0.95, s * (W / 2 - 0.02), 0.68, zz, 0x161618); // wheel-arch shadow lip
    }
    box('lamp', 0.36, 0.1, 0.04, s * 0.55, 0.72, -2.33, 0xffffff); // headlights
    box('trim', 0.34, 0.12, 0.04, s * 0.58, 0.74, 2.32, 0x8a1a14); // tail lights
  }
  box('trim', W, 0.16, 0.12, 0, 0.42, -2.36, 0x3a3a3c); box('trim', W, 0.16, 0.12, 0, 0.42, 2.36, 0x3a3a3c); // bumpers
  box('trim', 0.5, 0.12, 0.02, 0, 0.52, 2.43, 0xd8d4c0); // plate
  void rng;
}

function bin(B, b) {
  B.boxM('trim', 0.58, 0.95, 0.66, mat(b.x, 0.5, b.z), b.c);
  B.boxM('trim', 0.64, 0.06, 0.74, mat(b.x, 1.0, b.z - 0.02), b.c);
  for (const s of [-1, 1]) B.add('rubber', new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), mat(b.x + s * 0.3, 0.1, b.z + 0.3, 0, 0, Math.PI / 2), 0x1a1a1a, { uv: 'native' });
}
function hydrant(B, x, z) {
  B.add('metalPaint', new THREE.CylinderGeometry(0.13, 0.15, 0.7, 10), mat(x, CURB_H + 0.35, z), 0xc8b020, { uv: 'native' });
  B.add('metalPaint', new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(x, CURB_H + 0.7, z), 0xc8b020, { uv: 'native' });
  B.add('metalPaint', new THREE.CylinderGeometry(0.06, 0.06, 0.42, 8), mat(x, CURB_H + 0.5, z, 0, 0, Math.PI / 2), 0xc8b020, { uv: 'native' });
}
