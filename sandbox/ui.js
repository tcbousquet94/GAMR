// HUD + Audio sandbox: stub game with boxes as enemies/heroes.
import * as THREE from 'three';
import { EventBus } from '../src/core/events.js';
import { Input } from '../src/core/Input.js';
import { PLAYER, PARTY, PALETTE } from '../src/core/config.js';
import { HUD } from '../src/ui/HUD.js';
import { Audio } from '../src/audio/Audio.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 4, 9);
camera.lookAt(0, 1, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x9cbc34, 2));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: PALETTE.grass }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

class StubStatus {
  constructor() { this.list = new Map(); }
  add(n, d) { this.list.set(n, d); }
  has(n) { return this.list.has(n); }
  remove(n) { this.list.delete(n); }
  update(dt) { for (const [k, v] of this.list) { if (v - dt <= 0) this.list.delete(k); else this.list.set(k, v - dt); } }
}

function box(color, x, z, h = 1.6) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, h, 1).translate(0, h / 2, 0), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, 0, z);
  scene.add(m);
  return m;
}

const game = {
  scene, camera, renderer,
  input: new Input(canvas),
  events: new EventBus(),
  time: { elapsed: 0, dt: 0 },
  timeScale: 1, combatants: [], party: [], target: null, started: false,
};
window.game = game;

game.player = {
  heroId: 'pip', name: 'Pip', team: 'hero', hp: 120, maxHp: PLAYER.maxHp, mp: 40, maxMp: PLAYER.maxMp,
  alive: true, status: new StubStatus(), goods: 3, momCooldown: 0, momCooldownMax: 45, psiCost: 8,
  object3d: box(0xffd23f, 0, 2), height: 1.65,
};
game.party = [
  { heroId: 'dot', name: 'Dot', team: 'hero', hp: 80, maxHp: PARTY.dot.maxHp, alive: true, status: new StubStatus(), object3d: box(0xff8fbf, -2.5, 1), height: 1.6 },
  { heroId: 'moose', name: 'Moose', team: 'hero', hp: 140, maxHp: PARTY.moose.maxHp, alive: true, status: new StubStatus(), object3d: box(0x5fd18a, 2.5, 1), height: 1.8 },
];
const enemies = [
  { name: 'Locker Mimic', team: 'enemy', hp: 60, maxHp: 60, alive: true, object3d: box(0x7a8aa0, -1.5, -3, 2), height: 2 },
  { name: 'Group Chat (99+)', team: 'enemy', hp: 40, maxHp: 40, alive: true, object3d: box(0x4fa8ff, 2, -4, 1.4), height: 1.4 },
];
game.enemies = { list: enemies };
game.target = null;

game.hud = new HUD(game);
game.audio = new Audio(game);

// Stub "player": handles commands so the menu does something
game.events.on('command', ({ name }) => {
  const p = game.player;
  if (name === 'psi') {
    if (p.mp < p.psiCost) { game.events.emit('sfx', { name: 'denied' }); game.events.emit('popup', { text: 'Not enough MP!', position: null, style: 'info' }); return; }
    p.mp -= p.psiCost;
    const t = game.target || enemies[0];
    t.hp = Math.max(0, t.hp - 22);
    game.events.emit('damage', { source: p, target: t, amount: 22, crit: false, text: 'PSI Zinger!' });
  } else if (name === 'goods') {
    if (p.goods <= 0) return;
    p.goods--; p.hp = Math.min(p.maxHp, p.hp + 50);
    game.events.emit('heal', { target: p, amount: 50, text: 'Yum! Pizza!' });
  } else if (name === 'mom') {
    if (p.momCooldown > 0) return;
    p.momCooldown = p.momCooldownMax;
    game.events.emit('sfx', { name: 'phone' });
    game.events.emit('dialogue', { speaker: 'Mom', text: 'Honey, did you remember your jacket? ...Oh, you are fighting? Well, eat something, sweetie.' });
  }
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyT') game.target = game.target ? null : enemies[0];
  if (e.code === 'KeyK') { const t = enemies[0]; t.hp = Math.max(0, t.hp - 9); game.events.emit('damage', { source: game.player, target: t, amount: 9, text: 'Bonk!' }); }
});

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const raw = Math.min(clock.getDelta(), 1 / 20);
  game.time.elapsed += raw;
  game.input.update(raw);
  if (!game.started && game.input.pressed('start')) { game.started = true; game.events.emit('game:start'); }
  const p = game.player;
  p.mp = Math.min(p.maxMp, p.mp + raw * 1.2);
  p.momCooldown = Math.max(0, p.momCooldown - raw);
  p.status.update(raw);
  for (const m of game.party) m.status.update(raw);
  enemies[1].object3d.rotation.y += raw;
  game.hud.update(raw);
  renderer.render(scene, camera);
  game.input.endFrame();
}
frame();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});
