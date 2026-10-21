// Signed-distance modelling for the close-up human: primitives, smooth blends, a sampled field on a grid, and a
// naive surface-nets polygoniser (one vertex per surface cell at the mean of its edge crossings, quads across every
// sign-changing grid edge) with normals from the field gradient. Surface nets gives smooth, evenly spaced meshes
// that skin well; several iso-levels of one field give the body and the garments layered over it.

// ---- primitives (p: [x,y,z]) ----------------------------------------------------------------------------------------
export const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
export function sphere(p, c, r) { return len3(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r; }
// Ellipsoid (approximate, good near the surface).
export function ellipsoid(p, c, r) {
  const x = (p[0] - c[0]) / r[0], y = (p[1] - c[1]) / r[1], z = (p[2] - c[2]) / r[2];
  const k0 = len3(x, y, z), k1 = len3(x / r[0], y / r[1], z / r[2]);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2]);
}
// Capsule a-b with radius tapering ra -> rb (a "round cone" approximated by interpolating the radius).
export function capsule(p, a, b, ra, rb = ra) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const px = p[0] - a[0], py = p[1] - a[1], pz = p[2] - a[2];
  const t = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz || 1)));
  return len3(px - bx * t, py - by * t, pz - bz * t) - (ra + (rb - ra) * t);
}
// Capsule whose cross-section is squashed along a world axis (flattened forearms, fingers, feet).
export function capsuleS(p, a, b, ra, rb, sq) {
  const q = [a[0] + (p[0] - a[0]) * sq[0], a[1] + (p[1] - a[1]) * sq[1], a[2] + (p[2] - a[2]) * sq[2]];
  const b2 = [a[0] + (b[0] - a[0]) * sq[0], a[1] + (b[1] - a[1]) * sq[1], a[2] + (b[2] - a[2]) * sq[2]];
  return capsule(q, a, b2, ra, rb) / Math.max(sq[0], sq[1], sq[2]);
}
export function roundBox(p, c, h, r) {
  const qx = Math.abs(p[0] - c[0]) - h[0] + r, qy = Math.abs(p[1] - c[1]) - h[1] + r, qz = Math.abs(p[2] - c[2]) - h[2] + r;
  return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
export function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
export function smax(a, b, k) { return -smin(-a, -b, k); }

// Cheap tileable-free 3D value noise (deterministic), for clumpy hair and fabric bulk.
function h3(x, y, z) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}

// ---- sampled field ----------------------------------------------------------------------------------------------------
// Samples f over the box [min, max] at spacing `step`. Points further than `skip` from the surface are skipped cheaply
// by a coarse pre-pass, so mostly-empty boxes stay fast.
export class Field {
  // margin: never coarse-skip within this distance of the surface (garments sit up to a few cm outside it).
  constructor(f, min, max, step, margin = 0) {
    this.min = min; this.step = step;
    const n = (this.n = [0, 1, 2].map((i) => Math.ceil((max[i] - min[i]) / step) + 1));
    this.v = new Float32Array(n[0] * n[1] * n[2]);
    const p = [0, 0, 0], C = 4, cs = step * C, far = Math.max(cs * 0.9, margin);
    // Coarse pass: evaluate every 4th point; blocks whose corner values are all far from zero are filled directly.
    const cn = n.map((k) => Math.ceil((k - 1) / C) + 1), coarse = new Float32Array(cn[0] * cn[1] * cn[2]);
    for (let k = 0; k < cn[2]; k++) for (let j = 0; j < cn[1]; j++) for (let i = 0; i < cn[0]; i++) {
      p[0] = min[0] + i * cs; p[1] = min[1] + j * cs; p[2] = min[2] + k * cs;
      coarse[(k * cn[1] + j) * cn[0] + i] = f(p);
    }
    const ci = (i, j, k) => coarse[(Math.min(k, cn[2] - 1) * cn[1] + Math.min(j, cn[1] - 1)) * cn[0] + Math.min(i, cn[0] - 1)];
    for (let k = 0; k < n[2]; k++) for (let j = 0; j < n[1]; j++) for (let i = 0; i < n[0]; i++) {
      const I = (i / C) | 0, J = (j / C) | 0, K = (k / C) | 0;
      let lo = Infinity, hi = -Infinity;
      for (let d = 0; d < 8; d++) { const c = ci(I + (d & 1), J + ((d >> 1) & 1), K + ((d >> 2) & 1)); if (c < lo) lo = c; if (c > hi) hi = c; }
      const idx = (k * n[1] + j) * n[0] + i;
      if (lo > far) { this.v[idx] = lo; continue; }
      if (hi < -far) { this.v[idx] = hi; continue; }
      p[0] = min[0] + i * step; p[1] = min[1] + j * step; p[2] = min[2] + k * step;
      this.v[idx] = f(p);
    }
  }
  at(i, j, k) { return this.v[(k * this.n[1] + j) * this.n[0] + i]; }
  // Trilinear sample at a world point (for gradients at mesh vertices).
  sample(x, y, z) {
    const n = this.n, s = this.step;
    const fx = Math.max(0, Math.min(n[0] - 1.001, (x - this.min[0]) / s)), fy = Math.max(0, Math.min(n[1] - 1.001, (y - this.min[1]) / s)), fz = Math.max(0, Math.min(n[2] - 1.001, (z - this.min[2]) / s));
    const i = fx | 0, j = fy | 0, k = fz | 0, u = fx - i, v = fy - j, w = fz - k;
    const L = (a, b, t) => a + (b - a) * t;
    return L(L(L(this.at(i, j, k), this.at(i + 1, j, k), u), L(this.at(i, j + 1, k), this.at(i + 1, j + 1, k), u), v),
      L(L(this.at(i, j, k + 1), this.at(i + 1, j, k + 1), u), L(this.at(i, j + 1, k + 1), this.at(i + 1, j + 1, k + 1), u), v), w);
  }
}

