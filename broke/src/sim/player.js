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
    this.aimT = 0; // GTA-style combat stance: set by shooting, relaxes 1 s after the last shot
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
    // Out of combat Dee just runs; shooting snaps her into an aim stance (and shows the crosshair) for a moment.
    this.aimT = input.primary || input.secondary || input.special ? 1.0 : Math.max(0, this.aimT - dt);
    if (this.cart <= 0) this.kit.update(this, dt, input, g);
    if (input.equipment && this.equipment && this.equipCd <= 0) g.useEquipment(this);
    if (input.interact && !this.climbing) g.economy.tryInteract(this);

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
    // Flying heroes steer themselves (kit sets the velocity); the body still collides with the world.
    if (this.kit.fly?.(this, dt, input, g)) {
      this.sprinting = !!input.sprint;
      b.canMantle = false;
      moveBody(b, g.world, dt);
      this.lastVel = { x: b.vel.x, z: b.vel.z };
      return;
    }
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

    // Vault in progress: a short kinematic arc over low cover.
    if (this.vault) {
      const v = this.vault;
      v.t += dt;
      const k = Math.min(1, v.t / v.dur);
      const e = k * k * (3 - 2 * k);
      b.pos.x = v.from.x + (v.to.x - v.from.x) * e;
      b.pos.z = v.from.z + (v.to.z - v.from.z) * e;
      const base = v.from.y + (v.to.y - v.from.y) * e;
      b.pos.y = Math.max(base, v.from.y + (v.peak - v.from.y) * Math.sin(Math.min(1, k * 1.15) * Math.PI)) ;
      if (k >= 1) {
        this.vault = null;
        b.pos.y = v.to.y + 0.02;
        b.vel.x = v.dir.x * v.speed; b.vel.z = v.dir.z * v.speed; b.vel.y = 0;
        b.onGround = true;
      }
      this.stillTime = 0;
      return;
    }

    // Horizontal movement with momentum: on the ground, speed builds over a few strides and the direction of
    // travel swings toward the stick instead of snapping, so turns arc. A sharp reversal at speed is a pivot
    // (hard brake, then go); letting go from a sprint skids a little.
    const control = this.stagger > 0 ? 0.15 : this.hardLand > 0 ? 0.35 : 1;
    const hs = Math.hypot(b.vel.x, b.vel.z);
    const want = len > 0.05 ? speed * Math.min(1, len) * (this.crouch ? 0.6 : 1) : 0;
    if (b.onGround && this.cart <= 0) {
      let hx = hs > 0.05 ? b.vel.x / hs : dx, hz = hs > 0.05 ? b.vel.z / hs : dz;
      let sp = hs;
      if (want > 0) {
        const dl = Math.hypot(dx, dz) || 1;
        const tx = dx / dl, tz = dz / dl;
        const cross = hx * tz - hz * tx, dot = hx * tx + hz * tz;
        const ang = Math.atan2(cross, dot);
        if (Math.abs(ang) > MOVE.pivotAngle && hs > 5) {
          // Pivot: brake hard first.
          if (!this.pivoting) { this.pivoting = true; g.events.emit('pivot', { from: { x: hx, z: hz }, to: { x: tx, z: tz } }); }
          sp = Math.max(0, hs - MOVE.pivotDecel * dt);
          if (sp < 1.6) { hx = tx; hz = tz; this.pivoting = false; }
        } else {
          this.pivoting = false;
          const rate = MOVE.turnRate / (1 + hs * MOVE.turnFalloff) * control;
          const turn = Math.max(-rate * dt, Math.min(rate * dt, ang));
          const c = Math.cos(turn), s2 = Math.sin(turn);
          const nhx = hx * c - hz * s2, nhz = hx * s2 + hz * c;
          hx = nhx; hz = nhz;
          if (hs < 1.2) { hx = tx; hz = tz; } // from (nearly) standing, just go
          // Carving a hard turn bleeds speed: the body's momentum fights the new direction.
          const carve = hs > 4 ? Math.min(1, Math.max(0, (Math.abs(ang) - 0.5) / 1.2)) : 0;
          const wantT = want * (1 - MOVE.turnSpeedLoss * carve);
          const acc = (sp < wantT ? MOVE.accelGround : MOVE.decelGround) * control;
          sp = sp < wantT ? Math.min(wantT, sp + acc * dt) : Math.max(wantT, sp - acc * dt);
        }
        this.skid = 0; this.skidUsed = false;
      } else {
        this.pivoting = false;
        // Letting go: a sprint stop slides a little before friction bites.
        if (hs > 8.5 && !this.skidUsed) { this.skid = 0.28; this.skidUsed = true; g.events.emit('skid', {}); }
        const fr = this.skid > 0 ? MOVE.frictionSkid : MOVE.frictionGround;
        this.skid = Math.max(0, this.skid - dt);
        sp = hs * Math.max(0, 1 - fr * dt);
        if (sp < 0.05) sp = 0;
      }
      if (this.stagger > 0) { /* knockback keeps its own velocity */ } else { b.vel.x = hx * sp; b.vel.z = hz * sp; }
    } else {
      // Air (and cart): direct acceleration toward the target velocity, as before.
      const accel = (b.onGround ? MOVE.accelGround * 2.5 : MOVE.accelAir) * control;
      const tx = dx * (this.cart > 0 ? speed : want), tz = dz * (this.cart > 0 ? speed : want);
      const ax = tx - b.vel.x, az = tz - b.vel.z;
      const al = Math.hypot(ax, az);
      const maxD = accel * dt;
      if (al > maxD) { b.vel.x += (ax / al) * maxD; b.vel.z += (az / al) * maxD; }
      else { b.vel.x = tx; b.vel.z = tz; }
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
    const wasGround = b.onGround, fallV = b.vel.y;
    this.lastVel = { x: b.vel.x, z: b.vel.z };
    moveBody(b, g.world, dt);
    if (b.mantled) g.events.emit('mantle', {});
    if (b.onGround) this.jumpsUsed = 0;
    // Landings: a big drop stumbles (brief loss of speed and control); smaller ones just dip.
    if (!wasGround && b.onGround && fallV < -6) {
      const hard = fallV < -MOVE.hardLandSpeed;
      if (hard) { this.hardLand = 0.45; b.vel.x *= 0.5; b.vel.z *= 0.5; }
      g.events.emit('land', { hard, v: -fallV });
    }
    this.hardLand = Math.max(0, (this.hardLand || 0) - dt);
    this.tryVault(b, g, wasGround);
    this.updateCrouch(b, g);
    const drifting = Math.hypot(b.vel.x, b.vel.z) > 0.3 || !b.onGround;
    this.stillTime = drifting ? 0 : this.stillTime + dt;
  }

  // Running into low cover (0.55-1.45 m, short enough to clear) vaults it instead of stopping dead.
  tryVault(b, g, wasGround) {
    if (!b.blocked || !wasGround || this.cart > 0 || this.climbing || this.latchedBy) return;
    const box = b.blockBox;
    const hs = Math.hypot(this.lastVel?.x || 0, this.lastVel?.z || 0);
    if (!box || hs < 3.5) return;
    const rise = box.maxY - b.pos.y;
    if (rise < 0.55 || rise > 1.45) return;
    const dir = { x: -b.blockNX, z: -b.blockNZ };
    const depth = dir.x ? box.maxX - box.minX : box.maxZ - box.minZ;
    if (depth > 2.4) return;
    const far = dir.x > 0 ? box.maxX : dir.x < 0 ? box.minX : dir.z > 0 ? box.maxZ : box.minZ;
    const tx = dir.x ? far + dir.x * (b.r + 0.35) : b.pos.x, tz = dir.z ? far + dir.z * (b.r + 0.35) : b.pos.z;
    const gy = g.world.groundBelow(tx, box.maxY + 0.5, tz, b.r * 0.8, 6);
    if (!Number.isFinite(gy) || gy > box.maxY - 0.3 || !g.world.fits(tx, gy + 0.03, tz, b.r, b.h)) return;
    // Clear arc over the top.
    if (!g.world.fits((b.pos.x + tx) / 2, box.maxY + 0.05, (b.pos.z + tz) / 2, b.r * 0.8, 1.0)) return;
    this.vault = { t: 0, dur: 0.3 + depth * 0.08, from: { ...b.pos }, to: { x: tx, y: gy, z: tz }, peak: box.maxY + 0.2, dir, speed: Math.max(hs * 0.85, 5), height: rise };
    g.events.emit('vault', { height: rise, depth });
  }

  // Ducking: an overhead obstacle we could fit under at crouch height lowers the body until it's clear.
  updateCrouch(b, g) {
    const p = b.pos;
    if (this.crouch) {
      if (g.world.fits(p.x, p.y + 0.02, p.z, b.r, PHYS.playerHeight)) { this.crouch = false; b.h = PHYS.playerHeight; }
      return;
    }
    if (!b.blocked || !b.onGround) return;
    const box = b.blockBox;
    if (!box || box.minY < p.y + 0.95 || box.minY > p.y + PHYS.playerHeight) return;
    const nx = p.x - b.blockNX * 0.3, nz = p.z - b.blockNZ * 0.3;
    if (g.world.fits(nx, p.y + 0.02, nz, b.r, 1.1)) { this.crouch = true; b.h = 1.1; g.events.emit('duck', {}); }
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
    // The cap applies to the result too, so several hits in one volley can't stack into a launch.
    const h = Math.hypot(b.vel.x, b.vel.z), cap = COMBAT.knockbackMaxSpeed;
    if (h > cap) { b.vel.x *= cap / h; b.vel.z *= cap / h; }
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
