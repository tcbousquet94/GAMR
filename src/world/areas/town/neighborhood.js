import * as THREE from 'three';
import { groundRect, place } from '../../build.js';
import { C, frame, building, tree, picketFence, bush } from './props.js';

// 4. Pip's neighborhood: south-east, along Shore Rd east of Elm St. North-row houses face south,
// south-row houses face north. Pip's house is the yellow one on the south side.
export function buildNeighborhood(t) {
  const b = t.b;

  // --- South row (fronts face north onto Shore Rd at z = 20.5)
  const pip = building(t, 60, 24, Math.PI, {
    w: 9, d: 7, wall: 0xffd86a, roof: C.roofRed,
    doorTarget: { message: { speaker: 'Mom', text: "(from inside) Pip, honey, you'll be late for homeroom! Scoot! Love you! SCOOT!" } },
  });
  // Pip starts on the sidewalk outside his house, facing west toward downtown and school.
  t.addSpawn('default', 60, 18.6, -Math.PI / 2);
  t.addSpawn('pipHouse', pip.doorPos.x, pip.doorPos.z - 1.2, Math.PI);
  groundRect(t.root, C.path, 1.6, 2.2, 60, 19.6, 0.022);
  picketFence(t, 55.2, 59, 19.2);
  picketFence(t, 61, 64.8, 19.2);
  // Mailbox, plaque, Pip's bike abandoned dramatically on the lawn
  b.cyl(0x8a5a32, 0.07, 0.07, 1.1, 63.8, 0, 19.7);
  b.box(0x3b6fd8, 0.5, 0.42, 0.75, 63.8, 1.05, 19.7, { outline: 0.04 });
  b.box(0xe8423c, 0.06, 0.4, 0.12, 64.05, 1.3, 19.55);
  const pl = frame(t, 56.3, 20.1, Math.PI);
  pl.sign(['THE PIP RESIDENCE', 'no solicitors · no ghosts'], { w: 2.4, h: 0.85, px: 40, bg: '#fff3c4' }, 0, 1.0, 0);
  b.cyl(0x8a5a32, 0.05, 0.05, 0.6, 56.3, 0, 20.12);
  b.cyl(0x2a2a33, 0.35, 0.35, 0.06, 57.3, 0.35, 20.0, { rx: Math.PI / 2, rz: 0.4, seg: 12 });
  b.cyl(0x2a2a33, 0.35, 0.35, 0.06, 58.2, 0.35, 19.8, { rx: Math.PI / 2, rz: 0.4, seg: 12 });

  // Gnome house: forty gnomes, all facing the street. Always.
  building(t, 71, 24, Math.PI, {
    w: 9, d: 7, wall: 0xb8ead0, roof: C.teal,
    doorTarget: { message: { speaker: '', text: 'You knock. Somewhere inside, forty garden gnomes go quiet.' } },
  });
  for (let i = 0; i < 8; i++) {
    const gx = 67 + (i % 4) * 0.9 + (i >= 4 ? 4.6 : 0), gz = 19.8 - (i % 2) * 0.5;
    b.cyl(0x3b6fd8, 0.16, 0.2, 0.35, gx, 0, gz);
    b.sph(0xffd3a8, 0.13, gx, 0.47, gz);
    b.cyl(0xe8423c, 0.0, 0.15, 0.35, gx, 0.55, gz);
    b.sph(C.white, 0.09, gx, 0.38, gz - 0.1);
  }
  frame(t, 74.6, 19.6, Math.PI).sign(['GNOME CROSSING'], { w: 2, h: 0.5, px: 40, bg: '#ffe680' }, 0, 1.0, 0);
  b.cyl(0x8a5a32, 0.05, 0.05, 0.75, 74.6, 0, 19.62);

  // The beige house
  building(t, 82, 24, Math.PI, {
    w: 9, d: 7, wall: 0xe6d8b8, roof: 0xc9b48a, trim: 0xd8caa8, door: 0xc9b48a,
    doorTarget: { message: { speaker: '', text: 'The doorbell plays a single, perfectly average note.' } },
  });
  frame(t, 85.5, 19.7, Math.PI).sign(['THIS HOUSE IS', 'AGGRESSIVELY NORMAL'], { w: 2.4, h: 0.9, px: 38, bg: '#efe4cc' }, 0, 1.05, 0);
  b.cyl(0x8a5a32, 0.05, 0.05, 0.65, 85.5, 0, 19.72);

  // Back hedges between the yards and the beach
  b.box(C.hedge, 34, 1.8, 1.2, 71, 0, 31, { outline: 0.05 });
  t.solid(71, 31, 34, 1.2, 1.8);

  // --- North row (fronts face south onto Shore Rd at z = 7)
  building(t, 59, 3.5, 0, {
    w: 8.5, d: 7, wall: 0xf7b7c8, roof: C.terracotta,
    doorTarget: { message: { speaker: '', text: 'A note on the door: "Practicing the tuba. Please do not encourage me."' } },
  });
  building(t, 69.5, 3.5, 0, {
    w: 8.5, d: 7, h: 5.4, floors: 2, wall: 0xc8b8f0, roof: C.roofRed,
    doorTarget: { message: { speaker: '', text: 'Wind chimes. So many wind chimes. You can barely hear yourself knock.' } },
  });
  // Empty lot with a hole nobody talks about
  const hole = new THREE.Mesh(new THREE.CircleGeometry(2.1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x120a18 }));
  place(t.root, hole, 78.5, 0.03, 2.5);
  const rim = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.6, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8a6a4a }));
  place(t.root, rim, 78.5, 0.025, 2.5);
  t.post(78.5, 2.5, 2.1, 0.3);
  frame(t, 78.5, 6.2, 0).sign(['DO NOT LOOK', 'IN HOLE'], { w: 1.7, h: 0.85, px: 44, bg: '#ffffff', fg: '#c11f4f' }, 0, 1.2, 0);
  b.cyl(0x8a5a32, 0.05, 0.05, 0.8, 78.5, 0, 6.18);
  // Duck pond in the corner (the reference map has one here)
  t.waterDisc(2.6, 85, -3.5, 0.02);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    b.sph(C.rock, 0.55, 85 + Math.cos(a) * 3, 0.1, -3.5 + Math.sin(a) * 3, { scale: [1.2, 0.6, 1], outline: 0.03 });
  }
  t.post(85, -3.5, 3, 0.4);
  const duck = new THREE.Group();
  const db = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshToonMaterial({ color: 0xffd23f }));
  db.scale.set(1, 0.7, 1.3);
  const dh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), db.material);
  dh.position.set(0, 0.3, 0.3);
  duck.add(db, dh);
  t.root.add(duck);
  t.anims.push((time) => {
    const a = time * 0.4;
    duck.position.set(85 + Math.cos(a) * 1.6, 0.12 + Math.sin(time * 3) * 0.03, -3.5 + Math.sin(a) * 1.6);
    duck.rotation.y = -a;
  });

  for (const [x, z] of [[54.5, -8.5], [64.5, -8.5], [74.5, -8.5], [56, 9.3], [66, 9.3], [76, 9.3], [86, 9.3], [55, 19], [66, 19.6], [77.5, 19.6], [87, 19.6]]) {
    if (z > 15) bush(t, x, z, 0.9);
    else tree(t, x, z, z < 0 ? 1.2 : 0.95);
  }
  for (const [x, z] of [[54, 29], [88, 29]]) tree(t, x, z, 1.1);
}
