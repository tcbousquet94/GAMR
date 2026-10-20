import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, basic, outline, geo } from '../core/materials.js';
import { ENEMIES } from '../core/config.js';
import { Enemy, canvasTex } from './Enemy.js';

// "Group Chat (99+)": a hovering speech bubble that keeps its distance and spams pings.

const HOVER = 1.15;   // visual lift above the feet
const BUBBLE_Y = 0.75;

const G = {
  bubble: () => geo('gc.bubble', () => new THREE.SphereGeometry(1, 22, 16).scale(0.95, 0.68, 0.42)),
  tail: () => geo('gc.tail', () => new THREE.ConeGeometry(0.2, 0.55, 8).rotateZ(Math.PI - 0.5).translate(-0.5, -0.66, 0).scale(1, 1, 0.8)),
  dot: () => geo('gc.dot', () => new THREE.SphereGeometry(0.11, 10, 8)),
  eyes: () => geo('gc.eyes', () => {
    const parts = [];
    for (const s of [-1, 1]) {
      parts.push(new THREE.SphereGeometry(0.075, 8, 8).scale(0.8, 1.3, 0.4).translate(s * 0.24, 0.22, 0.38).toNonIndexed());
      parts.push(new THREE.BoxGeometry(0.2, 0.045, 0.04).rotateZ(s * 0.35).translate(s * 0.24, 0.36, 0.37).toNonIndexed());
    }
    return mergeGeometries(parts);
  }),
  // cringe projectile body
  msg: () => geo('gc.msg', () => new THREE.SphereGeometry(1, 14, 10).scale(0.62, 0.48, 0.3)),
};

