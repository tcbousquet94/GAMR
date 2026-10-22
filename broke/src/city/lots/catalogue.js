// The asset catalogue: every handcrafted kit building the lot generator may put on a lot, with the frontage and depth
// it needs, how often each zone wants it, and its placement rules. The generator only ever picks from this list, so
// the whole city is built from these pieces; a new asset is a new entry here plus its builder.
//
// Builders work in a lot's local frame (the kit's MB: u across the frontage from the lot's left corner, v deep from
// the street, the front street toward -v) and return the MB. opts: { corner: 'left' | 'right' | null (the side of
// the lot that also faces a street), zone, core }.
//
// Zone keys: core (commercial blocks in the downtown core), mainstreet (any frontage on an avenue outside the core),
// commercial, inner (residential close in), residential (outer suburbs), industrial, civic.

import { CURB, FRONT_YAW } from '../kitdata/data.js';
import { MB, WALL_COLORS, TRIMS } from '../kitdata/modules.js';
import { kitTower, kitBlock } from '../turf/fill.js';

export const SHOP_NAMES = {
  market: ['EZ STOP', 'CORNER KING', 'LUCKY 7 MARKET', 'PALMETTO MART', 'SUNRISE LIQUOR', 'QUICK PICK', 'STAR FOOD MART', 'LA ESQUINA MARKET', 'GOLDEN STATE LIQUOR', 'BAYSIDE MINI MART', 'NUMBER 1 MARKET'],
  taco: ['TACOS LA PALMA', 'EL GALLO TACOS', 'TAQUERIA SOL', 'BURRITO HUT', 'TACOS EL REY', 'LA CASITA', 'TACOS MI TIERRA', 'EL TORITO GRILL'],
  discount: ['MORALES DISCOUNT', "VEGA'S DISCOUNT", 'BIG SAVE', 'RUIZ DISCOUNT', 'DOLLAR DAYS', 'BARGAIN TOWN', 'TODO A 99', 'PRICE KING'],
};
const AWNINGS = [0x2a5a3a, 0x8a2a24, 0x2a3a6a, 0xc83a2a, 0xb8902a];
const SHOP_WALLS = [0xe0d6c0, 0xd8c8a8, 0xcfc8bc, 0xe6dcc6, 0xc8dcc8, 0xe8c8b0, 0xe8dca0, 0xb8cce0, 0xd8b8c0, 0xf0e8d8, 0xc0b8a8];
// The look of a storefront: facade (awning, canopy, painted, boxsign), wall (stucco, brick, block), storeys, a raised
// front parapet. Picked per shop so a street of shops never reads as copies.
// Names don't repeat in a city until a kind's list runs out (opts.names: the city's taken names).
function shopName(rng, kind, taken) {
  const free = SHOP_NAMES[kind].filter((n) => !taken?.has(n));
  const n = rng.pick(free.length ? free : SHOP_NAMES[kind]);
  taken?.add(n);
  return n;
}
function shopStyle(rng, kind, taken) {
  const wallKey = rng.pick(['stucco', 'stucco', 'stucco', 'brick', 'block']);
  return {
    kind, name: shopName(rng, kind, taken), awning: rng.pick(AWNINGS),
    wallKey, wallColor: wallKey === 'brick' ? rng.pick([0xffffff, 0xe8d0c0, 0xd8b8a0]) : rng.pick(SHOP_WALLS),
    facade: rng.pick(['awning', 'awning', 'canopy', 'painted', 'boxsign']),
    floors: kind === 'market' && rng.chance(0.3) ? 2 : 1, parapet: rng.pick(['flat', 'flat', 'stepped', 'cornice']),
  };
}

// ---- builders ---------------------------------------------------------------------------------------------------------

