import * as THREE from 'three';
import { HEROES, PARTY } from '../core/config.js';
import { StatusSet } from '../combat/StatusEffects.js';
import { buildKid } from '../characters/buildKid.js';
import { basic, geo } from '../core/materials.js';
import { clamp, dampAngle, yawTo, rand } from '../core/math.js';

// ---------------------------------------------------------------------------
// Tuning that is specific to AI teammates (config.PARTY holds the shared numbers).
// ---------------------------------------------------------------------------
const ENGAGE_RADIUS = 12;        // enemies this close to the player get engaged
const LEASH_RADIUS = 18;         // keep chasing a chosen target while it stays this close to the player
const TELEPORT_DIST = 30;        // too far behind -> poof next to the player
const SLOT_BACK = 1.9;           // formation: distance behind the player
const SLOT_SIDE = 1.7;           // formation: distance to the side
const ARRIVE_STOP = 0.3;         // close enough to the slot: stand still
const ARRIVE_RESUME = 0.9;       // ...until the slot drifts this far away (hysteresis = no idle jitter)
const ACCEL = 22;                // velocity smoothing rate
const TURN_RATE = 12;
const GRAVITY = 26;
const JUMP_VEL = 8.5;
const KB_DAMP = 8;
const SEPARATION_DIST = 1.5;
const SEPARATION_PUSH = 5;

const DOT_MIN = 6, DOT_MAX = 9;
const DOT_HEAL_COOLDOWN = 15;
const DOT_HEAL_AMOUNT = 30;
const DOT_HEAL_RANGE = 2.6;
const MOOSE_TACKLE_COOLDOWN = 8;
const MOOSE_TACKLE_SPEED = 15;
const MOOSE_TACKLE_TIME = 0.5;

const BARKS = {
  dot: [
    'I read about this in a library book!',
    "Statistically, we're fine.",
    "This is technically a learning experience. I'm taking notes.",
    "I made flashcards for exactly this situation. Well, for the SAT. Same thing.",
    'If this counts as P.E., I would like extra credit.',
  ],
  moose: [
    'Coach says pain is just weakness... leaving? Wait, how does it go?',
    "I'm hugging it. I'm hugging the problem.",
    'Is it okay if I say sorry after I tackle it?',
    "My mom packed me two sandwiches. I'm unstoppable.",
    "Don't worry, guys. I'll be the wall. Walls are friends.",
  ],
};

const KO_LINES = {
  dot: 'Dot is reconsidering everything.',
  moose: 'Moose needs a minute.',
};
const REVIVE_LINES = {
  dot: 'Dot got back up. She has a new theory.',
  moose: "Moose got back up. He's fine. Probably.",
};

// ---------------------------------------------------------------------------
// Shared, allocation-free scratch space.
// ---------------------------------------------------------------------------
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _sep = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _anim = { speed01: 0, grounded: true, action: null, actionT: 0, combo: 0 };

// Flashcard projectile: shared geometry + materials.
const cardGeo = () => geo('party.card', () => new THREE.BoxGeometry(0.42, 0.03, 0.28));
const stripeGeo = () => geo('party.cardStripe', () => new THREE.BoxGeometry(0.42, 0.035, 0.06));
const cardMat = basic(0xffffff);
const stripeMats = [basic(0xff5f9e), basic(0x4fa8ff), basic(0x7fe05a), basic(0xffd23f)];

// Poof puffs (teleport catch-up)
const puffGeo = () => geo('party.puff', () => new THREE.SphereGeometry(0.35, 8, 6));
const puffMat = basic(0xffffff, { transparent: true, opacity: 0.8 });

function makeFlashcard(i) {
  const card = new THREE.Mesh(cardGeo(), cardMat);
  const stripe = new THREE.Mesh(stripeGeo(), stripeMats[i % stripeMats.length]);
  stripe.position.z = 0.08;
  card.add(stripe);
  card.scale.setScalar(1.25);
  return card;
}

// Pooled flashcard meshes. Combat adds a projectile's mesh to the scene and removes it when the
// projectile ends, so a card with no parent is free to reuse.
const cardPool = [];
let cardCounter = 0;
function acquireFlashcard() {
  for (let i = 0; i < cardPool.length; i++) if (!cardPool[i].parent) return cardPool[i];
  const c = makeFlashcard(cardCounter++);
  cardPool.push(c);
  return c;
}
function spinFlashcards(dt) {
  for (let i = 0; i < cardPool.length; i++) {
    const c = cardPool[i];
    if (c.parent) c.rotation.y += dt * 14; // extra flutter on top of Combat's spin
  }
}

