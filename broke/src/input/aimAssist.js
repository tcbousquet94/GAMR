// Aim assist for mouse, pad and touch, after modern third-person shooters: raising the gun snaps the reticle onto the
// nearest enemy's body in a small cone in front of you (the head is still yours to find), and the look slows down
// while the reticle sits on a target. It only ever moves the input's view angles, like the player's own hand would,
// so the sim stays a pure function of its inputs. Also reports what the reticle is on, for the HUD.

import { CAM } from '../core/config.js';
import { raySphere } from '../sim/gun.js';

const SNAP_CONE = 0.26; // radians around the view direction
const SNAP_RANGE = 55;
const SNAP_TIME = 0.13;
const FRICTION = 0.65; // look speed while the reticle is on a target

export class AimAssist {
  constructor(input) {
    this.input = input;
    this.enabled = true;
    this.snap = null;
    this.wasAiming = false;
    this.on = null; // { enemy, part } under the reticle
  }

  update(dt, game) {
    const P = game?.player, I = this.input;
    if (!P || !P.kit.aims || P.dead) { I.sensMul = 1; this.on = null; this.snap = null; return; }
    // What the reticle is on (walls block it).
    const { origin: o, dir } = P.aim();
    const wall = game.world.raycast(o.x, o.y, o.z, dir.x, dir.y, dir.z, 140);
    let best = null, bt = wall;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      for (const hp of e.hitPoints()) {
        const t = raySphere(o, dir, hp, hp.r);
        if (t > 0.3 && t < bt) { bt = t; best = { enemy: e, part: hp.part }; }
      }
    }
    this.on = best;
    I.sensMul = (1 + (CAM.adsSensMul - 1) * P.aimBlend) * (this.enabled && best && P.aiming ? FRICTION : 1);
    // Snap on raising the gun.
    if (this.enabled && P.aiming && !this.wasAiming) this.snap = this.findSnap(game, P);
    this.wasAiming = P.aiming;
    if (this.snap) {
      const s = this.snap;
      s.t += dt;
      const k = Math.min(1, s.t / SNAP_TIME), e = k * k * (3 - 2 * k);
      I.yaw = s.y0 + wrap(s.y1 - s.y0) * e;
      I.pitch = s.p0 + (s.p1 - s.p0) * e;
      if (k >= 1 || !P.aiming) this.snap = null;
    }
  }

  // The enemy body closest to the view direction inside the cone, in sight; the view angles that centre it.
  findSnap(game, P) {
    const { origin: o, dir } = P.aim();
    let best = null, ba = SNAP_CONE;
    for (const e of game.enemies) {
      if (!e.alive || e.minion) continue;
      const q = e.hitPoints().find((h) => h.part === 'body') || e.center();
      const dx = q.x - o.x, dy = q.y - o.y, dz = q.z - o.z, d = Math.hypot(dx, dy, dz);
      if (d > SNAP_RANGE || d < 1) continue;
      const a = Math.acos(Math.min(1, (dx * dir.x + dy * dir.y + dz * dir.z) / d));
      if (a < ba && game.world.segmentClear(o, q)) { ba = a; best = q; }
    }
    if (!best) return null;
    // Solve for the angles from the aimed shoulder (the camera is about to be there).
    const p = P.pos, I = this.input;
    let yaw = I.yaw, pitch = I.pitch;
    for (let i = 0; i < 3; i++) {
      const ox = p.x + Math.cos(yaw) * CAM.ads.side, oz = p.z - Math.sin(yaw) * CAM.ads.side, oy = p.y + CAM.ads.height;
      const dx = best.x - ox, dz = best.z - oz;
      yaw = Math.atan2(-dx, -dz);
      pitch = Math.atan2(best.y - oy, Math.hypot(dx, dz));
    }
    return { t: 0, y0: I.yaw, p0: I.pitch, y1: I.yaw + wrap(yaw - I.yaw), p1: pitch };
  }
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