// A house on its lot: front yard and path, maybe a driveway down one side, the house, and a fenced backyard with a
// garage or shed, a laundry line, a tree.
function houseLot(rect, side, rng, opts, style = {}) {
  const mb = new MB(rect, side, rng, { front: true }), W = mb.W, D = mb.Dp;
  const drive = W >= 13.5 && rng.chance(0.6) ? (opts.corner === 'left' || rng.chance(0.5) ? W - 1.9 : 1.9) : null;
  const hw = Math.min(drive != null ? W - 5 : W - 2.5, style.w ?? 12), hd = Math.min(style.d ?? rng.range(9, 10.5), D - 9);
  if (hw < 7.5 || hd < 7) return mb;
  const hu = drive == null ? W / 2 : drive > W / 2 ? (W - 3.8) / 2 : 3.8 + (W - 3.8) / 2, fy = style.yard ?? rng.range(4.5, 6.5);
  mb.house(hu, fy + hd / 2, hw, hd, 0, style.house || {});
  mb.yard(drive != null && drive < W / 2 ? 3.8 : 0, drive != null && drive > W / 2 ? W - 3.8 : W, 0, fy, hu + (rng.chance(0.5) ? 2 : -2), { drive });
  if (drive != null) { mb.cut('front', drive - 1.6, drive + 1.6); if (rng.chance(0.65)) mb.car(drive, fy + 1.2, Math.PI, undefined); }
  // Backyard.
  const by = fy + hd + 0.6;
  if (D - by > 4) {
    const kind = rng.pick(['wood', 'wood', 'block', 'chain']);
    mb.fence(kind, 0.15, D - 0.2, W - 0.15, D - 0.2);
    if (opts.corner !== 'left') mb.fence(kind, 0.15, by, 0.15, D - 0.2); else mb.fence('wood', 0.3, by, 0.3, D - 0.2, 1.8);
    if (opts.corner !== 'right') mb.fence(kind, W - 0.15, by, W - 0.15, D - 0.2); else mb.fence('wood', W - 0.3, by, W - 0.3, D - 0.2, 1.8);
    const room = D - by;
    if (drive != null && room > 7) mb.shed(drive, D - 3.6, 5.4, 5.8, Math.PI, { kind: 'garage', color: rng.pick(WALL_COLORS.stucco) });
    else if (room > 4.5 && rng.chance(0.55)) mb.shed(rng.chance(0.5) ? 2.2 : W - 2.2, D - 2.0, 2.4, 2.0, Math.PI, { kind: 'shed', color: rng.pick([0x8a8a7a, 0x9a8a72, 0x7a8278]), h: 2.3 });
    if (room > 5 && rng.chance(0.5)) { const a = mb.P(2, by + room * 0.45), b = mb.P(W - 2.5, by + room * 0.45 + 0.4); mb.D.props.push({ type: 'laundry', a, b, y: CURB }); }
    if (room > 6 && rng.chance(0.55)) mb.tree(W * rng.range(0.3, 0.7), by + room * 0.7, rng.range(3.5, 5), rng.range(7, 10));
    else if (room > 5 && rng.chance(0.4)) mb.palm(W * rng.range(0.25, 0.75), by + room * 0.6);
  }
  if (rng.chance(0.18)) mb.person(hu + rng.range(-2, 2), fy * 0.6, rng.range(-3, 3));
  return mb;
}

const porchHouseLot = (rect, side, rng, opts) => houseLot(rect, side, rng, opts, {
  w: 13, d: 10.5, yard: rng.range(5, 6.5),
  house: { floors: 2, wall: rng.chance(0.5) ? 'siding' : 'stucco', roof: rng.pick(['hip', 'gable']), porch: { depth: 2.3, steps: 'center', railing: true }, chimney: rng.chance(0.5) },
});

// A two- or three-storey walk-up: entry court with palms, the building, a parking strip out back.
function walkupLot(rect, side, rng) {
  const mb = new MB(rect, side, rng, { front: true }), W = mb.W, D = mb.Dp;
  const d = Math.min(12, D - 8), fy = 4;
  mb.apartment(W / 2, fy + d / 2, W - 3, d, 0, { floors: rng.chance(0.4) ? 3 : 2 });
  mb.rect('concrete', 1.5, 0, W - 1.5, fy, CURB - 0.02, CURB + 0.03, 0xd6d2ca);
  if (rng.chance(0.7)) { mb.palm(1.2, 2); mb.palm(W - 1.2, 2); }
  const back = fy + d + 0.8;
  if (D - back > 5.5) {
    mb.rect('asphalt', 0.5, back, W - 0.5, D - 0.5, CURB - 0.02, CURB + 0.01, 0xb8b6b2);
    for (let u = 2.5; u < W - 2; u += 2.8) if (rng.chance(0.45)) mb.car(u, D - 3, 0);
    mb.prop('dumpster', W - 2.2, back + 1.4, 0);
    mb.fence('block', 0.3, D - 0.25, W - 0.3, D - 0.25);
  }
  return mb;
}

