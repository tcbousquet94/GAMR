// Base enemy: physics body, statuses, telegraph state, movement (flow field on the street, direct steering when
// elevated or close, wall-climbing when the target is above), stuck recovery, barks.

import { makeBody, moveBody } from '../physics.js';
import { PHYS, COMBAT } from '../../core/config.js';
import { clamp, finite, angleDiff } from '../../core/math.js';

let NEXT = 1;

export class Enemy {
  constructor(game, def, pos, level) {
    this.game = game;
    this.def = def;
    this.id = NEXT++;
    this.type = def.id;
    this.level = level;
    const hpMul = 1 + 0.32 * (level - 1);
    this.maxHp = def.hp * hpMul;
    this.hp = this.maxHp;
    this.dmgMul = 1 + 0.2 * (level - 1);
    this.body = makeBody(pos.x, pos.y + 0.05, pos.z, def.radius ?? 0.45, def.height ?? 1.8);
    this.body.canMantle = true;
    this.speed = def.speed;
    this.alive = true;
    this.yaw = 0;
    this.flash = 0;
    this.stunned = 0;
    this.cited = 0;
    this.slowMul = 1;
    this.slowT = 0;
    this.burns = [];
    this.burnTick = 0;
    this.telegraph = 0; // 0..1, drives the white-flash warning
    this.state = 'chase';
    this.stateT = 0;
    this.attackCd = def.attackCd ? def.attackCd * (0.5 + game.rng.next()) : 2;
    this.barkCd = 3 + game.rng.next() * 6;
    this.knockV = { x: 0, z: 0 };
    this.stuckT = 0;
    this.lastProgress = { x: pos.x, z: pos.z, t: 0 };
    this.anim = 0;
    this.climbing = false;
    this.spawnT = 0;
  }

  get pos() { return this.body.pos; }
  center() { const p = this.body.pos; return { x: p.x, y: p.y + this.body.h * 0.55, z: p.z }; }
  hitPoints() {
    const p = this.body.pos, h = this.body.h, r = this.body.r;
    return [{ x: p.x, y: p.y + h * 0.35, z: p.z, r: r * 1.2, part: 'body' }, { x: p.x, y: p.y + h * 0.78, z: p.z, r: r * 1.0, part: 'head' }];
  }

  knock(x, y, z) {
    const k = this.def.knockMul ?? 1;
    const l = Math.hypot(x, y, z);
    const s = l * k > COMBAT.knockbackMaxSpeed ? COMBAT.knockbackMaxSpeed / l : k;
    this.knockV.x += x * s; this.knockV.z += z * s;
    if (y > 0) this.body.vel.y = Math.max(this.body.vel.y, y * s);
  }

  target() { return this.game.player; }

  update(dt) {
    const g = this.game;
    this.spawnT += dt;
    g.combat.tickStatus(this, dt);
    if (!this.alive) return;
    this.stateT += dt;
    this.attackCd -= dt;
    this.barkCd -= dt;
    if (this.stunned > 0) { this.telegraph = 0; this.moveTo(dt, null, 0); return; }
    this.think(dt);
    if (this.barkCd <= 0) { this.barkCd = 8 + g.rng.next() * 10; this.bark(); }
  }

  bark(line) {
    const lines = this.def.barks;
    if (!lines && !line) return;
    this.game.events.emit('bark', { id: this.id, text: line || this.game.rng.pick(lines), type: this.type });
  }

  facePlayer(dt, rate = 10) {
    const P = this.target();
    const want = Math.atan2(-(P.pos.x - this.pos.x), -(P.pos.z - this.pos.z));
    this.yaw += clamp(angleDiff(this.yaw, want), -rate * dt, rate * dt);
  }

  distToPlayer() {
    const P = this.target();
    return Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
  }

  canSeePlayer() {
    const P = this.target();
    const c = this.center();
    return this.game.world.segmentClear(c, { x: P.pos.x, y: P.pos.y + 1.2, z: P.pos.z });
  }

  // Move toward a goal (null = just apply physics). speedMul scales def.speed.
  moveTo(dt, goal, speedMul = 1) {
    const g = this.game;
    const b = this.body;
    let dx = 0, dz = 0;
    if (goal) {
      const P = goal;
      const toX = P.x - b.pos.x, toZ = P.z - b.pos.z;
      const dist = Math.hypot(toX, toZ);
      const flowG = g.flow.groundAt(b.pos.x, b.pos.z);
      const onStreetLevel = Math.abs(b.pos.y - flowG) < 1.2;
      let dir = null;
      if (onStreetLevel && dist > 5 && !(dist < 24 && this.canSeePlayer())) dir = g.flow.dir(b.pos.x, b.pos.z);
      if (!dir && dist > 0.01) dir = { x: toX / dist, z: toZ / dist };
      if (dir) { dx = dir.x; dz = dir.z; }
      if (!this.def.noFace) this.yaw = Math.atan2(-dx, -dz);
    }
    const sp = this.speed * speedMul * this.slowMul;
    const accel = b.onGround ? 30 : 8;
    b.vel.x += clamp(dx * sp - b.vel.x, -accel * dt, accel * dt);
    b.vel.z += clamp(dz * sp - b.vel.z, -accel * dt, accel * dt);
    // Knockback impulse decays separately so AI acceleration doesn't cancel it instantly.
    b.vel.x += this.knockV.x; b.vel.z += this.knockV.z;
    const kd = Math.exp(-6 * dt);
    const kvx = this.knockV.x, kvz = this.knockV.z;
    this.knockV.x *= kd; this.knockV.z *= kd;
    // Climb walls toward a target above; hop small obstacles.
    const P = this.target();
    const wantUp = goal && P.pos.y > b.pos.y + 2.5 && this.def.climbs !== false;
    this.climbing = false;
    if (b.blocked && goal) {
      if (wantUp) { b.vel.y = 6.5; this.climbing = true; }
      else if (b.onGround) b.vel.y = 8.5;
    }
    if (!this.climbing && !this.def.flies) b.vel.y = Math.max(-PHYS.maxFallSpeed, b.vel.y - PHYS.gravity * dt);
    moveBody(b, g.world, dt);
    b.vel.x -= kvx; b.vel.z -= kvz;
    this.anim += Math.hypot(b.vel.x, b.vel.z) * dt;
    this.checkStuck(dt, goal);
  }

  checkStuck(dt, goal) {
    const g = this.game;
    const b = this.body;
    if (b.pos.y < PHYS.killY || !Number.isFinite(b.pos.x + b.pos.y + b.pos.z)) { g.director.relocate(this); return; }
    if (!goal) return;
    this.lastProgress.t += dt;
    if (this.lastProgress.t > 4) {
      const moved = Math.hypot(b.pos.x - this.lastProgress.x, b.pos.z - this.lastProgress.z);
      if (moved < 1.5 && this.distToPlayer() > 8 && this.state === 'chase') g.director.relocate(this);
      this.lastProgress = { x: b.pos.x, z: b.pos.z, t: 0 };
    }
    // Inside geometry: relocate.
    if (!g.world.fits(b.pos.x, b.pos.y + 0.05, b.pos.z, b.r * 0.8, b.h * 0.9)) {
      this.inside = (this.inside || 0) + dt;
      if (this.inside > 0.5) { this.inside = 0; g.director.relocate(this); }
    } else this.inside = 0;
  }

  think(dt) { this.moveTo(dt, this.target().pos); }
}

export function finiteDir(x, z) {
  const l = Math.hypot(x, z);
  return l > 1e-6 ? { x: finite(x / l), z: finite(z / l) } : { x: 0, z: 1 };
}
