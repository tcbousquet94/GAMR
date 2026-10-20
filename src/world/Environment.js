import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE } from '../core/config.js';
import { toon, basic } from '../core/materials.js';

// Maplewood High courtyard. North = -Z (school), south = +Z (fence + gate), east = +X (pond).
// Static geometry is merged per color into a handful of meshes; repeats are instanced.

const C = {
  ...PALETTE,
  doorTeal: 0x2e7d7a,
  frame: 0xfff8e8,
  metal: 0xb8c4cc,
  darkMetal: 0x5e6878,
  wood: 0xd09858,
  woodDark: 0x8a5a32,
  mushroom: 0xe8423c,
  spot: 0xfff6e0,
  gill: 0xe9c99a,
  pencil: 0xffc93c,
  eraser: 0xff8fa8,
  pencilWood: 0xf2cf9a,
  graphite: 0x3a3a48,
  stone: 0xd9d2c0,
  road: 0x8d8a92,
  sidewalk: 0xd8d4cc,
  yellow: 0xffd23f,
  vend: 0xe8423c,
  blue: 0x3b6fd8,
  sign: 0xfff8e8,
  cloud: 0xffffff,
  houseA: 0xf7c88a,
  houseB: 0xa8d8f0,
  houseC: 0xf0b0c8,
  ac: 0xc8ccd0,
  dark: 0x2a1a2e,
};

const OUTLINE_COLOR = 0x2a1a2e;

// ---------------------------------------------------------------- utilities
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

function hexCss(h) { return '#' + h.toString(16).padStart(6, '0'); }

function prepGeo(g) {
  // mergeGeometries needs identical attribute sets.
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(idx);
  }
  g.clearGroups();
  return g;
}

// Hip roof: bottom rectangle W x D at y=0, ridge along X at height H.
function hipRoof(W, D, H) {
  const hw = W / 2, hd = D / 2, rx = Math.max(0.01, hw - hd);
  const A = [-hw, 0, hd], B = [hw, 0, hd], Cc = [hw, 0, -hd], Dd = [-hw, 0, -hd];
  const R1 = [-rx, H, 0], R2 = [rx, H, 0];
  const tris = [A, B, R2, A, R2, R1, Cc, Dd, R1, Cc, R1, R2, B, Cc, R2, Dd, A, R1];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return prepGeo(g);
}

// Lumpy rounded rock (seam-safe noise from vertex position).
function rockGeo(seed) {
  const g = new THREE.SphereGeometry(1, 9, 7);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.13 * Math.sin(x * 2.3 + seed) * Math.cos(z * 2.9 + seed * 1.7) + 0.08 * Math.sin(y * 3.7 + seed * 0.3);
    p.setXYZ(i, x * n, Math.max(y * n, -0.35), z * n);
  }
  g.computeVertexNormals();
  return g;
}

// --------------------------------------------------------------- batching
class Batcher {
  constructor() {
    this.buckets = new Map(); // key -> geometries[]
    this.outlines = [];
    this.stack = [new THREE.Matrix4()];
  }
  push(m) { this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m)); }
  pop() { this.stack.pop(); }
  _put(key, g, m) {
    g.applyMatrix4(this.stack[this.stack.length - 1].clone().multiply(m));
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key).push(prepGeo(g));
  }
  _outline(g, m) {
    g.applyMatrix4(this.stack[this.stack.length - 1].clone().multiply(m));
    this.outlines.push(prepGeo(g));
  }
  geom(key, g, m = new THREE.Matrix4(), outlineGeo = null) {
    this._put(key, g, m);
    if (outlineGeo) this._outline(outlineGeo, m.clone());
  }
  box(key, w, h, d, x, y, z, o = {}) {
    const r = o.round ?? 0;
    const make = (W, H, D, R) => (R > 0 ? new RoundedBoxGeometry(W, H, D, 2, Math.min(R, W / 2, H / 2, D / 2)) : new THREE.BoxGeometry(W, H, D));
    const m = M(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0);
    this._put(key, make(w, h, d, r), m);
    if (o.outline) {
      const t = o.outline;
      this._outline(make(w + 2 * t, h + 2 * t, d + 2 * t, r ? r + t : 0), m.clone());
    }
  }
  cyl(key, rt, rb, h, x, y, z, o = {}) {
    const seg = o.seg ?? 12;
    const make = (a, b, H) => new THREE.CylinderGeometry(a, b, H, seg, 1, o.open ?? false, o.thetaStart ?? 0, o.theta ?? Math.PI * 2);
    const m = M(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, o.sx || 1, o.sy || 1, o.sz || 1);
    this._put(key, make(rt, rb, h), m);
    if (o.outline) {
      const t = o.outline;
      this._outline(make(rt > 0 ? rt + t : 0, rb + t, h + 2 * t), m.clone());
    }
  }
  sph(key, r, x, y, z, o = {}) {
    const sx = o.sx || 1, sy = o.sy || 1, sz = o.sz || 1;
    const make = () => new THREE.SphereGeometry(r, o.ws ?? 14, o.hs ?? 10, 0, Math.PI * 2, 0, o.thetaLen ?? Math.PI);
    this._put(key, make(), M(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, sx, sy, sz));
    if (o.outline) {
      const t = o.outline;
      this._outline(make(), M(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, (r * sx + t) / r, (r * sy + t) / r, (r * sz + t) / r));
    }
  }
  // Textured quad from the sign atlas, facing +Z in local space.
  sign(atlas, region, w, h, x, y, z, o = {}) {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    const [rx, ry, rw, rh] = atlas.regions[region];
    const S = atlas.size;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      uv.setXY(i, (rx + u * rw) / S, 1 - (ry + (1 - v) * rh) / S);
    }
    this._put('atlas', g, M(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0));
  }
  finish(scene, materials, outlineMat) {
    const meshes = [];
    for (const [key, list] of this.buckets) {
      const g = mergeGeometries(list, false);
      list.forEach((x) => x.dispose());
      if (!g) { console.warn('[Environment] merge failed for', key); continue; }
      g.computeBoundingSphere();
      const mat = materials[key] || toon(key);
      const mesh = new THREE.Mesh(g, mat);
      mesh.matrixAutoUpdate = false;
      if (key === 'shadow') mesh.renderOrder = 1;
      scene.add(mesh);
      meshes.push(mesh);
    }
    if (this.outlines.length) {
      const g = mergeGeometries(this.outlines, false);
      this.outlines.forEach((x) => x.dispose());
      const mesh = new THREE.Mesh(g, outlineMat);
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      meshes.push(mesh);
    }
    this.buckets.clear();
    this.outlines = [];
    return meshes;
  }
}

// --------------------------------------------------------------- textures
const GROUND_SIZE = 96; // world units covered by the painted ground texture
const GROUND_PX = 256;

