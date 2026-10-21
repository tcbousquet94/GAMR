// Turf map generator. District config + seed -> a 3D city (Kit + physics World, which the renderer already draws)
// AND the strategy data the game logic plays on (city.turf):
//   warehouses (the bases / castles) with siege data, businesses (the villages, raided not captured) linked 1-3 per
//   warehouse, territories (a warehouse's block plus its businesses' blocks) with adjacency, blocks, landmarks,
//   edges and connections, battle zones (raid / siege / turf war), cover points and climb points.
// Fully deterministic from the seed.
//
// Order is landmark-first: identity -> landmark -> roads -> edges -> zoning (warehouses, territories) -> bases and
// businesses -> fill -> connections.

import { Rng } from '../../core/rng.js';
import { Kit } from '../kit.js';
import { World } from '../../sim/physics.js';
import { buildFireEscapes } from '../modules/building.js';
import { PROP_SIZE } from '../modules/streets.js';
import { assignClimbWalls, validStandPoint } from '../generator.js';
import { layoutRoads, rectHitsDiag } from './layout.js';
import { Raster, R } from './raster.js';
import { ground, furniture } from './ground.js';
import { edges } from './edges.js';
import { landmark, landmarkPlaza, park, civic, garage, perimeterBuildings, diagonalFrontage, interiors, kitTower } from './fill.js';
import { buildBusiness, frame, footprint, businessName, TEMPLATE, TYPES } from './business.js';
import { buildWarehouse, warehouseFootprint, WH, WAREHOUSE_NAMES, HQ_WAREHOUSE_NAMES } from './warehouse.js';
import { wornCity } from './worn.js';
import { TAG } from '../kit.js';
import { emptyKitData, kitColliders, CURB } from '../kitdata/data.js';
import { placeModules } from '../kitdata/hood.js';
import { streetData } from '../kitdata/streets.js';
import { bodegaStaff, isWalkIn } from '../kitdata/bodega.js';

