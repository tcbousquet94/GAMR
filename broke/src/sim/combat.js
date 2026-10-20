// Damage pipeline, status effects and on-hit / on-kill item procs. Every number that reaches an hp bar goes
// through here so caps and NaN guards live in one place.

import { COMBAT } from '../core/config.js';
import { finite, clamp } from '../core/math.js';
import { roll } from './stats.js';

export class Combat {
  constructor(game) {
    this.game = game;
    this.totalDamage = 0;
  }

  // --- Player -> enemy ------------------------------------------------------------------------------------------
  // opts: { damage (absolute), proc, source, crit, pos, knock:{x,y,z}, depth, part, noCrit }
  hitEnemy(e, opts) {
    if (!e.alive) return 0;
    const g = this.game;
    const p = g.player;
    const st = p.stats;
    let dmg = finite(opts.damage);
    if (!(dmg > 0)) return 0;
    let crit = false;
    if (!opts.noCrit && opts.source !== 'burn') {
      crit = opts.crit ?? roll(g.rng, st.crit, st.luck);
      if (crit) dmg *= COMBAT.critMul * (p.critBonus ?? 1);
    }
    if (e.hp / e.maxHp > 0.9 && opts.source !== 'burn') dmg *= st.couponMul;
    if (e.cited > 0) dmg *= 1.3;
    if (e.stunned > 0 && e.vulnerableWhenStunned) dmg *= 1.5;
    if (opts.part === 'phone' && e.onPhoneHit) { dmg *= 1.5; e.onPhoneHit(); }
    dmg = clamp(dmg, 0, 1e7);
    e.hp -= dmg;
    e.flash = 1;
    e.lastHitBy = opts.source;
    this.totalDamage += dmg;
    g.stats.damageDealt += dmg;
    g.events.emit('hit', { id: e.id, amount: dmg, crit, pos: opts.pos || e.center(), source: opts.source, part: opts.part });
    if (opts.knock && !e.knockImmune) e.knock(opts.knock.x, opts.knock.y, opts.knock.z);
    const depth = opts.depth || 0;
    const proc = finite(opts.proc ?? 1);
    if (proc > 0 && depth < COMBAT.maxProcDepth && !opts.noProc) this.onHitProcs(e, proc, depth, opts);
    if (e.hp <= 0) this.kill(e, depth, opts);
    return dmg;
  }

  onHitProcs(e, proc, depth, opts) {
    const g = this.game;
    const p = g.player;
    const st = p.stats;
    const base = st.damage;
    if (roll(g.rng, st.burnChance * proc, st.luck)) this.burn(e, base * 0.5, 3);
    if (roll(g.rng, st.citeChance * proc, st.luck)) { e.cited = 5; g.events.emit('cite', { id: e.id, pos: e.center() }); }
    if (st.lightningChance > 0 && roll(g.rng, st.lightningChance * proc, st.luck)) this.lightning(e, st.lightningTargets, base * 0.8, depth + 1);
    if (st.missileChance > 0 && roll(g.rng, st.missileChance * proc, st.luck)) g.projectiles.textMissile(p, e, base * st.missileDamage, depth + 1);
    // Gavel of Authority counts direct hits.
    if (st.gavelRadius > 0 && depth === 0 && opts.source !== 'burn') {
      p.hits++;
      if (p.hits % 5 === 0) this.gavelSlam(e.center(), st.gavelRadius, base * 2);
    }
  }

  burn(e, dps, t) {
    if (!e.alive) return;
    e.burns.push({ dps: finite(dps), t });
    if (e.burns.length > 6) e.burns.shift();
    this.game.events.emit('burn', { id: e.id });
  }

  lightning(from, n, dmg, depth) {
    const g = this.game;
    const pts = [from.center()];
    const hit = new Set([from]);
    let cur = from;
    for (let i = 0; i < n; i++) {
      const next = g.nearestEnemy(cur.center(), 20, (o) => !hit.has(o) && !o.minion);
      if (!next) break;
      hit.add(next);
      pts.push(next.center());
      this.hitEnemy(next, { damage: dmg, proc: 0.3, source: 'lightning', depth });
      cur = next;
    }
    if (pts.length > 1) g.events.emit('lightning', { pts });
  }

