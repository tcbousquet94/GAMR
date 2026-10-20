// ELEVATED WALKWAY: a mid-level (8 m) deck network over the lot with a central hub, stairs from the street,
// low buildings whose roofs meet the deck, and bridges across the neighbouring streets to ladder landings.

import { MAT, TAG } from '../kit.js';
import { lotGround, G } from './building.js';
import { perimeter, placeProp, planterTree } from './common.js';

const Y = 8;

export function walkway(kit, lot, city) {
  const { rng, pal } = kit;
  const R = lot.rect;
  lotGround(kit, R);
  const alleySides = Object.entries(lot.sides).filter(([, v]) => v === 'alley').map(([k]) => k);
  const depth = 15;
  // Low buildings on the alley sides; their roofs sit at deck level so the deck flows onto them.
  perimeter(kit, R, alleySides, lot, { depth, heights: [Y, Y], gapChance: 0.15 });
  const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
  const w = 5;
  const deckC = 0x6d6a76;
  const deck = (x0, z0, x1, z1) => {
    kit.solid(x0, Y - 0.45, z0, x1, Y, z1, deckC, MAT.STD, TAG.PLATFORM);
    kit.box(x0, Y - 0.75, z0, x1, Y - 0.45, z1, 0x8d8996);
  };
  // Cross of walkways spanning the lot, meeting the low roofs on the alley sides.
  deck(R.x0, cz - w / 2, R.x1, cz + w / 2);
  deck(cx - w / 2, R.z0, cx + w / 2, cz - w / 2);
  deck(cx - w / 2, cz + w / 2, cx + w / 2, R.z1);
  deck(cx - 8, cz - 8, cx + 8, cz + 8); // hub
  // Railings (visual, glassy) along the walkway edges.
  for (const s of [-1, 1]) {
    kit.box(R.x0, Y, cz + s * (w / 2) - 0.05, cx - 8, Y + 1.0, cz + s * (w / 2) + 0.05, 0x7fa4c8, MAT.GLASS);
    kit.box(cx + 8, Y, cz + s * (w / 2) - 0.05, R.x1, Y + 1.0, cz + s * (w / 2) + 0.05, 0x7fa4c8, MAT.GLASS);
    kit.box(cx + s * (w / 2) - 0.05, Y, R.z0, cx + s * (w / 2) + 0.05, Y + 1.0, cz - 8, 0x7fa4c8, MAT.GLASS);
    kit.box(cx + s * (w / 2) - 0.05, Y, cz + 8, cx + s * (w / 2) + 0.05, Y + 1.0, R.z1, 0x7fa4c8, MAT.GLASS);
  }
  // Support pillars.
  for (let x = R.x0 + 6; x < R.x1 - 4; x += 12) if (Math.abs(x - cx) > 9) kit.solid(x - 0.5, G, cz - 0.5, x + 0.5, Y - 0.45, cz + 0.5, 0x7a7680, MAT.STD, TAG.PROP);
  for (let z = R.z0 + 6; z < R.z1 - 4; z += 12) if (Math.abs(z - cz) > 9) kit.solid(cx - 0.5, G, z - 0.5, cx + 0.5, Y - 0.45, z + 0.5, 0x7a7680, MAT.STD, TAG.PROP);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.solid(cx + sx * 7 - 0.5, G, cz + sz * 7 - 0.5, cx + sx * 7 + 0.5, Y - 0.45, cz + sz * 7 + 0.5, 0x7a7680, MAT.STD, TAG.PROP);
  // Hub: kiosk, bench, planters, lights.
  placeProp(kit, 'kiosk', cx + 4, Y, cz + 4);
  placeProp(kit, 'bench', cx - 4, Y, cz - 5, Math.PI / 2);
  planterTree(kit, cx - 5, cz + 5, Y);
  kit.slot(cx + 5, Y, cz - 5, 0, ['hub']);
  kit.slot(cx - 5, Y, cz - 1, 0, ['hub']);
  kit.spawn(cx, Y, cz - 3, 'walkway');
  kit.light(cx, Y + 3.5, cz, 0xffc080, 12, 'walkway');
  // Stairs from the street up to the deck, in two quadrants.
  const quads = rng.shuffle([[-1, -1], [1, -1], [-1, 1], [1, 1]]).slice(0, 2);
  for (const [sx, sz] of quads) {
    const x0 = cx + sx * 14 - 2, z = cz + sz * (w / 2);
    if (sz < 0) kit.ramp(x0, z - 23, x0 + 4, z, 'z+', G, Y, 0x77737e, { solidBelow: true });
    else kit.ramp(x0, z, x0 + 4, z + 23, 'z-', G, Y, 0x77737e, { solidBelow: true });
    kit.link('stairs', 'street', 'mid', x0 + 2, z);
  }
  // Bridges across each adjacent street to a landing with a ladder on the far sidewalk.
  const W = city.W, sw = city.district.layout.sidewalk;
  for (const side of ['n', 's', 'w', 'e']) {
    if (lot.sides[side] !== 'street') continue;
    let b, land, lad;
    if (side === 'w') { b = [R.x0 - W + sw, cz - w / 2, R.x0, cz + w / 2]; land = [R.x0 - W, cz - 3, R.x0 - W + sw, cz + 3]; lad = [R.x0 - W + 0.6, cz + 3, R.x0 - W + 1.7, cz + 4.1]; }
    if (side === 'e') { b = [R.x1, cz - w / 2, R.x1 + W - sw, cz + w / 2]; land = [R.x1 + W - sw, cz - 3, R.x1 + W, cz + 3]; lad = [R.x1 + W - 1.7, cz + 3, R.x1 + W - 0.6, cz + 4.1]; }
    if (side === 'n') { b = [cx - w / 2, R.z0 - W + sw, cx + w / 2, R.z0]; land = [cx - 3, R.z0 - W, cx + 3, R.z0 - W + sw]; lad = [cx + 3, R.z0 - W + 0.6, cx + 4.1, R.z0 - W + 1.7]; }
    if (side === 's') { b = [cx - w / 2, R.z1, cx + w / 2, R.z1 + W - sw]; land = [cx - 3, R.z1 + W - sw, cx + 3, R.z1 + W]; lad = [cx + 3, R.z1 + W - 1.7, cx + 4.1, R.z1 + W - 0.6]; }
    deck(b[0], b[1], b[2], b[3]);
    deck(land[0], land[1], land[2], land[3]);
    // Truss sides on the bridge.
    const alongX = side === 'w' || side === 'e';
    for (const s of [-1, 1]) {
      if (alongX) kit.box(b[0], Y, (b[1] + b[3]) / 2 + s * w / 2 - 0.08, b[2], Y + 1.3, (b[1] + b[3]) / 2 + s * w / 2 + 0.08, pal.metal, MAT.METAL);
      else kit.box((b[0] + b[2]) / 2 + s * w / 2 - 0.08, Y, b[1], (b[0] + b[2]) / 2 + s * w / 2 + 0.08, Y + 1.3, b[3], pal.metal, MAT.METAL);
    }
    for (const [px, pz] of [[land[0] + 0.3, land[1] + 0.3], [land[2] - 0.3, land[3] - 0.3]]) kit.box(px - 0.2, 0, pz - 0.2, px + 0.2, Y - 0.45, pz + 0.2, 0x7a7680);
    kit.climb(lad[0], 0, lad[1], lad[2], Y + 0.8, lad[3], 'ladder', 'street', 'mid');
    kit.link('bridge', 'mid', 'mid', (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
  }
  // Street-level clutter under the deck: kiosks, a bus shelter, benches.
  for (let k = 0; k < 7; k++) {
    const x = R.x0 + 8 + rng.next() * (R.x1 - R.x0 - 16), z = R.z0 + 8 + rng.next() * (R.z1 - R.z0 - 16);
    if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4) continue;
    const t = rng.pick(['kiosk', 'bench', 'planter', 'trashcan', 'bench']);
    if (t === 'planter') planterTree(kit, x, z); else placeProp(kit, t, x, G, z, rng.chance(0.5) ? 0 : Math.PI / 2);
    if (rng.chance(0.5)) kit.slot(x + 2.5, G, z, 0, ['plaza']);
  }
  kit.spawn(cx + 12, G, cz + 12, 'walkway');
  kit.spawn(cx - 12, G, cz - 12, 'walkway');
}