// opts.kit (default true): the remastered look. Streets, kerbs, verges and furniture come from the kit (as kit data),
// free blocks are filled with neighbourhood modules, and the generator's own boxes are drawn with kit materials.
export function generateTurf(cfg, seed, opts = {}) {
  const rng = new Rng(`turf:${cfg.id}:${seed}`);
  const kit = new Kit(rng, cfg.palette);
  // Identity + road skeleton (the landmark's spot is chosen on the skeleton, so it comes first in code).
  const L = layoutRoads(cfg, rng);
  const city = {
    district: cfg, seed: String(seed), kit, layout: L, size: L.size, sizeX: L.sizeX, sizeZ: L.sizeZ,
    interactables: [], edges: null, laundrySpans: [], kitLook: opts.kit !== false,
  };
  city.blocks = L.blocks.map((b) => ({ ...b, district: cfg.id, zone: null, owner: 'neutral', territory: null, warehouse: null, businesses: [] }));
  city.sideOpen = (cell, side) => sideOpen(L, cell, side);
  const raster = new Raster(L.sizeX, L.sizeZ);
  // Landmark block, warehouses, HQs, territories and zones are all settled before any geometry.
  zoning(city, rng);
  ground(kit, city, raster);
  edges(kit, city);
  landmark(kit, city, raster, () => !!chooseSpot(city, city.blocks[city.landmarkBlock], raster, new Rng('probe'), new Set()));
  warehouses(kit, city, raster, rng);
  businesses(kit, city, raster, rng);
  // Fill: plaza, parks, civic, garages, buildings, diagonal frontage, interiors; then street furniture.
  landmarkPlaza(kit, city, raster);
  for (const b of city.blocks) {
    if (b.zone === 'park') park(kit, city, b, raster);
    if (b.zone === 'civic') civic(kit, city, b, raster);
  }
  for (const b of rng.shuffle(city.blocks.filter((q) => q.zone === 'commercial'))) if (rng.chance(cfg.buildings.garageChance)) garage(kit, city, b, raster);
  // Neighbourhood modules in whole cells that nothing else has claimed (kit look).
  const KD = city.kitLook ? emptyKitData() : null;
  let cuts = [];
  if (KD) {
    const free = L.cells.filter((c) => raster.test({ x0: c.rect.x0 + 0.5, z0: c.rect.z0 + 0.5, x1: c.rect.x1 - 0.5, z1: c.rect.z1 - 0.5 }, R.BLOCK, R.DIAG | R.RESERVED | R.BUILT | R.STREET | R.MEWS));
    const cells = free.map((c) => ({ rect: c.rect, zone: city.blocks[c.block].zone, sides: sidesOf(city, c), src: c }));
    cuts = placeModules(KD, cells, rng);
    for (const c of cells) if (c.placed) { raster.mark(c.rect, R.BUILT); c.src.module = c.placed; }
    city.kitPending = KD; city.kitCuts = cuts;
  }
  for (const b of city.blocks) if (b.zone !== 'park' && b.zone !== 'landmark') perimeterBuildings(kit, city, b, raster);
  diagonalFrontage(kit, city, raster);
  interiors(kit, city, raster);
  if (KD) {
    // Streets in the kit look: kerbs, verges, walks, paint, palms, poles, lights, hydrants, parked cars.
    const cells = L.cells.map((c) => ({ rect: c.rect, zone: city.blocks[c.block].zone, sides: sidesOf(city, c) }));
    const byRect = new Map(cells.map((c) => [`${c.rect.x0},${c.rect.z0}`, c]));
    for (const q of cuts) q.cell = byRect.get(`${q.cell.rect.x0},${q.cell.rect.z0}`);
    delete city.kitPending; delete city.kitCuts;
    KD.pads.unshift({ surf: 'asphalt', poly: rectPoly(city.inner, 40), y0: -0.2, y1: 0, tint: 0xc4c2be });
    for (const c of cells) KD.pads.splice(1, 0, { surf: c.zone === 'residential' || c.zone === 'park' ? 'grass' : 'concrete', poly: rectPoly(c.rect, 0), y0: 0, y1: CURB - 0.004, tint: c.zone === 'industrial' ? 0xb8b4ac : 0xffffff });
    streetData(KD, { cells, segs: L.segs, sw: cfg.roads.sidewalk, rng, cuts });
    // Staff and regulars inside furnished businesses (the diner).
    for (const b of city.businesses) for (const q of b.patrons || []) KD.people.push(q);
    for (const q of kit.interiorPeople || []) KD.people.push(q); // walk-in cafes (modules/cafe.js)
    // Walk-in corner markets: a clerk behind the counter and a dim fluorescent room light (no rng: placed by position).
    for (const st of KD.stores) {
      if (!isWalkIn(st)) continue;
      const { clerk, light } = bodegaStaff(st, (Math.round(st.x * 7 + st.z * 13) % 1e6 + 1e6) % 1e6);
      KD.people.push(clerk);
      kit.light(light.x, light.y, light.z, 0xf2ead2, 8, 'shop');
      Object.assign(kit.lights[kit.lights.length - 1], { power: 0.4, tint: 0xf2e8d0 });
    }
    // The rest of the city beyond the edges: a ring of real high-rises (the old flat skyline is not drawn in the kit look).
    const I = city.inner, cxm = (I.x0 + I.x1) / 2, czm = (I.z0 + I.z1) / 2, R0 = Math.max(I.x1 - I.x0, I.z1 - I.z0) / 2;
    for (let k = 0; k < 22; k++) {
      const a = rng.range(0, Math.PI * 2), r = R0 + rng.range(140, 420);
      KD.towers.push({ ...kitTower(rng, cxm + Math.cos(a) * r, czm + Math.sin(a) * r, rng.range(18, 34), rng.range(18, 30), rng.range(35, 130), rng.range(0, Math.PI)), y: 0, far: true });
    }
    if (cfg.clutter) thinClutter(KD, kit, cfg.clutter, new Rng(`thin:${cfg.id}:${seed}`));
    kitColliders(KD, (x0, y0, z0, x1, y1, z1, tag) => kit.collider(x0, y0, z0, x1, y1, z1, tag), TAG);
    city.kitData = KD;
  } else {
    furniture(kit, city, raster);
    wornCity(kit, city, raster);
  }
  buildFireEscapes(kit);

  // Physics.
  const world = new World();
  for (const b of kit.solids) world.addSolid(b);
  for (const c of kit.climbs) world.addClimb(c.box);
  assignClimbWalls(world, kit);
  world.bounds = { minX: city.bounds.x0, minZ: city.bounds.z0, maxX: city.bounds.x1, maxZ: city.bounds.z1 };
  city.world = world;
  city.spawnPoints = kit.spawns.filter((s) => validStandPoint(world, s.x, s.y, s.z, 0.5, 1.9));
  const hq0 = city.warehouses.find((w) => w.hq === 0);
  // Player start: the HQ yard just inside the gate (searching outward if a prop ever lands on it).
  let sp = hq0.yardSpawn;
  for (let r = 0; r < 8 && !validStandPoint(world, sp.x, 0.15, sp.z, 0.45, 1.9); r += 0.5) {
    for (let a = 0; a < 16; a++) { const q = { x: hq0.yardSpawn.x + Math.cos(a * 0.39) * r, z: hq0.yardSpawn.z + Math.sin(a * 0.39) * r }; if (validStandPoint(world, q.x, 0.15, q.z, 0.45, 1.9)) { sp = q; break; } }
  }
  city.spawn = { x: sp.x, y: 0.3, z: sp.z, yaw: Math.atan2(-(hq0.safe.x - sp.x), -(hq0.safe.z - sp.z)) };

  // Strategy data last: cover, climbs, battle zones.
  city.turf = turfData(city, world, kit);
  return city;
}

const sidesOf = (city, c) => ({ s: city.sideOpen(c, 's'), n: city.sideOpen(c, 'n'), e: city.sideOpen(c, 'e'), w: city.sideOpen(c, 'w') });
const rectPoly = (r, m) => [[r.x0 - m, r.z0 - m], [r.x1 + m, r.z0 - m], [r.x1 + m, r.z1 + m], [r.x0 - m, r.z1 + m]];

