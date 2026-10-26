// Downtown enemy roster + the HOA President boss and her minions. Every attack has a visible wind-up
// (this.telegraph ramps 0 -> 1, rendered as a white flash) before it lands.

import { Enemy, finiteDir } from './base.js';
import { clamp } from '../../core/math.js';
import { moveBody } from '../physics.js';
import { GANG_DEFS, GANG_CLASSES } from './gang.js';

export const ENEMY_DEFS = {
  speakerphone: {
    id: 'speakerphone', name: 'Speakerphone Guy', title: "He's Never Hung Up.", hp: 85, speed: 4.4, radius: 0.45, height: 1.85,
    attackCd: 3.4, cost: 14, drop: 1.2,
    barks: ['I\'M ON A CALL!', 'Can you hear me now?!', 'NO, YOU listen!', 'Hold on, I\'m losing you!', 'You\'re on SPEAKER!', 'Let me loop in Gary!'],
  },
  scooter: {
    id: 'scooter', name: 'Scooter Bro', title: 'Rider of the Sidewalk.', hp: 65, speed: 6.4, radius: 0.5, height: 1.8,
    attackCd: 2.6, cost: 11, drop: 1.0,
    barks: ['ON YOUR LEFT!', 'Sidewalk\'s mine, bro!', 'Ding ding!', 'Zero emissions, bro!', 'It\'s a lifestyle!'],
  },
  canvasser: {
    id: 'canvasser', name: 'The Canvasser', title: 'Got a Minute?', hp: 75, speed: 6.9, radius: 0.45, height: 1.8,
    attackCd: 1.6, cost: 9, drop: 0.9,
    barks: ['Got a minute?', 'Do you have a minute for the planet?', 'Just a quick signature!', 'It\'ll only take a second!', 'Hi! Hello! Hi!'],
  },
  hoa: {
    id: 'hoa', name: 'The HOA President', title: 'Supreme Enforcer of the Bylaws.', hp: 2600, speed: 3.7, radius: 1.3, height: 5.5,
    attackCd: 2.2, cost: 200, drop: 12, knockMul: 0.04, climbs: false, boss: true,
    barks: ['This will go in your PERMANENT FILE.', 'I\'ve called a SPECIAL MEETING.', 'Did you read the bylaws?', 'Motion to EVICT!'],
  },
  drone: {
    id: 'drone', name: 'Parking Enforcement Drone', hp: 45, speed: 9, radius: 0.55, height: 0.6, attackCd: 2.4, cost: 0, drop: 0.3, flies: true, climbs: false,
  },
  notice: {
    id: 'notice', name: 'Violation Notice', hp: 10, speed: 13, radius: 0.4, height: 0.5, cost: 0, drop: 0, flies: true, climbs: false, noFace: true,
  },
};

export const SECTIONS = [
  ['Section 4.2', 'Exterior Paint!'], ['Section 7.1', 'Lawn Height!'], ['Section 3.6', 'Improper Storage!'],
  ['Section 5.4', 'Parking Infraction!'], ['Section 8.3', 'Unapproved Decor!'],
];

