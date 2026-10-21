// The simulation: one run of one stage. No DOM or WebGL in here, so tests and the bot can run it in Node.
// The view/HUD/audio listen to `events`; input arrives as a plain object each fixed step.

import { DT } from '../core/config.js';
import { Rng } from '../core/rng.js';
import { Events } from '../core/events.js';
import { generateCity } from '../city/generator.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { Projectiles } from './projectiles.js';
import { Pickups } from './pickups.js';
import { Economy, giveItem } from './economy.js';
import { Director } from './director.js';
import { Clock } from './clock.js';
import { ExitEvent } from './exit.js';
import { EquipmentSystem } from './equipment.js';
import { FlowField } from './flow.js';
import { ENEMY_CLASSES, ENEMY_DEFS } from './enemies/types.js';
import { POOLS } from './items.js';

export const EMPTY_INPUT = { moveX: 0, moveZ: 0, yaw: 0, pitch: 0, sprint: false, jumpPressed: false, primary: false, secondary: false, utility: false, special: false, equipment: false, interact: false };

export class Game {
  constructor({ seed = 1, district, survivor, city = null, flow = null, startMinutes = 0 }) {
    this.seed = seed;
    this.district = district;
    this.events = new Events();
    this.rng = new Rng(`run:${seed}`);
    this.city = city || generateCity(district, seed);
    this.world = this.city.world;
    // Interactables are per-run state; reset them if the city object is reused.
    for (const it of this.city.interactables) it.used = false;
    this.flow = flow || new FlowField(this.world, this.city.size);
    this.flowT = 0;
    this.clock = new Clock(startMinutes);
    this.stats = { kills: 0, damageDealt: 0, damageTaken: 0, items: 0, shots: 0, equipUses: 0 };
    this.combat = new Combat(this);
    this.projectiles = new Projectiles(this);
    this.pickups = new Pickups(this);
    this.economy = new Economy(this);
    this.equipment = new EquipmentSystem(this);
    this.enemies = [];
    this.player = new Player(this, survivor, this.city.spawn);
    this.director = new Director(this);
    this.exit = new ExitEvent(this);
    this.state = 'playing';
    this.time = 0;
    this.timeScale = 1;
    this.slowmo = 0;
    this.seen = new Set();
    this.introT = 0;
    this.boss = null;
    this.godMode = false;
    this.flow.build(this.player.pos.x, this.player.pos.z);
  }

  step(input = EMPTY_INPUT, dt = DT) {
    if (this.state === 'won') return;
    this.time += dt;
    if (this.slowmo > 0) {
      this.slowmo -= dt / Math.max(0.05, this.timeScale);
      if (this.slowmo <= 0) { this.timeScale = 1; this.slowmo = 0; }
    }
    if (this.state === 'playing') {
      this.clock.update(dt);
      if (this.clock.tierChanged) { this.clock.tierChanged = false; this.events.emit('tier', { tier: this.clock.tier, label: this.clock.label }); }
      this.player.update(dt, input);
    }
    this.flowT -= dt;
    if (this.flowT <= 0) { this.flowT = 0.4; this.flow.build(this.player.pos.x, this.player.pos.z); }
    for (const e of this.enemies) if (e.alive) e.update(dt);
    this.separate();
    this.projectiles.update(dt);
    this.pickups.update(dt);
    this.director.update(dt);
    this.exit.update(dt);
    if (this.enemies.length > 80 || (this.time % 1 < dt && this.enemies.some((e) => !e.alive))) this.enemies = this.enemies.filter((e) => e.alive);
    this.introT -= dt;
    if (this.introT <= 0) { this.introT = 0.25; this.checkIntros(); }
  }

  // --- spawning -------------------------------------------------------------------------------------------------
  spawnEnemy(type, pos, extra) {
    const C = ENEMY_CLASSES[type];
    if (!C) return null;
    const e = new C(this, pos, this.clock.level, extra);
    this.enemies.push(e);
    this.events.emit('spawn', { id: e.id, type, pos: { ...pos } });
    return e;
  }

  spawnBoss() {
    const ex = this.city.exit;
    let pos = ex.bossSpawn;
    if (!this.world.fits(pos.x, pos.y + 0.1, pos.z, 1.3, 5.5)) pos = ex.center;
    if (!this.world.fits(pos.x, pos.y + 0.1, pos.z, 1.3, 5.5)) {
      const pt = this.director.pickSpawnPoint(15, 45, { allowVisible: true });
      if (pt) pos = pt;
    }
    this.boss = this.spawnEnemy('hoa', pos);
    this.seen.add('hoa');
    const d = ENEMY_DEFS.hoa;
    this.events.emit('intro', { type: 'hoa', name: d.name, title: d.title, boss: true, id: this.boss.id });
    this.doSlowmo(2.4, 0.25);
    this.boss.bark('You are in VIOLATION.');
  }

  checkIntros() {
    const P = this.player.pos;
    for (const e of this.enemies) {
      if (!e.alive || this.seen.has(e.type) || e.minion || e.type === 'drone') continue;
      const d = Math.hypot(e.pos.x - P.x, e.pos.z - P.z);
      if (d < 38 && e.canSeePlayer()) {
        this.seen.add(e.type);
        this.events.emit('intro', { type: e.type, name: e.def.name, title: e.def.title, id: e.id });
        this.doSlowmo(1.1, 0.3);
        e.bark();
        break;
      }
    }
  }

