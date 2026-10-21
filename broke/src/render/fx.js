// Visual effects driven by sim events: faceted shard particles, shockwave rings, lightning arcs, steam, damage
// numbers and enemy barks (DOM, projected), camera shake.

import * as THREE from 'three';
import { fcone, merge, at } from './facet.js';

const MAXP = 900;

export class Fx {
  constructor(scene, game, view) {
    this.scene = scene; this.game = game; this.view = view;
    this.t = 0;
    // Particles: one instanced mesh of little faceted shards.
    const geo = merge([fcone(0.5, 1, 0xffffff, at(0, 0, 0), { n: 3, jitter: 0.1 })]);
    this.pMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, transparent: true, depthWrite: false });
    this.pMesh = new THREE.InstancedMesh(geo, this.pMat, MAXP);
    this.pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pMesh.frustumCulled = false;
    this.pMesh.count = 0;
    scene.add(this.pMesh);
    this.parts = [];
    // Rings (shockwaves, explosions, cone blasts).
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 40, 1).rotateX(-Math.PI / 2);
    // Lightning arcs.
    this.bolts = [];
    // Gunfire: tracer streaks and a muzzle flash (a short-lived light plus a bright star).
    this.tracers = [];
    this.flash = new THREE.PointLight(0xffc27a, 0, 9, 1.6);
    scene.add(this.flash);
    this.flashStar = new THREE.Mesh(merge([fcone(0.09, 0.42, 0xffffff, at(0, 0, 0, Math.PI / 2, 0, 0), { n: 5, jitter: 0 })]), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flashStar.visible = false;
    scene.add(this.flashStar);
    this.flashT = 0;
    // DOM layer for numbers and barks.
    this.layer = document.getElementById('fx-layer');
    this.nums = [];
    this.barks = new Map();
    this.steamSpots = game.city.kit.lights.filter((l) => l.kind === 'steam');
    this.steamT = 0;
    this.marker = new THREE.Mesh(new THREE.RingGeometry(6.4, 7, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5ff5e0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.marker.visible = false;
    scene.add(this.marker);
    this.pizza = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6fd36a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.pizza.visible = false;
    scene.add(this.pizza);
    const E = game.events;
    this.off = [
      E.on('hit', (d) => this.onHit(d)),
      E.on('kill', (d) => this.burst(d.pos, d.boss ? 80 : d.type === 'notice' ? 8 : 26, d.type === 'notice' ? 0xece4cf : KILL_COL[d.type] || 0x8a8070, d.boss ? 14 : 7)),
      E.on('explosion', (d) => { this.ring(d.pos, d.radius, 0xffa34d, 0.45); this.burst(d.pos, 30, 0xffb060, 9); this.shake(d.pos, 0.35); }),
      E.on('gavelSlam', (d) => this.ring(d.pos, d.radius, 0xffd34a, 0.5)),
      E.on('bossSlam', (d) => { this.ring(d.pos, 16, 0xffffff, 0.8, true); this.burst({ ...d.pos, y: d.pos.y + 0.3 }, 60, 0x9a9488, 10); this.view.rig.addShake(0.9); }),
      E.on('lightning', (d) => this.bolt(d.pts)),
      E.on('shot', (d) => this.gunshot(d)),
      E.on('impact', (d) => this.burst(d.pos, d.kind === 'syringe' ? 5 : 8, d.kind === 'syringe' ? 0x7cf5e4 : d.kind === 'notice' ? 0xece4cf : 0xdddddd, 4)),
      E.on('crash', (d) => { this.burst(d.pos, 18, 0x8a8682, 6); this.ring(d.pos, 2.5, 0xffffff, 0.3); }),
      E.on('playerHurt', (d) => { this.view.rig.addShake(Math.min(0.6, 0.15 + d.amount / 40)); }),
      E.on('bark', (d) => this.bark(d)),
      E.on('ability', (d) => {
        if (d.kind === 'salsa') { this.burst({ x: d.from.x, y: d.from.y + 1, z: d.from.z }, 16, 0x1fa89a, 5); this.burst({ x: d.to.x, y: d.to.y + 1, z: d.to.z }, 12, 0x5ff5e0, 4); }
        if (d.kind === 'codeblue') { this.marker.position.set(d.at.x, d.at.y + 0.06, d.at.z); this.marker.visible = true; this.markerT = 2.6; }
      }),
      E.on('equipment', (d) => { const P = game.player; if (d.id === 'airhorn') { this.ring({ x: P.pos.x, y: P.pos.y + 0.2, z: P.pos.z }, 14, 0xff9a3c, 0.4); this.view.rig.addShake(0.4); } }),
      E.on('pickup', (d) => { if (d.kind === 'coin') this.burst({ ...game.player.pos, y: game.player.pos.y + 1.1 }, 2, 0xffd34a, 2); }),
      E.on('pizza', (d) => { this.pizza.position.set(d.x, d.y + 0.05, d.z); this.pizza.scale.setScalar(d.r); }),
      E.on('cite', (d) => this.number(d.pos, 'CITED', 'cite')),
      E.on('blocked', () => this.number(this.headPos(), 'BLOCKED', 'block')),
      E.on('dodged', () => this.number(this.headPos(), 'DODGED', 'block')),
      E.on('stun', (d) => { const e = game.enemies.find((x) => x.id === d.id); if (e) this.number(e.center(), 'STUNNED', 'cite'); }),
    ];
  }

  headPos() { const p = this.game.player.pos; return { x: p.x, y: p.y + 2.1, z: p.z }; }

  onHit(d) {
    const head = d.part === 'head' && d.source === 'revolver';
    if (d.source !== 'burn' || Math.random() < 0.25) this.number(d.pos, Math.max(1, Math.round(d.amount)), d.crit || head ? 'crit' : d.source === 'burn' ? 'burn' : d.part === 'phone' ? 'crit' : '');
    this.burst(d.pos, d.crit || head ? 8 : 4, d.source === 'burn' ? 0xff7a2a : d.source === 'revolver' ? 0x8a2a24 : 0xffffff, d.crit || head ? 6 : 4);
  }

  burst(pos, n, color, speed) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && this.parts.length < MAXP; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u);
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * r * sp, vy: u * sp + speed * 0.4, vz: Math.sin(a) * r * sp, life: 0.4 + Math.random() * 0.5, age: 0, size: 0.08 + Math.random() * 0.14, c, rot: Math.random() * 6, g: 14 });
    }
  }

  ring(pos, radius, color, dur, ground) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(pos.x, pos.y + (ground ? 0.15 : 0.5), pos.z);
    this.scene.add(m);
    this.rings.push({ m, radius, dur, age: 0 });
  }

  bolt(pts) {
    const v = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      let prev = new THREE.Vector3(a.x, a.y, a.z);
      for (let k = 1; k <= 6; k++) {
        const t = k / 6;
        const p = new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
        if (k < 6) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8));
        v.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
        prev = p;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(0x9fd8ff).multiplyScalar(3), transparent: true }));
    this.scene.add(line);
    this.bolts.push({ line, age: 0 });
  }

  // A revolver shot: tracer from the muzzle to where it landed, a flash at the muzzle, a puff of smoke.
  gunshot(d) {
    const a = d.from, b = d.to;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z], 3));
    const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(0xffe2b0).multiplyScalar(2.2), transparent: true, depthWrite: false }));
    this.scene.add(line);
    this.tracers.push({ line, age: 0 });
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l = Math.hypot(dx, dy, dz) || 1;
    this.flash.position.set(a.x + (dx / l) * 0.15, a.y + (dy / l) * 0.15, a.z + (dz / l) * 0.15);
    this.flashStar.position.copy(this.flash.position);
    this.flashStar.lookAt(a.x + dx, a.y + dy, a.z + dz);
    this.flashStar.rotateZ(Math.random() * Math.PI);
    this.flashT = 0.06;
    for (let i = 0; i < 3; i++) this.parts.push({ x: a.x + (dx / l) * 0.3, y: a.y + (dy / l) * 0.3, z: a.z + (dz / l) * 0.3, vx: (dx / l) * 1.2 + (Math.random() - 0.5), vy: 0.6 + Math.random() * 0.5, vz: (dz / l) * 1.2 + (Math.random() - 0.5), life: 0.5 + Math.random() * 0.3, age: 0, size: 0.07 + Math.random() * 0.06, c: new THREE.Color(0xbdb8b0), rot: Math.random() * 6, g: -0.5 });
  }

  shake(pos, k) {
    const P = this.game.player.pos;
    const d = Math.hypot(pos.x - P.x, pos.z - P.z);
    if (d < 25) this.view.rig.addShake(k * (1 - d / 25));
  }

  number(pos, text, cls) {
    if (!this.layer) return;
    const el = document.createElement('div');
    el.className = `dmg ${cls || ''}`;
    el.textContent = text;
    this.layer.appendChild(el);
    this.nums.push({ el, x: pos.x + (Math.random() - 0.5) * 0.5, y: pos.y + 0.3, z: pos.z + (Math.random() - 0.5) * 0.5, age: 0 });
    if (this.nums.length > 40) { const o = this.nums.shift(); o.el.remove(); }
  }

  bark(d) {
    if (!this.layer) return;
    const e = this.game.enemies.find((x) => x.id === d.id);
    if (!e) return;
    const P = this.game.player.pos;
    if (Math.hypot(e.pos.x - P.x, e.pos.z - P.z) > 45) return;
    let b = this.barks.get(d.id);
    if (!b) {
      const el = document.createElement('div');
      el.className = `bark ${e.boss ? 'boss' : ''}`;
      this.layer.appendChild(el);
      b = { el, e };
      this.barks.set(d.id, b);
    }
    b.el.textContent = d.text;
    b.w = 0;
    b.age = 0;
    b.life = e.boss ? 2.8 : 2.2;
  }

  update(dt) {
    this.t += dt;
    const cam = this.view.camera;
    // Particles.
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
    let n = 0;
    this.parts = this.parts.filter((p) => (p.age += dt) < p.life);
    for (const p of this.parts) {
      p.vy -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += dt * 8;
      const k = 1 - p.age / p.life;
      e.set(p.rot, p.rot * 0.7, 0);
      q.setFromEuler(e);
      m4.compose(v.set(p.x, p.y, p.z), q, s.setScalar(p.size * (0.4 + 0.6 * k)));
      this.pMesh.setMatrixAt(n, m4);
      this.pMesh.setColorAt(n, p.c);
      n++;
    }
    this.pMesh.count = n;
    this.pMesh.instanceMatrix.needsUpdate = true;
    if (this.pMesh.instanceColor) this.pMesh.instanceColor.needsUpdate = true;
    // Steam from nearby grates.
    this.steamT -= dt;
    if (this.steamT <= 0) {
      this.steamT = 0.12;
      const P = this.game.player.pos;
      for (const s0 of this.steamSpots) {
        if (Math.abs(s0.x - P.x) > 50 || Math.abs(s0.z - P.z) > 50) continue;
        if (this.parts.length < MAXP - 50) this.parts.push({ x: s0.x + (Math.random() - 0.5), y: 0.2, z: s0.z + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 0.4, vy: 1.6 + Math.random(), vz: (Math.random() - 0.5) * 0.4, life: 1.8, age: 0, size: 0.35 + Math.random() * 0.3, c: STEAM, rot: Math.random() * 6, g: -0.3 });
      }
    }
    // Rings.
    this.rings = this.rings.filter((r) => {
      r.age += dt;
      const k = r.age / r.dur;
      r.m.scale.setScalar(Math.max(0.01, r.radius * Math.min(1, k * 1.1)));
      r.m.material.opacity = 0.85 * (1 - k);
      if (k >= 1) { this.scene.remove(r.m); r.m.material.dispose(); return false; }
      return true;
    });
    this.tracers = this.tracers.filter((b) => {
      b.age += dt;
      b.line.material.opacity = Math.max(0, 1 - b.age / 0.07);
      if (b.age > 0.07) { this.scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); return false; }
      return true;
    });
    this.flashT -= dt;
    this.flash.intensity = this.flashT > 0 ? 40 * (this.flashT / 0.06) : 0;
    this.flashStar.visible = this.flashT > 0;
    if (this.flashStar.visible) this.flashStar.scale.setScalar(0.6 + 0.6 * (this.flashT / 0.06));
    this.bolts = this.bolts.filter((b) => {
      b.age += dt;
      b.line.material.opacity = 1 - b.age / 0.25;
      if (b.age > 0.25) { this.scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); return false; }
      return true;
    });
    if (this.markerT > 0) { this.markerT -= dt; this.marker.material.opacity = 0.35 + 0.35 * Math.sin(this.t * 20); if (this.markerT <= 0) this.marker.visible = false; }
    const pz = this.game.player.pizzaZone;
    this.pizza.visible = !!pz;
    // DOM overlays.
    const w = window.innerWidth, h = window.innerHeight;
    const proj = (x, y, z) => { v.set(x, y, z).project(cam); return v.z < 1 ? { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h } : null; };
    this.nums = this.nums.filter((d) => {
      d.age += dt;
      if (d.age > 0.9) { d.el.remove(); return false; }
      const p = proj(d.x, d.y + d.age * 1.4, d.z);
      if (!p) { d.el.style.opacity = 0; return true; }
      d.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${d.age < 0.08 ? 1.4 : 1})`;
      d.el.style.opacity = d.age > 0.6 ? (0.9 - d.age) / 0.3 : 1;
      return true;
    });
    // Barks stack upward instead of overlapping when speakers stand close together on screen.
    const placed = [];
    for (const [id, b] of this.barks) {
      b.age += dt;
      if (b.age > b.life || !b.e.alive) { b.el.remove(); this.barks.delete(id); continue; }
      const c = b.e.center();
      const p = proj(c.x, b.e.pos.y + b.e.body.h * (b.e.boss ? 1.15 : 1.25) + 0.5, c.z);
      if (!p) { b.el.style.opacity = 0; continue; }
      const w = (b.w ||= b.el.offsetWidth || 120);
      for (let k = 0; k < 6 && placed.some((q) => Math.abs(q.x - p.x) < (q.w + w) / 2 && Math.abs(q.y - p.y) < 26); k++) p.y -= 28;
      placed.push({ x: p.x, y: p.y, w });
      b.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      b.el.style.opacity = b.age > b.life - 0.3 ? (b.life - b.age) / 0.3 : 1;
    }
  }

  dispose() {
    for (const o of this.off) o();
    for (const d of this.nums) d.el.remove();
    for (const b of this.barks.values()) b.el.remove();
    this.nums = []; this.barks.clear();
  }
}

const STEAM = new THREE.Color(0x8a8aa0);
const KILL_COL = { speakerphone: 0xb04a3c, scooter: 0x2f6fbf, canvasser: 0xe0a922, hoa: 0x837f5d, drone: 0x6a6a5a };
