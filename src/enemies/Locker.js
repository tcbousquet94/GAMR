import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, basic, outline, geo } from '../core/materials.js';
import { ENEMIES } from '../core/config.js';
import { Enemy, canvasTex, decalMat } from './Enemy.js';

// "Locker Mimic": a gym locker that hops around and CHOMPs.

const W = 1.0, H = 1.85, D = 0.8, FOOT = 0.14;
const CY = FOOT + H / 2;

const G = {
  body: () => geo('locker.body', () => new RoundedBoxGeometry(W, H, D, 3, 0.09)),
  door: () => geo('locker.door', () => new RoundedBoxGeometry(W * 0.9, H * 0.9, 0.07, 2, 0.03).translate(W * 0.45, 0, 0)),
  decal: () => geo('locker.decal', () => new THREE.PlaneGeometry(W * 0.86, H * 0.86).translate(W * 0.45, 0, 0.04)),
  mouth: () => geo('locker.mouth', () => new THREE.PlaneGeometry(W * 0.86, H * 0.86)),
  teeth: () => geo('locker.teeth', () => {
    const parts = [];
    const n = 4;
    for (let i = 0; i < n; i++) {
      const x = -W * 0.43 + (i + 0.5) * (W * 0.86 / n);
      const top = new THREE.ConeGeometry(0.1, 0.26, 6).rotateX(Math.PI).scale(1, 1, 0.35).translate(x, H * 0.43 - 0.13, 0.008);
      const bot = new THREE.ConeGeometry(0.1, 0.24, 6).scale(1, 1, 0.35).translate(x + 0.05, -H * 0.43 + 0.12, 0.008);
      parts.push(top, bot);
    }
    return mergeGeometries(parts);
  }),
  tongue: () => geo('locker.tongue', () => new THREE.CapsuleGeometry(0.16, 0.7, 4, 10).scale(1.25, 1, 0.45).translate(0, 0.5, 0)),
  feet: () => geo('locker.feet', () => {
    const parts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      parts.push(new THREE.CylinderGeometry(0.07, 0.09, FOOT + 0.04, 8).translate(sx * W * 0.36, (FOOT + 0.04) / 2, sz * D * 0.32));
    }
    return mergeGeometries(parts);
  }),
  lock: () => geo('locker.lock', () => {
    const body = new THREE.BoxGeometry(0.16, 0.14, 0.07).toNonIndexed();
    const shackle = new THREE.TorusGeometry(0.05, 0.018, 5, 10, Math.PI).translate(0, 0.07, 0).toNonIndexed();
    return mergeGeometries([body, shackle]).translate(0, -0.1, 0);
  }),
};

