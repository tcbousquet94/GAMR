// Multi-level navigation graph built from the physics world: every 1 m cell gets one node per standable surface.
// Edges: walk/step (small rise), jump-up (up to JUMP_UP), drop (any fall), short gap jumps, and climb volumes.
// Used by the city tests (reachability, routes), the bot (A* paths) and enemy AI (flow fields).

import { PHYS } from '../core/config.js';

const CELL = 1;
const JUMP_UP = 2.6; // double jump + mantle comfortably clears this
const MAX_DROP = 60;

export const EDGE = { WALK: 0, JUMP: 1, DROP: 2, CLIMB: 3, GAP: 4 };

export class NavGraph {
  constructor(world, size) {
    this.world = world;
    this.size = size;
    this.n = Math.ceil(size / CELL);
    this.cellNodes = new Map(); // cell index -> [node ids]
    this.x = []; this.y = []; this.z = [];
    this.adj = []; // node -> [neighbor, type, cost]*
    this.build();
  }

  cellIndex(ix, iz) { return iz * this.n + ix; }

  build() {
    const { world, n } = this;
    const r = PHYS.playerRadius, h = PHYS.playerHeight;
    // Candidate heights per cell: tops of solids whose footprint covers the cell centre.
    const cand = new Map();
    for (const b of world.solids.items) {
      if (b.maxY > 60 || b.maxY - b.minY > 150) continue; // boundary walls / sky-high tops
      const x0 = Math.max(0, Math.ceil(b.minX / CELL - 0.5)), x1 = Math.min(n - 1, Math.floor(b.maxX / CELL - 0.5));
      const z0 = Math.max(0, Math.ceil(b.minZ / CELL - 0.5)), z1 = Math.min(n - 1, Math.floor(b.maxZ / CELL - 0.5));
      for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
        const k = this.cellIndex(ix, iz);
        let a = cand.get(k);
        if (!a) cand.set(k, (a = []));
        a.push(b.maxY);
      }
    }
    for (const [k, heights] of cand) {
      const ix = k % n, iz = (k / n) | 0;
      const cx = (ix + 0.5) * CELL, cz = (iz + 0.5) * CELL;
      heights.sort((p, q) => p - q);
      let last = -Infinity;
      const ids = [];
      for (const y of heights) {
        if (y - last < 0.3) continue;
        // Must be the actual top here (nothing solid in the body volume) and a narrow body must fit.
        if (!world.fits(cx, y + 0.02, cz, 0.3, h)) continue;
        last = y;
        const id = this.x.length;
        this.x.push(cx); this.y.push(y); this.z.push(cz);
        this.adj.push([]);
        ids.push(id);
      }
      if (ids.length) this.cellNodes.set(k, ids);
    }
    // Neighbour edges.
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (const [k, ids] of this.cellNodes) {
      const ix = k % n, iz = (k / n) | 0;
      for (const [dx, dz] of dirs) {
        const jx = ix + dx, jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= n || jz >= n) continue;
        const other = this.cellNodes.get(this.cellIndex(jx, jz));
        if (!other) continue;
        const diag = dx !== 0 && dz !== 0;
        for (const a of ids) for (const b of other) {
          const dy = this.y[b] - this.y[a];
          let type = -1;
          if (Math.abs(dy) <= PHYS.stepHeight) type = EDGE.WALK;
          else if (dy > 0 && dy <= JUMP_UP) type = EDGE.JUMP;
          else if (dy < 0 && -dy <= MAX_DROP) type = EDGE.DROP;
          if (type < 0) continue;
          // Diagonals must not cut corners.
          if (diag && !this.hasNodeNear(ix + dx, iz, this.y[a], this.y[b]) && !this.hasNodeNear(ix, iz + dz, this.y[a], this.y[b])) continue;
          // Headroom check for drops/jumps: the path between must be clear of solids.
          if (type !== EDGE.WALK && !this.clearBetween(a, b)) continue;
          this.adj[a].push(b, type, (diag ? 1.414 : 1) * (type === EDGE.JUMP ? 2 : 1));
        }
      }
    }
    // Gap jumps: across 2-3 empty cells to a node at similar or lower height (planks, rooftop gaps, beams).
    for (const [k, ids] of this.cellNodes) {
      const ix = k % n, iz = (k / n) | 0;
      for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        for (let g = 2; g <= 3; g++) {
          const other = this.cellNodes.get(this.cellIndex(ix + dx * g, iz + dz * g));
          if (!other) continue;
          for (const a of ids) for (const b of other) {
            const dy = this.y[b] - this.y[a];
            if (dy > 0.8 || dy < -3) continue;
            if (this.y[a] < 1) continue; // street-level gaps are just walked around
            if (!this.clearBetween(a, b)) continue;
            this.adj[a].push(b, EDGE.GAP, g * 1.5);
          }
        }
      }
    }
    // Climb volumes: nodes beside a climb connect to nodes near its top.
    for (const b of world.climbs.items) {
      const near = this.nodesInRect(b.minX - 1.2, b.minZ - 1.2, b.maxX + 1.2, b.maxZ + 1.2);
      const bottoms = near.filter((i) => this.y[i] >= b.minY - 0.6 && this.y[i] <= b.maxY - 1.0);
      const tops = this.nodesInRect(b.minX - 2.2, b.minZ - 2.2, b.maxX + 2.2, b.maxZ + 2.2).filter((i) => this.y[i] > b.minY + 1 && this.y[i] <= b.maxY + 0.6); // the top, or any landing on the way up
      for (const a of bottoms) for (const t of tops) {
        if (this.y[t] - this.y[a] < 1) continue;
        this.adj[a].push(t, EDGE.CLIMB, (this.y[t] - this.y[a]) * 1.4 + 2);
        // Climbing down is also possible.
        this.adj[t].push(a, EDGE.DROP, (this.y[t] - this.y[a]) * 1.0 + 2);
      }
    }
  }

  hasNodeNear(ix, iz, ya, yb) {
    const ids = this.cellNodes.get(this.cellIndex(ix, iz));
    if (!ids) return false;
    const lo = Math.min(ya, yb) - 0.7, hi = Math.max(ya, yb) + 0.7;
    return ids.some((i) => this.y[i] >= lo && this.y[i] <= hi);
  }

  clearBetween(a, b) {
    const y = Math.max(this.y[a], this.y[b]) + 0.1;
    const mx = (this.x[a] + this.x[b]) / 2, mz = (this.z[a] + this.z[b]) / 2;
    return this.world.fits(mx, y, mz, 0.25, PHYS.playerHeight);
  }

  nodesInRect(x0, z0, x1, z1) {
    const out = [];
    for (let iz = Math.max(0, Math.floor(z0 / CELL)); iz <= Math.min(this.n - 1, Math.floor(z1 / CELL)); iz++)
      for (let ix = Math.max(0, Math.floor(x0 / CELL)); ix <= Math.min(this.n - 1, Math.floor(x1 / CELL)); ix++) {
        const ids = this.cellNodes.get(this.cellIndex(ix, iz));
        if (ids) out.push(...ids);
      }
    return out;
  }

  // Closest node to a point (prefers nodes at or just below y).
  nearest(x, y, z, radius = 3) {
    let best = -1, bd = Infinity;
    for (const i of this.nodesInRect(x - radius, z - radius, x + radius, z + radius)) {
      const dy = this.y[i] - y;
      const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2 + (dy > 0.7 ? dy * dy * 9 : dy * dy * 2);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  reachableFrom(start) {
    const seen = new Uint8Array(this.x.length);
    const q = [start];
    seen[start] = 1;
    while (q.length) {
      const a = q.pop();
      const e = this.adj[a];
      for (let i = 0; i < e.length; i += 3) if (!seen[e[i]]) { seen[e[i]] = 1; q.push(e[i]); }
    }
    return seen;
  }

  // A* from a to b. Returns [{x,y,z,type}] (type = edge used to arrive) or null.
  path(a, b, maxExpand = 400000) {
    const N = this.x.length;
    const g = new Float32Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const via = new Int8Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();
    const hx = this.x[b], hy = this.y[b], hz = this.z[b];
    const hfn = (i) => Math.hypot(this.x[i] - hx, (this.y[i] - hy) * 0.5, this.z[i] - hz);
    g[a] = 0;
    heap.push(a, hfn(a));
    let expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === b) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (++expanded > maxExpand) return null;
      const e = this.adj[cur];
      for (let i = 0; i < e.length; i += 3) {
        const nb = e[i];
        const ng = g[cur] + e[i + 2];
        if (ng < g[nb]) { g[nb] = ng; from[nb] = cur; via[nb] = e[i + 1]; heap.push(nb, ng + hfn(nb)); }
      }
    }
    if (from[b] < 0 && a !== b) return null;
    const out = [];
    for (let c = b; c !== -1; c = from[c]) out.push({ x: this.x[c], y: this.y[c], z: this.z[c], type: via[c], id: c });
    return out.reverse();
  }
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(item, pri) {
    const { k, v } = this;
    k.push(item); v.push(pri);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (v[p] <= v[i]) break;
      [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop() {
    const { k, v } = this;
    const top = k[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < k.length && v[l] < v[m]) m = l;
        if (r < k.length && v[r] < v[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

// Region of a point for the two-routes test: lot id, or a street/alley id.
export function regionOf(city, x, z) {
  for (const lot of city.lots) {
    const r = lot.rect;
    if (x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) return `lot${lot.id}`;
  }
  const step = city.B + city.W;
  const bi = Math.floor((x - city.W) / step), bj = Math.floor((z - city.W) / step);
  const inBX = x - city.W - bi * step < city.B && bi >= 0 && bi < city.N;
  const inBZ = z - city.W - bj * step < city.B && bj >= 0 && bj < city.N;
  if (inBX && inBZ) return `alley${bi},${bj}`; // inside a block but not in a lot
  if (inBX) return `st-h${bi},${Math.round((z - city.W / 2) / step)}`; // horizontal street segment
  if (inBZ) return `st-v${Math.round((x - city.W / 2) / step)},${bj}`;
  return `int${Math.round((x - city.W / 2) / step)},${Math.round((z - city.W / 2) / step)}`; // intersection
}
