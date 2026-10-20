import * as THREE from 'three';
import { HEROES, PLAYER, MOM_LINES } from '../core/config.js';
import { buildKid } from '../characters/buildKid.js';
import { basic } from '../core/materials.js';
import { clamp, damp, dampAngle, wrapAngle, yawTo, pick } from '../core/math.js';
import { StatusSet } from '../combat/StatusEffects.js';

// Pip: the controllable hero. Movement, KH-style homing combo, dodge roll, lock-on, menu commands.

const LUNGE_MAX = 4;          // max homing step distance
const HOMING_RANGE = 6.5;     // search radius for auto-face/lunge when not locked on
const HURT_TIME = 0.25;
const CAST_TIME = 0.5;
const CHEER_TIME = 1.1;
const JUMP_BUFFER = 0.12;
const COYOTE = 0.1;
const ATTACK_BUFFER = 0.35;   // a press this early is remembered
const CHAIN_AT = 0.55;        // fraction of a swing after which a buffered press chains immediately
const RESPAWN_IFRAMES = 1.5;
const KB_DAMP = 8;

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _want = new THREE.Vector3();
const _tmp = new THREE.Vector3();

// --- PSI Zinger projectile look (shared geometry/material) ---
let starGeo = null;
function makeZingerMesh() {
  if (!starGeo) {
    const shape = new THREE.Shape();
    const pts = 5, ro = 0.42, ri = 0.18;
    for (let i = 0; i <= pts * 2; i++) {
      const r = i % 2 ? ri : ro;
      const a = (i / (pts * 2)) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false }).center();
  }
  const g = new THREE.Group();
  const star = new THREE.Mesh(starGeo, basic(0xfff15a));
  const halo = new THREE.Mesh(starGeo, basic(0xff7ad9, { transparent: true, opacity: 0.55 }));
  halo.scale.setScalar(1.6);
  halo.position.z = -0.05;
  star.add(halo);
  // Spin + wobble while flying (no per-frame update needed from Combat).
  star.onBeforeRender = () => {
    star.rotation.z += 0.35;
    star.rotation.y = Math.sin(star.rotation.z * 0.7) * 0.6;
    halo.rotation.z -= 0.2;
  };
  g.add(star);
  return g;
}

export class Player {
  constructor(game) {
    this.game = game;
    this.heroId = 'pip';
    this.name = HEROES.pip.name || 'Pip';
    this.team = 'hero';
    this.radius = 0.5;
    this.height = 1.7;

    this.maxHp = PLAYER.maxHp;
    this.hp = this.maxHp;
    this.maxMp = PLAYER.maxMp;
    this.mp = this.maxMp;
    this.goods = PLAYER.goods.count;
    this.momCooldown = 0;
    this.momCooldownMax = PLAYER.mom.cooldown;
    this.psiCost = PLAYER.psi.cost;
    this.alive = true;
    this.invulnerable = false;
    this.knockback = new THREE.Vector3();
    this.status = new StatusSet(this, game.events);

    this.kid = buildKid(HEROES.pip.look);
    this.object3d = this.kid.root;
    this.object3d.name = 'Pip';
    const spawn = game.world?.playerSpawn;
    if (spawn) this.object3d.position.copy(spawn);
    if (typeof game.world?.playerSpawnYaw === 'number') this.object3d.rotation.y = game.world.playerSpawnYaw;
    game.scene.add(this.object3d);
    game.combatants.push(this);

    // Motion state
    this.vel = new THREE.Vector3(); // horizontal velocity
    this.vy = 0;
    this.grounded = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.airAttacks = 0;

    // Action state
    this.action = null;     // null | 'attack' | 'dodge' | 'hurt' | 'ko' | 'cast' | 'cheer'
    this.actionTime = 0;
    this.actionDur = 0;
    this.combo = 0;         // index of current/last swing
    this.comboTimer = 0;    // window to continue the chain after a swing ends
    this.attackBuffer = 0;  // >0 = attack requested recently
    this.hitDone = false;
    this.lungeVel = new THREE.Vector3();
    this.lungeTime = 0;
    this.slamPending = false;

    this.dodgeCd = 0;
    this.dodgeDir = new THREE.Vector3();
    this.iframes = 0;
    this.respawnTimer = 0;
    this.weaponScale = 1;
    this.blinkT = 0;
    this.spawnBlink = 0;

    game.events.on('command', (e) => this.onCommand(e?.name));
    game.events.on('defeat', (e) => {
      if (e?.target && e.target === game.target) this.setTarget(null);
    });
  }

