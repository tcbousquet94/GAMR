import * as THREE from 'three';
import { clamp, dampAngle, yawTo } from '../core/math.js';

// EarthBound-style party line: in explore mode Dot and Moose walk exactly on Pip's path,
// a fixed distance apart, and stop when he stops. Pip's footsteps are recorded as a breadcrumb
// trail; each follower is placed at a set path-distance behind him.
// In battle mode the members' own combat AI (PartyMember.update) takes over instead.

const SPACING = 1.45;        // path distance between people in the line
const RECORD_STEP = 0.12;    // record a breadcrumb every this many units moved
const MAX_POINTS = 256;      // ring buffer size (~30 units of path)
const CATCH_RATE = 14;       // how tightly followers stick to their spot on the path
const RUN_SPEED = 7.5;
const IDLE_SIDESTEP = 0.85;  // when Pip stands still, followers step aside so they don't hide him
const IDLE_DELAY = 0.4;

const _goal = new THREE.Vector3();
const _anim = { speed01: 0, grounded: true, action: null, actionT: 0, combo: 0 };

export class PartyTrail {
  constructor(game) {
    this.game = game;
    // Ring buffer of breadcrumbs, newest at `head`. Each point: x, y, z.
    this.px = new Float32Array(MAX_POINTS);
    this.py = new Float32Array(MAX_POINTS);
    this.pz = new Float32Array(MAX_POINTS);
    this.head = -1;
    this.count = 0;
    this.lastSpeed = [0, 0];
    this.idleTime = 0;
    this.idleBlend = 0;
  }

  // Lay a straight trail behind the player (on spawn, after a door, after a battle),
  // and snap followers onto it.
  reset() {
    const p = this.game.player.object3d;
    const yaw = p.rotation.y;
    const bx = -Math.sin(yaw), bz = -Math.cos(yaw);
    this.head = -1;
    this.count = 0;
    this.idleTime = 0;
    this.idleBlend = 0;
    const n = Math.ceil((SPACING * (this.game.party.length + 1)) / RECORD_STEP);
    for (let i = n; i >= 0; i--) {
      const d = i * RECORD_STEP;
      const x = p.position.x + bx * d, z = p.position.z + bz * d;
      // Don't lay breadcrumbs inside walls: pull them toward the player if blocked.
      _goal.set(x, 0, z);
      this.game.world?.resolveCollision?.(_goal, 0.4);
      this.push(_goal.x, p.position.y, _goal.z);
    }
    for (let i = 0; i < this.game.party.length; i++) {
      const m = this.game.party[i];
      this.sample(SPACING * (i + 1), m.object3d.position);
      m.object3d.rotation.y = yaw;
      m.velocity?.set(0, 0, 0);
      m.knockback?.set(0, 0, 0);
    }
  }

  push(x, y, z) {
    this.head = (this.head + 1) % MAX_POINTS;
    this.px[this.head] = x;
    this.py[this.head] = y;
    this.pz[this.head] = z;
    this.count = Math.min(this.count + 1, MAX_POINTS);
  }

  // Point `dist` units back along the path from the player, written into `out`.
  sample(dist, out) {
    const p = this.game.player.object3d.position;
    let ax = p.x, ay = p.y, az = p.z;
    let left = dist;
    for (let k = 0; k < this.count; k++) {
      const i = (this.head - k + MAX_POINTS) % MAX_POINTS;
      const bx = this.px[i], by = this.py[i], bz = this.pz[i];
      const seg = Math.hypot(bx - ax, bz - az);
      if (seg >= left) {
        const t = seg > 1e-6 ? left / seg : 0;
        return out.set(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t);
      }
      left -= seg;
      ax = bx; ay = by; az = bz;
    }
    return out.set(ax, ay, az); // trail shorter than requested: end of the line
  }

  update(dt) {
    if (dt <= 0) return;
    const game = this.game;
    const player = game.player;
    const pp = player.object3d.position;
    if (this.count === 0) this.reset();

    // Record footsteps (y included, so followers hop where Pip hopped).
    const h = this.head;
    if (Math.hypot(pp.x - this.px[h], pp.z - this.pz[h]) >= RECORD_STEP) this.push(pp.x, pp.y, pp.z);

    const moving = Math.hypot(player.vel?.x ?? 0, player.vel?.z ?? 0) > 0.3;
    this.idleTime = moving ? 0 : this.idleTime + dt;
    this.idleBlend += ((this.idleTime > IDLE_DELAY ? 1 : 0) - this.idleBlend) * Math.min(1, dt * 4);
    const yaw = player.object3d.rotation.y;
    const rx = -Math.cos(yaw), rz = Math.sin(yaw); // Pip's right

    for (let i = 0; i < game.party.length; i++) {
      const m = game.party[i];
      const pos = m.object3d.position;
      this.sample(SPACING * (i + 1), _goal);
      if (this.idleBlend > 0.01) {
        const side = (i % 2 === 0 ? -1 : 1) * IDLE_SIDESTEP * this.idleBlend;
        _goal.x += rx * side;
        _goal.z += rz * side;
        game.world?.resolveCollision?.(_goal, m.radius ?? 0.5);
      }
      const ground = game.world?.getGroundHeight?.(_goal.x, _goal.z) ?? 0;
      _goal.y = Math.max(_goal.y, ground);

      const k = 1 - Math.exp(-CATCH_RATE * dt);
      const dx = (_goal.x - pos.x) * k, dz = (_goal.z - pos.z) * k;
      pos.x += dx;
      pos.y += (_goal.y - pos.y) * k;
      pos.z += dz;

      const speed = Math.hypot(dx, dz) / dt;
      // Smooth the speed a little so the run cycle doesn't flicker on tiny steps.
      this.lastSpeed[i] += (speed - this.lastSpeed[i]) * Math.min(1, dt * 12);
      if (speed > 0.4) m.object3d.rotation.y = dampAngle(m.object3d.rotation.y, yawTo(dx, dz), 14, dt);

      m.status?.update?.(dt);
      m.kid.setBlush(m.status?.has?.('embarrassed') ?? false);
      _anim.speed01 = clamp(this.lastSpeed[i] / RUN_SPEED, 0, 1);
      _anim.grounded = pos.y - ground < 0.05;
      m.kid.update(dt, _anim);
    }
  }
}