export class Speakerphone extends Enemy {
  constructor(g, pos, lvl) { super(g, ENEMY_DEFS.speakerphone, pos, lvl); this.stunImmune = 0; }
  phonePoint() {
    const p = this.pos, s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    // Held up in front of his face, slightly to his right.
    return { x: p.x - s * 0.45 + c * 0.25, y: p.y + 1.55, z: p.z - c * 0.45 - s * 0.25 };
  }
  hitPoints() { const h = super.hitPoints(); const ph = this.phonePoint(); h.push({ ...ph, r: 0.32, part: 'phone' }); return h; }
  onPhoneHit() {
    if (this.stunImmune > 0) return;
    this.stunned = 2.2; this.stunImmune = 4; this.state = 'chase'; this.telegraph = 0;
    this.game.events.emit('stun', { id: this.id, reason: 'phone' });
    this.bark('Hello? HELLO?!');
  }
  update(dt) { this.stunImmune = Math.max(0, this.stunImmune - dt); super.update(dt); }
  think(dt) {
    const P = this.target();
    const d = this.distToPlayer();
    if (this.state === 'chase') {
      this.telegraph = 0;
      let goal = P.pos;
      if (d < 10) { const k = finiteDir(this.pos.x - P.pos.x, this.pos.z - P.pos.z); goal = { x: this.pos.x + k.x * 6, z: this.pos.z + k.z * 6 }; }
      if (d > 11 && d < 20 && this.canSeePlayer()) goal = null;
      this.moveTo(dt, goal, 1);
      if (!goal || d < 10) this.facePlayer(dt);
      if (this.attackCd <= 0 && d < 24 && this.canSeePlayer()) { this.state = 'windup'; this.stateT = 0; this.bark(); }
    } else if (this.state === 'windup') {
      this.telegraph = clamp(this.stateT / 0.85, 0, 1);
      this.facePlayer(dt, 6);
      this.moveTo(dt, null);
      if (this.stateT >= 0.85) {
        const g = this.game;
        const c = this.phonePoint();
        const tp = { x: P.pos.x, y: P.pos.y + 1, z: P.pos.z };
        const base = Math.atan2(tp.x - c.x, tp.z - c.z);
        const pitch = Math.atan2(tp.y - c.y, Math.hypot(tp.x - c.x, tp.z - c.z));
        for (const off of [-0.22, 0, 0.22]) {
          const a = base + off;
          g.projectiles.wave(this, c, { x: Math.sin(a) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(a) * Math.cos(pitch) }, 9 * this.dmgMul, 17);
        }
        g.events.emit('enemyAttack', { id: this.id, kind: 'soundwave', pos: c });
        this.state = 'recover'; this.stateT = 0; this.attackCd = this.def.attackCd; this.telegraph = 0;
      }
    } else {
      this.moveTo(dt, null);
      if (this.stateT > 0.6) this.state = 'chase';
    }
  }
}