// ---- zoning: landmark, warehouses, HQs, territories, zones --------------------------------------------------------
function zoning(city, rng) {
  const cfg = city.district, L = city.layout;
  const mc = { x: L.sizeX / 2, z: L.sizeZ / 2 };
  const d01 = (b) => Math.hypot(b.center.x - mc.x, b.center.z - mc.z) / (L.size / 2);
  // Landmark: the most central cell the diagonal doesn't cut, so the boulevard runs past the spire's plaza.
  const byCentre = L.cells.slice().sort((p, q) => dcell(p, mc) - dcell(q, mc));
  const centreCell = byCentre.find((c) => !rectHitsDiag(L.diag, c.rect, 0)) || byCentre[0];
  city.landmarkBlock = centreCell.block;
  city.blocks[city.landmarkBlock].zone = 'landmark';
  // Warehouse spots: a cell corner with streets on two sides (front + corner side) where the compound and its service
  // lane fit clear of the diagonal. Industrial pockets: the ring, the river and rail-yard edges score higher.
  const spots = new Map();
  for (const b of city.blocks) {
    if (b.zone === 'landmark') continue;
    const cands = [];
    for (const [i, j] of b.cells) {
      const cell = L.cellAt(i, j), r = cell.rect;
      for (const side of ['n', 's', 'w', 'e']) {
        if (!sideOpen(L, cell, side)) continue;
        for (const c of corners(r, side)) {
          if (!sideOpen(L, cell, c.corner)) continue;
          const fr = frame(c.C, c.tu, c.tv);
          const fp = warehouseFootprint(fr);
          if (fp.x0 < r.x0 - 0.6 || fp.x1 > r.x1 + 0.6 || fp.z0 < r.z0 - 0.6 || fp.z1 > r.z1 + 0.6) continue;
          if (rectHitsDiag(L.diag, fp, 1.5)) continue;
          const edge = i === 0 || j === 0 || i === L.cols - 1 || j === L.rows - 1;
          const industrial = (cfg.edges.e === 'river' && i === L.cols - 1) || (cfg.edges.n === 'railyard' && j === 0) || (cfg.edges.w === 'warehouses' && i === 0);
          cands.push({ C: c.C, tu: c.tu, tv: c.tv, side, corner: c.corner, cell, score: (edge ? 2 : 0) + (industrial ? 1.5 : 0) + rng.next() });
        }
      }
    }
    if (cands.length) spots.set(b.id, cands.sort((p, q) => q.score - p.score)[0]);
  }
  const hops = city.blocks.map((b) => bfs(city.blocks, b.id));
  const W = Math.max(2, Math.min(rng.int(cfg.warehouses[0], cfg.warehouses[1]), Math.floor(city.blocks.length / 2)));
  const eligible = [...spots.keys()];
  // HQs: the eligible pair furthest apart (hops, then distance), each with a free neighbour for its diner.
  const dinerOpts = (id, taken) => city.blocks[id].adjacent.filter((n) => !taken.has(n) && n !== city.landmarkBlock);
  const distinctDiners = (a, b) => { const ta = dinerOpts(a, new Set([a, b])), tb = dinerOpts(b, new Set([a, b])); return ta.some((x) => tb.some((y) => y !== x)); };
  let best = null;
  for (const a of eligible) for (const b of eligible) {
    if (a >= b || !distinctDiners(a, b)) continue;
    const pa = city.blocks[a].center, pb = city.blocks[b].center;
    const score = hops[a][b] * 1000 + Math.hypot(pa.x - pb.x, pa.z - pb.z);
    if (!best || score > best.score) best = { a, b, score };
  }
  if (!best) throw new Error(`no HQ pair (seed ${city.seed})`);
  const whBlocks = rng.chance(0.5) ? [best.a, best.b] : [best.b, best.a];
  // Reserve each HQ's diner block (a neighbour, distinct for the two HQs) before any other warehouse is placed.
  const dinerBlocks = [];
  for (const h of whBlocks) {
    const opts = dinerOpts(h, new Set([...whBlocks, ...dinerBlocks]));
    const other = whBlocks.find((x) => x !== h);
    const keep = opts.filter((o) => dinerOpts(other, new Set([...whBlocks, ...dinerBlocks, o])).length || dinerBlocks.length);
    dinerBlocks.push((keep.length ? keep : opts).sort((p, q) => dist(city.blocks[p].center, city.blocks[h].center) - dist(city.blocks[q].center, city.blocks[h].center))[0]);
  }
  // Other warehouses: best-scoring spots, spread out (not next to another warehouse when avoidable).
  const rest = eligible.filter((id) => !whBlocks.includes(id) && !dinerBlocks.includes(id)).sort((p, q) => spots.get(q).score - spots.get(p).score);
  for (const pass of [true, false]) for (const id of rest) {
    if (whBlocks.length >= W || whBlocks.includes(id)) continue;
    if (pass && whBlocks.some((w) => hops[w][id] <= 1)) continue;
    whBlocks.push(id);
  }
  city.whPlan = whBlocks.map((block, k) => ({ id: k, block, hq: k < 2 ? k : null, spot: spots.get(block), businesses: [] }));
  const whOf = new Map(city.whPlan.map((w) => [w.block, w]));
  // Territories: every other block joins a warehouse. HQs first take a neighbouring block for the diner; then each
  // warehouse gets its nearest free block; then the rest go to the nearest warehouse with room (1-3 businesses).
  const free = new Set(city.blocks.map((b) => b.id).filter((id) => !whOf.has(id)));
  const claim = (w, id, n = 1) => { free.delete(id); w.businesses.push(...Array.from({ length: n }, () => id)); city.blocks[id].territory = w.id; };
  for (const w of city.whPlan.slice(0, 2)) { w.dinerBlock = dinerBlocks[w.id]; claim(w, w.dinerBlock); }
  const pairs = [];
  // Rank by straight-line distance (what you'll walk), with block hops as a small tiebreaker.
  for (const w of city.whPlan) for (const id of free) pairs.push({ w, id, d: hops[w.block][id] * 30 + dist(city.blocks[w.block].center, city.blocks[id].center) });
  pairs.sort((p, q) => p.d - q.d);
  // Each warehouse's first business block: greedy nearest, then pairwise swaps while they shorten the longest link
  // (with few spare blocks, plain greedy can strand one warehouse with a block across town).
  const first = new Map();
  for (const p of pairs) if (!p.w.businesses.length && !first.has(p.w) && free.has(p.id) && ![...first.values()].includes(p.id)) first.set(p.w, p.id);
  const cost = (w, id) => hops[w.block][id] * 30 + dist(city.blocks[w.block].center, city.blocks[id].center);
  for (let improved = true, guard = 0; improved && guard < 50; guard++) {
    improved = false;
    const ws = [...first.keys()];
    for (let a = 0; a < ws.length; a++) for (let b = a + 1; b < ws.length; b++) {
      const A = ws[a], Bw = ws[b], ia = first.get(A), ib = first.get(Bw);
      if (Math.max(cost(A, ib), cost(Bw, ia)) + 1e-6 < Math.max(cost(A, ia), cost(Bw, ib))) { first.set(A, ib); first.set(Bw, ia); improved = true; }
    }
  }
  for (const [w, id] of first) claim(w, id);
  for (const p of pairs) {
    if (!free.has(p.id)) continue;
    const load = p.w.businesses.length;
    if (load >= 3) continue;
    const two = city.blocks[p.id].cells.length > 1 && load <= 1 && rng.chance(0.5);
    claim(p.w, p.id, two ? 2 : 1);
  }
  for (const w of city.whPlan) { city.blocks[w.block].territory = w.id; city.blocks[w.block].warehouse = w.id; if (!w.businesses.length) throw new Error(`warehouse ${w.id} has no business (seed ${city.seed})`); }
  // Zones: warehouse blocks are industrial; parks on the ring, civic near the core, the rest commercial/residential.
  for (const id of whBlocks) city.blocks[id].zone = 'industrial';
  const taken = new Set([...whBlocks, ...city.whPlan.map((w) => w.dinerBlock)]);
  const nParks = rng.int(cfg.zoning.parks[0], cfg.zoning.parks[1]);
  const ring = rng.shuffle(city.blocks.filter((b) => !b.zone && !taken.has(b.id) && d01(b) > 0.45)).sort((p, q) => p.cells.length - q.cells.length);
  for (const b of ring.slice(0, nParks)) b.zone = 'park';
  const nCivic = rng.int(cfg.zoning.civic[0], cfg.zoning.civic[1]);
  for (const b of city.blocks.filter((q) => !q.zone && !taken.has(q.id)).sort((p, q) => d01(p) - d01(q)).slice(0, nCivic)) b.zone = 'civic';
  for (const b of city.blocks) if (!b.zone) b.zone = d01(b) < 0.55 ? 'commercial' : 'residential';
  // Owners: each gang holds its HQ territory; everything else starts neutral.
  for (const w of city.whPlan) w.owner = w.hq != null ? `gang${w.hq}` : 'neutral';
  for (const b of city.blocks) if (b.territory != null) b.owner = city.whPlan[b.territory].owner;
}