export class PartyMember {
  /**
   * @param {object} game
   * @param {'dot'|'moose'} heroId
   * @param {number} index 0 = left slot, 1 = right slot
   * @param {object} crew shared party state (barks)
   */
  constructor(game, heroId, index, crew) {
    this.game = game;
    this.heroId = heroId;
    this.index = index;
    this.crew = crew;
    const hero = HEROES[heroId];
    const cfg = PARTY[heroId];
    this.cfg = cfg;
    this.name = hero.name;
    this.team = 'hero';
    this.role = cfg.role;

    this.maxHp = cfg.maxHp;
    this.hp = cfg.maxHp;
    this.alive = true;
    this.invulnerable = false;
    this.radius = heroId === 'moose' ? 0.6 : 0.5;
    this.height = heroId === 'moose' ? 1.8 : 1.7;
    this.knockback = new THREE.Vector3();
    this.status = new StatusSet(this, game.events);

    this.kid = buildKid(hero.look);
    this.object3d = this.kid.root;
    this.object3d.name = hero.name;
    this.object3d.userData.combatant = this;

    // Movement
    this.velocity = new THREE.Vector3();
    this.vy = 0;
    this.grounded = true;
    this.groundY = 0;
    this.idle = true;            // standing in formation slot
    this.slotYaw = 0;
    this.jumpDelay = -1;

    // Combat state
    this.target = null;
    this.attackCooldown = rand(0.2, 0.6);
    this.combo = 0;
    this.animCombo = 0;
    this.comboResetT = 0;
    this.action = null;          // anim action name
    this.actionKind = null;      // 'melee' | 'throw' | 'tackle' | 'cast' | 'hurt' | 'cheer' | 'ko'
    this.actionTime = 0;
    this.actionDur = 0;
    this.actionFired = false;
    this.strafeSign = index === 0 ? 1 : -1;
    this.strafeTimer = rand(2, 4);
    this.tackleCooldown = 4;
    this.healCooldown = 0;
    this.healing = false;
    this.koTimer = 0;

    this.lastCard = null;        // most recent flashcard mesh (debug/tests)

    // Poof effect
    this.poof = new THREE.Group();
    this.puffs = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(puffGeo(), puffMat);
      const a = (i / 6) * Math.PI * 2;
      p.userData.dir = new THREE.Vector3(Math.cos(a), 0.4 + (i % 2) * 0.4, Math.sin(a));
      this.poof.add(p);
      this.puffs.push(p);
    }
    this.poof.visible = false;
    this.poofT = 0;

