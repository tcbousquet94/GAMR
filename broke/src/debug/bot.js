// Autopilot that turns sim state into inputs: path-follows the nav graph (walk, jump, climb), aims and fires at
// enemies, dodges telegraphed attacks, uses abilities, buys from shops. Runs identically in Node and the browser.

import { EDGE } from '../city/nav.js';
import { EMPTY_INPUT } from '../sim/game.js';

const yawTo = (dx, dz) => Math.atan2(-dx, -dz);

export class Bot {
  constructor(game, nav) {
    this.game = game;
    this.nav = nav;
    this.path = null;
    this.i = 0;
    this.goal = null;
    this.fight = false;
    this.dodge = true;
    this.useAbilities = true;
    this.sprint = true;
    this.stuckT = 0;
    this.lastPos = null;
    this.replans = 0;
    this.prevJump = false;
    this.pressed = {};
    this.lookYaw = game.player.yaw;
    this.lookPitch = 0;
  }

  goTo(pt) {
    this.goal = pt;
    this.plan();
  }

  plan() {
    const p = this.game.player.pos;
    const a = this.nav.nearest(p.x, p.y, p.z, 4);
    const b = this.nav.nearest(this.goal.x, this.goal.y, this.goal.z, 4);
    this.path = a >= 0 && b >= 0 ? this.nav.path(a, b) : null;
    this.i = 0;
    this.replans++;
    return !!this.path;
  }

  arrived(r = 1.5) {
    if (!this.goal) return true;
    const p = this.game.player.pos;
    return Math.hypot(p.x - this.goal.x, p.z - this.goal.z) < r && Math.abs(p.y - this.goal.y) < 2.2;
  }