// A storefront: taco stand, discount store or a walk-in corner market, a paved apron, the back lot fenced off.
function shopLot(rect, side, rng, opts) {
  const mb = new MB(rect, side, rng, { front: true }), W = mb.W, D = mb.Dp;
  // Not the same kind of shop as the one just before it on the street.
  const kinds = (opts.corner ? ['market', 'market', 'taco', 'discount'] : ['market', 'taco', 'discount', 'discount']).filter((k) => k !== opts.lastKind);
  const kind = rng.pick(kinds);
  const w = kind === 'taco' ? Math.min(W - 2, 11) : Math.min(W - 1.2, 18), d = Math.min(D - 6, kind === 'taco' ? 8 : 12);
  mb.store(W / 2, 4 + d / 2, w, d, 0, shopStyle(rng, kind, opts.names));
  mb.rect('concrete', 0.3, 0, W - 0.3, 4, CURB - 0.02, CURB + 0.03, 0xd6d2ca);
  if (rng.chance(0.5)) mb.prop('newsbox', 1.4, 1.6, 0);
  if (rng.chance(0.4)) mb.prop('ice', W - 1.6, 2.4, 0);
  if (rng.chance(0.5)) mb.person(W / 2 + rng.range(-3, 3), 2.2, rng.range(-3, 3));
  if (D - (4 + d) > 3) { mb.prop('dumpster', W - 2.2, 4 + d + 1.6, 0); mb.fence('chain', 0.3, D - 0.25, W - 0.3, D - 0.25); }
  return mb;
}

// The corner market: parking in front with striped stalls and wheel stops, the store behind, ice and a phone.
function cornerMarketLot(rect, side, rng, opts) {
  const mb = new MB(rect, side, rng, { front: true }), W = mb.W, D = mb.Dp;
  const pd = 9.5;
  mb.rect('asphalt', 0.5, 0, W - 0.5, pd, CURB - 0.02, CURB + 0.01, 0xb8b6b2);
  for (let u = 2; u <= W - 2; u += 2.8) { const p = mb.P(u, 6); mb.D.paint.push({ x: p.x, z: p.z, w: 0.12, d: 5, yaw: mb.Y(0), color: 0xe8e6e0, y: CURB + 0.012 }); if (u + 1.4 < W - 1) mb.prop('wheelstop', u + 1.4, 8.1, 0); }
  mb.cut('front', 3, W - 3);
  const w = Math.min(W - 2, 19), d = Math.min(D - pd - 2, 12);
  const kind = rng.pick(['market', 'market', 'discount']);
  mb.store(W / 2, pd + 0.5 + d / 2, w, d, 0, shopStyle(rng, kind, opts.names));
  for (const [type, u, v] of [['ice', W / 2 + 6.5, pd - 0.6], ['phone', W / 2 - 7.5, pd - 0.5], ['newsbox', W / 2 + 3.2, pd - 0.5]]) mb.prop(type, u, v, 0);
  for (let k = 0; k < 3; k++) if (rng.chance(0.55)) mb.car(3.4 + k * 5.6, 4.4, Math.PI);
  mb.person(W / 2 - 1, pd - 0.3, 0.4); if (rng.chance(0.5)) mb.person(W / 2 + 4, pd - 0.2, -2.2);
  mb.light(1.2, 1.2, 0);
  return mb;
}