    this._spawn();
    game.scene.add(this.object3d);
    game.scene.add(this.poof);
    this._register();
  }

  // ---------------------------------------------------------------- setup
  _spawn() {
    const game = this.game;
    const sp = game.world?.partySpawns?.[this.index];
    if (sp) {
      this.object3d.position.set(sp.x, sp.y || 0, sp.z);
    } else if (game.player?.object3d) {
      this._slotPosition(this.object3d.position);
    } else {
      this.object3d.position.set(this.index === 0 ? -2 : 2, 0, -2);
    }
    this.groundY = this._groundAt(this.object3d.position.x, this.object3d.position.z);
    this.object3d.position.y = Math.max(this.object3d.position.y, this.groundY);
    if (game.player?.object3d) this.slotYaw = game.player.object3d.rotation.y;
  }

  _register() {
    const list = this.game.combatants;
    if (list && !list.includes(this)) list.push(this);
  }

  _unregister() {
    const list = this.game.combatants;
    if (!list) return;
    const i = list.indexOf(this);
    if (i >= 0) list.splice(i, 1);
  }

  _groundAt(x, z) {
    const w = this.game.world;
    if (!w) return 0;
    if (w.getGroundHeight) return w.getGroundHeight(x, z) || 0;
    if (w.groundHeight) return w.groundHeight(x, z) || 0;
    if (w.heightAt) return w.heightAt(x, z) || 0;
    if (w.getHeight) return w.getHeight(x, z) || 0;
    return 0;
  }

  /** Formation slot for this member, written into `out`. */
  _slotPosition(out) {
    const p = this.game.player.object3d.position;
    const yaw = this.slotYaw;
    const side = (this.index === 0 ? 1 : -1) * SLOT_SIDE; // +X local is the player's left when facing +Z
    const back = -SLOT_BACK;
    const s = Math.sin(yaw), c = Math.cos(yaw);
    out.set(p.x + side * c + back * s, p.y, p.z - side * s + back * c);
    return out;
  }

  // ---------------------------------------------------------------- Combatant hooks
  /** StatusSet calls this when 'embarrassed' starts/ends. */
  setBlush(on) {
    this.kid.setBlush(on);
  }

  onHit() {
    if (!this.alive) return;
    // Don't interrupt big moves; a light flinch otherwise.
    if (this.actionKind === 'tackle' || this.actionKind === 'cast') return;
    this._startAction('hurt', 'hurt', 0.28);
  }

  onDefeat() {
    this.alive = false;
    this.koTimer = PARTY.reviveTime;
    this.target = null;
    this.healing = false;
    this.velocity.set(0, 0, 0);
    this._startAction('ko', 'ko', PARTY.reviveTime);
    this._popup(KO_LINES[this.heroId], 'info');
    this.game.events.emit('sfx', { name: 'defeat' });
    this._unregister();
  }

  _revive() {
    this.alive = true;
    this.hp = Math.round(this.maxHp * 0.5);
    this.knockback.set(0, 0, 0);
    this.status.remove?.('embarrassed');
    this._register();
    this._startAction('cheer', 'cheer', 1.2);
    this.invulnerable = true; // a short grace period while cheering
    this._popup(REVIVE_LINES[this.heroId], 'info');
    this.game.events.emit('sfx', { name: 'heal' });
  }

  _popup(text, style) {
    const p = this.object3d.position;
    this.game.events.emit('popup', {
      text,
      position: new THREE.Vector3(p.x, p.y + this.height + 0.4, p.z),
      style,
    });
  }

  _startAction(kind, anim, dur, combo = 0) {
    this.actionKind = kind;
    this.action = anim;
    this.actionTime = 0;
    this.actionDur = dur;
    this.actionFired = false;
    this.animCombo = combo;
  }

  _endAction() {
    if (this.actionKind === 'cheer') this.invulnerable = false;
    this.actionKind = null;
    this.action = null;
    this.actionTime = 0;
    this.actionDur = 0;
  }

  // ---------------------------------------------------------------- per-frame
  update(dt) {
    if (dt <= 0) return;
    const game = this.game;
    const pos = this.object3d.position;

    this.status.update(dt);
    this.kid.setBlush(this.status.has('embarrassed'));
    this._updatePoof(dt);
    if (this.heroId === 'dot') spinFlashcards(dt);

    // Timers
    this.attackCooldown -= dt;
    this.tackleCooldown -= dt;
    this.healCooldown -= dt;
    if (this.comboResetT > 0 && (this.comboResetT -= dt) <= 0) this.combo = 0;

    if (this.actionKind) {
      this.actionTime += dt;
    }

    // Knockback (always integrated, even when KO'd so hits still shove the body).
    pos.x += this.knockback.x * dt;
    pos.z += this.knockback.z * dt;
    const kd = Math.exp(-KB_DAMP * dt);
    this.knockback.multiplyScalar(kd);

    if (!this.alive) {
      this._updateKO(dt);
      this._finishFrame(dt, 0);
      return;
    }

    if (this.actionKind && this.actionTime >= this.actionDur) this._endAction();

    const player = game.player;
    const playerPos = player?.object3d?.position;
    const speedMul = this.status.speedMul ? this.status.speedMul() : 1;
    const maxSpeed = this.cfg.speed * speedMul;

    // Teleport catch-up
    if (playerPos) {
      const dx = playerPos.x - pos.x, dz = playerPos.z - pos.z;
      if (dx * dx + dz * dz > TELEPORT_DIST * TELEPORT_DIST) this._teleportToSlot();
      this.slotYaw = dampAngle(this.slotYaw, player.object3d.rotation.y, 3, dt);
      this._watchPlayerJump(dt);
    }

    // Decide what to do
    _desired.set(0, 0, 0);
    let faceTarget = null;
    let moveScale = 1;

    if (this.actionKind === 'tackle') {
      this._updateTackle(dt);
      this._finishFrame(dt, 1);
      return;
    }

    const busy = this.actionKind === 'melee' || this.actionKind === 'throw' || this.actionKind === 'cast'
      || this.actionKind === 'hurt' || this.actionKind === 'cheer';
    if (busy) moveScale = this.actionKind === 'throw' ? 0.35 : this.actionKind === 'melee' ? 0.2 : 0;

    if (this.actionKind === 'cast') {
      this._updateCast();
      if (player) faceTarget = player.object3d.position;
    } else if (this._wantsHeal()) {
      // Dot runs to the player and shares her lunch.
      this.healing = true;
      const d = this._steerTo(playerPos, DOT_HEAL_RANGE * 0.8, maxSpeed * 1.15, _desired);
      faceTarget = playerPos;
      if (d <= DOT_HEAL_RANGE && !busy) {
        this._startAction('cast', 'cast', 0.7);
      }
    } else {
      this.healing = false;
      const target = this._pickTarget();
      this.target = target;
      if (target) {
        faceTarget = target.object3d.position;
        if (this.role === 'melee') this._engageMelee(target, maxSpeed, busy);
        else this._engageRanged(target, maxSpeed, busy, dt);
      } else if (playerPos) {
        this._followFormation(maxSpeed);
      }
    }

    // Separation from teammates + player
    this._separation(_sep);
    _desired.x = _desired.x * moveScale + _sep.x;
    _desired.z = _desired.z * moveScale + _sep.z;

    // Smooth velocity toward desired
    const a = 1 - Math.exp(-ACCEL * dt);
    this.velocity.x += (_desired.x - this.velocity.x) * a;
    this.velocity.z += (_desired.z - this.velocity.z) * a;
    if (this.idle && _sep.lengthSq() < 0.01 && !faceTarget) {
      // Settle fully: no micro-drift while waiting in the slot.
      if (this.velocity.lengthSq() < 0.0025) this.velocity.set(0, 0, 0);
    }

    pos.x += this.velocity.x * dt;
    pos.z += this.velocity.z * dt;

    // Facing
    const sp = Math.hypot(this.velocity.x, this.velocity.z);
    let yawGoal = null;
    if (faceTarget && (busy || sp < maxSpeed * 0.6 || this.role === 'ranged')) {
      yawGoal = yawTo(faceTarget.x - pos.x, faceTarget.z - pos.z);
    } else if (sp > 0.6) {
      yawGoal = yawTo(this.velocity.x, this.velocity.z);
    }
    if (this.actionKind === 'melee' || this.actionKind === 'throw') {
      // Commit to the swing direction after the windup.
      if (this.actionTime < this.actionDur * 0.3 && faceTarget) yawGoal = yawTo(faceTarget.x - pos.x, faceTarget.z - pos.z);
      else yawGoal = null;
    }
    if (yawGoal !== null) this.object3d.rotation.y = dampAngle(this.object3d.rotation.y, yawGoal, TURN_RATE, dt);

    this._updateAttackTiming();
    this._barkTick(dt);
    this._finishFrame(dt, clamp(sp / Math.max(0.1, this.cfg.speed), 0, 1));
  }

  _finishFrame(dt, speed01) {
    const pos = this.object3d.position;
    // World collision
    const w = this.game.world;
    if (w?.resolveCollision) w.resolveCollision(pos, this.radius);

    // Vertical
    this.groundY = this._groundAt(pos.x, pos.z);
    if (this.jumpDelay >= 0) {
      this.jumpDelay -= dt;
      if (this.jumpDelay < 0 && this.grounded && this.alive) {
        this.vy = JUMP_VEL;
        this.grounded = false;
      }
    }
    if (!this.grounded || pos.y > this.groundY + 0.001) {
      this.vy -= GRAVITY * dt;
      pos.y += this.vy * dt;
      if (pos.y <= this.groundY) {
        pos.y = this.groundY;
        this.vy = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    } else {
      pos.y = this.groundY;
    }

    _anim.speed01 = speed01;
    _anim.grounded = this.grounded;
    _anim.action = this.action;
    _anim.actionT = this.actionDur > 0 ? clamp(this.actionTime / this.actionDur, 0, 1) : 0;
    _anim.combo = this.animCombo || 0;
    if (this.actionKind === 'ko') _anim.actionT = clamp(this.actionTime / 1, 0, 1);
    if (this.actionKind === 'cheer') _anim.actionT = clamp(this.actionTime / 1.2, 0, 1);
    this.kid.update(dt, _anim);
  }

  // ---------------------------------------------------------------- movement helpers
  /** Arrival steering toward `goal`; writes into out, returns XZ distance. */
  _steerTo(goal, stopDist, maxSpeed, out) {
    const pos = this.object3d.position;
    const dx = goal.x - pos.x, dz = goal.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d <= stopDist || d < 1e-4) { out.set(0, 0, 0); return d; }
    const slow = Math.min(maxSpeed, (d - stopDist) * 3.5);
    out.set((dx / d) * slow, 0, (dz / d) * slow);
    return d;
  }

  _followFormation(maxSpeed) {
    this._slotPosition(_v1);
    const pos = this.object3d.position;
    const d = Math.hypot(_v1.x - pos.x, _v1.z - pos.z);
    if (this.idle) {
      if (d > ARRIVE_RESUME) this.idle = false;
    } else if (d < ARRIVE_STOP) {
      this.idle = true;
    }
    if (this.idle) { _desired.set(0, 0, 0); return; }
    // Hurry a bit when far behind.
    const boost = d > 8 ? 1.25 : 1;
    this._steerTo(_v1, 0, maxSpeed * boost, _desired);
  }

  _separation(out) {
    out.set(0, 0, 0);
    const pos = this.object3d.position;
    const party = this.game.party;
    if (party) for (let i = 0; i < party.length; i++) this._push(out, pos, party[i]);
    if (this.game.player?.object3d) this._push(out, pos, this.game.player);
    return out;
  }

  _push(out, pos, other) {
    if (!other || other === this || !other.object3d) return;
    const op = other.object3d.position;
    const dx = pos.x - op.x, dz = pos.z - op.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= SEPARATION_DIST * SEPARATION_DIST) return;
    const d = Math.sqrt(d2);
    if (d < 1e-3) { out.x += this.index === 0 ? 1 : -1; return; }
    const k = ((SEPARATION_DIST - d) / SEPARATION_DIST) * SEPARATION_PUSH;
    out.x += (dx / d) * k;
    out.z += (dz / d) * k;
  }

  _teleportToSlot() {
    const pos = this.object3d.position;
    this._slotPosition(pos);
    this.velocity.set(0, 0, 0);
    this.knockback.set(0, 0, 0);
    this.idle = true;
    const w = this.game.world;
    if (w?.resolveCollision) w.resolveCollision(pos, this.radius);
    this._spawnPoof(pos);
    this.game.events.emit('popup', { text: 'poof!', position: pos.clone().setY(pos.y + this.height + 0.3), style: 'info' });
  }

  _watchPlayerJump(dt) {
    const pl = this.game.player;
    const py = pl.object3d.position.y;
    const g = pl.grounded;
    let jumped = false;
    if (g !== undefined) jumped = this._playerWasGrounded === true && g === false && (pl.vy ?? pl.velocity?.y ?? 9) > 6; // a real jump, not an attack hop
    else jumped = this._lastPlayerY !== undefined && py - this._lastPlayerY > 4 * dt && py > this._groundAt(pl.object3d.position.x, pl.object3d.position.z) + 0.05 && this._lastPlayerY <= this._groundAt(pl.object3d.position.x, pl.object3d.position.z) + 0.05;
    this._playerWasGrounded = g;
    this._lastPlayerY = py;
    if (jumped && this.grounded && !this.actionKind && !this.target && this.jumpDelay < 0) {
      this.jumpDelay = this.heroId === 'dot' ? 0.12 : 0.22;
    }
  }

  // ---------------------------------------------------------------- targeting
  _pickTarget() {
    const game = this.game;
    const t = game.target;
    if (t && t.alive && t.team !== 'hero') return t;
    const center = game.player?.object3d?.position || this.object3d.position;
    // Sticky: keep our current target while it's alive and near the player.
    const cur = this.target;
    if (cur && cur.alive && cur.object3d) {
      const dx = cur.object3d.position.x - center.x, dz = cur.object3d.position.z - center.z;
      if (dx * dx + dz * dz < LEASH_RADIUS * LEASH_RADIUS) return cur;
    }
    const enemies = game.enemies;
    if (!enemies) return null;
    if (enemies.getNearest) {
      const e = enemies.getNearest(center, ENGAGE_RADIUS);
      return e && e.alive ? e : null;
    }
    const list = enemies.list;
    if (!list) return null;
    let best = null, bestD = ENGAGE_RADIUS * ENGAGE_RADIUS;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      const p = e.object3d.position;
      const d = (p.x - center.x) ** 2 + (p.z - center.z) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // ---------------------------------------------------------------- Moose
  _engageMelee(target, maxSpeed, busy) {
    const pos = this.object3d.position;
    const tp = target.object3d.position;
    const dx = tp.x - pos.x, dz = tp.z - pos.z;
    const d = Math.hypot(dx, dz);
    const reach = this.cfg.attackRange + (target.radius || 0.5);
    this.idle = false;

    // MOOSE TACKLE: a short charge when there's a bit of runway.
    if (!busy && this.tackleCooldown <= 0 && d < 8) {
      this.object3d.rotation.y = yawTo(dx, dz);
      this._startAction('tackle', 'attack', MOOSE_TACKLE_TIME, 2);
      this.tackleCooldown = MOOSE_TACKLE_COOLDOWN;
      this.game.events.emit('sfx', { name: 'whistle' });
      return;
    }

    this._steerTo(tp, reach * 0.75, maxSpeed, _desired);
    if (!busy && d <= reach && this.attackCooldown <= 0) {
      const c = this.combo >= 1 ? 1 : 0;
      this._startAction('melee', 'attack', c === 0 ? 0.38 : 0.46, c);
      this.attackCooldown = c === 0 ? 0.42 : this.cfg.cooldown * 1.6;
    }
  }

  _updateTackle(dt) {
    const pos = this.object3d.position;
    const yaw = this.object3d.rotation.y;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const sp = MOOSE_TACKLE_SPEED * (this.status.speedMul ? this.status.speedMul() : 1);
    this.velocity.set(fx * sp, 0, fz * sp);
    pos.x += this.velocity.x * dt;
    pos.z += this.velocity.z * dt;

    const t = this.target;
    let contact = false;
    if (t && t.alive) {
      const tp = t.object3d.position;
      const d = Math.hypot(tp.x - pos.x, tp.z - pos.z);
      contact = d < this.radius + (t.radius || 0.5) + 0.7;
    }
    if (!this.actionFired && (contact || this.actionTime >= this.actionDur * 0.9)) {
      this.actionFired = true;
      this.game.combat?.meleeSweep(this, {
        range: this.cfg.attackRange + 0.6,
        arc: 2.4,
        damage: Math.round(this.cfg.damage * 1.8),
        knockback: 16,
        text: 'MOOSE TACKLE!',
      });
      this.game.combat?.hitstop?.(0.06);
      this.game.events.emit('sfx', { name: 'smash' });
      // Stop the charge on impact.
      this.actionTime = Math.max(this.actionTime, this.actionDur - 0.12);
    }
    if (this.actionTime >= this.actionDur) {
      this.velocity.multiplyScalar(0.2);
      this._endAction();
    }
  }

  // ---------------------------------------------------------------- Dot
  _wantsHeal() {
    if (this.heroId !== 'dot') return false;
    if (this.healCooldown > 0 && !this.healing) return false;
    const p = this.game.player;
    if (!p || !p.alive || !p.object3d) return false;
    return this.healing || p.hp < p.maxHp * 0.4;
  }

  _updateCast() {
    if (!this.actionFired && this.actionTime >= this.actionDur * 0.45) {
      this.actionFired = true;
      const p = this.game.player;
      if (p && p.alive) this.game.combat?.heal(p, DOT_HEAL_AMOUNT, 'Dot shared her lunch!');
      this.game.events.emit('sfx', { name: 'heal' });
      this.healCooldown = DOT_HEAL_COOLDOWN;
      this.healing = false;
    }
  }

  _engageRanged(target, maxSpeed, busy, dt) {
    const pos = this.object3d.position;
    const tp = target.object3d.position;
    const dx = tp.x - pos.x, dz = tp.z - pos.z;
    const d = Math.hypot(dx, dz) || 1e-3;
    const nx = dx / d, nz = dz / d;
    this.idle = false;

    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) { this.strafeSign *= -1; this.strafeTimer = rand(2, 4); }

    let radial = 0;
    if (d > DOT_MAX) radial = Math.min(1, (d - DOT_MAX) * 0.8 + 0.3);
    else if (d < DOT_MIN) radial = -Math.min(1, (DOT_MIN - d) * 0.6 + 0.3);
    const strafe = 0.35 * this.strafeSign;
    // tangent = (-nz, nx)
    _desired.set((nx * radial - nz * strafe) * maxSpeed, 0, (nz * radial + nx * strafe) * maxSpeed);

    if (!busy && this.attackCooldown <= 0 && d <= this.cfg.attackRange + 2) {
      this._startAction('throw', 'attack', 0.34, 0);
      this.attackCooldown = this.cfg.cooldown;
    }
  }

  _throwCard() {
    const t = this.target;
    if (!t || !t.alive || !this.game.combat) return;
    const pos = this.object3d.position;
    const yaw = this.object3d.rotation.y;
    _origin.set(pos.x + Math.sin(yaw) * 0.5, pos.y + 1.0, pos.z + Math.cos(yaw) * 0.5);
    const tp = t.object3d.position;
    _dir.set(tp.x - _origin.x, tp.y + (t.height || 1.2) * 0.5 - _origin.y, tp.z - _origin.z).normalize();
    const mesh = acquireFlashcard();
    mesh.position.copy(_origin);
    mesh.rotation.set(0, yaw, 0);
    this.lastCard = mesh;
    this.game.combat.spawnProjectile({
      owner: this,
      position: _origin,
      direction: _dir,
      speed: 15,
      damage: this.cfg.damage,
      radius: 0.4,
      color: 0xffffff,
      life: 2.2,
      homing: t,
      text: 'Fact Attack!',
      mesh,
    });
    this.game.events.emit('sfx', { name: 'swing' });
  }

  // ---------------------------------------------------------------- shared attack timing
  _updateAttackTiming() {
    if (this.actionFired) return;
    const k = this.actionKind;
    if (k === 'melee' && this.actionTime >= this.actionDur * 0.4) {
      this.actionFired = true;
      const c = this.combo;
      this.game.combat?.meleeSweep(this, {
        range: this.cfg.attackRange + 0.3,
        arc: 2.0,
        damage: c === 0 ? this.cfg.damage : Math.round(this.cfg.damage * 1.35),
        knockback: c === 0 ? 4 : 8,
        text: c === 0 ? 'Oof!' : 'Big Hug!',
      });
      this.game.events.emit('sfx', { name: 'swing' });
      this.combo = c === 0 ? 1 : 0;
      this.comboResetT = c === 0 ? 1.2 : 0;
    } else if (k === 'throw' && this.actionTime >= this.actionDur * 0.45) {
      this.actionFired = true;
      this._throwCard();
    }
  }

  // ---------------------------------------------------------------- KO / revive
  _updateKO(dt) {
    this.koTimer -= dt;
    this.velocity.set(0, 0, 0);
    if (this.koTimer <= 0) this._revive();
  }

  // ---------------------------------------------------------------- barks
  _barkTick(dt) {
    const crew = this.crew;
    if (!crew || crew.leader !== this) return;
    const ms = crew.members;
    let n = 0;
    for (let i = 0; i < ms.length; i++) if (ms[i].alive && ms[i].target) n++;
    if (!n) return;
    crew.barkTimer -= dt;
    if (crew.barkTimer > 0) return;
    let pickN = (Math.random() * n) | 0;
    let m = null;
    for (let i = 0; i < ms.length; i++) {
      if (ms[i].alive && ms[i].target && pickN-- === 0) { m = ms[i]; break; }
    }
    if (!m) return;
    const lines = BARKS[m.heroId];
    let i = (Math.random() * lines.length) | 0;
    if (i === crew.lastLine[m.heroId]) i = (i + 1) % lines.length;
    crew.lastLine[m.heroId] = i;
    this.game.events.emit('dialogue', { speaker: m.name, text: lines[i], duration: 2.5 });
    crew.barkTimer = rand(25, 45);
  }

  // ---------------------------------------------------------------- poof fx
  _spawnPoof(at) {
    this.poof.position.copy(at);
    this.poof.visible = true;
    this.poofT = 0;
  }

  _updatePoof(dt) {
    if (!this.poof.visible) return;
    this.poofT += dt;
    const t = this.poofT / 0.45;
    if (t >= 1) { this.poof.visible = false; return; }
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i];
      const dir = p.userData.dir;
      const r = 0.3 + t * 1.2;
      p.position.set(dir.x * r, dir.y * (0.5 + t), dir.z * r);
      p.scale.setScalar(1.2 * (1 - t) + 0.1);
    }
  }
}
