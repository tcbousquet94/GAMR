import * as THREE from 'three';
import { PALETTE, RENDER } from '../src/core/config.js';
import { Environment } from '../src/world/Environment.js';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, RENDER.maxPixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.fog, 45, 110);
const camera = new THREE.PerspectiveCamera(RENDER.fov, innerWidth / innerHeight, 0.1, 300);
scene.add(new THREE.HemisphereLight(0xfff6e0, 0x9cbc34, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(20, 35, 12);
scene.add(sun);

const game = { scene, camera, renderer };
const world = new Environment(game);
window.world = world; window.game = game;
const markers = new THREE.Group(); scene.add(markers);
if (q.has('spawns')) for (const s of world.enemySpawns) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.6), new THREE.MeshBasicMaterial({ color: 0xff0000 })); m.position.copy(s); markers.add(m); }

const view = q.get('view') || 'orbit';
const cam = q.get('cam')?.split(',').map(Number);
const look = q.get('look')?.split(',').map(Number);
const clock = new THREE.Clock();
let t = Number(q.get('t') || 0);
let frames = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  world.update(dt);
  if (cam) { camera.position.set(...cam); camera.lookAt(...(look || [0, 1, 0])); }
  else if (view === 'player') { camera.position.set(0, 3.2, 31); camera.lookAt(0, 1.6, 20); }
  else if (view === 'top') { camera.position.set(0, 90, 20); camera.lookAt(0, 0, 0); }
  else { const a = t * 0.1 + 0.6; camera.position.set(Math.sin(a) * 48, 30, Math.cos(a) * 48); camera.lookAt(0, 0, 0); }
  renderer.render(scene, camera);
  if (++frames === 30) {
    const i = renderer.info.render;
    console.log('calls', i.calls, 'tris', i.triangles, 'colliders', world.colliders.length, 'spawns', world.enemySpawns.length);
  }
  document.getElementById('info').textContent = `${renderer.info.render.calls} calls`;
}
frame();
