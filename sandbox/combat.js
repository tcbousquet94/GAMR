import * as THREE from 'three';
import { EventBus } from '../src/core/events.js';
import { PALETTE } from '../src/core/config.js';
import { toon, outline } from '../src/core/materials.js';
import { buildKid } from '../src/characters/buildKid.js';
import { HEROES } from '../src/core/config.js';
import { Combat } from '../src/combat/Combat.js';
import { StatusSet } from '../src/combat/StatusEffects.js';
import { EnemyManager } from '../src/enemies/EnemyManager.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 16, 22);
camera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight(0xfff6e0, 0x9cbc34, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(20, 35, 12);
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), toon(PALETTE.grass));
scene.add(ground);

// stub world: arena radius 20 + a few box walls
const boxes = [
  new THREE.Box3(new THREE.Vector3(-9, 0, -3), new THREE.Vector3(-7, 2, 3)),
  new THREE.Box3(new THREE.Vector3(6, 0, -9), new THREE.Vector3(12, 2, -7)),
];
for (const b of boxes) {
  const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const m = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, s.z), toon(PALETTE.brick));
  m.position.copy(c);
  outline(m, 0.05);
  scene.add(m);
}
const ARENA = 20;
const world = {
  enemySpawns: [new THREE.Vector3(10, 0, 8), new THREE.Vector3(-10, 0, 8), new THREE.Vector3(0, 0, -12), new THREE.Vector3(12, 0, -2), new THREE.Vector3(-12, 0, -8)],
  getGroundHeight: () => 0,
  resolveCollision(p, r) {
    const d = Math.hypot(p.x, p.z);
    if (d > ARENA - r) { p.x *= (ARENA - r) / d; p.z *= (ARENA - r) / d; }
    for (const b of boxes) {
      const cx = Math.max(b.min.x, Math.min(p.x, b.max.x)), cz = Math.max(b.min.z, Math.min(p.z, b.max.z));
      const dx = p.x - cx, dz = p.z - cz, dd = Math.hypot(dx, dz);
      if (dd < r) {
        if (dd > 1e-5) { p.x = cx + dx / dd * r; p.z = cz + dz / dd * r; }
        else p.x = b.max.x + r;
      }
    }
    return p;
  },
  segmentBlocked(a, b) {
    for (const bx of boxes) if (bx.containsPoint(b)) return true;
    return Math.hypot(b.x, b.z) > ARENA;
  },
  update() {},
};

const events = new EventBus();
const game = {
  scene, camera, renderer, events, world,
  time: { elapsed: 0, dt: 0 }, timeScale: 1, combatants: [], party: [], target: null, started: false,
  cameraRig: { shakeAmt: 0, shake(x) { this.shakeAmt = Math.max(this.shakeAmt, x); } },
};
window.game = game;
window.THREE = THREE;

function makeHero(id, x, z) {
  const kid = buildKid(HEROES[id].look);
  const h = {
    name: HEROES[id].name, heroId: id, team: 'hero', object3d: kid.root, radius: 0.45, height: 1.7,
    hp: 120, maxHp: 120, alive: true, invulnerable: false, knockback: new THREE.Vector3(), kid,
    setBlush: (on) => kid.setBlush(on), hurtT: 0,
    onHit() { this.hurtT = 0.3; },
    onDefeat() { },
  };
  h.status = new StatusSet(h, events);
  kid.root.position.set(x, 0, z);
  scene.add(kid.root);
  game.combatants.push(h);
  return h;
}
game.player = makeHero('pip', 0, 2);
game.party = [makeHero('dot', -2.5, 4), makeHero('moose', 2.5, 4)];
for (const m of game.party) m.update = () => {};

game.combat = new Combat(game);
game.enemies = new EnemyManager(game);

// stub HUD: popups as DOM
const counts = {};
for (const n of ['damage', 'heal', 'defeat', 'status:add', 'status:remove', 'popup', 'sfx', 'wave']) {
  events.on(n, (p) => { counts[n] = (counts[n] || 0) + 1; if (n === 'sfx') counts['sfx:' + p.name] = (counts['sfx:' + p.name] || 0) + 1; });
}
window.counts = counts;
const pops = [];
function addPop(text, pos, color, size = 22) {
  const el = document.createElement('div');
  el.className = 'pop';
  el.textContent = text;
  el.style.color = color;
  el.style.fontSize = size + 'px';
  document.body.appendChild(el);
  pops.push({ el, pos: pos ? pos.clone() : null, t: 0 });
}
events.on('damage', ({ target, amount, text, crit }) => {
  const p = target.object3d.position.clone(); p.y += target.height + 0.3;
  addPop(text ? `${text} ${amount}` : `${amount}`, p, target.team === 'hero' ? '#ff4f6a' : crit ? '#ffd23f' : '#fff', crit ? 30 : 22);
});
events.on('popup', ({ text, position, style }) => addPop(text, position, style === 'heal' ? '#7fe05a' : style === 'status' ? '#ff8fbf' : style === 'big' ? '#ffd23f' : '#fff', style === 'big' ? 32 : 18));
events.on('wave', ({ title }) => addPop(title, null, '#ffd23f', 40));
const _p = new THREE.Vector3();

const logEl = document.getElementById('log');
const clock = new THREE.Clock();
game.paused = false;
function frame() {
  requestAnimationFrame(frame);
  const raw = Math.min(clock.getDelta(), 1 / 20);
  step(raw);
  renderer.render(scene, camera);
}
function step(raw) {
  const dt = raw * game.timeScale;
  game.time.dt = dt;
  game.time.elapsed += dt;
  if (game.started && !game.paused) {
    for (const h of [game.player, ...game.party]) {
      h.status.update(dt);
      const p = h.object3d.position;
      p.addScaledVector(h.knockback, dt);
      h.knockback.multiplyScalar(Math.exp(-8 * dt));
      world.resolveCollision(p, h.radius);
      h.hurtT -= dt;
      h.kid.update(dt, { speed01: 0, grounded: true, action: h.hurtT > 0 ? 'hurt' : null, actionT: 1 - h.hurtT / 0.3 });
      if (h.hp <= 0) h.hp = h.maxHp, h.alive = true; // immortal test dummies
    }
    game.enemies.update(dt);
    game.combat.update(dt, raw);
  }
  const s = game.cameraRig.shakeAmt;
  if (!game.camLock) camera.position.set(Math.sin(game.time.elapsed * 60) * s * 0.3, 16, 22);
  game.cameraRig.shakeAmt *= Math.exp(-10 * raw);
  for (let i = pops.length - 1; i >= 0; i--) {
    const q = pops[i];
    q.t += raw;
    if (q.t > 1.6) { q.el.remove(); pops.splice(i, 1); continue; }
    if (q.pos) {
      _p.copy(q.pos); _p.y += q.t * 0.8; _p.project(camera);
      q.el.style.left = ((_p.x + 1) / 2 * innerWidth) + 'px';
      q.el.style.top = ((1 - _p.y) / 2 * innerHeight) + 'px';
    } else { q.el.style.left = '50%'; q.el.style.top = (30 + i * 0) + '%'; }
  }
  logEl.textContent = `wave ${game.enemies.wave}  alive ${game.enemies.list.length}  calls ${renderer.info.render.calls}\n` +
    `player hp ${game.player.hp} status ${[...game.player.status.list.keys()].join(',')}\n` +
    game.enemies.all.map((e) => `${e.name} ${e.state} ${e.hp}/${e.maxHp}`).join('\n');
}
window.step = step;
frame();

if (!location.search.includes('nostart')) {
  game.started = true;
  events.emit('game:start');
}
