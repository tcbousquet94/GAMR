// Mirrors sim entities into the scene every frame: Dee, enemies (instanced rigs), the boss, drones, notices,
// projectiles, pickups and interactables. Reads sim state only; never writes to it.

import * as THREE from 'three';
import { RigType, rootMatrix } from './rig.js';
import { facetMaterial, fbox, fcyl, fball, merge, at } from './facet.js';
import * as M from './models/characters.js';
import { interactableGeometry } from './models/props.js';
import { Animator } from './anim/animator.js';
import { Ragdoll } from './anim/ragdoll.js';
import { blob } from './details.js';

const ANIM_OPTS = {
  dee: { fidgets: ['watch'] },
  speakerphone: { fidgets: ['gesture'], armSwing: 0.8 },
  canvasser: { fidgets: ['fan'], freq: 1.08 },
  scooter: { gait: false },
  hoa: { scale: 3.05, freq: 0.9, armSwing: 0.6 },
};

// Big frame steps (recording, hitches) are split so the springs and gait integrate accurately.
function animate(A, dt, ctx) {
  const n = Math.max(1, Math.min(8, Math.ceil(dt / (1 / 40))));
  let out;
  for (let i = 0; i < n; i++) out = A.update(dt / n, ctx);
  return out;
}

export class Actors {
  constructor(scene, game, view) {
    this.scene = scene;
    this.game = game;
    this.view = view;
    this.t = 0;
    this.objects = [];
    this.dee = new RigType(M.deeModel(), 1, scene);
    this.rigs = {
      speakerphone: new RigType(M.speakerphoneModel(), 64, scene),
      scooter: new RigType(M.scooterModel(), 64, scene),
      canvasser: new RigType(M.canvasserModel(), 64, scene),
      hoa: new RigType(M.hoaModel(), 1, scene),
      drone: new RigType(M.droneModel(), 16, scene),
    };
    this.m4 = new THREE.Matrix4();
    this.deeYaw = game.player.yaw;
    this.deePhase = 0;
    this.fireT = 0; this.throwT = 0; this.spinT = 0;
    this.deeAnim = new Animator(ANIM_OPTS.dee);
    this.corpses = [];
    const E = game.events;
    const P = game.player;
    this.off = [
      E.on('ability', (a) => {
        if (a.slot === 'primary') { this.fireT = 0.3; this.deeAnim.onRecoil(1); this.view.rig.recoil(0.012); }
        if (a.slot === 'secondary') { this.throwT = 0.35; this.deeAnim.onRecoil(1.6); this.view.rig.recoil(0.02); }
        if (a.slot === 'utility') this.spinT = 0.4;
      }),
      E.on('pivot', (d) => this.deeAnim.onPivot(Math.sign(d.from.x * d.to.z - d.from.z * d.to.x) || 1)),
      E.on('skid', () => this.deeAnim.onSkid()),
      E.on('land', (d) => this.deeAnim.onLand(d.hard, d.v)),
      // Hits push the body away from whoever landed them.
      E.on('hit', (d) => {
        const e = game.enemies.find((x) => x.id === d.id);
        if (!e || !e._anim) { if (e && e.type === 'drone') e._tilt = 0.5; return; }
        const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, l = Math.hypot(dx, dz) || 1;
        e._anim.onHit({ x: dx / l, z: dz / l }, (d.amount / Math.max(20, e.maxHp * 0.25)) * (e.boss ? 0.25 : 1) + 0.2);
      }),
      E.on('playerHurt', (d) => {
        const from = d.from || { x: P.pos.x - P.forward().x, z: P.pos.z - P.forward().z };
        const dx = P.pos.x - from.x, dz = P.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
        this.deeAnim.onHit({ x: dx / l, z: dz / l }, 0.35 + d.amount / 18);
      }),
      E.on('kill', (d) => {
        const e = game.enemies.find((x) => x.id === d.id);
        if (!e || !e._lastPose || !this.rigs[e.type] || e.type === 'drone') return;
        const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, l = Math.hypot(dx, dz) || 1;
        const push = e.boss ? 3 : 4.5 + Math.random() * 3;
        this.spawnRagdoll(this.rigs[e.type], e._lastRoot, e._lastPose, e.body.vel, { x: (dx / l) * push, y: 2.5 + Math.random() * 2, z: (dz / l) * push }, e._anim?.o.scale || 1);
      }),
      E.on('playerDeath', () => {
        if (!this.deeLast) return;
        const mats = this.dee.compute(this.deeLast.root, this.deeLast.pose).map((m) => m.clone());
        const f = P.forward();
        this.deeCorpse = new Ragdoll(game.world, this.dee, mats, P.body.vel, { x: -f.x * 3, y: 2, z: -f.z * 3 }, 1);
      }),
    ];
    this.buildProjectiles();
    this.buildPickups();
    this.buildInteractables();
    this.buildNotices();
    this.cart = new THREE.Mesh(merge([
      fbox(0.9, 0.06, 1.3, 0x8a8a90, at(0, 0.45, 0)), fbox(0.9, 0.55, 0.04, 0x9a9aa0, at(0, 0.75, -0.65)), fbox(0.9, 0.55, 0.04, 0x9a9aa0, at(0, 0.75, 0.65)),
      fbox(0.04, 0.55, 1.3, 0x9a9aa0, at(-0.45, 0.75, 0)), fbox(0.04, 0.55, 1.3, 0x9a9aa0, at(0.45, 0.75, 0)), fbox(0.9, 0.06, 0.06, 0xb8b8c0, at(0, 1.05, 0.85)),
      ...[[-0.38, -0.55], [0.38, -0.55], [-0.38, 0.55], [0.38, 0.55]].map(([x, z]) => fcyl(0.1, 0.1, 0.06, 0x1e1e22, at(x, 0.1, z, 0, 0, Math.PI / 2), { n: 6 })),
    ]), facetMaterial());
    this.cart.visible = false;
    scene.add(this.cart);
  }

