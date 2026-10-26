// The rival crew (the Vipers) for the turf war's street fights. Three roles:
//   gunman  - closes to pistol range, circles you at 9-17 m, and fires short bursts after a visible draw;
//             backs off to reload, and breaks away to find room when hurt.
//   bruiser - sprints straight in and swings; a short wind-up you can see and step out of.
//   heavy   - slow, tough, a sawn-off shotgun: a long wind-up, then a wide spread that hurts up close.
// Every attack has a wind-up (this.telegraph 0 -> 1, the white flash) before it lands, like the rest of the roster.
// Only a few may shoot at once (the street fight hands out turns, see Arcade.mayShoot), so a crowd presses you
// without every gun going off together.

import { Enemy, finiteDir } from './base.js';
import { clamp } from '../../core/math.js';

export const GANG_DEFS = {
  gunman: {
    id: 'gunman', name: 'Viper Gunman', title: 'Shoots first.', hp: 70, speed: 5.4, radius: 0.42, height: 1.8,
    attackCd: 2.2, cost: 10, drop: 0, gun: true,
    barks: ['There he is!', 'Light him up!', 'This is Viper turf!', 'Flank him!', 'Reloading!'],
  },
  bruiser: {
    id: 'bruiser', name: 'Viper Bruiser', title: 'Hits like a bus.', hp: 110, speed: 7.2, radius: 0.48, height: 1.88,
    attackCd: 1.2, cost: 9, drop: 0, knockMul: 0.6,
    barks: ['Come here!', "You're done!", 'Hold still!', 'I got him!'],
  },
  heavy: {
    id: 'heavy', name: 'Viper Heavy', title: 'Sawn-off. Short temper.', hp: 260, speed: 3.9, radius: 0.55, height: 1.95,
    attackCd: 2.4, cost: 24, drop: 0, knockMul: 0.25, gun: true,
    barks: ['Nowhere to run.', 'Say goodnight.', 'Stand still.'],
  },
};

const muzzleOf = (e) => {
  const p = e.pos, s = Math.sin(e.yaw), c = Math.cos(e.yaw);
  return { x: p.x - s * 0.55 + c * 0.22, y: p.y + 1.4, z: p.z - c * 0.55 - s * 0.22 };
};

// A shot from `from` at the player with an aim error that grows with range and how fast the player is moving.
function shootAt(e, from, damage, err, speed = 70) {
  const g = e.game, P = e.target();
  const tp = { x: P.pos.x + P.body.vel.x * 0.12, y: P.pos.y + 1.05, z: P.pos.z + P.body.vel.z * 0.12 };
  const dx = tp.x - from.x, dy = tp.y - from.y, dz = tp.z - from.z, d = Math.hypot(dx, dy, dz) || 1;
  const a = Math.atan2(dx, dz) + (g.rng.next() * 2 - 1) * err, p = Math.asin(clamp(dy / d, -1, 1)) + (g.rng.next() * 2 - 1) * err * 0.5;
  g.projectiles.enemyShot(e, from, { x: Math.sin(a) * Math.cos(p), y: Math.sin(p), z: Math.cos(a) * Math.cos(p) }, damage, speed);
}

// One voice at a time: a crew of five all shouting at once reads as noise.
class Crew extends Enemy {
  bark(line) {
    const g = this.game;
    if ((g.crewBarkT || 0) > g.time) return;
    g.crewBarkT = g.time + 3 + g.rng.next() * 3;
    super.bark(line);
  }
}

