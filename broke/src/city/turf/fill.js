// Block fill: the landmark plaza, parks, the civic block, parking garages, then perimeter buildings in the
// district's styles (glass towers in the core, brick walk-ups and concrete in the ring), small stepped buildings
// along the diagonal, and interior clutter. Every placement checks the raster, so nothing overlaps roads,
// businesses, plazas or each other.

import { MAT, TAG } from '../kit.js';
import { G, building } from '../modules/building.js';
import { placeProp } from '../modules/streets.js';
import { towerOnPodium, tree, planterTree, lowWall } from '../modules/common.js';
import { R } from './raster.js';
import { rectHitsDiag } from './layout.js';
import { lotFill } from '../kitdata/modules.js';
import { mergeKitData, FRONT_YAW } from '../kitdata/data.js';

const BUILD_AVOID = R.DIAG | R.RESERVED | R.BUILT | R.STREET;

// Varied kit buildings for the downtown core (the look is shared, the buildings shouldn't be).
const TOWER_STYLE = [['piers', 3], ['brick', 2.5], ['plaster', 2.5], ['glass', 2]];
const STYLE_COLORS = {
  piers: { color: [0xc8c2b6, 0xb8b4ac, 0xd0c8b8, 0xa8a49c, 0x9aa0a6], skin: [0xd8e0e8, 0xc8d4dc, 0xe0dcd0] },
  brick: { color: [0xb8ae9c, 0xc8c0b0, 0xa89c88], skin: [0xffffff, 0xe8d0c0, 0xd8b8a0, 0xc8a898, 0xf0e0d0] },
  plaster: { color: [0xd8d0c0, 0xc8c0b0, 0xe0d6c4], skin: [0xe8dcc0, 0xd8cfc4, 0xc8d0d4, 0xe8d0b8, 0xd0d8c8, 0xe0c8b0] },
  glass: { color: [0x8a9098, 0x7a8088, 0xa0a6ac], skin: [0xffffff, 0xd8f0e8, 0xe0e8f8, 0xd0d8c8] },
};
const pickW = (rng, opts) => { let x = rng.range(0, opts.reduce((a, [, w]) => a + w, 0)); for (const [o, w] of opts) { x -= w; if (x <= 0) return o; } return opts[0][0]; };
export function kitTower(rng, x, z, w, d, h, yaw) {
  const style = pickW(rng, TOWER_STYLE), C = STYLE_COLORS[style];
  const hh = style === 'brick' ? Math.min(h, 60) : h; // brick high-rises stay prewar-height
  return { x, z, w, d, h: hh, yaw, style, color: rng.pick(C.color), skinTint: rng.pick(C.skin), shape: rng.chance(0.3) ? 'L' : 'rect', setback: rng.chance(0.4),
    crown: pickW(rng, [['flat', 3], ['stepped', 2], ['hat', style === 'glass' || style === 'piers' ? 1.5 : 0.3], ['billboard', style === 'glass' ? 0.2 : 1.2]]) };
}
function kitBlock(rng, x, z, w, d, h, yaw) {
  const wall = pickW(rng, [['brick', 3], ['stucco', 3], ['siding', 0.6]]);
  const WALL = { brick: [0xffffff, 0xe8d0c0, 0xd8b8a0, 0xc8a898], stucco: [0xd8c3a0, 0xcfc6b4, 0xb8b6ae, 0xc8b89c, 0xe0cfb0, 0xd8d0c0, 0xc8d0c4, 0xe0c0a8, 0xb8c0c8], siding: [0x8a7a68, 0x7e8a92, 0x9a8a72] };
  const floors = pickW(rng, [[2, 2], [3, 3], [4, 2.5], [5, 1.5], [6, 1]]); void h;
  return { x, z, w, d, yaw, floors, wall, wallColor: rng.pick(WALL[wall]), trim: rng.pick([0xd8d0c0, 0xc8c0b0, 0xe8e0d0, 0x8a8478]), roofColor: 0x6a6660, bars: rng.chance(0.4),
    winW: rng.pick([1.0, 1.2, 1.5, 2.0]), winSp: rng.pick([2.6, 3.2, 3.8]), winTall: rng.chance(0.35), fireEscape: wall === 'brick' ? rng.chance(0.7) : rng.chance(0.3), cornice: rng.pick([0xc8c0b0, 0xb8ae9c, 0xd8d0c0, 0x8a8478]) };
}

