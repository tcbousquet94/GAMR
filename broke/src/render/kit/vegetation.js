// Vegetation for the remastered look: palms (curved ringed trunks, folded frond cards drooping from the crown, a skirt
// of dead fronds), broadleaf trees and shrubs from leaf cards with normals bent out of the crown so they shade softly,
// and grass tufts for ragged lawn edges. All alpha-tested cards, batched per material.

import * as THREE from 'three';
import { mat } from './batch.js';

export function palm(B, p, rng) {
  const base = new THREE.Vector3(p.x, p.y ?? 0, p.z), lean = new THREE.Vector3(p.lean[0], 0, p.lean[1]), up = new THREE.Vector3(0, 1, 0);
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
export function tree(B, t, rng) {
  const th = t.h * 0.55, y = t.y ?? 0;
  B.add('bark', new THREE.CylinderGeometry(0.17, 0.26, th, 8), mat(t.x, y + th / 2, t.z), 0xffffff, { uv: 'native', uvScale: [1.4, th] });
  const c = new THREE.Vector3(t.x, y + t.h * 0.66, t.z);
  for (let i = 0; i < 4; i++) {
    const a = rng.range(0, Math.PI * 2), l = t.r * 0.7;
    const end = new THREE.Vector3(t.x + Math.cos(a) * l * 0.7, y + th + l * 0.6, t.z + Math.sin(a) * l * 0.7), s = new THREE.Vector3(t.x, y + th - 0.3, t.z);
    const dir = end.clone().sub(s);
    const m = new THREE.Matrix4().compose(s.clone().add(end).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), new THREE.Vector3(1, 1, 1));
    B.add('bark', new THREE.CylinderGeometry(0.06, 0.12, dir.length(), 6), m, 0xffffff, { uv: 'native', uvScale: [0.6, dir.length()] });
  }
  cards(B, c, t.r, t.r * 0.72, 150, 2.3, rng, 0xb0bc98);
}
export function shrub(B, x, y, z, r, rng) { cards(B, new THREE.Vector3(x, y + r * 0.7, z), r, r * 0.75, 26, r * 1.1, rng, 0xd8e0c0); }
export function cards(B, c, rx, ry, n, size, rng, tint) {
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
function bendNormals(g, center, k) {
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < p.count; i++) {
    const out = center ? v.fromBufferAttribute(p, i).sub(center).normalize() : up.clone();
    const nn = new THREE.Vector3().fromBufferAttribute(n, i).lerp(out, k).normalize();
    n.setXYZ(i, nn.x, nn.y, nn.z);
  }
}

// ---- street furniture -------------------------------------------------------------------------------------------------
// Grass tufts: crossed blade cards at the given spots, lot level.
export function tufts(B, spots, rng, y0 = 0.15) {
  for (const [x, z, yy] of spots) {
    const y = yy ?? y0;
    const h = rng.range(0.1, 0.2), w = h * 2.2, yaw = rng.range(0, Math.PI);
    for (const r of [0, Math.PI / 2]) B.add('tuft', new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), mat(x, y - 0.01, z, yaw + r), 0xd8f0b0, { uv: 'native' });
  }
}