function makeGroundTexture(pond, rand) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = GROUND_PX;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const k = GROUND_PX / GROUND_SIZE;
  ctx.setTransform(k, 0, 0, k, (GROUND_SIZE / 2) * k, (GROUND_SIZE / 2) * k); // world (x,z) -> px
  const fill = (c) => { ctx.fillStyle = hexCss(c); };

  fill(C.grass); ctx.fillRect(-GROUND_SIZE, -GROUND_SIZE, GROUND_SIZE * 2, GROUND_SIZE * 2);
  // blotchy patches
  for (let i = 0; i < 70; i++) {
    const x = (rand() - 0.5) * GROUND_SIZE, z = (rand() - 0.5) * GROUND_SIZE;
    const dark = rand() < 0.55;
    fill(dark ? C.grassDark : C.grassLight);
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.ellipse(x + (rand() - 0.5) * 3, z + (rand() - 0.5) * 2, 0.8 + rand() * 2.2, 0.5 + rand() * 1.3, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // speckle
  for (let i = 0; i < 900; i++) {
    fill(rand() < 0.5 ? C.grassDark : C.grassLight);
    ctx.fillRect((rand() - 0.5) * GROUND_SIZE, (rand() - 0.5) * GROUND_SIZE, 0.38, 0.38);
  }

  const sandEdge = 0xd9bf7a;
  const pathStroke = (pts, w) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [col, ww] of [[sandEdge, w + 0.9], [C.path, w]]) {
      ctx.strokeStyle = hexCss(col); ctx.lineWidth = ww;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
  };
  const blob = (x, z, rx, rz, edge = true) => {
    if (edge) { fill(sandEdge); ctx.beginPath(); ctx.ellipse(x, z, rx + 0.45, rz + 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
    fill(C.path); ctx.beginPath(); ctx.ellipse(x, z, rx, rz, 0, 0, Math.PI * 2); ctx.fill();
  };
  // sand ring around the pond (drawn first so paths meet it)
  for (const c of pond) blob(c.x, c.z, c.r + 1.7, c.r + 1.7);
  // main path gate -> school, school plaza, side paths
  pathStroke([[0, 40], [0, 27], [-1, 14], [0.5, 2], [-0.5, -10], [0, -24]], 3.6);
  pathStroke([[-22, -9], [-14, -9.5], [-6, -8], [-0.5, -8]], 2.6);
  pathStroke([[1, 4], [8, 6], [14, 5]], 2.4);
  pathStroke([[-1, 18], [-10, 17.5], [-18, 17]], 2.2);
  fill(sandEdge); ctx.fillRect(-15.5, -29, 31, 8.4);
  fill(C.path); ctx.fillRect(-15, -29, 30, 7.9);
  blob(7.5, -21.5, 3.0, 3.0);
  blob(-21, 17, 3, 3);
  blob(-23, -9, 4.2, 4.2);
  blob(-21.5, 4.5, 5.2, 4.2);
  blob(21, -26, 4.6, 2.2);
  // a few pebbles on paths
  for (let i = 0; i < 160; i++) {
    const x = (rand() - 0.5) * 70, z = (rand() - 0.5) * 70;
    const d = ctx.getImageData(Math.floor((x + GROUND_SIZE / 2) * k), Math.floor((z + GROUND_SIZE / 2) * k), 1, 1).data;
    if (d[0] > 225) { fill(sandEdge); ctx.fillRect(x, z, 0.38, 0.38); }
  }

  // Quantize to the palette for crisp 16-bit pixels.
  const pal = [C.grass, C.grassDark, C.grassLight, C.path, sandEdge].map((h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255]);
  const img = ctx.getImageData(0, 0, GROUND_PX, GROUND_PX);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let best = 0, bd = 1e9;
    for (let j = 0; j < pal.length; j++) {
      const dr = d[i] - pal[j][0], dg = d[i + 1] - pal[j][1], db = d[i + 2] - pal[j][2];
      const dd = dr * dr + dg * dg + db * db;
      if (dd < bd) { bd = dd; best = j; }
    }
    d[i] = pal[best][0]; d[i + 1] = pal[best][1]; d[i + 2] = pal[best][2]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

function makeWaterTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = hexCss(C.water); ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = hexCss(0x3f9ee0);
  for (let i = 0; i < 6; i++) ctx.fillRect((i * 23) % 64, (i * 37) % 64, 10, 2);
  ctx.fillStyle = hexCss(C.waterLight);
  const squig = (x, y) => { ctx.fillRect(x, y, 4, 2); ctx.fillRect(x + 4, y - 2, 4, 2); ctx.fillRect(x + 8, y, 4, 2); };
  squig(6, 10); squig(36, 24); squig(14, 42); squig(44, 54); squig(50, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(28, 34, 2, 2); ctx.fillRect(58, 40, 2, 2); ctx.fillRect(8, 58, 2, 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

function makeFenceTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 32, 32);
  ctx.strokeStyle = '#c8d0d8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(32, 32);
  ctx.moveTo(32, 0); ctx.lineTo(0, 32);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

function makeFlagTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 80;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = hexCss(C.roofTeal); ctx.fillRect(0, 0, 128, 80);
  ctx.fillStyle = hexCss(C.yellow); ctx.fillRect(0, 60, 128, 8);
  ctx.beginPath(); ctx.arc(64, 34, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hexCss(C.roofTeal);
  ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('M', 64, 36);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSignAtlas() {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const regions = {
    school: [0, 0, 1024, 160],
    norun: [0, 160, 512, 320],
    snacks: [512, 160, 512, 160],
    gym: [512, 320, 512, 160],
    clock: [0, 480, 256, 256],
    plaque: [256, 480, 256, 128],
    portable: [512, 480, 512, 128],
  };
  const font = (px, w = 'bold') => `${w} ${px}px "Trebuchet MS", "Verdana", "DejaVu Sans", sans-serif`;
  const text = (str, cx, cy, px, color, maxW, w = 'bold') => {
    ctx.font = font(px, w);
    let size = px;
    while (ctx.measureText(str).width > maxW && size > 8) { size -= 2; ctx.font = font(size, w); }
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, cx, cy);
  };
  const panel = ([x, y, w, h], bg, border, bw = 12) => {
    ctx.fillStyle = border; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = bg; ctx.fillRect(x + bw, y + bw, w - bw * 2, h - bw * 2);
  };

  panel(regions.school, '#23476b', '#fbe9c0', 10);
  text('MAPLEWOOD HIGH', 512, 84, 104, '#fbe9c0', 960);

  panel(regions.norun, '#ffffff', '#e8423c', 18);
  text('NO RUNNING', 256, 280, 82, '#e8423c', 440);
  text('(unless being chased)', 256, 370, 40, '#2a1a2e', 430, 'italic bold');

  panel(regions.snacks, '#ffd23f', '#e8423c', 12);
  text('SNACKS', 768, 225, 86, '#e8423c', 460);
  text('tots · pudding · ???', 768, 284, 30, '#2a1a2e', 440);

  panel(regions.gym, '#fff8e8', '#4aa3a0', 12);
  text('GYM', 768, 382, 86, '#4aa3a0', 460);
  text('Go Fighting Possums!', 768, 444, 30, '#2a1a2e', 440);

  // clock face
  ctx.fillStyle = '#fff8e8';
  ctx.beginPath(); ctx.arc(128, 608, 122, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 10; ctx.strokeStyle = '#2a1a2e'; ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillStyle = '#2a1a2e';
    ctx.beginPath(); ctx.arc(128 + Math.sin(a) * 100, 608 - Math.cos(a) * 100, i % 3 === 0 ? 9 : 5, 0, Math.PI * 2); ctx.fill();
  }

  panel(regions.plaque, '#e2bd62', '#8a5a32', 8);
  text('THE BIG PENCIL', 384, 515, 30, '#2a1a2e', 230);
  text("Class of '09 gift", 384, 550, 20, '#2a1a2e', 230, 'normal');
  text('please do not sharpen', 384, 580, 20, '#2a1a2e', 230, 'italic');

  panel(regions.portable, '#fff8e8', '#b4553f', 10);
  text('PORTABLE 7B', 768, 530, 58, '#b4553f', 470);
  text('temporary since 1987', 768, 580, 28, '#2a1a2e', 460, 'italic');

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, regions, size: S };
}

// ---------------------------------------------------------------- environment
export class Environment {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.t = 0;
    this.colliders = [];
    this.bounds = { minX: -31.5, maxX: 31.5, minZ: -26.8, maxZ: 31.2 };
    this.playerSpawn = new THREE.Vector3(0, 0, 24);
    this.partySpawns = [new THREE.Vector3(-2.2, 0, 25.6), new THREE.Vector3(2.2, 0, 25.6)];
    this.root = new THREE.Group();
    this.root.name = 'Environment';
    this.scene.add(this.root);

    this.rand = mulberry32(1337);
    this.pond = [
      { x: 21, z: 3.5, r: 5.0 },
      { x: 24.5, z: 9.2, r: 3.6 },
    ];
    this.atlas = makeSignAtlas();
    this.outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
    this.shadowMat = new THREE.MeshBasicMaterial({ color: 0x3a3a10, transparent: true, opacity: 0.26, depthWrite: false });
    this.materials = {
      atlas: new THREE.MeshBasicMaterial({ map: this.atlas.tex, alphaTest: 0.5 }),
      shadow: this.shadowMat,
      window: basic(C.window),
      winDark: basic(0x4a6e9a),
      dark: basic(0x3a2a3e),
      fence: new THREE.MeshBasicMaterial({ map: makeFenceTexture(), alphaTest: 0.5, side: THREE.DoubleSide }),
    };

    this.b = new Batcher();
    this.trees = [];
    this.bushes = [];

    this.buildGround();
    this.buildCliffs();
    this.buildSchool();
    this.buildGym();
    this.buildPortable();
    this.buildFence();
    this.buildBeyond();
    this.buildPond();
    this.buildProps();
    this.buildFlagpole();
    this.buildShack();
    this.buildPencil();
    this.placeTrees();
    this.b.finish(this.root, this.materials, this.outlineMat);

    this.buildTreesInstanced();
    this.buildBushesInstanced();
    this.buildFoliage();
    this.buildClouds();
    this.buildDuck();

    this.enemySpawns = this.pickEnemySpawns();
  }

  // ------------------------------------------------------------ ground
  buildGround() {
    const tex = makeGroundTexture(this.pond, this.rand);
    const g = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE).rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex }));
    ground.matrixAutoUpdate = false;
    this.root.add(ground);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), basic(C.grass));
    outer.position.y = -0.03;
    outer.updateMatrix();
    outer.matrixAutoUpdate = false;
    this.root.add(outer);
  }

  // ------------------------------------------------------------ cliffs
  // A wavy, striped EarthBound cliff tier. axis 'x': runs along Z at x = sign*front (east/west).
  // axis 'z': runs along X at z = sign*front (north/south). Faces toward the origin.
  cliffRun({ axis, sign, front, u0, u1, y0 = 0, h, depth = 30 }) {
    const b = this.b, rand = this.rand;
    const W = (u, v) => (axis === 'x' ? [sign * v, u] : [u, sign * v]);
    const step = 2.1;
    for (let u = u0; u <= u1; u += step) {
      const r = 1.35 + rand() * 0.45;
      const v = front + r + rand() * 0.35;
      const [x, z] = W(u + (rand() - 0.5) * 0.5, v);
      let y = y0;
      let i = 0;
      while (y < h - 0.05) {
        const thin = i % 2 === 1;
        const bh = Math.min(thin ? 0.16 : 0.62 + rand() * 0.25, h - y);
        const rr = thin ? r - 0.09 : r + (rand() - 0.5) * 0.1;
        b.cyl(thin ? C.cliffShade : C.cliff, rr, rr + (thin ? 0 : 0.04), bh, x, y + bh / 2, z, { seg: 10, open: true });
        y += bh; i++;
      }
      b.cyl(C.grass, r + 0.22, r + 0.22, 0.34, x, h + 0.1, z, { seg: 10 });
    }
    // filler mass + grass top
    const len = u1 - u0 + 2;
    const um = (u0 + u1) / 2;
    const vm = front + 1.2 + (depth - 1.2) / 2;
    const [fx, fz] = W(um, vm);
    const [sx, sz] = axis === 'x' ? [depth - 1.2, len] : [len, depth - 1.2];
    b.box(C.cliff, sx, h - y0, sz, fx, (h + y0) / 2, fz);
    b.box(C.grass, sx, 0.3, sz, fx, h + 0.12, fz);
  }

  buildCliffs() {
    const tiers = [
      { front: 32.6, h: 3.0, y0: 0 },
      { front: 38.5, h: 6.4, y0: 2.8 },
      { front: 45.5, h: 10.0, y0: 6.2 },
    ];
    for (const sign of [1, -1]) {
      for (const t of tiers) {
        this.cliffRun({ axis: 'x', sign, front: t.front, u0: -52, u1: 60, y0: t.y0, h: t.h, depth: 34 });
        const minX = sign > 0 ? t.front : -t.front - 34;
        const maxX = sign > 0 ? t.front + 34 : -t.front;
        this.colliders.push({ type: 'box', minX, maxX, minZ: -60, maxZ: 60, h: t.h });
      }
    }
    // north backdrop behind the school + a low southern horizon ridge
    this.cliffRun({ axis: 'z', sign: -1, front: 46, u0: -34, u1: 34, h: 7, depth: 20 });
    this.cliffRun({ axis: 'z', sign: -1, front: 53, u0: -34, u1: 34, y0: 6.8, h: 13, depth: 14 });
    this.cliffRun({ axis: 'z', sign: 1, front: 64, u0: -34, u1: 34, h: 5, depth: 16 });
  }

  // ------------------------------------------------------------ school
  windowAt(x, y, z, w = 1.5, h = 1.7) {
    const b = this.b;
    b.box(C.frame, w + 0.24, h + 0.24, 0.12, x, y, z);
    b.box('window', w, h, 0.16, x, y, z);
    b.box(C.frame, 0.1, h, 0.2, x, y, z);
    b.box(C.frame, w, 0.1, 0.2, x, y + 0.15, z);
    b.box(C.white, w * 0.3, 0.12, 0.2, x - w * 0.22, y + h * 0.3, z + 0.01); // glint
  }

  buildSchool() {
    const b = this.b;
    const z0 = -40, z1 = -28, x0 = -12.5, x1 = 12.5, H = 8;
    const W = x1 - x0, D = z1 - z0;
    // body
    b.box(C.wallCream, W, H, D, 0, H / 2, (z0 + z1) / 2, { outline: 0.08 });
    b.box(C.brick, W + 0.1, 1.1, D + 0.1, 0, 0.55, (z0 + z1) / 2);
    b.box(C.brick, W + 0.14, 0.32, D + 0.14, 0, 4.1, (z0 + z1) / 2);
    b.box(C.brick, W + 0.3, 0.45, D + 0.3, 0, H + 0.2, (z0 + z1) / 2);
    for (const px of [x0 + 0.3, x1 - 0.3]) b.box(C.brick, 0.8, H, 0.4, px, H / 2, z1 + 0.1);
    // roof
    b.geom(C.roofTeal, hipRoof(W + 1.4, D + 1.4, 3.6), M(0, H + 0.4, (z0 + z1) / 2), hipRoof(W + 1.6, D + 1.6, 3.75));
    // windows: two stories on the front face
    for (const wx of [-10.5, -8, -5.5, 5.5, 8, 10.5]) {
      for (const wy of [2.4, 6.0]) this.windowAt(wx, wy, z1 + 0.05);
    }
    // side windows
    for (const wz of [-37, -33]) {
      for (const wy of [2.4, 6.0]) {
        b.push(M(x1 + 0.05, 0, wz, 0, Math.PI / 2, 0)); this.windowAt(0, wy, 0); b.pop();
        b.push(M(x0 - 0.05, 0, wz, 0, -Math.PI / 2, 0)); this.windowAt(0, wy, 0); b.pop();
      }
    }
    // entrance pavilion
    const pz = -27.2, pH = 10.5;
    b.box(C.wallCream, 8, pH, 2.6, 0, pH / 2, pz - 0.4, { outline: 0.08 });
    b.box(C.brick, 8.2, 1.1, 2.8, 0, 0.55, pz - 0.4);
    for (const px of [-3.8, 3.8]) b.box(C.brick, 0.7, pH, 2.9, px, pH / 2, pz - 0.4);
    b.box(C.brick, 8.4, 0.5, 3.0, 0, pH + 0.1, pz - 0.4);
    b.cyl(C.roofTeal, 0, 4.4 * Math.SQRT1_2 * 1.42, 3.4, 0, pH + 2.0, pz - 0.4, { seg: 4, ry: Math.PI / 4, sz: 0.55, outline: 0.08 });
    b.sph(C.yellow, 0.3, 0, pH + 3.8, pz - 0.4);
    // doors
    const fz = pz + 0.92;
    b.box(C.frame, 3.6, 3.1, 0.2, 0, 1.55, fz);
    for (const dx of [-0.85, 0.85]) {
      b.box(C.doorTeal, 1.6, 2.8, 0.26, dx, 1.4, fz + 0.02);
      b.box('window', 0.8, 0.9, 0.3, dx, 2.0, fz + 0.02);
      b.box(C.yellow, 0.12, 0.5, 0.36, dx > 0 ? 0.25 : -0.25, 1.3, fz + 0.04);
    }
    b.box(C.stone, 5, 0.22, 1.2, 0, 0.11, fz + 0.65);
    b.box(C.stone, 4.2, 0.22, 0.6, 0, 0.33, fz + 0.4);
    // sign + clock
    b.box(C.frame, 7.2, 1.2, 0.1, 0, 4.6, fz - 0.02);
    b.sign(this.atlas, 'school', 7.0, 1.1, 0, 4.6, fz + 0.04);
    b.cyl(C.brick, 1.3, 1.3, 0.25, 0, 8.0, fz, { rx: Math.PI / 2, seg: 20, outline: 0.05 });
    b.sign(this.atlas, 'clock', 2.2, 2.2, 0, 8.0, fz + 0.14);
    for (const wx of [-2.2, 2.2]) this.windowAt(wx, 6.2, fz - 0.02, 1.1, 1.5);
    // clock hands (animated)
    this.clockHands = [];
    const handMat = basic(C.dark);
    for (const [len, w] of [[0.62, 0.12], [0.9, 0.08]]) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.04).translate(0, len / 2 - 0.08, 0), handMat);
      hand.position.set(0, 8.0, fz + 0.18);
      this.root.add(hand);
      this.clockHands.push(hand);
    }
    // shadow strip along the facade
    b.box('shadow', W + 1, 0.01, 1.4, 0, 0.03, z1 + 0.6);

    this.colliders.push({ type: 'box', minX: x0, maxX: x1, minZ: z0, maxZ: z1, h: H + 3.5 });
    this.colliders.push({ type: 'box', minX: -4.1, maxX: 4.1, minZ: z1, maxZ: fz + 0.2, h: pH + 3 });

    // vending machine against the facade (east of the doors)
    b.push(M(6.4, 0, -27.5));
    b.box(C.vend, 1.3, 2.4, 0.9, 0, 1.2, 0, { round: 0.12, outline: 0.05 });
    b.box('winDark', 0.8, 1.5, 0.1, -0.15, 1.45, 0.43);
    const cans = [C.yellow, C.blue, C.white, C.wallMint, C.eraser];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) b.box(cans[(r * 3 + c) % 5], 0.16, 0.3, 0.08, -0.4 + c * 0.25, 1.9 - r * 0.45, 0.5);
    b.box(C.frame, 0.25, 0.5, 0.1, 0.45, 1.5, 0.45);
    b.box(C.dark, 0.9, 0.22, 0.1, 0, 0.35, 0.45);
    b.sph(C.white, 0.18, 0, 2.45, 0.2, { sy: 0.4 }); // forgotten pudding cup on top
    b.pop();
    this.colliders.push({ type: 'box', minX: 5.7, maxX: 7.1, minZ: -28, maxZ: -27.0, h: 2.4 });
  }

  buildGym() {
    const b = this.b;
    const x0 = 15.5, x1 = 29.5, z0 = -42, z1 = -28, H = 5;
    const W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    b.box(C.wallMint, W, H, D, cx, H / 2, cz, { outline: 0.08 });
    b.box(C.wallCream, W + 0.1, 0.9, D + 0.1, cx, 0.45, cz);
    // barrel roof
    const mk = (r, len) => new THREE.CylinderGeometry(r, r, len, 22, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
    b.geom(C.roofTeal, mk(W / 2 + 0.5, D + 0.8), M(cx, H, cz, 0, 0, 0, 1, 0.5, 1), mk(W / 2 + 0.62, D + 1.0));
    b.box(C.wallCream, W + 1.2, 0.35, D + 1.2, cx, H + 0.05, cz);
    // big doors
    b.box(C.frame, 4.2, 3.4, 0.2, cx, 1.7, z1 + 0.05);
    for (const dx of [-1, 1]) {
      b.box(C.roof, 1.9, 3.1, 0.26, cx + dx, 1.55, z1 + 0.08);
      b.box(C.yellow, 1.6, 0.14, 0.32, cx + dx, 1.4, z1 + 0.1);
    }
    // high window strip
    for (let i = 0; i < 4; i++) {
      const wx = x0 + 1.6 + i * 3.6;
      if (Math.abs(wx - cx) < 2.4) continue;
      this.windowAt(wx, 3.6, z1 + 0.05, 1.8, 0.9);
    }
    b.box(C.frame, 4.6, 1.5, 0.1, cx, 4.3, z1 + 0.06);
    b.sign(this.atlas, 'gym', 4.4, 1.38, cx, 4.3, z1 + 0.12);
    b.box('shadow', W + 1, 0.01, 1.3, cx, 0.03, z1 + 0.6);
    this.colliders.push({ type: 'box', minX: x0, maxX: x1, minZ: z0, maxZ: z1, h: H + 3.5 });

    // bike rack + one lonely bike
    b.push(M(20.5, 0, -25.5));
    b.box(C.darkMetal, 4.6, 0.1, 0.1, 0, 0.05, 0);
    for (let i = 0; i < 5; i++) {
      b.geom(C.metal, new THREE.TorusGeometry(0.42, 0.05, 6, 12, Math.PI), M(-2 + i, 0.05, 0));
    }
    b.push(M(-1.0, 0, 0.35, 0, 0.12, 0));
    for (const wx of [-0.55, 0.55]) b.geom(C.dark, new THREE.TorusGeometry(0.34, 0.06, 6, 14), M(wx, 0.36, 0));
    b.cyl(C.mushroom, 0.05, 0.05, 1.15, 0, 0.6, 0, { rz: Math.PI / 2, seg: 6 });
    b.cyl(C.mushroom, 0.05, 0.05, 0.7, 0.15, 0.55, 0, { rz: 0.5, seg: 6 });
    b.box(C.dark, 0.3, 0.08, 0.14, -0.25, 0.92, 0);
    b.cyl(C.metal, 0.03, 0.03, 0.5, 0.5, 0.9, 0, { rx: Math.PI / 2, seg: 6 });
    b.pop();
    b.pop();
    this.colliders.push({ type: 'box', minX: 18.0, maxX: 23.0, minZ: -26.0, maxZ: -24.9, h: 1 });
  }

  buildPortable() {
    const b = this.b;
    const cx = -23, cz = -31.5;
    b.push(M(cx, 0, cz));
    for (const x of [-4, -1.3, 1.3, 4]) for (const z of [-2, 2]) b.box(C.stone, 0.6, 0.6, 0.6, x, 0.3, z);
    b.box(C.wallPink, 10, 3, 6, 0, 2.1, 0, { outline: 0.07 });
    b.box(C.roof, 10.6, 0.35, 6.6, 0, 3.75, 0, { outline: 0.05 });
    for (const x of [-4.95, 4.95]) b.box(C.frame, 0.12, 3, 6.1, x, 2.1, 0);
    // door, steps and rail
    b.box(C.frame, 1.3, 2.3, 0.1, 2.5, 1.85, 3.02);
    b.box(C.doorTeal, 1.1, 2.1, 0.16, 2.5, 1.75, 3.04);
    b.sph(C.yellow, 0.07, 2.85, 1.7, 3.15);
    b.box(C.stone, 1.6, 0.25, 0.6, 2.5, 0.42, 3.4);
    b.box(C.stone, 1.6, 0.25, 0.6, 2.5, 0.15, 3.9);
    b.cyl(C.metal, 0.04, 0.04, 1.1, 1.6, 1.0, 3.6, { seg: 6 });
    b.cyl(C.metal, 0.04, 0.04, 1.1, 3.4, 1.0, 3.6, { seg: 6 });
    for (const x of [-3.2, -0.6]) this.windowAt(x, 2.2, 3.03, 1.6, 1.2);
    b.box(C.frame, 3.8, 0.9, 0.08, -1.9, 3.95, 3.15);
    b.sign(this.atlas, 'portable', 3.6, 0.9, -1.9, 3.95, 3.2);
    // wheezing AC unit
    b.box(C.ac, 1.1, 0.9, 0.7, -5.4, 2.3, 0.5, { round: 0.08, outline: 0.04 });
    b.cyl(C.darkMetal, 0.32, 0.32, 0.06, -5.95, 2.3, 0.5, { rz: Math.PI / 2, seg: 12 });
    b.box('shadow', 10.6, 0.01, 6.6, 0, 0.03, 0.2);
    b.pop();
    this.colliders.push({ type: 'box', minX: cx - 6, maxX: cx + 5, minZ: cz - 3, maxZ: cz + 4.2, h: 4.5 });
    // hedge fillers between buildings are added as bushes later
  }

  // ------------------------------------------------------------ fence + beyond
  buildFence() {
    const b = this.b;
    const fz = 32.6, H = 2.1;
    const segs = [[-33, -4.2], [4.2, 33]];
    for (const [a, c] of segs) {
      const len = c - a;
      const g = new THREE.PlaneGeometry(len, H - 0.1);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.5, uv.getY(i) * (H - 0.1) / 0.5);
      b.geom('fence', g, M((a + c) / 2, (H - 0.1) / 2 + 0.05, fz));
      b.cyl(C.metal, 0.06, 0.06, len, (a + c) / 2, H, fz, { rz: Math.PI / 2, seg: 6 });
      b.cyl(C.metal, 0.04, 0.04, len, (a + c) / 2, 0.1, fz, { rz: Math.PI / 2, seg: 5 });
      for (let x = a; x <= c + 0.01; x += 3.2) b.cyl(C.darkMetal, 0.08, 0.08, H + 0.15, x, (H + 0.15) / 2, fz, { seg: 6 });
      this.colliders.push({ type: 'box', minX: a, maxX: c, minZ: fz - 0.15, maxZ: fz + 0.15, h: 0.9 });
    }
    // gate pillars with ball caps
    for (const x of [-4.8, 4.8]) {
      b.box(C.brick, 1.1, 2.8, 1.1, x, 1.4, fz, { round: 0.1, outline: 0.05 });
      b.box(C.wallCream, 1.3, 0.25, 1.3, x, 2.9, fz);
      b.sph(C.yellow, 0.42, x, 3.4, fz, { outline: 0.04 });
      this.colliders.push({ type: 'circle', x, z: fz, r: 0.75 });
    }
    // one gate leaf hanging open
    b.push(M(4.2, 0, fz, 0, -1.2, 0));
    const g = new THREE.PlaneGeometry(3.6, 1.8);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3.6 / 0.5, uv.getY(i) * 1.8 / 0.5);
    b.geom('fence', g, M(-1.8, 1.0, 0));
    b.cyl(C.metal, 0.05, 0.05, 3.6, -1.8, 1.9, 0, { rz: Math.PI / 2, seg: 6 });
    b.cyl(C.metal, 0.05, 0.05, 3.6, -1.8, 0.1, 0, { rz: Math.PI / 2, seg: 6 });
    b.cyl(C.metal, 0.05, 0.05, 1.8, -3.55, 1.0, 0, { seg: 6 });
    b.pop();
  }

  buildBeyond() {
    const b = this.b;
    b.box(C.sidewalk, 120, 0.06, 2.4, 0, 0.03, 35);
    b.box(C.road, 120, 0.05, 7, 0, 0.025, 39.8);
    for (let x = -56; x < 60; x += 5) b.box(C.yellow, 2.2, 0.02, 0.25, x, 0.06, 39.8);
    b.box(C.sidewalk, 120, 0.06, 2.0, 0, 0.03, 44.3);
    const houses = [
      [-24, 52, C.houseA, C.roof], [-10, 54, C.houseB, C.roofTeal], [9, 52, C.houseC, C.roof], [25, 54, C.houseA, C.roofTeal],
    ];
    for (const [x, z, wall, roof] of houses) {
      b.box(wall, 7, 4, 6, x, 2, z, { outline: 0.08 });
      b.geom(roof, hipRoof(8, 7, 2.8), M(x, 4, z));
      b.box(C.doorTeal, 1.1, 2, 0.1, x, 1, z - 3.02);
      this.windowAt(x - 2.2, 2.2, z - 3.02, 1.2, 1.1);
      this.windowAt(x + 2.2, 2.2, z - 3.02, 1.2, 1.1);
    }
  }

  // ------------------------------------------------------------ pond
  buildPond() {
    const b = this.b, rand = this.rand;
    // water: union of circles, UVs from world coords so overlaps match
    const tex = makeWaterTexture();
    this.waterTex = tex;
    const parts = this.pond.map((c, i) => {
      const g = new THREE.CircleGeometry(c.r, 28).rotateX(-Math.PI / 2).translate(c.x, 0.06 + i * 0.001, c.z);
      const p = g.attributes.position, uv = g.attributes.uv;
      for (let j = 0; j < p.count; j++) uv.setXY(j, p.getX(j) / 4, p.getZ(j) / 4);
      return g;
    });
    const water = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ map: tex }));
    this.root.add(water);
    // darker rim just under the water edge
    for (const c of this.pond) b.geom('winDark', new THREE.CircleGeometry(c.r + 0.35, 28).rotateX(-Math.PI / 2), M(c.x, 0.045, c.z));

    // chunky cream rocks around the edge
    const inside = (x, z, skip) => this.pond.some((c, i) => i !== skip && Math.hypot(x - c.x, z - c.z) < c.r + 0.2);
    let seed = 1;
    this.pond.forEach((c, ci) => {
      const n = Math.round(c.r * 2.6);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand() * 0.3;
        const rr = c.r + 0.15 + rand() * 0.3;
        const x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr;
        if (inside(x, z, ci)) continue;
        const s = 0.55 + rand() * 0.55;
        const g = rockGeo(seed++);
        const m = M(x, 0.05, z, 0, rand() * 6, 0, s * (1 + rand() * 0.4), s * 0.75, s);
        const og = rockGeo(seed - 1);
        const t = 0.06 / s;
        b.geom(C.rock, g, m, og.scale(1 + t, 1 + t, 1 + t));
      }
    });
    // little island with a mailbox. Who delivers here? Nobody knows.
    const ix = 20.2, iz = 3.0;
    b.geom(C.rock, rockGeo(99), M(ix, 0, iz, 0, 0.4, 0, 1.3, 0.55, 1.1), rockGeo(99).scale(1.05, 1.08, 1.05));
    b.cyl(C.woodDark, 0.08, 0.08, 1.3, ix, 1.0, iz, { seg: 6 });
    b.box(C.blue, 0.5, 0.42, 0.8, ix, 1.85, iz, { round: 0.08, outline: 0.04 });
    b.cyl(C.blue, 0.25, 0.25, 0.8, ix, 2.06, iz, { rx: Math.PI / 2, seg: 12, theta: Math.PI, thetaStart: -Math.PI / 2 });
    b.box(C.mushroom, 0.05, 0.42, 0.1, ix + 0.3, 2.15, iz + 0.15);
    b.box(C.mushroom, 0.05, 0.12, 0.22, ix + 0.3, 2.32, iz + 0.25);
    // lily pads
    for (const [x, z] of [[18, 6], [23.5, 1.2], [25.5, 10.5], [22.5, 7.5]]) {
      b.cyl(C.treeLeafLight, 0.55, 0.55, 0.05, x, 0.08, z, { seg: 12, theta: Math.PI * 1.75, ry: rand() * 6 });
    }
    b.sph(C.eraser, 0.16, 18, 0.2, 6, { sy: 0.7 });

    // colliders: water + rock ring
    for (const c of this.pond) this.colliders.push({ type: 'circle', x: c.x, z: c.z, r: c.r + 0.9 });
  }

  // ------------------------------------------------------------ props
  bench(x, z, ry) {
    const b = this.b;
    b.push(M(x, 0, z, 0, ry, 0));
    for (const dx of [-0.9, 0.9]) {
      b.box(C.darkMetal, 0.12, 0.5, 0.6, dx, 0.25, 0);
      b.box(C.darkMetal, 0.12, 0.7, 0.08, dx, 0.75, -0.28);
    }
    b.box(C.wood, 2.4, 0.12, 0.62, 0, 0.55, 0, { round: 0.04, outline: 0.03 });
    b.box(C.wood, 2.4, 0.38, 0.1, 0, 0.98, -0.3, { round: 0.04, outline: 0.03 });
    b.box('shadow', 2.6, 0.01, 0.9, 0, 0.03, 0);
    b.pop();
    // rotated collider footprint approximated as a circle pair
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const d of [-0.7, 0.7]) this.colliders.push({ type: 'circle', x: x + c * d, z: z - s * d, r: 0.45 });
  }

  lunchTable(x, z, ry = 0) {
    const b = this.b;
    b.push(M(x, 0, z, 0, ry, 0));
    b.box(C.wallMint, 2.6, 0.14, 1.2, 0, 0.82, 0, { round: 0.05, outline: 0.03 });
    for (const dz of [-0.95, 0.95]) b.box(C.wallMint, 2.6, 0.12, 0.42, 0, 0.48, dz, { round: 0.05, outline: 0.03 });
    for (const dx of [-1, 1]) {
      b.box(C.darkMetal, 0.1, 0.8, 0.1, dx, 0.4, 0);
      b.box(C.darkMetal, 0.1, 0.1, 2.2, dx, 0.3, 0);
      for (const dz of [-0.95, 0.95]) b.box(C.darkMetal, 0.08, 0.45, 0.08, dx, 0.22, dz);
    }
    b.box('shadow', 2.9, 0.01, 2.4, 0, 0.03, 0);
    b.pop();
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    const hx = 1.4 * c + 1.2 * s, hz = 1.4 * s + 1.2 * c;
    this.colliders.push({ type: 'box', minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, h: 0.9 });
  }

  buildProps() {
    const b = this.b;
    this.bench(-4.6, 21.5, Math.PI / 2);
    this.bench(4.6, 21.0, -Math.PI / 2);
    this.bench(-9, -23.2, 0);
    this.bench(10.5, -23.2, 0);
    this.bench(14.5, 3.5, Math.PI / 2 + 0.2);

    // lunch area + stray lunch tray
    this.lunchTable(-21, 3);
    this.lunchTable(-26, 6.5, 0.3);
    this.lunchTable(-20.5, 8.5, -0.15);
    b.box(C.metal, 0.6, 0.04, 0.45, -21.3, 0.92, 3.1);
    b.sph(C.yellow, 0.14, -21.4, 0.97, 3.1, { sy: 0.5 });
    b.sph(C.mushroom, 0.1, -21.1, 0.98, 3.0);

    // NO RUNNING sign facing the spawn
    b.push(M(-5.6, 0, 17.5, 0, 0.25, 0));
    for (const dx of [-1.0, 1.0]) b.cyl(C.woodDark, 0.08, 0.08, 2.8, dx, 1.4, -0.05, { seg: 6 });
    b.box(C.frame, 2.5, 1.62, 0.1, 0, 2.05, 0, { outline: 0.03 });
    b.sign(this.atlas, 'norun', 2.4, 1.5, 0, 2.05, 0.06);
    b.pop();
    this.colliders.push({ type: 'circle', x: -5.6 - 0.97, z: 17.5 + 0.25, r: 0.25 });
    this.colliders.push({ type: 'circle', x: -5.6 + 0.97, z: 17.5 - 0.25, r: 0.25 });

    // trash can + traffic cone (cozy clutter)
    b.cyl(C.wallMint, 0.4, 0.34, 1.0, 3.5, 0.5, -24.5, { seg: 12, outline: 0.03 });
    b.cyl(C.darkMetal, 0.43, 0.43, 0.12, 3.5, 1.02, -24.5, { seg: 12 });
    this.colliders.push({ type: 'circle', x: 3.5, z: -24.5, r: 0.45 });
    b.cyl(0xff8a3c, 0, 0.3, 0.8, 27, 0.45, 20, { seg: 10, outline: 0.03 });
    b.box(0xff8a3c, 0.7, 0.08, 0.7, 27, 0.04, 20);
    b.cyl(C.white, 0.16, 0.22, 0.14, 27, 0.5, 20, { seg: 10 });
  }

  buildFlagpole() {
    const b = this.b;
    const x = 7.5, z = -21.5;
    b.cyl(C.brick, 1.3, 1.4, 0.5, x, 0.25, z, { seg: 16, outline: 0.04 });
    b.cyl(C.grassDark, 1.1, 1.1, 0.1, x, 0.52, z, { seg: 16 });
    b.cyl(C.white, 0.08, 0.11, 9, x, 4.5, z, { seg: 8 });
    b.sph(C.yellow, 0.2, x, 9.1, z);
    this.colliders.push({ type: 'circle', x, z, r: 1.4 });
    // flag (animated vertices)
    const g = new THREE.PlaneGeometry(2.4, 1.5, 12, 4).translate(1.2, 0, 0);
    this.flagBase = Float32Array.from(g.attributes.position.array);
    this.flag = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: makeFlagTexture(), side: THREE.DoubleSide }));
    this.flag.position.set(x + 0.08, 8.15, z);
    this.root.add(this.flag);
  }

  buildShack() {
    // Mushroom-roofed snack hut, facing the courtyard (+X).
    const b = this.b;
    const x = -23.5, z = -9;
    b.push(M(x, 0, z, 0, Math.PI / 2, 0));
    b.cyl(C.wallCream, 2.0, 2.2, 2.8, 0, 1.4, 0, { seg: 18, outline: 0.06 });
    // serving window with counter
    b.box('dark', 1.8, 1.0, 0.4, 0, 1.6, 1.95);
    b.box(C.wood, 2.2, 0.14, 0.6, 0, 1.05, 2.15, { outline: 0.03 });
    b.box(C.frame, 2.1, 0.12, 0.3, 0, 2.15, 2.0);
    // door at the side
    b.box(C.woodDark, 0.9, 1.7, 0.3, 1.55, 0.85, 1.3, { ry: 0.9 });
    // the cap
    b.sph(C.mushroom, 3.2, 0, 2.6, 0, { thetaLen: Math.PI / 2, sy: 0.72, ws: 22, hs: 10, outline: 0.07 });
    b.cyl(C.gill, 3.2, 3.2, 0.12, 0, 2.6, 0, { seg: 22 });
    const spots = [[0, 1.0, 0.5], [0.9, 0.55, 0.42], [-1.0, 0.6, 0.4], [0.3, 0.35, 0.36], [2.4, 0.4, 0.3], [-2.2, 0.75, 0.32]];
    for (const [a, el, r] of spots) {
      const phi = Math.PI / 2 - el; // from top
      const dx = Math.sin(phi) * Math.sin(a) * 3.2, dz = Math.sin(phi) * Math.cos(a) * 3.2, dy = Math.cos(phi) * 3.2 * 0.72;
      b.sph(C.spot, r, dx, 2.6 + dy, dz, { sy: 0.45, rx: Math.atan2(dz, dy) * 0.8, rz: -Math.atan2(dx, dy) * 0.8 });
    }
    b.cyl(C.spot, 0.22, 0.22, 0.8, -1.1, 4.6, -0.6, { seg: 8 }); // tiny mushroom chimney
    b.sph(C.mushroom, 0.4, -1.1, 5.0, -0.6, { thetaLen: Math.PI / 2, sy: 0.7 });
    b.box(C.frame, 3.0, 0.98, 0.1, 0, 3.55, 2.62, { rx: -0.35 });
    b.sign(this.atlas, 'snacks', 2.9, 0.9, 0, 3.57, 2.68, { rx: -0.35 });
    b.box('shadow', 0.01, 0.01, 0.01, 0, 0, 0);
    b.pop();
    this.shadowSpots = this.shadowSpots || [];
    this.shadowSpots.push([x, z, 3.0]);
    this.colliders.push({ type: 'circle', x, z, r: 2.3 });
  }

  buildPencil() {
    // The Big Pencil: a statue standing on its eraser, tip to the sky.
    const b = this.b;
    const x = -21, z = 17;
    b.box(C.stone, 2.4, 0.9, 2.4, x, 0.45, z, { round: 0.12, outline: 0.05 });
    b.box(C.stone, 1.8, 0.3, 1.8, x, 1.05, z, { round: 0.08 });
    b.cyl(C.eraser, 0.6, 0.6, 0.7, x, 1.55, z, { seg: 6, outline: 0.05 });
    b.cyl(C.metal, 0.64, 0.64, 0.55, x, 2.15, z, { seg: 12, outline: 0.04 });
    b.cyl(C.darkMetal, 0.67, 0.67, 0.08, x, 2.0, z, { seg: 12 });
    b.cyl(C.darkMetal, 0.67, 0.67, 0.08, x, 2.3, z, { seg: 12 });
    b.cyl(C.pencil, 0.6, 0.6, 5.0, x, 4.92, z, { seg: 6, outline: 0.05 });
    b.cyl(C.pencilWood, 0.1, 0.6, 1.3, x, 8.07, z, { seg: 6, outline: 0.04 });
    b.cyl(C.graphite, 0, 0.13, 0.35, x, 8.82, z, { seg: 6 });
    b.sign(this.atlas, 'plaque', 1.6, 0.8, x, 0.5, z + 1.23);
    this.colliders.push({ type: 'circle', x, z, r: 1.6 });
  }

  // ------------------------------------------------------------ trees / bushes / foliage
  placeTrees() {
    const T = (x, z, s = 1, y = 0, light = false) => this.trees.push({ x, y, z, s, light, phase: x * 0.37 + z * 0.61 });
    // west edge
    for (const [z, s] of [[-24, 1.1], [-16, 0.95], [-2, 1.05], [12, 0.9], [23, 1.1], [29, 0.95]]) T(-29.6, z, s);
    // east edge
    for (const [z, s] of [[-23, 1.0], [-15, 1.1], [-7, 0.9], [17, 1.0], [24, 1.15], [29.5, 0.9]]) T(29.7, z, s);
    // between buildings & behind
    T(-14.8, -30.5, 1.0); T(13.8, -30.8, 0.85, 0, true); T(-30.5, -31, 1.2); T(31.5, -31, 1.1);
    T(-8, -43, 1.2); T(4, -43.5, 1.3, 0, true); T(-20, -38.5, 1.1); T(33, -40, 1.3);
    // south corners inside fence
    T(-25, 29.5, 1.0, 0, true); T(-15, 30, 0.85); T(14, 30, 0.9, 0, true); T(23, 29.8, 1.05);
    // near pond & pencil & shack
    T(16.2, 12.5, 0.9, 0, true); T(28.5, 3, 0.8); T(-26.5, 13, 0.85, 0, true); T(-27.5, -4, 0.8);
    // on the cliff plateaus
    for (const sign of [1, -1]) {
      for (const z of [-28, -12, 4, 20, 34]) T(sign * (35.4 + ((z * 7) % 3) * 0.3), z + sign * 2, 0.9 + ((z + 40) % 3) * 0.1, 3.0, z % 2 === 0);
      for (const z of [-34, -6, 14, 40]) T(sign * 42, z, 1.15, 6.4, z % 3 === 0);
    }
    // beyond the fence
    for (const [x, z] of [[-34, 48], [-17, 49], [0, 50], [17, 50], [33, 49], [-30, 57], [4, 59], [28, 58]]) T(x, z, 1.1, 0, x % 2 === 0);
    // northern ridge top
    for (const x of [-26, -12, 2, 15, 28]) T(x, -50, 1.2, 7, x % 4 === 0);

    const B = this.bounds;
    for (const t of this.trees) {
      if (t.y === 0 && t.x > B.minX - 2 && t.x < B.maxX + 2 && t.z > B.minZ - 2 && t.z < B.maxZ + 2) {
        this.colliders.push({ type: 'circle', x: t.x, z: t.z, r: 0.75 * t.s });
      }
    }
  }

  buildTreesInstanced() {
    const n = this.trees.length;
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.4, 2.4, 8).translate(0, 1.2, 0);
    const crownParts = [
      new THREE.SphereGeometry(1.65, 14, 10).translate(0, 3.2, 0),
      new THREE.SphereGeometry(1.2, 12, 9).translate(1.05, 2.75, 0.35),
      new THREE.SphereGeometry(1.15, 12, 9).translate(-0.95, 2.85, -0.35),
      new THREE.SphereGeometry(1.0, 12, 9).translate(0.15, 2.65, 1.0),
    ];
    const crownGeo = mergeGeometries(crownParts);
    const capGeo = new THREE.SphereGeometry(1.05, 12, 9).translate(0.1, 4.45, 0.15);
    const hullGeo = mergeGeometries([
      ...[[1.65, 0, 3.2, 0], [1.2, 1.05, 2.75, 0.35], [1.15, -0.95, 2.85, -0.35], [1.0, 0.15, 2.65, 1.0], [1.05, 0.1, 4.45, 0.15]]
        .map(([r, x, y, z]) => new THREE.SphereGeometry(r + 0.08, 12, 9).translate(x, y, z)),
    ]);
    const leafMat = toon(0xffffff);
    this.treeTrunks = new THREE.InstancedMesh(trunkGeo, toon(C.trunk), n);
    this.treeCrowns = new THREE.InstancedMesh(crownGeo, leafMat, n);
    this.treeCaps = new THREE.InstancedMesh(capGeo, leafMat, n);
    this.treeHulls = new THREE.InstancedMesh(hullGeo, this.outlineMat, n);
    const col = new THREE.Color();
    const m = new THREE.Matrix4();
    this.trees.forEach((t, i) => {
      m.compose(_p.set(t.x, t.y, t.z), _q.identity(), _s.setScalar(t.s));
      this.treeTrunks.setMatrixAt(i, m);
      this.treeCrowns.setColorAt(i, col.setHex(t.light ? 0x52ad40 : C.treeLeaf));
      this.treeCaps.setColorAt(i, col.setHex(t.light ? 0x86d35e : C.treeLeafLight));
    });
    for (const im of [this.treeTrunks, this.treeCrowns, this.treeCaps, this.treeHulls]) {
      im.frustumCulled = false;
      this.root.add(im);
    }
    this.swayTrees(0);
    this.treeTrunks.instanceMatrix.needsUpdate = true;
    this.treeTrunks.computeBoundingSphere();

    // baked blob shadows under trees (one merged mesh)
    const sh = [];
    for (const t of this.trees) sh.push(new THREE.CircleGeometry(2.0 * t.s, 16).rotateX(-Math.PI / 2).translate(t.x, t.y + 0.035, t.z));
    for (const [x, z, r] of this.shadowSpots || []) sh.push(new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2).translate(x, 0.035, z));
    sh.push(new THREE.CircleGeometry(1.7, 16).rotateX(-Math.PI / 2).translate(-21, 0.035, 17));
    const shadows = new THREE.Mesh(mergeGeometries(sh), this.shadowMat);
    shadows.renderOrder = 1;
    this.root.add(shadows);
  }

  swayTrees(t) {
    const m = this.__m || (this.__m = new THREE.Matrix4());
    for (let i = 0; i < this.trees.length; i++) {
      const tr = this.trees[i];
      const a = Math.sin(t * 1.4 + tr.phase) * 0.035;
      _e.set(a * 0.5, 0, a, 'XYZ');
      _q.setFromEuler(_e);
      m.compose(_p.set(tr.x, tr.y, tr.z), _q, _s.setScalar(tr.s));
      this.treeCrowns.setMatrixAt(i, m);
      this.treeCaps.setMatrixAt(i, m);
      this.treeHulls.setMatrixAt(i, m);
    }
    this.treeCrowns.instanceMatrix.needsUpdate = true;
    this.treeCaps.instanceMatrix.needsUpdate = true;
    this.treeHulls.instanceMatrix.needsUpdate = true;
  }

  buildBushesInstanced() {
    const list = [];
    const add = (x, z, s = 1, c = C.treeLeafLight) => list.push({ x, z, s, c });
    for (const x of [-11, -9, -7, -5]) add(x, -27.6, 0.8);
    for (const x of [9, 11]) add(x, -27.6, 0.8);
    for (const x of [-17, -15.5, -14]) add(x, -27.9, 0.9, 0x5aaa44);
    for (const x of [13, 14.6]) add(x, -27.8, 0.8, 0x5aaa44);
    for (const [x, z] of [[-30.5, 6], [-30.5, 18], [30.6, 10], [30.8, -10], [30.5, -1]]) add(x, z, 1.0, 0x5aaa44);
    for (const x of [-30, -20, -9.5, 8, 19, 28.5]) add(x, 31.4, 0.9);
    for (const [x, z] of [[-19.4, 18.8], [-22.8, 15.2], [-26.2, -11.5], [-20.4, -12.3], [17.5, -1.8], [27.5, 13.5]]) add(x, z, 0.7, 0x5aaa44);
    const parts = [
      new THREE.SphereGeometry(0.75, 12, 8).translate(0, 0.55, 0),
      new THREE.SphereGeometry(0.6, 10, 8).translate(0.65, 0.42, 0.1),
      new THREE.SphereGeometry(0.58, 10, 8).translate(-0.62, 0.42, -0.08),
    ];
    const g = mergeGeometries(parts);
    const hull = mergeGeometries([[0.75, 0, 0.55, 0], [0.6, 0.65, 0.42, 0.1], [0.58, -0.62, 0.42, -0.08]]
      .map(([r, x, y, z]) => new THREE.SphereGeometry(r + 0.06, 10, 8).translate(x, y, z)));
    const im = new THREE.InstancedMesh(g, toon(0xffffff), list.length);
    const ih = new THREE.InstancedMesh(hull, this.outlineMat, list.length);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    list.forEach((bsh, i) => {
      _q.setFromAxisAngle(UP, (bsh.x * 13.1) % 6);
      m.compose(_p.set(bsh.x, 0, bsh.z), _q, _s.setScalar(bsh.s));
      im.setMatrixAt(i, m); ih.setMatrixAt(i, m);
      im.setColorAt(i, col.setHex(bsh.c));
      if (bsh.z > this.bounds.minZ - 1 && bsh.z < this.bounds.maxZ + 1 && Math.abs(bsh.x) < 31.5) {
        this.colliders.push({ type: 'circle', x: bsh.x, z: bsh.z, r: 0.8 * bsh.s });
      }
    });
    im.computeBoundingSphere(); ih.computeBoundingSphere();
    this.root.add(im, ih);
  }

  buildFoliage() {
    const rand = this.rand;
    const B = this.bounds;
    const blocked = (x, z, pad) => {
      for (const c of this.colliders) {
        if (c.type === 'circle') { if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true; }
        else if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return true;
      }
      return Math.abs(x) < 2.5 && z > -26 && z < 32; // keep main path clear
    };
    // grass tufts
    const tuftParts = [];
    for (let i = 0; i < 3; i++) {
      tuftParts.push(new THREE.ConeGeometry(0.07, 0.42, 4).translate(0, 0.21, 0).rotateZ((i - 1) * 0.45).translate((i - 1) * 0.08, 0, 0));
    }
    const tuftGeo = mergeGeometries(tuftParts);
    const tufts = [];
    let guard = 0;
    while (tufts.length < 420 && guard++ < 5000) {
      const x = B.minX + rand() * (B.maxX - B.minX), z = B.minZ + rand() * (B.maxZ - B.minZ + 1.5);
      if (blocked(x, z, 0.3)) continue;
      tufts.push([x, z]);
    }
    const ti = new THREE.InstancedMesh(tuftGeo, toon(0xffffff), tufts.length);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    tufts.forEach(([x, z], i) => {
      _q.setFromAxisAngle(UP, rand() * 6);
      m.compose(_p.set(x, 0, z), _q, _s.setScalar(0.8 + rand() * 0.7));
      ti.setMatrixAt(i, m);
      ti.setColorAt(i, col.setHex(rand() < 0.5 ? 0x7fa82a : 0x9cbc34));
    });
    ti.computeBoundingSphere();
    this.root.add(ti);

    // flowers in little clusters
    const fGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.025, 0.025, 0.3, 4).translate(0, 0.15, 0),
      new THREE.SphereGeometry(0.11, 8, 6).scale(1, 0.6, 1).translate(0, 0.32, 0),
    ]);
    const fColors = [0xff5f7e, 0xffffff, 0xffd23f, 0xff8fbf, 0x8fb8ff];
    const flowers = [];
    const centers = [[-12, 26], [10, 27], [-27, 20], [26, 16], [-26, -18], [24, -20], [-16, -22], [17, -22], [-12, 12], [12, -6], [-28, 0], [16, 16]];
    for (const [cx, cz] of centers) {
      const color = fColors[flowers.length % fColors.length];
      let tries = 0, made = 0;
      while (made < 14 && tries++ < 60) {
        const x = cx + (rand() - 0.5) * 3.2, z = cz + (rand() - 0.5) * 3.2;
        if (blocked(x, z, 0.2)) continue;
        flowers.push([x, z, rand() < 0.75 ? color : fColors[(rand() * 5) | 0]]);
        made++;
      }
    }
    const fi = new THREE.InstancedMesh(fGeo, toon(0xffffff), flowers.length);
    flowers.forEach(([x, z, c], i) => {
      m.compose(_p.set(x, 0, z), _q.identity(), _s.setScalar(0.9 + rand() * 0.5));
      fi.setMatrixAt(i, m);
      fi.setColorAt(i, col.setHex(c));
    });
    fi.computeBoundingSphere();
    this.root.add(fi);
  }

  buildClouds() {
    this.clouds = [];
    const mat = toon(C.cloud);
    const defs = [[-30, 30, -60, 1.3], [25, 34, -40, 1.0], [5, 28, 70, 1.2]];
    for (const [x, y, z, s] of defs) {
      const parts = [[0, 0, 0, 3], [3, -0.6, 0.4, 2.2], [-3, -0.7, 0, 2.3], [1.2, 1.3, 0, 2.1], [-1.5, 0.9, 0.6, 1.8]]
        .map(([px, py, pz, r]) => new THREE.SphereGeometry(r, 12, 9).scale(1, 0.75, 0.9).translate(px, py, pz));
      const mesh = new THREE.Mesh(mergeGeometries(parts), mat);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(s);
      this.root.add(mesh);
      this.clouds.push({ mesh, speed: 0.6 + s * 0.3 });
    }
  }

  buildDuck() {
    // A rubber duck patrols the pond. It has seen things.
    const body = mergeGeometries([
      new THREE.SphereGeometry(0.42, 12, 9).scale(1.2, 0.8, 1).translate(0, 0.2, 0),
      new THREE.SphereGeometry(0.26, 10, 8).translate(0.32, 0.6, 0),
    ]);
    const beak = new THREE.ConeGeometry(0.1, 0.22, 6).rotateZ(-Math.PI / 2).translate(0.62, 0.56, 0);
    this.duck = new THREE.Group();
    const bm = new THREE.Mesh(body, toon(C.yellow));
    bm.add(new THREE.Mesh(beak, toon(0xff8a3c)));
    this.duck.add(bm);
    this.root.add(this.duck);
  }

  // ------------------------------------------------------------ spawns
  pickEnemySpawns() {
    const cands = [[-12, -16], [0, -14], [12, -15], [-14, -3], [13, -5], [-9, 8], [8, 10], [-2, 1], [-15, 12], [6, -6], [18, -12], [-24, -18]];
    const out = [];
    const v = new THREE.Vector3();
    for (const [x, z] of cands) {
      v.set(x, 0, z);
      if (v.distanceTo(this.playerSpawn) < 10) continue;
      if (this.resolveCollision(v, 1.0)) continue;
      out.push(new THREE.Vector3(x, 0, z));
      if (out.length >= 10) break;
    }
    return out;
  }

  // ------------------------------------------------------------ API
  getGroundHeight() {
    return 0;
  }

  resolveCollision(pos, radius) {
    let hit = false;
    const cs = this.colliders;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.type === 'circle') {
        const rr = c.r + radius;
        const dx = pos.x - c.x, dz = pos.z - c.z;
        if (dx > rr || dx < -rr || dz > rr || dz < -rr) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2);
        if (d < 1e-5) { pos.x = c.x + rr; }
        else { pos.x = c.x + (dx / d) * rr; pos.z = c.z + (dz / d) * rr; }
        hit = true;
      } else {
        if (pos.x < c.minX - radius || pos.x > c.maxX + radius || pos.z < c.minZ - radius || pos.z > c.maxZ + radius) continue;
        const cx = pos.x < c.minX ? c.minX : pos.x > c.maxX ? c.maxX : pos.x;
        const cz = pos.z < c.minZ ? c.minZ : pos.z > c.maxZ ? c.maxZ : pos.z;
        const dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > 1e-10) {
          if (d2 >= radius * radius) continue;
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // center inside the box: exit through the nearest face
          const l = pos.x - c.minX, r = c.maxX - pos.x, n = pos.z - c.minZ, s = c.maxZ - pos.z;
          const m = Math.min(l, r, n, s);
          if (m === l) pos.x = c.minX - radius;
          else if (m === r) pos.x = c.maxX + radius;
          else if (m === n) pos.z = c.minZ - radius;
          else pos.z = c.maxZ + radius;
        }
        hit = true;
      }
    }
    const B = this.bounds;
    if (pos.x < B.minX + radius) { pos.x = B.minX + radius; hit = true; }
    else if (pos.x > B.maxX - radius) { pos.x = B.maxX - radius; hit = true; }
    if (pos.z < B.minZ + radius) { pos.z = B.minZ + radius; hit = true; }
    else if (pos.z > B.maxZ - radius) { pos.z = B.maxZ - radius; hit = true; }
    return hit;
  }

  // Fraction along from->to where the segment first enters a tall box collider (slab test), else 1.
  segmentBlocked(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    let best = 1;
    const cs = this.colliders;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.type !== 'box' || !c.h) continue;
      let t0 = 0, t1 = best;
      // x slab
      if (Math.abs(dx) < 1e-9) { if (from.x < c.minX || from.x > c.maxX) continue; }
      else {
        let a = (c.minX - from.x) / dx, b = (c.maxX - from.x) / dx;
        if (a > b) { const t = a; a = b; b = t; }
        if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue;
      }
      if (Math.abs(dz) < 1e-9) { if (from.z < c.minZ || from.z > c.maxZ) continue; }
      else {
        let a = (c.minZ - from.z) / dz, b = (c.maxZ - from.z) / dz;
        if (a > b) { const t = a; a = b; b = t; }
        if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue;
      }
      if (Math.abs(dy) < 1e-9) { if (from.y < -1 || from.y > c.h) continue; }
      else {
        let a = (-1 - from.y) / dy, b = (c.h - from.y) / dy;
        if (a > b) { const t = a; a = b; b = t; }
        if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue;
      }
      // ignore boxes the segment starts inside (t0 stays 0 only if from is inside)
      if (t0 <= 0) {
        if (from.x > c.minX && from.x < c.maxX && from.z > c.minZ && from.z < c.maxZ && from.y < c.h) continue;
      }
      if (t0 < best) best = t0;
    }
    return best < 0 ? 0 : best;
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    // water shimmer
    if (this.waterTex) {
      this.waterTex.offset.x = (t * 0.03) % 1;
      this.waterTex.offset.y = Math.sin(t * 0.7) * 0.03;
    }
    // flag wave
    if (this.flag) {
      const p = this.flag.geometry.attributes.position;
      const a = p.array, base = this.flagBase;
      for (let i = 0; i < a.length; i += 3) {
        const x = base[i];
        const w = x / 2.4;
        a[i + 2] = Math.sin(x * 2.4 - t * 6) * 0.22 * w + Math.sin(t * 2.3 + base[i + 1]) * 0.04 * w;
        a[i + 1] = base[i + 1] - w * w * 0.12 + Math.sin(x * 1.7 - t * 4) * 0.04 * w;
      }
      p.needsUpdate = true;
    }
    // clock: "time flies" at Maplewood High
    if (this.clockHands) {
      this.clockHands[1].rotation.z = -t * 0.6;
      this.clockHands[0].rotation.z = -t * 0.05 - 1.2;
    }
    // trees sway every other frame-ish (cheap anyway)
    if (this.treeCrowns) this.swayTrees(t);
    // clouds drift and wrap
    for (const c of this.clouds) {
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > 90) c.mesh.position.x = -90;
    }
    // duck patrol
    if (this.duck) {
      const a = t * 0.35;
      const cx = 20.8, cz = 3.4, r = 3.0;
      this.duck.position.set(cx + Math.cos(a) * r, 0.04 + Math.sin(t * 3) * 0.03, cz + Math.sin(a) * r);
      this.duck.rotation.y = -a - Math.PI;
      this.duck.rotation.z = Math.sin(t * 2.2) * 0.08;
    }
  }
}
