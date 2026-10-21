// City generator. Reads a district config + seed, lays out the block grid, streets, alleys and lots, assigns a
// module to each lot by the district's rules, then asks each module to build itself into a Kit. Output is pure data
// (no Three.js): render primitives + colliders + climbs + spawns + interactables. Also builds the physics World.

import { Rng } from '../core/rng.js';
import { Kit, MAT, TAG } from './kit.js';
import { World, Box } from '../sim/physics.js';

export const INTERACT_SIZE = { vending: [0.55, 2.0, 0.45], newsbox: [0.32, 1.1, 0.3], locker: [1.2, 2.2, 0.35], lostfound: [0.6, 1.0, 0.45], callpanel: [0.3, 1.5, 0.2] };
import { G, buildFireEscapes } from './modules/building.js';
import { streets } from './modules/streets.js';
import { MODULES } from './modules/index.js';

export function generateCity(district, seed) {
  const rng = new Rng(`${district.id}:${seed}`);
  const L = district.layout;
  const N = L.blocks, B = L.blockSize, W = L.streetWidth, A = L.alleyWidth;
  const size = N * B + (N + 1) * W;
  const kit = new Kit(rng, district.palette);
  const city = { district, seed, size, N, B, W, A, blocks: [], lots: [], kit };

  // Blocks and lots. Block (i, j) spans x from W + i*(B+W). Lots split each block 2x2 with an alley cross.
  const lotSize = (B - A) / 2;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x0 = W + i * (B + W), z0 = W + j * (B + W);
    const block = { i, j, x0, z0, x1: x0 + B, z1: z0 + B, lots: [] };
    city.blocks.push(block);
    for (let lj = 0; lj < 2; lj++) for (let li = 0; li < 2; li++) {
      const lx0 = x0 + li * (lotSize + A), lz0 = z0 + lj * (lotSize + A);
      const lot = {
        id: city.lots.length, block, li, lj, gi: i * 2 + li, gj: j * 2 + lj,
        rect: { x0: lx0, z0: lz0, x1: lx0 + lotSize, z1: lz0 + lotSize },
        // Which sides face a full street vs an alley.
        sides: { w: li === 0 ? 'street' : 'alley', e: li === 1 ? 'street' : 'alley', n: lj === 0 ? 'street' : 'alley', s: lj === 1 ? 'street' : 'alley' },
        type: null,
      };
      block.lots.push(lot);
      city.lots.push(lot);
    }
  }

  // Spawn on the west outer street, exit (subway) in the east column on a lot facing the outer east street.
  const spawnRow = rng.int(0, 2 * N - 1);
  const spawnLotRow = city.lots.filter((l) => l.gj === spawnRow);
  const sz = (spawnLotRow[0].rect.z0 + spawnLotRow[0].rect.z1) / 2;
  city.spawn = { x: W * 0.5, y: 0, z: sz, yaw: -Math.PI / 2 };
  // Exit row is on the far side vertically too when possible, so the route crosses the map.
  const exitCandidates = city.lots.filter((l) => l.gi === 2 * N - 1);
  const farRows = exitCandidates.filter((l) => Math.abs(l.gj - spawnRow) >= N - 1);
  const exitLot = rng.pick(farRows.length ? farRows : exitCandidates);
  exitLot.type = 'subway';
  assignModules(city, rng);

  // Streets first (ground, sidewalks, furniture), then each module.
  kit.module = { id: -1, type: 'streets' };
  streets(kit, city);
  for (const lot of city.lots) {
    kit.module = { id: lot.id, type: lot.type };
    MODULES[lot.type](kit, lot, city);
  }
  kit.module = null;
  buildFireEscapes(kit);

  boundary(kit, city);

  // Physics world.
  const world = new World();
  for (const b of kit.solids) world.addSolid(b);
  for (const c of kit.climbs) world.addClimb(c.box);
  assignClimbWalls(world, kit);
  world.bounds = { minX: 1, minZ: 1, maxX: size - 1, maxZ: size - 1 };
  city.world = world;

  // Place interactables by density (they get colliders), then keep only spawn points where a body fits.
  city.interactables = placeInteractables(city, rng);
  for (const it of city.interactables) {
    const [hx, hh, hz] = INTERACT_SIZE[it.type];
    const rot = Math.abs(Math.sin(it.yaw)) > 0.7;
    const ex = rot ? hz : hx, ez = rot ? hx : hz;
    it.box = world.addSolid(new Box(it.x - ex, it.y, it.z - ez, it.x + ex, it.y + hh, it.z + ez, TAG.PROP));
  }
  city.spawnPoints = kit.spawns.filter((s) => validStandPoint(world, s.x, s.y, s.z, 0.5, 1.9));
  city.exit = kit.exit;
  return city;
}

// Each climb volume learns which side its wall is on: you climb by pushing toward it.
function assignClimbWalls(world, kit) {
  for (const { box: b } of kit.climbs) {
    const y0 = b.minY + 1.5, y1 = Math.min(b.maxY - 0.5, y0 + 3);
    const probes = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let best = null, bestScore = 0;
    for (const [x, z] of probes) {
      const r = { x0: x > 0 ? b.maxX : x < 0 ? b.minX - 0.4 : b.minX + 0.2, x1: x > 0 ? b.maxX + 0.4 : x < 0 ? b.minX : b.maxX - 0.2,
        z0: z > 0 ? b.maxZ : z < 0 ? b.minZ - 0.4 : b.minZ + 0.2, z1: z > 0 ? b.maxZ + 0.4 : z < 0 ? b.minZ : b.maxZ - 0.2 };
      let score = 0;
      for (let y = y0; y <= y1; y += 0.5) if (world.overlapsSolid(r.x0, y, r.z0, r.x1, y + 0.4, r.z1)) score++;
      if (score > bestScore) { bestScore = score; best = { x, z }; }
    }
    b.wall = best; // null: free-standing (climb from any side)
  }
}