function doorTex(num) {
  return canvasTex(`locker.door.${num}`, 256, 512, (g, w, h) => {
    // vents (top), with angry eyes peeking through
    for (let i = 0; i < 4; i++) {
      const y = 50 + i * 26;
      g.fillStyle = '#2a2e3e';
      roundRect(g, 46, y, w - 92, 13, 6);
      g.fill();
    }
    // eyes through the vents
    for (const s of [-1, 1]) {
      g.save();
      g.translate(w / 2 + s * 46, 96);
      g.rotate(s * 0.25);
      g.fillStyle = '#fff27a';
      g.beginPath();
      g.ellipse(0, 0, 26, 17, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2a1a2e';
      g.beginPath();
      g.ellipse(-s * 4, 3, 9, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // angry brows cutting across
    g.strokeStyle = '#2a1a2e';
    g.lineWidth = 11;
    g.lineCap = 'round';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(w / 2 + s * 78, 62);
      g.lineTo(w / 2 + s * 18, 80);
      g.stroke();
    }
    // number plate
    g.fillStyle = '#d9dde6';
    roundRect(g, w / 2 - 44, 200, 88, 46, 8);
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#2a1a2e';
    g.stroke();
    g.fillStyle = '#2a1a2e';
    g.font = 'bold 32px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(num, w / 2, 224);
    // handle slot
    g.fillStyle = '#4a5068';
    roundRect(g, w - 58, 270, 20, 70, 8);
    g.fill();
    // bottom vents
    for (let i = 0; i < 3; i++) {
      g.fillStyle = '#4f5a74';
      roundRect(g, 60, 420 + i * 20, w - 120, 8, 4);
      g.fill();
    }
    // a sticker of a smiley, for flavour
    g.fillStyle = '#ffd23f';
    g.beginPath(); g.arc(70, 330, 20, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a1a2e';
    g.beginPath(); g.arc(63, 325, 3, 0, Math.PI * 2); g.arc(77, 325, 3, 0, Math.PI * 2); g.fill();
    g.lineWidth = 3;
    g.beginPath(); g.arc(70, 332, 10, 0.2, Math.PI - 0.2); g.stroke();
  });
}

function mouthTex() {
  return canvasTex('locker.mouth', 128, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h / 2, h * 0.6);
    grd.addColorStop(0, '#1a0610');
    grd.addColorStop(1, '#8a1f3a');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    // a forgotten gym sock dangling inside
    g.fillStyle = '#f4f1e6';
    roundRect(g, 18, 60, 18, 70, 8); g.fill();
    g.fillStyle = '#e8423c';
    g.fillRect(18, 66, 18, 6); g.fillRect(18, 78, 18, 6);
  });
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const NUMBERS = ['#13', '#404', '#7', '#86'];

export class Locker extends Enemy {
  constructor(game, opts = {}) {
    super(game, ENEMIES.locker, { radius: 0.62, height: 2.15, shadow: 0.75, ...opts });
    this.attackRange = 1.5;
    this.windupTime = 0.55;
    this.recoverTime = 0.9;
    this.open = 0;          // door openness 0..1
    this.openTarget = 0;
    this.hopPhase = Math.random();
    this.hopping = false;
    this.chatterT = 2 + Math.random() * 3;
    this.lunge = new THREE.Vector3();
    this.chomped = false;
    this.build();
    this.registerFlash();
  }

  build() {
    const v = this.visual;
    const metal = toon(0x7f9bc0);
    const feet = new THREE.Mesh(G.feet(), toon(0x4a5068));
    v.add(feet);

    const bodyPivot = new THREE.Group(); // body + door + mouth; tilts during hops/lunges
    bodyPivot.position.y = CY;
    v.add(bodyPivot);
    this.bodyPivot = bodyPivot;

    const body = new THREE.Mesh(G.body(), metal);
    outline(body, 0.05);
    bodyPivot.add(body);

    const mouth = new THREE.Mesh(G.mouth(), basic(0xffffff));
    mouth.material = decalMat('locker.mouth', mouthTex());
    mouth.position.z = D / 2 + 0.006;
    bodyPivot.add(mouth);

    const teeth = new THREE.Mesh(G.teeth(), toon(0xfffbea));
    teeth.position.z = D / 2;
    bodyPivot.add(teeth);

    const tonguePivot = new THREE.Group();
    tonguePivot.position.set(0, -H * 0.36, D / 2 - 0.02);
    bodyPivot.add(tonguePivot);
    const tongue = new THREE.Mesh(G.tongue(), toon(0xff7fa8));
    tonguePivot.add(tongue);
    this.tonguePivot = tonguePivot;

    const doorPivot = new THREE.Group();
    doorPivot.position.set(-W * 0.45, 0, D / 2 + 0.08);
    bodyPivot.add(doorPivot);
    const door = new THREE.Mesh(G.door(), toon(0x8fb0d6));
    outline(door, 0.03);
    doorPivot.add(door);
    const num = NUMBERS[(Math.random() * NUMBERS.length) | 0];
    const decal = new THREE.Mesh(G.decal(), decalMat(`locker.door.${num}`, doorTex(num)));
    doorPivot.add(decal);
    const lock = new THREE.Mesh(G.lock(), toon(0xffc23f));
    lock.position.set(W * 0.84, -0.18, 0.08);
    doorPivot.add(lock);
    this.lock = lock;
    this.doorPivot = doorPivot;
  }

  chooseAttack(d) {
    return d < 3.3 ? 'chomp' : null;
  }

  // Bouncy hop locomotion: only move horizontally while airborne.
  hopGate() {
    const ph = this.hopPhase % 1;
    return ph < 0.62 ? 1.7 : 0.08;
  }

  wander(dt) {
    super.wander(dt);
    this.hopping = this.vel.lengthSq() > 0.01;
    this.vel.multiplyScalar(this.hopGate());
  }

  moveChase(dt, d) {
    super.moveChase(dt, d);
    this.hopping = this.vel.lengthSq() > 0.01;
    this.vel.multiplyScalar(this.hopGate());
  }

  onWindup() {
    this.faceTarget();
  }

  updateWindup(dt, k) {
    this.faceTarget();
    this.hopping = false;
    // rattle the door, crouch down
    this.openTarget = 0.12 + Math.abs(Math.sin(this.stateT * 38)) * 0.2;
    this.baseScale = 1;
    this.squash = 0.18 * k;
    this.bodyPivot.rotation.x = -0.18 * k;
  }

  onAttack() {
    const yaw = this.object3d.rotation.y;
    this.faceYaw = yaw;
    this.lunge.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.chomped = false;
    this.squashV = -6; // stretch
  }

  updateAttack(dt) {
    const t = this.stateT;
    if (t < 0.26) {
      this.vel.copy(this.lunge).multiplyScalar(11);
      this.openTarget = 1;
      this.bodyPivot.rotation.x = 0.25;
    } else {
      this.openTarget = 0;
      if (!this.chomped) {
        this.chomped = true;
        this.open = 0.15; // SLAM
        this.squashV = 5;
        this.game.events.emit('sfx', { name: 'chomp' });
        this.game.combat.meleeSweep(this, { range: 1.9, arc: 1.9, damage: this.damage, knockback: 7, text: 'CHOMP!' });
      }
    }
    if (t >= 0.5) {
      this.attackCooldown = 1.6 + Math.random() * 1.2;
      return true;
    }
    return false;
  }

  animate(dt) {
    const t = this.game.time.elapsed;
    const v = this.visual;

    // hops
    if (this.hopping && this.state !== 'windup') {
      const before = this.hopPhase % 1;
      this.hopPhase += dt * 2.4;
      const ph = this.hopPhase % 1;
      if (ph < before) this.squash = Math.max(this.squash, 0.3); // landed
    } else {
      const ph = this.hopPhase % 1;
      if (ph < 0.62) this.hopPhase += dt * 2.4; // finish the current hop
    }
    const ph = this.hopPhase % 1;
    const air = ph < 0.62 ? Math.sin((ph / 0.62) * Math.PI) : 0;
    v.position.y = air * 0.55;
    this.shadow.scale.setScalar(this.shadowSize * (1 - air * 0.35));

    // door chatter while idle/chasing
    if (this.state === 'idle' || this.state === 'chase') {
      this.chatterT -= dt;
      if (this.chatterT < 0) {
        this.openTarget = this.openTarget > 0 ? 0 : 0.5;
        this.chatterT = this.openTarget > 0 ? 0.35 : 1.5 + Math.random() * 3;
      }
      this.bodyPivot.rotation.x = air * -0.12;
    } else if (this.state === 'recover') {
      this.openTarget = 0.45; // tongue lolls out, panting
      this.bodyPivot.rotation.x *= 0.9;
    }
    if (this.state === 'dead') this.openTarget = 1;

    this.open += (this.openTarget - this.open) * Math.min(1, dt * 22);
    this.doorPivot.rotation.y = -this.open * 1.9;
    const lollT = this.state === 'recover' ? 1 : this.open;
    this.tonguePivot.rotation.x = 0.4 + lollT * 1.1 + Math.sin(t * 9) * 0.25 * lollT;
    this.tonguePivot.rotation.z = Math.sin(t * 6.3) * 0.35 * lollT;
    this.tonguePivot.scale.y = 0.35 + lollT * 0.75;
    this.tonguePivot.visible = lollT > 0.15;
    this.lock.rotation.z = Math.sin(t * 7 + 1) * 0.5;
    this.bodyPivot.rotation.z = this.hurtT > 0 ? Math.sin(this.hurtT * 40) * 0.08 : 0;
  }
}
