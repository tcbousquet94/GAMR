// Hitscan guns (revolver first), after modern third-person shooters: hold aim to raise the gun, click per shot (the
// hammer has to be cocked between shots), a cylinder that reloads a round at a time, spread that is tight when aimed
// and loose from the hip or on the move, recoil that climbs and settles, headshots that pay off, damage that falls
// off with range. Shots trace from the camera's shoulder pivot along the aim (what is under the reticle), then check
// the muzzle can actually see that point so you can't shoot through the corner you're hiding behind.

import { finite } from '../core/math.js';

const FIRE_BUFFER = 0.15; // a click slightly before the hammer is back still fires as soon as it is

export class Gun {
  constructor(def) {
    this.def = def;
    this.ammo = def.cylinder;
    this.cockT = 0; // time until the next shot is ready
    this.reload = null; // { t } while reloading
    this.bloom = 0;
    this.buffer = 0;
    this.wasPrimary = false;
  }

  get reloading() { return !!this.reload; }

  update(p, dt, input, g) {
    const D = this.def;
    this.cockT = Math.max(0, this.cockT - dt);
    this.bloom = Math.max(0, this.bloom - D.bloomDecay * dt);
    const pressed = !!input.primary && !this.wasPrimary;
    this.wasPrimary = !!input.primary;
    this.buffer = pressed ? FIRE_BUFFER : Math.max(0, this.buffer - dt);
    const busy = p.climbing || p.vault || p.cart > 0;

    if (input.reload && !this.reload && this.ammo < D.cylinder && !busy) this.startReload(g);
    if (this.reload) {
      // Firing with rounds loaded cancels the reload (the cylinder takes rounds one at a time).
      if (this.buffer > 0 && this.ammo > 0) { this.reload = null; g.events.emit('reloadCancel', {}); }
      else {
        this.reload.t -= dt;
        if (this.reload.t <= 0) {
          this.ammo++;
          g.events.emit('reloadRound', { ammo: this.ammo });
          if (this.ammo >= D.cylinder) { this.reload = null; g.events.emit('reloadDone', {}); }
          else this.reload.t = D.reloadRound;
        }
        return;
      }
    }
    if (this.buffer <= 0 || this.cockT > 0 || busy) return;
    this.buffer = 0;
    if (this.ammo <= 0) { g.events.emit('dryFire', {}); this.startReload(g); return; }
    this.fire(p, g);
  }

  startReload(g) {
    this.reload = { t: this.def.reloadStart + this.def.reloadRound };
    g.events.emit('reloadStart', { ammo: this.ammo });
  }

  // Current cone half-angle (radians): aimed vs hip, plus movement, air and bloom from recent shots.
  spread(p) {
    const D = this.def, k = p.aimBlend;
    const hs = Math.hypot(p.body.vel.x, p.body.vel.z);
    const moving = Math.min(1, hs / 5);
    return D.spreadHip + (D.spreadAds - D.spreadHip) * k + D.spreadMove * moving * (1 - 0.6 * k) + (p.body.onGround ? 0 : D.spreadAir) + this.bloom;
  }

  fire(p, g) {
    const D = this.def;
    const rapid = g.arcade?.active('rapid'); // power-up: a fast hammer and a cylinder that never empties
    if (!rapid) this.ammo--;
    this.cockT = D.cock * (rapid ? 0.45 : 1);
    const spread = this.spread(p);
    const { origin: O, dir: d0 } = p.aim();
    const dir = coneSample(d0, spread, g.rng);
    // What's under the (spread) reticle: the first of world geometry or an enemy hit sphere.
    let t = finite(g.world.raycast(O.x, O.y, O.z, dir.x, dir.y, dir.z, D.range), D.range);
    let hitE = null, part = null;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      for (const hp of e.hitPoints()) {
        const s = raySphere(O, dir, hp, hp.r);
        if (s > 0.3 && s < t) { t = s; hitE = e; part = hp.part; }
      }
    }
    const end = { x: O.x + dir.x * t, y: O.y + dir.y * t, z: O.z + dir.z * t };
    // The muzzle must see that point too, otherwise the round stops on whatever is in the way.
    const muzzle = p.muzzle();
    const mx = end.x - muzzle.x, my = end.y - muzzle.y, mz = end.z - muzzle.z, ml = Math.hypot(mx, my, mz);
    if (ml > 0.2) {
      const bt = g.world.raycast(muzzle.x, muzzle.y, muzzle.z, mx / ml, my / ml, mz / ml, ml);
      if (bt < ml - 0.15) { hitE = null; part = null; end.x = muzzle.x + (mx / ml) * bt; end.y = muzzle.y + (my / ml) * bt; end.z = muzzle.z + (mz / ml) * bt; t = Math.hypot(end.x - O.x, end.y - O.y, end.z - O.z); }
    }
    const head = part === 'head';
    if (hitE) {
      const dmg = damageAt(D, t, head) * (p.stats.damage / p.base.damage);
      g.combat.hitEnemy(hitE, { damage: dmg, proc: 1, source: 'revolver', pos: end, part, noCrit: true, knock: { x: dir.x * D.knock * (head ? 1.6 : 1), y: 1, z: dir.z * D.knock * (head ? 1.6 : 1) } });
    } else if (t < D.range - 0.01) g.events.emit('impact', { kind: 'bullet', pos: end, normal: { x: -dir.x, y: -dir.y, z: -dir.z } });
    g.events.emit('shot', { from: muzzle, to: end, hit: !!hitE, head, ammo: this.ammo });
    g.events.emit('ability', { slot: 'primary', kind: 'revolver' });
    g.stats.shots++;
    // Recoil: the muzzle climbs (less when aimed) and drifts a little sideways; Player springs it back.
    p.recoil.pitch += D.recoil * (1 - 0.35 * p.aimBlend);
    p.recoil.yaw += (g.rng.next() * 2 - 1) * D.recoilYaw;
    this.bloom = Math.min(D.bloomMax, this.bloom + D.bloom);
  }
}

// Damage for a hit at distance t: full up to falloff[0], linear down to minMul at falloff[1] and beyond.
export function damageAt(D, t, head) {
  const [a, b] = D.falloff;
  const k = t <= a ? 1 : t >= b ? D.minMul : 1 - (1 - D.minMul) * ((t - a) / (b - a));
  return D.damage * k * (head ? D.headMul : 1);
}

// Distance along the unit ray (o, d) to the near surface of sphere (c, r), or -1 if it misses.
export function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  const t0 = -b - s;
  return t0 >= 0 ? t0 : cc < 0 ? 0 : -1; // starting inside the sphere counts as a hit at once
}

// A unit direction inside a cone of half-angle `a` around d (uniform over the cone's disc).
export function coneSample(d, a, rng) {
  if (!(a > 0)) return { ...d };
  const r = Math.tan(a) * Math.sqrt(rng.next()), th = rng.next() * Math.PI * 2;
  // Basis perpendicular to d.
  const up = Math.abs(d.y) < 0.99 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  let ux = up.y * d.z - up.z * d.y, uy = up.z * d.x - up.x * d.z, uz = up.x * d.y - up.y * d.x;
  const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = d.y * uz - d.z * uy, vy = d.z * ux - d.x * uz, vz = d.x * uy - d.y * ux;
  const c = Math.cos(th) * r, s = Math.sin(th) * r;
  const x = d.x + ux * c + vx * s, y = d.y + uy * c + vy * s, z = d.z + uz * c + vz * s, l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
}
