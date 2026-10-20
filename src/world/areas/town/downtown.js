import * as THREE from 'three';
import { groundRect } from '../../build.js';
import { C, frame, building, tree, bench, bush } from './props.js';

// 3. Downtown: a paved plaza between Main St and Shore Rd with shops on three sides and a fountain.
export function buildDowntown(t) {
  groundRect(t.root, C.paving, 38, 19.5, 23, -0.25, 0.018);
  for (let x = 6; x < 41; x += 4) groundRect(t.root, C.pavingDark, 0.2, 19.5, x, -0.25, 0.019);

  // South row, fronts face north onto the plaza
  building(t, 12.5, 5.6, Math.PI, {
    w: 9, d: 6.5, h: 5.6, floors: 2, wall: 0x9fd8f0, roof: C.terracotta, sign: ['SUDS CITY', 'home of the missing sock'],
    awning: [C.teal, C.white],
    doorTarget: { message: { speaker: '', text: 'One dryer inside is tumbling a single sock. A sign says it has been running since 1987.' } },
  });
  building(t, 23.5, 5.6, Math.PI, {
    w: 9, d: 6.5, h: 5.6, floors: 2, wall: 0xffe9a8, roof: C.roofRed, sign: ['BURGER BARN', 'home of the Regret Burger'],
    awning: [C.roofRed, 0xffd23f],
    doorTarget: { message: { speaker: '', text: 'The smell of fries hits you like a warm hug from a stranger. The door says OPENS AT 11.' } },
  });
  building(t, 34.5, 5.6, Math.PI, {
    w: 9, d: 6.5, h: 5.6, floors: 2, wall: 0xc8b8f0, roof: C.terracotta, sign: ['BOOKS & BAIT', 'read a worm, catch a book'],
    awning: [0x7b5fd1, C.white],
    doorTarget: { message: { speaker: '', text: 'Locked. A cat in the window is reading a mystery novel. It looks up, unimpressed.' } },
  });
  // West side: Roxy's, front faces east
  building(t, 7.6, -4.5, Math.PI / 2, {
    w: 8, d: 6.5, h: 4.8, wall: 0xf7b7c8, roof: C.roofRed, roofType: 'flat', sign: ["ROXY'S MART", 'we have ice'],
    awning: [C.roofRed, C.white],
    doorTarget: { message: { speaker: '', text: 'CLOSED FOR "INVENTORY." You can hear someone inside playing the same guitar chord over and over.' } },
  });
  // East side: the bank, front faces west
  building(t, 38.6, -4.5, -Math.PI / 2, {
    w: 8, d: 6.5, h: 5.6, floors: 2, wall: 0xe6e0d0, roof: C.teal, roofType: 'flat', sign: ['MAPLEWOOD BANK', '& TRUST (mostly trust)'],
    signOpts: { bg: '#2a3a6a', fg: '#ffe680' },
    doorTarget: { message: { speaker: '', text: 'The bank opens at 9. A sign reads: "We believe in you. Financially, we\'re still deciding."' } },
  });

  // Fountain: a big chunky basin with a goofy fish spitting water
  const f = frame(t, 23, -4.5, 0);
  f.cyl(C.white, 3.2, 3.4, 0.7, 0, 0, 0, { seg: 20, outline: 0.05 });
  t.waterDisc(2.95, 23, -4.5, 0.71);
  f.cyl(C.white, 0.6, 0.8, 1.4, 0, 0.7, 0, { outline: 0.04 });
  f.sph(0xff8a3a, 0.9, 0, 2.6, 0, { scale: [1, 0.8, 1.5], outline: 0.05 });
  f.sph(0xff8a3a, 0.45, 0, 2.6, -1.4, { scale: [0.3, 1.2, 1], outline: 0.04 });
  f.sph(0xffffff, 0.18, 0.5, 2.85, 0.75);
  f.sph(0x1a1020, 0.09, 0.62, 2.88, 0.8);
  f.post(0, 0, 3.4, 3);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 1.6, 6).translate(0, 0.8, 0), new THREE.MeshBasicMaterial({ color: 0xcff2ff }));
  jet.position.set(23, 2.6, -4.5 + 1.3);
  jet.rotation.x = 1.0;
  t.root.add(jet);
  t.anims.push((time) => { jet.scale.y = 1 + Math.sin(time * 7) * 0.15; });

  // Cafe tables with umbrellas, benches, planters
  for (const [x, z, col] of [[15, -7.5, 0xff8a3a], [15, -2.5, C.teal], [31, -7.5, 0xff5f9e], [31, -2.5, 0xffd23f]]) {
    t.b.cyl(C.white, 0.5, 0.5, 0.08, x, 0.75, z, { seg: 12 });
    t.b.cyl(C.pole, 0.05, 0.05, 2.3, x, 0, z);
    t.b.cyl(col, 0.05, 1.3, 0.6, x, 2.1, z, { seg: 8, outline: 0.04 });
    t.post(x, z, 0.6, 1);
  }
  bench(t, 18, 0.6, Math.PI);
  bench(t, 28, 0.6, Math.PI);
  for (const [x, z] of [[11, -9], [35, -9], [5.5, 1.5], [40.5, 1.5]]) bush(t, x, z, 0.9);
  tree(t, 5, -9.2, 0.9);
  tree(t, 41.5, -9.2, 0.9);

  // Bus stop on Main St that the bus has heard about but never visited.
  const bs = frame(t, 34, -11.1, 0);
  bs.box(C.teal, 4, 0.18, 1.6, 0, 2.5, 0, { outline: 0.04 });
  bs.box(C.window, 4, 2.3, 0.1, 0, 0.2, 0.75);
  bs.box(0x8a5a32, 3, 0.15, 0.55, 0, 0.55, 0.4);
  bs.solid(4, 0.6, 0, 0.6, 2.6);
  bs.sign(['BUS STOP', 'bus comes thursdays. sometimes.'], { w: 1.8, h: 0.9, px: 38, bg: '#ffffff', fg: '#3b6fd8' }, 2.6, 1.9, 0.1, Math.PI);

  // Maplewood Public Library (between the river and downtown), front faces Main St.
  building(t, -12, -3.5, Math.PI, {
    w: 12, d: 8, h: 5.2, floors: 2, wall: 0xd9e8c8, roof: C.teal, roofType: 'hip', roofH: 2.2,
    sign: ['PUBLIC LIBRARY', 'shhh (this means you, Moose)'], signOpts: { bg: '#2f5f4a', fg: '#fdf8ec' },
    doorTarget: { message: { speaker: '', text: 'The library opens at 10. A sign says LATE FEES FORGIVEN, then in smaller letters, NOT FORGOTTEN.' } },
  });
  for (const [x, z] of [[-22, -7], [-2, -7], [-22, 4], [-2, 4], [-12, 6.5]]) tree(t, x, z, 1.05);
}