export class Scooter extends Enemy {
  constructor(g, pos, lvl) { super(g, ENEMY_DEFS.scooter, pos, lvl); this.vulnerableWhenStunned = true; }
  think(dt) {
    const g = this.game;
    const P = this.target();
    const d = this.distToPlayer();
    if (this.state === 'chase') {
      this.telegraph = 0;
      this.moveTo(dt, P.pos, 1);
      if (this.attackCd <= 0 && d > 5 && d < 24 && Math.abs(P.pos.y - this.pos.y) < 3 && this.canSeePlayer()) {
        this.state = 'windup'; this.stateT = 0;
        g.events.emit('bell', { id: this.id, pos: this.center() });
        this.bark('ON YOUR LEFT!');
      }
    } else if (this.state === 'windup') {
      this.telegraph = clamp(this.stateT / 0.9, 0, 1);
      this.facePlayer(dt, 8);
      this.moveTo(dt, null);
      if (this.stateT >= 0.9) {
        this.chargeDir = finiteDir(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
        this.yaw = Math.atan2(-this.chargeDir.x, -this.chargeDir.z);
        this.state = 'charge'; this.stateT = 0; this.hitDone = false; this.telegraph = 0;
      }
    } else if (this.state === 'charge') {
      const b = this.body;
      b.vel.x = this.chargeDir.x * 24; b.vel.z = this.chargeDir.z * 24;
      this.moveToRaw(dt);
      const dp = Math.hypot(P.pos.x - b.pos.x, P.pos.z - b.pos.z);
      if (!this.hitDone && dp < 1.5 && Math.abs(P.pos.y - b.pos.y) < 1.6) {
        this.hitDone = true;
        const dealt = g.combat.hurtPlayer(P, 13 * this.dmgMul, { source: 'scooter', knock: { x: this.chargeDir.x * 18, y: 7, z: this.chargeDir.z * 18 }, from: b.pos });
        this.state = 'recover'; this.stateT = 0; this.attackCd = this.def.attackCd;
        if (!dealt) this.crash(); // dodged or blocked: he still eats pavement
      } else if (this.stateT > 1.5 || b.blocked) this.crash();
    } else if (this.state === 'crashed') {
      this.moveTo(dt, null);
      if (this.stunned <= 0) { this.state = 'chase'; this.attackCd = this.def.attackCd; }
    } else {
      this.moveTo(dt, null);
      if (this.stateT > 0.8) this.state = 'chase';
    }
  }
  crash() {
    this.state = 'crashed'; this.stateT = 0;
    this.stunned = 2.5;
    this.body.vel.x *= 0.2; this.body.vel.z *= 0.2;
    this.game.events.emit('crash', { id: this.id, pos: this.center() });
    this.bark('Bro...');
  }
  moveToRaw(dt) {
    const b = this.body;
    b.vel.y -= 30 * dt;
    b.canMantle = false; // a charging scooter hits walls instead of vaulting them
    moveBody(b, this.game.world, dt);
    b.canMantle = true;
    this.anim += 24 * dt;
  }
}

export class Canvasser extends Enemy {
  constructor(g, pos, lvl) { super(g, ENEMY_DEFS.canvasser, pos, lvl); this.latching = true; }
  think(dt) {
    const g = this.game;
    const P = this.target();
    const d = this.distToPlayer();
    if (this.state === 'chase') {
      this.telegraph = 0;
      this.moveTo(dt, P.pos, 1);
      if (this.attackCd <= 0 && d < 4 && Math.abs(P.pos.y - this.pos.y) < 1.5 && !P.latchedBy) { this.state = 'windup'; this.stateT = 0; this.bark('Got a minute?'); }
    } else if (this.state === 'windup') {
      this.telegraph = clamp(this.stateT / 0.55, 0, 1);
      this.facePlayer(dt, 10);
      this.moveTo(dt, null);
      if (this.stateT >= 0.55) { this.state = 'lunge'; this.stateT = 0; this.telegraph = 0; this.dir = finiteDir(P.pos.x - this.pos.x, P.pos.z - this.pos.z); }
    } else if (this.state === 'lunge') {
      const b = this.body;
      b.vel.x = this.dir.x * 13; b.vel.z = this.dir.z * 13;
      b.vel.y -= 30 * dt;
      moveBody(b, g.world, dt);
      const dp = Math.hypot(P.pos.x - b.pos.x, P.pos.z - b.pos.z);
      if (dp < 1.3 && Math.abs(P.pos.y - b.pos.y) < 1.5 && !P.latchedBy && P.invuln <= 0) {
        const blocked = g.combat.hurtPlayer(P, 4 * this.dmgMul, { source: 'canvasser' });
        if (blocked > 0) {
          this.state = 'latched'; this.stateT = 0;
          P.latchedBy = this;
          g.events.emit('latch', { id: this.id });
          this.bark(g.rng.pick(this.def.barks));
        } else { this.state = 'recover'; this.stateT = 0; this.attackCd = this.def.attackCd; }
      } else if (this.stateT > 0.4) { this.state = 'recover'; this.stateT = 0; this.attackCd = this.def.attackCd; }
    } else if (this.state === 'latched') {
      // Cling to the survivor's front, slowing them and chipping health. Dash (Salsa Step) breaks free.
      if (P.latchedBy !== this || P.dead) { this.state = 'recover'; this.stateT = 0; return; }
      const f = P.forward();
      const b = this.body;
      const tx = P.pos.x + f.x * 0.75, tz = P.pos.z + f.z * 0.75;
      if (g.world.fits(tx, P.pos.y, tz, b.r * 0.6, b.h * 0.9)) { b.pos.x = tx; b.pos.z = tz; b.pos.y = P.pos.y; }
      b.vel.x = b.vel.y = b.vel.z = 0;
      this.yaw = P.yaw + Math.PI;
      this.tick = (this.tick || 0) - dt;
      if (this.tick <= 0) { this.tick = 0.5; g.combat.hurtPlayer(P, 2 * this.dmgMul, { source: 'canvasser', unblockable: false }); }
      if (this.stateT > 1.2 && g.rng.next() < dt * 0.6) this.bark();
      if (this.stateT > 7) this.breakLatch();
    } else {
      this.moveTo(dt, null);
      if (this.stateT > 0.7) this.state = 'chase';
    }
  }
  breakLatch() {
    const P = this.target();
    if (P.latchedBy === this) P.latchedBy = null;
    const d = finiteDir(this.pos.x - P.pos.x, this.pos.z - P.pos.z);
    this.knock(d.x * 10, 4, d.z * 10);
    this.stunned = 1.5;
    this.state = 'recover'; this.stateT = 0; this.attackCd = this.def.attackCd * 2;
    this.game.events.emit('unlatch', { id: this.id });
  }
}

export class Notice extends Enemy {
  constructor(g, pos, lvl, section) {
    super(g, ENEMY_DEFS.notice, pos, lvl);
    this.minion = true;
    this.section = section;
    this.life = 7;
    const P = g.player;
    const d = finiteDir(P.pos.x - pos.x, P.pos.z - pos.z);
    this.vel = { x: d.x * 6, y: 7, z: d.z * 6 };
  }
  hitPoints() { const c = this.center(); return [{ ...c, r: 0.55, part: 'body' }]; }
  center() { return { ...this.body.pos }; }
  update(dt) {
    const g = this.game;
    g.combat.tickStatus(this, dt);
    if (!this.alive) return;
    this.life -= dt;
    const P = g.player;
    const tp = { x: P.pos.x, y: P.pos.y + 1.1, z: P.pos.z };
    const p = this.body.pos;
    const sp = 13 * this.slowMul;
    const dx = tp.x - p.x, dy = tp.y - p.y, dz = tp.z - p.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    const k = Math.min(1, 2.2 * dt);
    this.vel.x += ((dx / l) * sp - this.vel.x) * k; this.vel.y += ((dy / l) * sp - this.vel.y) * k; this.vel.z += ((dz / l) * sp - this.vel.z) * k;
    p.x += this.vel.x * dt; p.y += this.vel.y * dt; p.z += this.vel.z * dt;
    this.yaw += dt * 6;
    if (l < 1.1 && P.alive) { g.combat.hurtPlayer(P, 10 * this.dmgMul, { source: 'notice' }); this.alive = false; g.events.emit('impact', { kind: 'notice', pos: { ...p } }); return; }
    if (this.life <= 0 || !g.world.fits(p.x, p.y - 0.2, p.z, 0.15, 0.4)) { this.alive = false; g.events.emit('impact', { kind: 'notice', pos: { ...p } }); }
  }
}

export class Drone extends Enemy {
  constructor(g, pos, lvl) {
    super(g, ENEMY_DEFS.drone, pos, lvl);
    this.orbit = g.rng.next() * Math.PI * 2;
    this.dropMul = 0.3;
  }
  hitPoints() { return [{ ...this.center(), r: 0.75, part: 'body' }]; }
  center() { return { ...this.body.pos }; }
  update(dt) {
    const g = this.game;
    g.combat.tickStatus(this, dt);
    if (!this.alive) return;
    this.attackCd -= dt;
    const P = g.player;
    const p = this.body.pos;
    if (this.stunned > 0) { p.y -= 2 * dt; this.telegraph = 0; return; }
    this.orbit += dt * 0.6;
    const R = 11;
    const goal = { x: P.pos.x + Math.cos(this.orbit) * R, y: P.pos.y + 6, z: P.pos.z + Math.sin(this.orbit) * R };
    const dx = goal.x - p.x, dy = goal.y - p.y, dz = goal.z - p.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    const sp = Math.min(this.speed * this.slowMul, l * 2);
    const nx = p.x + (dx / l) * sp * dt + this.knockV.x * dt, ny = p.y + (dy / l) * sp * dt, nz = p.z + (dz / l) * sp * dt + this.knockV.z * dt;
    this.knockV.x *= Math.exp(-4 * dt); this.knockV.z *= Math.exp(-4 * dt);
    if (g.world.fits(nx, ny - 0.3, nz, 0.5, 0.6)) { p.x = nx; p.y = ny; p.z = nz; } else p.y += 4 * dt;
    this.yaw = Math.atan2(-(P.pos.x - p.x), -(P.pos.z - p.z));
    if (this.state === 'windup') {
      this.telegraph = clamp(this.stateT / 0.7, 0, 1);
      this.stateT += dt;
      if (this.stateT >= 0.7) {
        const d = { x: P.pos.x - p.x, y: P.pos.y + 1 - p.y, z: P.pos.z - p.z };
        const L = Math.hypot(d.x, d.y, d.z) || 1;
        g.projectiles.ticket(this, { x: p.x, y: p.y - 0.4, z: p.z }, { x: d.x / L, y: d.y / L, z: d.z / L }, 6 * this.dmgMul);
        g.events.emit('enemyAttack', { id: this.id, kind: 'ticket', pos: { ...p } });
        this.state = 'chase'; this.attackCd = this.def.attackCd; this.telegraph = 0;
      }
    } else if (this.attackCd <= 0 && g.world.segmentClear(p, { x: P.pos.x, y: P.pos.y + 1, z: P.pos.z })) { this.state = 'windup'; this.stateT = 0; }
  }
}

export class HOA extends Enemy {
  constructor(g, pos, lvl) {
    super(g, ENEMY_DEFS.hoa, pos, lvl);
    this.boss = true;
    this.knockImmune = false;
    this.slamR = -1;
    this.cycle = 0;
  }
  hitPoints() {
    const p = this.pos;
    return [
      { x: p.x, y: p.y + 1.2, z: p.z, r: 1.1, part: 'body' }, { x: p.x, y: p.y + 3.2, z: p.z, r: 1.5, part: 'body' },
      { x: p.x, y: p.y + 4.9, z: p.z, r: 0.8, part: 'head' },
    ];
  }
  center() { const p = this.pos; return { x: p.x, y: p.y + 3, z: p.z }; }
  think(dt) {
    const g = this.game;
    const P = this.target();
    const d = this.distToPlayer();
    // Shockwave from the gavel slam expands outward; jump over it.
    if (this.slamR >= 0) {
      const prev = this.slamR;
      this.slamR += 20 * dt;
      const pd = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
      if (!this.slamHit && pd >= prev - 1.2 && pd <= this.slamR + 1.2 && P.body.onGround && Math.abs(P.pos.y - this.pos.y) < 2.5) {
        this.slamHit = true;
        const k = finiteDir(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
        g.combat.hurtPlayer(P, 26 * this.dmgMul, { source: 'gavel', knock: { x: k.x * 14, y: 11, z: k.z * 14 }, stagger: 0.5 });
      }
      if (this.slamR > 16) this.slamR = -1;
    }
    if (this.state === 'chase') {
      this.telegraph = 0;
      this.moveTo(dt, d > 7 ? P.pos : null, 1);
      this.facePlayer(dt, 3);
      if (this.attackCd <= 0) {
        const drones = g.enemies.filter((e) => e.alive && e.type === 'drone').length;
        let atk;
        if (d < 11 && Math.abs(P.pos.y - this.pos.y) < 3) atk = 'gavel';
        else if (drones < 3 && this.cycle % 3 === 1) atk = 'drones';
        else atk = 'notices';
        this.cycle++;
        this.state = atk; this.stateT = 0; this.volley = 0;
        if (atk === 'notices') { this.section = g.rng.pick(SECTIONS); this.bark(`${this.section[0]}: ${this.section[1]}`); g.events.emit('bossAttack', { name: `${this.section[0]}: ${this.section[1]}` }); }
        if (atk === 'drones') { this.bark('Parking Enforcement! Code P-12!'); g.events.emit('bossAttack', { name: 'Parking Enforcement' }); }
        if (atk === 'gavel') { this.bark('ORDER! ORDER!'); g.events.emit('bossAttack', { name: 'Gavel Slam' }); }
      }
    } else if (this.state === 'notices') {
      this.moveTo(dt, null);
      this.facePlayer(dt, 4);
      this.telegraph = clamp(this.stateT / 0.8, 0, 1);
      if (this.stateT > 0.8 && this.volley < 5 && this.stateT > 0.8 + this.volley * 0.22) {
        const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
        const p = this.pos;
        g.spawnEnemy('notice', { x: p.x - s * 1.5 + (this.volley - 2) * c * 0.8, y: p.y + 4.3, z: p.z - c * 1.5 - (this.volley - 2) * s * 0.8 }, this.section);
        this.volley++;
      }
      if (this.stateT > 2.2) this.endAttack();
    } else if (this.state === 'drones') {
      this.moveTo(dt, null);
      this.telegraph = clamp(this.stateT / 1.0, 0, 1);
      if (this.stateT > 1.0 && !this.summoned) {
        this.summoned = true;
        for (let i = 0; i < 3; i++) g.spawnEnemy('drone', { x: this.pos.x + (i - 1) * 2, y: this.pos.y + 6, z: this.pos.z });
      }
      if (this.stateT > 1.6) { this.summoned = false; this.endAttack(); }
    } else if (this.state === 'gavel') {
      this.moveTo(dt, null);
      this.facePlayer(dt, 2);
      this.telegraph = clamp(this.stateT / 1.2, 0, 1);
      if (this.stateT > 1.2 && this.slamR < 0 && !this.slammed) {
        this.slammed = true;
        this.slamR = 0; this.slamHit = false;
        g.events.emit('bossSlam', { pos: { ...this.pos } });
      }
      if (this.stateT > 1.9) { this.slammed = false; this.endAttack(); }
    }
  }
  endAttack() { this.state = 'chase'; this.stateT = 0; this.telegraph = 0; this.attackCd = this.def.attackCd * (this.hp < this.maxHp * 0.5 ? 0.7 : 1); }
}

Object.assign(ENEMY_DEFS, GANG_DEFS); // the rival crew for the turf war's street fights (./gang.js)
export const ENEMY_CLASSES = { speakerphone: Speakerphone, scooter: Scooter, canvasser: Canvasser, hoa: HOA, drone: Drone, notice: Notice, ...GANG_CLASSES };
