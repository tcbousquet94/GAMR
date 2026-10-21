// Geometry batching for the hero renderer: pieces are added per surface key, given world-space metre UVs (projected
// along each face: u runs horizontally across a wall, v up it or up a roof slope; floors map x/z) and a vertex tint,
// then merged into one mesh per surface. Shared walls line up their brick courses and siding boards for free.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3(), _b = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _v = new THREE.Vector3();

// Matrix from position, yaw/pitch/roll (YXZ order) and optional scale.
export function mat(x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
}

export class Batch {
  constructor() { this.lists = {}; this.opts = {}; }

  // geo: BufferGeometry in local space; m: Matrix4 or null. uv: 'planar' (world metres) | 'native' (geo uv x uvScale).
  add(key, geo, m = null, color = 0xffffff, { uv = 'planar', uvScale = [1, 1], uvOffset = [0, 0] } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    const uvs = new Float32Array(n * 2);
    if (uv === 'planar') {
      for (let i = 0; i < n; i++) {
        _p.fromBufferAttribute(pos, i); _n.fromBufferAttribute(nor, i).normalize();
        if (Math.abs(_n.y) > 0.985) { uvs[i * 2] = _p.x; uvs[i * 2 + 1] = -_p.z; continue; }
        _t.crossVectors(UP, _n).normalize(); _b.crossVectors(_n, _t).normalize();
        uvs[i * 2] = _p.dot(_t) + uvOffset[0]; uvs[i * 2 + 1] = _p.dot(_b) + uvOffset[1];
      }
    } else {
      const src = g.attributes.uv;
      for (let i = 0; i < n; i++) { uvs[i * 2] = (src ? src.getX(i) : 0) * uvScale[0] + uvOffset[0]; uvs[i * 2 + 1] = (src ? src.getY(i) : 0) * uvScale[1] + uvOffset[1]; }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    const c = new THREE.Color(color), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    (this.lists[key] ||= []).push(g);
    return g;
  }

  // Axis-aligned box from min/max corners.
  box(key, x0, y0, z0, x1, y1, z1, color, o) {
    return this.add(key, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), color, o);
  }
  // Centred box of size w,h,d placed by a matrix (local origin at the box centre).
  boxM(key, w, h, d, m, color, o) { return this.add(key, new THREE.BoxGeometry(w, h, d), m, color, o); }

  // Merge into one mesh per surface. shadows: { cast: Set|true, receive: true }.
  build(materials, { noCast = [] } = {}) {
    const group = new THREE.Group();
    for (const [key, list] of Object.entries(this.lists)) {
      const geo = mergeGeometries(list, false);
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      // The GPU keeps its own copy: drop the JS-side arrays once uploaded (big towns otherwise use GBs on phones).
      for (const a of Object.values(geo.attributes)) a.onUpload(releaseArray);
      const mesh = new THREE.Mesh(geo, materials[key]);
      mesh.name = key;
      mesh.castShadow = !noCast.includes(key);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.lists = {};
    return group;
  }
}
function releaseArray() { this.array = null; }

// A flat ribbon on the ground following a polyline (for curving paths, kerbs' tops etc.). pts: [{x,z}], width, y.
export function ribbon(pts, width, y = 0, y1 = null) {
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const nx = -dz * width / 2, nz = dx * width / 2;
    pos.push(pts[i].x + nx, y, pts[i].z + nz, pts[i].x - nx, y1 ?? y, pts[i].z - nz);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } // wound to face up
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Extruded prism from a 2D outline in the x/y plane, depth along z (centred). Used for roofs, gables, car bodies.
export function prism(shapePts, depth) {
  const s = new THREE.Shape(shapePts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Triangle soup from a list of [ [x,y,z], [x,y,z], [x,y,z] ] faces (flat normals).
export function tris(faces) {
  const pos = [];
  for (const f of faces) for (const p of f) pos.push(p[0], p[1], p[2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
