import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, basic } from '../core/materials.js';

// Static-geometry batcher for blocky areas. Every piece is baked into world space and merged
// into one mesh per color (plus one merged outline hull), so a whole area costs a few dozen draw calls.

const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x2a1a2e, side: THREE.BackSide });
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

function bake(geo, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  _e.set(rx, ry, rz);
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
  g.applyMatrix4(_m);
  return g;
}

export class Batch {
  constructor() {
    this.byColor = new Map();
    this.outlines = [];
  }

  add(color, geo, x, y, z, { ry = 0, rx = 0, rz = 0, scale = [1, 1, 1], outline = 0 } = {}) {
    if (!this.byColor.has(color)) this.byColor.set(color, []);
    this.byColor.get(color).push(bake(geo, x, y, z, ry, ...scale, rx, rz));
    if (outline > 0) {
      // Inverted hull: same piece, grown by `outline` units on each axis.
      geo.computeBoundingBox();
      const size = geo.boundingBox.getSize(new THREE.Vector3());
      const k = (n, s) => (n > 1e-4 ? (n * s + outline * 2) / n : s);
      this.outlines.push(bake(geo, x, y, z, ry, k(size.x, scale[0]), k(size.y, scale[1]), k(size.z, scale[2]), rx, rz));
    }
    return this;
  }

  // Box sitting ON y (bottom at y), centered on x/z.
  box(color, w, h, d, x, y, z, o = {}) {
    return this.add(color, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, o);
  }

  cyl(color, rTop, rBot, h, x, y, z, o = {}) {
    return this.add(color, new THREE.CylinderGeometry(rTop, rBot, h, o.seg ?? 10), x, y + h / 2, z, o);
  }

  sph(color, r, x, y, z, o = {}) {
    return this.add(color, new THREE.SphereGeometry(r, o.seg ?? 10, Math.max(6, (o.seg ?? 10) - 2)), x, y, z, o);
  }

  // Gable roof (triangular prism) with ridge along local X. Base at y.
  gable(color, w, h, d, x, y, z, o = {}) {
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0);
    shape.lineTo(d / 2, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    g.translate(0, 0, -w / 2);
    g.rotateY(Math.PI / 2);
    return this.add(color, g, x, y, z, o);
  }

  finish(parent) {
    for (const [color, geos] of this.byColor) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), toon(color));
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    if (this.outlines.length) {
      const mesh = new THREE.Mesh(mergeGeometries(this.outlines), OUTLINE);
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.byColor.clear();
    this.outlines.length = 0;
  }
}

// Ground decals are stacked a hair apart (grass < sand < water < sidewalk < road < paint). The tiny
// height gap alone z-fights at a distance, so each layer also gets a depth offset proportional to it.
const decalMats = new Map();
export function decalMaterial(color, y) {
  const layer = Math.max(0, Math.round(y * 1000));
  const key = `${color}|${layer}`;
  if (!decalMats.has(key)) {
    decalMats.set(key, new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -layer / 4, polygonOffsetUnits: -layer }));
  }
  return decalMats.get(key);
}

// Flat painted rectangle on the ground (roads, paths, rugs). Unlit, so colors stay crisp.
export function groundRect(parent, color, w, d, x, z, y = 0.01, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), decalMaterial(color, y));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.updateMatrix();
  m.matrixAutoUpdate = false;
  parent.add(m);
  return m;
}

// A sign: text painted on a canvas, on a plane facing +Z (rotate with ry).
export function signMesh(lines, { w = 4, h = 1, bg = '#fff6e0', fg = '#2a1a2e', border = '#2a1a2e', font = 'bold', px = 64 } = {}) {
  const c = document.createElement('canvas');
  const scale = 128;
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = 10;
    g.strokeRect(5, 5, c.width - 10, c.height - 10);
  }
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  const lh = c.height / (arr.length + 0.4);
  arr.forEach((line, i) => {
    let size = i === 0 ? px : px * 0.6;
    g.font = `${font} ${size}px "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif`;
    while (g.measureText(line).width > c.width * 0.9 && size > 10) {
      size -= 2;
      g.font = `${font} ${size}px "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif`;
    }
    g.fillText(line, c.width / 2, lh * (i + 0.7));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  return mesh;
}

export function place(parent, obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  obj.updateMatrix();
  obj.matrixAutoUpdate = false;
  parent.add(obj);
  return obj;
}
