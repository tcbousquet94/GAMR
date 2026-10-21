// PARKING GARAGE: four decks (street, 3.5, 7, 10.5 open roof) joined by alternating ramps on two side strips,
// columns and parked cars for cover, plus a ladder and plank onward to the rooftops.

import { MAT, TAG } from '../kit.js';
import { lotGround, building, plank, G } from './building.js';
import { perimeter, placeProp, lowWall } from './common.js';
import { garageName } from '../names.js';

const DECKS = [G, 3.5, 7, 10.5];
const CAR_COLORS = [0x7a8090, 0x9a9ea6, 0xb8b6ba, 0x5d6478, 0x8a7a70, 0x6a7a8c, 0xc8c4bc];

export function garage(kit, lot) {
  const { rng, pal } = kit;
  const R = lot.rect;
  lotGround(kit, R, null, 0x55525a);
  const alleySides = Object.entries(lot.sides).filter(([, v]) => v === 'alley').map(([k]) => k);
  const per = perimeter(kit, R, alleySides, lot, { depth: 16, heights: [14, 20] });
  // Garage occupies the street corner.
  const strip = 7;
  const W = 40, D = 46; // main deck footprint (x by z)
  const ox = lot.sides.w === 'street' ? R.x0 + 4 + strip : R.x1 - 4 - strip - W;
  const oz = lot.sides.n === 'street' ? R.z0 + 4 : R.z1 - 4 - D;
  const M = { x0: ox, z0: oz, x1: ox + W, z1: oz + D };
  const WS = { x0: M.x0 - strip, x1: M.x0 }, ES = { x0: M.x1, x1: M.x1 + strip };
  const land = 7;
  const conc = 0x6a6770;
  // Decks 1..3 over the main footprint + landings.
  for (let k = 1; k < 4; k++) {
    const y = DECKS[k];
    kit.solid(M.x0, y - 0.35, M.z0, M.x1, y, M.z1, conc, MAT.STD, TAG.PLATFORM);
    // Edge band (visual) so each deck reads from the street.
    kit.box(M.x0 - 0.1, y - 0.6, M.z0 - 0.1, M.x1 + 0.1, y - 0.35, M.z1 + 0.1, 0x8a8590);
  }
  // Landings: deck1 north of both strips, deck2 south of both strips, deck3 north of the west strip.
  const north = { z0: M.z0, z1: M.z0 + land }, south = { z0: M.z1 - land, z1: M.z1 };
  kit.solid(WS.x0, DECKS[1] - 0.35, north.z0, WS.x1, DECKS[1], north.z1, conc, MAT.STD, TAG.PLATFORM);
  kit.solid(ES.x0, DECKS[1] - 0.35, north.z0, ES.x1, DECKS[1], north.z1, conc, MAT.STD, TAG.PLATFORM);
  kit.solid(WS.x0, DECKS[2] - 0.35, south.z0, WS.x1, DECKS[2], south.z1, conc, MAT.STD, TAG.PLATFORM);
  kit.solid(ES.x0, DECKS[2] - 0.35, south.z0, ES.x1, DECKS[2], south.z1, conc, MAT.STD, TAG.PLATFORM);
  kit.solid(WS.x0, DECKS[3] - 0.35, north.z0, WS.x1, DECKS[3], north.z1, conc, MAT.STD, TAG.PLATFORM);
  // Ramps (uphill direction): west strip rises northward (0->3.5, 7->10.5), east strip rises southward (3.5->7).
  kit.ramp(WS.x0, north.z1, WS.x1, south.z1, 'z-', DECKS[0], DECKS[1], 0x625f68, { solidBelow: true });
  kit.ramp(ES.x0, north.z1, ES.x1, south.z0, 'z+', DECKS[1], DECKS[2], 0x625f68);
  kit.ramp(WS.x0, north.z1, WS.x1, south.z0, 'z-', DECKS[2], DECKS[3], 0x625f68);
  kit.link('ramp', 'street', 'mid', (WS.x0 + WS.x1) / 2, (M.z0 + M.z1) / 2);
  kit.link('ramp', 'mid', 'mid', (ES.x0 + ES.x1) / 2, (M.z0 + M.z1) / 2);
  kit.link('ramp', 'mid', 'mid', (WS.x0 + WS.x1) / 2, (M.z0 + M.z1) / 2);
  // Columns on a grid between decks.
  for (let x = M.x0 + 0.5; x <= M.x1 - 0.5; x += 13) for (let z = M.z0 + 0.5; z <= M.z1 - 0.5; z += 11.5) {
    kit.solid(x - 0.4, G, z - 0.4, x + 0.4, DECKS[3] - 0.35, z + 0.4, 0x75717b, MAT.STD, TAG.PROP);
  }
  // Parapets along the long outer edges, with openings so you can drop or vault out.
  for (let k = 1; k < 4; k++) {
    const y = DECKS[k];
    // Skip wall segments where a landing joins the deck.
    const wLand = k === 2 ? south : north, eLand = k === 2 ? south : k === 1 ? north : null;
    const hits = (z, L) => L && z < L.z1 + 1 && z + 6 > L.z0 - 1;
    for (let z = M.z0 + 2; z < M.z1 - 2; z += 9) {
      if (!hits(z, wLand)) lowWall(kit, M.x0 + 0.1, z, M.x0 + 0.5, z + 6, 1.0, 0x7d7984, y);
      if (!hits(z, eLand)) lowWall(kit, M.x1 - 0.5, z, M.x1 - 0.1, z + 6, 1.0, 0x7d7984, y);
    }
    for (let x = M.x0 + 2; x < M.x1 - 2; x += 9) {
      if (k < 3 || x > M.x0 + 8) lowWall(kit, x, M.z0 + 0.1, x + 6, M.z0 + 0.5, 1.0, 0x7d7984, y);
      lowWall(kit, x, M.z1 - 0.5, x + 6, M.z1 - 0.1, 1.0, 0x7d7984, y);
    }
    // Parked cars as cover + spawns + interactable slots on each deck.
    for (let n = 0; n < 5; n++) {
      const x = M.x0 + 5 + rng.next() * (W - 10), z = M.z0 + 9 + rng.next() * (D - 18);
      placeProp(kit, 'car', x, y, z, rng.chance(0.5) ? 0 : Math.PI / 2, rng.pick(CAR_COLORS));
    }
    kit.spawn((M.x0 + M.x1) / 2, y, M.z0 + 4, 'garage');
    kit.slot(M.x0 + 3, y, (M.z0 + M.z1) / 2, Math.PI / 2, ['wall', 'garage']);
    kit.light((M.x0 + M.x1) / 2, y + 2.8, (M.z0 + M.z1) / 2, 0xfff0d0, 12, 'garage');
  }
  for (let n = 0; n < 4; n++) placeProp(kit, 'car', M.x0 + 6 + rng.next() * (W - 12), G, M.z0 + 9 + rng.next() * (D - 18), 0, rng.pick(CAR_COLORS));
  kit.spawn((M.x0 + M.x1) / 2, G, (M.z0 + M.z1) / 2, 'garage');
  // Big sign on the street face, like the reference.
  const sf = lot.sides.n === 'street' ? { z: M.z0 - 0.15, nz: -1 } : { z: M.z1 + 0.15, nz: 1 };
  kit.sign(garageName(rng), 'garage', (M.x0 + M.x1) / 2, (DECKS[1] + DECKS[2]) / 2 - 0.4, sf.z, 22, 2.0, 0, sf.nz, 0xffd86a);
  kit.box(M.x0, DECKS[1] + 0.1, sf.z - 0.1, M.x1, DECKS[2] - 1.0, sf.z + 0.1, 0x3a3842);
  // Stair-tower ladder: an alternate street -> roof route at the far corner.
  const lx = lot.sides.w === 'street' ? M.x1 + strip + 0.2 : M.x0 - strip - 1.3;
  kit.climb(lx, 0, M.z1 - 4, lx + 1.1, DECKS[3] + 0.8, M.z1 - 2.9, 'ladder', 'street', 'mid');
  // Platform from the ladder top back across the ramp strip to the roof deck.
  if (lot.sides.w === 'street') kit.solid(M.x1, DECKS[3] - 0.35, M.z1 - 6, lx + 1.7, DECKS[3], M.z1 - 1, conc, MAT.STD, TAG.PLATFORM);
  else kit.solid(lx - 0.6, DECKS[3] - 0.35, M.z1 - 6, M.x0, DECKS[3], M.z1 - 1, conc, MAT.STD, TAG.PLATFORM);
  // Roof deck -> rooftops: a connector building with a ladder up from deck level, plus a plank.
  const inner = lot.sides.n === 'street' ? 's' : 'n';
  const cz0 = inner === 's' ? M.z1 + 3 : M.z0 - 15;
  const conn = { x0: M.x0 + 4, z0: cz0, x1: M.x0 + 22, z1: cz0 + 12 };
  const ch = 15;
  if (!overlapsAny(conn, per.buildings)) {
    building(kit, conn, ch, { fireEscape: [lot.sides.w === 'street' ? 'w' : 'e'], storefront: [] });
    const lz = inner === 's' ? conn.z0 - 1.1 : conn.z1;
    kit.climb(conn.x1 - 3, DECKS[3], lz, conn.x1 - 1.9, ch + 0.7, lz + 1.1, 'ladder', 'mid', 'roof');
    kit.solid(conn.x1 - 3.6, DECKS[3] - 0.35, inner === 's' ? M.z1 : conn.z1, conn.x1 - 1.3, DECKS[3], inner === 's' ? conn.z0 : M.z0, conc, MAT.STD, TAG.PLATFORM);
    // Plank from the connector roof to the nearest perimeter roof of similar height.
    const near = per.buildings.find((b) => Math.abs(b.h - ch) <= 2);
    if (near) {
      const cx = (conn.x0 + conn.x1) / 2;
      const bz = inner === 's' ? near.r.z0 : near.r.z1;
      if (near.r.x0 < cx && near.r.x1 > cx) {
        if (inner === 's' && bz > conn.z1) plank(kit, cx - 1, conn.z1 - 0.5, cx + 1, bz + 0.5, Math.min(ch, near.h));
        if (inner === 'n' && bz < conn.z0) plank(kit, cx - 1, bz - 0.5, cx + 1, conn.z0 + 0.5, Math.min(ch, near.h));
      }
    }
  }
  kit.link('roof', 'mid', 'roof', M.x0, M.z0);
}

function overlapsAny(r, list) {
  return list.some((b) => r.x0 < b.r.x1 + 2 && r.x1 > b.r.x0 - 2 && r.z0 < b.r.z1 + 2 && r.z1 > b.r.z0 - 2);
}
