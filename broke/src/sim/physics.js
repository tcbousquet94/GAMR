// Static AABB world with a uniform spatial hash, swept body movement (axis-separated, with step-up and
// ledge mantling), and raycasts. Everything in the city that you can stand on or bump into is an AABB.

import { PHYS } from '../core/config.js';

const CELL = 8;

export class Box {
  constructor(minX, minY, minZ, maxX, maxY, maxZ, tag = 0) {
    this.minX = Math.min(minX, maxX); this.maxX = Math.max(minX, maxX);
    this.minY = Math.min(minY, maxY); this.maxY = Math.max(minY, maxY);
    this.minZ = Math.min(minZ, maxZ); this.maxZ = Math.max(minZ, maxZ);
    this.tag = tag;
    this.id = 0;
    this.stamp = 0;
  }
}

class Hash {
  constructor() { this.cells = new Map(); this.items = []; this.stamp = 0; }
  key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
  add(b) {
    b.id = this.items.length;
    this.items.push(b);
    const x0 = Math.floor(b.minX / CELL), x1 = Math.floor(b.maxX / CELL);
    const z0 = Math.floor(b.minZ / CELL), z1 = Math.floor(b.maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const k = this.key(ix, iz);
      let c = this.cells.get(k);
      if (!c) this.cells.set(k, (c = []));
      c.push(b);
    }
  }
  // Calls fn for each box whose XZ cell range overlaps the query rect (deduped).
  query(minX, minZ, maxX, maxZ, out) {
    const s = ++this.stamp;
    out.length = 0;
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const c = this.cells.get(this.key(ix, iz));
      if (!c) continue;
      for (const b of c) { if (b.stamp !== s) { b.stamp = s; out.push(b); } }
    }
    return out;
  }
}

const tmp = [];
const EPS = 1e-4;

export class World {
  constructor() {
    this.solids = new Hash();
    this.climbs = new Hash();
    this.bounds = { minX: -1e9, minZ: -1e9, maxX: 1e9, maxZ: 1e9 };
  }
  addSolid(b) { this.solids.add(b); return b; }
  addClimb(b) { this.climbs.add(b); return b; }

  overlapsSolid(minX, minY, minZ, maxX, maxY, maxZ) {
    const list = this.solids.query(minX, minZ, maxX, maxZ, tmp);
    for (const b of list) {
      if (maxX > b.minX + EPS && minX < b.maxX - EPS && maxY > b.minY + EPS && minY < b.maxY - EPS &&
          maxZ > b.minZ + EPS && minZ < b.maxZ - EPS) return b;
    }
    return null;
  }

  // Body footprint is a square of half-width r. Returns true if the body would fit at (x, y, z).
  fits(x, y, z, r, h) { return !this.overlapsSolid(x - r, y, z - r, x + r, y + h, z + r); }

  climbAt(x, y, z, r, h, reach = 0) {
    const list = this.climbs.query(x - r - reach, z - r - reach, x + r + reach, z + r + reach, tmp);
    for (const b of list) {
      if (x + r + reach > b.minX && x - r - reach < b.maxX && z + r + reach > b.minZ && z - r - reach < b.maxZ &&
          y + h > b.minY && y < b.maxY) return b;
    }
    return null;
  }

  // Highest solid top below (x, y, z) within maxDrop, for a footprint of half-width r. -Infinity if none.
  groundBelow(x, y, z, r = 0.05, maxDrop = 200) {
    const list = this.solids.query(x - r, z - r, x + r, z + r, tmp);
    let best = -Infinity;
    for (const b of list) {
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) {
        if (b.maxY <= y + EPS && b.maxY > best && b.maxY >= y - maxDrop) best = b.maxY;
      }
    }
    return best;
  }

  // Ray vs solids. Returns distance t (0..maxT) of the first hit, or maxT if nothing was hit.
  raycast(ox, oy, oz, dx, dy, dz, maxT, hit = null) {
    let best = maxT;
    let bestBox = null;
    const step = CELL * 0.5;
    const s = ++this.solids.stamp;
    for (let t0 = 0; t0 < best; t0 += step) {
      const t1 = Math.min(t0 + step, best);
      const ax = ox + dx * t0, az = oz + dz * t0, bx = ox + dx * t1, bz = oz + dz * t1;
      const x0 = Math.floor(Math.min(ax, bx) / CELL), x1 = Math.floor(Math.max(ax, bx) / CELL);
      const z0 = Math.floor(Math.min(az, bz) / CELL), z1 = Math.floor(Math.max(az, bz) / CELL);
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
        const c = this.solids.cells.get(this.solids.key(ix, iz));
        if (!c) continue;
        for (const b of c) {
          if (b.stamp === s) continue;
          b.stamp = s;
          const t = rayBox(ox, oy, oz, dx, dy, dz, b);
          if (t >= 0 && t < best) { best = t; bestBox = b; }
        }
      }
    }
    if (hit) hit.box = bestBox;
    return best;
  }

  segmentClear(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return true;
    return this.raycast(a.x, a.y, a.z, dx / len, dy / len, dz / len, len) >= len - 1e-3;
  }
}

export function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = -Infinity, tmax = Infinity;
  const axes = [[ox, dx, b.minX, b.maxX], [oy, dy, b.minY, b.maxY], [oz, dz, b.minZ, b.maxZ]];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return -1; continue; }
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    if (t1 > t2) { const k = t1; t1 = t2; t2 = k; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (tmax < 0) return -1;
  return tmin >= 0 ? tmin : 0;
}

