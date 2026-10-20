// FOOD TRUCK ALLEY: a narrow street cut through the lot, lined with fire-escaped buildings, food trucks,
// string lights, picnic tables and dumpsters. Tight and chaotic, and lined with vending machines.

import { MAT, TAG } from '../kit.js';
import { lotGround, building, plank, G } from './building.js';
import { placeProp, graffiti } from './common.js';
import { truckName } from '../names.js';

export function foodtrucks(kit, lot) {
  const { rng, pal } = kit;
  const R = lot.rect;
  lotGround(kit, R, null, 0x524f58);
  const alongX = rng.chance(0.5); // alley runs along x (connects w and e sides) or along z
  const AW = 13;
  const mid = alongX ? (R.z0 + R.z1) / 2 : (R.x0 + R.x1) / 2;
  const a0 = mid - AW / 2, a1 = mid + AW / 2;
  // Alley paving.
  if (alongX) kit.box(R.x0, G, a0, R.x1, G + 0.02, a1, 0x403d46);
  else kit.box(a0, G, R.z0, a1, G + 0.02, R.z1, 0x403d46);
  const len = alongX ? R.x1 - R.x0 : R.z1 - R.z0;
  const start = alongX ? R.x0 : R.z0;
  const rows = [];
  for (const sideSign of [-1, 1]) {
    const row = [];
    let prev = null;
    for (let u = 0; u < len - 6; ) {
      let w = rng.range(14, 22);
      if (len - (u + w) < 9) w = len - u;
      const h = Math.round(rng.range(15, 24));
      let r;
      if (alongX) r = sideSign < 0 ? { x0: start + u, z0: R.z0, x1: start + u + w, z1: a0 } : { x0: start + u, z0: a1, x1: start + u + w, z1: R.z1 };
      else r = sideSign < 0 ? { x0: R.x0, z0: start + u, x1: a0, z1: start + u + w } : { x0: a1, z0: start + u, x1: R.x1, z1: start + u + w };
      const alleyFace = alongX ? (sideSign < 0 ? 's' : 'n') : (sideSign < 0 ? 'e' : 'w');
      const outFace = { n: 's', s: 'n', e: 'w', w: 'e' }[alleyFace];
      const store = [alleyFace];
      if (lot.sides[outFace] === 'street') store.push(outFace);
      building(kit, r, h, { storefront: store, fireEscape: rng.chance(0.75) ? [alleyFace] : [alleyFace, outFace] });
      if (rng.chance(0.3)) graffiti(kit, r, alleyFace);
      // Vending slots against the alley wall.
      for (let t = 3; t < w - 3; t += 7) {
        const x = alongX ? r.x0 + t : sideSign < 0 ? a0 + 0.8 : a1 - 0.8;
        const z = alongX ? (sideSign < 0 ? a0 + 0.8 : a1 - 0.8) : r.z0 + t;
        kit.slot(x, G, z, alongX ? (sideSign < 0 ? 0 : Math.PI) : (sideSign < 0 ? Math.PI / 2 : -Math.PI / 2), ['wall', 'alley']);
      }
      const b = { r, h };
      if (prev && prev.gap && Math.abs(prev.h - h) <= 2) {
        const hh = Math.min(prev.h, h);
        if (alongX) plank(kit, prev.r.x1 - 0.5, (r.z0 + r.z1) / 2 - 1, r.x0 + 0.5, (r.z0 + r.z1) / 2 + 1, hh);
        else plank(kit, (r.x0 + r.x1) / 2 - 1, prev.r.z1 - 0.5, (r.x0 + r.x1) / 2 + 1, r.z0 + 0.5, hh);
      }
      const gap = rng.chance(0.3) && u + w + 15 < len ? rng.range(5, 6.5) : 0;
      b.gap = gap;
      if (gap) kit.spawn(alongX ? r.x1 + gap / 2 : (r.x0 + r.x1) / 2, G, alongX ? (r.z0 + r.z1) / 2 : r.z1 + gap / 2, 'alley');
      row.push(b);
      prev = b;
      u += w + gap;
    }
    rows.push(row);
  }
  // Rooftops across the alley are too far to jump; string a couple of planks across it high up.
  for (let k = 0; k < 2; k++) {
    const A = rows[0][rng.int(0, rows[0].length - 1)];
    const Bb = rows[1].find((b) => Math.abs(b.h - A.h) <= 2 && overlap1(A.r, b.r, alongX));
    if (!Bb) continue;
    const hh = Math.min(A.h, Bb.h);
    if (alongX) { const x = (Math.max(A.r.x0, Bb.r.x0) + Math.min(A.r.x1, Bb.r.x1)) / 2; plank(kit, x - 1, a0 - 0.5, x + 1, a1 + 0.5, hh); }
    else { const z = (Math.max(A.r.z0, Bb.r.z0) + Math.min(A.r.z1, Bb.r.z1)) / 2; plank(kit, a0 - 0.5, z - 1, a1 + 0.5, z + 1, hh); }
  }
  // Food trucks parked along one side, picnic tables down the middle.
  const truckSide = rng.chance(0.5) ? -1 : 1;
  const tOff = truckSide * (AW / 2 - 1.9);
  const truckColors = [0x6a4a7a, 0x3f6a6a, 0x7a5a3a, 0x4a5a7a, 0x6a3f5a];
  for (let u = 10; u < len - 10; u += rng.range(13, 17)) {
    const x = alongX ? start + u : mid + tOff, z = alongX ? mid + tOff : start + u;
    const yaw = alongX ? Math.PI / 2 : 0;
    placeProp(kit, 'truck', x, G, z, yaw, rng.pick(truckColors));
    // Serving window glow + menu sign on the alley-facing side.
    const nx = alongX ? 0 : -truckSide, nz = alongX ? -truckSide : 0;
    kit.quad(x + nx * 1.27, G + 1.9, z + nz * 1.27, 2.6, 1.1, nx, nz, 0x7a7060, 0xffd08a);
    kit.sign(truckName(rng), 'truck', x + nx * 1.28, G + 3.25, z + nz * 1.28, 4.2, 0.8, nx, nz, rng.pick([0xff3fb8, 0x33e0ff, 0xffb04d, 0xb04bff]));
    kit.light(x + nx * 2.5, G + 2.2, z + nz * 2.5, 0xffc070, 7, 'truck');
    // Picnic table across from the truck.
    const px = alongX ? start + u + rng.range(-2, 2) : mid - tOff * 0.25, pz = alongX ? mid - tOff * 0.25 : start + u + rng.range(-2, 2);
    placeProp(kit, 'picnic', px, G, pz, yaw);
  }
  // Dumpsters against the far wall.
  for (let u = 6; u < len - 6; u += rng.range(18, 26)) {
    const off = -truckSide * (AW / 2 - 1.1);
    placeProp(kit, 'dumpster', alongX ? start + u : mid + off, G, alongX ? mid + off : start + u, alongX ? Math.PI / 2 : 0, rng.pick([0x3d4a3a, 0x40424a]));
  }
  // String lights zig-zagging across the alley.
  for (let u = 4; u < len - 4; u += 7) {
    const y = G + 5.6 + rng.range(-0.3, 0.3);
    if (alongX) kit.strings.push({ ax: start + u, ay: y, az: a0 + 0.2, bx: start + u + 7, by: y, bz: a1 - 0.2 });
    else kit.strings.push({ ax: a0 + 0.2, ay: y, az: start + u, bx: a1 - 0.2, by: y, bz: start + u + 7 });
  }
  // Spawns at both alley mouths.
  if (alongX) { kit.spawn(R.x0 + 2, G, mid, 'alley'); kit.spawn(R.x1 - 2, G, mid, 'alley'); }
  else { kit.spawn(mid, G, R.z0 + 2, 'alley'); kit.spawn(mid, G, R.z1 - 2, 'alley'); }
  kit.light(alongX ? (R.x0 + R.x1) / 2 : mid, G + 5, alongX ? mid : (R.z0 + R.z1) / 2, 0xffb070, 14, 'alley');
}

function overlap1(a, b, alongX) {
  return alongX ? Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 3 : Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 3;
}