  doSlowmo(realSeconds, scale) { this.slowmo = realSeconds; this.timeScale = scale; }

  // Push overlapping ground enemies apart so crowds don't stack into one blob.
  separate() {
    const list = this.enemies;
    // Enemies can't stand inside the survivor (latched Canvassers are the exception).
    const P = this.player;
    for (const e of list) {
      if (!e.alive || e.def.flies || e.state === 'latched' || e.state === 'charge') continue;
      const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z;
      const r = e.body.r + P.body.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r || Math.abs(e.pos.y - P.pos.y) > 1.6) continue;
      const d = Math.sqrt(d2) || 0.01;
      tryShift(this.world, e, (dx / d) * (r - d), (dz / d) * (r - d));
    }
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive || a.def.flies || a.state === 'latched') continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive || b.def.flies || b.state === 'latched') continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const r = a.body.r + b.body.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r || Math.abs(a.pos.y - b.pos.y) > 1.5) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = (r - d) * 0.5;
        const nx = dx / d, nz = dz / d;
        const wa = a.boss ? 0.05 : b.boss ? 0.95 : 0.5;
        tryShift(this.world, a, -nx * push * wa * 2, -nz * push * wa * 2);
        tryShift(this.world, b, nx * push * (1 - wa) * 2, nz * push * (1 - wa) * 2);
      }
    }
  }

  // --- queries --------------------------------------------------------------------------------------------------
  enemiesNear(pos, r) {
    const out = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const c = e.center();
      const rr = r + e.body.r * (e.boss ? 2.5 : 1);
      if ((c.x - pos.x) ** 2 + (c.y - pos.y) ** 2 * 0.5 + (c.z - pos.z) ** 2 <= rr * rr) out.push(e);
    }
    return out;
  }

  nearestEnemy(pos, r, filter) {
    let best = null, bd = r * r;
    for (const e of this.enemies) {
      if (!e.alive || (filter && !filter(e))) continue;
      const c = e.center();
      const d = (c.x - pos.x) ** 2 + (c.y - pos.y) ** 2 + (c.z - pos.z) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // Enemy hit point closest to the crosshair within maxAngle (radians) and range, with line of sight.
  aimTarget(p, maxAngle, range) {
    const { origin, dir } = p.aim();
    const hand = p.hand();
    let best = null, ba = maxAngle;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      for (const hp of e.hitPoints()) {
        const dx = hp.x - origin.x, dy = hp.y - origin.y, dz = hp.z - origin.z;
        const d = Math.hypot(dx, dy, dz);
        if (d > range || d < 0.5) continue;
        const cos = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
        if (cos <= 0) continue;
        // Weak points (the phone) get a slightly bigger acceptance window so aiming at them is rewarded.
        const ang = Math.acos(Math.min(1, cos)) * (hp.part === 'phone' ? 0.8 : 1) + (hp.part === 'head' ? 0.01 : 0);
        if (ang < ba && this.world.segmentClear(hand, hp)) { ba = ang; best = { enemy: e, part: hp.part, point: { x: hp.x, y: hp.y, z: hp.z } }; }
      }
    }
    return best;
  }

  // Point under the crosshair (world hit), or maxD along the ray. ground=true projects misses down to the ground.
  aimPoint(p, maxD, ground = false) {
    const { origin, dir } = p.aim();
    const t = this.world.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxD);
    const pt = { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t };
    if (ground && t >= maxD) {
      const gy = this.world.groundBelow(pt.x, pt.y, pt.z, 0.1, 80);
      if (Number.isFinite(gy)) pt.y = gy;
    }
    return pt;
  }

  // --- outcomes -------------------------------------------------------------------------------------------------
  giveItem(id, n = 1) { giveItem(this, this.player, id, n); }

  useEquipment(p) { return this.equipment.use(p); }

  onBossKilled(e) {
    this.bossKilled = true;
    const item = this.rng.pick(POOLS.boss);
    this.pickups.spawnItem(e.center(), item);
    this.events.emit('bossDefeated', { item });
    // Her drones and notices go with her.
    for (const o of this.enemies) if (o.alive && (o.type === 'drone' || o.type === 'notice')) { o.alive = false; this.events.emit('kill', { id: o.id, type: o.type, pos: o.center() }); }
  }

  onPlayerDeath(source) {
    if (this.state !== 'playing') return;
    this.state = 'dead';
    this.events.emit('playerDeath', { source, cents: this.economy.cents });
  }

  onWin() {
    if (this.state !== 'playing') return;
    this.state = 'won';
    this.events.emit('win', this.receipt());
  }

  receipt() {
    return {
      earned: this.economy.earned, spent: this.economy.spent, cents: this.economy.cents, bought: this.economy.bought,
      kills: this.stats.kills, time: this.clock.time, items: { ...this.player.inv }, tier: this.clock.label, seed: this.seed,
      bossDefeated: !!this.bossKilled, // from the actual kill, not just `alive` (which other paths can clear)
    };
  }
}

function tryShift(world, e, dx, dz) {
  const b = e.body;
  if (world.fits(b.pos.x + dx, b.pos.y + 0.02, b.pos.z + dz, b.r, b.h)) { b.pos.x += dx; b.pos.z += dz; }
}
