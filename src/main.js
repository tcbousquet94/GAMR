import * as THREE from 'three';
import { EventBus } from './core/events.js';
import { Input } from './core/Input.js';
import { PALETTE, RENDER } from './core/config.js';
import { Environment } from './world/Environment.js';
import { Combat } from './combat/Combat.js';
import { Player } from './player/Player.js';
import { CameraRig } from './camera/CameraRig.js';
import { createParty } from './party/Party.js';
import { EnemyManager } from './enemies/EnemyManager.js';
import { HUD } from './ui/HUD.js';
import { Audio } from './audio/Audio.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.fog, 45, 110);

const camera = new THREE.PerspectiveCamera(RENDER.fov, window.innerWidth / window.innerHeight, 0.1, 300);

scene.add(new THREE.HemisphereLight(0xfff6e0, 0x9cbc34, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(20, 35, 12);
scene.add(sun);

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
window.game = game; // handy for debugging in the console

game.world = new Environment(game);
game.combat = new Combat(game);
game.player = new Player(game);
game.cameraRig = new CameraRig(game);
game.party = createParty(game);
game.enemies = new EnemyManager(game);
game.hud = new HUD(game);
game.audio = new Audio(game);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const fpsEl = document.getElementById('fps');
let fpsFrames = 0, fpsTime = 0;

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const raw = Math.min(clock.getDelta(), 1 / 20);
  const dt = raw * game.timeScale;
  game.time.dt = dt;
  game.time.elapsed += dt;

  game.input.update(raw);
  if (!game.started && game.input.pressed('start')) {
    game.started = true;
    game.events.emit('game:start');
  }

  if (game.started) {
    game.player.update(dt);
    for (const m of game.party) m.update(dt);
    game.enemies.update(dt);
    game.combat.update(dt, raw);
  }
  game.world.update(dt);
  game.cameraRig.update(raw);
  game.hud.update(raw);

  renderer.render(scene, camera);
  game.input.endFrame();

  fpsFrames++;
  fpsTime += raw;
  if (fpsTime >= 0.5) {
    fpsEl.textContent = `${Math.round(fpsFrames / fpsTime)} fps · ${renderer.info.render.calls} calls`;
    fpsFrames = 0;
    fpsTime = 0;
  }
}
frame();
