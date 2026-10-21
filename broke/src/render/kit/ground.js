// Ground in the remastered look from kit data: pads (extruded polygons: asphalt, lawns, walks, drives, yards), ribbons
// (curving walks and lanes), kerbs (a run of short concrete blocks along a polyline, some painted red; street kerbs
// stand on the road, rolled kerbs on lanes sit on lot level), road paint, and grass tufts along every lawn edge.

import * as THREE from 'three';
import { mat, ribbon } from './batch.js';

export function pad(B, p) {
  const s = new THREE.Shape(p.poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.005, p.y1 - p.y0), bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, p.y0, 0);
  B.add(p.surf, g, null, p.tint ?? 0xffffff);
}

export function ribbonMesh(B, r) {
  if (r.pts.length < 2) return;
  B.add(r.surf, ribbon(r.pts, r.width, r.y), null, r.tint ?? 0xffffff);
}

// Kerb: street kerbs are 0.3 wide and stand 0.17 above the road; rolled kerbs on lanes are a low 0.12 hump.
export function kerb(B, k) {
  const street = k.street, w = street ? 0.3 : 0.32, h = street ? 0.17 : 0.11, y = k.y ?? 0;
  for (let i = 0; i < k.pts.length - 1; i++) {
    const a = k.pts[i], b = k.pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    if (L < 0.02) continue;
    const red = k.red.includes(i);
    // Long straight runs are split into ~2 m blocks so the joints show.
    const n = Math.max(1, Math.round(L / 2));
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n;
      B.boxM(red ? 'redCurb' : 'curb', L / n - 0.012, h, w, mat(a.x + dx * t, y + h / 2, a.z + dz * t, Math.atan2(-dz, dx)), red ? 0xffffff : 0xd8d4cc);
    }
  }
}

export function paint(B, p) { B.boxM('roadPaint', p.w, 0.006, p.d, mat(p.x, (p.y ?? 0) + 0.003, p.z, p.yaw || 0), p.color); }

// Spots for grass tufts along the edges of grass pads (the ragged edge where lawn meets kerb, walk or fence).
export function tuftSpots(D, rng, density = 2.2) {
  const out = [];
  for (const p of D.pads) {
    if (p.surf !== 'grass' || p.poly.length > 6) continue;
    const P = p.poly;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L > 400) continue;
      const n = Math.floor(L * density);
      const cx = P.reduce((s, q) => s + q[0], 0) / P.length, cz = P.reduce((s, q) => s + q[1], 0) / P.length;
      for (let k = 0; k < n; k++) {
        const t = rng.range(0, 1), x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        const ix = cx - x, iz = cz - z, il = Math.hypot(ix, iz) || 1, o = rng.range(0.05, 0.3);
        out.push([x + ix / il * o, z + iz / il * o, p.y1]);
      }
    }
  }
  return out;
}
