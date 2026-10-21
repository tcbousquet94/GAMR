// Placing neighbourhood modules on a grid of cells, and the fixed look-development neighbourhood ("h"): a 3 x 2 grid
// of blocks (corner store, crescent, warehouse yard / backyard alley, cul-de-sac, crescent) ringed by streets and a
// fringe of houses, built by exactly the same pipeline as the generated city so the two can be compared.

import { Rng } from '../../core/rng.js';
import { Box, World } from '../../sim/physics.js';
import { TAG } from '../kit.js';
import { CURB, emptyKitData, mergeKitData, kitColliders, padColliders } from './data.js';
import { MODULES, ZONE_MODULES, houseRow } from './modules.js';
import { streetData } from './streets.js';

// cells: [{ rect, zone, sides:{s,n,e,w}, module? }]. Fills cells with modules (forced by cell.module, else by zone),
// returns the cuts for streetData. Each module faces its widest open side.
export function placeModules(D, cells, rng) {
  const cuts = [];
  for (const c of cells) {
    let name = c.module;
    if (!name) {
      const opts = ZONE_MODULES[c.zone];
      if (!opts) continue;
      const tot = opts.reduce((a, [, w]) => a + w, 0);
      let x = rng.range(0, tot);
      for (const [n, w] of opts) { x -= w; if (x <= 0) { name = n; break; } }
      name ||= opts[0][0];
    }
    const r = c.rect, w = r.x1 - r.x0, d = r.z1 - r.z0;
    const order = (c.front ? [c.front] : []).concat(w >= d ? ['s', 'n', 'e', 'w'] : ['e', 'w', 's', 'n']);
    const front = order.find((s) => c.sides[s]) || 's';
    const rel = relSides(front, c.sides);
    const mb = MODULES[name](r, front, rng, rel);
    mergeKitData(D, mb.D);
    for (const q of mb.cuts) cuts.push({ ...q, cell: c });
    c.placed = name; c.front = front;
  }
  return cuts;
}
// Which of the module's left / right / back sides face open streets.
function relSides(front, s) {
  const m = { s: { left: 'w', right: 'e', back: 'n' }, n: { left: 'e', right: 'w', back: 's' }, e: { left: 's', right: 'n', back: 'w' }, w: { left: 'n', right: 's', back: 'e' } }[front];
  return { front: true, left: !!s[m.left], right: !!s[m.right], back: !!s[m.back] };
}

// ---- the "h" neighbourhood -------------------------------------------------------------------------------------------
export const HOOD = { cols: 3, rows: 2, cw: 72, ch: 64, S: 19.5, sw: 4.0, M: 34 };
const PLAN = [['cornerstore', 'crescent', 'warehouse'], ['alley', 'culdesac', 'crescent']];

export function hoodLayout() {
  const { cols, rows, cw, ch, S, M } = HOOD;
  const X = (i) => M + S + i * (cw + S), Z = (j) => M + S + j * (ch + S);
  const sizeX = 2 * M + S + cols * (cw + S), sizeZ = 2 * M + S + rows * (ch + S);
  const cells = [], segs = [], inters = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cells.push({ i, j, rect: { x0: X(i), z0: Z(j), x1: X(i) + cw, z1: Z(j) + ch }, zone: PLAN[j][i] === 'warehouse' ? 'industrial' : 'residential', sides: { s: true, n: true, e: true, w: true }, module: PLAN[j][i] });
  for (let j = 0; j < rows; j++) for (let i = 0; i <= cols; i++) segs.push({ axis: 'v', open: true, rect: { x0: X(i) - S, z0: Z(j), x1: X(i), z1: Z(j) + ch } });
  for (let j = 0; j <= rows; j++) for (let i = 0; i < cols; i++) segs.push({ axis: 'h', open: true, rect: { x0: X(i), z0: Z(j) - S, x1: X(i) + cw, z1: Z(j) } });
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) inters.push({ rect: { x0: X(i) - S, z0: Z(j) - S, x1: X(i), z1: Z(j) } });
  return { cells, segs, inters, sizeX, sizeZ, X, Z };
}

