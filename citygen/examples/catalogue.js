// An example asset catalogue for a small American town. Swap the ids for your own models; the generator only reads
// the sizes, zone weights and placement rules.
//
// front / depth: lot size range in metres [min, max]. zones: how much each lot zone wants it (0 or absent = never).
// corner: weight multiplier on a corner lot (0 = never on a corner). cornerOnly: only on corners. perBlock: at most
// this many per block. spacing: no two of this asset closer than this (metres, centre to centre).
// Lot zones: core, commercial, mainstreet (on an avenue), inner, residential, industrial, civic.
export const TOWN_ASSETS = [
  { id: 'house', front: [12, 15], depth: [22, 32], zones: { residential: 6, inner: 3, commercial: 0.5, civic: 0.4 }, corner: 0.8 },
  { id: 'porchHouse', front: [15, 18], depth: [24, 32], zones: { residential: 2, inner: 2.2 }, corner: 1.2 },
  { id: 'walkup', front: [18, 25], depth: [18, 28], zones: { residential: 0.6, inner: 2.6, commercial: 3, mainstreet: 3, civic: 1.5 } },
  { id: 'shop', front: [12, 18], depth: [15, 22], zones: { residential: 0.25, inner: 0.4, commercial: 3.5, mainstreet: 4.5, civic: 1.2, core: 0.6 }, corner: 3 },
  { id: 'cornerMarket', front: [24, 28], depth: [24, 28], zones: { residential: 1.2, inner: 1, commercial: 2, mainstreet: 1.5 }, cornerOnly: true, perBlock: 1, spacing: 90 },
  { id: 'parking', front: [16, 24], depth: [16, 26], zones: { commercial: 0.6, mainstreet: 0.4, industrial: 0.8, civic: 0.6, core: 0.4 }, corner: 0.6, perBlock: 1 },
  { id: 'pocketPark', front: [10, 14], depth: [12, 18], zones: { residential: 0.25, inner: 0.3, commercial: 0.2, civic: 0.3 }, corner: 0.5, perBlock: 1 },
  { id: 'workshop', front: [18, 28], depth: [20, 28], zones: { industrial: 4, commercial: 0.25 } },
  { id: 'yard', front: [30, 44], depth: [28, 36], zones: { industrial: 2 }, perBlock: 1 },
  { id: 'midrise', front: [14, 26], depth: [14, 22], zones: { core: 4, mainstreet: 1.6 }, corner: 1.3 },
  { id: 'tower', front: [18, 30], depth: [18, 26], zones: { core: 3 }, corner: 1.2 },
];

// Heights and colours for the example viewer (your game uses its models instead).
export const LOOK = {
  house: [6, 0xd8c8a8], porchHouse: [8, 0xc8d8c0], walkup: [10, 0xc89a7a], shop: [5, 0xe0b060], cornerMarket: [5, 0xe08a40],
  parking: [0.3, 0x606468], pocketPark: [0.3, 0x5a9a4a], workshop: [7, 0x9aa0a6], yard: [9, 0x8a8e94], midrise: [18, 0xb07a5a], tower: [60, 0x8ab0d0],
};
