import * as THREE from 'three';
import { signMesh, place } from '../../build.js';
import { PALETTE } from '../../../core/config.js';

// Shared building blocks for the town districts. Everything goes through the Town's Batch (`t.b`),
// so a district costs almost no extra draw calls.

export const C = {
  asphalt: 0x6f7390,
  lane: 0xfdf8ec,
  laneYellow: 0xffd23f,
  sidewalk: 0xe6dcc4,
  paving: 0xf0e2c0,
  pavingDark: 0xd9c49a,
  path: 0xf0dca0,
  sand: 0xf5e0a0,
  sandDark: 0xe8c97e,
  water: 0x4fb4f0,
  waterDeep: 0x3a9ad8,
  grass: PALETTE.grass,
  grassDark: PALETTE.grassDark,
  hedge: 0x3f9a3c,
  trunk: 0x8a5a32,
  leaf: 0x46a83f,
  leafLight: 0x6cc24f,
  white: 0xfdf8ec,
  cream: 0xfbe9c0,
  window: 0x7fc8f0,
  door: 0x8a4a2a,
  terracotta: 0xe0703a,
  roofRed: 0xd2493f,
  teal: 0x4aa3a0,
  dark: 0x3a2a3e,
  metal: 0x9aa0b8,
  pole: 0x4a4e6a,
  rock: 0xd8ccb0,
};

// A local coordinate frame for placing things relative to a building center.
// Local +Z is the building's FRONT. ry is a multiple of PI/2: 0 = front faces south (+Z),
// PI = north, PI/2 = east, -PI/2 = west.
export function frame(t, cx, cz, ry = 0) {
  const c = Math.round(Math.cos(ry)), s = Math.round(Math.sin(ry));
  const wx = (lx, lz) => cx + lx * c + lz * s;
  const wz = (lx, lz) => cz - lx * s + lz * c;
  const quarter = Math.abs(s) === 1; // footprint w/d swap
  const f = {
    wx, wz, ry,
    box(color, w, h, d, lx, y, lz, o = {}) { t.b.box(color, w, h, d, wx(lx, lz), y, wz(lx, lz), { ...o, ry: (o.ry ?? 0) + ry }); return f; },
    cyl(color, rt, rb, h, lx, y, lz, o = {}) { t.b.cyl(color, rt, rb, h, wx(lx, lz), y, wz(lx, lz), { ...o, ry: (o.ry ?? 0) + ry }); return f; },
    sph(color, r, lx, y, lz, o = {}) { t.b.sph(color, r, wx(lx, lz), y, wz(lx, lz), { ...o, ry: (o.ry ?? 0) + ry }); return f; },
    gable(color, w, h, d, lx, y, lz, o = {}) { t.b.gable(color, w, h, d, wx(lx, lz), y, wz(lx, lz), { ...o, ry: (o.ry ?? 0) + ry }); return f; },
    sign(lines, opts, lx, y, lz, extraRy = 0) {
      return place(t.root, signMesh(lines, opts), wx(lx, lz), y, wz(lx, lz), ry + extraRy);
    },
    solid(w, d, lx, lz, h = 4) {
      const W = quarter ? d : w, D = quarter ? w : d;
      t.solid(wx(lx, lz), wz(lx, lz), W, D, h);
      return f;
    },
    door(w, d, lx, lz, target) {
      const W = quarter ? d : w, D = quarter ? w : d;
      t.door(wx(lx, lz), wz(lx, lz), W, D, target);
      return f;
    },
    post(lx, lz, r, h, camR = 0) { t.post(wx(lx, lz), wz(lx, lz), r, h, camR); return f; },
  };
  return f;
}

// Generic building. Footprint w (along local X) x d (local Z), front at local z = d/2.
// Returns the frame plus the world position just outside the front door.
export function building(t, cx, cz, ry, o) {
  const {
    w = 8, d = 7, h = 4.2, wall = C.cream, roof = C.terracotta, roofType = 'gable', roofH = 2.4,
    trim = C.white, door = C.door, doorTarget = null, floors = 1, sign = null, signOpts = {}, windowColor = C.window,
    awning = null,
  } = o;
  const f = frame(t, cx, cz, ry);
  f.box(wall, w, h, d, 0, 0, 0, { outline: 0.06 });
  if (roofType === 'gable') {
    f.gable(roof, w + 0.8, roofH, d + 0.8, 0, h, 0, { outline: 0.06 });
    f.box(trim, w + 0.2, 0.3, d + 0.2, 0, h - 0.2, 0);
  } else if (roofType === 'flat') {
    f.box(trim, w + 0.3, 0.5, d + 0.3, 0, h, 0, { outline: 0.05 });
  } else if (roofType === 'hip') {
    // Pyramid-ish: stacked shrinking slabs, cheap and chunky.
    for (let i = 0; i < 3; i++) f.box(roof, w + 0.8 - i * (w / 3.2), roofH / 3, d + 0.8 - i * (d / 3.2), 0, h + (i * roofH) / 3, 0, { outline: 0.05 });
  }
  const fz = d / 2;
  f.box(door, 1.4, 2.4, 0.2, 0, 0, fz + 0.02, { outline: 0.03 });
  f.sph(0xffd23f, 0.08, 0.45, 1.2, fz + 0.15);
  f.box(C.rock, 2.2, 0.22, 1.1, 0, 0, fz + 0.6);
  const perFloor = h / floors;
  for (let fl = 0; fl < floors; fl++) {
    const y = fl * perFloor + perFloor * 0.38;
    const xs = w >= 9 ? [-w * 0.34, -w * 0.17, w * 0.17, w * 0.34] : [-w * 0.3, w * 0.3];
    for (const x of xs) {
      if (fl === 0 && Math.abs(x) < 1.3) continue;
      f.box(windowColor, 1.3, Math.min(1.3, perFloor * 0.45), 0.12, x, y, fz + 0.03, { outline: 0.035 });
    }
  }
  if (awning) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      f.box(i % 2 ? awning[0] : awning[1], w / n, 0.15, 1.5, -w / 2 + (i + 0.5) * (w / n), Math.min(h - 0.6, 2.9), fz + 0.7, { rx: 0.25 });
    }
  }
  if (sign) f.sign(sign, { w: Math.min(w * 0.85, 7), h: 1.0, px: 54, ...signOpts }, 0, Math.min(h - 0.2, 3.3) + 0.45, fz + 0.06);
  f.solid(w, d, 0, 0, h + (roofType === 'flat' ? 0.5 : roofH));
  const doorPos = { x: f.wx(0, fz + 0.5), z: f.wz(0, fz + 0.5) };
  if (doorTarget) f.door(1.8, 1.2, 0, fz + 0.45, doorTarget);
  return { f, doorPos };
}

