// Downtown, turf-war edition. A district is pure data: the generator reads it and never special-cases a district,
// so a new district is a new config like this one (plus any new modules it names).

import { downtown as LEGACY } from '../../districts/downtown.js';

export const DOWNTOWN = {
  id: 'downtown',
  name: 'Downtown',
  personality: 'Dense and loud: glass towers shouldering old brick walk-ups, corner bodegas every block, the river at your back.',
  // Road skeleton. A grid of cols x rows cells; some interior street segments are pedestrianised so cells merge into
  // larger blocks (blockTarget is the territory-block count range); one diagonal avenue cuts across the grid.
  roads: {
    style: 'diagonal-grid',
    cols: 5, rows: 5,
    cell: [58, 76], // cell size range (m), jittered per row/column so the grid never looks stamped
    street: 16, // curb-to-curb plus both sidewalks
    sidewalk: 3.2,
    blockTarget: [12, 16],
    diagonal: { width: 13, from: 'sw', to: 'ne' },
    mews: 6, // width of the paved pedestrian lane left where a street segment is removed
  },
  landmark: { kind: 'spire', name: 'First National Debt', height: [170, 190], plaza: true },
  // Natural / built edges per side. Never invisible walls: each is a physical barrier you can see.
  edges: { e: 'river', n: 'railyard', s: 'highway', w: 'warehouses' },
  edgeDepth: 34,
  neighbors: { n: 'The Yards', s: 'Southside', w: 'Old Neighborhood', e: 'Waterfront' },
  // Zoning: a dense commercial core thinning toward the edges.
  zoning: { parks: [1, 2], civic: [1, 1] },
  // Bases are warehouses (the castles); each controls 1-3 nearby businesses (the villages). Warehouse count is
  // capped at half the block count so every warehouse has at least one business block.
  warehouses: [6, 8],
  // Businesses are drawn from this weighted mix; each HQ warehouse's linked business is its diner, next door.
  businessMix: { bodega: 4, pawn: 3, laundromat: 1.4, boxing: 1.2, auto: 1.2, clinic: 1 },
  hq: { type: 'diner', names: ["Sal's Diner", 'The Blue Plate'] },
  // Fill buildings: glass towers concentrate in the core, brick walk-ups and concrete in the ring; garages are
  // parking structures (Street Brawl zones).
  buildings: {
    core: { glass: 0.45, concrete: 0.25, brick: 0.3, height: [22, 60], towerChance: 0.35, towerHeight: [45, 80] },
    ring: { glass: 0.08, concrete: 0.3, brick: 0.62, height: [10, 22], towerChance: 0, towerHeight: [30, 40] },
    garageChance: 0.3,
  },
  palette: LEGACY.palette,
  lighting: LEGACY.lighting,
};