function badgeMat() {
  const tex = canvasTex('gc.badge', 128, 128, (g, w, h) => {
    g.fillStyle = '#2a1a2e';
    g.beginPath(); g.arc(w / 2, h / 2, 60, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff3b4f';
    g.beginPath(); g.arc(w / 2, h / 2, 53, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 44px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('99+', w / 2, h / 2 + 2);
  });
  return (badgeMat.m ??= new THREE.SpriteMaterial({ map: tex, transparent: true }));
}

function photoMat() {
  const tex = canvasTex('gc.photo', 128, 128, (g, w, h) => {
    // polaroid with a goofy 6th-grade photo
    g.fillStyle = '#2a1a2e';
    g.fillRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#ffffff';
    g.fillRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#7fc8f0'; // laser background
    g.fillRect(18, 18, w - 36, 76);
    g.strokeStyle = '#ff8fbf'; g.lineWidth = 4;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(18, 30 + i * 18); g.lineTo(w - 18, 20 + i * 22); g.stroke(); }
    // bowl cut kid
    g.fillStyle = '#ffd3a8';
    g.beginPath(); g.arc(w / 2, 62, 24, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6a3a1a';
    g.beginPath(); g.arc(w / 2, 56, 26, Math.PI, 0); g.fill();
    g.fillStyle = '#2a1a2e';
    g.fillRect(w / 2 - 12, 62, 6, 6); g.fillRect(w / 2 + 6, 62, 6, 6);
    // braces grin
    g.fillStyle = '#ffffff'; g.fillRect(w / 2 - 11, 74, 22, 7);
    g.fillStyle = '#9aa3b5'; g.fillRect(w / 2 - 11, 76, 22, 2);
    g.fillStyle = '#2a1a2e';
    g.font = 'bold 15px Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('6th grade', w / 2, 110);
  });
  return (photoMat.m ??= new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
}

const _from = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class GroupChat extends Enemy {
  constructor(game, opts = {}) {
    super(game, ENEMIES.groupchat, { radius: 0.75, height: 2.75, shadow: 0.6, ...opts });
    this.windupTime = 0.5;
    this.recoverTime = 0.5;
    this.turnRate = 6;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 2 + Math.random() * 2;
    this.volleys = 0;
    this.shots = 0;
    this.cringe = false;
    this.attackCooldown = 1.5 + Math.random() * 1.5;
    this.typing = 1;
    this.build();
    this.registerFlash();
  }

  build() {
    const v = this.visual;
    const hover = new THREE.Group();
    hover.position.y = HOVER + BUBBLE_Y;
    v.add(hover);
    this.hover = hover;

    const green = toon(0x52d86a);
    const bubble = new THREE.Mesh(G.bubble(), green);
    outline(bubble, 0.05);
    hover.add(bubble);
    const tail = new THREE.Mesh(G.tail(), green);
    outline(tail, 0.04);
    hover.add(tail);

    const eyes = new THREE.Mesh(G.eyes(), basic(0x1a1020));
    hover.add(eyes);

    this.dots = [];
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(G.dot(), toon(0xffffff));
      d.position.set((i - 1) * 0.28, -0.08, 0.36);
      hover.add(d);
      this.dots.push(d);
    }

    const badge = new THREE.Sprite(badgeMat());
    badge.scale.setScalar(0.62);
    badge.position.set(0.78, 0.5, 0.15);
    badge.userData.noFlash = true;
    hover.add(badge);
    this.badge = badge;
  }

  chooseAttack(d) {
    return d < 16 ? 'volley' : null;
  }

  // Keep 8..12 units away and strafe around the target.
  moveChase(dt, d) {
    const p = this.object3d.position;
    const tp = this.target.object3d.position;
    const dx = (tp.x - p.x) / (d || 1), dz = (tp.z - p.z) / (d || 1);
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = 1.8 + Math.random() * 2.2; }
    let radial = 0;
    if (d > 12) radial = 1;
    else if (d < 8) radial = -1;
    else radial = (d - 10) * 0.15;
    const sp = this.speed;
    // tangent = perpendicular to radial
    this.vel.set(dx * radial * sp + -dz * this.strafeDir * sp * 0.75, 0, dz * radial * sp + dx * this.strafeDir * sp * 0.75);
    this.faceYaw = Math.atan2(dx, dz);
    if (this.blocked) { this.strafeDir *= -1; this.strafeT = 2; }
  }

  onWindup() {
    this.faceTarget();
    this.cringe = (this.volleys + 1) % 3 === 0;
  }

  updateWindup(dt, k) {
    this.faceTarget();
    this.typing = 4;
    this.baseScale = 1 + k * 0.18 + Math.sin(this.stateT * 40) * 0.03;
  }

  onAttack() {
    this.volleys++;
    this.shots = 0;
    this.baseScale = 1;
    this.squashV = 4;
  }

  fire(cringe) {
    const t = this.target;
    if (!t || !t.alive) return;
    const p = this.object3d.position;
    _from.set(p.x, p.y + HOVER + BUBBLE_Y + this.visual.position.y * 0, p.z);
    const yaw = this.object3d.rotation.y;
    _from.x += Math.sin(yaw) * 0.6;
    _from.z += Math.cos(yaw) * 0.6;
    const tp = t.object3d.position;
    _dir.set(tp.x, tp.y + (t.height || 1.6) * 0.5, tp.z).sub(_from).normalize();
    const combat = this.game.combat;
    if (cringe) {
      combat.spawnProjectile({
        owner: this, position: _from, direction: _dir, speed: 7.5, damage: this.damage, radius: 0.55,
        life: 3.5, homing: { target: t, turnRate: 2.2 }, status: { name: 'embarrassed', duration: 5 },
        text: 'Someone posted your 6th grade photo!', mesh: this.makeCringeMesh(), knockback: 2,
      });
      this.game.events.emit('sfx', { name: 'phone' });
    } else {
      // small spread
      const spread = (this.shots - 1) * 0.12;
      const c = Math.cos(spread), s = Math.sin(spread);
      const x = _dir.x * c - _dir.z * s, z = _dir.x * s + _dir.z * c;
      _dir.x = x; _dir.z = z;
      combat.spawnProjectile({
        owner: this, position: _from, direction: _dir, speed: 12, damage: Math.round(this.damage * 0.75),
        radius: 0.3, color: 0x52d86a, life: 2.2, homing: { target: t, turnRate: 1.1 }, text: 'Ping!', knockback: 2,
      });
      this.game.events.emit('sfx', { name: 'ping' });
    }
    this.squash = -0.15;
  }

  makeCringeMesh() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(G.msg(), toon(0xff8fbf));
    outline(b, 0.04);
    g.add(b);
    const photo = new THREE.Sprite(photoMat());
    photo.scale.setScalar(0.8);
    photo.position.z = 0.1;
    photo.renderOrder = 6;
    g.add(photo);
    return g;
  }

  updateAttack(dt) {
    this.faceTarget();
    const t = this.stateT;
    if (this.cringe) {
      if (this.shots === 0) { this.fire(true); this.shots = 1; }
      if (t > 0.5) { this.attackCooldown = 2.4 + Math.random(); return true; }
      return false;
    }
    while (this.shots < 3 && t >= this.shots * 0.17) {
      this.fire(false);
      this.shots++;
    }
    if (t > 0.6) { this.attackCooldown = 2 + Math.random() * 1.2; return true; }
    return false;
  }

  animate(dt) {
    const t = this.game.time.elapsed + this.object3d.id;
    if (this.state !== 'windup') this.baseScale += (1 - this.baseScale) * Math.min(1, dt * 10);
    if (this.state !== 'windup') this.typing += (1 - this.typing) * Math.min(1, dt * 3);
    const bob = Math.sin(t * 2.2) * 0.15;
    this.visual.position.y = bob;
    this.shadow.scale.setScalar(this.shadowSize * (1 - bob * 0.3));
    // sway in the direction of travel
    this.hover.rotation.z = -this.vel.x * 0.02 + Math.sin(t * 1.3) * 0.06;
    // typing dots
    const tt = t * 6 * this.typing;
    for (let i = 0; i < 3; i++) {
      const k = Math.max(0, Math.sin(tt - i * 0.9));
      this.dots[i].position.y = -0.08 + k * 0.1;
      this.dots[i].scale.setScalar(0.85 + k * 0.3);
    }
    // badge pulse
    this.badge.scale.setScalar(0.62 * (1 + Math.max(0, Math.sin(t * 5)) * 0.15));
  }
}
