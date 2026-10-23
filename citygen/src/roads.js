// The street grid: cols x rows blocks with jittered sizes, separated by streets of three classes. Avenues run through
// the middle (every `avenueEvery` lines counting from the centre line), local streets out beyond `localBeyond` of the
// half-size, ordinary streets elsewhere; the outer ring is an ordinary street. Widths are kerb to kerb plus both
// sidewalks. Every street stays open, so any block can be reached from any other along real roads.

export function layoutStreets(cfg, rng) {
  const G = cfg.grid, H = cfg.streets, E = cfg.margin;
  const widths = Array.from({ length: G.cols }, () => Math.round(rng.range(G.cell[0], G.cell[1])));
  const depths = Array.from({ length: G.rows }, () => Math.round(rng.range(G.cell[0], G.cell[1])));
  const classOf = (k, n) => {
    if (k === 0 || k === n) return 'street';
    const mid = Math.round(n / 2);
    if ((k - mid) % H.avenueEvery === 0) return 'avenue';
    return Math.abs(k - n / 2) / (n / 2) > H.localBeyond ? 'local' : 'street';
  };
  const KX = Array.from({ length: G.cols + 1 }, (_, k) => classOf(k, G.cols)); // street lines running north-south, by column
  const KZ = Array.from({ length: G.rows + 1 }, (_, k) => classOf(k, G.rows)); // running east-west, by row
  const SX = KX.map((c) => H.width[c]), SZ = KZ.map((c) => H.width[c]);
  // Street line k starts at X[k] and is SX[k] wide; block column i spans X[i] + SX[i] .. X[i + 1].
  const X = [E], Z = [E];
  for (let i = 0; i < G.cols; i++) X.push(X[i] + SX[i] + widths[i]);
  for (let j = 0; j < G.rows; j++) Z.push(Z[j] + SZ[j] + depths[j]);
  const sizeX = X[G.cols] + SX[G.cols] + E, sizeZ = Z[G.rows] + SZ[G.rows] + E;

  const cells = [];
  for (let j = 0; j < G.rows; j++) for (let i = 0; i < G.cols; i++) cells.push({ i, j, rect: { x0: X[i] + SX[i], z0: Z[j] + SZ[j], x1: X[i + 1], z1: Z[j + 1] } });

  // Segments between intersections. axis 'z': runs north-south along street line k (between rows m and m+1);
  // axis 'x': runs east-west along street row k (between columns m and m+1).
  const streets = [];
  for (let k = 0; k <= G.cols; k++) for (let m = 0; m < G.rows; m++) {
    streets.push({ id: streets.length, axis: 'z', line: k, kind: KX[k], width: SX[k], rect: { x0: X[k], z0: Z[m] + SZ[m], x1: X[k] + SX[k], z1: Z[m + 1] }, from: [k, m], to: [k, m + 1] });
  }
  for (let k = 0; k <= G.rows; k++) for (let m = 0; m < G.cols; m++) {
    streets.push({ id: streets.length, axis: 'x', line: k, kind: KZ[k], width: SZ[k], rect: { x0: X[m] + SX[m], z0: Z[k], x1: X[m + 1], z1: Z[k] + SZ[k] }, from: [m, k], to: [m + 1, k] });
  }
  const intersections = [];
  for (let k = 0; k <= G.cols; k++) for (let m = 0; m <= G.rows; m++) {
    const degree = (k > 0) + (k < G.cols) + (m > 0) + (m < G.rows);
    intersections.push({ id: intersections.length, at: [k, m], x: X[k] + SX[k] / 2, z: Z[m] + SZ[m] / 2, rect: { x0: X[k], z0: Z[m], x1: X[k] + SX[k], z1: Z[m] + SZ[m] }, degree, kinds: [KX[k], KZ[m]], outer: k === 0 || m === 0 || k === G.cols || m === G.rows });
  }
  // The street on each side of a cell.
  const streetOf = (cell, side) => {
    const { i, j } = cell;
    if (side === 'n') return streets[(G.cols + 1) * G.rows + j * G.cols + i];
    if (side === 's') return streets[(G.cols + 1) * G.rows + (j + 1) * G.cols + i];
    if (side === 'w') return streets[i * G.rows + j];
    return streets[(i + 1) * G.rows + j];
  };
  return { X, Z, SX, SZ, KX, KZ, sizeX, sizeZ, cells, streets, intersections, streetOf };
}