export function landmark(kit, city, raster, leavesRoom = () => true) {
  const cfg = city.district.landmark;
  const b = city.blocks[city.landmarkBlock];
  const { rng } = kit;
  // The spire's podium: the cell of the landmark block nearest the map centre, as close to its middle as the
  // diagonal allows.
  const mc = { x: city.layout.sizeX / 2, z: city.layout.sizeZ / 2 };
  const cells = b.cells.map(([i, j]) => city.layout.cellAt(i, j)).sort((p, q) => dist(center(p.rect), mc) - dist(center(q.rect), mc));
  // The podium sits toward one corner of its cell, leaving an L of open plaza wide enough for the block's business.
  const PW = 28;
  let pod = null;
  for (const c of cells) {
    const r = c.rect, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const mx = (r.x1 - r.x0) / 2 - PW / 2 - 2, mz = (r.z1 - r.z0) / 2 - PW / 2 - 2;
    for (const [sx, sz] of rng.shuffle([[1, 1], [-1, -1], [1, -1], [-1, 1]])) {
      const ox = sx * mx, oz = sz * mz;
      const q = { x0: cx + ox - PW / 2, z0: cz + oz - PW / 2, x1: cx + ox + PW / 2, z1: cz + oz + PW / 2 };
      if (!raster.test(q, R.BLOCK, BUILD_AVOID)) continue;
      // Keep only a podium that still leaves a valid spot for the block's business.
      const saved = raster.a.slice();
      raster.mark(q, R.BUILT);
      const ok = leavesRoom();
      raster.a.set(saved);
      if (!ok) continue;
      pod = q; break;
    }
    if (pod) break;
  }
  if (!pod) { const r = cells[0].rect; pod = { x0: r.x0 + 6, z0: r.z0 + 6, x1: r.x0 + 6 + PW, z1: r.z0 + 6 + PW }; }
  const H = Math.round(rng.range(cfg.height[0], cfg.height[1]));
  const podH = 16;
  // Reserve the whole cell as plaza; the business claims its corner first (placed before fill).
  raster.mark(pod, R.BUILT);
  towerOnPodium(kit, pod, podH, H, { landmark: true, signFace: 's', storefront: ['s', 'n'] });
  city.landmark = { name: cfg.name, block: b.id, x: (pod.x0 + pod.x1) / 2, z: (pod.z0 + pod.z1) / 2, base: pod, height: H, top: H + 50, podH };
  city.landmarkCells = cells;
}

// Plaza dressing around the podium (after the block's business has claimed its corner).
export function landmarkPlaza(kit, city, raster) {
  for (const c of city.landmarkCells) plaza(kit, c.rect, raster);
}

function plaza(kit, r, raster) {
  const { rng } = kit;
  for (let x = r.x0 + 5; x < r.x1 - 4; x += 9) for (let z = r.z0 + 5; z < r.z1 - 4; z += 9) {
    const q = { x0: x - 1.2, z0: z - 1.2, x1: x + 1.2, z1: z + 1.2 };
    if (!raster.test(q, R.BLOCK, BUILD_AVOID)) continue;
    const k = rng.next();
    if (k < 0.45) planterTree(kit, x, z);
    else if (k < 0.65) placeProp(kit, 'bench', x, G, z, rng.chance(0.5) ? 0 : Math.PI / 2);
    else continue;
    raster.mark(q, R.BUILT);
  }
  // Fountain in the open middle if there is room.
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  for (const [ox, oz] of [[0, 0], [10, 0], [-10, 0], [0, 10], [0, -10]]) {
    const q = { x0: cx + ox - 3.5, z0: cz + oz - 3.5, x1: cx + ox + 3.5, z1: cz + oz + 3.5 };
    if (!raster.test(q, R.BLOCK, BUILD_AVOID)) continue;
    kit.solid(q.x0, G, q.z0, q.x1, G + 0.6, q.z1, 0x8a8590, MAT.STD, TAG.PROP);
    kit.box(q.x0 + 0.4, G + 0.5, q.z0 + 0.4, q.x1 - 0.4, G + 0.62, q.z1 - 0.4, 0x5a8aa8, MAT.GLASS);
    kit.box(q.x0 + 3.2, G + 0.6, q.z0 + 3.2, q.x1 - 3.2, G + 2.2, q.z1 - 3.2, 0x8a8590);
    raster.mark(q, R.BUILT);
    break;
  }
}

