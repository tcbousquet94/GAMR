// Downtown, turf-war edition. A district is pure data: the generator reads it and never special-cases a district,
// so a new district is a new config like this one (plus any new modules it names).

import { downtown as LEGACY } from '../../districts/downtown.js';

export const DOWNTOWN = {
  id: 'downtown',
  name: 'Downtown',
  personality: 'Dense and loud: glass towers shouldering old brick walk-ups, corner bodegas every block, the river at your back.',
  // Road skeleton. A grid of cols x rows cells; neighbouring cells merge into territory blocks (blockTarget is the
  // territory-block count range) with the streets between them kept open.
  roads: {
    style: 'diagonal-grid',
    cols: 5, rows: 5,
    cell: [58, 76], // cell size range (m), jittered per row/column so the grid never looks stamped
    street: 16, // curb-to-curb plus both sidewalks
    sidewalk: 3.2,
    blockTarget: [12, 16],
    // Cells merge into territory blocks across a street that stays a street: no pedestrian mews and no diagonal
    // avenue, so every way through the grid is a real road (they were dead space to cross on foot).
    keepStreets: true,
    diagonal: null,
    mews: 6, // width of the paved pedestrian lane left where a street segment is removed (keepStreets off)
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
  // PS2-era crime-city look: a smoggy, sun-faded afternoon (yellow-brown haze swallowing the distance), a long
  // orange sunset, then a sodium-lit night with neon. Optional per key: density (haze), grade [r, g, b, saturation],
  // clouds (0..1 cloud cover strength). The turf clock is fixed for now (t=0), the URL ?t= picks another time.
  lighting: {
    keys: [
      { t: 0, sky: [0x8d9cb0, 0xc9bf9f, 0xe2cc94], sun: 0xffdca8, sunI: 3.4, hemi: [0xc8c2aa, 0x6a5a48], hemiI: 1.05, fog: 0xc8b48a, fogD: 0.004, night: 0, sunEl: 34, haze: 0xb9a67e, hazeFar: 0xd6c49a, density: 0.0033, grade: [1.08, 1.0, 0.86, 0.78], clouds: 0.35 },
      { t: 2.5, sky: [0x5a5a7a, 0xc68a5c, 0xf0a454], sun: 0xff8a3c, sunI: 2.6, hemi: [0xa08a88, 0x5a4038], hemiI: 1.0, fog: 0xb07a52, fogD: 0.0045, night: 0.4, sunEl: 7, haze: 0x9c6c50, hazeFar: 0xd8925c, density: 0.0046, grade: [1.12, 0.98, 0.84, 0.8], clouds: 0.45 },
      { t: 5.5, sky: [0x0e1226, 0x1b2036, 0x3c3046], sun: 0x6a78c8, sunI: 0.45, hemi: [0x40486e, 0x2a2030], hemiI: 1.15, fog: 0x2c2a38, fogD: 0.0042, night: 1, sunEl: 40, haze: 0x3a3030, hazeFar: 0x252838, density: 0.0038, grade: [1.06, 0.98, 0.9, 0.82], clouds: 0.2 },
    ],
  },
};