export function generateHood(seed = 'h') {
  const rng = new Rng(`hood:${seed}`);
  const L = hoodLayout();
  const D = emptyKitData();
  const size = Math.max(L.sizeX, L.sizeZ);
  D.pads.push({ surf: 'asphalt', poly: [[0, 0], [L.sizeX, 0], [L.sizeX, L.sizeZ], [0, L.sizeZ]], y0: -0.2, y1: 0, tint: 0xc4c2be });
  // Block interiors: lawn (or yard concrete for the warehouse block), raised to lot level.
  for (const c of L.cells) D.pads.push({ surf: c.zone === 'industrial' ? 'concrete' : 'grass', poly: rectPoly(c.rect), y0: 0, y1: CURB, tint: 0xffffff, solid: true });
  const cuts = placeModules(D, L.cells, rng);
  streetData(D, { cells: L.cells, segs: L.segs, sw: HOOD.sw, rng, cuts });
  // Fringe: a row of houses facing the outer streets so the neighbourhood doesn't end in a void.
  const { M } = HOOD, X0 = M, Z0 = M, X1 = L.sizeX - M, Z1 = L.sizeZ - M;
  const fr = [
    { rect: { x0: 0, z0: 0, x1: L.sizeX, z1: Z0 }, front: 's' }, { rect: { x0: 0, z0: Z1, x1: L.sizeX, z1: L.sizeZ }, front: 'n' },
    { rect: { x0: 0, z0: Z0, x1: X0, z1: Z1 }, front: 'e' }, { rect: { x0: X1, z0: Z0, x1: L.sizeX, z1: Z1 }, front: 'w' },
  ];
  for (const f of fr) {
    D.pads.push({ surf: 'grass', poly: rectPoly(f.rect), y0: 0, y1: CURB, tint: 0xffffff, solid: true });
    mergeKitData(D, houseRow(f.rect, f.front, rng).D);
  }
  return { L, D, size };
}

export const rectPoly = (r) => [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]];

// The hood as a sim city: physics from the kit data, the player spawned on the street at the crescent's mouth.
export function hoodCity() {
  const { L, D, size } = generateHood();
  const world = new World();
  const add = (x0, y0, z0, x1, y1, z1, tag) => world.addSolid(new Box(Math.min(x0, x1), y0, Math.min(z0, z1), Math.max(x0, x1), y1, Math.max(z0, z1), tag));
  padColliders(D, add, TAG);
  // Sidewalk rings (raised), the corner discs approximated by a few steps.
  for (const c of L.cells) {
    const r = c.rect, sw = HOOD.sw;
    add(r.x0, 0, r.z0 - sw, r.x1, CURB, r.z0, TAG.GROUND); add(r.x0, 0, r.z1, r.x1, CURB, r.z1 + sw, TAG.GROUND);
    add(r.x0 - sw, 0, r.z0, r.x0, CURB, r.z1, TAG.GROUND); add(r.x1, 0, r.z0, r.x1 + sw, CURB, r.z1, TAG.GROUND);
    for (const [cx, cz, sx, sz] of [[r.x0, r.z0, -1, -1], [r.x1, r.z0, 1, -1], [r.x0, r.z1, -1, 1], [r.x1, r.z1, 1, 1]]) for (let k = 0; k < 4; k++) {
      const a = (k + 0.5) / 4 * sw, b = Math.sqrt(sw * sw - a * a);
      add(cx + sx * (k / 4) * sw, 0, cz, cx + sx * ((k + 1) / 4) * sw, CURB, cz + sz * b, TAG.GROUND);
    }
  }
  kitColliders(D, add, TAG);
  add(-2, -1, -2, size + 2, 0, size + 2, TAG.GROUND);
  world.bounds = { minX: 1, minZ: 1, maxX: size - 1, maxZ: size - 1 };
  // Spawn: in the junction south-west of the first crescent block, looking up its front street toward the lane mouth
  // (the kerb corner on the right, houses ahead), the composition the look was developed against.
  const cres = L.cells.find((c) => c.placed === 'crescent');
  const sp = { x: cres.rect.x0 - HOOD.S * 0.55, z: cres.rect.z1 + HOOD.S * 0.6 };
  return {
    hero: true, world, size, seed: 'h', interactables: [], spawnPoints: [], exit: null, buildings: [],
    kit: { lights: [], signs: [], props: [] }, kitData: D, layout: L,
    district: { id: 'hood', name: 'Palmetto Heights', lighting: { keys: [] } },
    spawn: { x: sp.x, y: 0.3, z: sp.z, yaw: -0.62 },
  };
}