export function tree(t, x, z, s = 1, leaf = C.leaf, light = C.leafLight) {
  const b = t.b;
  b.cyl(C.trunk, 0.22 * s, 0.32 * s, 2.2 * s, x, 0, z, { outline: 0.05 });
  b.sph(leaf, 1.35 * s, x, 3.0 * s, z, { outline: 0.08 });
  b.sph(light, 0.95 * s, x + 0.6 * s, 3.7 * s, z + 0.3 * s, { outline: 0.07 });
  b.sph(leaf, 0.9 * s, x - 0.7 * s, 3.5 * s, z - 0.2 * s, { outline: 0.07 });
  t.post(x, z, 0.4 * s, 4.6 * s, 1.5 * s);
}

export function palm(t, x, z, s = 1, lean = 0.2) {
  const b = t.b;
  for (let i = 0; i < 5; i++) {
    b.cyl(0xb98a50, 0.18 * s, 0.22 * s, 0.9 * s, x + Math.sin(lean) * i * 0.85 * s * 0.5, i * 0.85 * s, z, { rz: -lean * 0.6, outline: 0.03 });
  }
  const tx = x + Math.sin(lean) * 4 * 0.85 * s * 0.5, ty = 4.4 * s;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.box(i % 2 ? C.leaf : C.leafLight, 2.2 * s, 0.12, 0.6 * s, tx + Math.cos(a) * 1.0 * s, ty - 0.25, z + Math.sin(a) * 1.0 * s, { ry: -a, rz: -0.35, outline: 0.03 });
  }
  b.sph(0x7a5a2a, 0.25 * s, tx, ty - 0.2, z);
  t.post(x, z, 0.35 * s, 5 * s, 0.9 * s);
}

export function bush(t, x, z, s = 1) {
  t.b.sph(C.hedge, 0.8 * s, x, 0.45 * s, z, { scale: [1.3, 0.8, 1.1], outline: 0.05 });
}

export function lamp(t, x, z, dirZ = 1) {
  const b = t.b;
  b.cyl(C.pole, 0.09, 0.12, 4, x, 0, z);
  b.box(C.pole, 0.12, 0.12, 0.9, x, 3.9, z + 0.4 * dirZ);
  b.sph(0xfff3a8, 0.26, x, 3.75, z + 0.8 * dirZ, { outline: 0.04 });
  t.post(x, z, 0.18, 4);
}

export function car(t, x, z, color, ry = 0) {
  const f = frame(t, x, z, ry);
  f.box(color, 1.9, 0.9, 4, 0, 0.35, 0, { outline: 0.05 });
  f.box(color, 1.7, 0.75, 2.2, 0, 1.25, -0.2, { outline: 0.05 });
  f.box(C.window, 1.72, 0.5, 2.25, 0, 1.35, -0.2);
  for (const dx of [-0.95, 0.95]) for (const dz of [-1.3, 1.3]) f.cyl(0x2a2a33, 0.38, 0.38, 0.3, dx, 0.38 - 0.15, dz, { rz: Math.PI / 2 });
  f.solid(2.1, 4.2, 0, 0, 2);
}

export function bench(t, x, z, ry = 0) {
  const f = frame(t, x, z, ry);
  f.box(0x8a5a32, 2.2, 0.14, 0.6, 0, 0.5, 0, { outline: 0.03 });
  f.box(0x8a5a32, 2.2, 0.5, 0.12, 0, 0.6, -0.3, { outline: 0.03 });
  f.box(C.pole, 0.1, 0.5, 0.5, -0.9, 0, 0);
  f.box(C.pole, 0.1, 0.5, 0.5, 0.9, 0, 0);
  f.solid(2.2, 0.7, 0, 0, 1);
}

export function picketFence(t, x0, x1, z) {
  const b = t.b;
  const len = x1 - x0;
  b.box(C.white, len, 0.12, 0.08, (x0 + x1) / 2, 0.55, z);
  b.box(C.white, len, 0.12, 0.08, (x0 + x1) / 2, 0.25, z);
  for (let x = x0; x <= x1 + 0.01; x += 0.5) b.box(C.white, 0.14, 0.95, 0.1, x, 0, z);
  t.solid((x0 + x1) / 2, z, len, 0.3, 1);
}

// Signpost with district arrows, e.g. ['← SCHOOL', 'BEACH →'].
export function signpost(t, x, z, lines, ry = 0) {
  t.b.cyl(0x8a5a32, 0.07, 0.07, 2.6, x, 0, z);
  place(t.root, signMesh(lines, { w: 2.2, h: 0.35 + lines.length * 0.32, px: 36, bg: '#fff3c4' }), x, 2.0, z, ry);
  t.post(x, z, 0.15, 2.6);
}