export function park(kit, city, b, raster) {
  const { rng, pal } = kit;
  for (const [i, j] of b.cells) {
    const r = city.layout.cellAt(i, j).rect;
    raster.mark(r, R.RESERVED);
    // Paths: a cross of paving through the middle.
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    kit.box(r.x0, G, cz - 1.8, r.x1, G + 0.02, cz + 1.8, 0x8a8278);
    kit.box(cx - 1.8, G, r.z0, cx + 1.8, G + 0.02, r.z1, 0x8a8278);
    // Trees in loose rows, benches along the paths, a gazebo.
    for (let x = r.x0 + 4; x < r.x1 - 3; x += rng.range(6, 9)) for (let z = r.z0 + 4; z < r.z1 - 3; z += rng.range(6, 9)) {
      if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4) continue;
      if (!freeOf(city, raster, x, z, 1.5)) continue;
      if (rng.chance(0.7)) tree(kit, x, z);
    }
    for (const [x, z, yaw] of [[cx + 6, cz - 3, Math.PI / 2], [cx - 6, cz + 3, Math.PI / 2], [cx - 3, cz - 8, 0], [cx + 3, cz + 8, 0]]) if (freeOf(city, raster, x, z, 1)) placeProp(kit, 'bench', x, G, z, yaw);
    const gz = { x0: cx + 8, z0: cz + 8, x1: cx + 15, z1: cz + 15 };
    if (gz.x1 < r.x1 - 3 && gz.z1 < r.z1 - 3 && !rectHitsDiag(city.layout.diag, gz, 0) && raster.test(gz, R.BLOCK, R.BUILT | R.DIAG)) {
      kit.solid(gz.x0, G, gz.z0, gz.x1, G + 0.4, gz.z1, 0x8a8278, MAT.STD, TAG.PROP);
      for (const [x, z] of [[gz.x0 + 0.4, gz.z0 + 0.4], [gz.x1 - 0.4, gz.z0 + 0.4], [gz.x0 + 0.4, gz.z1 - 0.4], [gz.x1 - 0.4, gz.z1 - 0.4]]) kit.solid(x - 0.2, G + 0.4, z - 0.2, x + 0.2, G + 3.2, z + 0.2, 0xe8e4dc, MAT.STD, TAG.PROP);
      kit.solid(gz.x0 - 0.5, G + 3.2, gz.z0 - 0.5, gz.x1 + 0.5, G + 3.6, gz.z1 + 0.5, 0x6e2f5c, MAT.STD, TAG.PLATFORM);
      raster.mark(gz, R.BUILT);
    }
    kit.light(cx, 4, cz, 0xffd9a0, 12, 'plaza');
  }
}

export function civic(kit, city, b, raster) {
  // City hall: a stone block with a colonnade and wide steps, set back behind a plaza.
  const { rng } = kit;
  const cell = city.layout.cellAt(...b.cells[0]).rect;
  for (const [w, d] of [[40, 26], [32, 22], [26, 18]]) {
    const cx = (cell.x0 + cell.x1) / 2, cz = (cell.z0 + cell.z1) / 2 + 4;
    const r = { x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 };
    if (!raster.test({ x0: r.x0 - 2, z0: r.z0 - 8, x1: r.x1 + 2, z1: r.z1 + 2 }, R.BLOCK, BUILD_AVOID)) continue;
    building(kit, r, 18, { style: 'concrete', color: 0x9a96a0, storefront: [], faces: ['n', 's', 'w', 'e'] });
    for (let x = r.x0 + 2; x < r.x1 - 1; x += 3.2) kit.solid(x - 0.45, G, r.z0 - 4, x + 0.45, 12, r.z0 - 3.1, 0xd8d4cc, MAT.STD, TAG.PROP);
    kit.box(r.x0 - 0.5, 12, r.z0 - 4.6, r.x1 + 0.5, 13.4, r.z0, 0xc8c4bc); // entablature
    kit.ramp(r.x0 + 4, r.z0 - 8, r.x1 - 4, r.z0 - 4, 'z+', G, G + 0.9, 0xc8c4bc, { solidBelow: true, stepRise: 0.3 });
    kit.solid(r.x0, G, r.z0 - 4, r.x1, G + 0.9, r.z0, 0xc8c4bc, MAT.STD, TAG.GROUND);
    kit.sign('CITY HALL', 'paint', cx, 12.7, r.z0 - 4.65, 12, 1.1, 0, -1, 0x2a2830);
    raster.mark({ x0: r.x0 - 1, z0: r.z0 - 9, x1: r.x1 + 1, z1: r.z1 + 1 }, R.BUILT);
    city.civic = { block: b.id, x: cx, z: cz, name: 'City Hall' };
    break;
  }
  plaza(kit, cell, raster);
}