// ---- warehouses ---------------------------------------------------------------------------------------------------
function warehouses(kit, city, raster, rng) {
  const used = new Set();
  const names = rng.shuffle(WAREHOUSE_NAMES.slice());
  city.warehouses = [];
  for (const p of city.whPlan) {
    const fr = frame(p.spot.C, p.spot.tu, p.spot.tv);
    const name = p.hq != null ? HQ_WAREHOUSE_NAMES[p.hq] : names.find((n) => !used.has(n));
    used.add(name);
    const wh = { id: p.id, name, block: p.block, owner: p.owner, hq: p.hq, level: 1, businesses: [] };
    kit.module = { id: 2000 + wh.id, type: 'warehouse' };
    buildWarehouse(kit, fr, wh);
    kit.module = null;
    wh.footprint = warehouseFootprint(fr);
    raster.mark(wh.footprint, R.RESERVED | R.BUILT);
    raster.mark(fr.rect(-1.5, -city.layout.S / 2, WH.U0 + WH.WU + WH.lane, 0), R.NOFURN);
    raster.mark(fr.rect(-city.layout.S / 2, -1.5, 0, WH.V0 + WH.WV + WH.lane), R.NOFURN);
    wh.frame = { C: p.spot.C, tu: p.spot.tu, tv: p.spot.tv };
    wh.cell = [p.spot.cell.i, p.spot.cell.j];
    wh.siege.staging = stagingAreas(city, p.spot);
    city.warehouses.push(wh);
  }
}

