// TOWER BASE: a glass lobby you can walk into (revolving-door openings, reception desk, mezzanine with stairs),
// an exterior skybridge at mid-level to a neighbouring annex, a podium roof, and a glass tower rising above it.

import { MAT, TAG } from '../kit.js';
import { lotGround, building, fireEscape, G } from './building.js';
import { perimeter, towerOnPodium, placeProp, planterTree, lowWall } from './common.js';

const MEZZ = 7;

export function tower(kit, lot) {
  const { rng, pal } = kit;
  const R = lot.rect;
  lotGround(kit, R);
  const alleySides = Object.entries(lot.sides).filter(([, v]) => v === 'alley').map(([k]) => k);
  const per = perimeter(kit, R, alleySides, lot, { depth: 15, heights: [15, 24] });
  // Podium at the street corner.
  const PW = 42, PD = 36;
  const west = lot.sides.w === 'street', north = lot.sides.n === 'street';
  const px = west ? R.x0 + 3 : R.x1 - 3 - PW;
  const pz = north ? R.z0 + 3 : R.z1 - 3 - PD;
  const P = { x0: px, z0: pz, x1: px + PW, z1: pz + PD };
  const podH = Math.round(rng.range(17, 22));
  const lobbyH = 12;
  const wallT = 0.5;
  const fz = north ? 'n' : 's', fx = west ? 'w' : 'e';
  const stone = 0x7a7680;
  // Lobby shell: glass on the two street faces (with door openings), stone on the back faces.
  const glass = 0x6f9ac8;
  const doorW = 4.5;
  const zf = north ? P.z0 : P.z1 - wallT;
  const doorsZ = [P.x0 + PW * 0.3, P.x0 + PW * 0.7];
  wallWithDoors(kit, 'x', P.x0, P.x1, zf, zf + wallT, lobbyH, doorsZ, doorW, glass, MAT.GLASS);
  const xf = west ? P.x0 : P.x1 - wallT;
  wallWithDoors(kit, 'z', P.z0, P.z1, xf, xf + wallT, lobbyH, [P.z0 + PD * 0.5], doorW, glass, MAT.GLASS);
  // Mullions for the glass.
  for (let x = P.x0; x <= P.x1; x += 3) kit.box(x - 0.08, G, zf - 0.05, x + 0.08, lobbyH, zf + wallT + 0.05, pal.metal, MAT.METAL);
  for (let z = P.z0; z <= P.z1; z += 3) kit.box(xf - 0.05, G, z - 0.08, xf + wallT + 0.05, lobbyH, z + 0.08, pal.metal, MAT.METAL);
  // Back walls (stone). The side wall facing the annex gets an opening at mezzanine level for the skybridge.
  const zb = north ? P.z1 - wallT : P.z0;
  const xb = west ? P.x1 - wallT : P.x0;
  kit.solid(P.x0, G, zb, P.x1, lobbyH, zb + wallT, stone, MAT.STD, TAG.BUILDING);
  const mz0 = north ? P.z1 - wallT - 7 : P.z0 + wallT, mz1 = mz0 + 7;
  const bridgeZ = (mz0 + mz1) / 2; // the skybridge leaves from the mezzanine
  kit.solid(xb, G, P.z0, xb + wallT, MEZZ, P.z1, stone, MAT.STD, TAG.BUILDING);
  kit.solid(xb, MEZZ, P.z0, xb + wallT, lobbyH, bridgeZ - 2.5, stone, MAT.STD, TAG.BUILDING);
  kit.solid(xb, MEZZ, bridgeZ + 2.5, xb + wallT, lobbyH, P.z1, stone, MAT.STD, TAG.BUILDING);
  kit.solid(xb, MEZZ + 3.2, bridgeZ - 2.5, xb + wallT, lobbyH, bridgeZ + 2.5, stone, MAT.STD, TAG.BUILDING);
  // Ceiling + upper podium floors + roof, tower above.
  kit.solid(P.x0, lobbyH, P.z0, P.x1, podH, P.z1, 0x6d6a74, MAT.STD, TAG.BUILDING);
  kit.box(P.x0 - 0.3, lobbyH, P.z0 - 0.3, P.x1 + 0.3, lobbyH + 0.8, P.z1 + 0.3, 0x8f8a96);
  towerOnPodium(kit, P, podH, lot.landmark ? rng.range(150, 170) : rng.range(48, 92), { skipPodium: true, signFace: fz, landmark: lot.landmark });
  // Podium upper windows (lit offices) on all faces.
  for (const [f, L] of [['x', zf], ['x', zb], ['z', xf], ['z', xb]]) {
    for (let y = lobbyH + 1.5; y < podH - 1; y += 3.5) {
      const n = f === 'x' ? Math.floor(PW / 3.4) : Math.floor(PD / 3.4);
      for (let i = 0; i < n; i++) {
        const lit = rng.chance(0.55);
        const nx = f === 'z' ? (L === xf ? (west ? -1 : 1) : (west ? 1 : -1)) : 0;
        const nz = f === 'x' ? (L === zf ? (north ? -1 : 1) : (north ? 1 : -1)) : 0;
        const along = (i + 0.5) * 3.4;
        const x = f === 'x' ? P.x0 + along : (nx < 0 ? P.x0 - 0.03 : P.x1 + 0.03);
        const z = f === 'z' ? P.z0 + along : (nz < 0 ? P.z0 - 0.03 : P.z1 + 0.03);
        kit.quad(x, y + 1, z, 2.4, 2, nx, nz, rng.pick(pal.windowDay), lit ? rng.pick(pal.windowNight) : pal.windowDark);
      }
    }
  }
  // Roof access: fire escape on the back of the podium. The podium roof ring is a sniper perch.
  kit.spawn(P.x0 + 3, podH, P.z0 + 3, 'roof');
  kit.slot(P.x1 - 3, podH, P.z1 - 3, 0, ['roof']);
  fireEscape(kit, P, north ? 's' : 'n', podH, 4);
  // Lobby interior: floor, reception desk, columns, planters, mezzanine with stairs.
  kit.box(P.x0 + wallT, G, P.z0 + wallT, P.x1 - wallT, G + 0.02, P.z1 - wallT, 0xa8a2a8);
  const cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
  kit.solid(cx - 5, G, cz - 1, cx + 5, G + 1.15, cz + 1, 0x4a4652, MAT.STD, TAG.PROP);
  kit.box(cx - 5.1, G + 1.1, cz - 1.1, cx + 5.1, G + 1.2, cz + 1.1, 0xc8c0b8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.solid(cx + sx * 12 - 0.6, G, cz + sz * 8 - 0.6, cx + sx * 12 + 0.6, lobbyH, cz + sz * 8 + 0.6, 0x8a8590, MAT.STD, TAG.PROP);
  planterTree(kit, cx + 7, cz + (north ? -6 : 6));
  planterTree(kit, cx - 7, cz + (north ? -6 : 6));
  // Mezzanine along the back wall.
  kit.solid(P.x0 + wallT, MEZZ - 0.4, mz0, P.x1 - wallT, MEZZ, mz1, 0x7a7680, MAT.STD, TAG.PLATFORM);
  const railZ = north ? mz0 : mz1 - 0.2;
  kit.box(P.x0 + wallT, MEZZ, railZ, P.x1 - wallT, MEZZ + 1.0, railZ + 0.2, glass, MAT.GLASS);
  kit.collider(P.x0 + wallT + 8, MEZZ, railZ, P.x1 - wallT, MEZZ + 0.5, railZ + 0.2, TAG.RAIL);
  // Stairs up to the mezzanine, along the front-side wall.
  const sx0 = west ? P.x0 + wallT + 0.2 : P.x1 - wallT - 4.2;
  if (north) kit.ramp(sx0, mz0 - 17, sx0 + 4, mz0, 'z+', G, MEZZ, 0x8a8590, { solidBelow: true });
  else kit.ramp(sx0, mz1, sx0 + 4, mz1 + 17, 'z-', G, MEZZ, 0x8a8590, { solidBelow: true });
  kit.link('stairs', 'street', 'mid', sx0 + 2, cz);
  kit.slot(cx, MEZZ, (mz0 + mz1) / 2, north ? Math.PI : 0, ['wall', 'lobby']);
  kit.slot(cx + 10, G, north ? P.z1 - 2 : P.z0 + 2, north ? Math.PI : 0, ['wall', 'lobby']);
  kit.slot(cx - 10, G, north ? P.z1 - 2 : P.z0 + 2, north ? Math.PI : 0, ['wall', 'lobby']);
  kit.light(cx, lobbyH - 1, cz, 0xfff2d8, 18, 'lobby');
  // Revolving doors: drum visuals + spawn points just inside.
  for (const dx of doorsZ) {
    kit.prop('revolvingdoor', dx, G, zf + wallT / 2, 0);
    kit.spawn(dx, G, north ? zf + 3 : zf - 3, 'door');
  }
  // Annex across the courtyard, linked by the skybridge at mezzanine level.
  const AW = 22;
  const ax0 = west ? P.x1 + 10 : P.x0 - 10 - AW;
  const A = { x0: ax0, z0: P.z0 + 2, x1: ax0 + AW, z1: P.z1 - 2 };
  const ah = Math.round(rng.range(15, 22));
  const clash = per.buildings.some((b) => A.x0 < b.r.x1 && A.x1 > b.r.x0 && A.z0 < b.r.z1 && A.z1 > b.r.z0);
  if (!clash) {
    building(kit, A, ah, { fireEscape: [north ? 's' : 'n'], storefront: north ? ['n'] : ['s'] });
    // Balcony on the annex at bridge level, then the bridge itself.
    const bx0 = west ? xb + wallT : A.x1, bx1 = west ? A.x0 : xb;
    kit.solid(bx0, MEZZ - 0.4, bridgeZ - 2.2, bx1, MEZZ, bridgeZ + 2.2, 0x6f6c78, MAT.STD, TAG.PLATFORM);
    kit.box(bx0, MEZZ, bridgeZ - 2.2, bx1, MEZZ + 2.9, bridgeZ - 2.0, glass, MAT.GLASS);
    kit.box(bx0, MEZZ, bridgeZ + 2.0, bx1, MEZZ + 2.9, bridgeZ + 2.2, glass, MAT.GLASS);
    kit.box(bx0, MEZZ + 2.9, bridgeZ - 2.3, bx1, MEZZ + 3.2, bridgeZ + 2.3, pal.metal, MAT.METAL);
    // Balcony wrapping the annex face so the bridge lands somewhere useful, with a ladder to its roof.
    const face = west ? A.x0 : A.x1;
    const b0 = west ? face - 3 : face, b1 = west ? face : face + 3;
    kit.solid(b0, MEZZ - 0.3, A.z0, b1, MEZZ, A.z1, 0x6f6c78, MAT.STD, TAG.PLATFORM);
    const lz = A.z1 - 3;
    kit.climb(west ? face - 1.1 : face, MEZZ, lz, west ? face : face + 1.1, ah + 0.7, lz + 1.1, 'ladder', 'mid', 'roof');
    kit.link('skybridge', 'mid', 'mid', (bx0 + bx1) / 2, bridgeZ);
    kit.spawn((A.x0 + A.x1) / 2, ah, (A.z0 + A.z1) / 2, 'roof');
  }
  // Courtyard clutter between podium and annex.
  for (let k = 0; k < 3; k++) {
    const x = west ? P.x1 + 3 + rng.next() * 5 : P.x0 - 8 + rng.next() * 5;
    const z = P.z0 + 4 + rng.next() * (PD - 8);
    if (rng.chance(0.5)) placeProp(kit, 'bench', x, G, z, 0); else lowWall(kit, x - 0.3, z - 2, x + 0.3, z + 2);
  }
  kit.slot(west ? P.x1 + 5 : P.x0 - 5, G, P.z1 + (north ? 4 : -4), 0, ['plaza']);
}

// Wall along an axis with door openings (gaps) at the given centers.
function wallWithDoors(kit, axis, a0, a1, b0, b1, h, doors, dw, color, mat) {
  let a = a0;
  const cuts = doors.slice().sort((p, q) => p - q);
  for (const d of cuts) {
    const s = d - dw / 2;
    if (s > a) seg(a, s);
    a = d + dw / 2;
  }
  if (a < a1) seg(a, a1);
  // Lintels above the doors.
  for (const d of cuts) {
    if (axis === 'x') kit.solid(d - dw / 2, G + 3.4, b0, d + dw / 2, h, b1, color, mat, TAG.BUILDING);
    else kit.solid(b0, G + 3.4, d - dw / 2, b1, h, d + dw / 2, color, mat, TAG.BUILDING);
  }
  function seg(s, e) {
    if (axis === 'x') kit.solid(s, G, b0, e, h, b1, color, mat, TAG.BUILDING);
    else kit.solid(b0, G, s, b1, h, e, color, mat, TAG.BUILDING);
  }
}
