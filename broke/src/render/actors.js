// Mirrors sim entities into the scene every frame: Dee, enemies (instanced rigs), the boss, drones, notices,
// projectiles, pickups and interactables. Reads sim state only; never writes to it.

import * as THREE from 'three';
import { RigType, rootMatrix } from './rig.js';
import { facetMaterial, fbox, fcyl, fball, merge, at } from './facet.js';
import * as M from './models/characters.js';
import { interactableGeometry } from './models/props.js';
import { angleDiff } from '../core/math.js';

const POSE = { speakerphone: M.speakerphonePose, scooter: M.scooterPose, canvasser: M.canvasserPose, hoa: M.hoaPose };

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
    this.off = [
      game.events.on('ability', (a) => {
        if (a.slot === 'primary') this.fireT = 0.3;
        if (a.slot === 'secondary') this.throwT = 0.35;
        if (a.slot === 'utility') this.spinT = 0.4;
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
      const scale = (e.type === 'hoa' ? 3.05 : 1) * (0.3 + 0.7 * grow);
      if (e.type === 'drone') {
        rootMatrix(p.x, p.y + Math.sin(this.t * 3 + e.id) * 0.15, p.z, e.yaw, 1.3, m4);
        rig.add(m4, { rotors: [0, this.t * 40, 0], body: [0.15, 0, Math.sin(this.t * 2 + e.id) * 0.1] }, this.flashOf(e));
        continue;
      }
      // Smooth yaw for rendering.
      e._ry = e._ry == null ? e.yaw : e._ry + angleDiff(e._ry, e.yaw) * Math.min(1, dt * 12);
      const sp = Math.hypot(e.body.vel.x, e.body.vel.z);
      const st = {
        phase: e.anim * (e.type === 'hoa' ? 0.9 : 2.6), speed: Math.min(1, sp / 7), air: !e.body.onGround && !e.climbing && e.type !== 'scooter',
        climb: e.climbing, t: this.t + e.id, windup: e.telegraph, stun: e.stunned, crashed: e.state === 'crashed', latched: e.state === 'latched',
        attack: e.state === 'notices' || e.state === 'drones' || e.state === 'gavel' ? e.state : null,
        cloth: M.CLOTH[e.type]?.length ? M.clothSpring(e, dt, e.body.vel, e._ry, this.t + e.id, M.CLOTH[e.type]) : null,
      };
      rootMatrix(p.x, p.y, p.z, e._ry, scale, m4);
      rig.add(m4, (POSE[e.type] || M.speakerphonePose)(st), this.flashOf(e));
    }
    for (const r of Object.values(this.rigs)) r.end();
    this.notices.count = nn;
    this.notices.instanceMatrix.needsUpdate = true;
    this.updateProjectiles();
    this.updatePickups();
    this.updateInteractables();
  }

  // White flash: hits flash briefly; attack wind-ups pulse faster and brighter until the attack lands.
  flashOf(e) {
    const tele = e.telegraph > 0 ? e.telegraph * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.t * (12 + 28 * e.telegraph)))) : 0;
    return Math.min(1, Math.max(e.flash * 0.85, tele));
  }

  updateDee(dt) {
    const P = this.game.player;
    const b = P.body;
    const hs = Math.hypot(b.vel.x, b.vel.z);
    this.deePhase += hs * dt * 1.25;
    // Face the camera direction when shooting or standing; otherwise face where she's running.
    let want = P.yaw;
    if (hs > 1 && this.fireT <= 0 && !P.climbing) want = Math.atan2(-b.vel.x, -b.vel.z);
    if (P.climbing && P.climbing.wall) want = Math.atan2(-P.climbing.wall.x, -P.climbing.wall.z);
    this.deeYaw += angleDiff(this.deeYaw, want) * Math.min(1, dt * 14);
    const pose = M.deePose({
      phase: this.deePhase, speed: Math.min(1, hs / 10), air: !b.onGround && !P.climbing, climb: !!P.climbing, t: this.t,
      firing: this.fireT > 0, pitch: P.pitch, throwT: Math.max(0, this.throwT / 0.35), spin: Math.max(0, this.spinT / 0.4),
      cloth: M.clothSpring(this, dt, b.vel, this.deeYaw, this.t, M.CLOTH.dee),
    });
    if (P.cart > 0) { pose.legL = [0.2, 0, 0]; pose.legR = [-0.1, 0, 0]; pose.armL = [1.3, 0, 0]; pose.armR = [1.3, 0, 0]; pose.foreL = [0.2, 0, 0]; pose.foreR = [0.2, 0, 0]; pose.torso = [-0.35, 0, 0]; }
    this.dee.begin();
    const hidden = this.view.rig.cur < 1.1; // camera jammed against her: don't fill the screen with scrubs
    if (!P.dead && !hidden) {
      rootMatrix(b.pos.x, b.pos.y + (P.cart > 0 ? 0.35 : 0), b.pos.z, this.deeYaw, 1, this.m4);
      this.dee.add(this.m4, pose, P.invuln > 0 ? 0.25 : 0);
    }
    this.dee.end();
    this.cart.visible = P.cart > 0;
    if (this.cart.visible) { this.cart.position.set(b.pos.x, b.pos.y - 0.05, b.pos.z); this.cart.rotation.y = this.deeYaw; }
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
