import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, basic, outline, geo } from '../core/materials.js';
import { ENEMIES } from '../core/config.js';
import { Enemy, canvasTex, decalMat } from './Enemy.js';

// "Hall Monitor Hank": stocky, stern, sash-wearing. Charges ("NO RUNNING!") and whistles ("HALL PASS?!").

const G = {
  body: () => geo('hank.body', () => new THREE.CapsuleGeometry(0.42, 0.32, 4, 14).scale(1.25, 1, 1)),
  sash: () => geo('hank.sash', () => new THREE.TorusGeometry(1, 0.11, 6, 28).rotateY(Math.PI / 2).scale(1, 0.62, 0.45)),
  head: () => geo('hank.head', () => new THREE.SphereGeometry(0.52, 20, 16)),
  face: () => geo('hank.face', () => new THREE.SphereGeometry(0.53, 16, 12, Math.PI / 2 - 0.75, 1.5, Math.PI / 2 - 0.6, 1.15)),
  cap: () => geo('hank.cap', () => mergeGeometries([
    new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.4).translate(0, 0.01, 0.12),
  ])),
  arm: () => geo('hank.arm', () => new THREE.CapsuleGeometry(0.12, 0.38, 3, 8).translate(0, -0.26, 0)),
  leg: () => geo('hank.leg', () => mergeGeometries([
    new THREE.CapsuleGeometry(0.15, 0.2, 3, 8).translate(0, -0.17, 0),
    new THREE.SphereGeometry(0.17, 10, 8).scale(1, 0.6, 1.4).translate(0, -0.42, 0.07),
  ])),
  whistle: () => geo('hank.whistle', () => new THREE.CylinderGeometry(0.05, 0.06, 0.18, 8).rotateX(Math.PI / 2)),
  board: () => geo('hank.board', () => new THREE.BoxGeometry(0.42, 0.52, 0.04)),
  paper: () => geo('hank.paper', () => new THREE.PlaneGeometry(0.36, 0.42)),
};

function faceTex() {
  return canvasTex('hank.face', 256, 192, (g, w) => {
    const ink = '#2a1a2e';
    // stern beady eyes
    g.fillStyle = ink;
    for (const s of [-1, 1]) {
      g.beginPath(); g.ellipse(w / 2 + s * 42, 92, 10, 14, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#fff';
    for (const s of [-1, 1]) { g.beginPath(); g.arc(w / 2 + s * 42 + 3, 87, 3.5, 0, Math.PI * 2); g.fill(); }
    // THE unibrow
    g.fillStyle = '#3a2214';
    g.beginPath();
    g.moveTo(w / 2 - 80, 56); g.quadraticCurveTo(w / 2 - 40, 50, w / 2, 74);
    g.quadraticCurveTo(w / 2 + 40, 50, w / 2 + 80, 56);
    g.lineTo(w / 2 + 78, 70); g.quadraticCurveTo(w / 2 + 40, 64, w / 2, 88);
    g.quadraticCurveTo(w / 2 - 40, 64, w / 2 - 78, 70);
    g.closePath(); g.fill();
    // nose
    g.strokeStyle = '#c98a5a'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.arc(w / 2, 115, 9, 0.3, Math.PI - 0.3); g.stroke();
    // flat disapproving mouth
    g.strokeStyle = ink; g.lineWidth = 7;
    g.beginPath(); g.moveTo(w / 2 - 26, 146); g.quadraticCurveTo(w / 2, 138, w / 2 + 26, 148); g.stroke();
  });
}

function paperTex() {
  return canvasTex('hank.paper', 128, 160, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8423c'; g.font = 'bold 17px Arial, sans-serif'; g.textAlign = 'center';
    g.fillText('TARDY LIST', w / 2, 24);
    g.strokeStyle = '#7fa0d0'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(10, 44 + i * 18); g.lineTo(w - 10, 44 + i * 18); g.stroke(); }
    g.strokeStyle = '#2a1a2e'; g.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      g.beginPath(); g.moveTo(14, 40 + i * 18);
      for (let x = 14; x < 60 + (i * 23) % 50; x += 6) g.lineTo(x, 40 + i * 18 + ((x / 6) % 2 ? -3 : 2));
      g.stroke();
    }
  });
}

const _from = new THREE.Vector3();

