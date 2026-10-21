// Loading a baked (handcrafted) map: rebuild the live city object the game and renderer expect from the data in
// src/maps/<name>/base.js — physics boxes and the world, climb walls, the layout's cell lookup, the side-open query
// and the district config — then apply the map's hand edits.
import { Box, World } from '../../sim/physics.js';
import { Rng } from '../../core/rng.js';
import { assignClimbWalls } from '../generator.js';
import { sideOpen } from '../turf/generate.js';
import { DOWNTOWN } from '../turf/districts/downtown.js';
import { TOWN } from '../turf/districts/town.js';

const DISTRICTS = { [DOWNTOWN.id]: DOWNTOWN, [TOWN.id]: TOWN };
const box = (b) => Object.assign(new Box(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, b.tag), b.wall !== undefined ? { wall: b.wall } : {});

export function loadMap(base, edits) {
  const src = structuredClone(base.city); // every load gets its own copy (games mutate their city)
  const city = { ...src, district: DISTRICTS[base.district], baked: { seed: base.seed, at: base.bakedAt } };
  const L = city.layout;
  L.cellAt = (i, j) => (i >= 0 && j >= 0 && i < L.cols && j < L.rows ? L.cells[j * L.cols + i] : null);
  city.sideOpen = (cell, side) => sideOpen(L, cell, side);
  const kit = city.kit;
  kit.rng = new Rng(`baked:${base.seed}`); // render-time decoration (the far skyline) draws from it
  kit.solids = kit.solids.map(box);
  kit.climbs = kit.climbs.map((c) => ({ ...c, box: box(c.box) }));
  const world = new World();
  for (const b of kit.solids) world.addSolid(b);
  for (const c of kit.climbs) world.addClimb(c.box);
  assignClimbWalls(world, kit);
  world.bounds = { minX: city.bounds.x0, minZ: city.bounds.z0, maxX: city.bounds.x1, maxZ: city.bounds.z1 };
  city.world = world;
  return edits ? edits(city) || city : city;
}
