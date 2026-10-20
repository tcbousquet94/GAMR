// DEE OKAFOR, ER night-shift nurse. Fast, fragile, ranged.
// Primary Syringe Darts (homing, usable while sprinting) / Secondary Rounds (ricocheting clipboard) /
// Utility Salsa Step (spinning teleport-dodge) / Special Code Blue (leap + syringe rain that slows) /
// Passive Night Shift (stronger as difficulty rises: handled in stats via base.nightShift).

import { moveBody } from '../physics.js';
import { clamp } from '../../core/math.js';

export const DEE = {
  id: 'dee',
  name: 'Dee Okafor',
  role: 'ER night-shift nurse',
  accent: 0x1fa89a,
  base: { maxHp: 95, regen: 1.2, damage: 12, speed: 7.2, jumps: 2, crit: 0.01, nightShift: true },
  abilities: {
    primary: { name: 'Syringe Darts', desc: 'Homing darts. Usable while sprinting.', cooldown: 0 },
    secondary: { name: 'Rounds', desc: 'Throw a clipboard that ricochets between up to 6 enemies, hitting harder each bounce.', cooldown: 7 },
    utility: { name: 'Salsa Step', desc: 'A short spinning teleport-dodge. Briefly untouchable.', cooldown: 6 },
    special: { name: 'Code Blue', desc: 'Leap up and rain syringes on an area, slowing enemies.', cooldown: 14 },
    passive: { name: 'Night Shift', desc: 'Stronger as the difficulty rises.' },
  },
  lore: 'Twelve years in the ER. Calm in any crisis. Loves salsa dancing. Her shift ended an hour ago.',

  init(p) {
    p.dee = { fireT: 0, rain: null, step: 0, hand: 0 };
  },

  blocksSprint() { return false; }, // darts are usable while sprinting

  gravityMul(p) { return p.dee.rain && p.dee.rain.leap > 0 ? 0.35 : 1; },

  update(p, dt, input, g) {
    const d = p.dee;
    const st = p.stats;
    d.fireT = Math.max(0, d.fireT - dt);
    d.step = Math.max(0, d.step - dt);
    // Primary.
    if (input.primary && d.fireT <= 0) {
      const rate = 2.4 * st.attackSpeed;
      d.fireT = 1 / rate;
      const target = g.aimTarget(p, 0.3, 90);
      const aim = g.aimPoint(p, 150);
      d.hand = 1 - d.hand;
      const h = p.hand();
      if (d.hand) { const r = p.right(); h.x -= r.x * 0.6; h.z -= r.z * 0.6; }
      g.projectiles.dart(p, h, target, aim, st.damage * 1.5);
      g.events.emit('ability', { slot: 'primary', kind: 'dart' });
      g.stats.shots++;
    }
    // Secondary: Rounds.
    if (input.secondary && p.cooldowns.secondary <= 0) {
      const e = g.aimTarget(p, 0.45, 60)?.enemy || null;
      g.projectiles.clipboard(p, p.hand(), e, g.aimPoint(p, 60), st.damage * 3);
      p.cooldowns.secondary = this.abilities.secondary.cooldown;
      g.events.emit('ability', { slot: 'secondary', kind: 'clipboard' });
    }
    // Utility: Salsa Step. Distance scales with move speed, so Comfy Insoles make her dodge further.
    if (input.utility && p.cooldowns.utility <= 0) {
      const mx = input.moveX || 0, mz = input.moveZ || 0;
      const f = p.forward(), r = p.right();
      let dx = f.x * mz + r.x * mx, dz = f.z * mz + r.z * mx;
      const l = Math.hypot(dx, dz);
      if (l < 0.1) { dx = f.x; dz = f.z; } else { dx /= l; dz /= l; }
      const dist = 11 * clamp(Math.sqrt(st.moveMul), 1, 1.6);
      // Sweep through physics in small steps so it never passes through walls.
      const b = p.body;
      const saveVel = { ...b.vel };
      const from = { ...b.pos };
      const steps = 12;
      b.vel = { x: (dx * dist) / (steps * (1 / 60)), y: 0, z: (dz * dist) / (steps * (1 / 60)) };
      for (let i = 0; i < steps; i++) { b.canMantle = true; moveBody(b, g.world, 1 / 60); b.vel.y = 0; }
      b.vel = { x: saveVel.x * 0.3 + dx * 4, y: Math.max(0, saveVel.y), z: saveVel.z * 0.3 + dz * 4 };
      p.invuln = Math.max(p.invuln, 0.4);
      p.climbing = null;
      d.step = 0.4;
      if (p.latchedBy) { p.latchedBy.breakLatch?.(); p.latchedBy = null; }
      p.cooldowns.utility = this.abilities.utility.cooldown;
      g.events.emit('ability', { slot: 'utility', kind: 'salsa', from, to: { ...b.pos } });
    }
    // Special: Code Blue.
    if (input.special && p.cooldowns.special <= 0) {
      const aim = g.aimPoint(p, 60, true);
      d.rain = { x: aim.x, y: aim.y, z: aim.z, t: 0, dur: 2.4, next: 0, leap: 0.9, count: 0 };
      p.body.vel.y = 15;
      p.body.onGround = false;
      p.cooldowns.special = this.abilities.special.cooldown;
      g.events.emit('ability', { slot: 'special', kind: 'codeblue', at: { x: aim.x, y: aim.y, z: aim.z } });
    }
    if (d.rain) {
      const R = d.rain;
      R.t += dt;
      R.leap -= dt;
      R.next -= dt;
      if (R.t > 0.35 && R.next <= 0) {
        R.next = 0.12;
        for (let k = 0; k < 2; k++) {
          const a = g.rng.next() * Math.PI * 2, rr = Math.sqrt(g.rng.next()) * 7;
          g.projectiles.syringe({ x: R.x + Math.cos(a) * rr, y: R.y + 16, z: R.z + Math.sin(a) * rr }, st.damage * 1.1, true);
          R.count++;
        }
      }
      if (R.t >= R.dur) d.rain = null;
    }
  },
};
