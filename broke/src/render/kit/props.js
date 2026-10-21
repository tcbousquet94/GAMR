// Fences at any angle (chain-link, chain-link with barbed wire, wood plank, block wall) and the small props of the
// remastered streets: dumpsters, ice machines, payphones, newspaper boxes, benches, bollards, wheel stops, basketball
// hoops, laundry lines, pallet stacks, shipping containers, box trucks, manholes.

import * as THREE from 'three';
import { mat } from './batch.js';
import { CURB } from '../../city/kitdata/data.js';

export function fence(B, f) {
  const y = f.y ?? CURB, dx = f.b.x - f.a.x, dz = f.b.z - f.a.z, len = Math.hypot(dx, dz);
  if (len < 0.3) return;
  const cx = (f.a.x + f.b.x) / 2, cz = (f.a.z + f.b.z) / 2, yaw = Math.atan2(-dz, dx); // local x along the run
  const post = (t, key, w, h, color, cyl) => { const x = f.a.x + dx * t / len, z = f.a.z + dz * t / len; if (cyl) B.add(key, new THREE.CylinderGeometry(w, w, h, 6), mat(x, y + h / 2, z), color, { uv: 'native' }); else B.boxM(key, w, h, w, mat(x, y + h / 2, z, yaw), color); };
  if (f.kind === 'chain' || f.kind === 'barbed') {
    const h = f.kind === 'barbed' ? f.h - 0.45 : f.h;
    B.boxM('chainlink', len, h - 0.05, 0.01, mat(cx, y + (h - 0.05) / 2 + 0.04, cz, yaw), 0xffffff);
    B.add('metalPaint', new THREE.CylinderGeometry(0.022, 0.022, len, 6), mat(cx, y + h, cz, yaw, 0, Math.PI / 2), 0x9a9c9a, { uv: 'native' });
    for (let t = 0; t <= len + 0.01; t += 2.4) post(Math.min(t, len), 'metalPaint', 0.032, f.h + 0.05, 0x9a9c9a, true);
    if (f.kind === 'barbed') for (let k = 0; k < 3; k++) B.add('wire', new THREE.CylinderGeometry(0.008, 0.008, len, 4), mat(cx, y + h + 0.12 + k * 0.13, cz, yaw, 0, Math.PI / 2).multiply(mat(0, 0, -0.06 * k)), 0xffffff, { uv: 'native' });
  } else if (f.kind === 'wood') {
    B.boxM('planks', len, f.h, 0.035, mat(cx, y + f.h / 2, cz, yaw), 0xc8b8a0);
    for (let t = 0; t <= len + 0.01; t += 2.2) post(Math.min(t, len), 'planks', 0.09, f.h + 0.08, 0xa89880);
    B.boxM('planks', len, 0.04, 0.12, mat(cx, y + f.h + 0.02, cz, yaw), 0xb8a890);
  } else {
    B.boxM('stucco', len, f.h, 0.2, mat(cx, y + f.h / 2, cz, yaw), f.color ?? 0xc8c4b8);
    B.boxM('concrete', len + 0.04, 0.07, 0.26, mat(cx, y + f.h + 0.035, cz, yaw), 0xb8b4ac);
    for (let t = 0; t <= len + 0.01; t += 3) post(Math.min(t, len), 'stucco', 0.32, f.h + 0.15, 0xc0bcb0);
  }
}