// Staging areas: on the street outside each open side of the warehouse's cell (front and corner side always).
function stagingAreas(city, spot) {
  const L = city.layout, S = L.S, r = spot.cell.rect, fr = frame(spot.C, spot.tu, spot.tv);
  const ext = (axis) => Math.max(...[[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]].map(([x, z]) => (x - spot.C.x) * axis.x + (z - spot.C.z) * axis.z));
  const Lu = ext(spot.tu), Lv = ext(spot.tv);
  const out = [];
  const add = (u, v, side) => { const p = fr.at(u, v); out.push({ x: +p.x.toFixed(2), y: 0, z: +p.z.toFixed(2), side }); };
  add(WH.U0 + 17, -S / 2, 'front');
  add(-S / 2, WH.V0 + WH.WV / 2, 'corner');
  const farSide = { n: { e: 'w', w: 'e' }, s: { e: 'w', w: 'e' }, w: { n: 's', s: 'n' }, e: { n: 's', s: 'n' } }[spot.side][spot.corner];
  const backSide = { n: 's', s: 'n', w: 'e', e: 'w' }[spot.side];
  if (sideOpen(L, spot.cell, backSide)) add(WH.U0 + WH.WU / 2, Lv + S / 2, 'back');
  if (sideOpen(L, spot.cell, farSide)) add(Lu + S / 2, WH.V0 + WH.WV / 2, 'far');
  return out;
}

// ---- businesses ---------------------------------------------------------------------------------------------------
function businesses(kit, city, raster, rng) {
  const cfg = city.district;
  // Types: HQ diners next door to their warehouses, the rest dealt from the weighted mix (largest remainder, at
  // least one of each type when there are enough businesses), shuffled.
  const slots = [];
  for (const w of city.whPlan) for (const [k, block] of w.businesses.entries()) slots.push({ w, block, diner: w.hq != null && k === 0 });
  const n = slots.filter((s) => !s.diner).length;
  const mix = Object.entries(cfg.businessMix);
  const total = mix.reduce((s, [, w]) => s + w, 0);
  let deck = [];
  const quotas = mix.map(([t, w]) => ({ t, q: (w / total) * n }));
  for (const { t, q } of quotas) for (let k = 0; k < Math.floor(q); k++) deck.push(t);
  for (const { t } of quotas.slice().sort((a, b) => (b.q % 1) - (a.q % 1))) if (deck.length < n) deck.push(t);
  if (n >= mix.length) for (const [t] of mix) if (!deck.includes(t)) { const dup = mostCommon(deck); deck.splice(deck.indexOf(dup), 1, t); }
  deck = rng.shuffle(deck);
  const usedNames = new Set(), usedCells = new Set();
  city.businesses = [];
  for (const s of slots) {
    const b = city.blocks[s.block];
    const type = s.diner ? 'diner' : deck.pop();
    const spot = chooseSpot(city, b, raster, rng, usedCells);
    if (!spot) throw new Error(`no business spot in block ${b.id} (seed ${city.seed})`);
    usedCells.add(`${spot.cell.i},${spot.cell.j}`);
    const fr = frame(spot.C, spot.tu, spot.tv);
    const name = s.diner ? cfg.hq.names[s.w.hq] : businessName(type, rng, usedNames);
    const wh = city.warehouses[s.w.id];
    const biz = { id: city.businesses.length, type, label: TYPES[type].label, name, block: b.id, level: 1, owner: wh.owner, warehouse: wh.id, hq: s.diner ? s.w.hq : null, front: spot.side };
    kit.module = { id: 1000 + biz.id, type: 'business' };
    buildBusiness(kit, fr, biz, { cornerStreet: spot.cornerStreet, sidewalk: cfg.roads.sidewalk });
    kit.module = null;
    biz.footprint = footprint(fr);
    raster.mark(biz.footprint, R.RESERVED | R.BUILT);
    raster.mark(fr.rect(-1.5, -cfg.roads.street / 2, TEMPLATE.F + TEMPLATE.A + 1.5, 0), R.NOFURN);
    biz.frame = { C: spot.C, tu: spot.tu, tv: spot.tv };
    // Raid approach points: the two ends of the front street (just inside each intersection), the alley, the back.
    biz.approach = streetEnds(city.layout, spot).map((p) => ({ ...p, kind: 'street' }));
    biz.approach.push({ ...biz.alleyMouth, kind: 'alley' });
    biz.approach.push({ ...biz.alleyEnd, kind: 'back' });
    b.businesses.push(biz.id);
    wh.businesses.push(biz.id);
    city.laundrySpans.push(biz.laundry);
    city.businesses.push(biz);
  }
}

