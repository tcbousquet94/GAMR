// FINANCIAL PLAZA: open square with a fountain, planters, benches, raised terraces and a sculpture for cover,
// framed by tower bases on the alley sides. Built for big fights.

import { MAT, TAG } from '../kit.js';
import { lotGround, G } from './building.js';
import { perimeter, towerOnPodium, planterTree, lowWall, placeProp } from './common.js';

export function plaza(kit, lot) {
  const { rng, pal } = kit;
  const R = lot.rect;
  lotGround(kit, R, null, 0x6a6672);
  // Tower bases on the alley sides; the plaza opens to the streets.
  const alleySides = Object.entries(lot.sides).filter(([, v]) => v === 'alley').map(([k]) => k);
  const depth = 22;
  const per = perimeter(kit, R, alleySides, lot, { depth, heights: [17, 24], gapChance: 0.2 });
  // Upgrade the biggest perimeter building into a glass tower behind its podium roof.
  const big = per.buildings.slice().sort((a, b) => area(b.r) - area(a.r))[0];
  if (big) {
    towerOnPodium(kit, shrink(big.r, 1), big.h, rng.range(55, 90), { skipPodium: true, signFace: alleySides.includes('n') ? 's' : 'n' });
  }
  // Interior square.
  const I = {
    x0: R.x0 + (lot.sides.w === 'alley' ? depth : 0) + 4, x1: R.x1 - (lot.sides.e === 'alley' ? depth : 0) - 4,
    z0: R.z0 + (lot.sides.n === 'alley' ? depth : 0) + 4, z1: R.z1 - (lot.sides.s === 'alley' ? depth : 0) - 4,
  };
  const cx = (I.x0 + I.x1) / 2, cz = (I.z0 + I.z1) / 2;
  // Paving pattern.
  for (let x = I.x0; x < I.x1; x += 8) for (let z = I.z0; z < I.z1; z += 8) {
    if (((x / 8) | 0) % 2 === ((z / 8) | 0) % 2) kit.box(x, G, z, Math.min(x + 8, I.x1), G + 0.015, Math.min(z + 8, I.z1), 0x76717c);
  }
  // Fountain: square basin ring, water, central faceted spire.
  const fr = 7;
  kit.solid(cx - fr, G, cz - fr, cx + fr, G + 0.9, cz - fr + 0.6, 0x8a8590, MAT.STD, TAG.PROP);
  kit.solid(cx - fr, G, cz + fr - 0.6, cx + fr, G + 0.9, cz + fr, 0x8a8590, MAT.STD, TAG.PROP);
  kit.solid(cx - fr, G, cz - fr + 0.6, cx - fr + 0.6, G + 0.9, cz + fr - 0.6, 0x8a8590, MAT.STD, TAG.PROP);
  kit.solid(cx + fr - 0.6, G, cz - fr + 0.6, cx + fr, G + 0.9, cz + fr - 0.6, 0x8a8590, MAT.STD, TAG.PROP);
  kit.box(cx - fr + 0.6, G, cz - fr + 0.6, cx + fr - 0.6, G + 0.55, cz + fr - 0.6, pal.water, MAT.GLOW, { night: 0x2a5a8a });
  kit.solid(cx - 1.2, G, cz - 1.2, cx + 1.2, G + 2.2, cz + 1.2, 0x8a8590, MAT.STD, TAG.PROP);
  kit.boxC(cx, G + 3.6, cz, 1.6, 2.8, 1.6, 0x9a96a0, MAT.STD, { ry: Math.PI / 4, rx: 0.4 });
  kit.light(cx, G + 1, cz, 0x66ccff, 10, 'fountain');
  // Sculpture: stacked tilted slabs.
  const sx = cx + (rng.chance(0.5) ? 1 : -1) * (I.x1 - I.x0) * 0.28, sz = cz + (rng.chance(0.5) ? 1 : -1) * (I.z1 - I.z0) * 0.28;
  kit.solid(sx - 2, G, sz - 2, sx + 2, G + 1.2, sz + 2, 0x55525c, MAT.STD, TAG.PROP);
  kit.collider(sx - 1.2, G + 1.2, sz - 1.2, sx + 1.2, G + 5.5, sz + 1.2, TAG.PROP);
  kit.boxC(sx, G + 2.6, sz, 2.4, 2.4, 2.4, 0x7a5a48, MAT.STD, { ry: 0.6, rx: 0.5 });
  kit.boxC(sx, G + 4.6, sz, 1.8, 1.8, 1.8, 0x8a6a50, MAT.STD, { ry: 1.2, rz: 0.6 });
  // Raised terraces for high ground (step up with stairs).
  for (let k = 0; k < 2; k++) {
    const tx = k === 0 ? I.x0 + 2 : I.x1 - 16, tz = rng.chance(0.5) ? I.z0 + 2 : I.z1 - 12;
    kit.solid(tx, G, tz, tx + 14, G + 2.4, tz + 10, 0x6d6874, MAT.STD, TAG.PLATFORM);
    kit.ramp(tx + 14, tz + 3, tx + 20, tz + 7, 'x-', G, G + 2.4, 0x77727e, { solidBelow: true });
    lowWall(kit, tx, tz, tx + 14, tz + 0.4, 0.5, 0x5e5a64, G + 2.4);
    planterTree(kit, tx + 3, tz + 5, G + 2.4);
    kit.slot(tx + 9, G + 2.4, tz + 6, 0, ['plaza']);
    kit.link('stairs', 'street', 'terrace', tx + 17, tz + 5);
  }
  // Planters, benches and low walls scattered on a loose grid.
  for (let x = I.x0 + 6; x < I.x1 - 4; x += 11) for (let z = I.z0 + 6; z < I.z1 - 4; z += 11) {
    if (Math.abs(x - cx) < fr + 3 && Math.abs(z - cz) < fr + 3) continue;
    if (Math.abs(x - sx) < 5 && Math.abs(z - sz) < 5) continue;
    const r = rng.next();
    if (r < 0.32) planterTree(kit, x + rng.range(-2, 2), z + rng.range(-2, 2));
    else if (r < 0.5) placeProp(kit, 'bench', x, G, z, rng.chance(0.5) ? 0 : Math.PI / 2);
    else if (r < 0.62) lowWall(kit, x - 3, z - 0.3, x + 3, z + 0.3);
    else if (r < 0.7) placeProp(kit, 'kiosk', x, G, z);
    else kit.slot(x, G, z, rng.range(0, 6.28), ['plaza']);
  }
  // Spawns: revolving doors of the towers and the plaza edges.
  kit.spawn(I.x0 + 2, G, cz, 'door');
  kit.spawn(I.x1 - 2, G, cz, 'door');
  kit.spawn(cx, G, I.z0 + 2, 'door');
  for (let k = 0; k < 4; k++) kit.light(cx + (k % 2 ? 1 : -1) * 14, 5, cz + (k < 2 ? 1 : -1) * 14, 0xffb36a, 9, 'plaza');
}

const area = (r) => (r.x1 - r.x0) * (r.z1 - r.z0);
const shrink = (r, k) => ({ x0: r.x0 + k, z0: r.z0 + k, x1: r.x1 - k, z1: r.z1 - k });
