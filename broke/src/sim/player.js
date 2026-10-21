// Player controller: sprint, multi-jump, climbing (fire escapes, ladders, scaffolds, crane masts), ledge mantling,
// knockback, slows, latches, safe-ground recovery. Abilities are delegated to the survivor kit.

import { PHYS, MOVE, COMBAT } from '../core/config.js';
import { makeBody, moveBody } from './physics.js';
import { computeStats } from './stats.js';
import { clamp, finite } from '../core/math.js';

export class Player {
  constructor(game, survivor, spawn) {
    this.game = game;
    this.kit = survivor;
    this.base = survivor.base;
    this.body = makeBody(spawn.x, spawn.y + 0.2, spawn.z);
    this.yaw = spawn.yaw ?? 0;
    this.pitch = 0;
    this.inv = {};
    this.equipment = null;
    this.equipCd = 0;
    this.hp = this.base.maxHp;
    this.barrier = 0;
    this.jumpsUsed = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.climbing = null;
    this.sprinting = false;
    this.invuln = 0;
    this.stagger = 0;
    this.timeSinceHit = 99;
    this.stillTime = 0;
    this.bandaidTimer = -1;
    this.overtime = { stacks: 0, timer: 0 };
    this.slows = []; // {mul, t}
    this.latchedBy = null;
    this.cart = 0; // seconds of shopping-cart ride left
    this.hits = 0; // counts toward Gavel of Authority
    this.dead = false;
    this.lastSafe = { x: spawn.x, y: spawn.y + 0.2, z: spawn.z };
    this.safeTimer = 0;
    this.lockY = false;
    this.cooldowns = { primary: 0, secondary: 0, utility: 0, special: 0 };
    this.stats = computeStats(this.base, this.inv, {});
    this.kit.init?.(this);
  }

  get pos() { return this.body.pos; }
  get alive() { return !this.dead; }

  refreshStats() {
    const g = this.game;
    let slowMul = 1;
    for (const s of this.slows) slowMul = Math.min(slowMul, s.mul);
    if (this.latchedBy) slowMul = Math.min(slowMul, 0.4);
    if (this.base.slowImmune) slowMul = 1;
    const prevMax = this.stats?.maxHp ?? this.base.maxHp;
    this.stats = computeStats(this.base, this.inv, {
      tier: g.clock.tier, timeSinceHit: this.timeSinceHit, slowMul, overtimeStacks: this.overtime.stacks,
    });
    // Max hp increases heal by the same amount (like picking up a gym membership).
    if (this.stats.maxHp > prevMax) this.hp += this.stats.maxHp - prevMax;
    this.hp = clamp(finite(this.hp, this.stats.maxHp), 0, this.stats.maxHp);
  }

