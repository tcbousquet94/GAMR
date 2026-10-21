// Procedural character animation. One Animator per character. Every frame it builds a target pose from layers
// (gait with foot-planting leg IK, momentum lean and bank, upper-body actions, contextual moves, look-at, idle
// life), adds a spring-driven "partial ragdoll" hit layer, then eases every joint toward the target with a
// critically damped spring so no state change ever pops.
//
// Conventions (see models/humanoid.js): local -z is forward. Positive rx swings a limb forward; positive torso rx
// leans back; positive rz on the right arm raises it out to the side.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

// Leg geometry for the unit humanoid (scaled by `scale`).
const HIP_H = 0.89, THIGH = 0.43, SHIN = 0.4, SOLE = 0.055, HIP_X = 0.09;

// Critically damped spring (semi-implicit, stable at any dt).
function cd(s, target, omega, dt) {
  const f = 1 + 2 * dt * omega, oo = omega * omega, hoo = dt * oo, hhoo = dt * hoo;
  const det = 1 / (f + hhoo);
  const x = (f * s.v + dt * s.dv + hhoo * target) * det;
  s.dv = (s.dv + hoo * (target - s.v)) * det;
  s.v = x;
  return x;
}
// Underdamped spring for wobbly hit reactions.
function wobble(s, omega, zeta, dt) {
  s.dv += (-omega * omega * s.v - 2 * zeta * omega * s.dv) * dt;
  s.v += s.dv * dt;
  return s.v;
}

const JOINTS = ['hips', 'torso', 'head', 'armL', 'armR', 'foreL', 'foreR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR'];

export const FIDGETS = {
  // Dee checks her watch: lifts her left wrist and glances down at it.
  watch: { dur: 1.9, apply(p, k) { p.armL[0] += 1.25 * k; p.armL[2] -= 0.25 * k; p.armL[1] += 0.5 * k; p.foreL[0] += 1.55 * k; p.head[0] += 0.38 * k; p.head[1] += 0.28 * k; p.torso[1] += 0.1 * k; } },
  // Marco rolls his shoulders (Phase 2).
  shoulders: { dur: 1.6, apply(p, k, t) { const r = Math.sin(t * 7); p.armL[2] -= 0.25 * k * r; p.armR[2] += 0.25 * k * r; p.torso[0] += 0.05 * k * Math.cos(t * 7); p.head[2] += 0.12 * k * r; } },
  // Paulie adjusts his hat (Phase 2).
  hat: { dur: 1.5, apply(p, k) { p.armR[0] += 2.6 * k; p.armR[2] += 0.4 * k; p.foreR[0] += 1.2 * k; p.head[0] -= 0.12 * k; } },
  // Enemies: Speakerphone Guy paces and gestures, the Canvasser fans his clipboard.
  gesture: { dur: 1.2, apply(p, k, t) { p.armL[0] += 1.0 * k; p.armL[2] -= 0.4 * k; p.foreL[0] += 0.8 * k + Math.sin(t * 9) * 0.3 * k; } },
  fan: { dur: 1.4, apply(p, k, t) { p.foreL[1] += Math.sin(t * 11) * 0.4 * k; } },
};

export class Animator {
  constructor(opts = {}) {
    this.o = { scale: 1, gait: true, armSwing: 1, fidgets: [], freq: 1, lookRange: 24, ...opts };
    this.j = {};
    for (const n of JOINTS) this.j[n] = [{ v: 0, dv: 0 }, { v: 0, dv: 0 }, { v: 0, dv: 0 }];
    this.hipsT = [{ v: 0, dv: 0 }, { v: 0, dv: 0 }, { v: 0, dv: 0 }];
    this.extra = {}; // cloth / eyes / props: passed through with light smoothing
    this.yaw = null; this.yawS = { v: 0, dv: 0 };
    this.phase = 0;
    this.speed = { v: 0, dv: 0 };
    this.accF = { v: 0, dv: 0 }; this.accS = { v: 0, dv: 0 };
    this.prevVel = null;
    this.yawRate = 0;
    this.pelvis = { v: 0, dv: 0 };
    this.footG = [{ v: 0, dv: 0 }, { v: 0, dv: 0 }];
    this.w = {}; // layer weights (smoothed 0..1)
    this.hit = { tx: { v: 0, dv: 0 }, tz: { v: 0, dv: 0 }, hx: { v: 0, dv: 0 }, hz: { v: 0, dv: 0 }, aL: { v: 0, dv: 0 }, aR: { v: 0, dv: 0 }, dip: { v: 0, dv: 0 } };
    this.look = { yaw: { v: 0, dv: 0 }, pitch: { v: 0, dv: 0 } };
    this.idleT = 0; this.fidget = null; this.fidgetIn = 2.5 + Math.random() * 3;
    this.shift = Math.random() * 10;
    this.t = Math.random() * 10;
    this.timers = { pivot: 0, skid: 0, land: 0, brace: 0, recentFast: 0 };
    this.pivotSign = 1;
    this.landDip = { v: 0, dv: 0 };
    this.seed = Math.random() * 1000;
  }

