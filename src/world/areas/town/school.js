import * as THREE from 'three';
import { groundRect } from '../../build.js';
import { C, frame, tree, bush, bench } from './props.js';

// 1. Maplewood High: north-west, between the river and School Ave. Front faces south onto Main St.
export function buildSchool(t) {
  const cx = -16.5, cz = -39;
  const f = frame(t, cx, cz, 0);
  const W = 16, D = 10, H = 8;
  // Main building: cream walls, brick trims, teal roof slab
  f.box(C.cream, W, H, D, 0, 0, 0, { outline: 0.08 });
  f.box(0xe88a6a, W + 0.4, 0.6, D + 0.4, 0, H, 0, { outline: 0.06 });
  f.box(C.teal, W - 1, 1.2, D - 1, 0, H + 0.6, 0, { outline: 0.06 });
  f.box(0xe88a6a, W + 0.1, 0.35, D + 0.1, 0, 3.9, 0);
  for (const x of [-6.5, -4.2, 4.2, 6.5]) for (const y of [1.4, 5.2]) f.box(C.window, 1.5, 1.6, 0.12, x, y, D / 2 + 0.03, { outline: 0.04 });
  // Entrance block with gable, columns, double doors, steps
  f.box(0xe88a6a, 5, 9.6, 2.6, 0, 0, D / 2 + 1.2, { outline: 0.07 });
  f.gable(C.teal, 5.6, 2.2, 3.2, 0, 9.6, D / 2 + 1.2, { ry: Math.PI / 2, outline: 0.06 });
  for (const x of [-2.1, 2.1]) f.cyl(C.white, 0.28, 0.32, 3.6, x, 0.4, D / 2 + 2.7, { outline: 0.04 });
  f.box(C.white, 5.4, 0.4, 0.8, 0, 3.9, D / 2 + 2.7, { outline: 0.04 });
  f.box(0x2f8f8a, 1.3, 3.0, 0.2, -0.68, 0.6, D / 2 + 2.52, { outline: 0.03 });
  f.box(0x2f8f8a, 1.3, 3.0, 0.2, 0.68, 0.6, D / 2 + 2.52, { outline: 0.03 });
  f.box(C.window, 0.9, 1.1, 0.22, -0.68, 2.2, D / 2 + 2.55);
  f.box(C.window, 0.9, 1.1, 0.22, 0.68, 2.2, D / 2 + 2.55);
  for (let i = 0; i < 3; i++) f.box(C.rock, 6 - i * 0.6, 0.2, 1, 0, i * 0.2, D / 2 + 3.4 - i * 0.45 + 0.9, { outline: 0.03 });
  f.sign(['MAPLEWOOD HIGH'], { w: 5.6, h: 1.0, px: 72, bg: '#2a3a6a', fg: '#ffe680', border: '#ffe680' }, 0, 5.0, D / 2 + 2.53);
  f.cyl(C.white, 0.85, 0.85, 0.2, 0, 7.5, D / 2 + 2.6, { rx: Math.PI / 2, outline: 0.05, seg: 20 });
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.06).translate(0, 0.28, 0), new THREE.MeshBasicMaterial({ color: 0x2a1a2e }));
  hand.position.set(f.wx(0, D / 2 + 2.72), 7.6, f.wz(0, D / 2 + 2.72));
  t.root.add(hand);
  t.anims.push((time) => { hand.rotation.z = -time * 0.9; }); // school time moves weirdly fast
  f.solid(W, D, 0, 0, H + 1.8);
  f.solid(5, 3.2, 0, D / 2 + 1.5, 11);
  // Doors -> the school interior (step 3). Spawn just outside for coming back out.
  f.door(1.8, 1.0, 0, D / 2 + 3.5, { to: 'school', spawn: 'entrance' });
  t.addSpawn('schoolFront', cx, cz + D / 2 + 5.2, 0);

  // Gym wing to the west
  const g = frame(t, -24.4, -40, 0);
  g.box(0xb8ead0, 4.6, 6, 12, 0, 0, 0, { outline: 0.07 });
  g.box(C.teal, 5.2, 0.8, 12.6, 0, 6, 0, { outline: 0.06 });
  g.sign(['GYM'], { w: 2.8, h: 0.9, px: 60, bg: '#ffffff', fg: '#2f8f8a' }, 0, 4.2, 6.03);
  g.solid(4.6, 12, 0, 0, 6.8);

  // Front lawn: path to Main St, flagpole, sign, bike rack, trees
  groundRect(t.root, C.path, 3.4, 9, cx, -24.6, 0.02);
  groundRect(t.root, C.paving, 10, 2.5, cx, -27.5, 0.021);
  const b = t.b;
  b.cyl(0xc9c9d6, 0.08, 0.1, 10, -9.8, 0, -27);
  b.sph(0xffd23f, 0.2, -9.8, 10.1, -27);
  t.post(-9.8, -27, 0.25, 10);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.15, 8, 1).translate(0.95, 0, 0), new THREE.MeshBasicMaterial({ color: C.teal, side: THREE.DoubleSide }));
  flag.position.set(-9.8, 9.3, -27);
  t.root.add(flag);
  const base = flag.geometry.attributes.position.array.slice();
  t.anims.push((time) => {
    const p = flag.geometry.attributes.position;
    for (let i = 0; i < p.array.length; i += 3) p.array[i + 2] = Math.sin(base[i] * 2.6 - time * 6) * 0.18 * (base[i] / 1.9);
    p.needsUpdate = true;
  });
  const s = frame(t, -21.5, -23.5, 0);
  s.sign(['GO FIGHTING POSSUMS!', 'est. probably 1950-something'], { w: 3.4, h: 1.15, px: 40, bg: '#ffffff', fg: '#c11f4f' }, 0, 1.3, 0);
  s.cyl(0x8a5a32, 0.06, 0.06, 1.0, -1.3, 0, -0.02).cyl(0x8a5a32, 0.06, 0.06, 1.0, 1.3, 0, -0.02);
  for (let i = 0; i < 4; i++) b.cyl(C.metal, 0.35, 0.35, 0.08, -11.6 + i * 0.6, 0.35, -30.2, { rz: Math.PI / 2, seg: 10 });
  t.solid(-10.7, -30.2, 2.6, 0.4, 0.8);
  bench(t, -21, -27.5, 0);
  for (const [x, z] of [[-24, -31], [-9, -34], [-9, -45], [-24.5, -47], [-13, -23], [-20, -23]]) bush(t, x, z, 1);
  for (const [x, z] of [[-25, -24], [-8.5, -23.5], [-8, -40]]) tree(t, x, z, 1.1);

  // A school bus that has seen things, parked on School Ave.
  const bus = frame(t, -6.2, -32, Math.PI);
  bus.box(0xffc93a, 2.4, 2.2, 8, 0, 0.45, 0, { outline: 0.06 });
  bus.box(C.window, 2.42, 0.8, 7.2, 0, 1.6, -0.2);
  bus.box(0x2a2a33, 2.42, 0.25, 8.02, 0, 1.05, 0);
  bus.box(0xffc93a, 2.2, 1.1, 1.4, 0, 0.45, 4.6, { outline: 0.05 });
  for (const dz of [-2.6, 2.8]) for (const dx of [-1.15, 1.15]) bus.cyl(0x2a2a33, 0.45, 0.45, 0.3, dx, 0.3, dz, { rz: Math.PI / 2 });
  bus.sign(['SCHOOL BUS'], { w: 3.4, h: 0.5, px: 44, bg: '#ffc93a', border: null }, 0, 1.0, 0, 0);
  bus.solid(2.6, 9.4, 0, 0.4, 2.8);
}