export function prop(B, p, rng) {
  const y = p.y ?? CURB, M = mat(p.x, y, p.z, p.yaw || 0);
  const box = (key, w, h, d, x, yy, z, color, o) => B.boxM(key, w, h, d, M.clone().multiply(mat(x, yy, z)), color, o);
  const cyl = (key, r, h, x, yy, z, color, rz = 0) => B.add(key, new THREE.CylinderGeometry(r, r, h, 10), M.clone().multiply(mat(x, yy, z, 0, 0, rz)), color, { uv: 'native' });
  switch (p.type) {
    case 'dumpster': box('metalPaint', 1.9, 1.15, 1.2, 0, 0.7, 0, p.color ?? 0x2e4a3a); box('metalPaint', 1.95, 0.06, 1.25, 0, 1.3, 0.04, 0x1e2a22); for (const s of [-1, 1]) cyl('rubber', 0.08, 0.06, s * 0.8, 0.08, 0.5, 0x1a1a1a, Math.PI / 2); break;
    case 'ice': box('metalPaint', 1.3, 1.9, 0.8, 0, 0.95, 0, 0xe8e6e0); box('trim', 1.32, 0.42, 0.82, 0, 1.45, 0, 0x2a5aa8); box('metalPaint', 0.6, 0.8, 0.02, -0.25, 0.75, 0.41, 0xc8c8c4); break;
    case 'phone': cyl('metalPaint', 0.05, 1.2, 0, 0.6, 0, 0x6a6a6c); box('metalPaint', 0.5, 0.7, 0.32, 0, 1.55, 0, 0x8a8c8e); box('trim', 0.2, 0.28, 0.06, 0, 1.6, 0.17, 0x1a1a1c); break;
    case 'newsbox': for (const s of [-1, 1]) cyl('metalPaint', 0.02, 0.4, s * 0.18, 0.2, 0, 0x3a3a3c); box('metalPaint', 0.48, 0.65, 0.42, 0, 0.72, 0, p.color ?? rng.pick([0x2a5aa8, 0xc83a2a, 0xd8b030, 0x2a6a3a])); box('carGlass', 0.36, 0.25, 0.01, 0, 0.85, 0.215, 0xffffff); break;
    case 'bench': for (const s of [-1, 1]) box('metalPaint', 0.06, 0.45, 0.45, s * 0.7, 0.22, 0, 0x3a3a3c); for (let i = 0; i < 4; i++) box('planks', 1.6, 0.04, 0.09, 0, 0.45, -0.17 + i * 0.11, 0xa08a6a); for (let i = 0; i < 2; i++) box('planks', 1.6, 0.09, 0.03, 0, 0.62 + i * 0.12, 0.24, 0xa08a6a); break;
    case 'bollard': cyl('metalPaint', 0.1, 1.0, 0, 0.5, 0, 0xd8b020); break;
    case 'wheelstop': box('concrete', 1.8, 0.12, 0.2, 0, 0.06, 0, 0xc8c4bc); break;
    case 'hoop': cyl('metalPaint', 0.05, 3.1, 0, 1.55, 0, 0x6a6a6c); box('trim', 1.1, 0.7, 0.04, 0, 3.1, 0.25, 0xe8e6e0); B.add('metalPaint', new THREE.TorusGeometry(0.23, 0.012, 6, 16), M.clone().multiply(mat(0, 2.85, 0.5, 0, Math.PI / 2)), 0xc84a1a, { uv: 'native' }); break;
    case 'pallets': for (let i = 0; i < 4; i++) { const yy = 0.07 + i * 0.16; for (let k = -2; k <= 2; k++) box('planks', 1.2, 0.025, 0.1, 0, yy + 0.06, k * 0.22, 0xb89a70); for (const k of [-1, 0, 1]) box('planks', 0.1, 0.09, 1.0, k * 0.5, yy, 0, 0x9a7e5a); } break;
    case 'container': { const W = 2.4, H = 2.6, L = 6; box('metal', W, H, L, 0, H / 2, 0, p.color ?? 0x8a3a2a); for (let i = -1; i <= 1; i += 2) box('metalPaint', W + 0.04, 0.12, 0.12, 0, H - 0.06, i * (L / 2 - 0.06), 0x3a3a3a); break; }
    case 'laundry': {
      const a = p.a, b = p.b, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx), cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
      for (const q of [a, b]) B.add('metalPaint', new THREE.CylinderGeometry(0.035, 0.035, 2.1, 6), mat(q.x, y + 1.05, q.z), 0x8a8c8e, { uv: 'native' });
      B.add('wire', new THREE.CylinderGeometry(0.006, 0.006, L, 4), mat(cx, y + 1.95, cz, yaw, 0, Math.PI / 2), 0xffffff, { uv: 'native' });
      for (let t = 0.6; t < L - 0.4; t += rng.range(0.5, 0.9)) { const x = a.x + dx * t / L, z = a.z + dz * t / L, w = rng.range(0.35, 0.7), h = rng.range(0.4, 0.8); B.boxM('trim', w, h, 0.01, mat(x, y + 1.95 - h / 2, z, yaw), rng.pick([0xe8e4dc, 0x3a5a8a, 0xc85a4a, 0x6a8a5a, 0xd8c890, 0x8a8a8e])); }
      break;
    }
    default: break;
  }
}

export function truck(B, t) {
  const M = mat(t.x, t.y ?? 0, t.z, t.yaw);
  const box = (key, w, h, d, x, y, z, color) => B.boxM(key, w, h, d, M.clone().multiply(mat(x, y, z)), color);
  box('metalPaint', 2.4, 2.6, 5.0, 0, 2.15, 1.0, t.color); // box
  box('carPaint', 2.3, 1.5, 1.9, 0, 1.55, -2.45, 0x8a2a24); // cab
  box('carGlass', 2.1, 0.7, 0.05, 0, 2.0, -3.41, 0xffffff);
  box('trim', 2.3, 0.25, 0.15, 0, 0.6, -3.45, 0x2a2a2c);
  for (const s of [-1, 1]) for (const z of [-2.4, 1.4, 2.6]) B.add('rubber', new THREE.CylinderGeometry(0.45, 0.45, 0.3, 14), M.clone().multiply(mat(s * 1.05, 0.45, z, 0, 0, Math.PI / 2)), 0x1a1a1c, { uv: 'native' });
}

export function manhole(B, m) {
  B.add('metalPaint', new THREE.CylinderGeometry(0.42, 0.42, 0.03, 20), mat(m.x, m.y ?? 0, m.z), 0x4a4846, { uv: 'native' });
  B.add('metalPaint', new THREE.CylinderGeometry(0.5, 0.5, 0.012, 20), mat(m.x, m.y ?? 0, m.z), 0x7a7672, { uv: 'native' });
}