// Candidate spots: every cell corner (and a few mid-frontage offsets) facing an open street, in both orientations.
function chooseSpot(city, b, raster, rng, usedCells) {
  const L = city.layout;
  const cands = [];
  for (const [i, j] of b.cells) {
    if (usedCells.has(`${i},${j}`)) continue;
    const cell = L.cellAt(i, j), r = cell.rect;
    for (const side of ['n', 's', 'w', 'e']) {
      if (!sideOpen(L, cell, side)) continue;
      for (const c of corners(r, side)) {
        for (const off of [0, 16, 26, 36]) {
          const C = { x: c.C.x + c.tu.x * off, z: c.C.z + c.tu.z * off };
          const fr = frame(C, c.tu, c.tv);
          const fp = footprint(fr);
          if (fp.x0 < r.x0 - 0.6 || fp.x1 > r.x1 + 0.6 || fp.z0 < r.z0 - 0.6 || fp.z1 > r.z1 + 0.6) continue;
          if (rectHitsDiag(L.diag, fp, 1.5) || !raster.test(fp, R.BLOCK, R.DIAG | R.RESERVED | R.BUILT)) continue;
          const cornerStreet = off === 0 && sideOpen(L, cell, c.corner);
          const outer = segOf(L, cell, side).outer;
          cands.push({ C, tu: c.tu, tv: c.tv, side, cornerStreet, seg: segOf(L, cell, side).seg, cell, score: (cornerStreet ? 3 : 0) + (outer ? 0 : 1) - off * 0.03 + rng.next() });
        }
      }
    }
  }
  cands.sort((p, q) => q.score - p.score);
  return cands[0] || null;
}

function corners(r, side) {
  if (side === 'n') return [{ C: { x: r.x0, z: r.z0 }, tu: { x: 1, z: 0 }, tv: { x: 0, z: 1 }, corner: 'w' }, { C: { x: r.x1, z: r.z0 }, tu: { x: -1, z: 0 }, tv: { x: 0, z: 1 }, corner: 'e' }];
  if (side === 's') return [{ C: { x: r.x1, z: r.z1 }, tu: { x: -1, z: 0 }, tv: { x: 0, z: -1 }, corner: 'e' }, { C: { x: r.x0, z: r.z1 }, tu: { x: 1, z: 0 }, tv: { x: 0, z: -1 }, corner: 'w' }];
  if (side === 'w') return [{ C: { x: r.x0, z: r.z1 }, tu: { x: 0, z: -1 }, tv: { x: 1, z: 0 }, corner: 's' }, { C: { x: r.x0, z: r.z0 }, tu: { x: 0, z: 1 }, tv: { x: 1, z: 0 }, corner: 'n' }];
  return [{ C: { x: r.x1, z: r.z0 }, tu: { x: 0, z: 1 }, tv: { x: -1, z: 0 }, corner: 'n' }, { C: { x: r.x1, z: r.z1 }, tu: { x: 0, z: -1 }, tv: { x: -1, z: 0 }, corner: 's' }];
}

// The street segment beside a cell side, and whether it's on the map edge.
function segOf(L, cell, side) {
  const { i, j } = cell;
  const find = (axis, k, m) => L.segs.find((s) => s.axis === axis && s.k === k && s.m === m);
  const seg = side === 'n' ? find('h', j, i) : side === 's' ? find('h', j + 1, i) : side === 'w' ? find('v', i, j) : find('v', i + 1, j);
  const outer = (side === 'n' && j === 0) || (side === 's' && j === L.rows - 1) || (side === 'w' && i === 0) || (side === 'e' && i === L.cols - 1);
  return { seg, outer };
}
export function sideOpen(L, cell, side) { return segOf(L, cell, side).seg.open; }

// Points 5 m into the street from each intersection at the ends of the front segment.
function streetEnds(L, spot) {
  const s = spot.seg;
  const ia = L.intersections.find((I) => I.k === s.a[0] && I.m === s.a[1]);
  const ib = L.intersections.find((I) => I.k === s.b[0] && I.m === s.b[1]);
  const dir = s.axis === 'v' ? { x: 0, z: 1 } : { x: 1, z: 0 };
  return [
    { x: ia.x + dir.x * (L.S / 2 + 5), y: 0, z: ia.z + dir.z * (L.S / 2 + 5) },
    { x: ib.x - dir.x * (L.S / 2 + 5), y: 0, z: ib.z - dir.z * (L.S / 2 + 5) },
  ];
}

// ---- strategy data ---------------------------------------------------------------------------------------------------
const COVER_PROPS = new Set(['car', 'van', 'planter', 'dumpster', 'bench', 'trashcan', 'crate', 'barrier', 'ibeams', 'truck']);

