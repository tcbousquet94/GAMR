// Streets, sidewalks, alleys and street furniture: parked cars, streetlights, traffic lights, hydrants,
// newspaper boxes, bus shelters, bike racks, trash cans and steam grates (which double as enemy spawn points).

import { MAT, TAG } from '../kit.js';
import { G } from './building.js';

export const PROP_SIZE = {
  // half extents x, height, half extents z (yaw 0 = length along z)
  car: [0.95, 1.5, 2.2],
  van: [1.05, 2.3, 2.6],
  hydrant: [0.25, 0.8, 0.25],
  trashcan: [0.35, 1.0, 0.35],
  dumpster: [1.0, 1.4, 1.8],
  busshelter: [0.9, 2.6, 2.2],
  bikerack: [0.2, 0.8, 1.2],
  bench: [0.35, 0.5, 1.0],
  planter: [1.0, 0.9, 1.0],
  streetlight: [0.15, 6.5, 0.15],
  trafficlight: [0.15, 5.5, 0.15],
  truck: [1.25, 2.9, 3.4],
  picnic: [0.9, 0.8, 1.0],
  ibeams: [0.8, 0.9, 3.0],
  barrier: [0.3, 1.0, 1.0],
  kiosk: [1.2, 2.6, 1.2],
  crate: [0.6, 1.2, 0.6],
};

// Place a prop and its collider. yaw must be a multiple of PI/2 for the collider to match.
export function placeProp(kit, type, x, y, z, yaw = 0, color = null, solid = true) {
  kit.prop(type, x, y, z, yaw, color);
  const s = PROP_SIZE[type];
  if (!s || !solid) return;
  const rot = Math.abs(Math.sin(yaw)) > 0.5;
  const hx = rot ? s[2] : s[0], hz = rot ? s[0] : s[2];
  if (type === 'busshelter') {
    // Roof you can stand on + back wall; open front.
    kit.collider(x - hx, y + s[1] - 0.15, z - hz, x + hx, y + s[1], z + hz, TAG.PROP);
    return;
  }
  if (type === 'streetlight' || type === 'trafficlight') { kit.collider(x - 0.15, y, z - 0.15, x + 0.15, y + s[1], z + 0.15, TAG.PROP); return; }
  kit.collider(x - hx, y, z - hz, x + hx, y + s[1], z + hz, TAG.PROP);
}

const CAR_COLORS = [0x7a8090, 0x9a9ea6, 0xb8b6ba, 0x5d6478, 0x8a7a70, 0x6a7a8c, 0xc8c4bc, 0x6e6a74];

