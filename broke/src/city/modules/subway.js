// SUBWAY ENTRANCE (exit): a sunken plaza with wide stairs down to a lit station entrance and the call panel.
// The surrounding lot stays open for the boss fight, with cover, a raised terrace and two low roofs for high ground.

import { MAT, TAG } from '../kit.js';
import { lotGround, building, G } from './building.js';
import { perimeter, placeProp, planterTree, lowWall } from './common.js';
import { stationName } from '../names.js';

const PIT = -4;

export function subway(kit, lot) {
  const { rng, pal } = kit;
  const R = lot.rect;
  const alleySides = Object.entries(lot.sides).filter(([, v]) => v === 'alley').map(([k]) => k);
  const depth = 15;
  const I = {
    x0: R.x0 + (lot.sides.w === 'alley' ? depth : 0), x1: R.x1 - (lot.sides.e === 'alley' ? depth : 0),
    z0: R.z0 + (lot.sides.n === 'alley' ? depth : 0), z1: R.z1 - (lot.sides.s === 'alley' ? depth : 0),
  };
  const cx = (I.x0 + I.x1) / 2, cz = (I.z0 + I.z1) / 2;
  const PW = 40, PD = 30;
  const P = { x0: cx - PW / 2, z0: cz - PD / 2, x1: cx + PW / 2, z1: cz + PD / 2 };
  lotGround(kit, R, P, 0x67636e, PIT - 1.5);
  kit.solid(P.x0, PIT - 1, P.z0, P.x1, PIT, P.z1, 0x5d5a64, MAT.STD, TAG.GROUND);
  // Tile pattern on the pit floor.
  for (let x = P.x0; x < P.x1; x += 4) for (let z = P.z0; z < P.z1; z += 4) if ((((x - P.x0) / 4) + ((z - P.z0) / 4)) % 2 === 0) kit.box(x, PIT, z, x + 4, PIT + 0.015, z + 4, 0x6c6874);
  // Retaining walls (visual) with a lighter coping.
  kit.box(P.x0, PIT, P.z0 - 0.05, P.x1, G, P.z0 + 0.05, 0x7a7680);
  kit.box(P.x0, PIT, P.z1 - 0.05, P.x1, G, P.z1 + 0.05, 0x7a7680);
  kit.box(P.x0 - 0.05, PIT, P.z0, P.x0 + 0.05, G, P.z1, 0x7a7680);
  kit.box(P.x1 - 0.05, PIT, P.z0, P.x1 + 0.05, G, P.z1, 0x7a7680);
  perimeter(kit, R, alleySides, lot, { depth, heights: [15, 22] });

  // The station entrance is in the east wall (the far side from the spawn). It glows when the train is near.
  const doorZ = cz;
  kit.box(P.x1 - 0.2, PIT, doorZ - 6, P.x1 + 0.6, PIT + 4.6, doorZ + 6, 0x4a4652);
  kit.quad(P.x1 - 0.25, PIT + 1.9, doorZ, 7, 3.6, -1, 0, 0x3a3f55, 0xfff1c8);
  kit.box(P.x1 - 0.6, PIT + 4.6, doorZ - 7, P.x1 + 0.6, PIT + 5.2, doorZ + 7, 0x8a8590);
  kit.sign(stationName(rng), 'station', P.x1 - 0.65, PIT + 5.9, doorZ, 12, 1.3, -1, 0, 0x33e0ff);
  // Station pylon: a tall lit totem on the spawn-facing corner of the pit, so the station reads from blocks away.
  const tx0 = P.x0 - 4, tz0 = P.z0 - 4;
  kit.solid(tx0 - 0.35, G, tz0 - 0.35, tx0 + 0.35, G + 9, tz0 + 0.35, 0x3a3d48, MAT.METAL, TAG.PROP);
  kit.box(tx0 - 0.6, G + 9, tz0 - 1.6, tx0 + 0.6, G + 13.5, tz0 + 1.6, 0x1f6a4a);
  for (const [nx, nz, dx, dz] of [[-1, 0, -0.62, 0], [1, 0, 0.62, 0]]) kit.sign('SUBWAY', 'wayfind', tx0 + dx, G + 11.25, tz0 + dz, 2.9, 4.2, nx, nz, 0xffffff);
  kit.box(tx0 - 1.6, G + 9, tz0 - 0.6, tx0 + 1.6, G + 13.5, tz0 + 0.6, 0x1f6a4a);
  for (const [nx, nz, dx, dz] of [[0, -1, 0, -0.62], [0, 1, 0, 0.62]]) kit.sign('SUBWAY', 'wayfind', tx0 + dx, G + 11.25, tz0 + dz, 2.9, 4.2, nx, nz, 0xffffff);
  kit.light(tx0, G + 14.3, tz0, 0x3cff9a, 0, 'totem');
  // Canopy over the entrance at street level.
  kit.solid(P.x1 - 6, G + 4.2, doorZ - 8, P.x1 + 4, G + 4.5, doorZ + 8, 0x3a3842, MAT.METAL, TAG.PLATFORM);
  kit.box(P.x1 - 6, G + 4.5, doorZ - 8, P.x1 + 4, G + 4.55, doorZ + 8, 0x7fa4c8, MAT.GLASS);
  for (const s of [-1, 1]) kit.solid(P.x1 + 3.4, G, doorZ + s * 7.4 - 0.3, P.x1 + 4, G + 4.2, doorZ + s * 7.4 + 0.3, pal.metal, MAT.METAL, TAG.PROP);
  kit.light(P.x1 - 2, PIT + 3.5, doorZ, 0xfff1c8, 16, 'station');
  kit.light(P.x1 - 1, G + 6.5, doorZ, 0x33e0ff, 10, 'station');
  // Call panel next to the doors.
  kit.slot(P.x1 - 1.2, PIT, doorZ + 5, -Math.PI / 2, ['force', 'callpanel']);
  kit.exit = {
    panel: { x: P.x1 - 1.2, y: PIT, z: doorZ + 5 },
    board: { x0: P.x1 - 4, z0: doorZ - 3.5, x1: P.x1 - 0.3, z1: doorZ + 3.5, y: PIT },
    door: { x: P.x1 - 0.25, y: PIT + 1.9, z: doorZ, nx: -1, nz: 0 },
    center: { x: cx, y: G, z: cz },
    bossSpawn: { x: cx - 14, y: G, z: P.z0 - 8 },
    pit: P,
  };
  // Wide stairs down from the north and south edges, a ladder on the west wall.
  kit.ramp(cx - 5, P.z0, cx + 5, P.z0 + 12, 'z-', PIT, G, 0x77737e, { solidBelow: true });
  kit.ramp(cx - 5, P.z1 - 12, cx + 5, P.z1, 'z+', PIT, G, 0x77737e, { solidBelow: true });
  kit.ramp(P.x0, cz - 4, P.x0 + 12, cz + 4, 'x-', PIT, G, 0x77737e, { solidBelow: true });
  kit.link('stairs', 'pit', 'street', cx, P.z0);
  kit.link('stairs', 'pit', 'street', cx, P.z1);
  kit.link('stairs', 'pit', 'street', P.x0, cz);
  // Railings around the pit edge, open at the stairs.
  const rail = 0x8a8590;
  for (let x = P.x0; x < P.x1; x += 8) {
    if (x + 8 > cx - 5 && x < cx + 5) continue;
    lowWall(kit, x, P.z0 - 0.4, Math.min(x + 6.5, P.x1), P.z0, 1.0, rail);
    lowWall(kit, x, P.z1, Math.min(x + 6.5, P.x1), P.z1 + 0.4, 1.0, rail);
  }
  for (let z = P.z0; z < P.z1; z += 7) {
    if (z + 7 > cz - 4 && z < cz + 4) continue;
    lowWall(kit, P.x0 - 0.4, z, P.x0, Math.min(z + 5.5, P.z1), 1.0, rail);
  }
  // Cover in the pit: planters and pillars.
  for (const [ox, oz] of [[-12, -7], [-12, 7], [4, -8], [4, 8], [-4, 0]]) {
    if (rng.chance(0.6)) planterTree(kit, cx + ox, cz + oz, PIT);
    else kit.solid(cx + ox - 0.7, PIT, cz + oz - 0.7, cx + ox + 0.7, PIT + 3.5, cz + oz + 0.7, 0x7a7680, MAT.STD, TAG.PROP);
  }
  kit.slot(P.x0 + 14, PIT, P.z0 + 2, 0, ['pit']);
  kit.slot(P.x0 + 14, PIT, P.z1 - 2, Math.PI, ['pit']);
  // Around the pit: open ground with cover, a terrace and two low buildings for high ground.
  const tx = I.x0 + 4, tz = I.z0 + 4;
  kit.solid(tx, G, tz, tx + 14, G + 3, tz + 10, 0x6d6874, MAT.STD, TAG.PLATFORM);
  kit.ramp(tx + 14, tz + 2, tx + 22, tz + 6, 'x-', G, G + 3, 0x77727e, { solidBelow: true });
  kit.link('stairs', 'street', 'terrace', tx + 18, tz + 4);
  planterTree(kit, tx + 3, tz + 7, G + 3);
  for (const [bx, bz] of [[I.x0 + 4, I.z1 - 18], [I.x1 - 18, I.z0 + 4]]) {
    if (bx < I.x0 || bz < I.z0) continue;
    const r = { x0: bx, z0: bz, x1: bx + 13, z1: bz + 13 };
    if (r.x1 > P.x0 - 3 && r.x0 < P.x1 + 6 && r.z1 > P.z0 - 3 && r.z0 < P.z1 + 3) continue;
    building(kit, r, 8, { style: 'concrete', fireEscape: [rng.pick(['n', 's', 'w', 'e'])], storefront: [] });
  }
  for (let k = 0; k < 12; k++) {
    const x = I.x0 + 4 + rng.next() * (I.x1 - I.x0 - 8), z = I.z0 + 4 + rng.next() * (I.z1 - I.z0 - 8);
    if (x > P.x0 - 4 && x < P.x1 + 6 && z > P.z0 - 4 && z < P.z1 + 4) continue;
    const t = rng.next();
    if (t < 0.35) planterTree(kit, x, z);
    else if (t < 0.6) lowWall(kit, x - 2.5, z - 0.3, x + 2.5, z + 0.3);
    else if (t < 0.8) placeProp(kit, 'bench', x, G, z, rng.chance(0.5) ? 0 : Math.PI / 2);
    else placeProp(kit, 'kiosk', x, G, z);
    if (rng.chance(0.35)) kit.slot(x + 2, G, z + 2, 0, ['plaza']);
  }
  kit.spawn(cx - 18, G, P.z0 - 6, 'plaza');
  kit.spawn(cx + 18, G, P.z1 + 6, 'plaza');
  kit.spawn(cx - 22, G, cz, 'plaza');
  for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.light(cx + ox * (PW / 2 + 3), G + 5, cz + oz * (PD / 2 + 3), 0xffb36a, 10, 'plaza');
}
