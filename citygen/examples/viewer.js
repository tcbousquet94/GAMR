// The example viewer: generates a city with the example catalogue and draws it with plain boxes (one colour and height
// per asset). A game would put its own models where these boxes go: at lot.center, turned by lot.yaw.
import * as THREE from 'three';
import { generateCity, checkPlan, sidewalkSpots, toWorld } from '../src/index.js';
import { TOWN_ASSETS, LOOK } from './catalogue.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 1, 6000);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a80, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun, sun.target);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ---- orbit camera: drag to orbit, right-drag or two fingers to pan, wheel or pinch to zoom ----
const orbit = { target: new THREE.Vector3(), dist: 800, yaw: 0.7, pitch: 0.85 };
const placeCamera = () => {
  const { target: t, dist, yaw, pitch } = orbit;
  camera.position.set(t.x + dist * Math.cos(pitch) * Math.sin(yaw), t.y + dist * Math.sin(pitch), t.z + dist * Math.cos(pitch) * Math.cos(yaw));
  camera.lookAt(t);
};
const pointers = new Map();
let mode = null, last = null, moved = 0;
const pan = (dx, dy) => {
  const k = orbit.dist / 900, c = Math.cos(orbit.yaw), s = Math.sin(orbit.yaw);
  orbit.target.x -= (dx * c + dy * s) * k; orbit.target.z -= (-dx * s + dy * c) * k;
};
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  mode = pointers.size > 1 ? 'pinch' : e.button === 2 || e.shiftKey ? 'pan' : 'orbit';
  last = null; moved = 0;
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const p = pointers.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
  if (mode === 'pinch' && pointers.size > 1) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (last) orbit.dist = THREE.MathUtils.clamp(orbit.dist * (last / d), 60, 3000);
    last = d; pan(dx / 2, dy / 2);
  } else if (mode === 'pan') pan(dx, dy);
  else if (mode === 'orbit') { orbit.yaw -= dx * 0.006; orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + dy * 0.005, 0.15, 1.5); }
  placeCamera();
});
const up = (e) => {
  pointers.delete(e.pointerId);
  if (!pointers.size) { if (moved < 6 && e.type === 'pointerup') pick(e); mode = null; }
};
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = THREE.MathUtils.clamp(orbit.dist * Math.exp(e.deltaY * 0.001), 60, 3000); placeCamera(); }, { passive: false });

// ---- drawing ----
let city = null, plan = null, lotMesh = null;
const box = new THREE.BoxGeometry(1, 1, 1);
box.translate(0, 0.5, 0); // boxes stand on y = 0
function boxes(list, material) {
  const m = new THREE.InstancedMesh(box, material, Math.max(1, list.length));
  const o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach((b, i) => {
    o.position.set(b.x, b.y ?? 0, b.z); o.rotation.set(0, b.yaw ?? 0, 0); o.scale.set(b.w, b.h, b.d); o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (b.color != null) m.setColorAt(i, c.set(b.color));
  });
  m.count = list.length;
  return m;
}
const rectBox = (r, h, y = 0, color) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, w: r.x1 - r.x0, d: r.z1 - r.z0, h, y, color });
const mat = (color) => new THREE.MeshLambertMaterial({ color });