export function streets(kit, city) {
  const { rng, pal } = kit;
  const { size, N, B, W } = city;
  const sw = city.district.layout.sidewalk;
  const pos = (k) => W + k * (B + W); // block start coordinate
  // Road surface on the street strips only (blocks build their own ground so lots can have sunken areas).
  for (let k = 0; k <= N; k++) {
    const s0 = k * (B + W);
    kit.solid(-30, -1, s0 - (k === 0 ? 30 : 0), size + 30, 0, s0 + W + (k === N ? 30 : 0), pal.asphalt, MAT.STD, TAG.GROUND);
    for (let m = 0; m < N; m++) kit.solid(s0 - (k === 0 ? 30 : 0), -1, pos(m), s0 + W + (k === N ? 30 : 0), 0, pos(m) + B, pal.asphalt, MAT.STD, TAG.GROUND);
  }
  for (const bl of city.blocks) {
    // Sidewalk ring.
    const c = pal.sidewalk;
    kit.solid(bl.x0 - sw, 0, bl.z0 - sw, bl.x1 + sw, G, bl.z0, c, MAT.STD, TAG.GROUND);
    kit.solid(bl.x0 - sw, 0, bl.z1, bl.x1 + sw, G, bl.z1 + sw, c, MAT.STD, TAG.GROUND);
    kit.solid(bl.x0 - sw, 0, bl.z0, bl.x0, G, bl.z1, c, MAT.STD, TAG.GROUND);
    kit.solid(bl.x1, 0, bl.z0, bl.x1 + sw, G, bl.z1, c, MAT.STD, TAG.GROUND);
    // Curb trim.
    kit.box(bl.x0 - sw - 0.2, 0, bl.z0 - sw - 0.2, bl.x1 + sw + 0.2, G - 0.01, bl.z1 + sw + 0.2, pal.curb);
    // Alleys (cross) at lot height.
    const A = city.A, ls = (B - A) / 2;
    const ax0 = bl.x0 + ls, az0 = bl.z0 + ls;
    kit.solid(ax0, -1, bl.z0, ax0 + A, G, az0, 0x46434c, MAT.STD, TAG.GROUND);
    kit.solid(ax0, -1, az0 + A, ax0 + A, G, bl.z1, 0x46434c, MAT.STD, TAG.GROUND);
    kit.solid(bl.x0, -1, az0, bl.x1, G, az0 + A, 0x46434c, MAT.STD, TAG.GROUND);
    alley(kit, city, ax0, bl.z0, ax0 + A, bl.z1, 'z');
    alley(kit, city, bl.x0, az0, bl.x1, az0 + A, 'x');
  }
  // Outer sidewalks along the boundary.
  kit.solid(0, 0, 0, size, G, sw, pal.sidewalk, MAT.STD, TAG.GROUND);
  kit.solid(0, 0, size - sw, size, G, size, pal.sidewalk, MAT.STD, TAG.GROUND);
  kit.solid(0, 0, sw, sw, G, size - sw, pal.sidewalk, MAT.STD, TAG.GROUND);
  kit.solid(size - sw, 0, sw, size, G, size - sw, pal.sidewalk, MAT.STD, TAG.GROUND);

  // Lane markings and crosswalks.
  for (let k = 0; k <= N; k++) {
    const c = pos(k) - W / 2; // street centerline
    for (let t = 0; t < size; t += 7) {
      if (isIntersection(t, city) || isIntersection(t + 3, city)) continue;
      kit.box(c - 0.08, 0, t, c + 0.08, 0.02, t + 3, pal.lane);
      if (!(city.avenue && k === city.avenue.k)) kit.box(t, 0, c - 0.08, t + 3, 0.02, c + 0.08, pal.lane);
    }
    for (let m = 0; m <= N; m++) {
      const ic = pos(m) - W / 2;
      for (let s = -3; s <= 3; s++) {
        kit.box(c + s * 1.2 - 0.35, 0, ic - W / 2 - 1.6, c + s * 1.2 + 0.35, 0.02, ic - W / 2 + 0.2, 0xb8b2a6);
        kit.box(ic - W / 2 - 1.6, 0, c + s * 1.2 - 0.35, ic - W / 2 + 0.2, 0.02, c + s * 1.2 + 0.35, 0xb8b2a6);
      }
    }
  }

  if (city.avenue) avenue(kit, city);
  wayfinding(kit, city);

  // Furniture along every block edge.
  for (const bl of city.blocks) {
    for (const side of ['n', 's', 'w', 'e']) furnishEdge(kit, city, bl, side, sw);
    // Traffic lights at the four corners.
    for (const [x, z, yaw] of [[bl.x0 - sw + 0.6, bl.z0 - sw + 0.6, 0], [bl.x1 + sw - 0.6, bl.z0 - sw + 0.6, Math.PI / 2], [bl.x0 - sw + 0.6, bl.z1 + sw - 0.6, -Math.PI / 2], [bl.x1 + sw - 0.6, bl.z1 + sw - 0.6, Math.PI]]) {
      placeProp(kit, 'trafficlight', x, G, z, yaw);
    }
  }
  // Streetlights and a few cars on the outer sidewalks too.
  for (let t = 20; t < size - 20; t += 34) {
    for (const [x, z] of [[sw - 0.6, t], [size - sw + 0.6, t], [t, sw - 0.6], [t, size - sw + 0.6]]) {
      if (isIntersection(x, city) && isIntersection(z, city)) continue;
      placeProp(kit, 'streetlight', x, G, z, 0);
      kit.light(x, 6.3, z, pal.street, 9);
    }
  }
}

function isIntersection(t, city) {
  const { N, B, W } = city;
  for (let k = 0; k <= N; k++) {
    const s0 = k * (B + W), s1 = s0 + W;
    if (t > s0 - 1 && t < s1 + 1) return true;
  }
  return false;
}

