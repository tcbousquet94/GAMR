import * as THREE from 'three';
import { groundRect } from '../../build.js';
import { toon } from '../../../core/materials.js';
import { C, frame, building, tree } from './props.js';

// 6. Fairground: north-east, across Elm St. Ferris wheel, circus tent, carousel, a roller coaster
// and two food stalls behind a picket fence with an entrance arch on Main St.
export function buildFair(t) {
  const b = t.b;
  groundRect(t.root, 0xe6cf98, 4, 24, 70, -33.5, 0.02);
  groundRect(t.root, 0xe6cf98, 28, 3.5, 70, -34, 0.02);

  // Fence + entrance arch
  for (const [x0, x1] of [[54.5, 68], [72, 87.5]]) {
    const len = x1 - x0, cx = (x0 + x1) / 2;
    b.box(C.white, len, 0.12, 0.08, cx, 0.55, -21.6);
    for (let x = x0; x <= x1; x += 0.6) b.box(C.white, 0.14, 0.95, 0.1, x, 0, -21.6);
    t.solid(cx, -21.6, len, 0.3, 1);
  }
  b.box(C.white, 0.1, 0.12, 25, 54.5, 0.55, -34.5);
  t.solid(54.5, -34.5, 0.3, 25, 1);
  for (const x of [67.6, 72.4]) {
    for (let i = 0; i < 5; i++) b.cyl(i % 2 ? C.white : 0xe8423c, 0.3, 0.3, 1, x, i, -21.6, { outline: 0.03 });
    b.sph(0xffd23f, 0.45, x, 5.3, -21.6, { outline: 0.04 });
    t.post(x, -21.6, 0.35, 5);
  }
  const arch = frame(t, 70, -21.6, 0);
  arch.box(0xe8423c, 5.6, 1.3, 0.3, 0, 4.2, 0, { outline: 0.05 });
  arch.sign(['MAPLE FAIR', 'fun is mandatory'], { w: 5.2, h: 1.15, px: 56, bg: '#ffe14f', fg: '#c11f4f', border: '#c11f4f' }, 0, 4.85, 0.17);

  // Ferris wheel
  const wx = 78.5, wz = -40.5, hub = 8.5, R = 6.5;
  for (const dz of [-1.2, 1.2]) {
    b.box(0xe8e2f0, 0.35, hub + 0.5, 0.35, wx - 2.6, 0, wz + dz, { rz: -0.3, outline: 0.04 });
    b.box(0xe8e2f0, 0.35, hub + 0.5, 0.35, wx + 2.6, 0, wz + dz, { rz: 0.3, outline: 0.04 });
  }
  b.cyl(C.metal, 0.3, 0.3, 2.8, wx, hub, wz, { rx: Math.PI / 2 });
  t.solid(wx, wz, 8, 3.4, 16);
  const wheel = new THREE.Group();
  wheel.position.set(wx, hub, wz);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.2, 6, 40), toon(0xff5f9e));
  wheel.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.12, 6, 28), toon(0xffd23f));
  wheel.add(ring2);
  const spokeGeo = new THREE.BoxGeometry(0.1, R * 2, 0.1);
  const spokeMat = toon(0xffffff);
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(spokeGeo, spokeMat); s.rotation.z = (i / 4) * Math.PI; wheel.add(s); }
  const cabins = [];
  const cabinGeo = new THREE.BoxGeometry(1.2, 1.1, 1.0);
  const cols = [0xe8423c, 0x4fa8ff, 0x5fd18a, 0xffd23f, 0xb06ad1, 0xff8a3a, 0x3fe0ff, 0xff5f9e];
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Mesh(cabinGeo, toon(cols[i]));
    const a = (i / 8) * Math.PI * 2;
    c.position.set(Math.cos(a) * R, Math.sin(a) * R - 0.7, 0);
    wheel.add(c);
    cabins.push(c);
  }
  t.root.add(wheel);
  t.anims.push((time) => {
    wheel.rotation.z = time * 0.12;
    for (const c of cabins) c.rotation.z = -wheel.rotation.z; // cabins stay level
  });

  // Circus tent with red/white stripes
  const tx = 62.5, tz = -37.5, tr = 5;
  for (let i = 0; i < 14; i++) {
    const a0 = (i / 14) * Math.PI * 2, da = Math.PI * 2 / 14;
    const col = i % 2 ? C.white : 0xe8423c;
    b.add(col, new THREE.CylinderGeometry(tr, tr, 3.4, 2, 1, false, a0, da), tx, 1.7, tz);
    b.add(i % 2 ? 0xe8423c : C.white, new THREE.CylinderGeometry(0.15, tr + 0.5, 4, 2, 1, false, a0, da), tx, 5.4, tz);
  }
  b.cyl(0xffd23f, 0.05, 0.05, 1.6, tx, 7.3, tz);
  b.box(0x3fe0ff, 0.06, 0.6, 0.9, tx + 0.45, 8.4, tz);
  b.box(0x2a1a2e, 2.2, 2.6, 0.3, tx, 0, tz + tr - 0.05, { outline: 0.03 });
  t.post(tx, tz, tr + 0.2, 7, tr);
  t.door(tx, tz + tr + 0.6, 2.4, 1.2, { message: { speaker: '', text: 'The tent is closed. From inside you hear a clown practicing crying. Professionally.' } });

  // Carousel (spins, horses bob)
  const ox = 63.5, oz = -26.5;
  const carousel = new THREE.Group();
  carousel.position.set(ox, 0, oz);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.3, 0.4, 20), toon(0xfdf8ec));
  base.position.y = 0.2;
  carousel.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3.6, 10), toon(0xffd23f));
  pole.position.y = 2;
  carousel.add(pole);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.6, 16), toon(0xb06ad1));
  roof.position.y = 4.4;
  carousel.add(roof);
  const horses = [];
  const bodyGeo = new THREE.BoxGeometry(0.4, 0.55, 1.1), headGeo = new THREE.BoxGeometry(0.35, 0.6, 0.4), rodGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.4, 4);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const h = new THREE.Group();
    const mat = toon([0xffffff, 0xffb3d1, 0xb8ead0][i % 3]);
    const body = new THREE.Mesh(bodyGeo, mat);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.set(0, 0.35, 0.55);
    h.add(body, head);
    const rod = new THREE.Mesh(rodGeo, toon(0xffd23f));
    rod.position.set(Math.cos(a) * 2.4, 2.1, Math.sin(a) * 2.4);
    carousel.add(rod);
    h.position.set(Math.cos(a) * 2.4, 1.4, Math.sin(a) * 2.4);
    h.rotation.y = -a;
    carousel.add(h);
    horses.push(h);
  }
  t.root.add(carousel);
  t.post(ox, oz, 3.4, 5, 3.4);
  t.anims.push((time) => {
    carousel.rotation.y = time * 0.5;
    horses.forEach((h, i) => { h.position.y = 1.3 + Math.sin(time * 3 + i * 1.3) * 0.3; });
  });

  // Roller coaster: chunky bead track on posts around an oval, with a cart doing laps.
  const cx = 80, cz = -28.5, rx = 6, rz = 3.2;
  const pathAt = (u, out) => {
    const a = u * Math.PI * 2;
    out.set(cx + Math.cos(a) * rx, 2.4 + 1.8 * Math.sin(a * 2) + 1.2 * Math.cos(a), cz + Math.sin(a) * rz);
    return out;
  };
  const p = new THREE.Vector3();
  for (let i = 0; i < 64; i++) {
    pathAt(i / 64, p);
    b.sph(i % 8 < 4 ? 0xe8423c : 0xffd23f, 0.28, p.x, p.y, p.z);
    if (i % 4 === 0) b.cyl(C.white, 0.08, 0.1, p.y, p.x, 0, p.z);
  }
  t.solid(cx, cz, rx * 2 + 1, rz * 2 + 1, 4);
  const cart = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.8), toon(0x3fe0ff));
  t.root.add(cart);
  const next = new THREE.Vector3();
  t.anims.push((time) => {
    const u = (time * 0.12) % 1;
    pathAt(u, cart.position);
    cart.position.y += 0.45;
    pathAt(u + 0.01, next);
    cart.lookAt(next.x, next.y + 0.45, next.z);
  });

  // Food stalls
  building(t, 58.5, -29.5, Math.PI / 2, {
    w: 3.4, d: 2.6, h: 2.8, wall: 0xffe9a8, roofType: 'flat', awning: [0xff5f9e, C.white],
    sign: ['FUNNEL CAKE'], signOpts: { w: 3, h: 0.7, px: 46 },
  });
  building(t, 72, -45.5, 0, {
    w: 3.6, d: 2.6, h: 2.8, wall: 0xb8ead0, roofType: 'flat', awning: [0xe8423c, 0xffd23f],
    sign: ['CORN DOGS', '(ethically questionable)'], signOpts: { w: 3.2, h: 0.9, px: 40 },
  });
  for (const [x, z] of [[56.5, -46], [86.5, -46.5], [86.5, -23.5], [56.5, -23.5]]) tree(t, x, z, 1);
}
