// Road skeleton and territory blocks, as pure 2D data (no geometry yet).
//
// The district is a grid of cols x rows cells with jittered sizes, separated by streets. Some interior street
// segments are pedestrianised: the two cells on either side merge into one territory block with a paved mews where
// the street was (or, with roads.keepStreets, merge as territory while the street stays open). An optional diagonal
// avenue cuts corner to corner. Coordinates: x east, z south, metres; y is up.

export function layoutRoads(cfg, rng) {
  const R = cfg.roads;
  const S = R.street, E = cfg.edgeDepth;
  const widths = Array.from({ length: R.cols }, () => Math.round(rng.range(R.cell[0], R.cell[1])));
  const depths = Array.from({ length: R.rows }, () => Math.round(rng.range(R.cell[0], R.cell[1])));
  // Street hierarchy (roads.hierarchy): avenues through the middle, ordinary streets, narrow residential streets out
  // toward the edges; the outer ring stays an ordinary street (the edges are built against it). Widths include both
  // sidewalks. Without a hierarchy every street is roads.street wide.
  const H = R.hierarchy;
  const classOf = (k, n) => {
    if (!H || k === 0 || k === n) return 'street';
    const mid = Math.round(n / 2);
    if ((k - mid) % H.avenueEvery === 0) return 'avenue';
    return Math.abs(k - n / 2) / (n / 2) > H.localBeyond ? 'local' : 'street';
  };
  const widthOf = (c) => (H ? H.width[c] : S);
  const KX = Array.from({ length: R.cols + 1 }, (_, k) => classOf(k, R.cols)), KZ = Array.from({ length: R.rows + 1 }, (_, k) => classOf(k, R.rows));
  const SX = KX.map(widthOf), SZ = KZ.map(widthOf);
  // Street k starts at X[k] and is SX[k] wide; cell i spans X[i] + SX[i] .. X[i + 1].
  const X = [E], Z = [E];
  for (let i = 0; i < R.cols; i++) X.push(X[i] + SX[i] + widths[i]);
  for (let j = 0; j < R.rows; j++) Z.push(Z[j] + SZ[j] + depths[j]);
  const sizeX = X[R.cols] + SX[R.cols] + E, sizeZ = Z[R.rows] + SZ[R.rows] + E;

  const cells = [];
  for (let j = 0; j < R.rows; j++) for (let i = 0; i < R.cols; i++) {
    cells.push({ i, j, rect: { x0: X[i] + SX[i], z0: Z[j] + SZ[j], x1: X[i + 1], z1: Z[j + 1] }, block: -1 });
  }
  const cellAt = (i, j) => (i >= 0 && j >= 0 && i < R.cols && j < R.rows ? cells[j * R.cols + i] : null);

  // Street segments between intersections. 'v' runs north-south along street column k, between rows j and j+1
  // intersections; 'h' runs east-west along street row k between columns.
  const segs = [];
  for (let k = 0; k <= R.cols; k++) for (let j = 0; j < R.rows; j++) {
    segs.push({ id: segs.length, axis: 'v', k, m: j, rect: { x0: X[k], z0: Z[j] + SZ[j], x1: X[k] + SX[k], z1: Z[j + 1] }, a: [k, j], b: [k, j + 1], open: true, kind: KX[k] });
  }
  for (let k = 0; k <= R.rows; k++) for (let i = 0; i < R.cols; i++) {
    segs.push({ id: segs.length, axis: 'h', k, m: i, rect: { x0: X[i] + SX[i], z0: Z[k], x1: X[i + 1], z1: Z[k] + SZ[k] }, a: [i, k], b: [i + 1, k], open: true, kind: KZ[k] });
  }
  const interKey = (a) => `${a[0]},${a[1]}`;

  // Pedestrianise interior segments until the block count lands in the target range, keeping every intersection
  // on at least two open streets (no dead-end stubs) and the street network in one piece.
  const parent = cells.map((_, n) => n);
  const find = (n) => (parent[n] === n ? n : (parent[n] = find(parent[n])));
  const sizeOf = (n) => cells.filter((_, q) => find(q) === find(n)).length;
  const target = rng.int(R.blockTarget[0], R.blockTarget[1]);
  const interior = rng.shuffle(segs.filter((s) => (s.axis === 'v' ? s.k > 0 && s.k < R.cols : s.k > 0 && s.k < R.rows)));
  let blocks = cells.length;
  for (const s of interior) {
    if (blocks <= target) break;
    const [ca, cb] = s.axis === 'v' ? [cellAt(s.k - 1, s.m), cellAt(s.k, s.m)] : [cellAt(s.m, s.k - 1), cellAt(s.m, s.k)];
    const na = cells.indexOf(ca), nb = cells.indexOf(cb);
    if (find(na) === find(nb) || sizeOf(na) + sizeOf(nb) > 3) continue;
    // keepStreets: the cells still merge into one territory block, but the street between them stays a street.
    if (!R.keepStreets) {
      s.open = false;
      if (!roadsOk(segs, interKey)) { s.open = true; continue; }
    }
    parent[find(na)] = find(nb);
    s.mergedCells = [na, nb];
    blocks--;
  }

  // Diagonal avenue, south-west corner to north-east corner, centred on the outer street intersections.
  const D = R.diagonal;
  const diag = D ? {
    ax: X[0] + SX[0] / 2, az: Z[R.rows] + SZ[R.rows] / 2, bx: X[R.cols] + SX[R.cols] / 2, bz: Z[0] + SZ[0] / 2, width: D.width,
  } : null;

  // Territory blocks: groups of merged cells, plus the strips of the streets that were removed between them.
  const groups = new Map();
  cells.forEach((c, n) => { const r = find(n); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); });
  const blockList = [];
  for (const g of groups.values()) {
    const id = blockList.length;
    for (const c of g) c.block = id;
    const rects = g.map((c) => ({ ...c.rect }));
    const mews = [];
    for (const s of segs) if (!s.open && s.mergedCells && g.includes(cells[s.mergedCells[0]])) { rects.push({ ...s.rect }); mews.push({ ...s.rect, axis: s.axis }); }
    const bb = bounds(rects);
    blockList.push({ id, cells: g.map((c) => [c.i, c.j]), rects, mews, bounds: bb, center: { x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2 } });
  }

  // Adjacency: two blocks border each other when their cells face each other across an open street.
  const adj = blockList.map(() => new Set());
  for (const c of cells) for (const [di, dj] of [[1, 0], [0, 1]]) {
    const d = cellAt(c.i + di, c.j + dj);
    if (d && d.block !== c.block) { adj[c.block].add(d.block); adj[d.block].add(c.block); }
  }
  blockList.forEach((b, n) => { b.adjacent = [...adj[n]].sort((p, q) => p - q); });

  const intersections = [];
  for (let k = 0; k <= R.cols; k++) for (let m = 0; m <= R.rows; m++) {
    const deg = segs.filter((s) => s.open && (interKey(s.a) === `${k},${m}` || interKey(s.b) === `${k},${m}`)).length;
    intersections.push({ k, m, x: X[k] + SX[k] / 2, z: Z[m] + SZ[m] / 2, rect: { x0: X[k], z0: Z[m], x1: X[k] + SX[k], z1: Z[m] + SZ[m] }, degree: deg, outer: k === 0 || m === 0 || k === R.cols || m === R.rows });
  }
  return { X, Z, S, SX, SZ, KX, KZ, E, sizeX, sizeZ, size: Math.max(sizeX, sizeZ), cols: R.cols, rows: R.rows, cells, segs, blocks: blockList, intersections, diag, cellAt };
}

