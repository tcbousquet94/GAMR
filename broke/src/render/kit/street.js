// Street furniture for the remastered look: wooden utility poles with crossarms, insulators, transformers and sagging
// wires; cobra-head streetlights; parked sedans and box trucks; wheelie bins, hydrants, manholes; and small props
// (dumpsters, ice machines, payphones, newspaper boxes, benches, bollards, wheel stops, hoops, laundry lines, pallets,
// shipping containers).

import * as THREE from 'three';
import { mat } from './batch.js';

const CURB_H = 0.15;
export function poleLine(B, line, rng) {
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

export function streetlight(B, s) {
  const H = 7.6, c = 0x8e9092, y0 = s.y ?? 0;
  B.add('metalPaint', new THREE.CylinderGeometry(0.08, 0.13, H, 10), mat(s.x, y0 + H / 2, s.z), c, { uv: 'native', uvScale: [0.6, H] });
  B.add('concrete', new THREE.CylinderGeometry(0.25, 0.3, 0.35, 10), mat(s.x, y0 + 0.17, s.z), 0xb0aca4, { uv: 'native' });
  const dx = Math.sin(s.yaw), dz = Math.cos(s.yaw);
  const pts = [new THREE.Vector3(s.x, y0 + H - 0.4, s.z), new THREE.Vector3(s.x, y0 + H + 0.2, s.z), new THREE.Vector3(s.x + dx * 0.9, y0 + H + 0.55, s.z + dz * 0.9), new THREE.Vector3(s.x + dx * 2.6, y0 + H + 0.6, s.z + dz * 2.6)];
  B.add('metalPaint', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.055, 6), null, c, { uv: 'native' });
  const hx = s.x + dx * 2.9, hz = s.z + dz * 2.9;
  B.boxM('metalPaint', 0.36, 0.16, 0.75, mat(hx, y0 + H + 0.56, hz, s.yaw), 0x9a9c9e);
  B.boxM('lamp', 0.28, 0.03, 0.55, mat(hx, y0 + H + 0.47, hz, s.yaw), 0xffffff);
  return { x: hx, y: y0 + H + 0.4, z: hz };
}

// Sedan: lower body, glass greenhouse with a painted roof and pillars, wheels with rims, bumpers and lights.
export function car(B, c, rng) {
  const M = mat(c.x, c.y ?? 0, c.z, c.yaw);
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

export function bin(B, b) {
  const y = b.y ?? CURB_H;
  B.boxM('trim', 0.58, 0.95, 0.66, mat(b.x, y + 0.5, b.z), b.c);
  B.boxM('trim', 0.64, 0.06, 0.74, mat(b.x, y + 1.0, b.z - 0.02), b.c);
  for (const s of [-1, 1]) B.add('rubber', new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), mat(b.x + s * 0.3, y + 0.1, b.z + 0.3, 0, 0, Math.PI / 2), 0x1a1a1a, { uv: 'native' });
}
export function hydrant(B, x, z) {
  B.add('metalPaint', new THREE.CylinderGeometry(0.13, 0.15, 0.7, 10), mat(x, CURB_H + 0.35, z), 0xc8b020, { uv: 'native' });
  B.add('metalPaint', new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(x, CURB_H + 0.7, z), 0xc8b020, { uv: 'native' });
  B.add('metalPaint', new THREE.CylinderGeometry(0.06, 0.06, 0.42, 8), mat(x, CURB_H + 0.5, z, 0, 0, Math.PI / 2), 0xc8b020, { uv: 'native' });
}
