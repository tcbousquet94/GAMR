// Faceted low-poly geometry: primitives are made non-indexed, vertices get a small position-hashed jitter (so
// shared corners move together and nothing cracks), normals are flat, and each triangle gets a slight colour
// variation. That gives the folded-paper look of the reference images.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: opts.roughness ?? 0.82, metalness: opts.metalness ?? 0.0, ...opts.extra });
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
    mat.customProgramCacheKey = () => 'facet-flash';
  }
  return mat;
}
