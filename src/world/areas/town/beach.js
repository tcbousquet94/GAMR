import * as THREE from 'three';
import { groundRect } from '../../build.js';
import { toon } from '../../../core/materials.js';
import { C, frame, building, palm } from './props.js';

// 7. The beach: south of Shore Rd. Lighthouse on the rocks by the bay, a pier with a bobbing boat,
// umbrellas, a lifeguard tower nobody sits in, and a sno-cone hut.
export function buildBeach(t) {
  const b = t.b;
  groundRect(t.root, C.sand, 42, 24, 24, 29.5, 0.013);
  groundRect(t.root, C.sandDark, 42, 1.4, 24, 40.3, 0.014);
  groundRect(t.root, C.sand, 6, 32, 4, 26, 0.012);

  // Lighthouse on a pile of rocks
  const lx = 8, lz = 35.5;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.sph(C.rock, 1.1, lx + Math.cos(a) * 2, 0.3, lz + Math.sin(a) * 2, { scale: [1.2, 0.7, 1], outline: 0.05 });
  }
  for (let i = 0; i < 6; i++) b.cyl(i % 2 ? C.white : 0xe8423c, 1.25 - i * 0.07, 1.3 - i * 0.07, 1.4, lx, 0.4 + i * 1.4, lz, { seg: 14, outline: 0.05 });
  b.cyl(0x2a2a33, 1.0, 1.0, 0.25, lx, 8.8, lz, { seg: 14 });
  b.cyl(0xfff3a8, 0.8, 0.8, 1.2, lx, 9.05, lz, { seg: 14, outline: 0.04 });
  b.cyl(0xe8423c, 0.1, 1.15, 1.1, lx, 10.25, lz, { seg: 14, outline: 0.05 });
  b.box(0x2a1a2e, 0.9, 1.7, 0.2, lx, 0.5, lz + 1.18);
  t.post(lx, lz, 2.6, 11, 1.4);
  t.door(lx, lz + 3.2, 2, 1, { message: { speaker: '', text: 'A note on the lighthouse door: "Gone fishing. Ironically. —The Keeper"' } });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.2, 9, 10, 1, true).translate(0, -4.5, 0).rotateZ(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xfff3a8, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(lx, 9.6, lz);
  t.root.add(beam);
  t.anims.push((time) => { beam.rotation.y = time * 0.8; });

  // Pier straight out into the sea, with a boat bobbing at the end
  for (let z = 37.5; z <= 47.5; z += 1) b.box(0xb98a50, 2.4, 0.2, 0.9, 30, 0.1, z, { outline: 0.02 });
  t.raised.push({ minX: 28.8, maxX: 31.2, minZ: 38.5, maxZ: 48, y: 0.3 }); // walk on the deck, not through it
  for (let z = 38; z <= 47.5; z += 2.4) for (const x of [28.9, 31.1]) b.cyl(0x8a5a32, 0.15, 0.15, 1.4, x, -0.6, z);
  for (const x of [28.85, 31.15]) { b.box(0x8a5a32, 0.12, 0.12, 10, x, 0.9, 42.5); t.solid(x, 42.5, 0.15, 10, 1); }
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 4.6), toon(C.white));
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.25, 4.64), toon(0xe8423c));
  stripe.position.y = 0.15;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), toon(0x4fa8ff));
  cabin.position.set(0, 0.9, -0.6);
  boat.add(hull, stripe, cabin);
  boat.position.set(33.6, 0.2, 45);
  t.root.add(boat);
  t.anims.push((time) => {
    boat.position.y = 0.15 + Math.sin(time * 1.4) * 0.12;
    boat.rotation.z = Math.sin(time * 1.1) * 0.05;
    boat.rotation.x = Math.sin(time * 0.9) * 0.03;
  });

  // Umbrellas + towels
  const umb = [[14, 26, 0xff5f9e], [19, 31, 0x4fa8ff], [27, 25, 0xffd23f], [35, 30, 0x5fd18a], [39, 35, 0xff8a3a]];
  for (const [x, z, col] of umb) {
    b.cyl(C.pole, 0.06, 0.06, 2.4, x, 0, z);
    for (let i = 0; i < 8; i++) {
      b.add(i % 2 ? col : C.white, new THREE.ConeGeometry(1.6, 0.7, 2, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4), x, 2.55, z);
    }
    groundRect(t.root, col, 1.0, 2.0, x + 1.2, z + 0.4, 0.016);
    t.post(x, z, 0.25, 2.4);
  }

  // Lifeguard tower
  const lg = frame(t, 23, 34, 0);
  for (const dx of [-0.8, 0.8]) for (const dz of [-0.8, 0.8]) lg.box(C.white, 0.15, 2.2, 0.15, dx, 0, dz);
  lg.box(0xe8423c, 2, 0.2, 2, 0, 2.2, 0, { outline: 0.03 });
  lg.box(0xe8423c, 0.9, 1.0, 0.15, 0, 2.4, -0.5, { outline: 0.03 });
  lg.box(0xe8423c, 2.2, 0.15, 2.2, 0, 3.8, 0, { outline: 0.03 });
  lg.box(C.white, 0.1, 1.4, 0.1, -1, 2.4, 1).box(C.white, 0.1, 1.4, 0.1, 1, 2.4, 1);
  lg.sign(['LIFEGUARD', 'on break (forever)'], { w: 2, h: 0.75, px: 40, bg: '#ffffff', fg: '#e8423c' }, 0, 1.2, 1.0);
  lg.solid(2, 2, 0, 0, 4);

  // Sandcastle with a tiny flag
  const sc = frame(t, 15, 33.5, 0);
  sc.box(0xe8c97e, 2, 0.8, 2, 0, 0, 0, { outline: 0.04 });
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    sc.cyl(0xe8c97e, 0.35, 0.4, 1.3, dx, 0, dz, { outline: 0.03 });
    sc.cyl(0xe8c97e, 0.0, 0.4, 0.5, dx, 1.3, dz);
  }
  sc.cyl(C.white, 0.03, 0.03, 0.8, 0, 0.8, 0).box(0xff5f9e, 0.03, 0.25, 0.4, 0, 1.4, 0.2);
  sc.solid(2.4, 2.4, 0, 0, 1.5);

  // Sno-cone hut facing west
  building(t, 41, 24, -Math.PI / 2, {
    w: 5, d: 3.6, h: 3, wall: 0x9fe0ff, roofType: 'flat', awning: [0xff5f9e, C.white],
    sign: ["SANDY'S SNO-CONES", 'flavors: blue, also blue'], signOpts: { w: 4.4, h: 1, px: 40 },
    doorTarget: { message: { speaker: '', text: "A sign in the window: \"Back at noon. Or when it's hot. Whichever.\"" } },
  });

  for (const [x, z, s] of [[6, 21, 1], [12, 20, 0.85], [33, 20.5, 1], [44, 31, 0.9], [44, 38, 1.05], [17, 38.5, 0.8], [5.5, 28, 0.9]]) palm(t, x, z, s, 0.25);
}
