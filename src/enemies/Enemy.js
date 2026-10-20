import * as THREE from 'three';
import { basic, blobShadow } from '../core/materials.js';
import { dampAngle, yawTo } from '../core/math.js';
import { StatusSet } from '../combat/StatusEffects.js';

// Base enemy. Subclasses build a model into `this.visual` and override the hooks:
//   chooseAttack(dist) -> attack id | null        (called in chase when cooldown is ready)
//   onWindup(attack)  / updateWindup(dt, k)       (telegraph; k = 0..1)
//   onAttack(attack)  / updateAttack(dt) -> true when done
//   moveChase(dt)                                 (default: walk straight at the target)
//   animate(dt)                                   (idle/walk flavour, every frame)
// State flow: spawn -> idle (wander) -> chase -> windup -> attack -> recover -> chase ...

export const FLASH_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });
const HURT_MAT = new THREE.MeshBasicMaterial({ color: 0xffe0e6 });

let alertMat = null;
function getAlertMat() {
  if (alertMat) return alertMat;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.font = '900 110px Arial Black, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 14;
  g.strokeStyle = '#2a1a2e';
  g.strokeText('!', 32, 68);
  g.fillStyle = '#ffe23f';
  g.fillText('!', 32, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  alertMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  return alertMat;
}

// Cached CanvasTexture -> shared texture per key.
const texCache = new Map();
export function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

const matCache = new Map();
// Cached unlit decal material (transparent canvas art).
export function decalMat(key, tex) {
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, alphaTest: 0.05 }));
  return matCache.get(key);
}

const _tmp = new THREE.Vector3();
const _before = new THREE.Vector3();

export class Enemy {
  constructor(game, cfg, { radius = 0.6, height = 2, hpMul = 1, shadow = 0.7 } = {}) {
    this.game = game;
    this.cfg = cfg;
    this.name = cfg.name;
    this.team = 'enemy';
    this.maxHp = Math.round(cfg.maxHp * hpMul);
    this.hp = this.maxHp;
    this.radius = radius;
    this.height = height;
    this.alive = true;
    this.invulnerable = true; // during spawn pop-in
    this.removed = false;
    this.status = new StatusSet(this, game.events);
    this.knockback = new THREE.Vector3();
    this.speed = cfg.speed;
    this.damage = cfg.damage;
    this.aggroRange = cfg.aggroRange;

    this.object3d = new THREE.Group();
    this.object3d.userData.combatant = this;
    this.shadowSize = shadow;
    this.shadow = blobShadow(shadow);
    this.object3d.add(this.shadow);
    // `visual` holds the model; base class drives its scale/offset for squash, shake, death.
    this.visual = new THREE.Group();
    this.object3d.add(this.visual);
    this.alert = new THREE.Sprite(getAlertMat());
    this.alert.scale.set(0.45, 0.9, 1);
    this.alert.position.y = height + 0.7;
    this.alert.visible = false;
    this.alert.renderOrder = 10;
    this.object3d.add(this.alert);

    this.state = 'spawn';
    this.stateT = 0;
    this.target = null;
    this.retargetT = 0;
    this.attack = null;
    this.attackCooldown = 1 + Math.random();
    this.windupTime = 0.55;
    this.recoverTime = 0.7;
    this.hurtT = 0;
    this.hitFlashT = 0;
    this.home = new THREE.Vector3();
    this.wanderTarget = new THREE.Vector3();
    this.wanderT = 0;
    this.vel = new THREE.Vector3();  // desired planar velocity set by AI each frame
    this.faceYaw = 0;
    this.turnRate = 8;
    this.squash = 0;                 // impulse for squash/stretch springs
    this.squashV = 0;
    this.shakeAmt = 0;
    this.baseScale = 1;
    this.flashMeshes = [];
    this.flashOn = null;
    this.blocked = false;            // set by collision step when a wall pushed us this frame
    this.manager = null;
  }

