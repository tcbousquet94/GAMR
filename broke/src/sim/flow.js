// Coarse street-level flow field toward the player for ground enemies. 2 m cells; each cell stores ground height
// and whether a body fits, and each pair of neighbouring cells whether a wall stands between them (a fence or a
// wall between two open cells would otherwise read as a way through). Rebuilt from the player's cell a few times per
// second (BFS, ~100k cells).

const CELL = 2;

export class FlowField {
  constructor(world, size) {
    this.world = world;
    this.n = Math.ceil(size / CELL);
    const N = this.n * this.n;
    this.ground = new Float32Array(N);
    this.free = new Uint8Array(N);
    this.dist = new Uint16Array(N).fill(65535);
    this.queue = new Int32Array(N);
    for (let iz = 0; iz < this.n; iz++) for (let ix = 0; ix < this.n; ix++) {
      const x = (ix + 0.5) * CELL, z = (iz + 0.5) * CELL;
      const gy = world.groundBelow(x, 3.0, z, 0.3, 12);
      const i = iz * this.n + ix;
      this.ground[i] = Number.isFinite(gy) ? gy : -99;
      this.free[i] = Number.isFinite(gy) && world.fits(x, gy + 0.05, z, 0.45, 1.8) ? 1 : 0;
    }
    // Walls between neighbours: bit 1 = blocked to the east (ix + 1), bit 2 = blocked to the south (iz + 1). Tested
    // at hip and head height above the higher of the two cells, so kerbs and low steps stay open.
    this.wall = new Uint8Array(N);
    const n = this.n;
    const cut = (x0, z0, x1, z1, y) => !world.segmentClear({ x: x0, y: y + 0.9, z: z0 }, { x: x1, y: y + 0.9, z: z1 }) || !world.segmentClear({ x: x0, y: y + 1.5, z: z0 }, { x: x1, y: y + 1.5, z: z1 });
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
      const i = iz * n + ix;
      if (!this.free[i]) continue;
      const x = (ix + 0.5) * CELL, z = (iz + 0.5) * CELL;
      if (ix + 1 < n && this.free[i + 1] && cut(x, z, x + CELL, z, Math.max(this.ground[i], this.ground[i + 1]))) this.wall[i] |= 1;
      if (iz + 1 < n && this.free[i + n] && cut(x, z, x, z + CELL, Math.max(this.ground[i], this.ground[i + n]))) this.wall[i] |= 2;
    }
    this.origin = -1;
  }

  // Is the step between orthogonal neighbours a and b walled off?
  walled(a, b) {
    const d = b - a;
    if (d === 1) return (this.wall[a] & 1) !== 0;
    if (d === -1) return (this.wall[b] & 1) !== 0;
    if (d === this.n) return (this.wall[a] & 2) !== 0;
    return (this.wall[b] & 2) !== 0;
  }

  idx(x, z) {
    const ix = Math.floor(x / CELL), iz = Math.floor(z / CELL);
    if (ix < 0 || iz < 0 || ix >= this.n || iz >= this.n) return -1;
    return iz * this.n + ix;
  }

  // BFS outward from the target. Moving A->B is allowed if B is at most 1.6 m higher than A.
  build(tx, tz) {
    const start = this.idx(tx, tz);
    if (start < 0) return;
    this.origin = start;
    const { n, dist, free, ground, queue } = this;
    dist.fill(65535);
    let head = 0, tail = 0;
    // Seed the start cell and, if it's blocked (player on a roof), its free neighbours within a few cells.
    const seeds = [start];
    if (!free[start]) {
      const sx = start % n, sz = (start / n) | 0;
      for (let r = 1; r <= 6 && seeds.length < 2; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const jx = sx + dx, jz = sz + dz;
        if (jx >= 0 && jz >= 0 && jx < n && jz < n && free[jz * n + jx]) seeds.push(jz * n + jx);
      }
    }
    for (const s of seeds) { dist[s] = 0; queue[tail++] = s; }
    while (head < tail) {
      const b = queue[head++];
      const bx = b % n, bz = (b / n) | 0;
      const nd = dist[b] + 1;
      for (let k = 0; k < 4; k++) {
        const ax = bx + (k === 0 ? 1 : k === 1 ? -1 : 0), az = bz + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (ax < 0 || az < 0 || ax >= n || az >= n) continue;
        const a = az * n + ax;
        if (!free[a] || dist[a] <= nd) continue;
        if (ground[b] - ground[a] > 1.6) continue; // a -> b would be too big a step up
        if (this.walled(a, b)) continue;
        dist[a] = nd;
        queue[tail++] = a;
      }
    }
  }

  // Direction (unit xz) to walk from (x, z), or null if unknown.
  dir(x, z) {
    const i = this.idx(x, z);
    if (i < 0) return null;
    const { n, dist } = this;
    let best = dist[i], bi = -1;
    const ix = i % n, iz = (i / n) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const jx = ix + dx, jz = iz + dz;
      if (jx < 0 || jz < 0 || jx >= n || jz >= n) continue;
      const j = jz * n + jx;
      // Diagonals only if both orthogonal neighbours are open (no corner cutting).
      if (dx && dz && (dist[iz * n + jx] === 65535 || dist[jz * n + ix] === 65535)) continue;
      if (dx && dz ? this.walled(i, iz * n + jx) || this.walled(i, jz * n + ix) || this.walled(iz * n + jx, j) || this.walled(jz * n + ix, j) : this.walled(i, j)) continue;
      if (dist[j] < best) { best = dist[j]; bi = j; }
    }
    if (bi < 0) return null;
    const tx = ((bi % n) + 0.5) * CELL, tz = (((bi / n) | 0) + 0.5) * CELL;
    const l = Math.hypot(tx - x, tz - z) || 1;
    return { x: (tx - x) / l, z: (tz - z) / l, d: best };
  }

  distAt(x, z) { const i = this.idx(x, z); return i < 0 ? 65535 : this.dist[i]; }
  groundAt(x, z) { const i = this.idx(x, z); return i < 0 ? -99 : this.ground[i]; }
}
