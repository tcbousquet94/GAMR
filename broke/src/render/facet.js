// Faceted low-poly geometry: primitives are made non-indexed, vertices get a small position-hashed jitter (so
// shared corners move together and nothing cracks), normals are flat, and each triangle gets a slight colour
// variation. That gives the folded-paper look of the reference images.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const tmpC = new THREE.Color();

function hash3(x, y, z) {
  let h = Math.imul(Math.round(x * 1000) | 0, 73856093) ^ Math.imul(Math.round(y * 1000) | 0, 19349663) ^ Math.imul(Math.round(z * 1000) | 0, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// geo: any BufferGeometry. Returns a non-indexed geometry with position, normal, color.
export function facet(geo, color, { jitter = 0.0, shade = 0.06, transform = null } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (transform) g.applyMatrix4(transform);
  const pos = g.attributes.position;
  if (jitter > 0) {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      pos.setXYZ(i, x + (hash3(x, y, z) - 0.5) * jitter, y + (hash3(y, z, x) - 0.5) * jitter, z + (hash3(z, x, y) - 0.5) * jitter);
    }
  }
  g.computeVertexNormals(); // non-indexed => flat
  const col = new Float32Array(pos.count * 3);
  const base = new THREE.Color(color);
  for (let t = 0; t < pos.count; t += 3) {
    const k = 1 + (hash3(pos.getX(t), pos.getY(t + 1), pos.getZ(t + 2)) - 0.5) * 2 * shade;
    tmpC.copy(base).multiplyScalar(k);
    for (let j = 0; j < 3; j++) { col[(t + j) * 3] = tmpC.r; col[(t + j) * 3 + 1] = tmpC.g; col[(t + j) * 3 + 2] = tmpC.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}

const M = () => new THREE.Matrix4();
export const at = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  M().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// Primitive builders (all return faceted geometry). Sizes in metres; positioned by `m` (a Matrix4).
export const fbox = (w, h, d, color, m, o = {}) => facet(new THREE.BoxGeometry(w, h, d, o.seg || 1, o.segY || 1, o.seg || 1), color, { jitter: o.jitter ?? 0.02, shade: o.shade, transform: m });
export const fcyl = (rt, rb, h, color, m, o = {}) => facet(new THREE.CylinderGeometry(rt, rb, h, o.n || 7, o.segY || 1), color, { jitter: o.jitter ?? 0.02, shade: o.shade, transform: m });
export const fball = (r, color, m, o = {}) => facet(new THREE.IcosahedronGeometry(r, o.detail ?? 1), color, { jitter: o.jitter ?? r * 0.12, shade: o.shade ?? 0.08, transform: m });
export const fcone = (r, h, color, m, o = {}) => facet(new THREE.ConeGeometry(r, h, o.n || 6), color, { jitter: o.jitter ?? 0.02, shade: o.shade, transform: m });

export function merge(list) {
  const g = mergeGeometries(list.filter(Boolean), false);
  g.computeBoundingSphere();
  return g;
}

// Material used by every faceted mesh. Supports per-instance flash (hit flash / attack telegraph -> white).
export function facetMaterial(opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: opts.flat ?? true, roughness: opts.roughness ?? 0.82, metalness: opts.metalness ?? 0.0, ...opts.extra });
  if (opts.flash) {
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aFlash;\nvarying float vFlash;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlash = aFlash;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFlash;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), clamp(vFlash, 0.0, 1.0));')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0) * clamp(vFlash, 0.0, 1.0) * 1.4;');
    };
    mat.customProgramCacheKey = () => `facet-flash-${opts.flat ?? true}`;
  }
  return mat;
}

// ---- Smooth (organic) primitives for characters: indexed geometry with smooth normals ---------------------------

export function smooth(geo, color, m, shade = 0) {
  const g = geo.clone();
  if (m) g.applyMatrix4(m);
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  g.computeVertexNormals();
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    // Optional soft vertical shading (darker toward the bottom of the piece) for cloth folds.
    const k = shade ? 1 - shade * 0.5 + shade * Math.min(1, Math.max(0, (g.attributes.position.getY(i) + 1) / 2)) : 1;
    col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.index) { const idx = []; for (let i = 0; i < n; i++) idx.push(i); g.setIndex(idx); }
  return g;
}
// Capsule along Y: radius r, straight length len, centred at the origin before m.
export const scap = (r, len, color, m, seg = 10) => smooth(new THREE.CapsuleGeometry(r, len, 4, seg), color, m);
export const sball = (r, color, m, seg = 16) => smooth(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75)), color, m);
export const sbox = (w, h, d, color, m, r = 0.03) => smooth(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.01, h / 2.01, d / 2.01)), color, m);
export const scyl = (rt, rb, h, color, m, seg = 14) => smooth(new THREE.CylinderGeometry(rt, rb, h, seg, 1), color, m);
// Lathe from a profile of [radius, y] points; zScale flattens it front-to-back.
export function slathe(profile, color, m, zScale = 1, seg = 18) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.scale(1, 1, zScale);
  return smooth(g, color, m);
}
export function smoothMerge(list) {
  const g = mergeGeometries(list.filter(Boolean), false);
  g.computeBoundingSphere();
  return g;
}
