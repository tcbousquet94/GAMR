// Player + CameraRig sandbox with stub world / combat / enemies.
import * as THREE from 'three';
import { EventBus } from '../src/core/events.js';
import { Input } from '../src/core/Input.js';
import { PALETTE, RENDER } from '../src/core/config.js';
import { toon } from '../src/core/materials.js';
import { StatusSet } from '../src/combat/StatusEffects.js';
import { Player } from '../src/player/Player.js';
import { CameraRig } from '../src/camera/CameraRig.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, RENDER.maxPixelRatio));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.fog, 45, 110);
const camera = new THREE.PerspectiveCamera(RENDER.fov, innerWidth / innerHeight, 0.1, 300);
scene.add(new THREE.HemisphereLight(0xfff6e0, 0x9cbc34, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(20, 35, 12);
scene.add(sun);

const logEl = document.getElementById('log');
const logLines = [];
function log(...a) {
  const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  logLines.push(s);
  if (logLines.length > 14) logLines.shift();
  logEl.textContent = logLines.join('\n');
  window.__log = window.__log || [];
  window.__log.push(s);
}

const game = {
  scene, camera, renderer,
  input: new Input(canvas),
  events: new EventBus(),
  time: { elapsed: 0, dt: 0 },
  timeScale: 1,
  combatants: [],
  party: [],
  target: null,
  started: false,
};
window.game = game;

// ---- Stub world: flat ground, a raised platform, two boxes as buildings ----
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), toon(PALETTE.grass));
scene.add(ground);
const boxes = [
  { min: new THREE.Vector3(8, 0, -4), max: new THREE.Vector3(14, 6, 4), color: PALETTE.wallPink },
  { min: new THREE.Vector3(-14, 0, 6), max: new THREE.Vector3(-8, 8, 14), color: PALETTE.wallMint },
];
for (const b of boxes) {
  const s = new THREE.Vector3().subVectors(b.max, b.min);
  const m = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, s.z), toon(b.color));
  m.position.copy(b.min).add(b.max).multiplyScalar(0.5);
  scene.add(m);
}
const plat = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 6), toon(PALETTE.path));
plat.position.set(-6, 0.5, -8);
scene.add(plat);
const _ray = new THREE.Ray();
const _hit = new THREE.Vector3();
game.world = {
  playerSpawn: new THREE.Vector3(0, 0, 0),
  courtyardCenter: new THREE.Vector3(0, 0, 0),
  getGroundHeight(x, z) { return x > -9 && x < -3 && z > -11 && z < -5 ? 1 : 0; },
  resolveCollision(pos, r) {
    for (const b of boxes) {
      const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
      const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < r && pos.y < b.max.y) {
        if (d > 1e-4) { pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r; }
        else pos.x = b.max.x + r;
      }
    }
    if (Math.hypot(pos.x, pos.z) > 40) pos.setLength(40);
    return pos;
  },
  segmentBlocked(a, b) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    _ray.set(a, dir.normalize());
    for (const bx of boxes) {
      const box = new THREE.Box3(bx.min, bx.max);
      if (_ray.intersectBox(box, _hit) && _hit.distanceTo(a) < len) return true;
    }
    return false;
  },
  update() {},
};

// ---- Stub combat: logs calls, does simple damage ----
const projectiles = [];
game.combat = {
  dealDamage(source, target, amount, { knockback = 4, text = null } = {}) {
    if (!target.alive || target.invulnerable) return 0;
    const dmg = Math.round(amount * (source?.status?.attackScale?.() ?? 1));
    target.hp = Math.max(0, target.hp - dmg);
    if (source?.object3d) {
      const d = new THREE.Vector3().subVectors(target.object3d.position, source.object3d.position).setY(0).normalize();
      target.knockback.addScaledVector(d, knockback);
    }
    game.events.emit('damage', { source, target, amount: dmg, text });
    target.onHit?.({ source, amount: dmg });
    if (target.hp <= 0) {
      target.alive = false;
      target.onDefeat?.({ source });
      game.events.emit('defeat', { target, source });
    }
    return dmg;
  },
  heal(target, amount, text) {
    target.hp = Math.min(target.maxHp, target.hp + amount);
    log('heal', target.name, amount, text);
  },
  meleeSweep(attacker, o) {
    const hits = [];
    const p = attacker.object3d.position, ry = attacker.object3d.rotation.y;
    for (const t of game.combatants) {
      if (!t.alive || t.team === attacker.team) continue;
      const q = t.object3d.position;
      const dx = q.x - p.x, dz = q.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > o.range + t.radius) continue;
      let ang = Math.atan2(dx, dz) - ry;
      ang = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (Math.abs(ang) > o.arc / 2) continue;
      this.dealDamage(attacker, t, o.damage, o);
      hits.push(t);
    }
    log('meleeSweep', { range: +o.range.toFixed(2), dmg: o.damage, text: o.text, hits: hits.length });
    return hits;
  },
  spawnProjectile(o) {
    const mesh = o.mesh || new THREE.Mesh(new THREE.SphereGeometry(o.radius ?? 0.4), toon(o.color));
    mesh.position.copy(o.position);
    scene.add(mesh);
    projectiles.push({ ...o, mesh, vel: o.direction.clone().multiplyScalar(o.speed), life: o.life ?? 2 });
    log('spawnProjectile', { dmg: o.damage, homing: o.homing?.name ?? null });
  },
  areaBlast() {}, applyStatus(t, n, d) { t.status.add(n, d); },
  opponentsOf(c) { return game.combatants.filter((x) => x.alive && x.team !== c.team); },
  hitstop() {},
  update(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      if (pr.homing?.alive) {
        const want = new THREE.Vector3().copy(pr.homing.object3d.position).setY(pr.homing.object3d.position.y + 0.8).sub(pr.mesh.position).normalize().multiplyScalar(pr.speed);
        pr.vel.lerp(want, 1 - Math.exp(-6 * dt));
      }
      pr.mesh.position.addScaledVector(pr.vel, dt);
      pr.life -= dt;
      let hit = null;
      for (const t of game.combatants) {
        if (t.alive && t.team !== pr.owner.team && t.object3d.position.distanceTo(pr.mesh.position) < t.radius + 1) hit = t;
      }
      if (hit) this.dealDamage(pr.owner, hit, pr.damage, {});
      if (hit || pr.life <= 0) { scene.remove(pr.mesh); projectiles.splice(i, 1); }
    }
  },
};