// A surface parking lot: asphalt, stall lines and wheel stops, parked cars, a light pole, an entrance cut.
function parkingLot(rect, side, rng) {
  const mb = new MB(rect, side, rng, { front: true }), W = mb.W, D = mb.Dp;
  mb.rect('asphalt', 0.4, 0.4, W - 0.4, D - 0.4, CURB - 0.02, CURB + 0.01, 0xb8b6b2);
  for (const v0 of [D - 5.6, 1.0]) {
    if (v0 < 1 || (v0 === 1.0 && D < 17)) continue;
    for (let u = 1.5; u <= W - 1.5; u += 2.7) { const p = mb.P(u, v0 + 2.5); mb.D.paint.push({ x: p.x, z: p.z, w: 0.12, d: 5, yaw: mb.Y(0), color: 0xe8e6e0, y: CURB + 0.012 }); if (u + 1.35 < W - 1 && rng.chance(0.5)) mb.car(u + 1.35, v0 + 2.5, v0 > 2 ? 0 : Math.PI); }
  }
  mb.cut('front', W / 2 - 3, W / 2 + 3);
  mb.fence('chain', 0.3, 0.4, W / 2 - 3.5, 0.4, 1.0); mb.fence('chain', W / 2 + 3.5, 0.4, W - 0.3, 0.4, 1.0);
  mb.light(1.0, D / 2, 0);
  if (rng.chance(0.5)) mb.prop('dumpster', W - 2, D - 1.6, 0);
  return mb;
}

// A pocket park: lawn, a shade tree, a bench and shrubs.
function pocketParkLot(rect, side, rng) {
  const mb = new MB(rect, side, rng, { front: true }), W = mb.W, D = mb.Dp;
  mb.rect('grass', 0.3, 0.3, W - 0.3, D - 0.3, CURB - 0.01, CURB + 0.02);
  mb.tree(W / 2 + rng.range(-1.5, 1.5), D * 0.55, rng.range(4.5, 6), rng.range(8, 11));
  mb.prop('bench', W / 2, 2.2, 0);
  for (let k = 0; k < 3; k++) mb.shrub(rng.range(1.2, W - 1.2), rng.range(D * 0.3, D - 1.2));
  if (rng.chance(0.4)) mb.person(W / 2 + 1, 3, rng.range(-3, 3));
  return mb;
}

// An industrial workshop: yard behind a chain-link fence, a low warehouse with roll-up doors, a truck, pallets.
function workshopLot(rect, side, rng) {
  const mb = new MB(rect, side, rng, { front: true }), W = mb.W, D = mb.Dp;
  const w = Math.min(W - 2, 24), d = Math.min(D - 7, 16);
  mb.rect('concrete', 0.5, 0.5, W - 0.5, D - 0.5, CURB - 0.02, CURB + 0.02, 0xa8a49c);
  mb.warehouse(W / 2, D - d / 2 - 1, w, d, 0, { h: 6, doors: Math.max(1, Math.floor(w / 10)), color: rng.pick([0xc0bcb2, 0xb4b0a6, 0xc8c0ae, 0x9aa0a6]), stripe: rng.pick([0x2a4a6a, 0x8a2a24, 0x3a5a3a, 0xb8902a]) });
  if (rng.chance(0.6)) mb.truck(W / 2 + rng.range(-3, 3), D - d - 5, 0);
  for (let k = 0; k < 3; k++) if (rng.chance(0.5)) mb.prop('pallets', 2 + k * 1.4, 3, rng.range(-0.2, 0.2));
  mb.fence('chain', 0.5, 0.5, W / 2 - 4, 0.5); mb.fence('chain', W / 2 + 4, 0.5, W - 0.5, 0.5);
  mb.cut('front', W / 2 - 4, W / 2 + 4);
  return mb;
}

// A warehouse yard: a big tilt-up warehouse, the yard and gate, trucks, a container, a site office.
function yardLot(rect, side, rng) {
  const mb = new MB(rect, side, rng, { front: true }), W = mb.W, D = mb.Dp;
  mb.rect('concrete', 0.5, 0.5, W - 0.5, D - 0.5, CURB - 0.02, CURB + 0.02, 0xa8a49c);
  const ww = Math.min(W - 6, 34), wd = Math.min(D * 0.55, 20);
  mb.warehouse(W / 2, D - wd / 2 - 2, ww, wd, 0, { doors: Math.max(2, Math.floor(ww / 11)), color: rng.pick([0xc0bcb2, 0xb4b0a6, 0xc8c0ae]), stripe: rng.pick([0x2a4a6a, 0x8a2a24, 0x3a5a3a]) });
  mb.shed(4.5, D - wd - 5, 6, 4.5, 0, { kind: 'office', color: 0xd0ccc0, h: 3.2 });
  const g0 = W / 2 - 5, g1 = W / 2 + 5;
  mb.fence('barbed', 0.6, 0.6, g0, 0.6); mb.fence('barbed', g1, 0.6, W - 0.6, 0.6); mb.cut('front', g0, g1);
  mb.truck(W / 2 + rng.range(-5, 5), D - wd - 8, rng.range(-0.15, 0.15));
  if (rng.chance(0.6)) mb.prop('container', W - 5, D * 0.3, Math.PI / 2, rng.pick([0x8a3a2a, 0x2a5a7a, 0x4a6a3a]));
  mb.light(2.5, D * 0.5, mb.face(1, 0));
  return mb;
}