function furnishEdge(kit, city, bl, side, sw) {
  const { rng, pal } = kit;
  const len = bl.x1 - bl.x0;
  // Coordinates along the edge: u in [0, len]; the sidewalk strip is outward of the block.
  const at = (u, out) => {
    if (side === 'n') return { x: bl.x0 + u, z: bl.z0 - out, yaw: Math.PI / 2 };
    if (side === 's') return { x: bl.x0 + u, z: bl.z1 + out, yaw: Math.PI / 2 };
    if (side === 'w') return { x: bl.x0 - out, z: bl.z0 + u, yaw: 0 };
    return { x: bl.x1 + out, z: bl.z0 + u, yaw: 0 };
  };
  const nx = side === 'w' ? -1 : side === 'e' ? 1 : 0, nz = side === 'n' ? -1 : side === 's' ? 1 : 0;
  // Streetlights every ~30 m near the curb.
  for (let u = 12; u < len - 8; u += 30) {
    const p = at(u, sw - 0.5);
    placeProp(kit, 'streetlight', p.x, G, p.z, Math.atan2(-nx, -nz)); // arm (local -z) reaches over the road
    kit.light(p.x + nx * 1.6, 6.3, p.z + nz * 1.6, pal.street, 9);
  }
  // Parked cars in the curb lane, with gaps (none on the avenue: it's kept open, like a boulevard).
  const onAvenue = city.avenue && ((side === 'n' && Math.abs(bl.z0 - city.avenue.z1) < 1) || (side === 's' && Math.abs(bl.z1 - city.avenue.z0) < 1));
  for (let u = 8; u < (onAvenue ? 0 : len - 8); ) {
    if (rng.chance(0.55)) {
      const p = at(u, sw + 1.3);
      placeProp(kit, rng.chance(0.15) ? 'van' : 'car', p.x, 0, p.z, p.yaw, rng.pick(CAR_COLORS));
      u += rng.range(6, 9);
    } else u += rng.range(5, 14);
  }
  // Sidewalk clutter in the building-side half of the sidewalk (busier on the avenue).
  for (let u = 6; u < len - 6; u += onAvenue ? rng.range(6, 10) : rng.range(9, 16)) {
    const r = rng.next();
    const p = at(u, sw * 0.45);
    if (r < 0.2) placeProp(kit, 'hydrant', p.x, G, p.z);
    else if (r < 0.4) placeProp(kit, 'trashcan', p.x, G, p.z);
    else if (r < 0.52) placeProp(kit, 'bikerack', p.x, G, p.z, p.yaw);
    else if (r < 0.62) { const q = at(u, sw * 0.62); placeProp(kit, 'busshelter', q.x, G, q.z, p.yaw); kit.slot(at(u + 3.5, sw * 0.5).x, G, at(u + 3.5, sw * 0.5).z, Math.atan2(nx, nz), ['street']); }
    else if (r < 0.78) kit.slot(p.x, G, p.z, Math.atan2(nx, nz), ['street']);
    else if (r < 0.9) {
      // Steam grate on the road next to the curb: a spawn point for things that come up from the subway.
      const q = at(u, sw + 3.6);
      kit.box(q.x - 0.8, 0, q.z - 0.8, q.x + 0.8, 0.03, q.z + 0.8, 0x1c1b20, MAT.METAL);
      kit.spawn(q.x, 0, q.z, 'grate');
      kit.light(q.x, 0.2, q.z, 0xffffff, 0, 'steam');
    }
  }
}

function alley(kit, city, x0, z0, x1, z1, axis) {
  const { rng } = kit;
  const len = axis === 'z' ? z1 - z0 : x1 - x0;
  const w = axis === 'z' ? x1 - x0 : z1 - z0;
  for (let u = 6; u < len - 6; u += rng.range(14, 24)) {
    // Skip the alley crossing in the middle of the block.
    if (Math.abs(u - len / 2) < w) continue;
    const side = rng.chance(0.5) ? 1 : -1;
    const off = side * (w / 2 - 1.1);
    const cx = axis === 'z' ? (x0 + x1) / 2 + off : x0 + u;
    const cz = axis === 'z' ? z0 + u : (z0 + z1) / 2 + off;
    if (rng.chance(0.6)) placeProp(kit, 'dumpster', cx, G, cz, axis === 'z' ? 0 : Math.PI / 2, rng.pick([0x3d4a3a, 0x40424a, 0x4a3f36]));
    else placeProp(kit, 'crate', cx, G, cz);
    const sx = axis === 'z' ? (x0 + x1) / 2 : x0 + u + 3, sz = axis === 'z' ? z0 + u + 3 : (z0 + z1) / 2;
    kit.spawn(sx, G, sz, 'alley');
    if (rng.chance(0.4)) kit.slot(axis === 'z' ? (x0 + x1) / 2 - side * (w / 2 - 0.9) : x0 + u + 6, G, axis === 'z' ? z0 + u + 6 : (z0 + z1) / 2 - side * (w / 2 - 0.9), 0, ['alley']);
  }
  // Alley wall lamps.
  for (let u = 10; u < len; u += 26) {
    const cx = axis === 'z' ? x0 + 0.3 : x0 + u, cz = axis === 'z' ? z0 + u : z0 + 0.3;
    kit.light(cx, 4.5, cz, 0xffb36a, 6, 'alley');
  }
}

