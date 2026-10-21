// Procedural PBR textures for the remastered look: every surface gets colour, roughness and normal detail.
// Each recipe paints a tileable height field plus albedo and roughness into float buffers; the normal map is derived
// from the height (Sobel). Albedos are mostly neutral-to-warm so one texture can be tinted per building through
// vertex colours (paint colour, siding stain, stucco tint) without the repetition showing.
// Generated in-house (no third-party assets). See assets/textures/CREDITS.md.

import * as THREE from 'three';

// ---- tileable noise -------------------------------------------------------------------------------------------------
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
// Value noise on a lattice that wraps every `p` cells (x, y in lattice units).
function vnoise(x, y, p, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = fade(x - xi), fy = fade(y - yi);
  const m = (v) => ((v % p) + p) % p;
  const a = hash2(m(xi), m(yi), s), b = hash2(m(xi + 1), m(yi), s), c = hash2(m(xi), m(yi + 1), s), d = hash2(m(xi + 1), m(yi + 1), s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
// fbm over u,v in [0,1): base period p cells, doubling per octave, so it tiles.
function fbm(u, v, p, oct, s, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0;
  for (let o = 0; o < oct; o++) { sum += vnoise(u * p, v * p, p, s + o * 17) * amp; norm += amp; amp *= gain; p *= 2; }
  return sum / norm;
}
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---- buffers and upload -------------------------------------------------------------------------------------------
class Tex {
  constructor(w, h = w) { this.w = w; this.h = h; this.n = w * h; this.H = new Float32Array(this.n); this.C = new Float32Array(this.n * 3); this.R = new Float32Array(this.n).fill(0.8); this.A = null; }
  each(fn) { const { w, h } = this; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fn(x / w, y / h, y * w + x, x, y); }
  col(i, r, g, b) { this.C[i * 3] = r; this.C[i * 3 + 1] = g; this.C[i * 3 + 2] = b; }
}

function upload(t, { normal = 1, wrap = true, alpha = false } = {}) {
  const { w, h, n } = t;
  const col = new Uint8Array(n * 4), nor = new Uint8Array(n * 4), rough = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    col[i * 4] = clamp(t.C[i * 3]) ** (1 / 2.2) * 255; col[i * 4 + 1] = clamp(t.C[i * 3 + 1]) ** (1 / 2.2) * 255; col[i * 4 + 2] = clamp(t.C[i * 3 + 2]) ** (1 / 2.2) * 255;
    col[i * 4 + 3] = t.A ? clamp(t.A[i]) * 255 : 255;
    const r = clamp(t.R[i]) * 255; rough[i * 4] = r; rough[i * 4 + 1] = r; rough[i * 4 + 2] = r; rough[i * 4 + 3] = 255;
  }
  // Normal from height (wrapping Sobel). `normal` is metres of relief per unit height over the texel pitch.
  const H = t.H, at = (x, y) => H[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * normal;
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * normal;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    nor[i] = (-dx / l * 0.5 + 0.5) * 255; nor[i + 1] = (-dy / l * 0.5 + 0.5) * 255; nor[i + 2] = (1 / l * 0.5 + 0.5) * 255; nor[i + 3] = 255;
  }
  const mk = (data, srgb) => {
    const tx = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tx.wrapS = tx.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tx.magFilter = THREE.LinearFilter; tx.minFilter = THREE.LinearMipmapLinearFilter; tx.generateMipmaps = true; tx.anisotropy = 8;
    if (srgb) tx.colorSpace = THREE.SRGBColorSpace;
    tx.needsUpdate = true;
    return tx;
  };
  return { map: mk(col, true), normalMap: mk(nor, false), roughnessMap: mk(rough, false), alpha };
}

// ---- crack helper: random-walk polylines carved into the height field ---------------------------------------------
function cracks(t, count, seed, { len = 60, depth = 0.5, dark = 0.55, width = 1 } = {}) {
  const { w, h } = t;
  for (let c = 0; c < count; c++) {
    let x = hash2(c, 1, seed) * w, y = hash2(c, 2, seed) * h, a = hash2(c, 3, seed) * Math.PI * 2;
    const L = len * (0.5 + hash2(c, 4, seed));
    for (let s = 0; s < L; s++) {
      a += (hash2(c, s + 10, seed) - 0.5) * 0.9;
      x += Math.cos(a); y += Math.sin(a);
      for (let oy = -width; oy <= width; oy++) for (let ox = -width; ox <= width; ox++) {
        const px = ((Math.round(x) + ox) % w + w) % w, py = ((Math.round(y) + oy) % h + h) % h, i = py * w + px;
        const k = ox === 0 && oy === 0 ? 1 : 0.35;
        t.H[i] -= depth * k; t.C[i * 3] *= 1 - (1 - dark) * k; t.C[i * 3 + 1] *= 1 - (1 - dark) * k; t.C[i * 3 + 2] *= 1 - (1 - dark) * k; t.R[i] = Math.min(1, t.R[i] + 0.1 * k);
      }
      // Occasional branch.
      if (hash2(c, s, seed + 9) < 0.02) a += (hash2(c, s, seed + 3) - 0.5) * 2.4;
    }
  }
}

// ---- recipes ------------------------------------------------------------------------------------------------------
// Each returns a Tex. Sizes are texels; the material decides the world tile size.
const R = {
  // Sun-bleached asphalt: aggregate grain, tonal drift, tar-sealed cracks, darker repair patches.
  asphalt(N = 512) {
    const t = new Tex(N);
    t.each((u, v, i) => {
      const grain = fbm(u, v, 128, 2, 7), g2 = fbm(u, v, 32, 2, 3);
      const drift = fbm(u, v, 2, 3, 11), patch = fbm(u, v, 3, 3, 21);
      let k = 0.58 + (drift - 0.5) * 0.1 + (grain - 0.5) * 0.06 + (g2 - 0.5) * 0.05;
      if (patch > 0.67) k *= 0.9; // patched with newer, darker asphalt
      t.col(i, k * 0.99, k * 0.985, k * 0.97);
      t.H[i] = grain * 0.5 + g2 * 0.3;
      t.R[i] = 0.86 + grain * 0.08;
    });
    cracks(t, 3, 41, { len: 120, depth: 0.4, dark: 0.78, width: 0 });
    return t;
  },
  // Poured concrete with slab joints every half tile, trowel streaks, stains.
  concrete(N = 512, joints = 2) {
    const t = new Tex(N);
    t.each((u, v, i) => {
      const fine = hash2(u * N, v * N, 5), mid = fbm(u, v, 16, 3, 8), stain = fbm(u, v, 3, 4, 13);
      let k = 0.72 + (mid - 0.5) * 0.1 + (fine - 0.5) * 0.06 - smooth(0.58, 0.8, stain) * 0.12;
      const ju = Math.abs(((u * joints) % 1) - 0.5) * 2, jv = Math.abs(((v * joints) % 1) - 0.5) * 2;
      const joint = joints ? Math.max(smooth(0.985, 1, ju), smooth(0.985, 1, jv)) : 0;
      k *= 1 - joint * 0.4;
      t.col(i, k * 1.0, k * 0.98, k * 0.94);
      t.H[i] = fine * 0.15 + mid * 0.3 - joint * 1.2;
      t.R[i] = 0.78 + fine * 0.1 + joint * 0.1;
    });
    cracks(t, 3, 77, { len: 70, depth: 0.6, dark: 0.6 });
    return t;
  },
  // Kerb paint: red over concrete, chipped and sun-faded.
  redPaint(N = 256) {
    const t = R.concrete(N, 0);
    t.each((u, v, i) => {
      const chip = fbm(u, v, 8, 4, 31);
      if (chip < 0.62) { const k = 0.85 + fbm(u, v, 32, 2, 4) * 0.2; t.col(i, 0.62 * k, 0.16 * k, 0.1 * k); t.R[i] = 0.6; t.H[i] += 0.3; }
    });
    return t;
  },
  // Lawn: mixed greens, dry yellow patches, blade streaks.
  grass(N = 512) {
    const t = new Tex(N);
    t.each((u, v, i) => {
      const blade = hash2(u * N, Math.floor(v * N / 3), 2), mid = fbm(u, v, 8, 4, 6), dry = fbm(u, v, 3, 4, 19);
      const d = smooth(0.58, 0.8, dry) * 0.7;
      const k = 0.62 + blade * 0.32 + (mid - 0.5) * 0.35;
      t.col(i, (0.13 + d * 0.15) * k, (0.25 + d * 0.03) * k, (0.08 + d * 0.03) * k);
      t.H[i] = blade * 0.8 + mid * 0.4;
      t.R[i] = 0.85;
    });
    return t;
  },
  dirt(N = 256) {
    const t = new Tex(N);
    t.each((u, v, i) => { const f = fbm(u, v, 8, 5, 3), g = hash2(u * N, v * N, 1); const k = 0.5 + f * 0.4 + g * 0.1; t.col(i, 0.42 * k, 0.34 * k, 0.25 * k); t.H[i] = f + g * 0.3; t.R[i] = 0.92; });
    return t;
  },
  // Lap siding: boards 1/12 of the tile high, each with a shadowed drip edge, wood grain and per-board stain.
  siding(N = 512, boards = 12) {
    const t = new Tex(N);
    t.each((u, v, i) => {
      const b = Math.floor(v * boards), f = (v * boards) % 1;
      const board = hash2(b, 3, 4), grain = fbm(u * 0.25 + board, v * boards * 0.08 + b, 6, 3, 9);
      const fiber = vnoise(u * 160 + board * 9, f * 6, 1e9, 2);
      const lap = smooth(1.0, 0.86, f) * (0.8 + 0.2 * (1 - f)); // the board above overlaps this one: shadow line under its lip
      const k = (0.62 + board * 0.18 + (grain - 0.5) * 0.25 + (fiber - 0.5) * 0.1) * (0.45 + 0.55 * lap);
      t.col(i, k, k * 0.96, k * 0.9);
      t.H[i] = (1 - f) * 0.6 + fiber * 0.05 + grain * 0.1;
      t.R[i] = 0.7 + fiber * 0.15;
    });
    return t;
  },
  // Stucco / render: lumpy trowel texture, neutral so it takes any tint; damp staining low on the wall is in the shader.
  stucco(N = 512) {
    const t = new Tex(N);
    t.each((u, v, i) => {
      const l = fbm(u, v, 32, 3, 4), f = hash2(u * N, v * N, 2), m = fbm(u, v, 4, 3, 12);
      const k = 0.78 + (l - 0.5) * 0.12 + (m - 0.5) * 0.1 + (f - 0.5) * 0.05;
      t.col(i, k, k * 0.99, k * 0.96);
      t.H[i] = l * 1.0 + f * 0.25;
      t.R[i] = 0.88;
    });
    return t;
  },
  // Running-bond brick: 8 courses x 4 bricks per tile, recessed mortar, per-brick colour and chips.
  brick(N = 512) {
    const t = new Tex(N), rows = 16, cols = 4;
    t.each((u, v, i) => {
      const r = Math.floor(v * rows), off = r % 2 ? 0.5 : 0, cu = u * cols + off, c = Math.floor(cu);
      const fu = cu - c, fv = v * rows - r;
      const mortar = 1 - smooth(0.0, 0.05, Math.min(fu, 1 - fu) * 0.5) * smooth(0.0, 0.1, Math.min(fv, 1 - fv));
      const id = hash2(((c % cols) + cols) % cols, r, 3), n = fbm(u, v, 32, 3, 5), f = hash2(u * N, v * N, 9);
      const brick = [0.5 + id * 0.18, 0.24 + id * 0.08, 0.17 + id * 0.05].map((x) => x * (0.85 + n * 0.3 + (f - 0.5) * 0.08));
      const mor = [0.62, 0.6, 0.56].map((x) => x * (0.9 + f * 0.15));
      t.col(i, brick[0] * (1 - mortar) + mor[0] * mortar, brick[1] * (1 - mortar) + mor[1] * mortar, brick[2] * (1 - mortar) + mor[2] * mortar);
      t.H[i] = (1 - mortar) * (0.8 + n * 0.3) + f * 0.08;
      t.R[i] = 0.85 + mortar * 0.08;
    });
    return t;
  },
  // Three-tab asphalt shingles: courses with a step edge, staggered tabs, granules, per-tab weathering.
  shingles(N = 512) {
    const t = new Tex(N), rows = 10, tabs = 4;
    t.each((u, v, i) => {
      const r = Math.floor(v * rows), fv = (v * rows) % 1, cu = u * tabs + (r % 2) * 0.5, c = Math.floor(cu), fu = cu - c;
      const gap = smooth(0.0, 0.025, Math.min(fu, 1 - fu)) > 0.5 || fv > 0.45 ? 1 : 0.35;
      const id = hash2(((c % tabs) + tabs) % tabs, r, 6), gr = hash2(u * N, v * N, 4), w = fbm(u, v, 6, 3, 9);
      const k = (0.36 + id * 0.12 + (gr - 0.5) * 0.14 + (w - 0.5) * 0.12) * gap * (0.6 + 0.4 * smooth(1.0, 0.8, fv));
      t.col(i, k, k * 0.95, k * 0.9);
      t.H[i] = (1 - fv) * 0.9 + gr * 0.12;
      t.R[i] = 0.9;
    });
    return t;
  },
  // Corrugated metal with rust bloom and streaks.
  metal(N = 256) {
    const t = new Tex(N);
    t.each((u, v, i) => {
      const s = Math.sin(u * Math.PI * 2 * 8) * 0.5 + 0.5, rust = smooth(0.55, 0.8, fbm(u, v, 4, 5, 3)), streak = fbm(u * 4, v * 0.25, 8, 3, 7);
      const k = 0.55 + s * 0.12 - streak * 0.1;
      t.col(i, k + rust * 0.12, k - rust * 0.12, k - rust * 0.25);
      t.H[i] = s;
      t.R[i] = 0.45 + rust * 0.45;
    });
    return t;
  },
  // Sectional garage door: 4 horizontal panels with raised fields.
  garageDoor(N = 256) {
    const t = new Tex(N);
    t.each((u, v, i) => {
      const pv = (v * 4) % 1, pu = (u * 4) % 1;
      const groove = smooth(0.96, 1, pv) + smooth(0.04, 0, pv);
      const field = smooth(0.1, 0.16, pu) * smooth(0.9, 0.84, pu) * smooth(0.18, 0.24, pv) * smooth(0.82, 0.76, pv);
      const f = fbm(u, v, 16, 3, 3);
      const k = (0.78 + (f - 0.5) * 0.08) * (1 - groove * 0.45);
      t.col(i, k, k, k * 0.97);
      t.H[i] = field * 0.5 - groove;
      t.R[i] = 0.55;
    });
    return t;
  },
  // Painted trim boards: smooth paint with slight brush streaks.
  paint(N = 256) {
    const t = new Tex(N);
    t.each((u, v, i) => { const s = fbm(u * 0.1, v, 64, 2, 2), f = fbm(u, v, 8, 3, 5); const k = 0.82 + (s - 0.5) * 0.06 - smooth(0.6, 0.85, f) * 0.1; t.col(i, k, k, k * 0.98); t.H[i] = s * 0.2; t.R[i] = 0.55 + f * 0.2; });
    return t;
  },
  // Vertical fence planks, weathered grey-brown.
  planks(N = 256, n = 8) {
    const t = new Tex(N);
    t.each((u, v, i) => {
      const p = Math.floor(u * n), fu = (u * n) % 1, id = hash2(p, 1, 2);
      const gap = smooth(0, 0.04, Math.min(fu, 1 - fu));
      const grain = vnoise(fu * 4 + id * 7, v * 60, 1e9, 3);
      const k = (0.5 + id * 0.2 + (grain - 0.5) * 0.15) * (0.3 + 0.7 * gap);
      t.col(i, k, k * 0.93, k * 0.84);
      t.H[i] = gap * 0.6 + grain * 0.1;
      t.R[i] = 0.85;
    });
    return t;
  },
  // Chain-link: diamond wire mesh (alpha).
  chainlink(N = 128) {
    const t = new Tex(N); t.A = new Float32Array(t.n);
    t.each((u, v, i) => {
      const a = (u + v) * 4, b = (u - v) * 4;
      const d = Math.min(Math.abs(a - Math.round(a)), Math.abs(b - Math.round(b)));
      const wire = 1 - smooth(0.035, 0.07, d);
      t.A[i] = wire; t.col(i, 0.62, 0.63, 0.62); t.H[i] = wire; t.R[i] = 0.4;
    });
    return t;
  },
  // Palm trunk: stacked leaf-scar rings.
  palmBark(N = 256) {
    const t = new Tex(N);
    t.each((u, v, i) => {
      const r = (v * 10) % 1, n = fbm(u, v, 8, 3, 2), f = hash2(u * N, v * N, 3);
      const ring = smooth(0.0, 0.25, r) * smooth(1.0, 0.75, r);
      const k = (0.38 + n * 0.16 + f * 0.05) * (0.6 + 0.4 * ring);
      t.col(i, k, k * 0.88, k * 0.74);
      t.H[i] = ring + n * 0.3;
      t.R[i] = 0.92;
    });
    return t;
  },
  bark(N = 256) {
    const t = new Tex(N);
    t.each((u, v, i) => { const f = fbm(u * 3, v * 0.5, 8, 4, 5), k = 0.32 + f * 0.25; t.col(i, k, k * 0.9, k * 0.8); t.H[i] = f; t.R[i] = 0.95; });
    return t;
  },
  // Window interior: blinds or curtains half drawn, dark room beyond. Glass reflection comes from the material.
  window(N = 256) {
    const t = new Tex(N);
    t.each((u, v, i) => {
      const slat = (v * 28) % 1, blinds = v > 0.45, curtain = Math.abs(u - 0.5) > 0.33;
      let k = 0.05 + fbm(u, v, 4, 2, 3) * 0.04;
      let c = [k, k * 1.02, k * 1.08];
      if (blinds) { const s = 0.55 + smooth(0.0, 0.2, slat) * 0.25; c = [s * 0.8, s * 0.78, s * 0.72]; }
      if (curtain) { const f = 0.5 + Math.sin(u * 90) * 0.15; c = [0.45 * f, 0.36 * f, 0.28 * f]; }
      t.col(i, c[0], c[1], c[2]); t.H[i] = blinds ? slat * 0.2 : 0; t.R[i] = 0.1;
    });
    return t;
  },
  // Palm frond card (alpha): rachis with drooping leaflets along it. u along the frond, v across.
  frond(W = 512, H = 128) {
    const t = new Tex(W, H); t.A = new Float32Array(t.n);
    t.each((u, v, i) => {
      const c = Math.abs(v - 0.5) * 2, span = Math.sin(Math.min(1, u * 1.1) * Math.PI) * (u < 0.06 ? 0 : 1);
      const n = Math.floor(u * 90), lf = (u * 90) % 1, side = v > 0.5 ? 1 : 0;
      const leaflet = Math.abs(lf - 0.5 - c * 0.45) < 0.36 ? 1 : 0;
      const rachis = c < 0.05 ? 1 : 0;
      const a = rachis || (c < span && leaflet && hash2(n, side, 3) > 0.05) ? 1 : 0;
      const tone = 0.75 + hash2(n, side, 4) * 0.35 - c * 0.15, tip = smooth(0.7, 1, c / Math.max(0.01, span)) * 0.6;
      t.A[i] = a; t.col(i, (0.1 + tip * 0.16) * tone, (0.19 + tip * 0.06) * tone, (0.05 + tip * 0.01) * tone); t.H[i] = a * (1 - c); t.R[i] = 0.6;
    });
    return t;
  },
  // Broadleaf cluster card (alpha): overlapping oval leaves.
  leaves(N = 256) {
    const t = new Tex(N); t.A = new Float32Array(t.n);
    const L = [];
    for (let k = 0; k < 70; k++) { const a = hash2(k, 1, 9) * Math.PI * 2, r = Math.sqrt(hash2(k, 2, 9)) * 0.42; L.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r, a: hash2(k, 3, 9) * Math.PI, s: 0.045 + hash2(k, 4, 9) * 0.03, c: hash2(k, 5, 9) }); }
    t.each((u, v, i) => {
      let hit = null;
      for (const l of L) { const dx = u - l.x, dy = v - l.y, ca = Math.cos(l.a), sa = Math.sin(l.a); const a = (dx * ca + dy * sa) / l.s, b = (-dx * sa + dy * ca) / (l.s * 0.5); if (a * a + b * b < 1) hit = { l, d: a * a + b * b, b }; }
      if (!hit) { t.A[i] = 0; t.col(i, 0.1, 0.16, 0.05); return; }
      const k = 0.55 + hit.l.c * 0.45 - hit.d * 0.15 - (Math.abs(hit.b) < 0.08 ? 0.1 : 0);
      t.A[i] = 1; t.col(i, 0.12 * k, 0.22 * k, 0.06 * k); t.H[i] = 1 - hit.d; t.R[i] = 0.55;
    });
    return t;
  },
  // Grass tuft card (alpha): tapered blades rising from the bottom edge.
  tuft(N = 128) {
    const t = new Tex(N); t.A = new Float32Array(t.n);
    const B = [];
    for (let k = 0; k < 26; k++) B.push({ x: 0.08 + hash2(k, 1, 5) * 0.84, h: 0.4 + hash2(k, 2, 5) * 0.58, lean: (hash2(k, 3, 5) - 0.5) * 0.5, w: 0.012 + hash2(k, 4, 5) * 0.012, c: hash2(k, 5, 5) });
    t.each((u, v, i) => {
      let hit = null;
      for (const b of B) { if (v > b.h) continue; const x = b.x + b.lean * v * v; if (Math.abs(u - x) < b.w * (1 - v / b.h)) hit = b; }
      t.A[i] = hit ? 1 : 0;
      const k = hit ? (0.5 + hit.c * 0.4) * (0.55 + v * 0.6) : 0.3;
      t.col(i, 0.15 * k + (hit && hit.c > 0.85 ? 0.08 : 0), 0.27 * k, 0.09 * k); t.H[i] = t.A[i]; t.R[i] = 0.7;
    });
    return t;
  },
  // Painted road line: white with wear holes showing through (alpha).
  roadPaint(N = 256) {
    const t = new Tex(N); t.A = new Float32Array(t.n);
    t.each((u, v, i) => { const w = fbm(u, v, 8, 5, 12), g = hash2(u * N, v * N, 2); t.A[i] = smooth(0.3, 0.42, w) * (g > 0.12 ? 1 : 0); t.col(i, 0.85, 0.85, 0.82); t.H[i] = t.A[i] * 0.3; t.R[i] = 0.6; });
    return t;
  },
  tarGravel(N = 256) {
    const t = new Tex(N);
    t.each((u, v, i) => { const g = hash2(u * N, v * N, 3), f = fbm(u, v, 8, 3, 2); const k = 0.38 + g * 0.2 + f * 0.1; t.col(i, k, k * 0.97, k * 0.92); t.H[i] = g; t.R[i] = 0.95; });
    return t;
  },
};

// Build (once) and return every texture set. opts per name: normal strength, alpha.
const SPECS = {
  asphalt: { normal: 0.45 }, concrete: { normal: 2 }, redPaint: { normal: 2 }, grass: { normal: 2 }, dirt: { normal: 2 },
  siding: { normal: 5 }, stucco: { normal: 1.4 }, brick: { normal: 4 }, shingles: { normal: 5 }, metal: { normal: 3 },
  garageDoor: { normal: 4 }, paint: { normal: 1 }, planks: { normal: 3 }, chainlink: { normal: 1, alpha: true },
  palmBark: { normal: 4 }, bark: { normal: 4 }, window: { normal: 1 }, frond: { normal: 1, alpha: true, wrap: false },
  leaves: { normal: 2, alpha: true, wrap: false }, roadPaint: { normal: 1, alpha: true }, tuft: { normal: 1, alpha: true, wrap: false }, tarGravel: { normal: 3 },
};
let cache = null;
export function heroTextures() {
  if (cache) return cache;
  cache = {};
  for (const [name, o] of Object.entries(SPECS)) cache[name] = upload(R[name](), o);
  return cache;
}
