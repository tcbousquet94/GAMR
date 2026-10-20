import * as THREE from 'three';
import { basic, geo } from '../core/materials.js';
import { STATUS } from '../core/config.js';

// Damage, melee sweeps, pooled projectiles, area blasts, hitstop and cheap hit VFX.

const CRIT_CHANCE = 0.1;
const CRIT_MUL = 1.6;
const HITSTOP_MELEE = 0.06;
const KB_DAMP = 8;

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qz = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _col = new THREE.Color();

const SPARK_MAX = 160;
const RING_MAX = 6;
const SPARK_COLORS = [0xffffff, 0xfff27a, 0xffd23f, 0xff8fbf, 0x9fe0ff];

function starGeometry() {
  const shape = new THREE.Shape();
  const pts = 5;
  for (let i = 0; i <= pts * 2; i++) {
    const r = i % 2 === 0 ? 1 : 0.45;
    const a = (i / (pts * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  return new THREE.ShapeGeometry(shape);
}

export class Combat {
  constructor(game) {
    this.game = game;
    this.hitstopLeft = 0;

    // ---- projectile pool ----
    this.projectiles = [];

    // ---- spark particles: one InstancedMesh, one draw call ----
    const sparkGeo = geo('combat.star', starGeometry);
    this.sparkMesh = new THREE.InstancedMesh(
      sparkGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthWrite: false, transparent: true }),
      SPARK_MAX,
    );
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.renderOrder = 5;
    this.sparks = [];
    for (let i = 0; i < SPARK_MAX; i++) {
      this.sparks.push({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 0.2, spin: 0, rot: 0, gravity: 0 });
      _m4.makeScale(0, 0, 0);
      this.sparkMesh.setMatrixAt(i, _m4);
      this.sparkMesh.setColorAt(i, _col.set(0xffffff));
    }
    this.sparkCursor = 0;
    this.sparkActive = 0;
    this.sparkMesh.count = SPARK_MAX;
    game.scene.add(this.sparkMesh);

    // ---- AoE rings ----
    const ringGeo = geo('combat.ring', () => new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2));
    this.rings = [];
    for (let i = 0; i < RING_MAX; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 4;
      game.scene.add(mesh);
      this.rings.push({ mesh, t: 0, dur: 0.35, radius: 1, active: false });
    }
  }

  // ---------------------------------------------------------------- core API

  opponentsOf(c) {
    const out = [];
    for (const o of this.game.combatants) if (o.alive && o.team !== c.team) out.push(o);
    return out;
  }

  dealDamage(source, target, amount, { knockback = 4, text = null, crit = false, melee = false } = {}) {
    if (!target || !target.alive || target.invulnerable) return 0;
    const game = this.game;
    let dmg = amount * (source?.status?.attackScale?.() ?? 1);
    const heroSource = source?.team === 'hero';
    if (!crit && heroSource && Math.random() < CRIT_CHANCE) crit = true;
    if (crit) {
      dmg *= CRIT_MUL;
      text = 'SMAAAASH!!';
    }
    dmg = Math.max(1, Math.round(dmg));

    // Knockback along source -> target (XZ)
    if (knockback && source?.object3d && target.knockback) {
      const sp = source.object3d.position, tp = target.object3d.position;
      let dx = tp.x - sp.x, dz = tp.z - sp.z;
      const len = Math.hypot(dx, dz);
      if (len > 1e-4) { dx /= len; dz /= len; } else { dx = Math.sin(source.object3d.rotation.y); dz = Math.cos(source.object3d.rotation.y); }
      const k = knockback * (crit ? 1.4 : 1);
      target.knockback.x += dx * k;
      target.knockback.z += dz * k;
    }

    target.hp = Math.max(0, target.hp - dmg);
    target.onHit?.({ source, amount: dmg, crit });
    game.events.emit('damage', { source, target, amount: dmg, crit, text });
    game.events.emit('sfx', { name: crit ? 'smash' : 'hit' });

    // VFX
    const tp = target.object3d.position;
    _v1.set(tp.x, tp.y + (target.height || 1.6) * 0.55, tp.z);
    if (source?.object3d) {
      // nudge the spark toward the attacker so it sits on the body surface
      _v2.copy(source.object3d.position).sub(tp).setY(0);
      if (_v2.lengthSq() > 1e-4) _v1.addScaledVector(_v2.normalize(), (target.radius || 0.5) * 0.8);
    }
    this.spawnSparks(_v1, { count: crit ? 12 : 6, speed: crit ? 7 : 5, size: crit ? 0.32 : 0.22 });
    if (crit) this.spawnRing(_v1.setY(tp.y + 0.05), 2.2, 0xfff27a, 0.3);

    if (heroSource && melee) this.hitstop(crit ? HITSTOP_MELEE * 1.8 : HITSTOP_MELEE);
    if (heroSource) game.cameraRig?.shake?.(crit ? 0.45 : 0.15);
    else if (target.team === 'hero') game.cameraRig?.shake?.(target === game.player ? 0.3 : 0.1);

    if (target.hp <= 0) {
      target.alive = false;
      target.onDefeat?.({ source });
      game.events.emit('defeat', { target, source });
    }
    return dmg;
  }

  heal(target, amount, text = null) {
    if (!target || !target.alive) return 0;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const healed = Math.round(target.hp - before);
    this.game.events.emit('heal', { target, amount: healed, text });
    const p = target.object3d.position;
    _v1.set(p.x, p.y + (target.height || 1.6) * 0.6, p.z);
    this.spawnSparks(_v1, { count: 6, speed: 2.5, size: 0.18, color: 0x7fe05a, gravity: -4 });
    return healed;
  }

  applyStatus(target, name, duration) {
    if (!target || !target.alive || !target.status) return;
    target.status.add(name, duration ?? STATUS[name]?.defaultDuration);
  }

  meleeSweep(attacker, { range = 2, arc = Math.PI / 2, damage = 10, knockback = 4, text = null, status = null, crit = false } = {}) {
    const hits = [];
    const ap = attacker.object3d.position;
    const yaw = attacker.object3d.rotation.y;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const half = arc * 0.5;
    const pointBlank = (attacker.radius || 0.5) + 0.45;
    for (const c of this.game.combatants) {
      if (!c.alive || c.team === attacker.team || c === attacker) continue;
      const p = c.object3d.position;
      if (Math.abs(p.y - ap.y) > Math.max(c.height || 1.6, attacker.height || 1.6) + 0.5) continue;
      const dx = p.x - ap.x, dz = p.z - ap.z;
      const d = Math.hypot(dx, dz);
      const r = c.radius || 0.5;
      if (d > range + r) continue;
      if (d > pointBlank + r * 0.5) {
        const cos = (dx * fx + dz * fz) / d;
        // widen the arc a bit for fat targets
        const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
        if (angle > half + Math.atan2(r, d)) continue;
      }
      hits.push(c);
    }
    for (const c of hits) {
      const dealt = this.dealDamage(attacker, c, damage, { knockback, text, crit, melee: true });
      if (dealt > 0 && status) this.applyStatus(c, status.name, status.duration);
    }
    return hits;
  }

  spawnProjectile({ owner, position, direction, speed = 12, damage = 8, radius = 0.4, color = 0xfff27a, life = 2,
    homing = null, status = null, text = null, mesh = null, knockback = 3 } = {}) {
    let p = null;
    for (const q of this.projectiles) if (!q.active) { p = q; break; }
    if (!p) {
      p = {
        active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), defaultMesh: null, mesh: null,
        owner: null, damage: 0, radius: 0.4, life: 0, age: 0, homing: null, turn: 3, status: null, text: null,
        knockback: 3, speed: 0, custom: false, spin: 0,
      };
      this.projectiles.push(p);
    }
    p.active = true;
    p.owner = owner;
    p.pos.copy(position);
    p.vel.copy(direction).normalize().multiplyScalar(speed);
    p.speed = speed;
    p.damage = damage;
    p.radius = radius;
    p.life = life;
    p.age = 0;
    p.status = status;
    p.text = text;
    p.knockback = knockback;
    p.spin = (Math.random() - 0.5) * 8;
    if (homing && homing.object3d) { p.homing = homing; p.turn = 3; }
    else if (homing && homing.target) { p.homing = homing.target; p.turn = homing.turnRate ?? 3; }
    else p.homing = null;

    if (mesh) {
      p.custom = true;
      p.mesh = mesh;
    } else {
      p.custom = false;
      if (!p.defaultMesh) {
        const g = new THREE.Group();
        const core = new THREE.Mesh(geo('combat.projCore', () => new THREE.SphereGeometry(0.55, 12, 10)), basic(0xffffff));
        const halo = new THREE.Mesh(geo('combat.projHalo', () => new THREE.SphereGeometry(1, 14, 10)), basic(0xffffff));
        halo.renderOrder = 3;
        g.add(core, halo);
        g.userData.halo = halo;
        p.defaultMesh = g;
      }
      p.mesh = p.defaultMesh;
      p.mesh.userData.halo.material = basic(color, { transparent: true, opacity: 0.5 });
      p.mesh.scale.setScalar(radius);
    }
    p.mesh.position.copy(p.pos);
    p.mesh.visible = true;
    this.game.scene.add(p.mesh);
    return p;
  }

  areaBlast({ owner, position, radius = 4, damage = 10, knockback = 6, status = null, text = null, color = 0xff8fbf } = {}) {
    const hits = [];
    for (const c of this.game.combatants) {
      if (!c.alive || (owner && c.team === owner.team)) continue;
      const p = c.object3d.position;
      const d = Math.hypot(p.x - position.x, p.z - position.z);
      if (d > radius + (c.radius || 0.5) || Math.abs(p.y - position.y) > radius) continue;
      hits.push(c);
    }
    for (const c of hits) {
      const dealt = this.dealDamage(owner, c, damage, { knockback, text });
      if (dealt > 0 && status) this.applyStatus(c, status.name, status.duration);
    }
    _v1.copy(position);
    _v1.y = (this.game.world?.getGroundHeight?.(position.x, position.z) ?? position.y) + 0.08;
    this.spawnRing(_v1, radius, color, 0.4);
    _v1.y += 0.15;
    this.spawnRing(_v1, radius * 0.7, 0xffffff, 0.3);
    _v1.y += 0.8;
    this.spawnSparks(_v1, { count: 10, speed: radius * 2, size: 0.3, color, gravity: 6 });
    return hits;
  }

  hitstop(seconds) {
    this.hitstopLeft = Math.max(this.hitstopLeft, seconds);
    this.game.timeScale = 0.05;
  }

  // ---------------------------------------------------------------- VFX (extra API)

  // Small star burst. opts: { count, speed, size, color, gravity, life }
  spawnSparks(position, { count = 6, speed = 5, size = 0.22, color = null, gravity = 9, life = 0.35 } = {}) {
    for (let i = 0; i < count; i++) {
      const s = this.sparks[this.sparkCursor];
      const idx = this.sparkCursor;
      this.sparkCursor = (this.sparkCursor + 1) % SPARK_MAX;
      if (s.life <= 0) this.sparkActive++;
      s.pos.copy(position);
      // random direction, biased upward
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.1;
      const h = Math.sqrt(1 - up * up);
      const sp = speed * (0.6 + Math.random() * 0.6);
      s.vel.set(Math.cos(a) * h * sp, up * sp, Math.sin(a) * h * sp);
      s.max = s.life = life * (0.7 + Math.random() * 0.6);
      s.size = size * (0.7 + Math.random() * 0.6);
      s.rot = Math.random() * Math.PI;
      s.spin = (Math.random() - 0.5) * 14;
      s.gravity = gravity;
      this.sparkMesh.setColorAt(idx, _col.set(color ?? SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0]));
    }
    this.sparkMesh.instanceColor.needsUpdate = true;
  }

  // Big white poof (enemy death / spawn).
  spawnPoof(position, scale = 1) {
    this.spawnSparks(position, { count: 10, speed: 4 * scale, size: 0.35 * scale, color: 0xffffff, gravity: 2, life: 0.5 });
    this.spawnSparks(position, { count: 4, speed: 3 * scale, size: 0.25 * scale, gravity: 2, life: 0.45 });
    _v2.copy(position);
    _v2.y = (this.game.world?.getGroundHeight?.(position.x, position.z) ?? 0) + 0.06;
    this.spawnRing(_v2, 1.6 * scale, 0xffffff, 0.3);
  }

  spawnRing(position, radius, color = 0xffffff, dur = 0.35) {
    let r = this.rings[0];
    for (const q of this.rings) { if (!q.active) { r = q; break; } if (q.t > r.t) r = q; }
    r.active = true;
    r.t = 0;
    r.dur = dur;
    r.radius = radius;
    r.mesh.position.copy(position);
    r.mesh.material.color.set(color);
    r.mesh.material.opacity = 1;
    r.mesh.scale.setScalar(0.2);
    r.mesh.visible = true;
  }

  // ---------------------------------------------------------------- update

  update(dt, rawDt = dt) {
    const game = this.game;
    if (this.hitstopLeft > 0) {
      this.hitstopLeft -= rawDt;
      if (this.hitstopLeft <= 0) {
        this.hitstopLeft = 0;
        game.timeScale = 1;
      }
    }
    this.updateProjectiles(dt);
    this.updateSparks(dt);
    this.updateRings(dt);
  }

  updateProjectiles(dt) {
    const game = this.game;
    const world = game.world;
    const t = game.time.elapsed;
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.age += dt;
      p.life -= dt;
      if (p.life <= 0) { this.endProjectile(p, true); continue; }

      // Homing: steer toward target mid-height
      const h = p.homing;
      if (h) {
        if (!h.alive) p.homing = null;
        else {
          const hp = h.object3d.position;
          _v1.set(hp.x, hp.y + (h.height || 1.6) * 0.5, hp.z).sub(p.pos);
          if (_v1.lengthSq() > 1e-4) {
            _v1.normalize().multiplyScalar(p.speed);
            p.vel.lerp(_v1, 1 - Math.exp(-p.turn * dt));
            p.vel.setLength(p.speed);
          }
        }
      }

      _prev.copy(p.pos);
      p.pos.addScaledVector(p.vel, dt);

      // World
      // segmentBlocked may return a boolean or a hit fraction (1 = clear)
      const blk = world?.segmentBlocked?.(_prev, p.pos);
      if (blk === true || (typeof blk === 'number' && blk < 1)) {
        if (typeof blk === 'number') p.pos.lerpVectors(_prev, p.pos, blk);
        this.endProjectile(p, true);
        continue;
      }
      const gy = world?.getGroundHeight?.(p.pos.x, p.pos.z) ?? 0;
      if (p.pos.y < gy + 0.05) { this.endProjectile(p, true); continue; }

      // Hits: sphere vs capsule-ish (vertical segment) of each opponent
      let hit = null;
      const ownerTeam = p.owner?.team;
      for (const c of game.combatants) {
        if (!c.alive || c.invulnerable || c.team === ownerTeam) continue;
        const cp = c.object3d.position;
        const cy = Math.max(cp.y + (c.radius || 0.5), Math.min(cp.y + (c.height || 1.6) - (c.radius || 0.5), p.pos.y));
        const dx = p.pos.x - cp.x, dy = p.pos.y - cy, dz = p.pos.z - cp.z;
        const rr = p.radius + (c.radius || 0.5);
        if (dx * dx + dy * dy + dz * dz < rr * rr) { hit = c; break; }
      }
      if (hit) {
        const dealt = this.dealDamage(p.owner, hit, p.damage, { knockback: p.knockback, text: p.text });
        if (dealt > 0 && p.status) this.applyStatus(hit, p.status.name, p.status.duration);
        this.endProjectile(p, false);
        continue;
      }

      // flair
      const m = p.mesh;
      m.position.copy(p.pos);
      m.position.y += Math.sin(p.age * 18) * 0.06;
      if (p.custom) {
        m.rotation.y += p.spin * dt;
        m.rotation.z = Math.sin(p.age * 10) * 0.25;
      } else {
        const pulse = 1 + Math.sin(t * 30 + p.spin) * 0.12;
        m.userData.halo.scale.setScalar(pulse);
      }
    }
  }

  endProjectile(p, poof) {
    p.active = false;
    p.homing = null;
    p.owner = null;
    p.mesh.visible = false;
    this.game.scene.remove(p.mesh);
    if (poof) this.spawnSparks(p.pos, { count: 4, speed: 3, size: 0.15, color: 0xffffff, life: 0.25 });
  }

  updateSparks(dt) {
    if (this.sparkActive <= 0) return;
    const cam = this.game.camera;
    const mesh = this.sparkMesh;
    let active = 0;
    for (let i = 0; i < SPARK_MAX; i++) {
      const s = this.sparks[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        _m4.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, _m4);
        continue;
      }
      active++;
      s.vel.y -= s.gravity * dt;
      s.vel.multiplyScalar(Math.exp(-3 * dt));
      s.pos.addScaledVector(s.vel, dt);
      s.rot += s.spin * dt;
      const k = s.life / s.max;
      const sc = s.size * (k > 0.7 ? (1 - k) / 0.3 * 0.6 + 0.4 : k / 0.7);
      _qz.setFromAxisAngle(_zAxis, s.rot);
      _q.copy(cam.quaternion).multiply(_qz);
      _s.setScalar(Math.max(sc, 0.0001));
      _m4.compose(s.pos, _q, _s);
      mesh.setMatrixAt(i, _m4);
    }
    this.sparkActive = active;
    mesh.instanceMatrix.needsUpdate = true;
  }

  updateRings(dt) {
    for (const r of this.rings) {
      if (!r.active) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const e = 1 - (1 - k) * (1 - k) * (1 - k);
      r.mesh.scale.setScalar(Math.max(0.05, r.radius * e));
      r.mesh.material.opacity = 1 - k * k;
    }
  }
}