// Compact two-level parking structure: ground deck plus a roof deck reached by an outside ramp. A Street Brawl zone.
export function garage(kit, city, b, raster) {
  const { rng, pal } = kit;
  const W = 30, D = 38, RW = 5.5, H = 4.4;
  for (const [i, j] of rng.shuffle(b.cells.slice())) {
    const r = city.layout.cellAt(i, j).rect;
    for (const [ax, az] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x0 = ax ? r.x1 - W - RW - 2 : r.x0 + 2, z0 = az ? r.z1 - D - 2 : r.z0 + 2;
      const g = { x0: x0 + RW, z0, x1: x0 + RW + W, z1: z0 + D };
      const all = { x0: x0 - 1, z0: z0 - 1, x1: g.x1 + 1, z1: g.z1 + 1 };
      if (!raster.test(all, R.BLOCK, BUILD_AVOID)) continue;
      raster.mark(all, R.BUILT);
      const conc = 0x6a6770;
      kit.solid(g.x0, H - 0.4, g.z0, g.x1, H, g.z1, conc, MAT.STD, TAG.PLATFORM);
      kit.box(g.x0 - 0.1, H - 0.7, g.z0 - 0.1, g.x1 + 0.1, H - 0.4, g.z1 + 0.1, 0x8a8590);
      for (let x = g.x0 + 0.4; x < g.x1; x += 7.4) for (let z = g.z0 + 0.4; z < g.z1; z += 9.2) kit.solid(x - 0.35, G, z - 0.35, x + 0.35, H - 0.4, z + 0.35, 0x7e7a84, MAT.STD, TAG.PROP);
      // Roof parapet with a gap where the ramp arrives.
      const par = (a, b2, c, d) => kit.solid(a, H, b2, c, H + 1.0, d, 0x7e7a84, MAT.STD, TAG.RAIL);
      par(g.x0, g.z0, g.x1, g.z0 + 0.3); par(g.x0, g.z1 - 0.3, g.x1, g.z1); par(g.x1 - 0.3, g.z0, g.x1, g.z1); par(g.x0, g.z0 + 9, g.x0 + 0.3, g.z1 - 0.3); // open at the north end, where the ramp tops out
      kit.ramp(x0, z0 + 2, x0 + RW, g.z1, 'z-', G, H, conc, { solidBelow: true });
      kit.link('ramp', 'street', 'roof', x0 + RW / 2, (z0 + g.z1) / 2);
      // Parked cars on both levels (cover), a booth, a sign.
      for (let k = 0; k < 6; k++) {
        const cx = g.x0 + 4 + (k % 3) * 9, cz = g.z0 + 5 + Math.floor(k / 3) * 26;
        if (rng.chance(0.7)) placeProp(kit, 'car', cx, G, cz, 0, rng.pick([0x7a8090, 0x9a9ea6, 0xb8b6ba, 0x5d6478, 0x8a3a3a]));
        if (rng.chance(0.6)) placeProp(kit, 'car', cx, H, cz + 4, 0, rng.pick([0x7a8090, 0x9a9ea6, 0xc8c4bc, 0x6a7a8c]));
      }
      kit.sign('PARK', 'garage', (g.x0 + g.x1) / 2, H - 1.6, g.z0 - 0.05, 6, 1.4, 0, -1, 0x33e0ff);
      kit.light((g.x0 + g.x1) / 2, H - 0.5, (g.z0 + g.z1) / 2, 0xe8f0ff, 14, 'garage');
      kit.spawn(g.x0 + 3, H, g.z0 + 3, 'roof');
      (city.garages = city.garages || []).push({ block: b.id, rect: { x0, z0, x1: g.x1, z1: g.z1 }, x: (x0 + g.x1) / 2, z: (z0 + g.z1) / 2, roofY: H });
      return true;
    }
  }
  return false;
}

