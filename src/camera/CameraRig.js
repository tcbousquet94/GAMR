import * as THREE from 'three';
import { clamp, damp, dampAngle, wrapAngle, yawTo } from '../core/math.js';

// Kingdom-Hearts-style third-person camera.
// `yaw` is the horizontal direction the camera LOOKS along (same convention as object rotation.y:
// forward = (sin yaw, 0, cos yaw)). The player moves relative to it.

const DIST = 7;
const FOCUS_H = 1.3;
const PITCH_MIN = -0.12;   // slightly below horizontal (looking up a bit)
const PITCH_MAX = 1.25;    // steep overhead
const PITCH_DEFAULT = 0.32;
const MIN_CAM_CLEAR = 0.35; // keep the camera this far above the ground
const TITLE_RADIUS = 24;
const TITLE_HEIGHT = 10;
const TITLE_SPEED = 0.07;   // rad/s
const START_BLEND = 1.6;    // seconds of title -> gameplay blend
const FOLLOW_DELAY = 0.8;   // explore: seconds after the last mouse look before the camera swings behind Pip
const FOLLOW_RATE = 0.9;    // explore: how fast it swings (scaled by Pip's speed)
const FOLLOW_MAX_ANGLE = 1.2; // only swing for forward/diagonal running, not strafing or running at the camera
const EXPLORE_DIST = 8.5;   // explore: higher and further back, so we look over the party line
const EXPLORE_PITCH = 0.6;

const _focusGoal = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _off = new THREE.Vector3();
const _probe = new THREE.Vector3();
const _titlePos = new THREE.Vector3();
const _titleLook = new THREE.Vector3();
const _look = new THREE.Vector3();
const _mid = new THREE.Vector3();

const smooth = (t) => t * t * (3 - 2 * t);

export class CameraRig {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;

    const p = game.player?.object3d?.position;
    this.yaw = game.player ? game.player.object3d.rotation.y : 0;
    this.pitch = game.mode === 'explore' ? EXPLORE_PITCH : PITCH_DEFAULT;
    this.distance = DIST;      // desired orbit distance (grows a little while locked on)
    this.curDist = DIST;       // distance after collision, damped
    this.focus = new THREE.Vector3(p?.x ?? 0, (p?.y ?? 0) + FOCUS_H, p?.z ?? 0);
    this.lookAt = this.focus.clone();
    this.position = new THREE.Vector3();
    this.viewTarget = new THREE.Vector3();

    this.titleAngle = 0.6;
    this.startBlend = 0; // 0 = title orbit, 1 = gameplay
    this.trauma = 0;
    this.shakeTime = 0;
    this.lockBlend = 0;
    this.idleLook = 0;   // seconds since the last manual look input