  // Event hooks from the sim.
  onPivot(sign) { this.timers.pivot = 0.32; this.pivotSign = sign; }
  onSkid() { this.timers.skid = 0.4; }
  onLand(hard, v) { if (hard) this.timers.land = 0.55; this.landDip.dv -= Math.min(3.5, v * 0.12) * (hard ? 1.6 : 0.7); }
  // Partial ragdoll: push the body in the hit's direction; each hit gets its own random twist.
  onHit(dir, strength) {
    const s = clamp(strength, 0.15, 1.6);
    const c = Math.cos(this.yaw || 0), sn = Math.sin(this.yaw || 0);
    // World direction -> local (fwd = -z, right = +x).
    const lf = -(dir.x * -sn + dir.z * -c), lr = dir.x * c - dir.z * sn;
    const r = () => (Math.random() - 0.5) * 2;
    this.hit.tx.dv += (lf * 16 + r() * 3) * s; // positive = pushed backward (torso leans back)
    this.hit.tz.dv += (-lr * 14 + r() * 3) * s;
    this.hit.hx.dv += (lf * 13 + r() * 4) * s;
    this.hit.hz.dv += (-lr * 12 + r() * 4) * s;
    this.hit.aL.dv += (r() * 16 - lf * 8 - lr * 6) * s;
    this.hit.aR.dv += (r() * 16 - lf * 8 + lr * 6) * s;
    this.hit.dip.dv -= 2.5 * s;
    // The hips get shoved too (a stagger step), so the whole body moves, not just the spine.
    this.hit.px = (this.hit.px || { v: 0, dv: 0 }); this.hit.pz = (this.hit.pz || { v: 0, dv: 0 });
    this.hit.px.dv += lr * 2.2 * s; this.hit.pz.dv += lf * 2.2 * s;
    this.hitT = 0.45;
  }