export class Gunman extends Crew {
  constructor(g, pos, lvl) {
    super(g, GANG_DEFS.gunman, pos, lvl);
    this.side = g.rng.chance(0.5) ? 1 : -1; // which way it circles
    this.want = 9 + g.rng.next() * 8; // preferred range
    this.mag = 6;
    this.burst = 0;
  }
  think(dt) {
    const g = this.game, P = this.target(), d = this.distToPlayer(), sees = d < 40 && this.canSeePlayer();
    this.aimK = sees && d < 28 ? 1 : 0;
    if (this.state === 'reload') {
      // Back off while reloading.
      const k = finiteDir(this.pos.x - P.pos.x, this.pos.z - P.pos.z);
      this.moveTo(dt, { x: this.pos.x + k.x * 6, z: this.pos.z + k.z * 6 }, 0.8);
      this.aimK = 0;
      if (this.stateT > 1.8) { this.mag = 6; this.state = 'chase'; this.stateT = 0; }
      return;
    }
    if (this.state === 'windup') {
      this.telegraph = clamp(this.stateT / 0.45, 0, 1);
      this.moveTo(dt, null); this.facePlayer(dt, 8);
      if (this.stateT >= 0.45) { this.state = 'fire'; this.stateT = 0; this.burst = 2 + (g.rng.chance(0.3) ? 1 : 0); this.shotT = 0; }
      return;
    }
    if (this.state === 'fire') {
      this.telegraph = 0; this.moveTo(dt, null); this.facePlayer(dt, 8);
      this.shotT -= dt;
      if (this.shotT <= 0 && this.burst > 0) {
        this.shotT = 0.22; this.burst--; this.mag--;
        const from = muzzleOf(this);
        shootAt(this, from, 6 * this.dmgMul, 0.035 + d * 0.0026 + Math.min(0.06, Math.hypot(P.body.vel.x, P.body.vel.z) * 0.006));
        g.events.emit('enemyAttack', { id: this.id, kind: 'gunshot', pos: from });
        this.kick = 1;
      }
      if (this.burst <= 0 && this.shotT <= 0) {
        this.attackCd = this.def.attackCd * (0.7 + g.rng.next() * 0.6);
        if (this.mag <= 0) { this.state = 'reload'; this.bark('Reloading!'); } else this.state = 'chase';
        this.stateT = 0;
      }
      return;
    }
    this.telegraph = 0;
    // Chase until in range with a clear line, then circle at the preferred range; hurt ones open the distance.
    const hurt = this.hp < this.maxHp * 0.35;
    if (!sees || d > this.want + 8) this.moveTo(dt, P.pos, 1);
    else {
      const k = finiteDir(this.pos.x - P.pos.x, this.pos.z - P.pos.z), want = hurt ? this.want + 8 : this.want;
      const radial = clamp((want - d) / 4, -1, 1), tx = -k.z * this.side, tz = k.x * this.side;
      this.moveTo(dt, { x: this.pos.x + (k.x * radial + tx * 0.8) * 4, z: this.pos.z + (k.z * radial + tz * 0.8) * 4 }, 0.75);
      this.facePlayer(dt, 6);
      if (this.body.blocked) this.side *= -1;
      if (this.stateT > 3 + g.rng.next() * 3) { this.side *= -1; this.stateT = 0; }
    }
    if (this.attackCd <= 0 && sees && d < 30 && (g.arcade?.mayShoot() ?? true)) { this.state = 'windup'; this.stateT = 0; if (g.rng.chance(0.3)) this.bark(); }
  }
}

export class Bruiser extends Crew {
  constructor(g, pos, lvl) { super(g, GANG_DEFS.bruiser, pos, lvl); }
  think(dt) {
    const g = this.game, P = this.target(), d = this.distToPlayer();
    if (this.state === 'windup') {
      this.telegraph = clamp(this.stateT / 0.38, 0, 1);
      this.moveTo(dt, P.pos, 0.25); this.facePlayer(dt, 10);
      if (this.stateT >= 0.38) {
        // The swing lands on whoever is still in front of him.
        if (d < 2.6 && Math.abs(P.pos.y - this.pos.y) < 1.6) {
          const k = finiteDir(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
          g.combat.hurtPlayer(P, 16 * this.dmgMul, { source: 'punch', knock: { x: k.x * 7, y: 3.5, z: k.z * 7 }, from: this.pos });
        }
        g.events.emit('enemyAttack', { id: this.id, kind: 'punch', pos: this.center() });
        this.state = 'recover'; this.stateT = 0; this.attackCd = this.def.attackCd; this.telegraph = 0;
      }
      return;
    }
    if (this.state === 'recover') { this.moveTo(dt, null); if (this.stateT > 0.55) this.state = 'chase'; return; }
    this.telegraph = 0;
    this.moveTo(dt, P.pos, d > 6 ? 1.12 : 1);
    if (d < 2.3 && this.attackCd <= 0) { this.state = 'windup'; this.stateT = 0; }
  }
}

export class Heavy extends Crew {
  constructor(g, pos, lvl) { super(g, GANG_DEFS.heavy, pos, lvl); }
  think(dt) {
    const g = this.game, P = this.target(), d = this.distToPlayer(), sees = d < 30 && this.canSeePlayer();
    this.aimK = sees && d < 18 ? 1 : 0;
    if (this.state === 'windup') {
      this.telegraph = clamp(this.stateT / 0.7, 0, 1);
      this.moveTo(dt, null); this.facePlayer(dt, 5);
      if (this.stateT >= 0.7) {
        const from = muzzleOf(this);
        for (let i = 0; i < 6; i++) shootAt(this, from, 5.5 * this.dmgMul * (d < 8 ? 1 : 0.6), 0.09 + d * 0.002, 55);
        g.events.emit('enemyAttack', { id: this.id, kind: 'gunshot', pos: from, heavy: true });
        this.kick = 1.6;
        this.state = 'recover'; this.stateT = 0; this.attackCd = this.def.attackCd; this.telegraph = 0;
      }
      return;
    }
    if (this.state === 'recover') { this.moveTo(dt, null); if (this.stateT > 0.9) this.state = 'chase'; return; }
    this.telegraph = 0;
    this.moveTo(dt, d > 7 || !sees ? P.pos : null, 1);
    if (sees) this.facePlayer(dt, 4);
    if (this.attackCd <= 0 && sees && d < 16 && (g.arcade?.mayShoot() ?? true)) { this.state = 'windup'; this.stateT = 0; if (g.rng.chance(0.4)) this.bark(); }
  }
}

export const GANG_CLASSES = { gunman: Gunman, bruiser: Bruiser, heavy: Heavy };