function build() {
  const cell = +$('cell').value;
  const config = {
    catalogue: TOWN_ASSETS,
    grid: { cols: +$('cols').value, rows: +$('rows').value, cell: [Math.round(cell * 0.87), Math.round(cell * 1.13)] },
    streets: { avenueEvery: +$('avenues').value },
    alleys: $('alleys').checked ? undefined : null, // undefined keeps the defaults
    landmarks: $('landmarks').checked ? undefined : [],
  };
  plan = generateCity(config, $('seed').value || '1');
  if (city) { scene.remove(city); city.traverse((o) => o.material?.dispose?.()); }
  city = new THREE.Group();
  const P = plan, sw = P.sidewalk;
  // Ground, asphalt over the whole street grid, a raised sidewalk slab around every block.
  city.add(boxes([{ x: P.size.x / 2, z: P.size.z / 2, w: P.size.x, d: P.size.z, h: 0.1, y: -0.2 }], mat(css('--ground'))));
  city.add(boxes([...P.streets, ...P.intersections].map((s) => rectBox(s.rect, 0.1, -0.1)), mat(css('--road'))));
  city.add(boxes(P.blocks.map((b) => rectBox({ x0: b.rect.x0 - sw, z0: b.rect.z0 - sw, x1: b.rect.x1 + sw, z1: b.rect.z1 + sw }, 0.15)), mat(css('--walk'))));
  // Lane markings: a centre line down every avenue and street (local streets have none).
  const lines = [];
  for (const s of P.streets) if (s.kind !== 'local') lines.push(s.axis === 'z' ? { x: (s.rect.x0 + s.rect.x1) / 2, z: (s.rect.z0 + s.rect.z1) / 2, w: 0.25, d: s.rect.z1 - s.rect.z0 - 4, h: 0.02, y: 0, color: 0xe8d070 } : { x: (s.rect.x0 + s.rect.x1) / 2, z: (s.rect.z0 + s.rect.z1) / 2, w: s.rect.x1 - s.rect.x0 - 4, d: 0.25, h: 0.02, y: 0, color: 0xe8d070 });
  city.add(boxes(lines, mat(0xffffff)));
  // Whole-block landmarks (parks), alleys, landmark buildings and their forecourts.
  city.add(boxes(P.blocks.filter((b) => b.zone === 'park').map((b) => rectBox(b.rect, 0.3, 0, 0x6aa84f)), mat(0xffffff)));
  city.add(boxes(P.alleys.map((a) => rectBox(a.rect, 0.17, 0, 0x8c8f8a)), mat(0xffffff)));
  city.add(boxes(P.landmarks.flatMap((m) => [rectBox(m.reserved, 0.25, 0, 0xd9d4c4), rectBox(m.rect, 16, 0, 0xf2efe6)]), mat(0xffffff)));
  // Lots: a pad over the whole lot, and the asset's box set back from the street.
  const pads = [], blds = [];
  for (const l of P.lots) {
    const [h, color] = LOOK[l.asset] || [6, 0xaaaaaa];
    const flat = h < 1;
    pads.push({ ...rectBox(l.rect, flat ? h : 0.22, 0, flat ? color : 0xd5d2c8), lot: l.id });
    if (flat) continue;
    const front = Math.min(4, l.depth * 0.18), side = Math.min(1.2, l.width * 0.08), back = Math.min(6, l.depth * 0.25);
    const w = l.width - 2 * side, d = l.depth - front - back, c = toWorld(l, 0, l.depth / 2 - front - d / 2);
    blds.push({ x: c.x, z: c.z, yaw: l.yaw, w, d, h, color, lot: l.id });
  }
  city.add(boxes(pads, mat(0xffffff)));
  lotMesh = boxes(blds, mat(0xffffff));
  lotMesh.castShadow = true;
  lotMesh.userData.lots = blds.map((b) => b.lot);
  city.add(lotMesh);
  // Street lights from sidewalkSpots, and trees in the parks.
  city.add(boxes(sidewalkSpots(P, { spacing: 30 }).map((s) => ({ x: s.x, z: s.z, w: 0.3, d: 0.3, h: 6, color: 0x3a3f3e })), mat(0xffffff)));
  const trees = [];
  for (const b of P.blocks.filter((q) => q.zone === 'park')) for (let x = b.rect.x0 + 8; x < b.rect.x1 - 4; x += 11) for (let z = b.rect.z0 + 8; z < b.rect.z1 - 4; z += 11) if ((x * 7 + z * 13) % 3 > 0.8) trees.push({ x, z, w: 5, d: 5, h: 7, color: 0x3f7a3a });
  const tm = boxes(trees, mat(0xffffff)); tm.castShadow = true; city.add(tm);
  city.traverse((o) => { if (o.isMesh && o !== lotMesh && o !== tm) o.receiveShadow = true; });
  scene.add(city);

  // Frame the city; the sun's shadow box covers it.
  orbit.target.set(P.size.x / 2, 0, P.size.z / 2);
  orbit.dist = Math.max(P.size.x, P.size.z) * 1.3 / Math.min(1, camera.aspect || 1);
  const S = Math.max(P.size.x, P.size.z) / 2;
  sun.position.set(P.size.x / 2 - S * 0.6, S * 1.4, P.size.z / 2 + S * 0.9); sun.target.position.copy(orbit.target);
  Object.assign(sun.shadow.camera, { left: -S * 1.2, right: S * 1.2, top: S * 1.2, bottom: -S * 1.2, near: 1, far: S * 5 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.background = new THREE.Color(css('--paper'));
  placeCamera();
  report();
}

function report() {
  const c = checkPlan(plan);
  $('sLots').textContent = c.stats.lots;
  $('sBlocks').textContent = c.stats.blocks;
  $('sFront').textContent = `${Math.round(c.stats.frontageBuilt * 100)}%`;
  $('status').className = `status ${c.ok ? 'ok' : 'bad'}`;
  $('status').textContent = c.ok ? 'All checks pass: no overlaps, every lot faces its street.' : `${c.problems.length} problems: ${c.problems.slice(0, 3).map((p) => p.kind).join(', ')}`;
  $('key').innerHTML = TOWN_ASSETS.map((a) => `<li><i style="background:#${new THREE.Color(LOOK[a.id][1]).getHexString()}"></i>${a.id}<em>${c.stats.byAsset[a.id] || 0}</em></li>`).join('');
  $('pick').textContent = 'Tap a lot to see its asset, zone, size and street.';
}

// ---- picking ----
const ray = new THREE.Raycaster();
function pick(e) {
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObject(lotMesh)[0];
  if (!hit) return;
  const l = plan.lots[lotMesh.userData.lots[hit.instanceId]];
  const sides = { n: 'north', e: 'east', s: 'south', w: 'west' };
  $('pick').textContent = `${l.asset}  ·  lot ${l.id}\nzone      ${l.zone}\nsize      ${l.width} × ${l.depth} m\nfaces     ${sides[l.front]}, on a${l.street === 'avenue' ? 'n' : ''} ${l.street}${l.corner ? `\ncorner    also on the ${sides[l.corner.side]} ${l.corner.street}` : ''}${l.alley != null ? '\nbacks on  a service alley' : ''}`;
}

// ---- controls ----
for (const id of ['cols', 'rows', 'cell']) $(id).addEventListener('input', () => { $(`${id}v`).textContent = $(id).value; });
for (const id of ['cols', 'rows', 'cell', 'avenues', 'alleys', 'landmarks']) $(id).addEventListener('change', build);
$('go').addEventListener('click', build);
$('seed').addEventListener('keydown', (e) => { if (e.key === 'Enter') build(); });
$('rand').addEventListener('click', () => { $('seed').value = Math.random().toString(36).slice(2, 8); build(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', build);
new MutationObserver(build).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

const resize = () => {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
};
new ResizeObserver(resize).observe(canvas);
resize();
build();
renderer.setAnimationLoop(() => renderer.render(scene, camera));