  buildProjectiles() {
    const glow = (c) => new THREE.MeshBasicMaterial({ color: c, fog: true });
    const defs = {
      dart: [merge([fbox(0.05, 0.05, 0.5, 0xd8fff8, at(0, 0, 0), { jitter: 0 })]), glow(new THREE.Color(0x7cf5e4).multiplyScalar(2))],
      clipboard: [merge([fbox(0.36, 0.04, 0.48, 0x5a4434, at(0, 0, 0)), fbox(0.3, 0.05, 0.36, 0xe8e4d8, at(0, 0.01, 0.02), { jitter: 0 })]), facetMaterial()],
      textmissile: [merge([fball(0.32, 0xffffff, at(0, 0, 0), { detail: 1 }), fbox(0.12, 0.12, 0.2, 0xffffff, at(0.18, -0.22, 0.1, 0, 0, 0.6))]), glow(new THREE.Color(0x9fd8ff).multiplyScalar(1.6))],
      syringe: [merge([fcyl(0.04, 0.04, 0.5, 0xd8fff8, at(0, 0, 0)), fcyl(0.01, 0.01, 0.25, 0xffffff, at(0, -0.35, 0))]), glow(new THREE.Color(0x7cf5e4).multiplyScalar(2.2))],
      wave: [new THREE.TorusGeometry(1, 0.12, 4, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })],
      ticket: [merge([fbox(0.3, 0.02, 0.45, 0xe6dfcc, at(0, 0, 0), { jitter: 0 })]), glow(new THREE.Color(0xfff2c0).multiplyScalar(1.4))],
    };
    this.proj = {};
    for (const [k, [g, m]] of Object.entries(defs)) {
      const mesh = new THREE.InstancedMesh(g, m, 256);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.scene.add(mesh);
      this.proj[k] = mesh;
    }
  }

  buildPickups() {
    const coinGeo = merge([fcyl(0.14, 0.14, 0.035, 0xffd34a, at(0, 0, 0, Math.PI / 2, 0, 0), { n: 8, jitter: 0 })]);
    // Contact shadows under every character (the soft sun shadow alone washes out at golden hour).
    this.blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: blob(), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), 192);
    this.blobs.frustumCulled = false; this.blobs.renderOrder = 1; this.blobs.count = 0;
    this.scene.add(this.blobs);
    this.coins = new THREE.InstancedMesh(coinGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, metalness: 0.8, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.6 }), 512);
    this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coins.frustumCulled = false;
    this.scene.add(this.coins);
    this.snacks = new THREE.InstancedMesh(merge([fbox(0.3, 0.2, 0.3, 0xe8d8a0, at(0, 0, 0)), fcyl(0.01, 0.01, 0.35, 0xb08a60, at(0, 0.2, 0))]), facetMaterial(), 64);
    this.snacks.frustumCulled = false;
    this.scene.add(this.snacks);
    this.itemDrop = new THREE.Mesh(merge([fbox(0.6, 0.6, 0.6, 0xffd34a, at(0, 0, 0))]), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd34a).multiplyScalar(2) }));
    this.itemBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 30, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(this.itemDrop, this.itemBeam);
  }

  buildInteractables() {
    const its = this.game.city.interactables;
    this.inter = {};
    const byType = {};
    for (const it of its) (byType[it.type] = byType[it.type] || []).push(it);
    const q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), m4 = new THREE.Matrix4(), axis = new THREE.Vector3(0, 1, 0);
    for (const [type, list] of Object.entries(byType)) {
      const mesh = new THREE.InstancedMesh(interactableGeometry(type), facetMaterial(), list.length);
      list.forEach((it, i) => {
        // Model fronts face local -z; slots store the direction the front faces.
        q.setFromAxisAngle(axis, it.yaw + Math.PI);
        m4.compose(v.set(it.x, it.y, it.z), q, s);
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, new THREE.Color(1, 1, 1));
        it._mesh = mesh; it._i = i;
      });
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.inter[type] = mesh;
    }
    // Glowing screens / signs on shops that are still available (one glow mesh).
    const glowGeo = new THREE.PlaneGeometry(1, 1);
    this.shopGlow = new THREE.InstancedMesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }), its.length);
    const tint = { vending: 0xff5fd0, newsbox: 0xe8e4d0, locker: 0x6fd36a, lostfound: 0xff9a3c, callpanel: 0x33e0ff };
    const hgt = { vending: [1.85, 0.9, 0.28], newsbox: [1.12, 0.5, 0.14], locker: [2.32, 1.2, 0.3], lostfound: [1.15, 0.9, 0.2], callpanel: [1.2, 0.34, 0.4] };
    its.forEach((it, i) => {
      const [y, w, h] = hgt[it.type];
      q.setFromAxisAngle(axis, it.yaw);
      const off = { vending: 0.47, newsbox: 0.3, locker: 0.38, lostfound: 0.48, callpanel: 0.2 }[it.type];
      m4.compose(v.set(it.x + Math.sin(it.yaw) * off, it.y + y, it.z + Math.cos(it.yaw) * off), q, s.set(w, h, 1));
      this.shopGlow.setMatrixAt(i, m4);
      this.shopGlow.setColorAt(i, new THREE.Color(tint[it.type]).multiplyScalar(1.6));
    });
    s.set(1, 1, 1);
    this.scene.add(this.shopGlow);
  }

  buildNotices() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 320;
    const g = c.getContext('2d');
    g.fillStyle = '#ece4cf'; g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#2a2622'; g.textAlign = 'center';
    g.font = '900 34px system-ui, sans-serif'; g.fillText('NOTICE OF', 128, 62); g.fillText('VIOLATION', 128, 102);
    g.fillRect(30, 124, 196, 4);
    g.font = '700 24px system-ui, sans-serif'; g.fillText('SECTION 7.1', 128, 172); g.font = '600 22px system-ui, sans-serif'; g.fillText('COMMUNITY', 128, 222); g.fillText('STANDARDS', 128, 252);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.notices = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: true }), 64);
    this.notices.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.notices.frustumCulled = false;
    this.scene.add(this.notices);
  }

  update(dt) {
    const g = this.game;
    this.t += dt;
    this.fireT -= dt; this.throwT -= dt; this.spinT -= dt;
    this.updateDee(dt);
    for (const r of Object.values(this.rigs)) r.begin();
    let nn = 0;
    const m4 = this.m4, q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    const P = g.player;
    const playerHead = { x: P.pos.x, y: P.pos.y + 1.6, z: P.pos.z };
    for (const e of g.enemies) {
      if (!e.alive) continue;
      if (e.type === 'notice') {
        const p = e.body.pos;
        q.setFromEuler(new THREE.Euler(Math.sin(this.t * 5 + e.id) * 0.5, e.yaw, Math.cos(this.t * 4 + e.id) * 0.4));
        m4.compose(v.set(p.x, p.y, p.z), q, s);
        if (nn < 64) this.notices.setMatrixAt(nn++, m4);
        continue;
      }
      const rig = this.rigs[e.type];
      if (!rig) continue;
      const p = e.body.pos;
      const grow = Math.min(1, e.spawnT / 0.35);
      if (e.type === 'drone') {
        rootMatrix(p.x, p.y + Math.sin(this.t * 3 + e.id) * 0.15, p.z, e.yaw, 1.3, m4);
        rig.add(m4, { rotors: [0, this.t * 40, 0], body: [0.15 + (e._tilt || 0), 0, Math.sin(this.t * 2 + e.id) * 0.1] }, this.flashOf(e));
        e._tilt = (e._tilt || 0) * Math.exp(-6 * dt);
        continue;
      }
      const A = (e._anim = e._anim || new Animator(ANIM_OPTS[e.type] || {}));
      const sp = Math.hypot(e.body.vel.x, e.body.vel.z);
      const facePlayer = sp < 1.2 || e.telegraph > 0 || e.state === 'latched' || e.boss;
      const pose = animate(A, dt, {
        pos: p, vel: e.body.vel, onGround: e.body.onGround || e.type === 'scooter', climbing: e.climbing, world: g.world,
        aimYaw: e.yaw, face: facePlayer ? 'aim' : 'move', telegraph: e.telegraph, stunned: e.stunned > 0 && e.state !== 'crashed',
        lookAt: P.alive ? playerHead : null,
        overlay: M.OVERLAY[e.type],
        extra: { crashed: e.state === 'crashed', latched: e.state === 'latched', attack: e.state === 'notices' || e.state === 'drones' || e.state === 'gavel' ? e.state : null },
        cloth: M.CLOTH[e.type]?.length ? M.clothSpring(e, dt, e.body.vel, A.yaw ?? e.yaw, this.t + e.id, M.CLOTH[e.type]) : null,
      });
      const scale = (A.o.scale || 1) * (0.3 + 0.7 * grow);
      rootMatrix(p.x, p.y, p.z, A.yaw, scale, m4);
      rig.add(m4, pose, this.flashOf(e));
      e._lastRoot = m4.clone(); e._lastPose = pose;
    }
    // Ragdolls of the recently defeated.
    this.corpses = this.corpses.filter((c) => c.age < 6.5);
    for (const c of this.corpses) {
      c.age += dt;
      c.rd.step(dt);
      const mats = c.rd.matrices();
      if (c.age > 4.5) { const sink = (c.age - 4.5) * 0.45 * c.rd.scale; for (const m of mats) m.elements[13] -= sink; }
      c.rig.addWorld(mats, Math.max(0, 0.5 - c.age * 2));
    }
    for (const r of Object.values(this.rigs)) r.end();
    this.updateBlobs();
    this.notices.count = nn;
    this.notices.instanceMatrix.needsUpdate = true;
    this.updateProjectiles();
    this.updatePickups();
    this.updateInteractables();
  }

  updateBlobs() {
    const g = this.game, w = g.world, m4 = this.m4;
    let n = 0;
    const put = (p, r, onGround) => {
      if (n >= 192) return;
      // Airborne: project onto the ground below and shrink/fade with height.
      const gy = onGround ? p.y : w.groundBelow(p.x, p.y + 0.1, p.z, 0.05, 30);
      const h = Number.isFinite(gy) ? Math.max(0, p.y - gy) : 99;
      if (h > 12) return;
      const k = 1 / (1 + h * 0.25);
      m4.makeScale(r * 2.4 * k, 1, r * 2.4 * k).setPosition(p.x, (Number.isFinite(gy) ? gy : p.y) + 0.03, p.z);
      this.blobs.setMatrixAt(n++, m4);
    };
    const P = g.player;
    if (!P.dead) put(P.pos, 0.42, P.body.onGround);
    for (const e of g.enemies) if (e.alive && e.type !== 'notice' && !e.def.flies) put(e.pos, e.def.radius, e.body.onGround);
    this.blobs.count = n;
    this.blobs.instanceMatrix.needsUpdate = true;
  }

  // Full ragdoll from the entity's last rendered pose, pushed by the killing blow.
  spawnRagdoll(rig, root, pose, vel, impulse, scale) {
    if (!root || !pose) return;
    const mats = rig.compute(root, pose).map((m) => m.clone());
    this.corpses.push({ rig, rd: new Ragdoll(this.game.world, rig, mats, vel, impulse, scale), age: 0 });
    if (this.corpses.length > 14) this.corpses.shift();
  }

  // White flash: hits flash briefly; attack wind-ups pulse faster and brighter until the attack lands.
  flashOf(e) {
    const tele = e.telegraph > 0 ? e.telegraph * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.t * (12 + 28 * e.telegraph)))) : 0;
    return Math.min(1, Math.max(e.flash * 0.85, tele));
  }

  updateDee(dt) {
    const g = this.game;
    const P = g.player;
    const b = P.body;
    const A = this.deeAnim;
    // Look at the nearest enemy in front, else whatever shop she's next to.
    let look = null, bd = 22 * 22;
    const f = P.forward();
    for (const e of g.enemies) {
      if (!e.alive || e.minion) continue;
      const c = e.center();
      const dx = c.x - b.pos.x, dz = c.z - b.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < bd && dx * f.x + dz * f.z > -0.3 * Math.sqrt(d2)) { bd = d2; look = c; }
    }
    if (!look) { const it = g.economy.focus(P); if (it) look = { x: it.x, y: it.y + 1.2, z: it.z }; }
    const firing = this.fireT > 0 || P.aimT > 0; // aim stance while shooting and briefly after, relaxed otherwise
    const pose = animate(A, dt, {
      pos: b.pos, vel: b.vel, onGround: b.onGround, climbing: !!P.climbing, climbWall: P.climbing?.wall, crouch: P.crouch, vault: P.vault,
      aimYaw: P.yaw, aimPitch: P.pitch, face: firing || P.cart > 0 ? 'aim' : 'move', firing, world: g.world, lookAt: look,
      overlay: M.deeOverlay,
      extra: { throwT: Math.max(0, this.throwT / 0.35), spin: Math.max(0, this.spinT / 0.4), cart: P.cart > 0 },
      cloth: M.clothSpring(this, dt, b.vel, A.yaw ?? P.yaw, this.t, M.CLOTH.dee),
    });
    // GTA-style: the dart only appears in her hand while she's in the aim stance (or mid-throw).
    this.dartK = (this.dartK ?? 0) + ((firing || this.throwT > 0 ? 1 : 0) - (this.dartK ?? 0)) * Math.min(1, 14 * dt);
    pose.dart = { r: [0, 0, 0], s: Math.max(0.001, this.dartK) };
    this.dee.begin();
    const hidden = this.view.rig.cur < 1.1; // camera jammed against her: don't fill the screen with scrubs
    if (!P.dead && !hidden) {
      rootMatrix(b.pos.x, b.pos.y + (P.cart > 0 ? 0.35 : 0), b.pos.z, A.yaw, 1, this.m4);
      this.dee.add(this.m4, pose, P.invuln > 0 ? 0.25 : 0);
      this.deeLast = { root: this.m4.clone(), pose };
    }
    this.deeYaw = A.yaw;
    if (this.deeCorpse) { this.deeCorpse.step(dt); this.dee.addWorld(this.deeCorpse.matrices(), 0); }
    this.dee.end();
    this.cart.visible = P.cart > 0;
    if (this.cart.visible) { this.cart.position.set(b.pos.x, b.pos.y - 0.05, b.pos.z); this.cart.rotation.y = A.yaw; }
  }

  updateProjectiles() {
    const counts = {};
    for (const k in this.proj) counts[k] = 0;
    const m4 = this.m4, q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), fwd = new THREE.Vector3(0, 0, 1);
    for (const p of this.game.projectiles.list) {
      if (!p.alive) continue;
      const mesh = this.proj[p.kind];
      if (!mesh) continue;
      const d = v.set(p.vel.x, p.vel.y, p.vel.z);
      if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
      d.normalize();
      if (p.kind === 'syringe') q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.multiplyScalar(-1));
      else q.setFromUnitVectors(fwd, d);
      if (p.kind === 'clipboard') q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.t * 25));
      if (p.kind === 'wave') { q.setFromUnitVectors(fwd, d); s.setScalar(p.r); } else s.setScalar(1);
      m4.compose(new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z), q, s);
      mesh.setMatrixAt(counts[p.kind]++, m4);
    }
    for (const k in this.proj) { this.proj[k].count = counts[k]; this.proj[k].instanceMatrix.needsUpdate = true; }
  }

  updatePickups() {
    let nc = 0, ns = 0;
    const m4 = this.m4, q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), axis = new THREE.Vector3(0, 1, 0);
    let item = null;
    for (const k of this.game.pickups.list) {
      q.setFromAxisAngle(axis, this.t * 6 + k.id);
      m4.compose(v.set(k.pos.x, k.pos.y + Math.sin(this.t * 4 + k.id) * 0.05, k.pos.z), q, s);
      if (k.kind === 'coin' && nc < 512) this.coins.setMatrixAt(nc++, m4);
      else if (k.kind === 'snack' && ns < 64) this.snacks.setMatrixAt(ns++, m4);
      else if (k.kind === 'item') item = k;
    }
    this.coins.count = nc; this.coins.instanceMatrix.needsUpdate = true;
    this.snacks.count = ns; this.snacks.instanceMatrix.needsUpdate = true;
    this.itemDrop.visible = this.itemBeam.visible = !!item;
    if (item) {
      this.itemDrop.position.set(item.pos.x, item.pos.y + 0.5 + Math.sin(this.t * 3) * 0.2, item.pos.z);
      this.itemDrop.rotation.set(this.t, this.t * 1.3, 0);
      this.itemBeam.position.set(item.pos.x, item.pos.y + 15, item.pos.z);
    }
  }

  updateInteractables() {
    const its = this.game.city.interactables;
    let dirty = false;
    for (const it of its) {
      if (it.used && !it._shownUsed && it.type !== 'callpanel') {
        it._shownUsed = true;
        it._mesh.setColorAt(it._i, new THREE.Color(0.38, 0.36, 0.4));
        it._mesh.instanceColor.needsUpdate = true;
        this.shopGlow.setColorAt(its.indexOf(it), new THREE.Color(0.05, 0.05, 0.06));
        dirty = true;
      }
    }
    // The call panel pulses until used; the station doors glow brighter as the train approaches.
    const panelIdx = its.findIndex((i) => i.type === 'callpanel');
    if (panelIdx >= 0) {
      const ex = this.game.exit;
      const k = ex.state === 'idle' ? 1 + 0.6 * Math.sin(this.t * 4) : ex.state === 'arrived' ? 2.4 : 0.8;
      this.shopGlow.setColorAt(panelIdx, new THREE.Color(0x33e0ff).multiplyScalar(k));
      dirty = true;
    }
    if (dirty) this.shopGlow.instanceColor.needsUpdate = true;
  }

  dispose() {
    for (const o of this.off) o();
  }
}
