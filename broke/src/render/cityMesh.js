// Turns the generator's Kit into a handful of draw calls: per chunk one merged faceted mesh, one window/neon mesh
// (day/night colours blended by a uniform), one glass mesh and one detail mesh (LOD'd out at distance), plus
// instanced props, a sign atlas, light pools, string lights and a distant skyline.

import * as THREE from 'three';
import { MAT } from '../city/kit.js';
import { propGeometries } from './models/props.js';

const CHUNK = 160;
const _c = new THREE.Color(), _n = new THREE.Color();

// ---- shared materials -------------------------------------------------------------------------------------------
export function makeNightMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uNight: { value: 0 }, uDay: { value: 1 }, uBoost: { value: opts.boost ?? 1 } }]),
    vertexShader: `
      attribute vec3 aNight;
      uniform float uNight; uniform float uDay; uniform float uBoost;
      varying vec3 vC;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vC = mix(color * uDay, aNight * uBoost, uNight);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      varying vec3 vC;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4(vC, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    vertexColors: true, fog: true, side: opts.side ?? THREE.FrontSide,
  });
}

// ---- geometry writer ----------------------------------------------------------------------------------------------
class Writer {
  constructor() { this.p = []; this.n = []; this.c = []; this.k = []; }
  // cols: one colour for the face, or an array of three per-vertex colours.
  tri(a, b, c, nx, ny, nz, col, night, cols) {
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) {
      const cc = cols ? cols[i] : col;
      this.n.push(nx, ny, nz); this.c.push(cc.r, cc.g, cc.b);
      if (night) this.k.push(night.r, night.g, night.b);
    }
  }
  geometry(withNight) {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (withNight) g.setAttribute('aNight', new THREE.Float32BufferAttribute(this.k, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const FACES = [
  // [normal, 4 corner indices] for a unit cube with corners ordered by (x,y,z) bits
  [[1, 0, 0], [1, 3, 7, 5]], [[-1, 0, 0], [0, 4, 6, 2]],
  [[0, 1, 0], [2, 6, 7, 3]], [[0, -1, 0], [0, 1, 5, 4]],
  [[0, 0, 1], [4, 5, 7, 6]], [[0, 0, -1], [0, 2, 3, 1]],
];
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _nv = new THREE.Vector3();

function hash(a, b) { let h = Math.imul((a * 1000) | 0, 374761393) ^ Math.imul((b * 1000) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

function writeBox(w, b, night) {
  const hx = b.sx / 2, hy = b.sy / 2, hz = b.sz / 2;
  const rot = b.rx || b.ry || b.rz;
  if (rot) { _e.set(b.rx || 0, b.ry || 0, b.rz || 0); _q.setFromEuler(_e); }
  const corners = [];
  for (let i = 0; i < 8; i++) {
    _v.set(i & 1 ? hx : -hx, i & 2 ? hy : -hy, i & 4 ? hz : -hz);
    if (rot) _v.applyQuaternion(_q);
    corners.push([_v.x + b.cx, _v.y + b.cy, _v.z + b.cz]);
  }
  _c.set(b.color);
  if (night) _n.set(b.night);
  const skipBottom = !rot && b.cy - hy < 0.2;
  for (let f = 0; f < 6; f++) {
    if (f === 3 && skipBottom) continue;
    const [nrm, idx] = FACES[f];
    _nv.set(nrm[0], nrm[1], nrm[2]);
    if (rot) _nv.applyQuaternion(_q);
    // Facet shading: per-face brightness wobble, lighter tops.
    const k = 1 + (hash(b.cx + f * 1.7, b.cz + b.cy) - 0.5) * 0.09 + (f === 2 ? 0.05 : 0);
    const col = _c.clone().multiplyScalar(k);
    const [a, bb, c, d] = idx.map((i) => corners[i]);
    // Ambient occlusion: walls darken toward their base so every building sits on the street.
    if (!night && Math.abs(_nv.y) < 0.5 && b.sy > 1.2) {
      const ao = (p) => col.clone().multiplyScalar(0.58 + 0.42 * smoothstep01((p[1] - (b.cy - hy)) / 3.2));
      const ca = ao(a), cb = ao(bb), cc = ao(c), cd = ao(d);
      w.tri(a, bb, c, _nv.x, _nv.y, _nv.z, null, null, [ca, cb, cc]);
      w.tri(a, c, d, _nv.x, _nv.y, _nv.z, null, null, [ca, cc, cd]);
      continue;
    }
    w.tri(a, bb, c, _nv.x, _nv.y, _nv.z, col, night ? _n : null);
    w.tri(a, c, d, _nv.x, _nv.y, _nv.z, col, night ? _n : null);
  }
}
const smoothstep01 = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

function writeQuad(w, q) {
  const hw = q.w / 2, hh = q.h / 2;
  // Right vector for a face with outward normal (nx, nz).
  const rx = -q.nz, rz = q.nx;
  const p = (s, t) => [q.cx + rx * s * hw, q.cy + t * hh, q.cz + rz * s * hw];
  _c.set(q.day); _n.set(q.night);
  const a = p(-1, -1), b = p(1, -1), c = p(1, 1), d = p(-1, 1);
  // Winding so the quad faces outward.
  w.tri(a, c, b, q.nx, 0, q.nz, _c, _n);
  w.tri(a, d, c, q.nx, 0, q.nz, _c, _n);
}

// ---- build ----------------------------------------------------------------------------------------------------------
export function buildCity(city, scene, opts = {}) {
  const kit = city.kit;
  const chunks = new Map();
  const chunk = (x, z) => {
    const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    let c = chunks.get(key);
    if (!c) chunks.set(key, (c = { key, cx: (Math.floor(x / CHUNK) + 0.5) * CHUNK, cz: (Math.floor(z / CHUNK) + 0.5) * CHUNK, std: new Writer(), detail: new Writer(), glass: new Writer(), glow: new Writer(), win: new Writer() }));
    return c;
  };
  for (const b of kit.boxes) {
    const c = chunk(b.cx, b.cz);
    if (b.mat === MAT.GLASS) writeBox(c.glass, b);
    else if (b.mat === MAT.GLOW) writeBox(c.glow, b, true);
    else {
      const small = b.sx * b.sy * b.sz < 1.5 && Math.max(b.sx, b.sy, b.sz) < 8;
      writeBox(small ? c.detail : c.std, b);
    }
  }
  for (const q of kit.quads) writeQuad(chunk(q.cx, q.cz).win, q);

  const stdMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.86, metalness: 0.02, envMapIntensity: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.4, depthWrite: false });
  const nightMat = makeNightMaterial({ boost: 1.25 });
  const group = new THREE.Group();
  group.name = 'city';
  const lod = [];
  for (const c of chunks.values()) {
    const mk = (w, mat, night, shadow) => {
      const g = w.geometry(night);
      if (!g) return null;
      const m = new THREE.Mesh(g, mat);
      m.castShadow = shadow; m.receiveShadow = shadow;
      m.matrixAutoUpdate = false;
      group.add(m);
      return m;
    };
    const std = mk(c.std, stdMat, false, true);
    const detail = mk(c.detail, stdMat, false, true);
    const glass = mk(c.glass, glassMat, false, false);
    const glow = mk(c.glow, nightMat, true, false);
    const win = mk(c.win, nightMat, true, false);
    if (glass) glass.renderOrder = 2;
    lod.push({ cx: c.cx, cz: c.cz, near: [detail].filter(Boolean), mid: [win, glow].filter(Boolean) });
  }
  scene.add(group);

  const props = buildProps(kit, scene);
  const signs = buildSigns(kit, scene);
  const lights = buildLights(kit, scene, nightMat);
  const skyline = buildSkyline(city, scene);

  return {
    group, props, signs, lights, skyline,
    materials: { nightMat, stdMat, glassMat, sign: signs.material, pool: lights.poolMat, skyline: skyline.material },
    // Distance LOD: drop small detail beyond 200 m and windows beyond 420 m.
    updateLod(cam) {
      for (const L of lod) {
        const d = Math.hypot(L.cx - cam.x, L.cz - cam.z);
        for (const m of L.near) m.visible = d < 200 + CHUNK * 0.7;
        for (const m of L.mid) m.visible = d < 420 + CHUNK * 0.7;
      }
      props.updateLod?.(cam);
    },
    setNight(k) {
      nightMat.uniforms.uNight.value = k;
      nightMat.uniforms.uDay.value = 1 - 0.55 * k;
      signs.material.color.setScalar(0.75 + 0.6 * k);
      lights.poolMat.opacity = 0.03 + 0.2 * k;
      lights.bulbMat.uniforms.uNight.value = k;
      skyline.material.uniforms.uNight.value = k;
    },
    tick(t) {
      lights.tick(t);
      if (signs.uTime) signs.uTime.value = t;
      skyline.material.uniforms.uTime.value = t;
    },
    stats() {
      let tris = 0;
      group.traverse((o) => { if (o.isMesh) tris += o.geometry.attributes.position.count / 3; });
      return { chunks: chunks.size, tris };
    },
  };
}

// ---- props --------------------------------------------------------------------------------------------------------
function buildProps(kit, scene) {
  const geos = propGeometries();
  const byType = new Map();
  for (const p of kit.props) {
    if (!geos[p.type]) continue;
    if (!byType.has(p.type)) byType.set(p.type, []);
    byType.get(p.type).push(p);
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75, metalness: 0.05 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(), col = new THREE.Color();
  const meshes = [];
  for (const [type, list] of byType) {
    const mesh = new THREE.InstancedMesh(geos[type], mat, list.length);
    list.forEach((p, i) => {
      q.setFromAxisAngle(_v.set(0, 1, 0), p.yaw || 0);
      m4.compose(v.set(p.x, p.y, p.z), q, s);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, col.set(p.color ?? 0xffffff));
    });
    mesh.castShadow = type !== 'streetlight' && type !== 'trafficlight';
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    meshes.push(mesh);
  }
  return { meshes };
}

// ---- signs (one atlas, one material) ------------------------------------------------------------------------------
function buildSigns(kit, scene) {
  const W = 2048, H = 4096, SW = 512, SH = 64;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) return { material: new THREE.MeshBasicMaterial() };
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const slots = new Map();
  let next = 0;
  const slotFor = (s) => {
    const key = `${s.kind}|${s.text}|${s.color}`;
    if (slots.has(key)) return slots.get(key);
    const i = next++ % ((W / SW) * (H / SH));
    const x = (i % (W / SW)) * SW, y = Math.floor(i / (W / SW)) * SH;
    drawSign(ctx, s, x, y, SW, SH);
    const r = { u0: x / W, v0: 1 - (y + SH) / H, u1: (x + SW) / W, v1: 1 - y / H };
    slots.set(key, r);
    return r;
  };
  const pos = [], uv = [], idx = [], flick = [];
  let si = 0;
  for (const s of kit.signs) {
    // About one neon sign in six has a failing tube and flickers.
    const f = s.kind === 'neon' && (si++ * 7919) % 6 === 0 ? 1 + (si % 13) : 0;
    flick.push(f, f, f, f);
    const r = slotFor(s);
    // Fit width to the text aspect (slot is 8:1).
    const w = Math.min(s.w, s.h * 8), h = w / 8 * (s.kind === 'graffiti' ? 1.6 : 1);
    // Screen-right for a viewer facing the sign (looking along -n).
    const rx = s.nz, rz = -s.nx;
    const base = pos.length / 3;
    const off = 0.06;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pos.push(s.cx + rx * a * w / 2 + s.nx * off, s.cy + b * h / 2, s.cz + rz * a * w / 2 + s.nz * off);
    uv.push(r.u0, r.v0, r.u1, r.v0, r.u1, r.v1, r.u0, r.v1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aFlick', new THREE.Float32BufferAttribute(flick, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: true });
  const uTime = { value: 0 };
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFlick; varying float vFlick;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlick = aFlick;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying float vFlick;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vFlick > 0.5) { float k = floor(uTime * 14.0 + vFlick * 31.0); float r = fract(sin(k * 12.9898 + vFlick) * 43758.5453);
          float off = step(0.82, r) * step(0.6, fract(sin(floor(uTime * 0.7 + vFlick) * 78.233) * 4375.5));
          diffuseColor.rgb *= 1.0 - 0.85 * off; }`);
  };
  const mesh = new THREE.Mesh(g, material);
  mesh.renderOrder = 3;
  scene.add(mesh);
  return { mesh, material, canvas, uTime };
}

