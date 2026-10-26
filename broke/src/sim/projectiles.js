// Projectiles for both teams. Each has a kind that decides how it moves (straight / homing / falling) and what it
// does on contact. Contacts are swept segment-vs-sphere tests; world hits are raycasts.

import { finite } from '../core/math.js';

let NEXT_ID = 1;

function segSphere(ax, ay, az, bx, by, bz, cx, cy, cz, r) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const l2 = dx * dx + dy * dy + dz * dz;
  let t = l2 > 0 ? ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + dx * t - cx, py = ay + dy * t - cy, pz = az + dz * t - cz;
  return px * px + py * py + pz * pz <= r * r ? t : -1;
}

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  add(p) {
    p.id = NEXT_ID++;
    p.age = 0;
    p.alive = true;
    p.vel = p.vel || { x: 0, y: 0, z: 0 };
    this.list.push(p);
    this.game.events.emit('projectile', { id: p.id, kind: p.kind });
    return p;
  }

  // --- spawners -------------------------------------------------------------------------------------------------
  dart(owner, from, target, aimPoint, damage) {
    const d = norm(sub(target ? target.point : aimPoint, from));
    return this.add({ kind: 'dart', team: 'player', pos: { ...from }, vel: mul(d, 90), speed: 90, turn: target ? 30 : 0, target: target?.enemy, part: target?.part, damage, proc: 1, life: 1.1, r: 0.3 });
  }
  // Plain sidearm round: straight, fast, no homing.
  bullet(owner, from, aimPoint, damage) {
    const d = norm(sub(aimPoint, from));
    return this.add({ kind: 'bullet', team: 'player', pos: { ...from }, vel: mul(d, 160), speed: 160, turn: 0, damage, proc: 1, life: 0.7, r: 0.2 });
  }
  clipboard(owner, from, target, aimPoint, damage) {
    const d = norm(sub(target ? target.center() : aimPoint, from));
    return this.add({ kind: 'clipboard', team: 'player', pos: { ...from }, vel: mul(d, 48), speed: 48, turn: target ? 20 : 0, target, damage, proc: 1, life: 2.5, r: 0.6, bounces: 0, maxBounces: 6, hitSet: new Set() });
  }
  textMissile(owner, target, damage, depth) {
    const p = owner.body.pos;
    return this.add({ kind: 'textmissile', team: 'player', pos: { x: p.x, y: p.y + 2.2, z: p.z }, vel: { x: (this.game.rng.next() - 0.5) * 8, y: 14, z: (this.game.rng.next() - 0.5) * 8 }, speed: 32, turn: 7, target, damage, proc: 1, depth, life: 4, r: 0.6, delay: 0.25 });
  }
  syringe(pos, damage, slow) {
    return this.add({ kind: 'syringe', team: 'player', pos: { ...pos }, vel: { x: 0, y: -42, z: 0 }, speed: 42, damage, proc: 0.5, life: 2, r: 0.3, aoe: 2.2, slow });
  }
  wave(owner, from, dir, damage, knock) {
    return this.add({ kind: 'wave', team: 'enemy', owner, pos: { ...from }, vel: mul(dir, 19), speed: 19, damage, knock, life: 0.85, r: 0.8, grow: 3.6, ghost: true });
  }
  // An enemy gun's round: a visible tracer you can sometimes step out of, stopped by walls.
  enemyShot(owner, from, dir, damage, speed = 70) {
    return this.add({ kind: 'bullet', team: 'enemy', owner, pos: { ...from }, vel: mul(dir, speed), speed, damage, life: 1.4, r: 0.1 });
  }
  ticket(owner, from, dir, damage) {
    return this.add({ kind: 'ticket', team: 'enemy', owner, pos: { ...from }, vel: mul(dir, 30), speed: 30, damage, life: 2.5, r: 0.35 });
  }

  update(dt) {
    const g = this.game;
    const P = g.player;
    for (const p of this.list) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age > p.life) { this.expire(p); continue; }
      if (p.delay && p.age < p.delay) {
        p.vel.y -= 20 * dt;
      } else if (p.turn) {
        // Homing: steer velocity toward the target's aim point.
        let tp = null;
        if (p.target && p.target.alive) tp = p.part === 'phone' && p.target.phonePoint ? p.target.phonePoint() : p.target.center();
        else if (p.team === 'enemy' && P.alive) tp = { x: P.pos.x, y: P.pos.y + 1.1, z: P.pos.z };
        else if (p.kind === 'textmissile') { p.target = g.nearestEnemy(p.pos, 40, (e) => !e.minion); }
        if (tp) {
          const want = mul(norm(sub(tp, p.pos)), p.speed);
          const k = Math.min(1, p.turn * dt);
          p.vel.x += (want.x - p.vel.x) * k; p.vel.y += (want.y - p.vel.y) * k; p.vel.z += (want.z - p.vel.z) * k;
          const s = Math.hypot(p.vel.x, p.vel.y, p.vel.z) || 1;
          p.vel.x *= p.speed / s; p.vel.y *= p.speed / s; p.vel.z *= p.speed / s;
        }
      }
      const a = p.pos;
      const b = { x: a.x + p.vel.x * dt, y: a.y + p.vel.y * dt, z: a.z + p.vel.z * dt };
      if (p.grow) p.r += p.grow * dt;
      // Entities.
      if (p.team === 'player') {
        let hitE = null, hitT = 2, hitPart = null;
        for (const e of g.enemiesNear(a, 12 + Math.hypot(p.vel.x, p.vel.y, p.vel.z) * dt)) {
          if (p.hitSet?.has(e)) continue;
          for (const hp of e.hitPoints()) {
            const t = segSphere(a.x, a.y, a.z, b.x, b.y, b.z, hp.x, hp.y, hp.z, hp.r + p.r);
            if (t >= 0 && t < hitT) { hitT = t; hitE = e; hitPart = hp.part; }
          }
        }
        if (hitE) {
          const at = { x: a.x + (b.x - a.x) * hitT, y: a.y + (b.y - a.y) * hitT, z: a.z + (b.z - a.z) * hitT };
          this.impactEnemy(p, hitE, at, hitPart);
          if (!p.alive) continue;
        }
      } else if (P.alive) {
        const c = { x: P.pos.x, y: P.pos.y + 0.9, z: P.pos.z };
        if (segSphere(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, p.r + 0.5) >= 0 && !p.hitPlayer) {
          p.hitPlayer = true;
          const k = p.knock ? mul(norm({ x: p.vel.x, y: 0, z: p.vel.z }), p.knock) : null;
          if (k) k.y = 4;
          g.combat.hurtPlayer(P, p.damage, { source: p.kind, knock: k, from: p.owner?.pos });
          if (!p.ghost) { this.expire(p, true); continue; }
        }
      }
      // World: everything stops on walls, including the soundwaves (ghost only means they pass through the player).
      {
        const d = sub(b, a);
        const len = Math.hypot(d.x, d.y, d.z);
        if (len > 1e-5) {
          const t = g.world.raycast(a.x, a.y, a.z, d.x / len, d.y / len, d.z / len, len);
          if (t < len) {
            p.pos = { x: a.x + (d.x / len) * t, y: a.y + (d.y / len) * t, z: a.z + (d.z / len) * t };
            this.impactWorld(p);
            continue;
          }
        }
      }
      p.pos = b;
    }
    if (this.list.length > 400 || this.list.some((p) => !p.alive)) this.list = this.list.filter((p) => p.alive).slice(-400);
  }

  impactEnemy(p, e, at, part) {
    const g = this.game;
    const C = g.combat;
    if (p.kind === 'dart') {
      C.hitEnemy(e, { damage: p.damage, proc: p.proc, source: 'dart', pos: at, part, knock: mul(norm(p.vel), 1.5) });
      this.expire(p, true);
    } else if (p.kind === 'clipboard') {
      const dmg = p.damage * (1 + 0.15 * p.bounces);
      C.hitEnemy(e, { damage: dmg, proc: 1, source: 'clipboard', pos: at, part, knock: mul(norm(p.vel), 4) });
      p.hitSet.add(e);
      p.bounces++;
      g.events.emit('bounce', { pos: at, n: p.bounces });
      const next = p.bounces < p.maxBounces ? g.nearestEnemy(at, 22, (o) => !p.hitSet.has(o) && !o.minion) : null;
      if (next) { p.target = next; p.turn = 40; p.age = 0; p.life = 1.5; const d = norm(sub(next.center(), at)); p.vel = mul(d, p.speed); p.pos = at; }
      else this.expire(p, true);
    } else if (p.kind === 'textmissile') {
      C.hitEnemy(e, { damage: p.damage, proc: 1, source: 'grouptext', pos: at, depth: p.depth });
      this.expire(p, true);
    } else if (p.kind === 'syringe') {
      this.impactWorld(p);
    }
  }

  impactWorld(p) {
    const g = this.game;
    if (p.kind === 'syringe') {
      for (const e of g.enemiesNear(p.pos, p.aoe)) {
        g.combat.hitEnemy(e, { damage: p.damage, proc: p.proc, source: 'codeblue', pos: e.center() });
        if (p.slow) { e.slowMul = Math.min(e.slowMul, 0.5); e.slowT = 3; }
      }
      g.events.emit('impact', { kind: 'syringe', pos: p.pos });
    } else g.events.emit('impact', { kind: p.kind, pos: p.pos });
    this.expire(p, true);
  }

  expire(p) { p.alive = false; }

  clear() { this.list.length = 0; }
}

export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export function norm(a) {
  const l = Math.hypot(a.x, a.y, a.z);
  return l > 1e-9 ? { x: finite(a.x / l), y: finite(a.y / l), z: finite(a.z / l) } : { x: 0, y: 0, z: -1 };
}
