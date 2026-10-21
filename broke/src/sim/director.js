// Spawn director: earns credits over time (faster at higher difficulty and during the exit event) and spends them
// on enemies at validated spawn points (alleys, revolving doors, subway grates, rooftop doors) that are off-screen.

import { EXIT } from '../core/config.js';

export class Director {
  constructor(game) {
    this.game = game;
    this.credits = 20;
    this.waveT = 4;
    this.maxAlive = 60;
    this.spawned = 0;
    this.relocations = 0;
    this.enabled = true;
  }

  update(dt) {
    const g = this.game;
    if (!this.enabled || g.state !== 'playing') return;
    const c = g.clock.coeff;
    const exitMul = g.exit.state === 'called' ? EXIT.spawnRateMul : 1;
    this.credits += dt * (1.2 + 0.9 * c) * exitMul * (g.spawnRate ?? 1);
    this.waveT -= dt;
    if (this.waveT > 0) return;
    this.waveT = (g.exit.state === 'called' ? 2.5 : 4.5) + g.rng.next() * 3;
    const alive = g.enemies.filter((e) => e.alive && !e.minion && !e.boss).length;
    if (alive >= this.maxAlive) return;
    const table = g.district.enemies.filter((t) => t.minTier <= g.clock.tier);
    const affordable = table.filter((t) => t.cost <= this.credits);
    if (!affordable.length) return;
    const pick = g.rng.weighted(affordable.map((t) => ({ w: t.w, v: t })));
    const n = Math.min(this.maxAlive - alive, Math.max(1, Math.min(5, Math.floor(this.credits / pick.cost))), 1 + Math.floor(g.rng.next() * (2 + g.clock.tier)));
    const pt = this.pickSpawnPoint(25, 70);
    if (!pt) return;
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      const off = i === 0 ? 0 : 1.4;
      let pos = { x: pt.x + Math.cos(a) * off, y: pt.y, z: pt.z + Math.sin(a) * off };
      if (!g.world.fits(pos.x, pos.y + 0.05, pos.z, 0.5, 1.9)) pos = { x: pt.x, y: pt.y, z: pt.z };
      g.spawnEnemy(pick.id, pos);
      this.credits -= pick.cost;
      this.spawned++;
    }
  }

  // A valid spawn point between minD and maxD from the player, preferring ones the camera can't see.
  pickSpawnPoint(minD, maxD, opts = {}) {
    const g = this.game;
    const P = g.player.pos;
    const f = g.player.forward();
    const pts = g.city.spawnPoints;
    const cands = [];
    for (let tries = 0; tries < 80 && cands.length < 6; tries++) {
      const s = pts[Math.floor(g.rng.next() * pts.length)];
      const dx = s.x - P.x, dz = s.z - P.z;
      const d = Math.hypot(dx, dz);
      if (d < minD || d > maxD) continue;
      if (Math.abs(s.y - P.y) > 14) continue;
      const inFront = (dx * f.x + dz * f.z) / d > 0.45;
      const visible = inFront && g.world.segmentClear({ x: s.x, y: s.y + 1.2, z: s.z }, { x: P.x, y: P.y + 1.6, z: P.z });
      if (visible && !opts.allowVisible) continue;
      cands.push(s);
    }
    if (!cands.length) {
      // Fall back to a full scan (random sampling misses when only a handful of points are in range, e.g. in a
      // map corner): the in-range point closest to the player's height, else null.
      let best = null, bestScore = Infinity;
      for (const s of pts) {
        const d = Math.hypot(s.x - P.x, s.z - P.z);
        if (d < minD * 0.6 || d > maxD * 1.5) continue;
        const score = Math.abs(s.y - P.y) + g.rng.next() * 2;
        if (score < bestScore) { bestScore = score; best = s; }
      }
      return best;
    }
    return cands[Math.floor(g.rng.next() * cands.length)];
  }

  // A point on the same surface as the player (continuous ground between them, e.g. the same roof), taken from
  // spawn points and ladder tops. Used when an enemy is parked below a player it can't climb to.
  levelSpawnPoint(minD, maxD) {
    const g = this.game, w = g.world, P = g.player.pos;
    const cands = [];
    for (const s of g.city.spawnPoints) cands.push(s);
    for (const c of w.climbs.items) {
      if (!c.wall) continue;
      cands.push({ x: (c.minX + c.maxX) / 2 + c.wall.x * 1.3, y: c.maxY - 0.7, z: (c.minZ + c.maxZ) / 2 + c.wall.z * 1.3 });
    }
    const sameSurface = (s) => {
      const d = Math.hypot(s.x - P.x, s.z - P.z), n = Math.ceil(d);
      for (let i = 0; i <= n; i++) {
        const t = i / Math.max(1, n), x = s.x + (P.x - s.x) * t, z = s.z + (P.z - s.z) * t;
        if (Math.abs(w.groundBelow(x, P.y + 1, z, 0.05, 3) - P.y) > 1.0) return false;
      }
      return true;
    };
    let best = null, bestD = Infinity;
    for (const s of cands) {
      const gy = w.groundBelow(s.x, s.y + 1, s.z, 0.05, 3);
      if (Math.abs(gy - P.y) > 1.0) continue;
      const d = Math.hypot(s.x - P.x, s.z - P.z);
      if (d < minD || d > maxD || d >= bestD) continue;
      if (!w.fits(s.x, gy + 0.05, s.z, 0.5, 1.9) || !sameSurface({ x: s.x, z: s.z })) continue;
      bestD = d; best = { x: s.x, y: gy, z: s.z };
    }
    return best;
  }

  // Move a stuck / fallen enemy to a fresh spawn point near the player.
  // opts.level: the enemy couldn't reach a player above it, so prefer points at the player's height (roof doors).
  relocate(e, opts = {}) {
    const pt = opts.level ? this.levelSpawnPoint(6, 45) || this.pickSpawnPoint(20, 55) : this.pickSpawnPoint(20, 55);
    this.relocations++;
    if (!pt) {
      // Never delete the boss (that silently skipped the fight and its item). If it left the world, put it back
      // at its arena spawn; otherwise leave it where it is.
      if (e.boss) {
        const bs = this.game.city.exit.bossSpawn;
        if (e.body.pos.y < -20 || !Number.isFinite(e.body.pos.x + e.body.pos.y + e.body.pos.z)) Object.assign(e.body.pos, { x: bs.x, y: bs.y + 0.05, z: bs.z });
        return;
      }
      e.alive = false; return;
    }
    e.body.pos.x = pt.x; e.body.pos.y = pt.y + 0.05; e.body.pos.z = pt.z;
    e.body.vel.x = e.body.vel.y = e.body.vel.z = 0;
    e.lastProgress = { x: pt.x, z: pt.z, t: 0 };
    e.state = 'chase';
    this.game.events.emit('relocate', { id: e.id });
  }
}