  // ---------------------------------------------------------------- helpers
  get position() { return this.object3d.position; }

  // StatusSet calls this when 'embarrassed' starts/ends (animate() also syncs it every frame).
  setBlush(on) { this.kid.setBlush(!!on); }

  emit(name, payload) { this.game.events.emit(name, payload); }
  sfx(name) { this.emit('sfx', { name }); }
  popup(text, style = 'info') {
    const p = this.object3d.position;
    this.emit('popup', { text, position: new THREE.Vector3(p.x, p.y + this.height + 0.4, p.z), style });
  }

  enemyList() {
    const list = this.game.enemies?.list;
    return Array.isArray(list) ? list : [];
  }

  validEnemy(e) {
    return e && e.alive && e.object3d && e.team !== 'hero';
  }

  // Nearest valid enemy within maxDist (XZ).
  nearestEnemy(maxDist) {
    let best = null, bd = maxDist;
    const p = this.object3d.position;
    for (const e of this.enemyList()) {
      if (!this.validEnemy(e)) continue;
      const q = e.object3d.position;
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  camYaw() {
    return this.game.cameraRig?.yaw ?? this.object3d.rotation.y;
  }

  // Camera-relative input direction into `out` (unit or zero). Returns magnitude 0..1.
  inputDir(out) {
    const m = this.game.input?.move ?? { x: 0, y: 0 };
    const mag = Math.min(1, Math.hypot(m.x, m.y));
    if (mag < 0.05) { out.set(0, 0, 0); return 0; }
    const yaw = this.camYaw();
    const fx = Math.sin(yaw), fz = Math.cos(yaw);   // camera forward
    const rx = -Math.cos(yaw), rz = Math.sin(yaw);  // camera right
    out.set(fx * m.y + rx * m.x, 0, fz * m.y + rz * m.x).normalize();
    return mag;
  }

  groundAt(x, z) {
    const g = this.game.world?.getGroundHeight?.(x, z);
    return Number.isFinite(g) ? g : 0;
  }

  setAction(name, dur) {
    this.action = name;
    this.actionTime = 0;
    this.actionDur = dur;
  }

  // ---------------------------------------------------------------- lock-on
  setTarget(t) {
    if (this.game.target === t) return;
    this.game.target = t;
    this.emit('lock', { target: t });
    if (t) this.sfx('lock');
  }

  lockCandidates() {
    const p = this.object3d.position;
    const range = PLAYER.lockRange;
    const out = [];
    for (const e of this.enemyList()) {
      if (!this.validEnemy(e)) continue;
      const q = e.object3d.position;
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d <= range) out.push(e);
    }
    return out;
  }

  toggleLock() {
    const cands = this.lockCandidates();
    const cur = this.game.target;
    const p = this.object3d.position;
    const yaw = this.camYaw();
    const fx = Math.sin(yaw), fz = Math.cos(yaw);

    if (!cur) {
      // Best = nearest, weighted toward what the camera is looking at.
      let best = null, bs = Infinity;
      for (const e of cands) {
        const q = e.object3d.position;
        const dx = q.x - p.x, dz = q.z - p.z;
        const d = Math.hypot(dx, dz) || 0.001;
        const dot = (dx * fx + dz * fz) / d; // -1..1
        const score = d * (1.6 - 0.75 * dot);
        if (score < bs) { bs = score; best = e; }
      }
      if (best) this.setTarget(best);
      else this.sfx('denied');
      return;
    }

    // Cycle left-to-right (relative to the camera) to the next enemy; release if none.
    const others = cands.filter((e) => e !== cur);
    if (!others.length) { this.setTarget(null); return; }
    const camAngle = (e) => {
      const q = e.object3d.position;
      return wrapAngle(yaw - yawTo(q.x - p.x, q.z - p.z)); // + = to the right on screen
    };
    const a0 = camAngle(cur);
    let next = null, bestDelta = Infinity;
    for (const e of others) {
      let delta = camAngle(e) - a0;
      if (delta <= 0) delta += Math.PI * 2;
      if (delta < bestDelta) { bestDelta = delta; next = e; }
    }
    this.setTarget(next);
  }

  validateTarget() {
    const t = this.game.target;
    if (!t) return;
    if (!t.alive || !t.object3d) { this.setTarget(null); return; }
    const list = this.game.enemies?.list;
    if (Array.isArray(list) && !list.includes(t)) { this.setTarget(null); return; }
    const p = this.object3d.position, q = t.object3d.position;
    if (Math.hypot(q.x - p.x, q.z - p.z) > PLAYER.lockRange * 1.4) this.setTarget(null);
  }

  // Target for homing attacks/PSI: lock-on target, else nearest enemy in range.
  homingTarget(range = HOMING_RANGE) {
    const t = this.game.target;
    if (t && t.alive && t.object3d) {
      const p = this.object3d.position, q = t.object3d.position;
      if (Math.hypot(q.x - p.x, q.z - p.z) <= Math.max(range, LUNGE_MAX + 3)) return t;
    }
    return this.nearestEnemy(range);
  }

  // ---------------------------------------------------------------- combat
  requestAttack() {
    if (!this.alive) return;
    this.attackBuffer = ATTACK_BUFFER;
  }

  canStartAttack() {
    if (!this.alive) return false;
    if (this.action === null) return true;
    if (this.action === 'attack') {
      // Chain once the swing has connected and passed the chain point.
      return this.hitDone && this.actionTime >= this.actionDur * CHAIN_AT && this.combo < 2;
    }
    return false;
  }

  startAttack() {
    const chaining = this.action === 'attack' || this.comboTimer > 0;
    let idx = chaining ? this.combo + 1 : 0;
    if (idx > 2) idx = 0;
    if (!this.grounded) {
      if (this.airAttacks >= 3) return false;
      this.airAttacks++;
    }
    this.combo = idx;
    const c = PLAYER.combo[idx];
    this.setAction('attack', c.duration);
    this.hitDone = false;
    this.attackBuffer = 0;
    this.comboTimer = 0;
    this.slamPending = idx === 2;

    // KH homing step: auto-face + lunge toward a nearby enemy.
    const p = this.object3d.position;
    const t = this.homingTarget();
    const lungeT = Math.max(0.05, c.duration * c.hitAt);
    this.lungeTime = lungeT;
    if (t) {
      const q = t.object3d.position;
      const dx = q.x - p.x, dz = q.z - p.z;
      const d = Math.hypot(dx, dz) || 0.001;
      this.object3d.rotation.y = yawTo(dx, dz);
      const reach = c.range * this.status.attackScale() * 0.55 + (t.radius ?? 0.5) + this.radius * 0.5;
      const dist = clamp(d - reach, 0, LUNGE_MAX);
      this.lungeVel.set(dx / d, 0, dz / d).multiplyScalar(dist / lungeT);
    } else {
      // No enemy: face the stick direction and take a small step.
      if (this.inputDir(_dir) > 0) this.object3d.rotation.y = yawTo(_dir.x, _dir.z);
      const ry = this.object3d.rotation.y;
      this.lungeVel.set(Math.sin(ry), 0, Math.cos(ry)).multiplyScalar(0.7 / lungeT);
    }
    this.vel.multiplyScalar(0.2);

    if (idx === 2) {
      if (this.grounded) { this.vy = 5.5; this.grounded = false; } // hop before the slam
      else this.vy = 3;
    } else if (!this.grounded) {
      this.vy = Math.max(this.vy, 2.5); // air juggle float
    }
    this.sfx('swing');
    return true;
  }

  landHit() {
    const c = PLAYER.combo[this.combo];
    const scale = this.status.attackScale();
    this.hitDone = true;
    const combat = this.game.combat;
    let hits = [];
    if (combat?.meleeSweep) {
      hits = combat.meleeSweep(this, {
        range: c.range * scale, arc: c.arc, damage: c.damage, knockback: c.knockback, text: c.text,
      }) || [];
    }
    if (this.combo === 2) {
      if (!this.grounded) this.vy = -16; // slam down
      // Combat already shakes per hit; add the finisher's own thump.
      this.game.cameraRig?.shake?.(0.25);
      if (hits.length) this.sfx('smash');
    }
  }

  // ---------------------------------------------------------------- commands
  onCommand(name) {
    if (!name || !this.alive || !this.game.started) return;
    switch (name) {
      case 'bash':
        // The Player already reads the attack button directly; avoid double-triggering.
        if (this.game.input?.pressed?.('attack')) return;
        this.requestAttack();
        break;
      case 'psi': this.castPsi(); break;
      case 'goods': this.useGoods(); break;
      case 'mom': this.callMom(); break;
    }
  }

  castPsi() {
    const cfg = PLAYER.psi;
    if (this.mp < this.psiCost) {
      this.sfx('denied');
      this.popup('Not enough PSI... you feel awkward.', 'status');
      return;
    }
    this.mp -= this.psiCost;
    this.setAction('cast', CAST_TIME);
    this.vel.multiplyScalar(0.3);

    const p = this.object3d.position;
    const t = this.homingTarget(PLAYER.lockRange);
    const origin = new THREE.Vector3(p.x, p.y + 1.15, p.z);
    const dir = new THREE.Vector3();
    if (t) {
      const q = t.object3d.position;
      this.object3d.rotation.y = yawTo(q.x - p.x, q.z - p.z);
      dir.set(q.x - origin.x, q.y + (t.height ?? 1.4) * 0.5 - origin.y, q.z - origin.z);
    } else {
      const yaw = this.inputDir(_dir) > 0 ? yawTo(_dir.x, _dir.z) : this.object3d.rotation.y;
      this.object3d.rotation.y = yaw;
      dir.set(Math.sin(yaw), 0, Math.cos(yaw));
    }
    dir.normalize();
    origin.addScaledVector(dir, 0.7);

    this.game.combat?.spawnProjectile?.({
      owner: this,
      position: origin,
      direction: dir,
      speed: cfg.speed,
      damage: cfg.damage,
      radius: 0.5,
      color: 0xfff15a,
      life: 2.2,
      homing: t || null,
      text: null,
      mesh: makeZingerMesh(),
    });
    this.popup('PSI Zinger!', 'big');
    this.sfx('psi');
  }

  useGoods() {
    if (this.goods <= 0) {
      this.sfx('denied');
      this.popup('Out of pizza. Tragic.', 'info');
      return;
    }
    this.goods--;
    this.game.combat?.heal?.(this, PLAYER.goods.heal, 'Cafeteria Pizza!');
    this.emit('dialogue', { speaker: 'Pip', text: 'You ate the Cafeteria Pizza. It tasted like Tuesday.' });
    this.sfx('heal');
  }

  callMom() {
    if (this.momCooldown > 0) {
      this.sfx('denied');
      this.popup(`Mom is busy. (${Math.ceil(this.momCooldown)}s)`, 'info');
      return;
    }
    this.setAction('cheer', CHEER_TIME);
    this.vel.multiplyScalar(0.3);
    this.sfx('phone');
    this.emit('dialogue', { speaker: 'Mom', text: pick(MOM_LINES) });
    this.game.combat?.heal?.(this, this.maxHp, 'HP fully restored!');
    this.hp = this.maxHp; // in case heal clamps oddly / combat missing
    this.status.remove('embarrassed');
    this.momCooldown = PLAYER.mom.cooldown;
  }

  // ---------------------------------------------------------------- hooks
  onHit() {
    if (!this.alive) return;
    if (this.action === 'ko') return;
    this.setAction('hurt', HURT_TIME);
    this.attackBuffer = 0;
    this.comboTimer = 0;
    this.lungeVel.set(0, 0, 0);
    this.vel.multiplyScalar(0.3);
    this.sfx('hurt');
  }

  onDefeat() {
    this.alive = false;
    this.setAction('ko', 999);
    this.vel.set(0, 0, 0);
    this.lungeVel.set(0, 0, 0);
    this.attackBuffer = 0;
    this.respawnTimer = PLAYER.respawnDelay;
    this.setTarget(null);
    this.emit('player:down', {});
    this.emit('dialogue', { speaker: '', text: "Pip couldn't take it anymore and fainted." });
  }

  respawn() {
    const spawn = this.game.world?.playerSpawn;
    if (spawn) this.object3d.position.copy(spawn);
    else this.object3d.position.set(0, 0, 0);
    this.object3d.position.y = Math.max(this.object3d.position.y, this.groundAt(this.object3d.position.x, this.object3d.position.z));
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    for (const k of [...this.status.list.keys()]) this.status.remove(k);
    this.alive = true;
    this.action = null;
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.knockback.set(0, 0, 0);
    this.iframes = RESPAWN_IFRAMES;
    this.spawnBlink = RESPAWN_IFRAMES;
    if (!this.game.combatants.includes(this)) this.game.combatants.push(this);
    this.emit('player:up', {});
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    if (dt <= 0) { this.animate(0); return; }
    const game = this.game;
    const input = game.input;
    const pos = this.object3d.position;

    this.status.update(dt);
    this.mp = Math.min(this.maxMp, this.mp + PLAYER.mpRegen * dt);
    this.momCooldown = Math.max(0, this.momCooldown - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.action) this.actionTime += dt;

    // ---- KO / respawn ----
    if (!this.alive) {
      this.invulnerable = true;
      if (this.action !== 'ko') this.setAction('ko', 999);
      this.respawnTimer -= dt;
      this.applyGravityAndCollide(dt, 0);
      if (this.respawnTimer <= 0) this.respawn();
      this.animate(dt);
      return;
    }

    // ---- Inputs ----
    if (input?.pressed('lock')) this.toggleLock();
    this.validateTarget();
    if (input?.pressed('attack')) this.requestAttack();
    if (input?.pressed('jump')) this.jumpBuffer = JUMP_BUFFER;
    const moveMag = this.inputDir(_dir);

    // Dodge roll: cancels attacks / cast / cheer.
    if (input?.pressed('dodge') && this.dodgeCd <= 0 && this.action !== 'hurt' && this.action !== 'dodge') {
      if (moveMag > 0) this.dodgeDir.copy(_dir);
      else { const ry = this.object3d.rotation.y; this.dodgeDir.set(Math.sin(ry), 0, Math.cos(ry)); }
      this.object3d.rotation.y = yawTo(this.dodgeDir.x, this.dodgeDir.z);
      this.setAction('dodge', PLAYER.dodgeTime);
      this.iframes = Math.max(this.iframes, PLAYER.dodgeIFrames);
      this.attackBuffer = 0;
      this.comboTimer = 0;
      this.lungeVel.set(0, 0, 0);
      this.sfx('dodge');
    }

    // ---- Action timeline ----
    if (this.action === 'attack') {
      const c = PLAYER.combo[this.combo];
      if (!this.hitDone && this.actionTime >= c.duration * c.hitAt) this.landHit();
      if (this.attackBuffer > 0 && this.canStartAttack()) this.startAttack();
      else if (this.actionTime >= this.actionDur) {
        this.action = null;
        this.comboTimer = this.combo < 2 ? PLAYER.comboWindow : 0;
        if (this.combo >= 2) this.combo = 0;
      }
    } else if (this.action && this.actionTime >= this.actionDur) {
      this.action = null;
    }
    if (this.action === null && this.attackBuffer > 0) this.startAttack();

    this.invulnerable = this.iframes > 0;

    // ---- Horizontal movement ----
    const speedMul = this.status.speedMul();
    const run = PLAYER.runSpeed * speedMul;
    if (this.action === 'dodge') {
      const k = this.actionTime / this.actionDur;
      const s = PLAYER.dodgeSpeed * (1 - 0.65 * k * k) * Math.max(0.6, speedMul);
      this.vel.copy(this.dodgeDir).multiplyScalar(s);
    } else if (this.action === 'attack') {
      // Homing step during wind-up, otherwise planted.
      if (this.actionTime < this.lungeTime) _want.copy(this.lungeVel);
      else _want.set(0, 0, 0);
      this.vel.lerp(_want, 1 - Math.exp(-30 * dt));
    } else if (this.action === 'hurt' || this.action === 'cheer') {
      this.vel.multiplyScalar(Math.exp(-10 * dt));
    } else {
      const slow = this.action === 'cast' ? 0.25 : 1;
      _want.copy(_dir).multiplyScalar(run * moveMag * slow);
      // Accelerate fast, stop a touch quicker so it feels planted with slight slide.
      const rate = (_want.lengthSq() > 0.01 ? PLAYER.accel : PLAYER.accel * 1.4) * (this.grounded ? 1 : 0.55);
      _tmp.copy(_want).sub(this.vel);
      const len = _tmp.length();
      const step = rate * dt;
      if (len <= step) this.vel.copy(_want);
      else this.vel.addScaledVector(_tmp, step / len);
      if (moveMag > 0 && this.action !== 'cast') {
        this.object3d.rotation.y = dampAngle(this.object3d.rotation.y, yawTo(_dir.x, _dir.z), PLAYER.turnRate, dt);
      }
    }

    // ---- Jump ----
    if (this.grounded) { this.coyote = COYOTE; this.airAttacks = 0; }
    else this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0 && (this.action === null || this.action === 'cast' || (this.action === 'attack' && this.hitDone))) {
      if (this.action === 'attack') this.action = null;
      this.vy = PLAYER.jumpVelocity;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.sfx('jump');
    }

    // Keep the lock target in view while idle-locked (subtle face-toward).
    const t = game.target;
    if (t && this.action === null && moveMag === 0 && t.object3d) {
      const q = t.object3d.position;
      this.object3d.rotation.y = dampAngle(this.object3d.rotation.y, yawTo(q.x - pos.x, q.z - pos.z), 6, dt);
    }

    // ---- Integrate ----
    pos.x += this.vel.x * dt;
    pos.z += this.vel.z * dt;
    const gScale = this.action === 'attack' && !this.grounded && this.vy > -10 ? 0.35 : 1;
    this.applyGravityAndCollide(dt, gScale);

    this.animate(dt);
  }

