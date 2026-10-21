// Close-up level of detail (anyone within ~10 m of the camera): one continuous skinned human built from a Person spec.
//  - Body: a smooth signed-distance body (torso, limbs, muscles, belly) polygonised with surface nets in the A-pose
//    bind space and skinned to the rig's parts by distance-to-bone weights, so it bends without seams.
//  - Head: a finer SDF with brow ridge, eye sockets and lids, nose with nostrils, lips, jaw, chin, cheekbones and
//    ears, plus eyeballs. Hands: palm, four three-jointed fingers and a thumb, relaxed curl.
//  - Hair, brows and facial hair: shells over the head with clumps; strand-shaded.
//  - Clothing: thicker iso-surfaces of the same body field cut by garment regions (hems, cuffs, neck holes, open
//    jacket front), layered inner to outer with folds at elbows, knees, ankles and waist; boots or shoes.
// The rig (pivots, part names) is the same one the low LOD and the animator use, so every existing pose drives it.

import * as THREE from 'three';
import { RigType } from '../rig.js';
import { Field, surfaceNets, sphere, ellipsoid, capsule, roundBox, smin, smax, noise3 } from './sdf.js';
import { BIND_POSE, greyed } from './person.js';
import { skinMaterial, eyeMaterial, hairMaterial, fabricMaterial, gunMaterial } from './materials.js';

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const segDist = (p, a, b) => { const ba = sub3(b, a), pa = sub3(p, a); const t = Math.max(0, Math.min(1, dot3(pa, ba) / (dot3(ba, ba) || 1))); return Math.hypot(pa[0] - ba[0] * t, pa[1] - ba[1] * t, pa[2] - ba[2] * t); };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class HiHuman {
  constructor(spec, def) {
    this.spec = spec;
    this.def = def;
    const solver = new RigType(def, 0, null);
    const rest = solver.compute(new THREE.Matrix4(), BIND_POSE).map((m) => m.clone());
    this.idx = Object.fromEntries(def.parts.map((p, i) => [p.name, i]));
    const P = (part, l = [0, 0, 0]) => { const v = new THREE.Vector3(...l).applyMatrix4(rest[this.idx[part]]); return [v.x, v.y, v.z]; };
    const J = {};
    for (const L of ['L', 'R']) {
      J['sh' + L] = P('arm' + L); J['el' + L] = P('fore' + L); J['wr' + L] = P('fore' + L, [0, -0.27, 0]);
      J['hip' + L] = P('leg' + L); J['kn' + L] = P('shin' + L); J['an' + L] = P('foot' + L); J['toe' + L] = P('foot' + L, [0, -0.05, -0.17]);
    }
    J.neck = P('head');
    this.J = J;
    // Skeleton: one bone per rig part, bound at the A-pose.
    this.bones = def.parts.map(() => new THREE.Bone());
    this.skeleton = new THREE.Skeleton(this.bones, rest.map((m) => m.clone().invert()));
    this.group = new THREE.Group();
    this.group.name = `hi:${spec.id}`;
    const t0 = performance.now();
    this.build();
    this.buildMs = performance.now() - t0;
  }

  // ---- assembly -----------------------------------------------------------------------------------------------------
  build() {
    const S = this.spec, J = this.J, k = S.build, fem = S.sex === 'f';
    const head = J.neck;
    // Weight segments (bind space).
    const seg = [['hips', [0, 0.84, 0], [0, 1.0, 0]], ['torso', [0, 1.05, 0], [0, 1.46, 0]], ['head', [0, head[1] + 0.03, 0], [0, head[1] + 0.25, 0]]];
    for (const L of ['L', 'R']) seg.push(['arm' + L, J['sh' + L], J['el' + L]], ['fore' + L, J['el' + L], J['wr' + L]], ['leg' + L, J['hip' + L], J['kn' + L]], ['shin' + L, J['kn' + L], J['an' + L]], ['foot' + L, J['an' + L], J['toe' + L]]);
    this.segs = seg.map(([n, a, b]) => ({ bone: this.idx[n], name: n, a, b, side: n.endsWith('L') ? -1 : n.endsWith('R') ? 1 : 0, limb: /arm|fore/.test(n) ? 'arm' : /leg|shin|foot/.test(n) ? 'leg' : 'core' }));

    const bodyF = this.bodyField();
    const layers = this.garments();
    const field = new Field(bodyF, [-0.62, 0.02, -0.26], [0.62, 1.68, 0.24], 0.011, 0.075);
    const at = (i, j, kk) => [field.min[0] + i * field.step, field.min[1] + j * field.step, field.min[2] + kk * field.step];
    const skin = skinMaterial(S, head);
    // Skin: only where no garment covers it (with a margin), below the head's neck.
    const shoeTop = S.outfit.shoes.type === 'boots' ? 0.19 : 0.12;
    const cover = (p, from) => { let c = p[1] - (shoeTop - 0.02); for (let i = from; i < layers.length; i++) c = Math.min(c, layers[i].mask(p) + 0.022); return c; };
    this.addMesh(surfaceNets(field, (i, j, kk) => { const p = at(i, j, kk); return Math.max(field.at(i, j, kk), -cover(p, 0), p[1] - (head[1] + 0.03)); }), skin, 'body');
    layers.forEach((g, li) => {
      const m = surfaceNets(field, (i, j, kk) => {
        const p = at(i, j, kk);
        let v = field.at(i, j, kk) - g.t - (g.fold ? g.fold(p) : 0);
        if (g.extra) v = Math.min(v, g.extra(p));
        return Math.max(v, g.mask(p), -cover(p, li + 1) + 0.004);
      });
      this.addMesh(m, g.mat, g.name);
    });
    this.buildHead(skin);
    this.buildHands(skin);
    this.buildShoes();
    this.buildGun();
    this.verts = this.group.children.reduce((n, m) => n + m.geometry.attributes.position.count, 0);
  }

  // Bone weights by distance to each bone segment (top 4, inverse 4th power), with limbs kept off the trunk.
  weights(p, only = null) {
    const S = this.spec, best = [];
    for (const s of this.segs) {
      if (only && !only.includes(s.name)) continue;
      let d = segDist(p, s.a, s.b);
      if (s.limb === 'arm') d += Math.max(0, 0.15 * S.build - s.side * p[0]) * 1.6;
      if (s.limb === 'leg') d += Math.max(0, p[1] - 0.93) * 2.5 + Math.max(0, -s.side * p[0]) * 3;
      if (s.limb === 'arm' && s.side * p[0] < 0) d += 1;
      best.push([1 / Math.pow(d + 0.012, 4), s.bone]);
    }
    best.sort((a, b) => b[0] - a[0]);
    const top = best.slice(0, 4), sum = top.reduce((a, b) => a + b[0], 0);
    return top.map(([w, b]) => [w / sum, b]);
  }

  addMesh({ positions, indices }, material, name, { only = null, rigid = null } = {}) {
    if (!indices.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const n = positions.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) {
      if (rigid != null) { si[v * 4] = rigid; sw[v * 4] = 1; continue; }
      const w = this.weights([positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]], only);
      w.forEach(([ww, b], i) => { si[v * 4 + i] = b; sw[v * 4 + i] = ww; });
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    const m = new THREE.SkinnedMesh(g, material);
    m.name = name;
    m.bind(this.skeleton, new THREE.Matrix4());
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    this.group.add(m);
    return m;
  }

  // ---- body ---------------------------------------------------------------------------------------------------------
  bodyField() {
    const S = this.spec, J = this.J, k = S.build, fem = S.sex === 'f', bel = Math.max(0, S.belly), shW = S.shoulders, hpW = S.hipW;
    const sw = 0.2 * k;
    const side = (L) => (L === 'L' ? -1 : 1);
    const parts = ['L', 'R'].map((L) => ({
      s: side(L), sh: J['sh' + L], el: J['el' + L], wr: J['wr' + L], hip: J['hip' + L], kn: J['kn' + L], an: J['an' + L], toe: J['toe' + L],
      bi: lerp3(J['sh' + L], J['el' + L], 0.45), fa: lerp3(J['el' + L], J['wr' + L], 0.25), calf: lerp3(J['kn' + L], J['an' + L], 0.3),
    }));
    return (p) => {
      let d = ellipsoid(p, [0, 0.935, 0.005], [0.155 * k * hpW, 0.11, 0.105]);
      for (const s of [-1, 1]) d = smin(d, sphere(p, [s * 0.07 * hpW, 0.9, 0.045], 0.08 * k), 0.04);
      d = smin(d, ellipsoid(p, [0, 1.08, 0.0], [0.138 * k * (1 + bel * 0.15), 0.13, 0.098 * (1 + bel * 0.25)]), 0.06);
      if (bel > 0) d = smin(d, ellipsoid(p, [0, 1.05, -0.035 - 0.025 * bel], [0.12 * k * (0.9 + bel * 0.2), 0.1, 0.07 + 0.035 * bel]), 0.06);
      d = smin(d, ellipsoid(p, [0, 1.3, 0.005], [0.162 * k * shW * (fem ? 0.94 : 1), 0.15, 0.108]), 0.07);
      d = smin(d, ellipsoid(p, [0, 1.38, 0.03], [0.15 * k * shW, 0.1, 0.085]), 0.05);
      for (const s of [-1, 1]) d = fem ? smin(d, sphere(p, [s * 0.062, 1.28, -0.07], 0.062), 0.04) : smin(d, ellipsoid(p, [s * 0.065, 1.33, -0.06], [0.07, 0.055, 0.04]), 0.04);
      d = smin(d, capsule(p, [0, 1.42, 0.012], [0, 1.64, 0.004], 0.058 * (fem ? 0.88 : 1)), 0.04);
      for (const a of parts) {
        d = smin(d, capsule(p, [a.s * 0.03, 1.5, 0.025], [a.s * (sw - 0.02), 1.47, 0.01], 0.042), 0.04);
        d = smin(d, sphere(p, [a.sh[0] + a.s * 0.005, a.sh[1] - 0.005, a.sh[2]], 0.056 * k * shW), 0.035);
        d = smin(d, capsule(p, a.sh, a.el, 0.05 * k, 0.038 * k), 0.03);
        d = smin(d, ellipsoid(p, [a.bi[0], a.bi[1], a.bi[2] - 0.012], [0.04 * k, 0.06, 0.042 * k]), 0.03);
        d = smin(d, capsule(p, a.el, a.wr, 0.04 * k, 0.027), 0.025);
        d = smin(d, sphere(p, a.fa, 0.042 * k), 0.03);
        d = smin(d, capsule(p, a.hip, a.kn, 0.086 * k, 0.055), 0.05);
        d = smin(d, sphere(p, [a.kn[0], a.kn[1], a.kn[2] - 0.008], 0.05), 0.03);
        d = smin(d, capsule(p, a.kn, a.an, 0.052, 0.034), 0.03);
        d = smin(d, ellipsoid(p, [a.calf[0], a.calf[1], a.calf[2] + 0.022], [0.048, 0.09, 0.048]), 0.03);
        d = smin(d, capsule(p, a.an, a.toe, 0.035, 0.03), 0.02);
      }
      return d;
    };
  }

  // Garment layers, inner to outer: { name, t (thickness over skin), mask(p) (<0 inside the garment), fold(p), extra(p), mat }.
  garments() {
    const S = this.spec, J = this.J, k = S.build, o = S.outfit, out = [];
    // Arm cut: positive when p is beyond the plane at fraction u along shoulder->elbow (0..1) or elbow->wrist (1..2)
    // AND out past the side of the torso (so the plane never slices the trunk).
    const armCut = (p, L, u) => {
      const s = L === 'L' ? -1 : 1, a = J['sh' + L], b = J['el' + L], c = J['wr' + L];
      const pt = u <= 1 ? lerp3(a, b, u) : lerp3(b, c, u - 1), dir = u <= 1 ? norm3(sub3(b, a)) : norm3(sub3(c, b));
      return Math.min(dot3(sub3(p, pt), dir), s * p[0] - 0.15 * k * S.shoulders);
    };
    const armU = (p, L) => { const a = J['sh' + L], b = J['el' + L], c = J['wr' + L]; const d1 = segDist(p, a, b), d2 = segDist(p, b, c); if (d1 < d2) { const ba = sub3(b, a); return Math.max(0, Math.min(1, dot3(sub3(p, a), ba) / dot3(ba, ba))); } const cb = sub3(c, b); return 1 + Math.max(0, Math.min(1, dot3(sub3(p, b), cb) / dot3(cb, cb))); };
    const neckHole = (p, r, scoop = 0) => r + scoop * smooth(0.02, -0.06, p[2]) - Math.hypot(p[0], p[2] - 0.008) - Math.max(0, 1.43 - p[1]) * 4;
    const sleeveFold = (p) => {
      const L = p[0] < 0 ? 'L' : 'R';
      if ((L === 'L' ? -p[0] : p[0]) < 0.15 * k) return 0;
      const u = armU(p, L);
      return 0.0035 * Math.sin(u * Math.PI * 14) * Math.exp(-(((u - 1) / 0.18) ** 2)) + 0.003 * Math.sin(u * Math.PI * 22) * smooth(1.72, 1.92, u);
    };
    const bulk = (p) => 0.0022 * (noise3(p[0] * 16, p[1] * 16, p[2] * 16) - 0.5) * 2;
    // Bottoms.
    const b = o.bottom, short = b.type === 'shorts';
    const pantsMask = (p) => Math.max(p[1] - 0.978, (short ? 0.56 : 0.105) - p[1], Math.abs(p[0]) - 0.27);
    out.push({
      name: 'bottom', t: 0.009, mask: pantsMask, mat: fabricMaterial(b.type === 'slacks' ? 'slacks' : 'denim', b.color, { worn: b.worn }),
      fold: (p) => (Math.abs(p[0]) > 0.27 ? 0 : 0.0035 * Math.sin(p[1] * 6.2832 / 0.036) * (Math.exp(-(((p[1] - 0.47) / 0.06) ** 2)) + smooth(0.24, 0.12, p[1]) * 1.4) + bulk(p)),
    });
    if (b.belt) out.push({ name: 'belt', t: 0.015, mask: (p) => Math.max(p[1] - 0.982, 0.944 - p[1], Math.abs(p[0]) - 0.27), mat: fabricMaterial('leather', b.belt, { belt: true }) });
    // Tops: an optional under layer, then the top.
    const top = (t, inner) => {
      const T = t.type;
      const sleeveU = T === 'tee' ? 0.42 : T === 'tank' || T === 'jersey' ? -1 : 1.93;
      const hem = T === 'jacket' ? 0.86 : T === 'hoodie' ? 0.9 : 0.905;
      const thick = { tank: 0.005, tee: 0.006, henley: 0.006, longsleeve: 0.007, jersey: 0.007, hoodie: 0.02, jacket: 0.022 }[T] + (inner ? -0.001 : 0);
      const openFront = T === 'jacket' ? (p) => Math.min(0.035 + Math.max(0, 1.5 - p[1]) * 0.05 - Math.abs(p[0]), -0.025 - p[2]) : null;
      const mask = (p) => {
        let m = Math.max(hem - p[1], p[1] - 1.62, neckHole(p, T === 'tank' || T === 'jersey' ? 0.085 : T === 'jacket' ? 0.1 : 0.072, T === 'tank' || T === 'jersey' ? 0.04 : 0.012));
        if (sleeveU < 0) m = Math.max(m, -p[0] - 0.14 * k * S.shoulders, p[0] - 0.14 * k * S.shoulders); // sleeveless: armholes
        else m = Math.max(m, armCut(p, 'L', sleeveU), armCut(p, 'R', sleeveU));
        if (openFront) m = Math.max(m, openFront(p));
        return m;
      };
      const kind = T === 'jacket' ? 'canvas' : T === 'hoodie' ? 'fleece' : T === 'jersey' ? 'jersey' : 'knit';
      const g = {
        name: inner ? 'under' : 'top', t: thick, mask, mat: fabricMaterial(kind, t.color, { worn: t.worn, henley: T === 'henley' }),
        fold: (p) => sleeveFold(p) + (T === 'jacket' || T === 'hoodie' ? 0.003 * Math.sin(p[1] * 6.2832 / 0.045) * Math.exp(-(((p[1] - 0.95) / 0.07) ** 2)) : 0) + bulk(p),
      };
      if (T === 'hoodie') g.extra = (p) => Math.max(ellipsoid(p, [0, 1.5, 0.075], [0.12, 0.07, 0.065]), p[1] - 1.6);
      out.push(g);
      if (T === 'jacket') out.push({ name: 'collar', t: thick + 0.009, mask: (p) => Math.max(1.425 - p[1], p[1] - 1.535, Math.hypot(p[0], p[2] - 0.008) - 0.125, openFront(p) + 0.006), mat: fabricMaterial('corduroy', t.collar ?? 0x3a2a20) });
    };
    if (o.under) top(o.under, true);
    top(o.top, false);
    return out;
  }

  // ---- head, eyes, hair -----------------------------------------------------------------------------------------------
  headF() {
    const S = this.spec, F = S.face, fem = S.sex === 'f', hf = fem ? 0.94 : 1;
    const sym = (f) => (q) => f([Math.abs(q[0]), q[1], q[2]]); // mirror across x for paired features
    const cheek = sym((q) => sphere(q, [0.046 * F.cheek, 0.15, -0.063], 0.021));
    const jawA = sym((q) => sphere(q, [0.054 * F.jaw * hf, 0.098, -0.004], 0.024));
    const jowl = sym((q) => sphere(q, [0.046, 0.092, -0.05], 0.018 + 0.008 * F.jowls));
    const socket = sym((q) => sphere(q, [0.031, 0.158, -0.101], 0.0175));
    const lidU = sym((q) => capsule(q, [0.018, 0.1645, -0.0965], [0.044, 0.1645, -0.0965], 0.0055));
    const lidL = sym((q) => capsule(q, [0.019, 0.1505, -0.096], [0.043, 0.1505, -0.096], 0.004));
    const ala = sym((q) => sphere(q, [0.0125 * F.noseW, 0.119, -0.104 - 0.006 * F.nose], 0.0085 * F.noseW));
    const nostril = sym((q) => sphere(q, [0.0065 * F.noseW, 0.1135, -0.1085 - 0.008 * F.nose], 0.0035));
    const ear = sym((q) => smax(ellipsoid(q, [0.076, 0.152, 0.01], [0.012 * F.ears, 0.031 * F.ears, 0.02 * F.ears]), -ellipsoid(q, [0.083, 0.15, 0.006], [0.006, 0.021, 0.012]), 0.004));
    return (q) => {
      let d = ellipsoid(q, [0, 0.19, 0.012], [0.074 * hf, 0.094 * hf, 0.098 * hf]);
      d = smin(d, ellipsoid(q, [0, 0.155, -0.03], [0.067 * hf, 0.08, 0.075]), 0.03);
      d = smin(d, ellipsoid(q, [0, 0.104, -0.032], [0.06 * F.jaw * hf, 0.048, 0.068]), 0.03);
      d = smin(d, jawA(q), 0.03);
      d = smin(d, ellipsoid(q, [0, 0.074, -0.08], [0.022 * F.chin, 0.02, 0.019]), 0.02);
      d = smin(d, cheek(q), 0.02);
      if (F.jowls > 0) d = smin(d, jowl(q), 0.02);
      d = smin(d, capsule(q, [-0.044, 0.176, -0.088], [0.044, 0.176, -0.088], 0.01 * F.brow), 0.018);
      d = smin(d, ellipsoid(q, [0, 0.105, -0.078], [0.033, 0.03, 0.028]), 0.02);
      d = smax(d, -socket(q), 0.008);
      d = smin(d, lidU(q), 0.006); d = smin(d, lidL(q), 0.005);
      d = smin(d, capsule(q, [0, 0.168, -0.097], [0, 0.128, -0.112 - 0.012 * F.nose], 0.0075), 0.012);
      d = smin(d, sphere(q, [0, 0.124, -0.114 - 0.012 * F.nose], 0.0115 * F.noseW), 0.008);
      d = smin(d, ala(q), 0.006);
      d = smax(d, -nostril(q), 0.003);
      d = smin(d, capsule(q, [-0.021 * F.lips, 0.1, -0.0985], [0.021 * F.lips, 0.1, -0.0985], 0.0068 * F.lips), 0.008);
      d = smin(d, capsule(q, [-0.018 * F.lips, 0.0885, -0.0965], [0.018 * F.lips, 0.0885, -0.0965], 0.0078 * F.lips), 0.008);
      d = smax(d, -capsule(q, [-0.024, 0.0945, -0.106], [0.024, 0.0945, -0.106], 0.0022), 0.003);
      d = smin(d, ear(q), 0.01);
      d = smin(d, capsule(q, [0, -0.08, 0.012], [0, 0.12, 0.008], 0.059 * (fem ? 0.88 : 1)), 0.03);
      if (!fem) d = smin(d, sphere(q, [0, 0.045, -0.05], 0.011), 0.012);
      return d;
    };
  }

  buildHead(skin) {
    const S = this.spec, hp = this.J.neck, H = this.idx.head, hf = S.sex === 'f' ? 0.94 : 1;
    const hF = this.headF();
    const toModel = (r) => { for (let i = 0; i < r.positions.length; i += 3) { r.positions[i] += hp[0]; r.positions[i + 1] += hp[1]; r.positions[i + 2] += hp[2]; } return r; };
    const fH = new Field(hF, [-0.1, -0.075, -0.135], [0.1, 0.3, 0.125], 0.0035, 0.02);
    // The neck's lower end blends into the torso's weights; everything above the jaw is rigid on the head bone.
    this.addMesh(toModel(surfaceNets(fH, (i, j, k) => fH.at(i, j, k))), skin, 'head', { only: ['torso', 'head'] });
    // Eyeballs.
    const eyeL = [-0.031 + hp[0], 0.158 + hp[1], -0.0875 + hp[2]], eyeR = [0.031 + hp[0], 0.158 + hp[1], -0.0875 + hp[2]];
    const eg = [];
    for (const e of [eyeL, eyeR]) { const g = new THREE.SphereGeometry(0.0118, 20, 14); g.translate(...e); eg.push(g); }
    const merged = mergeIndexed(eg);
    this.addMesh(merged, eyeMaterial(S, eyeL, eyeR), 'eyes', { rigid: H });
    // Scalp hair, then brows and facial hair, as shells over the head.
    const hair = S.hair, Hs = hair.style;
    const cran = (q) => ellipsoid(q, [0, 0.19, 0.012], [0.074 * hf, 0.094 * hf, 0.098 * hf]);
    const rec = Hs === 'receding' ? 0.03 : 0;
    const TBL = [[0, 0.212 + rec * 0.6], [0.55, 0.205 + rec * 1.3], [1.15, 0.185], [1.45, 0.172], [1.9, 0.13], [2.4, 0.085], [3.15, 0.07]];
    const hairline = (q) => {
      const th = Math.abs(Math.atan2(q[0], -q[2]));
      let yh = TBL[TBL.length - 1][1];
      for (let i = 1; i < TBL.length; i++) if (th <= TBL[i][0]) { const [a0, y0] = TBL[i - 1], [a1, y1] = TBL[i]; yh = y0 + (y1 - y0) * (th - a0) / (a1 - a0); break; }
      let m = yh - q[1];
      if (Hs === 'bald') m = Math.max(m, q[1] - 0.225);
      return m;
    };
    const T = { buzz: 0.0035, short: 0.011, receding: 0.009, curly: 0.026, long: 0.012, bun: 0.011, ponytail: 0.011, bald: 0.005 }[Hs];
    const A = { buzz: 0.0005, short: 0.004, receding: 0.0035, curly: 0.011, long: 0.004, bun: 0.003, ponytail: 0.003, bald: 0.002 }[Hs];
    const fq = Hs === 'curly' ? 70 : 45;
    const earCut = (q, d) => (Hs === 'long' ? d : smax(d, -sphere([Math.abs(q[0]), q[1], q[2]], [0.082, 0.15, 0.01], 0.028), 0.008));
    const scalp = (q) => {
      let d = cran(q) - T - A * (noise3(q[0] * fq, q[1] * fq, q[2] * fq) - 0.5) * 2;
      d = Math.max(d, hairline(q));
      if (Hs === 'long') d = Math.min(d, Math.max(capsule(q, [0, 0.2, 0.035], [0, -0.02, 0.06], 0.078) - A * (noise3(q[0] * 50, q[1] * 12, q[2] * 50) - 0.5) * 3, -0.015 - q[2] * 1.0 + 0.0, -0.06 - q[1]));
      if (Hs === 'ponytail') d = Math.min(d, capsule(q, [0, 0.17, 0.1], [0, 0.0, 0.135], 0.024) - A * noise3(q[0] * 60, q[1] * 20, q[2] * 60));
      if (Hs === 'bun') d = Math.min(d, sphere(q, [0, 0.255, 0.085], 0.042) - A * noise3(q[0] * 60, q[1] * 60, q[2] * 60));
      return earCut(q, d);
    };
    const crown = [hp[0], hp[1] + 0.27, hp[2] + 0.02];
    if (!(Hs === 'bald' && S.age < 25)) {
      const yMin = Hs === 'long' ? -0.09 : 0.02;
      const fS = new Field(scalp, [-0.115, yMin, -0.135], [0.115, 0.33, 0.165], 0.004, 0.02);
      this.addMesh(toModel(surfaceNets(fS, (i, j, k) => fS.at(i, j, k))), hairMaterial(hair.color, hair.grey, crown), 'hair', { rigid: H });
    }
    // Brows and facial hair (their own material: often greyer or darker than the scalp).
    const F = S.face, fac = S.facial?.style ?? 'none';
    const brow = (q) => { const a = [Math.abs(q[0]), q[1], q[2]]; return Math.min(capsule(a, [0.012, 0.1785, -0.0975], [0.032, 0.182, -0.096], 0.0042 * F.brow), capsule(a, [0.032, 0.182, -0.096], [0.051, 0.177, -0.087], 0.0036 * F.brow)) - 0.0012 * noise3(q[0] * 300, q[1] * 300, q[2] * 300); };
    const thick = S.id === 'lou' ? 1.25 : 1;
    const must = (q) => { const a = [Math.abs(q[0]), q[1], q[2]]; return Math.min(capsule(a, [0.0, 0.1075, -0.1075], [0.016, 0.106, -0.104], 0.0085 * thick), capsule(a, [0.016, 0.106, -0.104], [0.03, 0.095, -0.096], 0.0072 * thick)) - 0.0018 * noise3(q[0] * 250, q[1] * 120, q[2] * 250); };
    const mouthHole = (q) => -ellipsoid(q, [0, 0.094, -0.1], [0.026, 0.013, 0.03]);
    const beard = (q) => Math.max(hF(q) - 0.009 - 0.004 * noise3(q[0] * 90, q[1] * 90, q[2] * 90), q[1] - 0.135, q[2] - 0.025, mouthHole(q), -0.02 - q[1]);
    const goatee = (q) => Math.max(beard(q), Math.abs(q[0]) - 0.026, q[1] - 0.1);
    const face = (q) => {
      let d = brow(q);
      if (fac === 'mustache' || fac === 'goatee') d = Math.min(d, must(q));
      if (fac === 'beard') d = Math.min(d, beard(q), must(q));
      if (fac === 'goatee') d = Math.min(d, goatee(q));
      return d;
    };
    const fF = new Field(face, [-0.07, -0.03, -0.135], [0.07, 0.2, 0.03], 0.0025, 0.012);
    const fcol = fac === 'none' || fac === 'stubble' ? hair.color : S.facial.color;
    this.addMesh(toModel(surfaceNets(fF, (i, j, k) => fF.at(i, j, k))), hairMaterial(fcol, Math.min(1, (S.facial?.grey ?? hair.grey) * 0.9), [hp[0], hp[1] + 0.05, hp[2] - 0.1], 'facehair'), 'facehair', { rigid: H });
  }

  // ---- hands: palm, thenar pad, four three-segment fingers and a thumb, relaxed curl --------------------------------
  buildHands(skin) {
    const k = this.spec.build, hs = 0.95 + 0.1 * (k - 1) + (this.spec.sex === 'f' ? -0.06 : 0);
    for (const L of ['L', 'R']) {
      const s = L === 'L' ? -1 : 1, pn = [-s, 0, 0]; // palm faces the thigh
      const prims = [];
      prims.push((p) => roundBox(p, [0, -0.052 * hs, 0], [0.013 * hs, 0.046 * hs, 0.038 * hs], 0.012 * hs));
      prims.push((p) => ellipsoid(p, [-s * 0.008 * hs, -0.045 * hs, -0.026 * hs], [0.012 * hs, 0.026 * hs, 0.015 * hs]));
      prims.push((p) => capsule(p, [0, 0.03, 0], [0, -0.012, 0], 0.024 * hs));
      const fz = [-0.026, -0.009, 0.008, 0.024], fl = [0.074, 0.082, 0.077, 0.061], fr = [0.0095, 0.0098, 0.0093, 0.0082];
      const segs = [];
      for (let f = 0; f < 4; f++) {
        let pt = [0, -0.094 * hs, fz[f] * hs], ang = 0;
        const parts = [0.45, 0.3, 0.25], curl = [0.22 + f * 0.03, 0.38 + f * 0.04, 0.3];
        for (let j = 0; j < 3; j++) {
          ang += curl[j];
          const dir = [pn[0] * Math.sin(ang), -Math.cos(ang), 0];
          const nx = [pt[0] + dir[0] * fl[f] * parts[j] * hs, pt[1] + dir[1] * fl[f] * parts[j] * hs, pt[2]];
          segs.push([pt, nx, fr[f] * hs * (1 - j * 0.1), fr[f] * hs * (0.9 - j * 0.1)]);
          pt = nx;
        }
      }
      let tp = [-s * 0.009 * hs, -0.036 * hs, -0.03 * hs];
      let td = norm3([-s * 0.35, -0.55, -0.75]);
      for (const [l, r0, r1] of [[0.04, 0.0125, 0.011], [0.032, 0.011, 0.0098], [0.027, 0.0098, 0.0088]]) {
        const nx = [tp[0] + td[0] * l * hs, tp[1] + td[1] * l * hs, tp[2] + td[2] * l * hs];
        segs.push([tp, nx, r0 * hs, r1 * hs]);
        tp = nx; td = norm3(lerp3(td, [-s * 0.6, -0.8, -0.1], 0.35));
      }
      for (const [a, b, r0, r1] of segs) prims.push((p) => capsule(p, a, b, r0, r1));
      const f = (p) => { let d = prims[0](p); for (let i = 1; i < prims.length; i++) d = smin(d, prims[i](p), i < 3 ? 0.01 : 0.005); return d; };
      const fld = new Field(f, [-0.05, -0.2, -0.1], [0.05, 0.04, 0.055], 0.0026, 0.012);
      const r = surfaceNets(fld, (i, j, kk) => fld.at(i, j, kk));
      // Place at the wrist in bind space.
      const M = this.skeleton.boneInverses[this.idx['fore' + L]].clone().invert().multiply(new THREE.Matrix4().makeTranslation(0, -0.27, 0));
      const v = new THREE.Vector3();
      for (let i = 0; i < r.positions.length; i += 3) { v.set(r.positions[i], r.positions[i + 1], r.positions[i + 2]).applyMatrix4(M); r.positions[i] = v.x; r.positions[i + 1] = v.y; r.positions[i + 2] = v.z; }
      this.addMesh(r, skin, 'hand' + L, { rigid: this.idx['fore' + L] });
    }
  }

  // ---- footwear ---------------------------------------------------------------------------------------------------
  buildShoes() {
    const sh = this.spec.outfit.shoes, boot = sh.type === 'boots', top = boot ? 0.2 : sh.type === 'shoes' ? 0.09 : 0.105;
    for (const L of ['L', 'R']) {
      const a = this.J['an' + L];
      const x = a[0], z = a[2];
      const f = (p) => {
        let d = roundBox(p, [x, 0.018, z - 0.045], [0.048, 0.018, 0.135], 0.012);
        d = smin(d, ellipsoid(p, [x, 0.05, z - 0.12], [0.046, boot ? 0.044 : 0.036, 0.075]), 0.03);
        d = smin(d, capsule(p, [x, 0.045, z + 0.005], [x, top, z + 0.005], boot ? 0.058 : 0.05), 0.03);
        d = smin(d, ellipsoid(p, [x, 0.06, z + 0.05], [0.045, 0.055, 0.05]), 0.02);
        return Math.max(d, p[1] - top);
      };
      const fld = new Field(f, [x - 0.08, -0.005, z - 0.23], [x + 0.08, top + 0.02, z + 0.13], 0.004, 0.016);
      const mat = sh.type === 'sneakers' ? fabricMaterial('sneaker', sh.color, { toe: z - 0.03, footX: x }) : fabricMaterial('leather', sh.color, { toe: z - 0.03, footX: x, boot: true });
      this.addMesh(surfaceNets(fld, (i, j, k) => fld.at(i, j, k)), mat, 'shoe' + L, { only: ['shin' + L, 'foot' + L] });
    }
  }

  // Sidearm in the right hand (shown while aiming).
  buildGun() {
    const parts = [[0.03, 0.035, 0.18, 0, 0.0, -0.07], [0.028, 0.1, 0.035, 0, -0.045, 0.005], [0.012, 0.012, 0.05, 0, 0.012, -0.16]];
    const gs = parts.map(([w, h, d, x, y, z]) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; });
    const r = mergeIndexed(gs);
    const M = this.skeleton.boneInverses[this.idx.foreR].clone().invert().multiply(new THREE.Matrix4().makeTranslation(0.0, -0.33, -0.01));
    const v = new THREE.Vector3();
    for (let i = 0; i < r.positions.length; i += 3) { v.set(r.positions[i], r.positions[i + 1], r.positions[i + 2]).applyMatrix4(M); r.positions[i] = v.x; r.positions[i + 1] = v.y; r.positions[i + 2] = v.z; }
    this.gun = this.addMesh(r, gunMaterial(), 'gun', { rigid: this.idx.foreR });
    this.gun.visible = false;
  }

  // Drive the skeleton from the rig's per-part world matrices (RigType.compute or a ragdoll).
  setPose(world) { for (let i = 0; i < this.bones.length; i++) this.bones[i].matrixWorld.copy(world[i]); }
  setVisible(v) { this.group.visible = v; }
  dispose() { this.group.traverse((o) => { o.geometry?.dispose(); }); this.skeleton.dispose(); }
}

// Merge indexed geometries into raw positions/indices.
function mergeIndexed(list) {
  const pos = [], idx = [];
  for (const g of list) {
    const base = pos.length / 3, p = g.attributes.position;
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    const ix = g.index ? g.index.array : [...Array(p.count).keys()];
    for (const i of ix) idx.push(base + i);
  }
  return { positions: new Float32Array(pos), indices: idx };
}

export { greyed };