function turfData(city, world, kit) {
  const L = city.layout, S = L.S;
  // Cover points around every cover object, on each side, facing the object (it protects from the far side).
  const boxes = [];
  for (const p of kit.props) {
    if (!COVER_PROPS.has(p.type)) continue;
    const s = PROP_SIZE[p.type];
    const rot = Math.abs(Math.sin(p.yaw || 0)) > 0.5;
    const hx = rot ? s[2] : s[0], hz = rot ? s[0] : s[2];
    boxes.push({ x0: p.x - hx, z0: p.z - hz, x1: p.x + hx, z1: p.z + hz, y0: p.y, y1: p.y + s[1], kind: p.type });
  }
  for (const b of city.businesses) for (const c of b.cover) if (c.x0 != null) boxes.push({ ...c });
  for (const w of city.warehouses) for (const c of w.siege.cover) boxes.push({ ...c });
  const cover = [];
  for (const bx of boxes) {
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const len = nx ? bx.z1 - bx.z0 : bx.x1 - bx.x0;
      const ts = len > 3 ? [0.25, 0.75] : [0.5];
      for (const t of ts) {
        const x = nx ? (nx > 0 ? bx.x1 + 0.7 : bx.x0 - 0.7) : bx.x0 + (bx.x1 - bx.x0) * t;
        const z = nz ? (nz > 0 ? bx.z1 + 0.7 : bx.z0 - 0.7) : bx.z0 + (bx.z1 - bx.z0) * t;
        const gy = world.groundBelow(x, bx.y0 + 0.5, z, 0.1, 1.5);
        if (!Number.isFinite(gy) || Math.abs(gy - bx.y0) > 0.45) continue;
        if (!world.fits(x, gy + 0.05, z, 0.35, 1.0)) continue;
        cover.push({ x: +x.toFixed(2), y: +gy.toFixed(2), z: +z.toFixed(2), protects: { x: -nx, z: -nz }, height: bx.y1 - bx.y0 >= 1.3 ? 'high' : 'low', kind: bx.kind });
      }
    }
  }
  // Climb points: base and top of every ladder / fire escape.
  const climbs = [];
  for (const { box: b, style } of kit.climbs) {
    const w = b.wall || { x: 0, z: 0 };
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    climbs.push({ kind: style, base: { x: +(cx - w.x * 0.9).toFixed(2), y: b.minY, z: +(cz - w.z * 0.9).toFixed(2) }, top: { x: +(cx + w.x * 1.1).toFixed(2), y: +(b.maxY - 0.7).toFixed(2), z: +(cz + w.z * 1.1).toFixed(2) } });
  }
  // Territories: a warehouse's block plus its businesses' blocks; adjacent when any of their blocks border.
  const territories = city.warehouses.map((w) => {
    const blocks = [...new Set([w.block, ...city.businesses.filter((b) => b.warehouse === w.id).map((b) => b.block)])];
    return { id: w.id, warehouse: w.id, owner: w.owner, blocks };
  });
  for (const t of territories) {
    const adj = new Set();
    for (const id of t.blocks) for (const n of city.blocks[id].adjacent) { const o = city.blocks[n].territory; if (o != null && o !== t.id) adj.add(o); }
    t.adjacent = [...adj].sort((a, b) => a - b);
  }
  // Battle zones.
  const grow = (r, d) => ({ x0: r.x0 - d, z0: r.z0 - d, x1: r.x1 + d, z1: r.z1 + d });
  const union = (a, b) => ({ x0: Math.min(a.x0, b.x0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), z1: Math.max(a.z1, b.z1) });
  const nearestI = (p) => L.intersections.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  // RAID (4-6 per side): a business, fought on its block.
  const raid = city.businesses.map((biz) => {
    const near = nearestI(biz.door);
    let boundary = grow(city.blocks[biz.block].bounds, S / 2);
    boundary = union(boundary, near.rect);
    return { kind: 'raid', perSide: [4, 6], business: biz.id, warehouse: biz.warehouse, block: biz.block, boundary, soft: true, target: biz.capture, approach: biz.approach, defenderPosts: biz.defenderPosts };
  });
  // SIEGE (8-12 per side): a warehouse, its yard and the streets around it.
  const siege = city.warehouses.map((w) => {
    let boundary = grow(w.compound, WH.lane + 2);
    for (const s of w.siege.staging) boundary = union(boundary, { x0: s.x - 6, z0: s.z - 6, x1: s.x + 6, z1: s.z + 6 });
    return { kind: 'siege', perSide: [8, 12], warehouse: w.id, block: w.block, boundary, soft: true, capture: w.safe, staging: w.siege.staging, breach: w.siege.breach, defenderPosts: w.siege.defenderPosts };
  });
  // TURF WAR (larger): the landmark and each HQ, with capture points across the neighbouring blocks.
  const sitesIn = (ids) => {
    const pts = [];
    for (const id of ids) {
      const b = city.blocks[id];
      if (b.warehouse != null) pts.push({ block: id, warehouse: b.warehouse, ...city.warehouses[b.warehouse].safe });
      for (const bz of b.businesses) pts.push({ block: id, business: bz, ...city.businesses[bz].capture });
    }
    return pts;
  };
  const turfWar = [{ at: 'landmark', block: city.landmarkBlock }, ...city.warehouses.filter((w) => w.hq != null).map((w) => ({ at: `hq${w.hq}`, block: w.block }))].map((z) => {
    const blk = city.blocks[z.block];
    const blocks = [blk.id, ...blk.adjacent];
    let boundary = grow(blk.bounds, S / 2);
    for (const id of blk.adjacent) boundary = union(boundary, grow(city.blocks[id].bounds, S / 2));
    return { kind: 'turfWar', at: z.at, block: blk.id, blocks, boundary, capturePoints: sitesIn(blocks) };
  });
  const whOut = (w) => ({
    id: w.id, name: w.name, block: w.block, owner: w.owner, hq: w.hq, level: w.level, businesses: w.businesses, cell: w.cell,
    safe: w.safe, capture: w.safe, gate: w.gate, sideGate: w.sideGate, docks: w.docks, sideDoor: w.sideDoor, skylights: w.skylights, roof: w.roof,
    booth: w.booth, office: w.office, catwalk: w.catwalk, floodlights: w.floodlights, compound: w.compound, footprint: w.footprint, yardSpawn: w.yardSpawn,
    fenceSections: w.fenceSections, staging: w.siege.staging, breach: w.siege.breach, defenderPosts: w.siege.defenderPosts,
    siegeEquipment: w.siegeEquipment, upgradeSlots: w.upgradeSlots, upgrades: w.upgrades,
  });
  return {
    district: { id: city.district.id, name: city.district.name, personality: city.district.personality },
    size: { x: L.sizeX, z: L.sizeZ },
    blocks: city.blocks.map((b) => ({ id: b.id, district: b.district, zone: b.zone, owner: b.owner, territory: b.territory, warehouse: b.warehouse, businesses: b.businesses, adjacent: b.adjacent, cells: b.cells, rects: b.rects, bounds: b.bounds, center: b.center })),
    warehouses: city.warehouses.map(whOut),
    businesses: city.businesses.map((b) => ({
      id: b.id, type: b.type, name: b.name, block: b.block, warehouse: b.warehouse, level: b.level, owner: b.owner, hq: b.hq, front: b.front,
      capture: b.capture, door: b.door, doorInside: b.doorInside, backDoor: b.backDoor, gate: b.gate, roof: b.roof, ladder: b.ladder,
      defenderPosts: b.defenderPosts, approach: b.approach, footprint: b.footprint, memorialWall: b.memorialWall || null,
    })),
    territories,
    hqs: city.warehouses.filter((w) => w.hq != null).map((w) => ({ gang: w.hq, warehouse: w.id, block: w.block, diner: city.businesses.find((b) => b.warehouse === w.id && b.type === 'diner')?.id })),
    landmarks: [{ kind: city.district.landmark.kind, ...city.landmark }],
    civic: city.civic || null,
    garages: city.garages || [],
    edges: city.district.edges,
    connections: city.connections,
    roads: { segments: L.segs.map((s) => ({ axis: s.axis, k: s.k, m: s.m, rect: s.rect, open: s.open })), intersections: L.intersections.map((I) => ({ k: I.k, m: I.m, x: I.x, z: I.z, degree: I.degree, rect: I.rect })), diagonal: L.diag },
    zones: { raid, siege, turfWar },
    cover,
    climbs,
  };
}

