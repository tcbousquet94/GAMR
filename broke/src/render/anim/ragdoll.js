// Full-body verlet ragdoll for deaths. Built from the character's last posed joint positions, it falls with the
// killing blow's momentum, collides with the ground and walls, then settles; part matrices are rebuilt from the
// particles every frame so the same instanced rig renders it.

import * as THREE from 'three';

// Particle names and the rig joints they come from.
const P = ['pelvis', 'chest', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR', 'hipL', 'hipR', 'knL', 'knR', 'anL', 'anR', 'toL', 'toR'];
const LINKS = [
  ['pelvis', 'chest'], ['chest', 'neck'], ['neck', 'head'], ['shL', 'shR'], ['shL', 'neck'], ['shR', 'neck'], ['shL', 'pelvis'], ['shR', 'pelvis'], ['shL', 'chest'], ['shR', 'chest'],
  ['shL', 'elL'], ['elL', 'haL'], ['shR', 'elR'], ['elR', 'haR'],
  ['hipL', 'hipR'], ['hipL', 'pelvis'], ['hipR', 'pelvis'], ['hipL', 'chest'], ['hipR', 'chest'], ['hipL', 'shL'], ['hipR', 'shR'],
  ['hipL', 'knL'], ['knL', 'anL'], ['hipR', 'knR'], ['knR', 'anR'], ['anL', 'toL'], ['anR', 'toR'], ['knL', 'toL'], ['knR', 'toR'],
  ['head', 'chest'],
];

const _v = new THREE.Vector3(), _m = new THREE.Matrix4();

export class Ragdoll {
  // world: physics world; parts: rig part list; worldMats: Matrix4 per part (last pose); vel: initial velocity
  constructor(world, rig, worldMats, vel, impulse, scale = 1) {
    this.world = world;
    this.rig = rig;
    this.scale = scale;
    this.age = 0;
    this.pts = {};
    const idx = new Map(rig.parts.map((p, i) => [p.name, i]));
    const at = (part, x, y, z) => { const i = idx.get(part); if (i == null) return null; return new THREE.Vector3(x, y, z).applyMatrix4(worldMats[i]); };
    const src = {
      pelvis: at('hips', 0, 0, 0), chest: at('torso', 0, 0.36, 0), neck: at('head', 0, 0, 0), head: at('head', 0, 0.24, 0),
      shL: at('armL', 0, 0, 0), shR: at('armR', 0, 0, 0), elL: at('foreL', 0, 0, 0), elR: at('foreR', 0, 0, 0), haL: at('foreL', 0, -0.3, 0), haR: at('foreR', 0, -0.3, 0),
      hipL: at('legL', 0, 0, 0), hipR: at('legR', 0, 0, 0), knL: at('shinL', 0, 0, 0), knR: at('shinR', 0, 0, 0), anL: at('footL', 0, 0, 0), anR: at('footR', 0, 0, 0),
      toL: at('footL', 0, -0.03, -0.2), toR: at('footR', 0, -0.03, -0.2),
    };
    const dt = 1 / 60;
    for (const n of P) {
      const p = src[n] || src.pelvis.clone();
      // Each particle gets the body's velocity plus the hit's push (stronger up top) and a little scatter.
      const up = n === 'head' || n === 'neck' || n === 'chest' || n.startsWith('sh') ? 1.4 : n.startsWith('ha') || n.startsWith('el') ? 1.2 : 0.7;
      const pv = new THREE.Vector3(vel.x + impulse.x * up + (Math.random() - 0.5), vel.y + impulse.y * up + Math.random(), vel.z + impulse.z * up + (Math.random() - 0.5));
      this.pts[n] = { p: p.clone(), o: p.clone().addScaledVector(pv, -dt) };
    }
    this.links = LINKS.filter(([a, b]) => this.pts[a] && this.pts[b]).map(([a, b]) => ({ a: this.pts[a], b: this.pts[b], len: this.pts[a].p.distanceTo(this.pts[b].p) }));
    this.basis = rig.parts.map(() => new THREE.Matrix4());
    this.localOff = rig.parts.map((p) => new THREE.Vector3(...p.pivot));
  }

  step(dt) {
    this.age += dt;
    if (this.age > 3.2) return; // settled: freeze
    const g = -24 * this.scale ** 0.3;
    const damp = this.age > 1.2 ? 0.94 : 0.985;
    for (const q of Object.values(this.pts)) {
      const vx = (q.p.x - q.o.x) * damp, vy = (q.p.y - q.o.y) * damp, vz = (q.p.z - q.o.z) * damp;
      q.o.copy(q.p);
      q.p.x += vx; q.p.y += vy + g * dt * dt; q.p.z += vz;
    }
    for (let it = 0; it < 6; it++) {
      for (const L of this.links) {
        _v.subVectors(L.b.p, L.a.p);
        const d = _v.length() || 1e-6;
        const k = ((d - L.len) / d) * 0.5;
        L.a.p.addScaledVector(_v, k); L.b.p.addScaledVector(_v, -k);
      }
      for (const q of Object.values(this.pts)) this.collide(q);
    }
  }

  collide(q) {
    const w = this.world;
    const r = 0.08 * this.scale;
    const gy = w.groundBelow(q.p.x, q.o.y + 0.3 * this.scale, q.p.z, 0.04, 20);
    if (Number.isFinite(gy) && q.p.y < gy + r) {
      q.p.y = gy + r;
      // Ground friction.
      q.o.x += (q.p.x - q.o.x) * 0.45; q.o.z += (q.p.z - q.o.z) * 0.45;
    }
    if (w.overlapsSolid(q.p.x - r, q.p.y - r, q.p.z - r, q.p.x + r, q.p.y + r, q.p.z + r)) { q.p.x = q.o.x; q.p.z = q.o.z; }
  }

  // Per-part world matrices from the particles.
  matrices() {
    const T = this.pts, S = this.scale;
    const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
    const torsoX = new THREE.Vector3().subVectors(T.shR.p, T.shL.p).normalize();
    const hipX = new THREE.Vector3().subVectors(T.hipR.p, T.hipL.p).normalize();
    const make = (origin, yAxis, xHint, out, flipY = false) => {
      Y.copy(yAxis).normalize();
      if (flipY) Y.negate();
      Z.crossVectors(xHint, Y).normalize();
      if (Z.lengthSq() < 1e-6) Z.set(0, 0, 1);
      X.crossVectors(Y, Z).normalize();
      out.makeBasis(X.multiplyScalar(S), Y.multiplyScalar(S), Z.multiplyScalar(S));
      out.setPosition(origin);
      return out;
    };
    const res = [];
    const byName = {};
    this.rig.parts.forEach((p, i) => { byName[p.name] = i; });
    const set = (name, m) => { const i = byName[name]; if (i != null) res[i] = m; };
    const mats = this.basis;
    set('hips', make(T.pelvis.p, _tmp(T.chest.p, T.pelvis.p), hipX, mats[byName.hips]));
    set('torso', make(T.pelvis.p, _tmp(T.neck.p, T.pelvis.p), torsoX, mats[byName.torso]));
    set('head', make(T.neck.p, _tmp(T.head.p, T.neck.p), torsoX, mats[byName.head]));
    for (const s of ['L', 'R']) {
      set(`arm${s}`, make(T[`sh${s}`].p, _tmp(T[`el${s}`].p, T[`sh${s}`].p), torsoX, mats[byName[`arm${s}`]], true));
      set(`fore${s}`, make(T[`el${s}`].p, _tmp(T[`ha${s}`].p, T[`el${s}`].p), torsoX, mats[byName[`fore${s}`]], true));
      set(`leg${s}`, make(T[`hip${s}`].p, _tmp(T[`kn${s}`].p, T[`hip${s}`].p), hipX, mats[byName[`leg${s}`]], true));
      set(`shin${s}`, make(T[`kn${s}`].p, _tmp(T[`an${s}`].p, T[`kn${s}`].p), hipX, mats[byName[`shin${s}`]], true));
      set(`foot${s}`, make(T[`an${s}`].p, _tmp(T[`an${s}`].p, T[`kn${s}`].p).negate().negate(), hipX, mats[byName[`foot${s}`]], true));
    }
    // Everything else (eyes, cloth, props) rides its parent with its rest offset.
    this.rig.parts.forEach((p, i) => {
      if (res[i]) return;
      const parent = p.parentIndex >= 0 ? res[p.parentIndex] || mats[p.parentIndex] : null;
      if (!parent) { res[i] = mats[i].copy(res[byName.hips] || mats[i]); return; }
      _m.makeTranslation(p.pivot[0], p.pivot[1], p.pivot[2]);
      res[i] = mats[i].multiplyMatrices(parent, _m);
    });
    return res;
  }
}
const _t = new THREE.Vector3();
function _tmp(a, b) { return _t.subVectors(a, b).clone(); }