// Perimeter buildings along each cell side that faces a street or mews, stepping along the frontage.
export function perimeterBuildings(kit, city, b, raster) {
  const { rng } = kit;
  const S = city.district.buildings;
  const mc = { x: city.layout.sizeX / 2, z: city.layout.sizeZ / 2 };
  const core = dist(b.center, mc) < city.layout.size * 0.24;
  const P = core ? S.core : S.ring;
  for (const [i, j] of b.cells) {
    const c = city.layout.cellAt(i, j), r = c.rect;
    for (const side of ['n', 'e', 's', 'w']) {
      const len = side === 'n' || side === 's' ? r.x1 - r.x0 : r.z1 - r.z0;
      for (let u = 0; u < len - 6;) {
        const w = Math.min(len - u, Math.round(rng.range(core ? 12 : 9, core ? 26 : 18)));
        const dpt = Math.round(rng.range(14, 22));
        let placed = false;
        for (const ww of [w, w - 4, w - 8]) {
          if (ww < 7) break;
          const q = sideRect(r, side, u, u + ww, 0, dpt);
          if (!raster.test(q, R.BLOCK, BUILD_AVOID) || rectHitsDiag(city.layout.diag, q, 1)) continue;
          // Kit look in the core: high-rises (some with setbacks) and mid-rise storefront blocks.
          if (city.kitPending && core && b.zone !== 'civic') {
            const KP = city.kitPending, along = side === 'n' || side === 's';
            const Wf = along ? q.x1 - q.x0 : q.z1 - q.z0, Dd = along ? q.z1 - q.z0 : q.x1 - q.x0;
            const cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2, yaw = FRONT_YAW[side];
            const tower = rng.chance(Math.max(P.towerChance, 0.55)) && ww >= 16 && dpt >= 18;
            const h = tower ? rng.range(P.towerHeight[0], P.towerHeight[1]) : rng.range(P.height[0], P.height[1]);
            if (tower) KP.towers.push(kitTower(rng, cx, cz, Wf - 1.2, Dd - 1.2, h, yaw));
            else KP.blocks.push(kitBlock(rng, cx, cz, Wf - 0.6, Dd - 0.6, h, yaw));
            raster.mark(q, R.BUILT);
            (city.buildings = city.buildings || []).push({ rect: q, h, block: b.id, side });
            u += ww + (rng.chance(0.22) ? rng.range(3.5, 5) : 0);
            placed = true;
            break;
          }
          // Kit look outside the core: real houses, walk-ups, shops and workshops on the frontage instead of plain boxes.
          if (city.kitPending && !core && (b.zone === 'residential' || b.zone === 'commercial' || b.zone === 'industrial')) {
            const r2 = rng.next();
            const kind = b.zone === 'industrial' ? 'workshop' : b.zone === 'commercial' ? (ww >= 14 && r2 < 0.4 ? 'apartment' : ww >= 10 && r2 < 0.75 ? 'shop' : 'house') : 'house';
            const mb = lotFill(q, side, rng, kind);
            mergeKitData(city.kitPending, mb.D);
            city.kitCuts.push(...mb.cuts.map((x) => ({ ...x, cell: c })));
            raster.mark(q, R.BUILT);
            (city.buildings = city.buildings || []).push({ rect: q, h: kind === 'apartment' ? 8 : 5, block: b.id, side });
            u += ww + (rng.chance(0.22) ? rng.range(3.5, 5) : 0);
            placed = true;
            break;
          }
          const tower = rng.chance(P.towerChance) && ww >= 16 && dpt >= 18;
          const style = pickStyle(rng, P);
          const h = tower ? rng.range(P.towerHeight[0], P.towerHeight[1]) : rng.range(P.height[0], P.height[1]);
          const inward = { n: 's', s: 'n', w: 'e', e: 'w' }[side];
          building(kit, q, Math.round(h), {
            style: tower ? 'glass' : style,
            storefront: style !== 'glass' && rng.chance(0.6) ? [side] : [],
            fireEscape: !tower && rng.chance(0.45) ? [inward] : [],
          });
          raster.mark(q, R.BUILT);
          (city.buildings = city.buildings || []).push({ rect: q, h, block: b.id, side });
          u += ww + (rng.chance(0.22) ? rng.range(3.5, 5) : 0); // occasional service alley
          placed = true;
          break;
        }
        if (!placed) u += 3;
      }
    }
  }
}