function assignModules(city, rng) {
  const cfg = city.district.modules;
  const counts = {};
  for (const k of Object.keys(cfg)) counts[k] = 0;
  const free = rng.shuffle(city.lots.filter((l) => !l.type));
  // Meet minimums first.
  for (const [k, c] of Object.entries(cfg)) {
    for (let m = 0; m < (c.min || 0); m++) {
      const lot = free.find((l) => !l.type && okFor(k, l, city));
      if (lot) { lot.type = k; counts[k]++; }
    }
  }
  for (const lot of free) {
    if (lot.type) continue;
    const options = Object.entries(cfg).filter(([k, c]) => counts[k] < c.max && okFor(k, lot, city)).map(([k, c]) => ({ w: c.w, v: k }));
    lot.type = options.length ? rng.weighted(options) : 'tower';
    counts[lot.type]++;
  }
  city.moduleCounts = counts;
}

// Placement rules. Keep big open fights away from the spawn street; avoid two walkways side by side.
function okFor(type, lot, city) {
  if (type === 'plaza' && lot.gi === 0) return false;
  if (type === 'walkway') return !city.lots.some((o) => o.type === 'walkway' && Math.abs(o.gi - lot.gi) + Math.abs(o.gj - lot.gj) <= 1);
  return true;
}

function boundary(kit, city) {
  const { size } = city;
  const pal = kit.pal;
  const h = 200;
  // Invisible walls; the visible skyline ring is added by the renderer.
  kit.collider(-20, -5, -20, 0.5, h, size + 20, TAG.BOUNDARY);
  kit.collider(size - 0.5, -5, -20, size + 20, h, size + 20, TAG.BOUNDARY);
  kit.collider(-20, -5, -20, size + 20, h, 0.5, TAG.BOUNDARY);
  kit.collider(-20, -5, size - 0.5, size + 20, h, size + 20, TAG.BOUNDARY);
  // Boundary facades: a row of tall buildings just outside the map so streets end in walls, not voids.
  const r = kit.rng;
  for (const side of ['n', 's', 'w', 'e']) {
    for (let t = -20; t < size + 20; ) {
      const w = r.range(18, 34);
      const hh = r.range(16, 42); // low enough that the golden-hour sun still reaches the outer streets
      const d = 24;
      const c = r.pick(pal.brick.concat(pal.concrete));
      if (side === 'n') kit.box(t, -0.5, -d, t + w - 1, hh, 0, c);
      if (side === 's') kit.box(t, -0.5, size, t + w - 1, hh, size + d, c);
      if (side === 'w') kit.box(-d, -0.5, t, 0, hh, t + w - 1, c);
      if (side === 'e') kit.box(size, -0.5, t, size + d, hh, t + w - 1, c);
      kit.boundaryFacades = kit.boundaryFacades || [];
      kit.boundaryFacades.push({ side, t, w: w - 1, h: hh });
      t += w;
    }
  }
}

export function validStandPoint(world, x, y, z, r, h) {
  if (!world.fits(x, y + 0.05, z, r, h)) return false;
  const g = world.groundBelow(x, y + 0.1, z, r * 0.5, 1.5);
  return g > y - 1.0;
}

function placeInteractables(city, rng) {
  const { kit, world } = city;
  const dens = city.district.density;
  const out = [];
  const used = [];
  const farEnough = (s) => used.every((u) => (u.x - s.x) ** 2 + (u.z - s.z) ** 2 > 36);
  const take = (s, type) => {
    used.push(s);
    out.push({ id: out.length, type, x: s.x, y: s.y, z: s.z, yaw: s.yaw, module: s.module, used: false });
  };
  // Module-forced interactables (call panel etc.).
  for (const s of kit.slots) if (s.tags.includes('force')) take(s, s.tags.find((t) => t !== 'force'));
  for (const lot of city.lots) {
    const slots = rng.shuffle(kit.slots.filter((s) => s.module === lot.id && !s.tags.includes('force') && validStandPoint(world, s.x, s.y, s.z, 0.6, 1.8)));
    // Food truck alleys are a good place for vending machines.
    const boost = lot.type === 'foodtrucks' ? { vending: 2.0 } : {};
    for (const [type, d] of Object.entries(dens)) {
      const want = Math.floor(d * (boost[type] || 1) + rng.next());
      for (let k = 0; k < want; k++) {
        const s = slots.find((q) => farEnough(q) && (type !== 'locker' || q.tags.includes('front') || q.tags.includes('wall')) && (type !== 'newsbox' || q.y < 1));
        if (s) take(s, type);
      }
    }
  }
  // Street slots fill gaps so the street never feels empty.
  const street = rng.shuffle(kit.slots.filter((s) => s.module === -1 && validStandPoint(world, s.x, s.y, s.z, 0.6, 1.8)));
  let extra = Math.round(city.lots.length * 0.6);
  for (const s of street) {
    if (extra <= 0) break;
    if (!farEnough(s)) continue;
    take(s, rng.pick(['newsbox', 'newsbox', 'vending']));
    extra--;
  }
  return out;
}

export { MAT, TAG, G };
