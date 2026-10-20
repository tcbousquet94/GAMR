// Party sandbox: stub world / player / combat / enemies around the real createParty().
import * as THREE from 'three';
import { EventBus } from '/src/core/events.js';
import { PALETTE, HEROES } from '/src/core/config.js';
import { buildKid } from '/src/characters/buildKid.js';
import { StatusSet } from '/src/combat/StatusEffects.js';
import { createParty } from '/src/party/Party.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.add(new THREE.HemisphereLight(0xfff6e0, 0x9cbc34, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(20, 35, 12); scene.add(sun);
scene.add(new THREE.Mesh(new THREE.CircleGeometry(40, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: PALETTE.grass })));
const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3, 16), new THREE.MeshLambertMaterial({ color: PALETTE.brick }));
pillar.position.set(0, 1.5, 0); scene.add(pillar);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);

const logEl = document.getElementById('log');
const counts = {};
const recent = [];
function log(kind, msg) {
  counts[kind] = (counts[kind] || 0) + 1;
  recent.push(msg); if (recent.length > 14) recent.shift();
}
window.counts = counts; window.recent = recent;

const events = new EventBus();
for (const ev of ['popup', 'dialogue', 'heal', 'damage', 'defeat', 'sfx']) {
  events.on(ev, (p) => log(ev, `${ev}: ${p.text ?? p.name ?? ''} ${p.speaker ?? ''} ${p.target?.name ?? ''} ${p.amount ?? ''}`));
}

const game = { scene, camera, renderer, events, time: { elapsed: 0, dt: 0 }, timeScale: 1, combatants: [], party: [], target: null, started: true };
window.game = game;

// --- stub world: a pillar collider at origin, spawns
game.world = {
  partySpawns: [new THREE.Vector3(-3, 0, 6), new THREE.Vector3(3, 0, 6)],
  resolveCollision(pos, r) {
    const d = Math.hypot(pos.x, pos.z), min = 1 + r;
    if (d < min && d > 1e-4) { pos.x *= min / d; pos.z *= min / d; }
    return pos;
  },
  update() {},
};

// --- stub combat
function opponentsOf(c) { return game.combatants.filter((o) => o.alive && o.team !== c.team); }
function dealDamage(source, target, amount, { knockback = 4, text = null } = {}) {
  if (!target.alive || target.invulnerable) return 0;
  amount = Math.round(amount * (source?.status?.attackScale?.() ?? 1));
  target.hp = Math.max(0, target.hp - amount);
  if (source?.object3d) {
    const d = new THREE.Vector3().subVectors(target.object3d.position, source.object3d.position).setY(0).normalize();
    target.knockback?.addScaledVector(d, knockback);
  }
  events.emit('damage', { source, target, amount, text });
  target.onHit?.({ source, amount });
  if (target.hp <= 0) { target.alive = false; target.onDefeat?.({ source }); events.emit('defeat', { target, source }); }
  return amount;
}
const projectiles = [];
game.combat = {
  dealDamage, opponentsOf,
  heal(t, amount, text) { t.hp = Math.min(t.maxHp, t.hp + amount); events.emit('heal', { target: t, amount, text }); },
  meleeSweep(att, { range, arc, damage, knockback, text }) {
    log('sweep', `sweep ${att.name} ${text}`);
    const f = new THREE.Vector3(Math.sin(att.object3d.rotation.y), 0, Math.cos(att.object3d.rotation.y));
    const hits = [];
    for (const o of opponentsOf(att)) {
      const d = new THREE.Vector3().subVectors(o.object3d.position, att.object3d.position).setY(0);
      const dist = d.length() - o.radius;
      if (dist > range) continue;
      if (d.normalize().dot(f) < Math.cos(arc / 2)) continue;
      dealDamage(att, o, damage, { knockback, text }); hits.push(o);
    }
    return hits;
  },
  spawnProjectile(opts) {
    log('proj', `proj ${opts.owner.name} ${opts.text}`);
    const mesh = opts.mesh || new THREE.Mesh(new THREE.SphereGeometry(0.3), new THREE.MeshBasicMaterial({ color: opts.color }));
    mesh.position.copy(opts.position); scene.add(mesh);
    projectiles.push({ ...opts, mesh, vel: opts.direction.clone().multiplyScalar(opts.speed), life: opts.life ?? 2 });
  },
  hitstop() {},
  update(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      if (p.homing?.alive) {
        const want = new THREE.Vector3().subVectors(p.homing.object3d.position, p.mesh.position).setY(p.homing.object3d.position.y + 0.8 - p.mesh.position.y).normalize().multiplyScalar(p.speed);
        p.vel.lerp(want, Math.min(1, dt * 5));
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      let hit = false;
      for (const o of opponentsOf(p.owner)) {
        if (o.object3d.position.distanceTo(p.mesh.position) < o.radius + (p.radius ?? 0.4) + 0.6) { dealDamage(p.owner, o, p.damage, { text: p.text }); hit = true; break; }
      }
      if (hit || p.life <= 0) { scene.remove(p.mesh); projectiles.splice(i, 1); }
    }
  },
};

if (params.has('real')) {
  const { Combat } = await import('/src/combat/Combat.js');
  const real = new Combat(game);
  for (const k of ['meleeSweep', 'spawnProjectile', 'heal']) {
    const fn = real[k].bind(real);
    real[k] = (...a) => { log(k === 'meleeSweep' ? 'sweep' : k === 'spawnProjectile' ? 'proj' : 'healcall', `${k} ${a[0]?.name ?? a[0]?.owner?.name ?? ''} ${a[1]?.text ?? a[0]?.text ?? a[2] ?? ''}`); return fn(...a); };
  }
  game.combat = real;
}

