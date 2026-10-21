// BEACON (Marcus Hale), Palmetto Bay's own hero: an original caped flier. Tough, fast, hits hard.
// Primary Solar Gaze (eye-beam bolts) / Secondary Thunderclap (shockwave that throws enemies back) /
// Utility Surge (super-speed dash) / Special Flight (toggle: fly where you look; Space boosts up) /
// Passive Steel Skin (high health and fast regeneration: in base stats).

import { moveBody } from '../physics.js';

const FLY = { speed: 16, boost: 30, accel: 5 };

export const BEACON = {
  id: 'beacon',
  name: 'Beacon',
  role: 'Marcus Hale · protector of Palmetto Bay',
  accent: 0x1f7a45,
  base: { maxHp: 220, regen: 4, damage: 16, speed: 7.6, jumps: 2, crit: 0.05 },
  abilities: {
    primary: { name: 'Solar Gaze', desc: 'Bolts of light from the eyes, locking onto the target under the crosshair.', cooldown: 0 },
    secondary: { name: 'Thunderclap', desc: 'A clap that sends a shockwave out, hurting and throwing back everyone close.', cooldown: 6 },
    utility: { name: 'Surge', desc: 'A burst of super speed in the direction you are moving.', cooldown: 4 },
    special: { name: 'Flight', desc: 'Take off and fly where you look (Shift to go faster, Space to climb). Press again to land.', cooldown: 0.6 },
    passive: { name: 'Steel Skin', desc: 'Huge health and fast healing.' },
  },
  icons: { primary: 'beam', secondary: 'burst', utility: 'bolt', special: 'fly', jump: 'jump', equipment: 'equip' },
  touchLabels: { primary: 'Gaze', secondary: 'Clap', utility: 'Surge', special: 'Fly' },
  lore: 'Night-shift lineman by day, the town\'s guardian by night. Palmetto Bay\'s crime problem just met its match.',
  title: { game: 'PALMETTO BAY', tagline: 'One hero. One town. A lot of crime.', start: 'Patrol the town' },

  init(p) { p.hero = { fireT: 0, flying: false, clap: 0 }; },
  blocksSprint() { return false; },
  gravityMul(p) { return p.hero.flying ? 0 : 1; },

  // Flight: velocity eases toward the look direction (forward/back) plus strafe; no input hovers in place.
  fly(p, dt, input) {
    const h = p.hero;
    if (!h.flying) return false;
    const b = p.body, { dir } = p.aim(), r = p.right();
    const mx = input.moveX || 0, mz = input.moveZ || 0;
    const sp = input.sprint ? FLY.boost : FLY.speed;
    const t = { x: (dir.x * mz + r.x * mx) * sp, y: dir.y * mz * sp + (input.jumpPressed ? 10 : 0), z: (dir.z * mz + r.z * mx) * sp };
    const k = Math.min(1, FLY.accel * dt);
    b.vel.x += (t.x - b.vel.x) * k; b.vel.z += (t.z - b.vel.z) * k;
    b.vel.y = input.jumpPressed ? Math.max(b.vel.y, 10) : b.vel.y + (t.y - b.vel.y) * k;
    b.onGround = false;
    p.climbing = null;
    return true;
  },

  update(p, dt, input, g) {
    const h = p.hero, st = p.stats;
    h.fireT = Math.max(0, h.fireT - dt);
    h.clap = Math.max(0, h.clap - dt);
    // Primary: Solar Gaze, from the eyes.
    if (input.primary && h.fireT <= 0) {
      h.fireT = 1 / (3 * st.attackSpeed);
      const eyes = { x: p.pos.x, y: p.pos.y + 1.68, z: p.pos.z };
      g.projectiles.dart(p, eyes, g.aimTarget(p, 0.3, 110), g.aimPoint(p, 160), st.damage * 1.6);
      g.events.emit('ability', { slot: 'primary', kind: 'gaze' });
      g.stats.shots++;
    }
    // Secondary: Thunderclap.
    if (input.secondary && p.cooldowns.secondary <= 0) {
      const R = 8;
      for (const e of g.enemies) {
        if (!e.alive) continue;
        const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d > R || Math.abs(e.pos.y - p.pos.y) > 4) continue;
        const f = 1 - d / R, l = d || 1;
        g.combat.hitEnemy(e, { damage: st.damage * (2 + 3 * f), proc: 1, source: 'clap', pos: e.center(), knock: { x: (dx / l) * 14 * f + dx / l * 4, y: 5, z: (dz / l) * 14 * f + dz / l * 4 } });
      }
      h.clap = 0.4;
      p.cooldowns.secondary = this.abilities.secondary.cooldown;
      g.events.emit('ability', { slot: 'secondary', kind: 'clap', at: { ...p.pos } });
    }
    // Utility: Surge, swept through physics in small steps so it never passes through walls.
    if (input.utility && p.cooldowns.utility <= 0) {
      const f = p.forward(), r = p.right(), mx = input.moveX || 0, mz = input.moveZ || 0;
      let dx = f.x * mz + r.x * mx, dz = f.z * mz + r.z * mx;
      const l = Math.hypot(dx, dz);
      if (l < 0.1) { dx = f.x; dz = f.z; } else { dx /= l; dz /= l; }
      const b = p.body, from = { ...b.pos }, steps = 14, dist = 20;
      const vy = b.vel.y;
      b.vel = { x: (dx * dist) / (steps / 60), y: 0, z: (dz * dist) / (steps / 60) };
      for (let i = 0; i < steps; i++) { b.canMantle = !h.flying; moveBody(b, g.world, 1 / 60); b.vel.y = 0; }
      b.vel = { x: dx * 9, y: h.flying ? 0 : Math.max(0, vy), z: dz * 9 };
      p.invuln = Math.max(p.invuln, 0.3);
      p.climbing = null;
      if (p.latchedBy) { p.latchedBy.breakLatch?.(); p.latchedBy = null; }
      p.cooldowns.utility = this.abilities.utility.cooldown;
      g.events.emit('ability', { slot: 'utility', kind: 'surge', from, to: { ...b.pos } });
    }
    // Special: Flight on / off. Taking off from the ground pops you up first.
    if (input.special && p.cooldowns.special <= 0) {
      h.flying = !h.flying;
      if (h.flying && p.body.onGround) { p.body.vel.y = 9; p.body.onGround = false; }
      if (h.flying) { p.climbing = null; if (p.latchedBy) { p.latchedBy.breakLatch?.(); p.latchedBy = null; } }
      p.cooldowns.special = this.abilities.special.cooldown;
      g.events.emit('ability', { slot: 'special', kind: h.flying ? 'takeoff' : 'land' });
    }
  },
};