// Small buildings stepping along the diagonal's edges, so the boulevard is lined with facades, not raster gaps.
export function diagonalFrontage(kit, city, raster) {
  const D = city.layout.diag;
  if (!D) return;
  const { rng } = kit;
  const dx = D.bx - D.ax, dz = D.bz - D.az, len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
  for (let s = 8; s < len - 8; s += 9) for (const side of [-1, 1]) {
    const off = D.width / 2 + 2.5 + 4.5;
    const cx = D.ax + ux * s + nx * side * off, cz = D.az + uz * s + nz * side * off;
    const q = { x0: cx - 4.5, z0: cz - 4.5, x1: cx + 4.5, z1: cz + 4.5 };
    if (!raster.test(q, R.BLOCK, BUILD_AVOID) || rectHitsDiag(D, q, 1.5)) continue;
    building(kit, q, Math.round(rng.range(10, 20)), { style: rng.chance(0.7) ? 'brick' : 'concrete' });
    raster.mark(q, R.BUILT);
  }
}

// Courtyard clutter in whatever open interior is left: dumpsters, crates, pallets; AC units on low roofs.
export function interiors(kit, city, raster) {
  const { rng } = kit;
  for (const c of city.layout.cells) {
    const r = c.rect;
    for (let k = 0; k < 6; k++) {
      const x = rng.range(r.x0 + 4, r.x1 - 4), z = rng.range(r.z0 + 4, r.z1 - 4);
      const q = { x0: x - 1.4, z0: z - 1.4, x1: x + 1.4, z1: z + 1.4 };
      if (!raster.test(q, R.BLOCK, BUILD_AVOID)) continue;
      const zone = city.blocks[c.block].zone;
      if (zone === 'park' || zone === 'landmark' || zone === 'civic') continue;
      if (rng.chance(0.55)) placeProp(kit, 'dumpster', x, G, z, rng.chance(0.5) ? 0 : Math.PI / 2, rng.pick([0x3d4a3a, 0x40424a, 0x4a3f36]));
      else placeProp(kit, 'crate', x, G, z);
      raster.mark(q, R.BUILT);
      kit.spawn(x + 2, G, z, 'alley');
    }
  }
}

export function sideRect(r, side, u0, u1, d0, d1) {
  if (side === 'n') return { x0: r.x0 + u0, x1: r.x0 + u1, z0: r.z0 + d0, z1: r.z0 + d1 };
  if (side === 's') return { x0: r.x1 - u1, x1: r.x1 - u0, z0: r.z1 - d1, z1: r.z1 - d0 };
  if (side === 'w') return { x0: r.x0 + d0, x1: r.x0 + d1, z0: r.z1 - u1, z1: r.z1 - u0 };
  return { x0: r.x1 - d1, x1: r.x1 - d0, z0: r.z0 + u0, z1: r.z0 + u1 };
}

function pickStyle(rng, P) { return rng.weighted([{ w: P.glass, v: 'glass' }, { w: P.concrete, v: 'concrete' }, { w: P.brick, v: 'brick' }]); }
function freeOf(city, raster, x, z, rad) { return raster.test({ x0: x - rad, z0: z - rad, x1: x + rad, z1: z + rad }, R.BLOCK, R.BUILT | R.DIAG); }
const center = (r) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