    this._computeGameplay(0);
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.viewTarget);
  }

  // Screen shake. amount ~0.1 (tap) .. 0.5 (big slam). Stacks, capped.
  shake(amount = 0.2) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  get forward() {
    return _off.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  update(rawDt) {
    const dt = Math.min(rawDt, 0.05);
    const game = this.game;
    const look = game.input?.consumeLook?.() ?? { dx: 0, dy: 0 };

    if (!game.started) {
      // Slow cinematic orbit around the courtyard center.
      this.titleAngle += TITLE_SPEED * dt;
      this._titleFrame(_titlePos, _titleLook);
      this.camera.position.copy(_titlePos);
      this.camera.lookAt(_titleLook);
      // Keep gameplay framing primed so the transition starts from a sane place.
      const p = game.player?.object3d?.position;
      if (p) {
        this.yaw = game.player.object3d.rotation.y;
        this.focus.set(p.x, p.y + FOCUS_H, p.z);
      }
      this.startBlend = 0;
      return;
    }

    // --- Look input ---
    const hasLook = Math.abs(look.dx) + Math.abs(look.dy) > 1e-5;
    this.yaw = wrapAngle(this.yaw - look.dx);
    this.pitch = clamp(this.pitch + look.dy, PITCH_MIN, PITCH_MAX);
    this.idleLook = hasLook ? 0 : this.idleLook + dt;
    if (game.mode === 'explore') this._followBehind(dt);

    this._computeGameplay(dt);

    // --- Title -> gameplay blend ---
    let pos = this.position;
    let tgt = this.viewTarget;
    if (this.startBlend < 1) {
      this.startBlend = Math.min(1, this.startBlend + dt / START_BLEND);
      const s = smooth(this.startBlend);
      this._titleFrame(_titlePos, _titleLook);
      pos = _probe.copy(_titlePos).lerp(this.position, s);
      tgt = _look.copy(_titleLook).lerp(this.lookAt, s);
      // arc over the top so we don't skim through scenery
      pos.y += Math.sin(s * Math.PI) * 4;
    }

    this.camera.position.copy(pos);

    // --- Shake ---
    if (this.trauma > 0) {
      this.shakeTime += dt * 38;
      const t = this.shakeTime;
      const k = this.trauma * this.trauma;
      this.camera.position.x += (Math.sin(t * 1.3) + Math.sin(t * 2.9) * 0.5) * 0.35 * k;
      this.camera.position.y += (Math.sin(t * 1.7 + 1.2) + Math.sin(t * 3.3) * 0.5) * 0.3 * k;
      this.camera.position.z += (Math.sin(t * 1.1 + 2.4) + Math.sin(t * 2.3) * 0.5) * 0.35 * k;
      this.trauma = Math.max(0, this.trauma - dt * 1.8);
    }

    this.camera.lookAt(tgt);
    if (this.trauma > 0) this.camera.rotateZ(Math.sin(this.shakeTime * 1.9) * 0.04 * this.trauma * this.trauma);
  }

  // Explore mode: lazily swing the camera around behind Pip while he runs, unless the player
  // is steering the camera with the mouse. Running toward the camera doesn't spin it around.
  _followBehind(dt) {
    const pl = this.game.player;
    if (!pl?.vel || this.idleLook < FOLLOW_DELAY || this.game.target) return;
    const speed01 = clamp(Math.hypot(pl.vel.x, pl.vel.z) / 7.5, 0, 1);
    if (speed01 < 0.2) return;
    const want = pl.object3d.rotation.y;
    this.pitch = damp(this.pitch, EXPLORE_PITCH, 1.5, dt);
    if (Math.abs(wrapAngle(want - this.yaw)) > FOLLOW_MAX_ANGLE) return;
    this.yaw = dampAngle(this.yaw, want, FOLLOW_RATE * speed01, dt);
  }

  _titleFrame(outPos, outLook) {
    const w = this.game.world;
    const c = w?.courtyardCenter || w?.center || null;
    const cx = c?.x ?? 0, cy = c?.y ?? 0, cz = c?.z ?? 0;
    const a = this.titleAngle;
    outPos.set(cx + Math.sin(a) * TITLE_RADIUS, cy + TITLE_HEIGHT, cz + Math.cos(a) * TITLE_RADIUS);
    outLook.set(cx, cy + 1.5, cz);
  }

  _computeGameplay(dt) {
    const game = this.game;
    const player = game.player;
    const p = player?.object3d?.position;
    if (!p) return;

    // --- Focus (damped look target near the player's head) ---
    _focusGoal.set(p.x, p.y + FOCUS_H, p.z);
    const target = game.target && game.target.alive !== false && game.target.object3d ? game.target : null;
    this.lockBlend = damp(this.lockBlend, target ? 1 : 0, 5, dt);

    if (target) {
      const tp = target.object3d.position;
      const dx = tp.x - p.x, dz = tp.z - p.z;
      const d = Math.hypot(dx, dz);
      // Yaw: behind the player, looking toward the target. Look input still nudges it.
      if (d > 0.5) {
        const want = yawTo(dx, dz);
        const rate = this.idleLook < 0.4 ? 1.5 : 4.5;
        this.yaw = dampAngle(this.yaw, want, rate, dt);
      }
      // Pull back a little when they're far apart; ease pitch to a nice framing.
      this.distance = damp(this.distance, DIST + clamp(d * 0.18, 0, 3.5), 3, dt);
      if (this.idleLook > 0.6) this.pitch = damp(this.pitch, 0.38, 1.5, dt);
    } else {
      this.distance = damp(this.distance, game.mode === 'explore' ? EXPLORE_DIST : DIST, 3, dt);
    }

    if (dt === 0) this.focus.copy(_focusGoal);
    else {
      this.focus.x = damp(this.focus.x, _focusGoal.x, 12, dt);
      this.focus.z = damp(this.focus.z, _focusGoal.z, 12, dt);
      // Softer vertical so jumps don't jerk the whole view.
      this.focus.y = damp(this.focus.y, _focusGoal.y, 6, dt);
    }

    // Look point: shift toward the player/target midpoint while locked.
    _look.copy(this.focus);
    if (target) {
      const tp = target.object3d.position;
      _mid.set(tp.x, tp.y + (target.height ?? 1.6) * 0.55, tp.z).sub(this.focus).multiplyScalar(0.35 * this.lockBlend);
      if (_mid.lengthSq() > 9) _mid.setLength(3);
      _look.add(_mid);
    }
    if (dt === 0) this.lookAt.copy(_look);
    else this.lookAt.lerp(_look, 1 - Math.exp(-10 * dt));

    // --- Orbit position ---
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    _off.set(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp); // unit, from focus to camera
    let want = this.distance;

    // --- Collision: pull in when buildings would block the view ---
    const world = game.world;
    if (world && typeof world.segmentBlocked === 'function') {
      _camGoal.copy(this.focus).addScaledVector(_off, want);
      // segmentBlocked returns the fraction along the segment where it hits (1 = clear).
      const t = world.segmentBlocked(this.focus, _camGoal);
      if (t < 1) want = Math.max(0.8, want * t - 0.3);
    }
    // Snap in fast, ease back out slowly.
    if (dt === 0) this.curDist = want;
    else this.curDist = damp(this.curDist, want, want < this.curDist ? 25 : 3, dt);

    this.position.copy(this.focus).addScaledVector(_off, this.curDist);

    // Pulled in tight against a wall: rise a little and look past the head instead of into it.
    const tight = clamp((2.6 - this.curDist) / 1.8, 0, 1);
    if (tight > 0) {
      this.position.y += tight * 0.9;
    }
    this.viewTarget.copy(this.lookAt);
    this.viewTarget.x -= _off.x * tight * 2.5;
    this.viewTarget.z -= _off.z * tight * 2.5;

    // --- Never below ground ---
    const gh = typeof world?.getGroundHeight === 'function' ? world.getGroundHeight(this.position.x, this.position.z) : 0;
    const floor = (Number.isFinite(gh) ? gh : 0) + MIN_CAM_CLEAR;
    if (this.position.y < floor) this.position.y = floor;
  }
}
