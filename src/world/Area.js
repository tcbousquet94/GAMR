import * as THREE from 'three';

// Base class for explorable areas (town, school hallway, ...). It provides the same world API the
// courtyard Environment does, so Player / CameraRig / Combat / party code work unchanged:
//   getGroundHeight, resolveCollision, segmentBlocked, colliders, bounds, playerSpawn, partySpawns, update.
// On top of that an area has named spawns, door triggers and (later) NPCs.
//
// Colliders:
//   { type: 'box', minX, maxX, minZ, maxZ, h }   walls, buildings (h = height, used for camera collision)
//   { type: 'circle', x, z, r, h, camR }          trees, poles (camR = radius the camera avoids, e.g. a canopy)
// Doors: { minX, maxX, minZ, maxZ, to, spawn } or { ..., message: { speaker, text } } for locked ones.

export class Area {
  constructor(game, id) {
    this.game = game;
    this.id = id;
    this.root = new THREE.Group();
    this.root.name = id;
    this.colliders = [];
    this.bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
    this.spawns = {};       // name -> { pos: Vector3, yaw }
    this.doors = [];
    this.npcs = [];
    this.center = new THREE.Vector3();
    this.background = 0xa8dcff;
    this.fog = { color: 0xf3f0c8, near: 45, far: 110 };
    this.t = 0;
  }

  // Default spawn, read by Player/PartyMember constructors.
  get playerSpawn() { return this.spawns.default?.pos ?? this.center; }
  get playerSpawnYaw() { return this.spawns.default?.yaw ?? 0; }
  get partySpawns() { return [this.playerSpawn, this.playerSpawn]; }

  addSpawn(name, x, z, yaw) {
    this.spawns[name] = { pos: new THREE.Vector3(x, 0, z), yaw };
  }

  // Solid box from its footprint (centered x/z, width along X, depth along Z).
  solid(x, z, w, d, h = 4) {
    this.colliders.push({ type: 'box', minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h });
  }

  post(x, z, r, h = 3, camR = 0) {
    this.colliders.push({ type: 'circle', x, z, r, h, camR });
  }

  door(x, z, w, d, target) {
    this.doors.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, ...target });
  }

  // Called when the area becomes active / inactive.
  enter() {}
  exit() {}

  getGroundHeight() {
    return 0;
  }

  resolveCollision(pos, radius) {
    let hit = false;
    const cs = this.colliders;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.type === 'circle') {
        const rr = c.r + radius;
        const dx = pos.x - c.x, dz = pos.z - c.z;
        if (dx > rr || dx < -rr || dz > rr || dz < -rr) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2);
        if (d < 1e-5) pos.x = c.x + rr;
        else { pos.x = c.x + (dx / d) * rr; pos.z = c.z + (dz / d) * rr; }
        hit = true;
      } else {
        if (pos.x < c.minX - radius || pos.x > c.maxX + radius || pos.z < c.minZ - radius || pos.z > c.maxZ + radius) continue;
        const cx = pos.x < c.minX ? c.minX : pos.x > c.maxX ? c.maxX : pos.x;
        const cz = pos.z < c.minZ ? c.minZ : pos.z > c.maxZ ? c.maxZ : pos.z;
        const dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > 1e-10) {
          if (d2 >= radius * radius) continue;
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // Center inside the box: leave through the nearest face.
          const l = pos.x - c.minX, r = c.maxX - pos.x, n = pos.z - c.minZ, s = c.maxZ - pos.z;
          const m = Math.min(l, r, n, s);
          if (m === l) pos.x = c.minX - radius;
          else if (m === r) pos.x = c.maxX + radius;
          else if (m === n) pos.z = c.minZ - radius;
          else pos.z = c.maxZ + radius;
        }
        hit = true;
      }
    }
    const B = this.bounds;
    if (pos.x < B.minX + radius) { pos.x = B.minX + radius; hit = true; }
    else if (pos.x > B.maxX - radius) { pos.x = B.maxX - radius; hit = true; }
    if (pos.z < B.minZ + radius) { pos.z = B.minZ + radius; hit = true; }
    else if (pos.z > B.maxZ - radius) { pos.z = B.maxZ - radius; hit = true; }
    return hit;
  }

  // Fraction along from->to where the segment first hits a box or a tall circle (camR), else 1.
  segmentBlocked(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    let best = 1;
    const cs = this.colliders;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.type === 'circle') {
        if (!c.camR) continue;
        // Ray vs vertical cylinder (xz circle), then check height at the hit.
        const ox = from.x - c.x, oz = from.z - c.z;
        const a = dx * dx + dz * dz;
        if (a < 1e-9) continue;
        const b = ox * dx + oz * dz;
        const cc = ox * ox + oz * oz - c.camR * c.camR;
        if (cc < 0) continue; // starts inside
        const disc = b * b - a * cc;
        if (disc < 0) continue;
        const t = (-b - Math.sqrt(disc)) / a;
        if (t < 0 || t >= best) continue;
        if (from.y + dy * t > c.h) continue;
        best = t;
        continue;
      }
      if (!c.h) continue;
      let t0 = 0, t1 = best;
      if (Math.abs(dx) < 1e-9) { if (from.x < c.minX || from.x > c.maxX) continue; }
      else {
        let a = (c.minX - from.x) / dx, b = (c.maxX - from.x) / dx;
        if (a > b) { const t = a; a = b; b = t; }
        if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue;
      }
      if (Math.abs(dz) < 1e-9) { if (from.z < c.minZ || from.z > c.maxZ) continue; }
      else {
        let a = (c.minZ - from.z) / dz, b = (c.maxZ - from.z) / dz;
        if (a > b) { const t = a; a = b; b = t; }
        if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue;
      }
      if (Math.abs(dy) < 1e-9) { if (from.y < -1 || from.y > c.h) continue; }
      else {
        let a = (-1 - from.y) / dy, b = (c.h - from.y) / dy;
        if (a > b) { const t = a; a = b; b = t; }
        if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue;
      }
      if (t0 <= 0 && from.x > c.minX && from.x < c.maxX && from.z > c.minZ && from.z < c.maxZ && from.y < c.h) continue;
      if (t0 < best) best = t0;
    }
    return best < 0 ? 0 : best;
  }

  update(dt) {
    this.t += dt;
  }
}
