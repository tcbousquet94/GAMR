// Instanced articulated characters. A rig type is a list of rigid parts (each a merged faceted geometry in its
// own local space, hung off a parent at a pivot). Every frame each live character adds one instance with a pose;
// draw calls = parts per type, no matter how many enemies are on screen.

import * as THREE from 'three';
import { facetMaterial } from './facet.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

export class RigType {
  constructor(def, capacity, scene, opts = {}) {
    this.def = def;
    this.capacity = capacity;
    this.parts = def.parts;
    this.order = topo(def.parts);
    this.meshes = [];
    this.flash = [];
    this.world = def.parts.map(() => new THREE.Matrix4());
    const mat = facetMaterial({ flash: true, roughness: 0.72, flat: false });
    for (const p of def.parts) {
      const flash = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      flash.setUsage(THREE.DynamicDrawUsage);
      p.geo.setAttribute('aFlash', flash);
      const mesh = new THREE.InstancedMesh(p.geo, mat, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = opts.shadows !== false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      this.meshes.push(mesh);
      this.flash.push(flash);
    }
    this.n = 0;
  }

  begin() { this.n = 0; }

  // root: Matrix4; pose: { partName: [rx, ry, rz] or {r:[..], t:[..], s:k} }; flash 0..1
  add(root, pose, flash = 0) {
    if (this.n >= this.capacity) return;
    const i = this.n++;
    this.compute(root, pose);
    for (let k = 0; k < this.meshes.length; k++) { this.meshes[k].setMatrixAt(i, this.world[k]); this.flash[k].array[i] = flash; }
  }

  // Fills this.world with each part's world matrix for a root + pose.
  compute(root, pose) {
    for (const k of this.order) {
      const p = this.parts[k];
      const pp = pose[p.name];
      let rx = 0, ry = 0, rz = 0, tx = 0, ty = 0, tz = 0, sc = 1;
      if (pp) {
        const r = Array.isArray(pp) ? pp : pp.r || [0, 0, 0];
        rx = r[0]; ry = r[1]; rz = r[2];
        if (pp.t) { tx = pp.t[0]; ty = pp.t[1]; tz = pp.t[2]; }
        if (pp.s != null) sc = pp.s;
      }
      _e.set(rx, ry, rz, 'YXZ');
      _q.setFromEuler(_e);
      _v.set(p.pivot[0] + tx, p.pivot[1] + ty, p.pivot[2] + tz);
      _s.set(sc, sc, sc);
      _m.compose(_v, _q, _s);
      const parent = p.parentIndex >= 0 ? this.world[p.parentIndex] : root;
      this.world[k].multiplyMatrices(parent, _m);
    }
    return this.world;
  }

  // Ragdolls: add an instance from precomputed per-part world matrices.
  addWorld(mats, flash = 0) {
    if (this.n >= this.capacity) return;
    const i = this.n++;
    for (let k = 0; k < this.meshes.length; k++) { this.meshes[k].setMatrixAt(i, mats[k]); this.flash[k].array[i] = flash; }
  }

  // Copy of the per-part world matrices from the most recent add() (to seed a ragdoll).
  snapshot() { return this.world.map((m) => m.clone()); }

  end() {
    for (let k = 0; k < this.meshes.length; k++) {
      this.meshes[k].count = this.n;
      this.meshes[k].instanceMatrix.needsUpdate = true;
      this.flash[k].needsUpdate = true;
    }
  }

  setVisible(v) { for (const m of this.meshes) m.visible = v; }
}

function topo(parts) {
  const idx = new Map(parts.map((p, i) => [p.name, i]));
  for (const p of parts) p.parentIndex = p.parent ? idx.get(p.parent) : -1;
  const out = [], seen = new Set();
  const visit = (i) => { if (seen.has(i)) return; const p = parts[i]; if (p.parentIndex >= 0) visit(p.parentIndex); seen.add(i); out.push(i); };
  parts.forEach((_, i) => visit(i));
  return out;
}

export function rootMatrix(x, y, z, yaw, scale = 1, out = new THREE.Matrix4()) {
  _e.set(0, yaw, 0);
  _q.setFromEuler(_e);
  return out.compose(_v.set(x, y, z), _q, _s.set(scale, scale, scale));
}