function hexCss(c) { return `#${(c >>> 0).toString(16).padStart(6, '0')}`; }

function drawSign(ctx, s, x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const col = hexCss(s.color);
  const font = (px, weight = 800) => `${weight} ${px}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
  let size = 44;
  ctx.font = font(size);
  while (ctx.measureText(s.text).width > w - 40 && size > 14) { size -= 2; ctx.font = font(size); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cx = x + w / 2, cy = y + h / 2 + 2;
  if (s.kind === 'neon' || s.kind === 'truck' || s.kind === 'station' || s.kind === 'tower' || s.kind === 'garage') {
    if (s.kind !== 'tower') { ctx.fillStyle = 'rgba(16,12,24,0.92)'; roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 10); ctx.fill(); }
    ctx.shadowColor = col; ctx.shadowBlur = s.kind === 'tower' ? 6 : 14;
    ctx.fillStyle = s.kind === 'garage' ? col : '#ffffff';
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.strokeText(s.text, cx, cy);
    ctx.fillText(s.text, cx, cy);
    ctx.shadowBlur = 0;
    ctx.fillStyle = col; ctx.globalAlpha = 0.55; ctx.fillText(s.text, cx, cy); ctx.globalAlpha = 1;
  } else if (s.kind === 'graffiti') {
    ctx.font = `italic ${font(size + 4, 900)}`;
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 5;
    ctx.translate(cx, cy); ctx.rotate(-0.06);
    ctx.strokeText(s.text, 0, 0); ctx.fillText(s.text, 0, 0);
  } else {
    ctx.fillStyle = 'rgba(30,28,34,0.85)';
    ctx.fillText(s.text, cx, cy);
  }
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// ---- lights: ground pools, bulbs, string lights, beacons ------------------------------------------------------------
function buildLights(kit, scene) {
  const pools = kit.lights.filter((l) => l.radius > 0 && l.kind !== 'steam');
  // Soft radial texture for light pools.
  const tex = radialTexture();
  const poolMat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffa34d, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const pm = new THREE.InstancedMesh(poolGeo, poolMat, pools.length);
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), col = new THREE.Color();
  pools.forEach((l, i) => {
    const r = l.radius * 2.2;
    m4.compose(v.set(l.x, groundGuess(l) + 0.05, l.z), q.identity(), s.set(r, 1, r));
    pm.setMatrixAt(i, m4);
    pm.setColorAt(i, col.set(l.color));
  });
  pm.renderOrder = 1;
  pm.computeBoundingSphere();
  scene.add(pm);
  // Bulbs: small glowing boxes, brighter at night (bloom picks them up).
  const bulbs = kit.lights.filter((l) => l.kind !== 'steam');
  const bulbMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uNight: { value: 0 }, uTime: { value: 0 } }]),
    vertexShader: `uniform float uNight; uniform float uTime; varying vec3 vC;
      #include <common>
      #include <fog_pars_vertex>
      void main(){ vec3 c = instanceColor; float blink = 1.0;
        #ifdef USE_INSTANCING
        vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.);
        blink = c.r > 0.9 && c.g < 0.3 ? step(0.5, fract(uTime*0.7 + wp.x*0.013)) : 1.0;
        #endif
        vC = c * mix(0.6, 2.6, uNight) * blink;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position,1.); gl_Position = projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `varying vec3 vC;
      #include <common>
      #include <fog_pars_fragment>
      void main(){ gl_FragColor = vec4(vC,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: true,
  });
  // String lights add many tiny bulbs along a sagging wire.
  const strings = [];
  for (const sl of kit.strings) {
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      strings.push({ x: sl.ax + (sl.bx - sl.ax) * t, y: sl.ay + (sl.by - sl.ay) * t - Math.sin(t * Math.PI) * 0.6, z: sl.az + (sl.bz - sl.az) * t, color: 0xffd28a, kind: 'string' });
    }
  }
  const all = bulbs.concat(strings);
  const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bulbMat, all.length);
  all.forEach((l, i) => {
    const sz = l.kind === 'street' ? 0.45 : l.kind === 'string' ? 0.12 : l.kind === 'beacon' ? 0.5 : 0.3;
    m4.compose(v.set(l.x, l.y, l.z), q.identity(), s.set(sz, sz * (l.kind === 'street' ? 0.4 : 1), sz));
    bm.setMatrixAt(i, m4);
    bm.setColorAt(i, col.set(l.kind === 'beacon' ? 0xff2244 : l.color));
  });
  bm.computeBoundingSphere();
  scene.add(bm);
  return { pools: pm, poolMat, bulbMat, all, tick(t) { bulbMat.uniforms.uTime.value = t; } };
}
function groundGuess(l) { return l.kind === 'garage' || l.kind === 'walkway' || l.kind === 'lobby' || l.kind === 'station' ? l.y - (l.kind === 'lobby' ? 10.8 : l.kind === 'station' ? 3.4 : 2.8) : l.kind === 'truck' ? 0.15 : l.y > 5 ? 0.15 : Math.min(l.y, 0.15); }

function radialTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// ---- distant skyline: instanced towers with a procedural window shader --------------------------------------------
function buildSkyline(city, scene) {
  const S = city.size;
  const rng = city.kit.rng;
  const towers = [];
  for (let i = 0; i < 140; i++) {
    const a = (i / 140) * Math.PI * 2 + rng.range(-0.02, 0.02);
    const r = S * 0.5 + rng.range(90, 420);
    const x = S / 2 + Math.cos(a) * r, z = S / 2 + Math.sin(a) * r;
    const big = rng.chance(0.25);
    towers.push({ x, z, w: rng.range(18, 40), d: rng.range(18, 40), h: big ? rng.range(110, 220) : rng.range(45, 110), ry: rng.chance(0.3) ? Math.PI / 4 : 0 });
  }
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uNight: { value: 0 }, uTime: { value: 0 } }]),
    vertexShader: `varying vec3 vW; varying vec3 vN; varying vec3 vObj;
      #include <common>
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position,1.); vW = w.xyz; vObj = position;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uNight; varying vec3 vW; varying vec3 vN; varying vec3 vObj;
      #include <common>
      #include <fog_pars_fragment>
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec3 base = mix(vec3(0.17,0.22,0.36), vec3(0.06,0.07,0.14), uNight);
        float up = max(0.0, vN.y);
        float along = abs(vN.x) > 0.5 ? vW.z : vW.x;
        vec2 cell = vec2(floor(along / 2.8), floor(vW.y / 3.4));
        vec2 f = vec2(fract(along / 2.8), fract(vW.y / 3.4));
        float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.8) * (1.0 - up);
        float lit = step(0.52, h21(cell + floor(vW.xz / 40.0)));
        vec3 dayWin = vec3(0.42,0.52,0.72);
        vec3 nightWin = mix(vec3(1.0,0.78,0.5), vec3(0.9,0.9,0.8), h21(cell*1.3)) * lit * 1.6;
        vec3 col = mix(base, mix(dayWin, nightWin, uNight), win * 0.85);
        col *= 0.75 + 0.25 * (vN.x * 0.5 + 0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: true,
  });
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, material, towers.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  towers.forEach((t, i) => { q.setFromAxisAngle(_v.set(0, 1, 0), t.ry); m4.compose(v.set(t.x, -1, t.z), q, s.set(t.w, t.h, t.d)); mesh.setMatrixAt(i, m4); });
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, material };
}