  // ctx: { pos, vel, onGround, climbing, climbWall, crouch, vault, hardLand, aimYaw, aimPitch, face ('aim'|'move'),
  //        firing, stunned, world, lookAt, overlay(p, st), t }
  update(dt, ctx) {
    dt = Math.min(dt, 1 / 20);
    const o = this.o;
    const S = o.scale;
    this.t += dt;
    const t = this.t;
    for (const k in this.timers) this.timers[k] = Math.max(0, this.timers[k] - dt);
    const v = ctx.vel;
    const hs = Math.hypot(v.x, v.z);
    const sp = cd(this.speed, hs, 14, dt);
    const spN = clamp(sp / (8 * S), 0, 1.4); // normalised: 1 = run
    // ---- facing --------------------------------------------------------------------------------------------
    let want = this.yaw ?? ctx.aimYaw ?? 0;
    if (ctx.face === 'aim' && ctx.aimYaw != null) want = ctx.aimYaw;
    else if (ctx.climbWall) want = Math.atan2(-ctx.climbWall.x, -ctx.climbWall.z);
    else if (hs > 0.6) want = Math.atan2(-v.x, -v.z);
    if (this.yaw == null) { this.yaw = want; this.yawS.v = want; }
    const diff = wrap(want - this.yaw);
    const omega = this.timers.pivot > 0 ? 22 : ctx.face === 'aim' ? 18 : 9 + 4 / (1 + sp);
    const target = this.yaw + diff;
    this.yawS.v = this.yaw;
    const ny = cd(this.yawS, target, omega, dt);
    this.yawRate = wrap(ny - this.yaw) / dt;
    this.yaw = wrap(ny);
    // Acceleration in the body frame (for lean): forward / side.
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    if (this.prevVel) {
      const ax = (v.x - this.prevVel.x) / dt, az = (v.z - this.prevVel.z) / dt;
      cd(this.accF, clamp(-(ax * -s + az * -c), -40, 40), 10, dt);
      cd(this.accS, clamp(ax * c - az * s, -40, 40), 10, dt);
    }
    this.prevVel = { x: v.x, z: v.z };
    const localFwd = -(v.x * -s + v.z * -c), localSide = v.x * c - v.z * s;
    // Remember recent speed for bracing on stops.
    if (sp > 5) this.timers.recentFast = 0.6;
    // ---- layer weights ---------------------------------------------------------------------------------------
    const W = this.w;
    const target01 = (name, on, rate = 10) => { const cur = W[name] ?? 0; W[name] = cur + ((on ? 1 : 0) - cur) * Math.min(1, rate * dt); return W[name]; };
    const air = target01('air', !ctx.onGround && !ctx.climbing && !ctx.vault, 8);
    const climb = target01('climb', !!ctx.climbing, 12);
    const vault = target01('vault', !!ctx.vault, 18);
    const crouch = target01('crouch', !!ctx.crouch, 8);
    const land = target01('land', this.timers.land > 0, 14);
    const skid = target01('skid', this.timers.skid > 0 && sp > 2.5, 12);
    const pivot = target01('pivot', this.timers.pivot > 0, 16);
    const stun = target01('stun', !!ctx.stunned, 8);
    const idle = target01('idle', sp < 0.4 && ctx.onGround && !ctx.climbing, 3);
    // ---- gait ---------------------------------------------------------------------------------------------------
    const moving = ctx.onGround && !ctx.climbing && !ctx.vault && o.gait;
    const freq = (0.95 + 0.2 * sp / S) * o.freq; // cadence rises with speed (~2.9 Hz at a sprint)
    if (moving && sp > 0.15) this.phase += TAU * freq * dt;
    else this.phase += wrap(Math.round(this.phase / Math.PI) * Math.PI - this.phase) * Math.min(1, 6 * dt); // settle to a neutral stance
    const amp = clamp(sp / (3.2 * S), 0, 1) * (1 - air) * (1 - climb) * (1 - vault);
    const stepLen = clamp((sp / freq) * 0.5, 0, 2.1 * S); // metres per step
    const p = {};
    for (const n of JOINTS) p[n] = [0, 0, 0];
    let hipsT = [0, 0, 0];
    // ---- legs with foot planting (IK) ------------------------------------------------------------------------
    const world = ctx.world;
    const footGround = (side, fwd) => {
      if (!world || !ctx.onGround) return 0;
      const lx = side * HIP_X * S, lz = -fwd;
      const wx = ctx.pos.x + lx * c + lz * s, wz = ctx.pos.z - lx * s + lz * c;
      const gy = world.groundBelow(wx, ctx.pos.y + 0.75 * S, wz, 0.04, 1.4 * S);
      return Number.isFinite(gy) ? clamp(gy - ctx.pos.y, -0.75 * S, 0.7 * S) : 0;
    };
    const legs = [];
    for (const [i, side, ph] of [[0, -1, this.phase], [1, 1, this.phase + Math.PI]]) {
      const run = clamp((sp - 4 * S) / (4 * S), 0, 1);
      // Foot travel relative to the hip, capped: at speed the stride lengthens through flight time, not splits.
      const fwd = Math.min(stepLen * 0.5, 0.44 * S) * Math.sin(ph) * amp;
      const swing = Math.max(0, Math.cos(ph));
      const lift = (0.1 + 0.18 * run) * S * Math.pow(swing, 1.4) * amp;
      const g = cd(this.footG[i], footGround(side, fwd), 30, dt);
      legs.push({ side, fwd, lift, g, ph });
    }
    // Pelvis drops to let the lower foot reach (stairs, curbs); small bounce per step when running.
    const pelvisT = Math.min(legs[0].g, legs[1].g, 0) + (moving ? -Math.abs(Math.sin(this.phase)) * 0.045 * amp * S - 0.04 * amp * S : 0);
    const pelvis = cd(this.pelvis, pelvisT, 18, dt);
    const dip = wobble(this.landDip, 11, 0.55, dt);
    hipsT[1] = pelvis + dip * 0.12 * S - crouch * 0.42 * S - land * 0.32 * S;
    const hipH = HIP_H * S + hipsT[1];
    const L1 = THIGH * S, L2 = SHIN * S;
    for (const L of legs) {
      // Target ankle in the leg's sagittal plane, relative to the hip.
      const ay = L.g + L.lift + SOLE * S - hipH;
      let az = L.fwd + (crouch * 0.12 + land * 0.1) * S * (L.side < 0 ? 1 : -0.4);
      if (air > 0) az = az * (1 - air) + air * (L.side < 0 ? 0.25 : -0.15) * S;
      const ayA = air > 0 ? ay * (1 - air) + air * (-0.62 * S) : ay;
      let d = Math.hypot(az, ayA);
      d = clamp(d, 0.2 * S, (L1 + L2) * 0.998);
      const knee = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
      const a = Math.atan2(az, -ayA);
      const thigh = a + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const n = L.side < 0 ? 'L' : 'R';
      p[`leg${n}`] = [thigh, 0, L.side * (0.03 + 0.04 * crouch)];
      p[`shin${n}`] = [-knee, 0, 0];
      // Keep the sole flat to the ground, with a little toe-off in the push phase.
      const toe = Math.max(0, -Math.cos(L.ph)) * Math.max(0, -Math.sin(L.ph)) * 0.5 * amp;
      p[`foot${n}`] = [-(thigh - knee) + toe * (1 - air), 0, 0];
    }
    // ---- upper body: arm swing, twist, lean, bank ------------------------------------------------------------
    const swingA = (0.25 + 0.55 * clamp(sp / (6 * S), 0, 1)) * amp * o.armSwing;
    const sw = Math.sin(this.phase);
    p.armL = [-sw * swingA * 1.1, 0, -0.1];
    p.armR = [sw * swingA * 1.1, 0, 0.1];
    p.foreL = [0.28 + 0.9 * clamp(sp / (7 * S), 0, 1), 0, 0];
    p.foreR = [0.28 + 0.9 * clamp(sp / (7 * S), 0, 1), 0, 0];
    // Relaxed shoulders: arms hang slightly forward and out, never bolt upright.
    p.armL[0] += 0.08; p.armR[0] += 0.08; p.armL[2] -= 0.06; p.armR[2] += 0.06;
    p.hips = [0, sw * 0.12 * amp, -sw * 0.04 * amp];
    const lean = clamp(-this.accF.v * 0.022 - spN * 0.16, -0.5, 0.35);
    const bank = clamp(this.yawRate * sp * 0.012 + this.accS.v * 0.006, -0.35, 0.35);
    p.torso = [lean, -sw * 0.16 * amp, bank];
    p.head = [-lean * 0.6 + 0.04 * spN, sw * 0.06 * amp, -bank * 0.5];
    hipsT[0] = bank * 0.06 * S;
    // Idle life: breathing, weight shifts, fidgets.
    const breathe = Math.sin(t * 1.45 + this.seed) * (1 - spN * 0.7);
    p.torso[0] += breathe * 0.022;
    p.armL[2] -= breathe * 0.02; p.armR[2] += breathe * 0.02;
    if (idle > 0.01) {
      const shift = Math.sin(t * 0.55 + this.shift);
      hipsT[0] += shift * 0.05 * S * idle;
      p.hips[2] += shift * 0.05 * idle;
      p.torso[2] -= shift * 0.06 * idle;
      p.legL[0] += Math.max(0, shift) * 0.1 * idle; p.shinL[0] -= Math.max(0, shift) * 0.28 * idle;
      p.legR[0] += Math.max(0, -shift) * 0.1 * idle; p.shinR[0] -= Math.max(0, -shift) * 0.28 * idle;
      p.footL[0] += Math.max(0, shift) * 0.12 * idle; p.footR[0] += Math.max(0, -shift) * 0.12 * idle;
      p.head[1] += Math.sin(t * 0.37 + this.seed) * 0.15 * idle;
    }
    if (idle > 0.9 && !ctx.firing && o.fidgets.length) {
      this.idleT += dt;
      if (!this.fidget && this.idleT > this.fidgetIn) { this.fidget = { def: FIDGETS[o.fidgets[Math.floor(Math.random() * o.fidgets.length)]], t: 0 }; this.idleT = 0; this.fidgetIn = 6 + Math.random() * 7; }
    } else this.idleT = 0;
    if (this.fidget) {
      const f = this.fidget;
      f.t += dt;
      const k = Math.sin(clamp(f.t / f.def.dur, 0, 1) * Math.PI);
      const kk = Math.min(1, k * 1.6) * (idle > 0.5 ? 1 : 0);
      f.def.apply(p, kk, f.t);
      if (f.t > f.def.dur || idle < 0.5) this.fidget = null;
    }
    // ---- contextual moves -------------------------------------------------------------------------------------
    if (air > 0.01) {
      const up = clamp(v.y / 10, -1, 1);
      blend(p, air, { armL: [0.5 + up * 0.4, 0, -0.6], armR: [-0.2 + up * 0.3, 0, 0.6], foreL: [0.6, 0, 0], foreR: [0.7, 0, 0], torso: [-0.12 - (up < 0 ? up * 0.15 : 0), 0, 0] });
    }
    if (climb > 0.01) {
      // Hands reach for rungs alternately, timed to height climbed (0.9 m rungs), legs push.
      const cph = (ctx.pos.y / (0.9 * S)) * Math.PI;
      const cL = Math.sin(cph), cR = -cL;
      blend(p, climb, {
        armL: [2.55 + cL * 0.3, 0, -0.12], armR: [2.55 + cR * 0.3, 0, 0.12], foreL: [0.35 - cL * 0.3, 0, 0], foreR: [0.35 - cR * 0.3, 0, 0],
        legL: [0.95 + cL * 0.45, 0, -0.05], legR: [0.95 + cR * 0.45, 0, 0.05], shinL: [-1.35 - cL * 0.3, 0, 0], shinR: [-1.35 - cR * 0.3, 0, 0], footL: [0.4, 0, 0], footR: [0.4, 0, 0],
        torso: [0.12, 0, 0], head: [-0.35, 0, 0], hips: [0, 0, 0],
      });
      hipsT = mix3(hipsT, [0, -0.05 * S, 0.08 * S], climb);
    }
    if (vault > 0.01) {
      // Speed vault: left hand plants on the top, legs swing through to the side.
      const k = ctx.vault ? clamp(ctx.vault.t / ctx.vault.dur, 0, 1) : 1;
      const tuck = Math.sin(k * Math.PI);
      blend(p, vault, {
        armL: [0.9 + 0.5 * (1 - k), 0, -0.25], foreL: [0.15, 0, 0], armR: [0.4, 0, 0.9 * tuck + 0.2], foreR: [0.5, 0, 0],
        legL: [1.2 * tuck + 0.2, 0, 0.5 * tuck], legR: [1.0 * tuck, 0, 0.6 * tuck], shinL: [-1.1 * tuck, 0, 0], shinR: [-1.5 * tuck, 0, 0],
        torso: [-0.35 * tuck, 0.3 * tuck, -0.45 * tuck], hips: [0, 0.5 * tuck, 0.25 * tuck], head: [0.1, -0.2 * tuck, 0.2 * tuck],
      });
    }
    if (crouch > 0.01) blend(p, crouch, { torso: [-0.45, 0, 0], head: [0.35, 0, 0] }, true);
    if (land > 0.01) blend(p, land, { torso: [-0.55, 0, 0], head: [0.4, 0, 0], armL: [0.6, 0, -0.7], armR: [0.6, 0, 0.7], foreL: [0.5, 0, 0], foreR: [0.5, 0, 0] });
    if (skid > 0.01) {
      // Sprint stop: lean back, lead leg braced out front, arms out for balance.
      blend(p, skid, { torso: [0.32, 0, 0], legL: [0.55, 0, 0], shinL: [-0.15, 0, 0], legR: [-0.2, 0, 0], shinR: [-0.7, 0, 0], armL: [0.3, 0, -0.6], armR: [0.3, 0, 0.6], head: [-0.15, 0, 0] });
      hipsT[1] -= 0.08 * S * skid;
    }
    if (pivot > 0.01) blend(p, pivot, { torso: [-0.25, 0.55 * this.pivotSign, 0.2 * this.pivotSign], hips: [0, -0.4 * this.pivotSign, 0], armL: [0.4, 0, -0.5], armR: [0.4, 0, 0.5], head: [-0.1, 0.4 * this.pivotSign, 0] }, false, 0.7);
    // Wall contact: running close past a wall, the near hand reaches out and brushes it; stopping at a wall braces.
    if (world && ctx.onGround && !ctx.climbing && climb < 0.5) {
      const reach = (side) => {
        const lx = side * 1.0, wx = c * lx, wz = -s * lx;
        const y = ctx.pos.y + 1.2 * S;
        const tHit = world.raycast(ctx.pos.x, y, ctx.pos.z, wx, 0, wz, 1.25 * S);
        return tHit < 1.25 * S ? tHit : null;
      };
      this.wallT = (this.wallT || 0) - dt;
      if (this.wallT <= 0) { this.wallT = 0.1; this.wallL = sp > 3 ? reach(-1) : null; this.wallR = sp > 3 ? reach(1) : null;
        const fx = -s, fz = -c;
        const tf = world.raycast(ctx.pos.x, ctx.pos.y + 1.2 * S, ctx.pos.z, fx, 0, fz, 1.1 * S);
        this.wallF = tf < 1.1 * S ? tf : null; }
      const wl = target01('wallL', this.wallL != null, 9), wr = target01('wallR', this.wallR != null, 9);
      if (wl > 0.01) blend(p, wl * 0.85, { armL: [0.35, 0.2, -1.15 - 0.2 * Math.sin(t * 9)], foreL: [0.15, 0, 0] }, false, 1);
      if (wr > 0.01) blend(p, wr * 0.85, { armR: [0.35, -0.2, 1.15 + 0.2 * Math.sin(t * 9)], foreR: [0.15, 0, 0] }, false, 1);
      if (this.wallF != null && sp < 2 && this.timers.recentFast > 0) this.timers.brace = 0.8;
      const br = target01('brace', this.timers.brace > 0 && this.wallF != null, 10);
      if (br > 0.01) blend(p, br, { armL: [1.45, 0, -0.25], armR: [1.45, 0, 0.25], foreL: [0.25, 0, 0], foreR: [0.25, 0, 0], torso: [-0.18, 0, 0], head: [0.12, 0, 0] });
    }
    // Stunned: slumped and swaying.
    if (stun > 0.01) blend(p, stun, { torso: [-0.35, 0, Math.sin(t * 5) * 0.2], head: [0.5, Math.sin(t * 3) * 0.4, Math.sin(t * 4.3) * 0.3], armL: [0.1, 0, -0.15], armR: [0.1, 0, 0.15], foreL: [0.3, 0, 0], foreR: [0.3, 0, 0] });
    // ---- character-specific upper-body actions (aiming, phone, clipboard, scooter...) -----------------------------
    const st = { t, speed: spN, windup: ctx.telegraph || 0, stun: ctx.stunned || 0, firing: ctx.firing, pitch: ctx.aimPitch || 0, ...ctx.extra };
    if (ctx.overlay) ctx.overlay(p, st, hipsT);
    // Aiming: torso turns toward the aim direction when the legs face elsewhere.
    if (ctx.aimYaw != null && ctx.face !== 'aim' && ctx.firing) {
      const off = clamp(wrap(ctx.aimYaw - this.yaw), -1.1, 1.1);
      p.torso[1] += off * 0.55; p.head[1] += off * 0.35;
    }
    // ---- look-at: head (and eyes) track the target ----------------------------------------------------------------
    let ly = 0, lp = 0;
    if (ctx.lookAt) {
      const dx = ctx.lookAt.x - ctx.pos.x, dz = ctx.lookAt.z - ctx.pos.z, dy = ctx.lookAt.y - (ctx.pos.y + 1.6 * S);
      const yawTo = Math.atan2(-dx, -dz);
      ly = clamp(wrap(yawTo - this.yaw), -1.25, 1.25);
      lp = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.55, 0.5);
      if (Math.abs(wrap(yawTo - this.yaw)) > 2.2) { ly = 0; lp = 0; } // behind: don't break the neck
    }
    const hly = cd(this.look.yaw, ly * (1 - climb), 7, dt), hlp = cd(this.look.pitch, lp * (1 - climb), 7, dt);
    p.head[1] += hly * 0.7; p.torso[1] += hly * 0.25; p.head[0] += hlp * 0.6;
    this.extra.eyes = { t: [clamp(-hly * 0.012, -0.012, 0.012), clamp(-hlp * 0.008, -0.006, 0.006), 0] };
    // ---- hit reactions (partial ragdoll springs, layered) -----------------------------------------------------------
    const H = this.hit;
    const tx = wobble(H.tx, 13, 0.32, dt), tz = wobble(H.tz, 13, 0.32, dt), hx = wobble(H.hx, 15, 0.3, dt), hz = wobble(H.hz, 15, 0.3, dt);
    const aL = wobble(H.aL, 12, 0.35, dt), aR = wobble(H.aR, 12, 0.35, dt), hd = wobble(H.dip, 12, 0.4, dt);
    p.torso[0] += tx * 0.5; p.torso[2] += tz * 0.5;
    p.head[0] += hx * 0.55; p.head[2] += hz * 0.5;
    p.armL[0] += aL * 0.6; p.armL[2] -= Math.abs(aL) * 0.4; p.armR[0] += aR * 0.6; p.armR[2] += Math.abs(aR) * 0.4;
    p.hips[0] += tx * 0.15;
    const px = H.px ? wobble(H.px, 9, 0.5, dt) : 0, pz = H.pz ? wobble(H.pz, 9, 0.5, dt) : 0;
    hipsT[0] += px * 0.2 * S; hipsT[2] += pz * 0.2 * S;
    hipsT[1] += hd * 0.08 * S;
    // A stagger: the legs splay to catch the shove.
    // (strong enough to read: the audit's frame strips showed the legs locked while the torso took the hit)
    p.legL[0] += pz * 0.5; p.legR[0] -= pz * 0.4; p.legL[2] -= Math.abs(px) * 0.4; p.legR[2] += Math.abs(px) * 0.4;
    p.shinL[0] -= Math.abs(hd) * 0.5 + Math.max(0, pz) * 0.3; p.shinR[0] -= Math.abs(hd) * 0.5 + Math.max(0, -pz) * 0.3;
    this.hitT = Math.max(0, (this.hitT || 0) - dt);
    // ---- final easing: every joint follows its target through a critically damped spring ---------------------------
    const out = {};
    const stiff = this.hitT > 0 ? 70 : 34;
    for (const n of JOINTS) {
      const J = this.j[n], T = p[n];
      out[n] = [cd(J[0], T[0], stiff, dt), cd(J[1], T[1], stiff, dt), cd(J[2], T[2], stiff, dt)];
    }
    const ht = [cd(this.hipsT[0], hipsT[0], 26, dt), cd(this.hipsT[1], hipsT[1], 30, dt), cd(this.hipsT[2], hipsT[2], 26, dt)];
    out.hips = { r: out.hips, t: ht };
    // Feet stay glued to the IK solution (no lag), or they'd skate.
    for (const n of ['legL', 'legR', 'shinL', 'shinR', 'footL', 'footR']) if (amp > 0.2 && air < 0.1 && climb < 0.1) { out[n] = p[n].slice(); for (let k = 0; k < 3; k++) { this.j[n][k].v = p[n][k]; this.j[n][k].dv = 0; } }
    for (const [k, val] of Object.entries(this.extra)) out[k] = val;
    if (ctx.cloth) Object.assign(out, ctx.cloth);
    return out;
  }
}

function blend(p, w, target, additive = false, wJoint = 1) {
  for (const [n, v] of Object.entries(target)) {
    const cur = p[n];
    if (!cur) continue;
    for (let i = 0; i < 3; i++) cur[i] = additive ? cur[i] + v[i] * w : cur[i] + (v[i] - cur[i]) * w * wJoint;
  }
}
function mix3(a, b, w) { return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w]; }