// A body is { pos:{x,y,z} (feet), vel:{x,y,z}, r, h, onGround, blocked, blockNX, blockNZ, canStep, canMantle }.
// Moves it through the world for dt seconds. Fills body.blocked/blockNX/blockNZ for the last horizontal hit.
export function moveBody(body, world, dt) {
  const { vel } = body;
  const travel = Math.max(Math.abs(vel.x), Math.abs(vel.y), Math.abs(vel.z)) * dt;
  const n = Math.min(12, Math.max(1, Math.ceil(travel / 0.3)));
  const sdt = dt / n;
  const wasGround = body.onGround;
  body.onGround = false;
  body.blocked = false;
  body.mantled = false;
  for (let i = 0; i < n; i++) {
    stepAxisY(body, world, vel.y * sdt);
    stepAxisH(body, world, 'x', vel.x * sdt, wasGround);
    stepAxisH(body, world, 'z', vel.z * sdt, wasGround);
  }
  // Ground probe so standing still keeps onGround true.
  if (!body.onGround && vel.y <= 0) {
    const p = body.pos;
    if (world.overlapsSolid(p.x - body.r, p.y - 0.06, p.z - body.r, p.x + body.r, p.y, p.z + body.r)) body.onGround = true;
  }
  const B = world.bounds;
  const p = body.pos;
  if (p.x < B.minX) { p.x = B.minX; vel.x = Math.max(0, vel.x); }
  if (p.x > B.maxX) { p.x = B.maxX; vel.x = Math.min(0, vel.x); }
  if (p.z < B.minZ) { p.z = B.minZ; vel.z = Math.max(0, vel.z); }
  if (p.z > B.maxZ) { p.z = B.maxZ; vel.z = Math.min(0, vel.z); }
}

function stepAxisY(body, world, dy) {
  if (dy === 0) return;
  const p = body.pos, r = body.r, h = body.h;
  const ny = p.y + dy;
  const b = world.overlapsSolid(p.x - r, ny, p.z - r, p.x + r, ny + h, p.z + r);
  if (!b) { p.y = ny; return; }
  if (dy < 0) {
    // Land on the highest box we intersect.
    let top = b.maxY;
    const list = world.solids.query(p.x - r, p.z - r, p.x + r, p.z + r, tmp);
    for (const o of list) {
      if (p.x + r > o.minX && p.x - r < o.maxX && p.z + r > o.minZ && p.z - r < o.maxZ && ny < o.maxY && ny + h > o.minY && o.maxY <= p.y + EPS)
        top = Math.max(top, o.maxY);
    }
    p.y = Math.min(p.y, top);
    body.onGround = true;
  } else {
    p.y = Math.max(p.y, b.minY - h - EPS);
  }
  body.vel.y = 0;
}

function stepAxisH(body, world, axis, d, wasGround) {
  if (d === 0) return;
  const p = body.pos, r = body.r, h = body.h;
  const nx = axis === 'x' ? p.x + d : p.x;
  const nz = axis === 'z' ? p.z + d : p.z;
  const b = world.overlapsSolid(nx - r, p.y, nz - r, nx + r, p.y + h, nz + r);
  if (!b) { p.x = nx; p.z = nz; return; }
  // Step up onto low things (curbs, stairs).
  const rise = b.maxY - p.y;
  if ((body.onGround || wasGround) && body.canStep !== false && rise > 0 && rise <= PHYS.stepHeight) {
    if (world.fits(nx, b.maxY + EPS, nz, r, h)) {
      const top = topAt(world, nx, nz, r, p.y + PHYS.stepHeight + EPS, p.y);
      p.x = nx; p.z = nz; p.y = top + EPS; body.onGround = true;
      return;
    }
  }
  // Mantle onto ledges while airborne (or rising), so jumping at a dumpster or car vaults you onto it.
  if (body.canMantle && !body.onGround && rise > 0 && rise <= PHYS.mantleReach && body.vel.y > -14) {
    if (world.fits(nx, b.maxY + EPS, nz, r, h)) {
      p.x = nx; p.z = nz; p.y = b.maxY + EPS; body.vel.y = Math.max(0, body.vel.y * 0.2); body.onGround = true; body.mantled = true;
      return;
    }
  }
  // Blocked: slide flush against the face.
  if (axis === 'x') {
    p.x = d > 0 ? b.minX - r - EPS : b.maxX + r + EPS;
    if (!world.fits(p.x, p.y, p.z, r, h)) p.x = nx - d; // stay put if snapping would overlap something else
    body.vel.x = 0; body.blockNX = d > 0 ? -1 : 1; body.blockNZ = 0;
  } else {
    p.z = d > 0 ? b.minZ - r - EPS : b.maxZ + r + EPS;
    if (!world.fits(p.x, p.y, p.z, r, h)) p.z = nz - d;
    body.vel.z = 0; body.blockNZ = d > 0 ? -1 : 1; body.blockNX = 0;
  }
  body.blocked = true;
  body.blockBox = b;
}

function topAt(world, x, z, r, maxY, minY) {
  const list = world.solids.query(x - r, z - r, x + r, z + r, tmp);
  let top = minY;
  for (const o of list) {
    if (x + r > o.minX && x - r < o.maxX && z + r > o.minZ && z - r < o.maxZ && o.maxY <= maxY && o.maxY > top) top = o.maxY;
  }
  return top;
}

export function makeBody(x, y, z, r = PHYS.playerRadius, h = PHYS.playerHeight) {
  return { pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, r, h, onGround: false, blocked: false, blockNX: 0, blockNZ: 0, canStep: true, canMantle: true };
}