// ---- Stub enemies ----
const enemyList = [];
function makeEnemy(name, x, z, color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.2), toon(color));
  m.position.y = 0.8;
  g.add(m);
  g.position.set(x, 0, z);
  scene.add(g);
  const e = {
    name, team: 'enemy', object3d: g, radius: 0.7, height: 1.6, hp: 60, maxHp: 60, alive: true,
    invulnerable: false, knockback: new THREE.Vector3(),
    onDefeat() { g.visible = false; log('defeated', name); },
  };
  e.status = new StatusSet(e, game.events);
  enemyList.push(e);
  game.combatants.push(e);
  return e;
}
makeEnemy('Locker A', 0, 6, 0x6a8fd8);
makeEnemy('Locker B', -5, 9, 0xd86a8f);
makeEnemy('Locker C', 5, 10, 0x8fd86a);
game.enemies = {
  get list() { return enemyList.filter((e) => e.alive); },
  getNearest(pos, maxDist) {
    let b = null, bd = maxDist;
    for (const e of this.list) { const d = e.object3d.position.distanceTo(pos); if (d < bd) { bd = d; b = e; } }
    return b;
  },
  update(dt) {
    for (const e of enemyList) {
      if (!e.alive) continue;
      e.object3d.position.addScaledVector(e.knockback, dt);
      e.knockback.multiplyScalar(Math.exp(-8 * dt));
    }
  },
};
window.makeEnemy = makeEnemy;

for (const n of ['sfx', 'popup', 'dialogue', 'lock', 'player:down', 'player:up']) {
  game.events.on(n, (e) => log(n, n === 'lock' ? (e.target?.name ?? null) : n === 'sfx' ? e.name : (e.text ?? '')));
}

game.player = new Player(game);
game.cameraRig = new CameraRig(game);

const params = new URLSearchParams(location.search);
if (params.has('start')) game.started = true;

const statsEl = document.getElementById('stats');
const clock = new THREE.Clock();
const manual = params.has('manual');
// Deterministic stepping for headless tests: window.step(frames, dt, render?)
window.step = (n = 1, dtStep = 1 / 60) => { for (let i = 0; i < n; i++) tick(dtStep); };
function frame() {
  requestAnimationFrame(frame);
  const raw = Math.min(clock.getDelta(), 1 / 20);
  if (manual) { renderer.render(scene, camera); return; }
  tick(raw);
}
function tick(raw) {
  const dt = raw * game.timeScale;
  game.time.dt = dt;
  game.time.elapsed += dt;
  game.input.update(raw);
  if (!game.started && game.input.pressed('start')) { game.started = true; game.events.emit('game:start'); }
  if (game.started) {
    game.player.update(dt);
    game.enemies.update(dt);
    game.combat.update(dt, raw);
  }
  game.cameraRig.update(raw);
  if (!manual) renderer.render(scene, camera);
  game.input.endFrame();
  const p = game.player;
  statsEl.textContent = `HP ${p.hp}/${p.maxHp}  MP ${p.mp.toFixed(1)}  goods ${p.goods}  mom ${p.momCooldown.toFixed(1)}\n` +
    `action ${p.action} combo ${p.combo} grounded ${p.grounded} inv ${p.invulnerable} target ${game.target?.name ?? '-'}`;
}
frame();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