  applyGravityAndCollide(dt, gScale = 1) {
    const pos = this.object3d.position;
    // Knockback (Combat adds impulses)
    if (this.knockback.lengthSq() > 1e-6) {
      pos.x += this.knockback.x * dt;
      pos.z += this.knockback.z * dt;
      if (this.knockback.y > 0) { this.vy = Math.max(this.vy, this.knockback.y); this.grounded = false; this.knockback.y = 0; }
      this.knockback.multiplyScalar(Math.exp(-KB_DAMP * dt));
    } else this.knockback.set(0, 0, 0);

    const wasAir = !this.grounded;
    const fallV = this.vy;
    this.vy -= PLAYER.gravity * gScale * dt;
    pos.y += this.vy * dt;

    this.game.world?.resolveCollision?.(pos, this.radius);

    const gh = this.groundAt(pos.x, pos.z);
    if (pos.y <= gh) {
      pos.y = gh;
      if (this.vy <= 0) {
        if (wasAir && this.alive) {
          if (fallV < -12) this.game.cameraRig?.shake?.(0.18); // slam landing
        }
        this.vy = 0;
        this.grounded = true;
      }
    } else if (this.grounded && pos.y - gh < 0.35 && this.vy <= 0) {
      // Stick to gentle slopes / small steps down.
      pos.y = gh;
      this.vy = 0;
    } else {
      this.grounded = false;
    }
  }

  animate(dt) {
    const kid = this.kid;
    kid.setBlush(this.status.has('embarrassed'));
    const target = this.status.attackScale();
    this.weaponScale = dt > 0 ? damp(this.weaponScale, target, 10, dt) : target;
    kid.parts.weaponPivot.scale.setScalar(this.weaponScale);

    const hs = Math.hypot(this.vel.x, this.vel.z);
    const actionT = this.action ? clamp(this.actionTime / (this.action === 'ko' ? 1 : this.actionDur || 1), 0, 1) : 0;
    kid.update(dt, {
      speed01: this.action ? 0 : clamp(hs / PLAYER.runSpeed, 0, 1),
      grounded: this.grounded,
      action: this.action,
      actionT,
      combo: this.combo,
    });

    // Respawn blink
    if (this.spawnBlink > 0 && this.alive) {
      this.spawnBlink -= dt;
      this.blinkT += dt;
      this.object3d.visible = Math.floor(this.blinkT * 16) % 2 === 0;
    } else {
      this.object3d.visible = true;
      this.blinkT = 0;
    }
  }
}
