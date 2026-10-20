import * as THREE from 'three';
import { groundRect } from '../../build.js';
import { C, frame, tree, palm, bench, bush } from './props.js';

// 2. Town Park: north, east of the school. Fountain plaza with four reflecting pools (like the
// reference map), plus the founder statue and Town Hall next door.
export function buildPark(t) {
  const cx = 14, cz = -34;
  groundRect(t.root, C.paving, 24, 2.4, cx, cz, 0.02);
  groundRect(t.root, C.paving, 2.4, 24, cx, cz, 0.02);
  groundRect(t.root, C.pavingDark, 9, 9, cx, cz, 0.019);
  // Reflecting pools
  for (const [dx, dz] of [[-6.2, -6.2], [6.2, -6.2], [-6.2, 6.2], [6.2, 6.2]]) {
    const x = cx + dx, z = cz + dz;
    t.b.box(C.white, 7.4, 0.35, 7.4, x, 0, z, { outline: 0.04 });
    t.water(6.6, 6.6, x, z, 0.36);
    t.solid(x, z, 7.4, 7.4, 0.4);
    palm(t, x + (dx > 0 ? 4.6 : -4.6), z + (dz > 0 ? 4.6 : -4.6), 0.75, 0.15);
  }
  // Tiered fountain
  const b = t.b;
  b.cyl(C.white, 3.0, 3.2, 0.6, cx, 0, cz, { outline: 0.05, seg: 20 });
  t.waterDisc(2.75, cx, cz, 0.61);
  b.cyl(C.white, 0.5, 0.7, 2.2, cx, 0.6, cz, { outline: 0.04 });
  b.cyl(C.white, 1.5, 1.2, 0.35, cx, 2.6, cz, { outline: 0.04, seg: 16 });
  b.cyl(C.white, 0.3, 0.4, 1.2, cx, 2.9, cz);
  const spray = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xcff2ff, transparent: true, opacity: 0.85 }));
  spray.position.set(cx, 4.3, cz);
  t.root.add(spray);
  t.anims.push((time) => { const s = 1 + Math.sin(time * 5) * 0.12; spray.scale.set(s, 1.3 / s, s); });
  t.post(cx, cz, 3.3, 3);

  // The founder, captured forever mid-shrug, greeting people from Main St.
  const st = frame(t, cx, -23.5, 0);
  st.box(0xc9c3b4, 2, 1.2, 2, 0, 0, 0, { outline: 0.05 });
  st.cyl(0xb0aa9a, 0.45, 0.55, 1.4, 0, 1.2, 0, { outline: 0.05 });
  st.sph(0xb0aa9a, 0.55, 0, 3.0, 0, { outline: 0.05 });
  for (const s of [-1, 1]) {
    st.box(0xb0aa9a, 0.9, 0.22, 0.22, s * 0.8, 2.55, 0, { rz: s * 0.5, outline: 0.03 });
    st.box(0xb0aa9a, 0.22, 0.6, 0.22, s * 1.2, 2.75, 0, { outline: 0.03 });
  }
  st.sign(['ELIAS MAPLE, FOUNDER', '"I guess here is fine."'], { w: 1.9, h: 0.75, px: 30, bg: '#d9c9a0' }, 0, 0.6, 1.02);
  st.solid(2.2, 2.2, 0, 0, 3.5);

  for (const [x, z, ry] of [[6, -24.5, 0], [22, -24.5, 0], [3.5, -34, Math.PI / 2], [24.5, -34, -Math.PI / 2]]) bench(t, x, z, ry);
  for (const [x, z] of [[8, -47], [20, -47], [26.5, -30]]) tree(t, x, z, 1.15);
  for (const [x, z] of [[2.5, -28], [2.5, -40], [26, -38]]) bush(t, x, z, 1.1);

  // Town Hall (between the park and Elm St)
  const th = frame(t, 36, -37, 0);
  th.box(C.white, 12, 6.5, 9, 0, 0, 0, { outline: 0.08 });
  th.box(0xd8d0c0, 12.6, 0.6, 9.6, 0, 6.5, 0, { outline: 0.05 });
  th.gable(0xd8d0c0, 8, 1.8, 3, 0, 6.5, 4.0, { ry: Math.PI / 2, outline: 0.05 });
  th.sph(C.teal, 2.2, 0, 7.4, -0.5, { scale: [1, 0.9, 1], outline: 0.06 });
  th.cyl(0xffd23f, 0.08, 0.08, 1.2, 0, 9.2, -0.5);
  for (let i = 0; i < 6; i++) th.cyl(C.white, 0.3, 0.35, 5.6, -4.5 + i * 1.8, 0.5, 5.4, { outline: 0.04 });
  for (let i = 0; i < 3; i++) th.box(C.rock, 11 - i, 0.25, 1, 0, i * 0.25, 6.6 - i * 0.5, { outline: 0.03 });
  th.box(C.door, 1.8, 2.8, 0.2, 0, 0.75, 4.55, { outline: 0.03 });
  th.sign(['TOWN HALL', 'the mayor is out to lunch (since March)'], { w: 6, h: 1.1, px: 50, bg: '#fdf8ec' }, 0, 6.0, 5.6);
  th.solid(12, 9, 0, 0, 9.5);
  th.solid(11, 2.2, 0, 5.3, 6);
  th.door(2.4, 1.2, 0, 7.4, { message: { speaker: '', text: 'A note on the door: "Gone to lunch. Back soon. —The Mayor (March)"' } });
  for (const [x, z] of [[29, -26], [43, -26], [30.5, -46.5], [42, -46.5]]) tree(t, x, z, 1.05);
}