// --- stub player: Pip running around a circle (or idle with ?idle)
const pip = buildKid(HEROES.pip.look);
scene.add(pip.root);
const player = {
  name: 'Pip', heroId: 'pip', team: 'hero', object3d: pip.root, radius: 0.5, height: 1.7, hp: 120, maxHp: 120, alive: true,
  invulnerable: false, knockback: new THREE.Vector3(), grounded: true, vy: 0,
  t: 0, idle: params.has('idle'),
  update(dt) {
    this.status.update(dt);
    const prev = pip.root.position.clone();
    if (!this.idle) {
      this.t += dt * 0.35;
      const R = 9;
      pip.root.position.set(Math.cos(this.t) * R, pip.root.position.y, Math.sin(this.t) * R);
    }
    const v = pip.root.position.clone().sub(prev);
    if (v.lengthSq() > 1e-6) pip.root.rotation.y = Math.atan2(v.x, v.z);
    if (!this.grounded) {
      this.vy -= 26 * dt; pip.root.position.y += this.vy * dt;
      if (pip.root.position.y <= 0) { pip.root.position.y = 0; this.vy = 0; this.grounded = true; }
    }
    pip.update(dt, { speed01: this.idle ? 0 : 0.6, grounded: this.grounded, action: null });
  },
  jump() { if (this.grounded) { this.grounded = false; this.vy = 9; } },
};
player.status = new StatusSet(player, events);
game.player = player;
game.combatants.push(player);

// --- stub enemies: red capsules that walk at heroes and bonk them
const enemyGeo = new THREE.CapsuleGeometry(0.5, 0.8, 4, 10);
function makeEnemy(x, z) {
  const m = new THREE.Mesh(enemyGeo, new THREE.MeshLambertMaterial({ color: 0xd04040 }));
  const root = new THREE.Group(); m.position.y = 0.9; root.add(m); root.position.set(x, 0, z); scene.add(root);
  const e = {
    name: 'Stub Locker', team: 'enemy', object3d: root, radius: 0.6, height: 1.8, hp: 60, maxHp: 60, alive: true,
    invulnerable: false, knockback: new THREE.Vector3(), cd: 1,
    onDefeat() { root.visible = false; },
  };
  e.status = new StatusSet(e, events);
  game.combatants.push(e);
  return e;
}
const enemies = [];
game.enemies = {
  get list() { return enemies.filter((e) => e.alive); },
  getNearest(pos, maxDist) {
    let best = null, bd = maxDist;
    for (const e of enemies) { if (!e.alive) continue; const d = Math.hypot(e.object3d.position.x - pos.x, e.object3d.position.z - pos.z); if (d < bd) { bd = d; best = e; } }
    return best;
  },
  spawn(x, z) { const e = makeEnemy(x, z); enemies.push(e); return e; },
  update(dt) {
    for (const e of enemies) {
      if (!e.alive) continue;
      e.status.update(dt);
      e.object3d.position.addScaledVector(e.knockback, dt); e.knockback.multiplyScalar(Math.exp(-8 * dt));
      if (params.has('passive')) continue;
      const heroes = opponentsOf(e);
      let t = null, bd = 1e9;
      for (const h of heroes) { const d = h.object3d.position.distanceTo(e.object3d.position); if (d < bd) { bd = d; t = h; } }
      if (!t) continue;
      const dir = new THREE.Vector3().subVectors(t.object3d.position, e.object3d.position).setY(0);
      if (bd > 1.6) e.object3d.position.addScaledVector(dir.normalize(), 2.2 * dt);
      e.cd -= dt;
      if (bd < 1.8 && e.cd <= 0) { e.cd = 1.5; if (t !== player) dealDamage(e, t, 8, { text: 'Bonk' }); }
    }
  },
};
window.spawnEnemy = (x, z) => game.enemies.spawn(x, z);
if (!params.has('noenemies')) { game.enemies.spawn(12, 3); game.enemies.spawn(10, -4); }

// --- party under test
game.party = createParty(game);

function step(dt) {
  game.time.dt = dt; game.time.elapsed += dt;
  player.update(dt);
  for (const m of game.party) m.update(dt);
  game.enemies.update(dt);
  game.combat.update(dt);
}
window.step = (seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) step(dt); render(); return snapshot(); };
function snapshot() {
  return game.party.map((m) => ({ n: m.name, hp: m.hp, alive: m.alive, act: m.actionKind, tgt: m.target?.name ?? null,
    pos: m.object3d.position.toArray().map((v) => +v.toFixed(2)), idle: m.idle }));
}
window.snapshot = snapshot;

let camMode = params.get('cam') || 'top';
window.setCam = (m) => { camMode = m; };
function render() {
  const p = player.object3d.position;
  if (camMode === 'top') { camera.position.set(0, 26, 20); camera.lookAt(0, 0, 0); }
  else if (camMode === 'follow') { camera.position.set(p.x + 6, 6, p.z + 8); camera.lookAt(p.x, 1, p.z); }
  logEl.textContent = JSON.stringify(counts) + '\n' + recent.join('\n') + '\n' +
    game.party.map((m) => `${m.name} hp ${m.hp}/${m.maxHp} ${m.alive ? '' : 'KO'} ${m.actionKind ?? ''} tgt=${m.target?.name ?? '-'}`).join('\n') +
    `\nPip hp ${player.hp}`;
  renderer.render(scene, camera);
}
const clock = new THREE.Clock();
let paused = params.has('paused');
window.pause = (v = true) => { paused = v; };
(function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!paused) step(dt);
  render();
})();
