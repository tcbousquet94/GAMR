import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCity, checkPlan, sidewalkSpots, toWorld } from '../src/index.js';
import { TOWN_ASSETS } from '../examples/catalogue.js';

test('same seed, same city; different seed, different city', () => {
  const a = generateCity({ catalogue: TOWN_ASSETS }, 'x'), b = generateCity({ catalogue: TOWN_ASSETS }, 'x'), c = generateCity({ catalogue: TOWN_ASSETS }, 'y');
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.notEqual(JSON.stringify(a.lots), JSON.stringify(c.lots));
});

test('40 seeds x 3 configs: no overlaps, every lot on its street, frontage mostly built', () => {
  const configs = [
    { catalogue: TOWN_ASSETS },
    { catalogue: TOWN_ASSETS, grid: { cols: 4, rows: 5, cell: [50, 64] }, streets: { avenueEvery: 99 } },
    { catalogue: TOWN_ASSETS, grid: { cols: 10, rows: 8 }, landmarks: [], alleys: null },
  ];
  for (const cfg of configs) for (let s = 0; s < 40; s++) {
    const plan = generateCity(cfg, s), c = checkPlan(plan);
    assert.deepEqual(c.problems, [], `seed ${s}`);
    assert.ok(c.stats.frontageBuilt > 0.85, `seed ${s}: frontage ${c.stats.frontageBuilt}`);
    for (const l of plan.lots) {
      const a = cfg.catalogue.find((q) => q.id === l.asset);
      assert.ok(l.zone in a.zones && a.zones[l.zone] > 0, `${l.asset} in zone ${l.zone}`);
      assert.ok(l.depth >= a.depth[0] && l.depth <= a.depth[1], `${l.asset} depth ${l.depth}`);
      assert.ok(l.width >= a.front[0], `${l.asset} width ${l.width}`);
    }
  }
});

test('placement rules: cornerOnly, perBlock, spacing', () => {
  const plan = generateCity({ catalogue: TOWN_ASSETS }, 7);
  const markets = plan.lots.filter((l) => l.asset === 'cornerMarket');
  assert.ok(markets.length > 0);
  for (const m of markets) assert.ok(m.corner, 'corner market off a corner');
  for (let i = 0; i < markets.length; i++) for (let j = i + 1; j < markets.length; j++) assert.ok(Math.hypot(markets[i].center.x - markets[j].center.x, markets[i].center.z - markets[j].center.z) > 90);
  const perBlock = new Map();
  for (const l of plan.lots.filter((q) => q.asset === 'parking')) perBlock.set(l.block, (perBlock.get(l.block) || 0) + 1);
  for (const n of perBlock.values()) assert.ok(n <= 1);
});

test('a lot model faces its street: local +z points at the street', () => {
  const plan = generateCity({ catalogue: TOWN_ASSETS }, 3);
  for (const l of plan.lots.slice(0, 80)) {
    const front = toWorld(l, 0, l.depth / 2), back = toWorld(l, 0, -l.depth / 2);
    const s = plan.streets[l.streetId].rect, sc = { x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2 };
    assert.ok(Math.hypot(front.x - sc.x, front.z - sc.z) < Math.hypot(back.x - sc.x, back.z - sc.z));
  }
});

test('landmarks: whole-block and footprint; custom zones and catalogue keys', () => {
  const cat = [
    { id: 'hut', front: [8, 12], depth: [8, 14], zones: { village: 1, market: 0.2 } },
    { id: 'stall', front: [6, 9], depth: [6, 10], zones: { market: 3 }, corner: 2 },
  ];
  const plan = generateCity({
    catalogue: cat, grid: { cols: 5, rows: 5, cell: [36, 44] }, alleys: null,
    zoning: { zoneOf: (b) => (b.d < 0.4 ? 'market' : 'village'), industry: null },
    frontage: (zone) => zone,
    landmarks: [{ id: 'temple', zone: 'market', count: 1, where: 'center', footprint: [20, 14], setback: 4 }, { id: 'pond', count: 2, where: 'ring' }],
  }, 'v');
  assert.equal(plan.landmarks.length, 1);
  assert.equal(plan.blocks.filter((b) => b.landmark === 'pond').length, 2);
  assert.ok(plan.lots.every((l) => ['hut', 'stall'].includes(l.asset)));
  assert.ok(plan.lots.some((l) => l.asset === 'stall'));
  assert.deepEqual(checkPlan(plan).problems, []);
});

test('sidewalk spots sit on the sidewalk, clear of the lots', () => {
  const plan = generateCity({ catalogue: TOWN_ASSETS }, 5);
  const spots = sidewalkSpots(plan, { spacing: 25 });
  assert.ok(spots.length > 100);
  for (const p of spots) assert.ok(!plan.lots.some((l) => p.x > l.rect.x0 && p.x < l.rect.x1 && p.z > l.rect.z0 && p.z < l.rect.z1));
});

test('bad catalogue is rejected', () => {
  assert.throws(() => generateCity({}, 1), /catalogue/);
  assert.throws(() => generateCity({ catalogue: [{ id: 'x' }] }, 1), /front/);
});