// ---- surface nets -------------------------------------------------------------------------------------------------------
// value(i,j,k) -> scalar (negative inside). Returns { positions, normals, indices } with normals from the gradient of
// `grad(x,y,z)` (defaults to finite differences of the same values). `smooth` relaxes vertices toward neighbours.
export function surfaceNets(field, value, { smooth = 1 } = {}) {
  const n = field.n, s = field.step, m = field.min;
  const cellIndex = new Int32Array((n[0] - 1) * (n[1] - 1) * (n[2] - 1)).fill(-1);
  const pos = [];
  const cid = (i, j, k) => (k * (n[1] - 1) + j) * (n[0] - 1) + i;
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < n[2] - 1; k++) for (let j = 0; j < n[1] - 1; j++) for (let i = 0; i < n[0] - 1; i++) {
    let mask = 0;
    for (let d = 0; d < 8; d++) { const v = value(i + (d & 1), j + ((d >> 1) & 1), k + ((d >> 2) & 1)); cv[d] = v; if (v < 0) mask |= 1 << d; }
    if (mask === 0 || mask === 255) continue;
    let x = 0, y = 0, z = 0, c = 0;
    for (const [a, b] of E) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      x += (a & 1) + ((b & 1) - (a & 1)) * t; y += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t; z += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
      c++;
    }
    cellIndex[cid(i, j, k)] = pos.length / 3;
    pos.push(m[0] + (i + x / c) * s, m[1] + (j + y / c) * s, m[2] + (k + z / c) * s);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < n[2] - 1; k++) for (let j = 1; j < n[1] - 1; j++) for (let i = 1; i < n[0] - 1; i++) {
    const v0 = value(i, j, k) < 0;
    if (i < n[0] - 1 && v0 !== (value(i + 1, j, k) < 0)) quad(cellIndex[cid(i, j - 1, k - 1)], cellIndex[cid(i, j, k - 1)], cellIndex[cid(i, j, k)], cellIndex[cid(i, j - 1, k)], !v0);
    if (j < n[1] - 1 && v0 !== (value(i, j + 1, k) < 0)) quad(cellIndex[cid(i - 1, j, k - 1)], cellIndex[cid(i - 1, j, k)], cellIndex[cid(i, j, k)], cellIndex[cid(i, j, k - 1)], !v0);
    if (k < n[2] - 1 && v0 !== (value(i, j, k + 1) < 0)) quad(cellIndex[cid(i - 1, j - 1, k)], cellIndex[cid(i, j - 1, k)], cellIndex[cid(i, j, k)], cellIndex[cid(i - 1, j, k)], !v0);
  }
  // Relax: move each vertex part way to the mean of its neighbours (keeps the surface, removes grid stair-steps).
  const P = new Float32Array(pos);
  if (smooth > 0) {
    const nb = Array.from({ length: P.length / 3 }, () => new Set());
    for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) { const a = idx[t + e], b = idx[t + (e + 1) % 3]; nb[a].add(b); nb[b].add(a); }
    for (let it = 0; it < smooth; it++) {
      const Q = P.slice();
      for (let v = 0; v < nb.length; v++) {
        if (!nb[v].size) continue;
        let x = 0, y = 0, z = 0;
        for (const u of nb[v]) { x += Q[u * 3]; y += Q[u * 3 + 1]; z += Q[u * 3 + 2]; }
        const c = nb[v].size;
        P[v * 3] = Q[v * 3] * 0.5 + (x / c) * 0.5; P[v * 3 + 1] = Q[v * 3 + 1] * 0.5 + (y / c) * 0.5; P[v * 3 + 2] = Q[v * 3 + 2] * 0.5 + (z / c) * 0.5;
      }
    }
  }
  return { positions: P, indices: idx };
}
