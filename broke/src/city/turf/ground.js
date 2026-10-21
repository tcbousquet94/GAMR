// Streets, sidewalks, mews and the diagonal boulevard, then street furniture. Roads are at y=0, sidewalks and block
// interiors at G (curb height). The diagonal is a shared-space boulevard at curb level drawn over the blocks it
// crosses (physics stays axis-aligned; only its paint and furniture are diagonal).

import { MAT, TAG } from '../kit.js';
import { G } from '../modules/building.js';
import { placeProp } from '../modules/streets.js';
import { R } from './raster.js';
import { diagDist } from './layout.js';
import { beaterDressing, FADED } from './worn.js';

const CAR_COLORS = [0x7a8090, 0x9a9ea6, 0xb8b6ba, 0x5d6478, 0x8a7a70, 0x6a7a8c, 0xc8c4bc, 0x8a3a3a];

export function ground(kit, city, raster) {
  const { pal } = kit;
  const L = city.layout;
  const sw = city.district.roads.sidewalk;
  const inner = { x0: L.X[0], z0: L.Z[0], x1: L.X[L.cols] + L.S, z1: L.Z[L.rows] + L.S };
  city.inner = inner;
  // One asphalt slab under the whole street grid; blocks sit on it at curb height.
  kit.solid(inner.x0, -1, inner.z0, inner.x1, 0, inner.z1, pal.asphalt, MAT.STD, TAG.GROUND);
  for (const sg of L.segs) raster.mark(sg.rect, R.STREET);
  for (const I of L.intersections) raster.mark(I.rect, R.STREET);
  for (const c of L.cells) {
    const r = c.rect;
    const zone = city.blocks[c.block].zone;
    // Sidewalk ring (inside the street corridor) and the block's own ground.
    kit.solid(r.x0 - sw, 0, r.z0 - sw, r.x1 + sw, G - 0.01, r.z1 + sw, pal.sidewalk, MAT.STD, TAG.GROUND);
    kit.box(r.x0 - sw - 0.2, 0, r.z0 - sw - 0.2, r.x1 + sw + 0.2, G - 0.02, r.z1 + sw + 0.2, pal.curb);
    kit.solid(r.x0, -1, r.z0, r.x1, G, r.z1, zone === 'park' ? 0x4f6040 : zone === 'landmark' || zone === 'civic' ? 0x7a7680 : zone === 'industrial' ? 0x5d5a62 : 0x67636e, MAT.STD, TAG.GROUND);
    raster.mark(r, R.BLOCK);
  }
  // Mews: where a street was pedestrianised, paving at curb height with planters and benches down the middle.
  for (const b of city.blocks) for (const m of b.mews) {
    kit.solid(m.x0, -1, m.z0, m.x1, G, m.z1, 0x7c7884, MAT.STD, TAG.GROUND);
    raster.mark(m, R.BLOCK | R.MEWS | R.RESERVED);
    mewsDressing(kit, m);
  }
  // Diagonal band.
  const D = L.diag;
  if (D) {
    for (let z = 0; z < raster.h; z++) for (let x = 0; x < raster.w; x++) if (diagDist(D, x + 0.5, z + 0.5) < D.width / 2 + 1.5) raster.a[z * raster.w + x] |= R.DIAG;
    diagonal(kit, city, raster);
  }
  markings(kit, city);
}

function mewsDressing(kit, m) {
  const { rng, pal } = kit;
  const alongZ = m.axis === 'v';
  const len = alongZ ? m.z1 - m.z0 : m.x1 - m.x0;
  const c = alongZ ? (m.x0 + m.x1) / 2 : (m.z0 + m.z1) / 2;
  for (let u = 6; u < len - 4; u += rng.range(9, 13)) {
    const x = alongZ ? c : m.x0 + u, z = alongZ ? m.z0 + u : c;
    const r = rng.next();
    if (r < 0.45) { placeProp(kit, 'planter', x, G, z); kit.prop('tree', x, G + 0.9, z, rng.range(0, 6.28), rng.pick(pal.foliage)); }
    else if (r < 0.75) placeProp(kit, 'bench', x, G, z, alongZ ? 0 : Math.PI / 2);
    else placeProp(kit, 'streetlight', x, G, z, 0);
    if (r >= 0.75) kit.light(x, 6.3, z, pal.street, 8);
  }
}