function roadsOk(segs, key) {
  const deg = new Map(), adj = new Map();
  for (const s of segs) {
    for (const p of [s.a, s.b]) { const k = key(p); if (!deg.has(k)) { deg.set(k, 0); adj.set(k, []); } }
    if (!s.open) continue;
    const a = key(s.a), b = key(s.b);
    deg.set(a, deg.get(a) + 1); deg.set(b, deg.get(b) + 1);
    adj.get(a).push(b); adj.get(b).push(a);
  }
  for (const d of deg.values()) if (d < 2) return false;
  const start = deg.keys().next().value, seen = new Set([start]), q = [start];
  while (q.length) for (const n of adj.get(q.pop())) if (!seen.has(n)) { seen.add(n); q.push(n); }
  return seen.size === deg.size;
}

export function bounds(rects) {
  const b = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (const r of rects) { b.x0 = Math.min(b.x0, r.x0); b.z0 = Math.min(b.z0, r.z0); b.x1 = Math.max(b.x1, r.x1); b.z1 = Math.max(b.z1, r.z1); }
  return b;
}

// Distance from a point to the diagonal's centre line (Infinity without a diagonal).
export function diagDist(diag, x, z) {
  if (!diag) return Infinity;
  const dx = diag.bx - diag.ax, dz = diag.bz - diag.az, L2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((x - diag.ax) * dx + (z - diag.az) * dz) / L2));
  return Math.hypot(x - (diag.ax + dx * t), z - (diag.az + dz * t));
}

// Does an axis-aligned rect touch the diagonal band (plus margin)?
export function rectHitsDiag(diag, r, margin = 0) {
  if (!diag) return false;
  const half = diag.width / 2 + margin;
  // Check the rect's corners, centre and edge midpoints, and the band's centre line sampled through the rect.
  const pts = [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1], [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]];
  for (const [x, z] of pts) if (diagDist(diag, x, z) < half) return true;
  const n = Math.ceil(Math.hypot(diag.bx - diag.ax, diag.bz - diag.az) / 2);
  for (let s = 0; s <= n; s++) {
    const x = diag.ax + (diag.bx - diag.ax) * (s / n), z = diag.az + (diag.bz - diag.az) * (s / n);
    if (x > r.x0 - half && x < r.x1 + half && z > r.z0 - half && z < r.z1 + half) {
      // Closest point of the rect to this centre-line sample.
      const cx = Math.max(r.x0, Math.min(r.x1, x)), cz = Math.max(r.z0, Math.min(r.z1, z));
      if (Math.hypot(cx - x, cz - z) < half) return true;
    }
  }
  return false;
}