function bfs(blocks, start) {
  const d = blocks.map(() => Infinity);
  d[start] = 0;
  const q = [start];
  while (q.length) { const a = q.shift(); for (const b of blocks[a].adjacent) if (d[b] === Infinity) { d[b] = d[a] + 1; q.push(b); } }
  return d;
}
function dcell(c, p) { return Math.hypot((c.rect.x0 + c.rect.x1) / 2 - p.x, (c.rect.z0 + c.rect.z1) / 2 - p.z); }
function mostCommon(a) { const m = {}; for (const x of a) m[x] = (m[x] || 0) + 1; return Object.entries(m).sort((p, q) => q[1] - p[1])[0][0]; }
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Sparser streets for districts that ask for it (cfg.clutter): trees and palms kept at least `treeSpacing` metres
// apart, and only a share of shrubs, parked cars, bins and loose props. Runs before the colliders are built.
function thinClutter(KD, kit, c, rng) {
  const kept = [];
  const spaced = (list) => list.filter((t) => {
    if (kept.some((k) => (k.x - t.x) ** 2 + (k.z - t.z) ** 2 < c.treeSpacing ** 2)) return false;
    kept.push(t); return true;
  });
  KD.palms = spaced(rng.shuffle([...KD.palms]));
  KD.trees = spaced(KD.trees);
  const share = (list, f) => (f == null ? list : list.filter(() => rng.chance(f)));
  KD.shrubs = share(KD.shrubs, c.shrubs);
  KD.cars = share(KD.cars, c.cars);
  KD.trucks = share(KD.trucks, c.cars);
  KD.bins = share(KD.bins, c.bins);
  KD.props = KD.props.filter((p) => !c.props || c.props.includes(p.type) || rng.chance(c.propShare ?? 0));
  // The older generator props (park and plaza trees, benches, crates) carry their own small colliders: drop both.
  const gone = [];
  kit.props = kit.props.filter((p) => {
    const keep = p.type === 'tree' ? spaced([p]).length > 0 : c.oldProps?.[p.type] == null || rng.chance(c.oldProps[p.type]);
    if (!keep) gone.push(p);
    return keep;
  });
  const near = (b) => gone.some((p) => Math.abs((b.minX + b.maxX) / 2 - p.x) < 0.4 && Math.abs((b.minZ + b.maxZ) / 2 - p.z) < 0.4);
  kit.solids = kit.solids.filter((b) => b.tag !== TAG.PROP || b.maxX - b.minX > 2.5 || b.maxZ - b.minZ > 2.5 || !near(b));
}
