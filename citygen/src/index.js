// citygen: a procedural city layout you fill with your own assets.
//
//   import { generateCity } from 'citygen';
//   const plan = generateCity({ catalogue: MY_ASSETS }, 'seed-42');
//   for (const lot of plan.lots) placeModel(lot.asset, lot.center, lot.yaw, lot.width, lot.depth);
//
// The generator never builds geometry. It returns plain data (streets, intersections, blocks with zones, landmarks,
// alleys and lots, each lot naming the catalogue asset it was sized for), so any engine can build it: Three.js,
// Babylon, Unity (export the JSON), Godot, a 2D tile map. Same config + same seed = the same city.

import { Rng } from './rng.js';
import { Raster, R } from './raster.js';
import { layoutStreets } from './roads.js';
import { zone } from './zoning.js';
import { fillBlock } from './lots.js';
import { SIDES, center } from './geom.js';

export { Rng } from './rng.js';
export { checkPlan } from './check.js';
export { sidewalkSpots } from './spots.js';
export { frontageZone, defaultZoneOf } from './zoning.js';
export { toWorld, sideRect, FRONT_YAW, NORMAL, SIDES } from './geom.js';

export const DEFAULTS = {
  grid: { cols: 7, rows: 7, cell: [58, 76] }, // blocks per side; block size range (m), jittered per row and column
  // Street classes and their full widths (kerb to kerb plus both sidewalks). An avenue every `avenueEvery` lines from
  // the centre line (99: just the middle one); `local` streets beyond `localBeyond` of the half-size.
  streets: { avenueEvery: 3, localBeyond: 0.5, width: { avenue: 24, street: 16, local: 13 }, sidewalk: 3 },
  margin: 30, // open ground around the grid (for your own edges: a river, a highway, hills)
  // Block zones by distance from the centre (0 at the centre, ~1 at the edge midpoints): core inside `core`,
  // commercial inside `commercial`, inner residential inside `inner`, residential beyond. industry: blocks against
  // these map edges, at least `beyond` out, become industrial with this chance. zoneOf(block, zoning, rng): your own
  // rule (return a zone name, or null for the default).
  zoning: { core: 0.3, commercial: 0.55, inner: 0.8, industry: { sides: ['e', 'n'], beyond: 0.6, chance: 0.3 }, zoneOf: null },
  // Landmarks, placed before anything else. Without a footprint a landmark takes its whole block (no lots); with a
  // footprint [w, d] it stands on part of a block, set back behind a clear forecourt, and lots fill the rest.
  // where: center | ring | edge | any.
  landmarks: [
    { id: 'park', zone: 'park', count: [1, 2], where: 'ring' },
    { id: 'townHall', zone: 'civic', count: 1, where: 'center', footprint: [36, 24], setback: 8 },
  ],
  // Rear service alleys through deep blocks of these zones, between the lots that back onto them.
  alleys: { width: 6, chance: 0.75, minDepth: 46, zones: ['core', 'commercial', 'civic'] },
  repeatPenalty: 0.3, // weight multiplier for the same asset as the lot just placed on a street
  frontage: null, // frontage(blockZone, streetKind) -> lot zone; default frontageZone
  catalogue: null, // your assets (required); see README
};

const merge = (d, c) => {
  const out = { ...d };
  for (const k of Object.keys(c || {})) if (c[k] !== undefined) out[k] = c[k] && typeof c[k] === 'object' && !Array.isArray(c[k]) && d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) ? merge(d[k], c[k]) : c[k];
  return out;
};

export function generateCity(config, seed = 1) {
  const cfg = merge(DEFAULTS, config);
  if (!Array.isArray(cfg.catalogue) || !cfg.catalogue.length) throw new Error('citygen: config.catalogue must list at least one asset');
  for (const a of cfg.catalogue) if (!a.id || !a.front || !a.depth || !a.zones) throw new Error(`citygen: asset ${a.id ?? '?'} needs id, front [min,max], depth [min,max] and zones {zone: weight}`);
  const rng = new Rng(`citygen:${seed}`);
  const S = layoutStreets(cfg, rng);
  const raster = new Raster(S.sizeX, S.sizeZ);
  for (const s of S.streets) raster.mark(s.rect, R.STREET);
  for (const x of S.intersections) raster.mark(x.rect, R.STREET);
  const G = cfg.grid, mid = { x: S.sizeX / 2, z: S.sizeZ / 2 }, half = Math.min(S.sizeX, S.sizeZ) / 2 - cfg.margin;
  const blocks = S.cells.map((c, id) => {
    raster.mark(c.rect, R.BLOCK);
    const ctr = center(c.rect);
    const edges = SIDES.filter((s) => (s === 'n' && c.j === 0) || (s === 's' && c.j === G.rows - 1) || (s === 'w' && c.i === 0) || (s === 'e' && c.i === G.cols - 1));
    return { id, i: c.i, j: c.j, rect: c.rect, center: ctr, d: Math.hypot(ctr.x - mid.x, ctr.z - mid.z) / half, edges, streets: Object.fromEntries(SIDES.map((s) => [s, S.streetOf(c, s).kind])), streetIds: Object.fromEntries(SIDES.map((s) => [s, S.streetOf(c, s).id])), zone: null, landmark: null };
  });
  const plan = { seed: String(seed), size: { x: S.sizeX, z: S.sizeZ }, sidewalk: cfg.streets.sidewalk, streets: S.streets, intersections: S.intersections, blocks, landmarks: [], alleys: [], lots: [] };
  zone(plan, cfg, rng, raster);
  for (const b of blocks) if (!(b.landmark && !plan.landmarks.some((m) => m.block === b.id))) fillBlock(plan, b, cfg, rng, raster);
  return plan;
}