  // Collect meshes to swap to the flash material (skip outline hulls, sprites).
  registerFlash(root = this.visual) {
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh) return;
      if (o.material?.side === THREE.BackSide) return; // outline hull
      if (o.userData.noFlash) return;
      this.flashMeshes.push({ mesh: o, base: o.material });
    });
  }

  setFlash(mode) { // null | 'white' | 'hurt'
    if (mode === this.flashOn) return;
    this.flashOn = mode;
    const m = mode === 'white' ? FLASH_MAT : mode === 'hurt' ? HURT_MAT : null;
    for (const f of this.flashMeshes) f.mesh.material = m || f.base;
  }

  spawnAt(pos) {
    this.object3d.position.copy(pos);
    this.object3d.position.y = this.game.world?.getGroundHeight?.(pos.x, pos.z) ?? pos.y;
    this.home.copy(this.object3d.position);
    this.wanderTarget.copy(this.home);
    this.visual.scale.setScalar(0.001);
    this.state = 'spawn';
    this.stateT = 0;
    this.faceYaw = this.object3d.rotation.y = Math.random() * Math.PI * 2;
  }

  // ------------------------------------------------------------ Combatant hooks
  onHit(info) {
    this.hitFlashT = 0.1;
    this.squash = Math.min(this.squash + 0.35, 0.6);
    if (!this.target && info?.source?.alive) this.target = info.source;
    const interruptible = this.state === 'idle' || this.state === 'chase' || this.state === 'recover';
    if (interruptible) {
      this.hurtT = 0.28;
    } else if (this.state === 'windup' && info?.crit) {
      // crits break the telegraph
      this.hurtT = 0.35;
      this.enter('recover');
    }
  }

  onDefeat() {
    this.enter('dead');
    this.invulnerable = true;
    this.alert.visible = false;
    this.setFlash('white');
    this.onDeath?.();
  }

  // ------------------------------------------------------------ helpers
  enter(state) {
    this.state = state;
    this.stateT = 0;
  }

  heroes() {
    return this.game.combatants;
  }

  pickTarget() {
    const game = this.game;
    const p = this.object3d.position;
    let best = null, bestD = Infinity;
    const pl = game.player;
    if (pl && pl.alive && pl.team === 'hero') {
      best = pl;
      bestD = Math.hypot(pl.object3d.position.x - p.x, pl.object3d.position.z - p.z) * 0.7; // prefer player
    }
    const party = game.party || [];
    for (const m of party) {
      if (!m || !m.alive || m.team !== 'hero') continue;
      const d = Math.hypot(m.object3d.position.x - p.x, m.object3d.position.z - p.z);
      if (d < bestD) { best = m; bestD = d; }
    }
    return best;
  }

  distTo(c) {
    const a = this.object3d.position, b = c.object3d.position;
    return Math.hypot(b.x - a.x, b.z - a.z);
  }

  faceTarget() {
    if (!this.target) return;
    const a = this.object3d.position, b = this.target.object3d.position;
    this.faceYaw = yawTo(b.x - a.x, b.z - a.z);
  }

  moveToward(x, z, speed, stopDist = 0) {
    const p = this.object3d.position;
    const dx = x - p.x, dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d <= stopDist + 0.01) { this.vel.set(0, 0, 0); return d; }
    this.vel.set((dx / d) * speed, 0, (dz / d) * speed);
    this.faceYaw = yawTo(dx, dz);
    return d;
  }

  // ------------------------------------------------------------ update
  update(dt) {
    if (this.removed) return;
    this.stateT += dt;
    this.status.update(dt);

    if (this.state === 'dead') { this.updateDeath(dt); return; }

    this.vel.set(0, 0, 0);
    if (this.hitFlashT > 0) this.hitFlashT -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    // retarget
    this.retargetT -= dt;
    if (this.retargetT <= 0 || (this.target && !this.target.alive)) {
      this.retargetT = 0.5;
      if (this.state !== 'attack' && this.state !== 'windup') this.target = this.pickTarget();
      else if (this.target && !this.target.alive) this.target = this.pickTarget();
    }

    if (this.hurtT > 0) {
      this.hurtT -= dt;
    } else {
      this.think(dt);
    }

    this.integrate(dt);
    this.animateBase(dt);
    this.animate?.(dt);
  }

  think(dt) {
    const t = this.target;
    switch (this.state) {
      case 'spawn':
        if (this.stateT > 0.5) { this.invulnerable = false; this.enter('idle'); }
        break;
      case 'idle':
        this.wander(dt);
        if (t && this.distTo(t) < this.aggroRange) this.enter('chase');
        break;
      case 'chase': {
        if (!t) { this.enter('idle'); break; }
        const d = this.distTo(t);
        if (d > this.aggroRange * 1.6) { this.target = null; this.enter('idle'); break; }
        if (this.attackCooldown <= 0) {
          const a = this.chooseAttack(d);
          if (a) {
            this.attack = a;
            this.enter('windup');
            this.onWindup?.(a);
            break;
          }
        }
        this.moveChase(dt, d);
        break;
      }
      case 'windup': {
        const k = Math.min(1, this.stateT / this.windupTime);
        this.updateWindup?.(dt, k);
        if (this.stateT >= this.windupTime) {
          this.alert.visible = false;
          this.enter('attack');
          this.onAttack?.(this.attack);
        }
        break;
      }
      case 'attack':
        if (this.updateAttack(dt)) this.enter('recover');
        break;
      case 'recover':
        if (this.stateT >= this.recoverTime) this.enter(t ? 'chase' : 'idle');
        break;
      default:
        this.updateCustomState?.(dt);
    }
  }

  wander(dt) {
    this.wanderT -= dt;
    const p = this.object3d.position;
    if (this.wanderT <= 0) {
      this.wanderT = 2 + Math.random() * 2.5;
      const a = Math.random() * Math.PI * 2, r = Math.random() * 4;
      this.wanderTarget.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
    }
    const d = Math.hypot(this.wanderTarget.x - p.x, this.wanderTarget.z - p.z);
    if (d > 0.4) this.moveToward(this.wanderTarget.x, this.wanderTarget.z, this.speed * 0.4);
  }

  moveChase(dt, d) {
    const tp = this.target.object3d.position;
    this.moveToward(tp.x, tp.z, this.speed, this.attackRange ?? 1.5);
  }

  integrate(dt) {
    const p = this.object3d.position;
    const world = this.game.world;
    const mul = this.status.speedMul() * (this.state === 'spawn' ? 0 : 1);
    p.x += (this.vel.x * mul + this.knockback.x) * dt;
    p.z += (this.vel.z * mul + this.knockback.z) * dt;
    const damp = Math.exp(-8 * dt);
    this.knockback.multiplyScalar(damp);

    // separation from other enemies
    const others = this.manager?.list;
    if (others) {
      for (const o of others) {
        if (o === this) continue;
        const op = o.object3d.position;
        const dx = p.x - op.x, dz = p.z - op.z;
        const min = this.radius + o.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          p.x += (dx / d) * push;
          p.z += (dz / d) * push;
        }
      }
    }

    // world collision
    this.blocked = false;
    if (world?.resolveCollision) {
      _before.copy(p);
      world.resolveCollision(p, this.radius);
      _tmp.subVectors(p, _before);
      _tmp.y = 0;
      if (_tmp.lengthSq() > 1e-6) this.blocked = true;
    }
    p.y = world?.getGroundHeight?.(p.x, p.z) ?? 0;

    const r = this.object3d.rotation;
    r.y = dampAngle(r.y, this.faceYaw, this.turnRate, dt);
  }

  animateBase(dt) {
    // squash spring
    const k = 180, c = 14;
    this.squashV += (-k * this.squash - c * this.squashV) * dt;
    this.squash += this.squashV * dt;

    let s = this.baseScale;
    if (this.state === 'spawn') {
      const t = Math.min(1, this.stateT / 0.45);
      // elastic pop-in
      s *= t >= 1 ? 1 : 1 - Math.cos(t * Math.PI * 2.5) * Math.pow(1 - t, 2);
      s = Math.max(s, 0.001);
    }
    const sq = this.squash;
    this.visual.scale.set(s * (1 + sq * 0.5), s * (1 - sq), s * (1 + sq * 0.5));

    // flash: hit flash wins, then telegraph blink
    if (this.hitFlashT > 0) this.setFlash('hurt');
    else if (this.state === 'windup') {
      const k2 = this.stateT / this.windupTime;
      const freq = 8 + k2 * 18;
      this.setFlash(Math.sin(this.stateT * freq * Math.PI) > 0.1 ? 'white' : null);
    } else this.setFlash(null);

    // shake (telegraph rattle)
    if (this.state === 'windup') {
      const a = 0.05 + 0.07 * Math.min(1, this.stateT / this.windupTime);
      this.visual.position.x = Math.sin(this.stateT * 70) * a;
      this.visual.position.z = Math.cos(this.stateT * 53) * a * 0.6;
      this.alert.visible = true;
      this.alert.position.y = this.height + 0.6 + Math.abs(Math.sin(this.stateT * 12)) * 0.15;
    } else {
      this.visual.position.x = 0;
      this.visual.position.z = 0;
    }
    if (this.hurtT > 0) {
      this.visual.position.x += Math.sin(this.hurtT * 90) * 0.06;
    }
  }

  updateDeath(dt) {
    const t = this.stateT;
    const k = Math.min(1, t / 0.25);
    const s = this.baseScale;
    this.visual.scale.set(s * (1 + k * 0.6), s * Math.max(0.12, 1 - k * 0.88), s * (1 + k * 0.6));
    this.visual.rotation.z = Math.sin(t * 40) * 0.08 * (1 - k);
    if (t > 0.3 && this.visual.visible) {
      this.visual.visible = false;
      _tmp.copy(this.object3d.position);
      _tmp.y += 0.6;
      this.game.combat?.spawnPoof?.(_tmp, 1.2);
    }
    this.shadow.scale.setScalar(Math.max(0.01, 1 - t / 0.8) * this.shadowSize);
    if (t > 0.8) this.removed = true;
  }

  // default no-op hooks
  chooseAttack() { return null; }
  updateAttack() { return true; }
}