  gavelSlam(pos, radius, dmg) {
    const g = this.game;
    for (const e of g.enemiesNear(pos, radius)) {
      if (!e.boss) e.stunned = Math.max(e.stunned, 1.2);
      this.hitEnemy(e, { damage: dmg, proc: 0, source: 'gavel', depth: COMBAT.maxProcDepth });
    }
    g.events.emit('gavelSlam', { pos, radius });
  }

  explode(pos, radius, dmg, opts = {}) {
    const g = this.game;
    for (const e of g.enemiesNear(pos, radius)) {
      if (e === opts.exclude) continue;
      const c = e.center();
      const d = Math.max(0.5, Math.hypot(c.x - pos.x, c.z - pos.z));
      const k = opts.knock ?? 0;
      this.hitEnemy(e, { damage: dmg, proc: opts.proc ?? 1, source: opts.source || 'explosion', depth: opts.depth ?? 1,
        knock: k ? { x: ((c.x - pos.x) / d) * k, y: k * 0.4, z: ((c.z - pos.z) / d) * k } : null });
      if (opts.burn && e.alive) this.burn(e, opts.burn, 3);
    }
    g.events.emit('explosion', { pos, radius, kind: opts.source || 'explosion' });
  }

  kill(e, depth, opts) {
    const g = this.game;
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    const p = g.player;
    const st = p.stats;
    const pos = e.center();
    g.events.emit('kill', { id: e.id, type: e.type, pos, boss: !!e.boss });
    if (e.latching && p.latchedBy === e) p.latchedBy = null;
    e.onDeath?.();
    if (e.minion) return;
    g.stats.kills++;
    g.economy.dropChange(e);
    if (st.snackHeal > 0) g.pickups.spawnSnack(pos, st.snackHeal);
    if (st.overtimeMax > 0) {
      p.overtime.stacks = Math.min(st.overtimeMax, p.overtime.stacks + 1);
      p.overtime.timer = 4;
    }
    if (st.explodeOnKill) {
      const burning = e.burns.length > 0;
      this.explode(pos, st.explodeRadius, st.damage * st.explodeDamage, {
        source: 'replyall', depth: depth + 1, proc: 1, exclude: e,
        // Hot Sauce + Reply All: burning enemies explode into more burning enemies.
        burn: burning ? st.damage * 0.5 : 0,
      });
    }
    if (e.boss) g.onBossKilled(e);
  }

  // Ticks DoTs and timers on an enemy.
  tickStatus(e, dt) {
    e.flash = Math.max(0, e.flash - dt * 6);
    e.stunned = Math.max(0, e.stunned - dt);
    e.cited = Math.max(0, e.cited - dt);
    if (e.slowT > 0 && (e.slowT -= dt) <= 0) e.slowMul = 1;
    if (e.burns.length) {
      e.burnTick -= dt;
      for (const b of e.burns) b.t -= dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.25;
        let dps = 0;
        for (const b of e.burns) dps += b.dps;
        if (dps > 0) this.hitEnemy(e, { damage: dps * 0.25, proc: 0, source: 'burn', noCrit: true });
      }
      e.burns = e.burns.filter((b) => b.t > 0);
    }
  }

  // --- Enemy -> player ------------------------------------------------------------------------------------------
  hurtPlayer(p, amount, opts = {}) {
    const g = this.game;
    if (p.dead || g.state !== 'playing') return 0;
    let dmg = finite(amount);
    if (!(dmg > 0)) return 0;
    if (g.godMode) dmg = 0;
    if (p.invuln > 0 && !opts.unblockable) { g.events.emit('dodged', { source: opts.source }); return 0; }
    if (!opts.unblockable && roll(g.rng, p.stats.block, p.stats.luck)) { g.events.emit('blocked', { source: opts.source }); return 0; }
    if (opts.knock) p.knock(opts.knock.x, opts.knock.y, opts.knock.z, opts.stagger ?? 0.3);
    if (p.barrier > 0) { const a = Math.min(p.barrier, dmg); p.barrier -= a; dmg -= a; }
    p.hp -= dmg;
    p.timeSinceHit = 0;
    p.bandaidTimer = 2;
    g.stats.damageTaken += dmg;
    g.events.emit('playerHurt', { amount: dmg, source: opts.source, from: opts.from });
    if (p.hp <= 0) {
      if (p.kit.onLethal?.(p)) return dmg;
      p.hp = 0;
      p.dead = true;
      g.onPlayerDeath(opts.source);
    }
    return dmg;
  }
}