// The main avenue: a planted median with trees and double-headed lamps, broken at each cross street.
function avenue(kit, city) {
  const { rng, pal } = kit;
  const zc = city.avenue.zc;
  for (let m = 0; m < city.N; m++) {
    const x0 = city.W + m * (city.B + city.W) + 3, x1 = x0 + city.B - 6;
    kit.solid(x0, 0, zc - 1.1, x1, 0.35, zc + 1.1, 0x7a7680, MAT.STD, TAG.PROP);
    kit.box(x0 + 0.2, 0.35, zc - 0.9, x1 - 0.2, 0.42, zc + 0.9, 0x4a5a3a);
    for (let x = x0 + 7; x < x1 - 4; x += 14) {
      kit.prop('tree', x, 0.4, zc, rng.range(0, 6.28), rng.pick(pal.foliage));
      kit.collider(x - 0.25, 0.4, zc - 0.25, x + 0.25, 3.4, zc + 0.25, TAG.PROP);
    }
    for (let x = x0 + 14; x < x1 - 6; x += 28) {
      placeProp(kit, 'streetlight', x, 0.35, zc - 0.2, Math.PI);
      placeProp(kit, 'streetlight', x, 0.35, zc + 0.2, 0);
      kit.light(x, 6.6, zc - 1.8, pal.street, 9);
      kit.light(x, 6.6, zc + 1.8, pal.street, 9);
    }
  }
  kit.link('avenue', 'street', 'street', city.W, zc);
}

// "Subway" signs at every intersection, one per approach, with an arrow toward the station.
function wayfinding(kit, city) {
  const target = city.lots.find((l) => l.type === 'subway');
  if (!target) return;
  const tx = (target.rect.x0 + target.rect.x1) / 2, tz = (target.rect.z0 + target.rect.z1) / 2;
  const { N, B, W } = city;
  const h = 3.4;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const cx = i * (B + W) + W / 2, cz = j * (B + W) + W / 2;
    const dx = tx - cx, dz = tz - cz, l = Math.hypot(dx, dz) || 1;
    if (l < 40) continue;
    const off = W / 2 - 0.4;
    // [corner x, corner z, sign normal]: each faces the drivers/pedestrians approaching from one direction.
    for (const [ox, oz, nx, nz] of [[off, -off, -1, 0], [off, off, 0, -1], [-off, off, 1, 0], [-off, -off, 0, 1]]) {
      const px = cx + ox, pz = cz + oz;
      // Viewer looks along -n; screen-right is (nz, -nx).
      const fwd = (dx * -nx + dz * -nz) / l, right = (dx * nz + dz * -nx) / l;
      const arrow = Math.abs(fwd) >= Math.abs(right) ? (fwd > 0 ? '\u2191' : '\u2193') : right > 0 ? '\u2192' : '\u2190';
      kit.box(px - 0.05, 0, pz - 0.05, px + 0.05, h + 0.4, pz + 0.05, kit.pal.metal, MAT.METAL);
      kit.box(px - (nz ? 0.9 : 0.04), h - 0.3, pz - (nx ? 0.9 : 0.04), px + (nz ? 0.9 : 0.04), h + 0.3, pz + (nx ? 0.9 : 0.04), 0x24324a);
      kit.sign(`SUBWAY ${arrow}`, 'wayfind', px + nx * 0.06, h, pz + nz * 0.06, 1.7, 0.5, nx, nz, 0xe8eef6);
    }
  }
}