  forward() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }
  right() { return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) }; }

  update(dt, input) {
    if (this.dead) return;
    const g = this.game;
    this.yaw = finite(input.yaw, this.yaw);
    this.pitch = clamp(finite(input.pitch, this.pitch), -1.45, 1.45);
    this.timeSinceHit += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.stagger = Math.max(0, this.stagger - dt);
    for (const s of this.slows) s.t -= dt;
    this.slows = this.slows.filter((s) => s.t > 0);
    if (this.overtime.timer > 0 && (this.overtime.timer -= dt) <= 0) this.overtime.stacks = 0;
    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    this.equipCd = Math.max(0, this.equipCd - dt);
    this.refreshStats();
    const st = this.stats;

    // Regen, Band-Aids, Leftover Pizza.
    this.heal(st.regen * dt, true);
    if (this.bandaidTimer >= 0 && (this.bandaidTimer -= dt) < 0) {
      if (st.bandaidHeal > 0) this.heal(st.bandaidHeal);
      this.bandaidTimer = -1;
    }

    this.move(dt, input);

    // Leftover Pizza: after a second standing still, a pizza box goes down and heals you while you hold that spot.
    if (st.pizzaHealPct > 0 && this.stillTime > 1) {
      if (!this.pizzaZone) { this.pizzaZone = { x: this.pos.x, y: this.pos.y, z: this.pos.z, r: st.pizzaRadius }; g.events.emit('pizza', { ...this.pizzaZone }); }
    } else if (this.pizzaZone && Math.hypot(this.pos.x - this.pizzaZone.x, this.pos.z - this.pizzaZone.z) > this.pizzaZone.r) this.pizzaZone = null;
    if (this.pizzaZone && Math.hypot(this.pos.x - this.pizzaZone.x, this.pos.z - this.pizzaZone.z) <= this.pizzaZone.r) this.heal(st.maxHp * st.pizzaHealPct * dt, true);

    // Abilities and equipment.
    if (this.cart <= 0) this.kit.update(this, dt, input, g);
    if (input.equipment && this.equipment && this.equipCd <= 0) g.useEquipment(this);
    if (input.interact) g.economy.tryInteract(this);

    // Safe ground for fall recovery.
    const b = this.body;
    this.safeTimer -= dt;
    if (b.onGround && this.safeTimer <= 0 && b.pos.y > -6 && g.world.fits(b.pos.x, b.pos.y + 0.05, b.pos.z, 0.6, PHYS.playerHeight)) {
      this.lastSafe = { x: b.pos.x, y: b.pos.y + 0.1, z: b.pos.z };
      this.safeTimer = 0.5;
    }
    if (b.pos.y < PHYS.killY || !Number.isFinite(b.pos.x + b.pos.y + b.pos.z)) this.recover(true);
    // Stuck inside geometry (should never happen): pop back to safety.
    else if (!g.world.fits(b.pos.x, b.pos.y + 0.02, b.pos.z, b.r - 0.05, b.h - 0.1)) {
      this.stuckFrames = (this.stuckFrames || 0) + 1;
      if (this.stuckFrames > 20) this.recover(false);
    } else this.stuckFrames = 0;
  }

  recover(hurt) {
    const b = this.body;
    b.pos.x = this.lastSafe.x; b.pos.y = this.lastSafe.y; b.pos.z = this.lastSafe.z;
    b.vel.x = b.vel.y = b.vel.z = 0;
    this.climbing = null;
    this.stuckFrames = 0;
    if (hurt) this.game.combat.hurtPlayer(this, this.stats.maxHp * 0.1, { source: 'fall', unblockable: true });
    this.game.events.emit('recover', { pos: { ...b.pos } });
  }

  move(dt, input) {
    const g = this.game;
    const b = this.body;
    const st = this.stats;
    const mx = clamp(finite(input.moveX), -1, 1), mz = clamp(finite(input.moveZ), -1, 1);
    const len = Math.hypot(mx, mz);
    const f = this.forward(), r = this.right();
    let dx = f.x * mz + r.x * mx, dz = f.z * mz + r.z * mx;
    if (len > 1) { dx /= len; dz /= len; }
    const firingBlocksSprint = this.kit.blocksSprint?.(this, input);
    this.sprinting = !!input.sprint && mz > 0.3 && !firingBlocksSprint && !this.latchedBy;
    let speed = this.base.speed * st.moveMul * (this.sprinting ? MOVE.sprintMul : 1);
    if (this.cart > 0) {
      this.cart -= dt;
      speed = 18;
      dx = f.x; dz = f.z;
      g.equipment.cartTick(this, dt);
    }
    // Jump buffer / coyote time.
    if (input.jumpPressed) this.jumpBuf = MOVE.jumpBuffer;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (b.onGround) { this.coyote = MOVE.coyoteTime; this.jumpsUsed = 0; } else this.coyote = Math.max(0, this.coyote - dt);

    // Climbing: push toward the ladder's wall to grab it; pushing toward the wall climbs up, pulling away climbs down.
    const wallDot = (c) => (c.wall ? (dx * c.wall.x + dz * c.wall.z) / Math.max(0.01, Math.hypot(dx, dz)) : mz > 0.2 ? 1 : mz < -0.2 ? -1 : 0);
    const moving = Math.hypot(dx, dz) > 0.2;
    const climb = g.world.climbAt(b.pos.x, b.pos.y, b.pos.z, b.r, b.h, 0.25);
    if (!this.climbing && climb && moving && wallDot(climb) > 0.5 && (b.blocked || !b.onGround || this.jumpBuf > 0) && this.cart <= 0 && b.pos.y < climb.maxY - 0.9) {
      this.climbing = climb;
      this.jumpBuf = 0;
      g.events.emit('climbStart', {});
    }
    if (this.climbing) {
      const c = this.climbing;
      const inside = g.world.climbAt(b.pos.x, b.pos.y, b.pos.z, b.r, b.h, 0.45) === c;
      const wd = moving ? wallDot(c) : 0;
      if (!inside || this.stagger > 0) this.climbing = null;
      else if (this.jumpBuf > 0) {
        // Kick off the wall.
        this.climbing = null;
        this.jumpBuf = 0;
        b.vel.y = MOVE.jumpSpeed;
        const ox = c.wall ? -c.wall.x : -f.x, oz = c.wall ? -c.wall.z : -f.z;
        b.vel.x = ox * 6; b.vel.z = oz * 6;
        this.jumpsUsed = 1;
      } else {
        b.vel.y = wd > 0.3 ? MOVE.climbSpeed * Math.min(1.6, st.moveMul) : wd < -0.3 ? -MOVE.climbSpeed : 0;
        // Hold onto the ladder column; sideways input slides you off it.
        const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
        const side = c.wall ? { x: -c.wall.z, z: c.wall.x } : r;
        const sd = moving ? (dx * side.x + dz * side.z) / Math.hypot(dx, dz) : 0;
        b.vel.x = clamp((cx - b.pos.x) * 5, -2.5, 2.5) + side.x * sd * 3;
        b.vel.z = clamp((cz - b.pos.z) * 5, -2.5, 2.5) + side.z * sd * 3;
        if (b.pos.y >= c.maxY - 1.0 && wd > 0.3) {
          // Top out: hop up and over toward the wall so the mantle carries you onto the roof.
          this.climbing = null;
          b.vel.y = 7.5;
          const tx = c.wall ? c.wall.x : f.x, tz = c.wall ? c.wall.z : f.z;
          b.vel.x = tx * 5; b.vel.z = tz * 5;
        }
        moveBody(b, g.world, dt);
        // Reaching the ground while not pushing up lets go of the ladder.
        if (this.climbing && b.onGround && wd <= 0.3) this.climbing = null;
        if (this.climbing) b.onGround = false;
        this.stillTime = 0;
        return;
      }
    }

    // Horizontal movement.
    const control = this.stagger > 0 ? 0.15 : 1;
    const accel = (b.onGround ? MOVE.accelGround : MOVE.accelAir) * control;
    const tx = dx * speed, tz = dz * speed;
    const ax = tx - b.vel.x, az = tz - b.vel.z;
    const al = Math.hypot(ax, az);
    const maxD = accel * dt;
    if (al > maxD) { b.vel.x += (ax / al) * maxD; b.vel.z += (az / al) * maxD; }
    else { b.vel.x = tx; b.vel.z = tz; }
    if (b.onGround && len < 0.05 && this.stagger <= 0 && this.cart <= 0) {
      const k = Math.max(0, 1 - MOVE.frictionGround * dt);
      b.vel.x *= k; b.vel.z *= k;
    }
    // Jumping.
    if (this.jumpBuf > 0 && this.cart <= 0) {
      if (b.onGround || this.coyote > 0) {
        b.vel.y = MOVE.jumpSpeed; this.jumpsUsed = 1; this.jumpBuf = 0; this.coyote = 0;
        g.events.emit('jump', { air: false });
      } else if (this.jumpsUsed < st.jumps) {
        b.vel.y = MOVE.jumpSpeed * 0.95; this.jumpsUsed = Math.max(2, this.jumpsUsed + 1); this.jumpBuf = 0;
        g.events.emit('jump', { air: true });
      }
    }
    // Gravity.
    if (!this.lockY) b.vel.y = Math.max(-PHYS.maxFallSpeed, b.vel.y - PHYS.gravity * (this.kit.gravityMul?.(this) ?? 1) * dt);
    b.canMantle = true;
    moveBody(b, g.world, dt);
    if (b.mantled) g.events.emit('mantle', {});
    if (b.onGround) this.jumpsUsed = 0;
    const drifting = Math.hypot(b.vel.x, b.vel.z) > 0.3 || !b.onGround;
    this.stillTime = drifting ? 0 : this.stillTime + dt;
  }

  heal(amount, quiet = false) {
    if (this.dead || !(amount > 0)) return 0;
    const mul = this.healMul ?? 1;
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + amount * mul);
    const got = this.hp - before;
    if (!quiet && got > 0.5) this.game.events.emit('heal', { amount: got, pos: { ...this.pos } });
    return got;
  }

  knock(vx, vy, vz, stagger = 0.25) {
    if (this.base.knockImmune || this.cart > 0) return;
    const b = this.body;
    const l = Math.hypot(vx, vy, vz);
    const k = l > COMBAT.knockbackMaxSpeed ? COMBAT.knockbackMaxSpeed / l : 1;
    b.vel.x += vx * k; b.vel.y = Math.max(b.vel.y, vy * k); b.vel.z += vz * k;
    this.stagger = Math.max(this.stagger, stagger);
    this.climbing = null;
  }

  slow(mul, t) { if (!this.base.slowImmune) this.slows.push({ mul, t }); }

  // Where the camera/aim ray starts (over the right shoulder) and its direction.
  aim() {
    const p = this.body.pos;
    const cp = Math.cos(this.pitch);
    const dir = { x: -Math.sin(this.yaw) * cp, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * cp };
    const r = this.right();
    const origin = { x: p.x + r.x * 0.7, y: p.y + 1.65, z: p.z + r.z * 0.7 };
    return { origin, dir };
  }

  hand() {
    const p = this.body.pos, r = this.right(), f = this.forward();
    return { x: p.x + r.x * 0.35 + f.x * 0.3, y: p.y + 1.35, z: p.z + r.z * 0.35 + f.z * 0.3 };
  }
}