// Downtown: a mid-rise storefront block (shops below, flats above) or a high-rise, filling the lot.
function midriseLot(rect, side, rng) {
  const mb = new MB(rect, side, rng, { front: true }), W = mb.W, D = mb.Dp, c = mb.P(W / 2, D / 2);
  mb.D.blocks.push(kitBlock(rng, c.x, c.z, W - 0.6, D - 0.6, 0, FRONT_YAW[side]));
  return mb;
}
function towerLot(rect, side, rng, opts) {
  const mb = new MB(rect, side, rng, { front: true }), W = mb.W, D = mb.Dp, c = mb.P(W / 2, D / 2);
  mb.D.towers.push(kitTower(rng, c.x, c.z, W - 1.2, D - 1.2, rng.range(opts.towerH[0], opts.towerH[1]), FRONT_YAW[side]));
  return mb;
}

// ---- the catalogue ----------------------------------------------------------------------------------------------------
// front / depth: metres [min, max]. zones: weight per zone key. corner: weight multiplier on a corner lot (0 = never
// on a corner); cornerOnly: corners only. perCell: at most this many per cell. spacing: no two of it closer than this
// (metres, centre to centre). h: height recorded for the map / AI.
export const CATALOGUE = [
  { id: 'house', front: [12, 15], depth: [22, 32], zones: { residential: 6, inner: 3, commercial: 0.5, civic: 0.4 }, corner: 0.8, h: 5, build: houseLot },
  { id: 'porchHouse', front: [15, 18], depth: [24, 32], zones: { residential: 2, inner: 2.2 }, corner: 1.2, h: 8, build: porchHouseLot },
  { id: 'walkup', front: [18, 25], depth: [18, 28], zones: { residential: 0.6, inner: 2.6, commercial: 3, mainstreet: 3, civic: 1.5 }, corner: 1, h: 9, build: walkupLot },
  { id: 'shop', front: [12, 18], depth: [15, 22], zones: { residential: 0.25, inner: 0.4, commercial: 3.5, mainstreet: 4.5, civic: 1.2, core: 0.6 }, corner: 3, h: 5, build: shopLot },
  { id: 'cornerMarket', front: [24, 28], depth: [24, 28], zones: { residential: 1.2, inner: 1, commercial: 2, mainstreet: 1.5 }, cornerOnly: true, perCell: 1, spacing: 90, h: 5, build: cornerMarketLot },
  { id: 'parking', front: [16, 24], depth: [16, 26], zones: { commercial: 0.6, mainstreet: 0.4, industrial: 0.8, civic: 0.6, core: 0.4 }, corner: 0.6, perCell: 1, h: 0, build: parkingLot },
  { id: 'pocketPark', front: [10, 14], depth: [12, 18], zones: { residential: 0.25, inner: 0.3, commercial: 0.2, civic: 0.3 }, corner: 0.5, perCell: 1, h: 0, build: pocketParkLot },
  { id: 'workshop', front: [18, 28], depth: [20, 28], zones: { industrial: 4, commercial: 0.25 }, corner: 1, h: 7, build: workshopLot },
  { id: 'yard', front: [30, 44], depth: [28, 36], zones: { industrial: 2 }, corner: 1, perCell: 1, h: 9, build: yardLot },
  { id: 'midrise', front: [14, 26], depth: [14, 22], zones: { core: 4, mainstreet: 1.6 }, corner: 1.3, h: 14, build: midriseLot },
  { id: 'tower', front: [18, 30], depth: [18, 26], zones: { core: 3 }, corner: 1.2, h: 60, build: towerLot },
];