// Lane dashes on open street segments and zebra crossings where open segments meet an intersection.
function markings(kit, city) {
  const { pal } = kit;
  const L = city.layout;
  for (const s of L.segs) {
    if (!s.open) continue;
    const r = s.rect;
    if (s.axis === 'v') { const c = (r.x0 + r.x1) / 2; for (let z = r.z0 + 2; z < r.z1 - 4; z += 7) kit.box(c - 0.08, 0, z, c + 0.08, 0.02, z + 3, pal.lane); }
    else { const c = (r.z0 + r.z1) / 2; for (let x = r.x0 + 2; x < r.x1 - 4; x += 7) kit.box(x, 0, c - 0.08, x + 3, 0.02, c + 0.08, pal.lane); }
    // Zebra at both ends.
    for (const end of [0, 1]) for (let k = -3; k <= 3; k++) {
      if (s.axis === 'v') { const c = (r.x0 + r.x1) / 2, z = end ? r.z1 - 2.2 : r.z0 + 0.4; kit.box(c + k * 1.2 - 0.35, 0, z, c + k * 1.2 + 0.35, 0.02, z + 1.8, 0xb8b2a6); }
      else { const c = (r.z0 + r.z1) / 2, x = end ? r.x1 - 2.2 : r.x0 + 0.4; kit.box(x, 0, c + k * 1.2 - 0.35, x + 1.8, 0.02, c + k * 1.2 + 0.35, 0xb8b2a6); }
    }
  }
}

// Paint the diagonal boulevard in short straight pieces so it follows curb height over blocks and dips to the road
// at street crossings; trees and lamps line both edges where they stand on block ground.
function diagonal(kit, city, raster) {
  const { pal, rng } = kit;
  const D = city.layout.diag;
  const dx = D.bx - D.ax, dz = D.bz - D.az, len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
  const ry = Math.atan2(-dx, -dz); // box local -z along the line
  const step = 3;
  const yAt = (x, z) => (raster.get(x, z) & R.BLOCK ? G : 0);
  for (let s = 0; s < len; s += step) {
    const x = D.ax + ux * (s + step / 2), z = D.az + uz * (s + step / 2);
    const y = yAt(x, z);
    kit.boxC(x, y + 0.012, z, D.width - 3, 0.02, step + 0.05, 0x46444e, MAT.STD, { ry });
    for (const side of [-1, 1]) kit.boxC(x + nx * side * (D.width / 2 - 1.2), y + 0.02, z + nz * side * (D.width / 2 - 1.2), 0.3, 0.03, step + 0.05, pal.curb, MAT.STD, { ry });
    if ((s / step) % 3 === 0) kit.boxC(x, y + 0.025, z, 0.16, 0.02, 2.4, pal.lane, MAT.STD, { ry });
  }
  for (let s = 10; s < len - 10; s += 16) for (const side of [-1, 1]) {
    const x = D.ax + ux * s + nx * side * (D.width / 2 - 0.4), z = D.az + uz * s + nz * side * (D.width / 2 - 0.4);
    if (!(raster.get(x, z) & R.BLOCK)) continue;
    if ((s / 16) % 2 < 1) { kit.prop('tree', x, G, z, rng.range(0, 6.28), rng.pick(pal.foliage)); kit.collider(x - 0.25, G, z - 0.25, x + 0.25, G + 3, z + 0.25, TAG.PROP); }
    else { placeProp(kit, 'streetlight', x, G, z, Math.atan2(nx * side, nz * side)); kit.light(x - nx * side * 1.6, 6.3, z - nz * side * 1.6, pal.street, 9); }
  }
}