export class HallMonitor extends Enemy {
  constructor(game, opts = {}) {
    super(game, ENEMIES.hallmonitor, { radius: 0.68, height: 2.45, shadow: 0.8, ...opts });
    this.attackRange = 2.4;
    this.windupTime = 0.65;
    this.recoverTime = 0.8;
    this.turnRate = 6;
    this.chargeDir = new THREE.Vector3();
    this.hitSet = new Set();
    this.whistleCd = 2;
    this.walk = 0;
    this.patrolSide = 1;
    this.attackCooldown = 1.2 + Math.random();
    this.build();
    this.registerFlash();
  }

  build() {
    const v = this.visual;
    const shirt = toon(0xe9d49a);
    const skin = toon(0xf0b688);
    const pants = toon(0x34406e);

    this.legs = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.24, 0.55, 0);
      const leg = new THREE.Mesh(G.leg(), pants);
      pivot.add(leg);
      v.add(pivot);
      this.legs.push(pivot);
    }

    const torso = new THREE.Group();
    torso.position.y = 1.0;
    v.add(torso);
    this.torso = torso;
    const body = new THREE.Mesh(G.body(), shirt);
    outline(body, 0.05);
    torso.add(body);
    const sash = new THREE.Mesh(G.sash(), toon(0xff7a1a, { emissive: 0x401800 }));
    sash.rotation.z = 0.75;
    sash.position.y = 0.04;
    torso.add(sash);

    this.arms = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.6, 0.32, 0);
      pivot.rotation.z = s * 0.25;
      const arm = new THREE.Mesh(G.arm(), skin);
      pivot.add(arm);
      torso.add(pivot);
      this.arms.push(pivot);
    }
    // clipboard in the left hand
    const board = new THREE.Mesh(G.board(), toon(0xa86b3a));
    board.position.set(0.05, -0.6, 0.18);
    board.rotation.x = -0.5;
    const paper = new THREE.Mesh(G.paper(), decalMat('hank.paper', paperTex()));
    paper.position.z = 0.025;
    board.add(paper);
    this.arms[0].add(board);
    this.arms[0].rotation.x = -0.9;

    const head = new THREE.Group();
    head.position.y = 0.95;
    torso.add(head);
    this.head = head;
    const skull = new THREE.Mesh(G.head(), skin);
    outline(skull, 0.05);
    head.add(skull);
    const face = new THREE.Mesh(G.face(), decalMat('hank.face', faceTex()));
    head.add(face);
    const cap = new THREE.Mesh(G.cap(), toon(0x2f4a8a));
    cap.position.set(0.06, 0.47, 0.06);
    cap.scale.setScalar(1.15);
    cap.rotation.set(-0.25, 0, -0.3);
    head.add(cap);
    const whistle = new THREE.Mesh(G.whistle(), toon(0xd8dde8));
    head.add(whistle);
    this.whistle = whistle;
    this.whistleRest();
  }

  whistleRest() { this.whistle.position.set(0.18, -0.62, 0.5); this.whistle.rotation.x = 0.4; }
  whistleMouth() { this.whistle.position.set(0, -0.26, 0.6); this.whistle.rotation.x = 0; }

  // Patrol back and forth instead of random wandering.
  wander(dt) {
    const p = this.object3d.position;
    const tx = this.home.x + this.patrolSide * 4;
    const d = this.moveToward(tx, this.home.z, this.speed * 0.45);
    if (d < 0.3 || this.blocked) this.patrolSide *= -1;
  }

  chooseAttack(d) {
    if (d < 3.6 && this.whistleCd <= 0) return 'whistle';
    if (d < 14) return 'charge';
    return null;
  }

  onWindup(a) {
    this.faceTarget();
    if (a === 'whistle') this.whistleMouth();
  }

  updateWindup(dt, k) {
    this.faceTarget();
    if (this.attack === 'charge') {
      // plant feet, lean back, paw the floor like a bull
      this.legs[0].rotation.x = -0.5;
      this.legs[1].rotation.x = 0.5 + Math.sin(this.stateT * 30) * 0.35;
      this.torso.rotation.x = -0.25 * k;
      this.arms[1].rotation.x = 0.8;
      this.squash = 0.15 * k;
    } else {
      this.head.scale.set(1 + k * 0.2, 1, 1 + k * 0.1); // puffing cheeks
      this.arms[1].rotation.x = -2.2;
    }
  }

  onAttack(a) {
    if (a === 'charge') {
      const yaw = this.object3d.rotation.y;
      this.faceYaw = yaw;
      this.chargeDir.set(Math.sin(yaw), 0, Math.cos(yaw));
      this.hitSet.clear();
      this.game.events.emit('sfx', { name: 'dodge' });
    } else {
      const p = this.object3d.position;
      this.game.events.emit('sfx', { name: 'whistle' });
      _from.set(p.x, p.y + this.height + 0.4, p.z);
      this.game.events.emit('popup', { text: 'PUBLIC CALL-OUT!', position: _from.clone(), style: 'big' });
      this.game.combat.areaBlast({
        owner: this, position: p, radius: 4, damage: Math.round(this.damage * 0.5), knockback: 8,
        status: { name: 'embarrassed', duration: 6 }, text: 'HALL PASS?!', color: 0xff9a3a,
      });
      this.game.cameraRig?.shake?.(0.3);
      this.whistleCd = 7;
      this.head.scale.setScalar(1);
    }
  }

  updateAttack(dt) {
    const t = this.stateT;
    if (this.attack === 'whistle') {
      if (t > 0.55) { this.whistleRest(); this.attackCooldown = 1.2; return true; }
      return false;
    }
    // CHARGE
    this.vel.copy(this.chargeDir).multiplyScalar(this.speed * 2.6);
    this.torso.rotation.x = 0.35;
    if (t > 0.08 && this.blocked) { // smacked into a wall
      this.enter('stumble');
      this.knockback.copy(this.chargeDir).multiplyScalar(-6);
      this.squash = 0.5;
      const p = this.object3d.position;
      _from.set(p.x, p.y + this.height, p.z);
      this.game.combat.spawnSparks(_from, { count: 10, speed: 5, size: 0.3, color: 0xfff27a });
      this.game.events.emit('sfx', { name: 'hit' });
      this.game.events.emit('popup', { text: '*BONK*', position: _from.clone(), style: 'info' });
      this.game.cameraRig?.shake?.(0.25);
      return false;
    }
    const p = this.object3d.position;
    for (const c of this.game.combatants) {
      if (!c.alive || c.team === this.team || this.hitSet.has(c)) continue;
      const cp = c.object3d.position;
      const r = this.radius + (c.radius || 0.5) + 0.25;
      if ((cp.x - p.x) ** 2 + (cp.z - p.z) ** 2 < r * r && Math.abs(cp.y - p.y) < 2) {
        this.hitSet.add(c);
        this.game.combat.dealDamage(this, c, this.damage, { knockback: 12, text: 'NO RUNNING!' });
      }
    }
    if (t > 1.1) { this.attackCooldown = 2 + Math.random(); return true; }
    return false;
  }

  updateCustomState(dt) {
    if (this.state === 'stumble') {
      this.torso.rotation.z = Math.sin(this.stateT * 9) * 0.3;
      this.head.rotation.y = Math.sin(this.stateT * 13) * 0.5;
      if (this.stateT > 1.4) {
        this.torso.rotation.z = 0;
        this.head.rotation.y = 0;
        this.attackCooldown = 1.5;
        this.enter('recover');
      }
    }
  }

  animate(dt) {
    const sp = Math.hypot(this.vel.x, this.vel.z) * this.status.speedMul();
    this.walk += dt * (4 + sp * 1.6);
    const sw = Math.sin(this.walk) * Math.min(1, sp / 3);
    if (this.state !== 'windup') {
      this.legs[0].rotation.x = sw * 0.8;
      this.legs[1].rotation.x = -sw * 0.8;
      this.arms[1].rotation.x = this.state === 'attack' && this.attack === 'whistle' ? -2.2 : -sw * 0.9;
      this.arms[0].rotation.x = -0.9 + sw * 0.15;
      if (this.state !== 'attack') this.torso.rotation.x *= 0.85;
    }
    if (this.state === 'chase' || this.state === 'recover' || this.state === 'idle') {
      this.whistleRest();
      this.head.scale.setScalar(1);
    }
    this.visual.position.y = Math.abs(sw) * 0.08;
    if (this.whistleCd > 0) this.whistleCd -= dt;
  }
}