  // One fixed-step input.
  input(dt) {
    const g = this.game;
    const P = g.player;
    const inp = { ...EMPTY_INPUT, yaw: this.lookYaw, pitch: this.lookPitch };
    let moveYaw = null;
    let wantJump = false;
    let wantForward = false;
    if (this.path && this.goal && !this.arrived(1.0)) {
      const p = P.pos;
      // Advance to the closest of the next few waypoints we're level with (so corner-cutting never strands us).
      let bestK = this.i, bestD = Infinity;
      for (let k = this.i; k < Math.min(this.path.length, this.i + 10); k++) {
        const w = this.path[k];
        if (p.y < w.y - 0.7 || p.y > w.y + 1.6) continue;
        const d = Math.hypot(w.x - p.x, w.z - p.z);
        if (d < bestD) { bestD = d; bestK = k; }
      }
      if (bestD < 1.6) this.i = Math.min(this.path.length - 1, bestK + 1);
      // Look ahead along plain walking segments to smooth corners.
      let j = this.i;
      while (j + 1 < this.path.length && j - this.i < 5 && this.path[j + 1].type === EDGE.WALK && Math.abs(this.path[j + 1].y - p.y) < 0.7) {
        // Only smooth toward waypoints we can walk straight at (knee and chest height clear).
        const q = this.path[j + 1];
        if (!g.world.segmentClear({ x: p.x, y: p.y + 0.5, z: p.z }, { x: q.x, y: q.y + 0.5, z: q.z }) || !g.world.segmentClear({ x: p.x, y: p.y + 1.4, z: p.z }, { x: q.x, y: q.y + 1.4, z: q.z })) break;
        j++;
      }
      const w = this.path[j];
      const next = this.path[this.i];
      const dx = w.x - p.x, dz = w.z - p.z;
      moveYaw = yawTo(dx, dz);
      wantForward = true;
      if (next.type === EDGE.JUMP || next.type === EDGE.GAP) {
        if (next.y > p.y + 0.5 || next.type === EDGE.GAP) wantJump = P.body.onGround || (P.body.vel.y < 1 && P.jumpsUsed < P.stats.jumps);
      }
      if (next.type === EDGE.CLIMB && next.y > p.y + 0.8) {
        // Face into the climb volume and start climbing.
        const c = g.world.climbAt(p.x, p.y, p.z, P.body.r, P.body.h, 1.5);
        if (c) {
          const inside = g.world.climbAt(p.x, p.y, p.z, P.body.r, P.body.h, 0.2) === c;
          // Walk into the ladder column, then push toward its wall.
          moveYaw = inside && c.wall ? yawTo(c.wall.x, c.wall.z) : yawTo((c.minX + c.maxX) / 2 - p.x, (c.minZ + c.maxZ) / 2 - p.z);
        }
        if (!P.climbing && P.body.onGround) wantJump = true;
      }
      // Hop over things we bump into, except next to a ladder we don't mean to climb (we'd grab it).
      if (P.body.blocked && P.body.onGround && !P.climbing && (next.type === EDGE.CLIMB || !g.world.climbAt(p.x, p.y, p.z, P.body.r, P.body.h, 0.4))) wantJump = true;
      // Stuck detection -> replan.
      this.stuckT += dt;
      if (this.stuckT > 1.5) {
        if (this.lastPos && Math.hypot(p.x - this.lastPos.x, p.y - this.lastPos.y, p.z - this.lastPos.z) < 1.2) { this.plan(); wantJump = true; }
        this.lastPos = { ...p };
        this.stuckT = 0;
      }
      // Off the path (knocked away / fell): replan.
      if (!P.climbing && next.type !== EDGE.CLIMB && (Math.hypot(next.x - p.x, next.z - p.z) > 8 || p.y < next.y - 4)) this.plan();
    }
    // Combat: aim at the nearest visible enemy (weak point first).
    let target = null;
    if (this.fight) {
      const c = { x: P.pos.x, y: P.pos.y + 1.4, z: P.pos.z };
      let bd = 60 * 60;
      for (const e of g.enemies) {
        if (!e.alive) continue;
        const ec = e.phonePoint && e.stunned <= 0 ? e.phonePoint() : e.center();
        const d = (ec.x - c.x) ** 2 + (ec.y - c.y) ** 2 + (ec.z - c.z) ** 2;
        if (d < bd && g.world.segmentClear(c, ec)) { bd = d; target = { e, pt: ec }; }
      }
    }
    if (target) {
      const { origin } = P.aim();
      const dx = target.pt.x - origin.x, dy = target.pt.y - origin.y, dz = target.pt.z - origin.z;
      this.lookYaw = yawTo(dx, dz);
      this.lookPitch = Math.atan2(dy, Math.hypot(dx, dz));
      inp.primary = true;
      if (this.useAbilities) {
        if (P.cooldowns.secondary <= 0) inp.secondary = true;
        const crowd = g.enemiesNear(target.e.center(), 7).length;
        if (P.cooldowns.special <= 0 && crowd >= 3) inp.special = true;
        if (P.equipment && P.equipCd <= 0 && Math.sqrt(bd) < 10) inp.equipment = true;
      }
    } else if (moveYaw !== null) {
      this.lookYaw = moveYaw;
      this.lookPitch = 0;
    }
    inp.yaw = this.lookYaw;
    inp.pitch = this.lookPitch;
    // Translate the desired move direction into camera-relative stick input.
    if (wantForward && moveYaw !== null) {
      const rel = moveYaw - this.lookYaw;
      inp.moveZ = Math.cos(rel);
      inp.moveX = -Math.sin(rel);
      // Sprinting only works moving forward; when strafing while shooting we just run.
      inp.sprint = this.sprint && inp.moveZ > 0.3;
      if (P.climbing) {
        // On a ladder: climb toward the next waypoint's height (down if it's below us).
        const nx = this.path?.[this.i];
        // Go down when the next waypoint is below us and isn't the ladder's top (where we top out instead).
        const down = nx && nx.y < P.pos.y - 0.2 && nx.y < P.climbing.maxY - 1.6;
        const w = P.climbing.wall;
        const toward = w ? yawTo(w.x, w.z) : moveYaw;
        inp.yaw = toward; inp.moveZ = down ? -1 : 1; inp.moveX = 0; this.lookYaw = toward;
        // The next waypoint is level with us but off to the side (a landing or a neighbouring roof): kick off toward it.
        if (nx && !down && nx.type !== EDGE.CLIMB && Math.abs(nx.y - P.pos.y) < 1.2 && P.pos.y < P.climbing.maxY - 1.0) {
          this.lookYaw = inp.yaw = moveYaw; inp.moveZ = 1; wantJump = true;
        }
      }
    }
    // Dodge: Salsa Step away from any attack that is about to land, or to shake off a Canvasser.
    if (this.dodge && P.cooldowns.utility <= 0) {
      const danger = g.enemies.some((e) => e.alive && e.telegraph > 0.7 && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < (e.boss ? 14 : 9));
      if (danger || P.latchedBy) { inp.utility = true; this.dodges = (this.dodges || 0) + 1; }
    }
    // Jump edges.
    inp.jumpPressed = wantJump && !this.prevJump;
    this.prevJump = inp.jumpPressed;
    if (this.pressed.interact) { inp.interact = true; this.pressed.interact = false; }
    return inp;
  }

  face(pt) {
    const P = this.game.player;
    this.lookYaw = yawTo(pt.x - P.pos.x, pt.z - P.pos.z);
    this.lookPitch = 0;
  }
}
