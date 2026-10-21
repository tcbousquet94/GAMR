// CONSTRUCTION SITE: plywood hoarding, a dug-out foundation pit, a steel frame with partial floors and
// scaffolding, stacked I-beams, a site trailer and a climbable tower crane. Lots of vertical paths.

import { MAT, TAG } from '../kit.js';
import { lotGround, G } from './building.js';
import { perimeter, placeProp } from './common.js';

export function construction(kit, lot) {
  const { rng, pal } = kit;
  const R = lot.rect;
  const alleySides = Object.entries(lot.sides).filter(([, v]) => v === 'alley').map(([k]) => k);
  const depth = 15;
  const I = {
    x0: R.x0 + (lot.sides.w === 'alley' ? depth : 0) + 3, x1: R.x1 - (lot.sides.e === 'alley' ? depth : 0) - 3,
    z0: R.z0 + (lot.sides.n === 'alley' ? depth : 0) + 3, z1: R.z1 - (lot.sides.s === 'alley' ? depth : 0) - 3,
  };
  const west = lot.sides.w === 'street', north = lot.sides.n === 'street';
  // Pit in the street-corner quadrant.
  const PW = 28, PD = 22, pitY = -5;
  const px0 = west ? I.x0 + 4 : I.x1 - 4 - PW, pz0 = north ? I.z0 + 4 : I.z1 - 4 - PD;
  const pit = { x0: px0, z0: pz0, x1: px0 + PW, z1: pz0 + PD };
  lotGround(kit, R, pit, 0x6b5d4c, pitY - 1);
  kit.solid(pit.x0, pitY - 1, pit.z0, pit.x1, pitY, pit.z1, 0x5a4a3a, MAT.STD, TAG.GROUND);
  // Pit walls (visual concrete shoring).
  kit.box(pit.x0, pitY, pit.z0 - 0.05, pit.x1, G, pit.z0 + 0.05, 0x7a7068);
  kit.box(pit.x0, pitY, pit.z1 - 0.05, pit.x1, G, pit.z1 + 0.05, 0x7a7068);
  kit.box(pit.x0 - 0.05, pitY, pit.z0, pit.x0 + 0.05, G, pit.z1, 0x7a7068);
  kit.box(pit.x1 - 0.05, pitY, pit.z0, pit.x1 + 0.05, G, pit.z1, 0x7a7068);
  // Ramp out of the pit along one wall, ladder on the opposite wall.
  kit.ramp(pit.x0 + 1, pit.z1 - 4, pit.x1 - 6, pit.z1, 'x-', pitY, G, 0x6b5d4c, { solidBelow: false, thick: 0.6 });
  kit.solid(pit.x0, pitY, pit.z1 - 4, pit.x0 + 1, G, pit.z1, 0x6b5d4c, MAT.STD, TAG.GROUND);
  kit.climb(pit.x1 - 1.1, pitY, pit.z0 + 3, pit.x1, G + 0.8, pit.z0 + 4.1, 'ladder', 'pit', 'street');
  kit.link('ramp', 'pit', 'street', pit.x0 + 10, pit.z1 - 2);
  for (let k = 0; k < 4; k++) placeProp(kit, rng.chance(0.5) ? 'crate' : 'ibeams', pit.x0 + 4 + rng.next() * (PW - 8), pitY, pit.z0 + 3 + rng.next() * (PD - 10), rng.chance(0.5) ? 0 : Math.PI / 2);
  kit.spawn(pit.x0 + PW / 2, pitY, pit.z0 + PD / 2 - 3, 'pit');
  kit.slot(pit.x0 + 3, pitY, pit.z0 + 3, 0, ['pit']);

  // Plywood hoarding along the street sides, with gaps.
  for (const side of ['n', 's', 'w', 'e']) {
    if (lot.sides[side] !== 'street') continue;
    const alongX = side === 'n' || side === 's';
    const a0 = alongX ? R.x0 : R.z0, a1 = alongX ? R.x1 : R.z1;
    const b = side === 'n' ? R.z0 + 0.5 : side === 's' ? R.z1 - 0.8 : side === 'w' ? R.x0 + 0.5 : R.x1 - 0.8;
    for (let a = a0 + 1; a < a1 - 1; ) {
      const len = Math.min(rng.range(10, 18), a1 - 1 - a);
      if (alongX) kit.solid(a, G, b, a + len, G + 2.4, b + 0.3, pal.plywood, MAT.STD, TAG.PROP);
      else kit.solid(b, G, a, b + 0.3, G + 2.4, a + len, pal.plywood, MAT.STD, TAG.PROP);
      if (rng.chance(0.4)) kit.sign(rng.pick(['POST NO BILLS', 'HARD HAT AREA', 'COMING SOON', 'LUXURY LOFTS']), 'paint', alongX ? a + len / 2 : b + (side === 'w' ? -0.05 : 0.35), G + 1.4, alongX ? b + (side === 'n' ? -0.05 : 0.35) : a + len / 2, 5, 0.9, alongX ? 0 : side === 'w' ? -1 : 1, alongX ? (side === 'n' ? -1 : 1) : 0, 0x2a2830);
      a += len + rng.range(4, 6);
    }
  }
  perimeter(kit, R, alleySides, lot, { depth, heights: [14, 22] });

  // Steel frame in the opposite quadrant.
  const FW = 32, FD = 24;
  const fx0 = west ? I.x1 - FW - 3 : I.x0 + 3, fz0 = north ? I.z1 - FD - 3 : I.z0 + 3;
  const F = { x0: fx0, z0: fz0, x1: fx0 + FW, z1: fz0 + FD };
  const steel = 0x6a5f58;
  for (let x = F.x0; x <= F.x1 + 0.01; x += 8) for (let z = F.z0; z <= F.z1 + 0.01; z += 8) {
    kit.solid(x - 0.3, G, z - 0.3, x + 0.3, 24, z + 0.3, steel, MAT.METAL, TAG.PROP);
  }
  for (const y of [8, 16, 24]) {
    for (let z = F.z0; z <= F.z1 + 0.01; z += 8) kit.solid(F.x0 - 0.3, y - 0.45, z - 0.25, F.x1 + 0.3, y, z + 0.25, steel, MAT.METAL, TAG.PLATFORM);
    for (let x = F.x0; x <= F.x1 + 0.01; x += 8) kit.solid(x - 0.25, y - 0.45, F.z0 - 0.3, x + 0.25, y, F.z1 + 0.3, steel, MAT.METAL, TAG.PLATFORM);
    if (y === 24) continue;
    // Partial concrete decks in some bays.
    for (let bx = 0; bx < 4; bx++) for (let bz = 0; bz < 3; bz++) {
      // The bay row beside the scaffold is always decked at 8m so the frame's shop slot is reachable.
      const besideScaffold = y === 8 && bx === 0 && bz === (north ? 0 : 2);
      if (besideScaffold || rng.chance(y === 8 ? 0.7 : 0.45)) kit.solid(F.x0 + bx * 8, y - 0.3, F.z0 + bz * 8, F.x0 + bx * 8 + 8, y, F.z0 + bz * 8 + 8, 0x7b7680, MAT.STD, TAG.PLATFORM);
    }
  }
  kit.slot(F.x0 + 4, 8, north ? F.z0 + 4 : F.z1 - 4, 0, ['frame']);
  kit.spawn(F.x0 + 12, G, F.z0 + 12, 'site');
  // Scaffolding on the frame face toward the pit.
  const sf = north ? F.z0 - 1.6 : F.z1;
  for (let y = 4; y <= 24; y += 4) {
    kit.solid(F.x0, y - 0.15, sf, F.x1, y, sf + 1.6, 0x8a7350, MAT.STD, TAG.PLATFORM);
    kit.box(F.x0, y + 0.9, north ? sf : sf + 1.5, F.x1, y + 1.0, north ? sf + 0.1 : sf + 1.6, 0xa09060, MAT.METAL);
  }
  for (let x = F.x0; x <= F.x1; x += 4) kit.box(x - 0.06, G, sf - 0.06, x + 0.06, 25, sf + 0.06, 0x9a8a70, MAT.METAL);
  const lx = F.x0 + FW / 2;
  kit.climb(lx, 0, north ? sf - 1.1 : sf + 1.6, lx + 1.1, 24.8, north ? sf : sf + 2.7, 'ladder', 'street', 'roof');
  kit.link('scaffold', 'street', 'mid', lx, sf);

  // Tower crane next to the frame.
  const cx = west ? F.x0 - 5 : F.x1 + 5, cz = (F.z0 + F.z1) / 2;
  const mastTop = 26;
  kit.solid(cx - 1.1, G, cz - 1.1, cx + 1.1, mastTop, cz + 1.1, null, MAT.METAL, TAG.PROP);
  for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.box(cx + ox * 1.05 - 0.1, G, cz + oz * 1.05 - 0.1, cx + ox * 1.05 + 0.1, mastTop, cz + oz * 1.05 + 0.1, 0xb89a3a, MAT.METAL);
  for (let y = G + 1; y < mastTop; y += 2.2) {
    kit.boxC(cx, y + 1.1, cz - 1.05, 2.9, 0.1, 0.1, 0xb89a3a, MAT.METAL, { rz: 0.75 });
    kit.boxC(cx, y + 1.1, cz + 1.05, 2.9, 0.1, 0.1, 0xb89a3a, MAT.METAL, { rz: -0.75 });
  }
  kit.climb(cx - 0.5, 0, cz - 1.1 - 1.0, cx + 0.5, mastTop + 0.8, cz - 1.1, 'ladder', 'street', 'roof');
  kit.solid(cx - 2.5, mastTop - 0.3, cz - 2.5, cx + 2.5, mastTop, cz + 2.5, 0x5a5560, MAT.METAL, TAG.PLATFORM);
  kit.solid(cx - 1.6, mastTop, cz + 0.4, cx + 1.6, mastTop + 2.4, cz + 2.4, 0xb89a3a, MAT.STD, TAG.PROP);
  const dir = west ? 1 : -1;
  const jibY = mastTop + 2.6;
  kit.solid(Math.min(cx, cx + dir * 34), jibY - 0.5, cz - 0.7, Math.max(cx, cx + dir * 34), jibY, cz + 0.7, 0xb89a3a, MAT.METAL, TAG.PLATFORM);
  kit.solid(Math.min(cx, cx - dir * 11), jibY - 0.5, cz - 0.7, Math.max(cx, cx - dir * 11), jibY, cz + 0.7, 0xb89a3a, MAT.METAL, TAG.PLATFORM);
  kit.solid(cx - dir * 11 - 1.5, jibY - 3, cz - 1.2, cx - dir * 11 + 1.5, jibY - 0.5, cz + 1.2, 0x55525a, MAT.STD, TAG.PROP);
  kit.box(cx - 0.1, mastTop, cz - 0.1, cx + 0.1, jibY + 6, cz + 0.1, 0xb89a3a, MAT.METAL);
  kit.boxC(cx + dir * 17, jibY + 3, cz, 34, 0.08, 0.08, 0x8a8a8a, MAT.METAL, { rz: dir * -0.17 });
  kit.light(cx + dir * 34, jibY, cz, 0xff3355, 0, 'beacon');
  // Hook load hanging from the jib.
  kit.box(cx + dir * 22 - 0.04, jibY - 12, cz - 0.04, cx + dir * 22 + 0.04, jibY - 0.5, cz + 0.04, 0x333333, MAT.METAL);
  kit.solid(cx + dir * 22 - 1.5, jibY - 13.2, cz - 0.6, cx + dir * 22 + 1.5, jibY - 12, cz + 0.6, 0x6a5f58, MAT.METAL, TAG.PLATFORM);
  kit.link('crane', 'street', 'roof', cx, cz);

  // Site trailer, I-beam stacks, barriers.
  const tx = west ? I.x0 + 4 : I.x1 - 14, tz = north ? I.z1 - 10 : I.z0 + 4;
  kit.solid(tx, G, tz, tx + 10, G + 3.2, tz + 3.4, 0x8a8478, MAT.STD, TAG.PROP);
  kit.quad(tx + 3, G + 2, north ? tz - 0.03 : tz + 3.43, 1.4, 0.9, 0, north ? -1 : 1, 0x56607a, 0xffd59a);
  kit.slot(tx + 5, G, north ? tz - 1.2 : tz + 4.6, 0, ['site']);
  for (let k = 0; k < 6; k++) {
    const x = I.x0 + 6 + rng.next() * (I.x1 - I.x0 - 12), z = I.z0 + 6 + rng.next() * (I.z1 - I.z0 - 12);
    if (x > pit.x0 - 4 && x < pit.x1 + 4 && z > pit.z0 - 4 && z < pit.z1 + 4) continue;
    if (x > F.x0 - 3 && x < F.x1 + 3 && z > F.z0 - 5 && z < F.z1 + 5) continue;
    if (Math.abs(x - cx) < 4 && Math.abs(z - cz) < 4) continue;
    placeProp(kit, rng.pick(['ibeams', 'ibeams', 'crate', 'barrier']), x, G, z, rng.chance(0.5) ? 0 : Math.PI / 2);
  }
  kit.light(pit.x0 + PW / 2, 5, pit.z0 + PD / 2, 0xfff0c0, 14, 'site');
}