// Street furniture along every cell edge that faces an open street: lamps, parked cars, hydrants, bins, bike racks,
// bus shelters and steam grates; traffic lights at intersection corners. Skips business frontages and the diagonal.
export function furniture(kit, city, raster) {
  const { rng, pal } = kit;
  const L = city.layout;
  const sw = city.district.roads.sidewalk;
  const free = (x, z) => !(raster.get(x, z) & (R.NOFURN | R.DIAG));
  for (const c of L.cells) {
    const r = c.rect;
    for (const side of ['n', 's', 'w', 'e']) {
      if (!city.sideOpen(c, side)) continue;
      const alongX = side === 'n' || side === 's';
      const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
      const nx = side === 'w' ? -1 : side === 'e' ? 1 : 0, nz = side === 'n' ? -1 : side === 's' ? 1 : 0;
      const at = (u, out) => alongX ? { x: r.x0 + u, z: (side === 'n' ? r.z0 : r.z1) + nz * out } : { x: (side === 'w' ? r.x0 : r.x1) + nx * out, z: r.z0 + u };
      const yawAlong = alongX ? Math.PI / 2 : 0;
      for (let u = 10; u < len - 6; u += 28) {
        const p = at(u, sw - 0.5);
        if (!free(p.x, p.z)) continue;
        placeProp(kit, 'streetlight', p.x, G, p.z, Math.atan2(-nx, -nz));
        kit.light(p.x + nx * 1.6, 6.3, p.z + nz * 1.6, pal.street, 9);
      }
      for (let u = 7; u < len - 7;) {
        const p = at(u, sw + 1.3);
        if (rng.chance(0.5) && free(p.x, p.z) && free(at(u - 2.4, sw + 1.3).x, at(u - 2.4, sw + 1.3).z) && free(at(u + 2.4, sw + 1.3).x, at(u + 2.4, sw + 1.3).z)) {
          // About a third of the parked cars are beaters: faded paint, primer, a mismatched door, rust.
          const beater = rng.chance(0.35);
          const van = rng.chance(0.15);
          placeProp(kit, van ? 'van' : 'car', p.x, 0, p.z, yawAlong, beater ? rng.pick(FADED) : rng.pick(CAR_COLORS));
          if (beater && !van) beaterDressing(kit, p.x, p.z, yawAlong);
          u += rng.range(6, 9);
        } else u += rng.range(4, 10);
      }
      for (let u = 5; u < len - 5; u += rng.range(8, 14)) {
        const p = at(u, sw * 0.42);
        if (!free(p.x, p.z)) continue;
        const k = rng.next();
        if (k < 0.2) placeProp(kit, 'hydrant', p.x, G, p.z);
        else if (k < 0.42) placeProp(kit, 'trashcan', p.x, G, p.z);
        else if (k < 0.55) placeProp(kit, 'bikerack', p.x, G, p.z, yawAlong);
        else if (k < 0.62) { const q = at(u, sw * 0.62); placeProp(kit, 'busshelter', q.x, G, q.z, yawAlong); }
        else if (k < 0.74) { kit.solid(p.x - 0.28, G, p.z - 0.28, p.x + 0.28, G + 1.05, p.z + 0.28, rng.pick([0x2f6fbf, 0xb03a3a, 0xd8a83a]), MAT.METAL, TAG.PROP); } // newspaper box
        else if (k < 0.86) {
          const q = at(u, sw + 3.6);
          if (!free(q.x, q.z)) continue;
          kit.box(q.x - 0.8, 0, q.z - 0.8, q.x + 0.8, 0.03, q.z + 0.8, 0x1c1b20, MAT.METAL);
          kit.spawn(q.x, 0, q.z, 'grate');
          kit.light(q.x, 0.2, q.z, 0xffffff, 0, 'steam');
        }
      }
    }
  }
  // Traffic lights on corners of intersections that join three or more open streets.
  for (const I of L.intersections) {
    if (I.degree < 3) continue;
    const r = I.rect;
    for (const [x, z, yaw] of [[r.x0 - 0.8, r.z0 - 0.8, 0], [r.x1 + 0.8, r.z0 - 0.8, Math.PI / 2], [r.x0 - 0.8, r.z1 + 0.8, -Math.PI / 2], [r.x1 + 0.8, r.z1 + 0.8, Math.PI]]) {
      if (raster.get(x, z) & (R.DIAG | R.NOFURN)) continue;
      if (!(raster.get(x, z) & R.STREET)) continue;
      placeProp(kit, 'trafficlight', x, G, z, yaw);
    }
  }
}
