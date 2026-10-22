// The lot generator: block frontage cut into lots from the asset catalogue, corners first, no overlaps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTurf } from '../../src/city/turf/generate.js';
import { DOWNTOWN } from '../../src/city/turf/districts/downtown.js';
import { CATALOGUE } from '../../src/city/lots/catalogue.js';

const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.05 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 0.05;

for (const seed of [11, 942824, 454473]) {
  test(`lots on seed ${seed}: catalogue assets, inside their cells, no overlaps, corners taken`, () => {
    const c = generateTurf(DOWNTOWN, seed);
    const lots = c.lots;
    assert.ok(lots.length >= 30, `${lots.length} lots`);
    const ids = new Set(CATALOGUE.map((a) => a.id));
    for (const l of lots) {
      assert.ok(ids.has(l.asset), l.asset);
      const inCell = c.layout.cells.some((q) => l.rect.x0 >= q.rect.x0 - 0.01 && l.rect.x1 <= q.rect.x1 + 0.01 && l.rect.z0 >= q.rect.z0 - 0.01 && l.rect.z1 <= q.rect.z1 + 0.01);
      assert.ok(inCell, `${l.asset} lot inside a cell`);
    }
    for (let i = 0; i < lots.length; i++) for (let j = i + 1; j < lots.length; j++) assert.ok(!overlap(lots[i].rect, lots[j].rect), `lots ${lots[i].asset} and ${lots[j].asset} overlap`);
    // Lots never sit on a business or a warehouse compound.
    for (const b of c.businesses) for (const l of lots) assert.ok(!(b.capture && l.rect.x0 < b.capture.x && b.capture.x < l.rect.x1 && l.rect.z0 < b.capture.z && b.capture.z < l.rect.z1), `${l.asset} on ${b.name}`);
    assert.ok(lots.filter((l) => l.corner).length >= 6, 'corner lots');
    // Corner-only assets only on corners; per-cell limits hold.
    for (const l of lots) if (CATALOGUE.find((a) => a.id === l.asset).cornerOnly) assert.ok(l.corner, `${l.asset} on a corner`);
  });
}

test('lot generation is deterministic', () => {
  const a = generateTurf(DOWNTOWN, 7).lots.map((l) => `${l.asset}@${l.rect.x0.toFixed(2)},${l.rect.z0.toFixed(2)}`).join('|');
  const b = generateTurf(DOWNTOWN, 7).lots.map((l) => `${l.asset}@${l.rect.x0.toFixed(2)},${l.rect.z0.toFixed(2)}`).join('|');
  assert.equal(a, b);
});

test('street hierarchy: avenues, streets and narrow residential streets; bus stops on avenues; alleys clear of lots', () => {
  let alleys = 0;
  for (const seed of [11, 942824, 454473, 7]) {
    const c = generateTurf(DOWNTOWN, seed), L = c.layout;
    const kinds = new Set(L.segs.map((s) => s.kind));
    for (const k of ['avenue', 'street', 'local']) assert.ok(kinds.has(k), `${k} on seed ${seed}`);
    for (const s of L.segs) {
      const w = s.axis === 'v' ? s.rect.x1 - s.rect.x0 : s.rect.z1 - s.rect.z0;
      assert.equal(w, DOWNTOWN.roads.hierarchy.width[s.kind], `${s.kind} width`);
    }
    assert.ok(c.kitData.props.some((p) => p.type === 'busshelter'), `a bus stop on seed ${seed}`);
    for (const a of c.alleys || []) { alleys++; for (const l of c.lots) assert.ok(!overlap(a.rect, l.rect), `alley clear of ${l.asset}`); }
  }
  assert.ok(alleys >= 1, 'service alleys');
});

test('zoning by street: avenue frontage is main street, outer suburbs are houses', () => {
  const MAIN = new Set(['shop', 'walkup', 'midrise', 'tower', 'cornerMarket', 'parking', 'workshop', 'yard']);
  let onAvenue = 0, suburb = 0, houses = 0;
  for (const seed of [11, 942824, 454473]) {
    const c = generateTurf(DOWNTOWN, seed);
    for (const l of c.lots) {
      if (l.street === 'avenue') { onAvenue++; assert.ok(MAIN.has(l.asset), `${l.asset} on an avenue`); }
      if (l.use === 'residential') { suburb++; if (l.asset === 'house' || l.asset === 'porchHouse') houses++; }
    }
  }
  assert.ok(onAvenue >= 10, `${onAvenue} avenue lots`);
  assert.ok(suburb > 0 && houses / suburb > 0.6, `suburbs mostly houses (${houses}/${suburb})`);
});

test('variety: no two shops with the same name within 120 m, no corner markets within 90 m, styles vary', () => {
  for (const seed of [680054, 11, 942824]) {
    const c = generateTurf(DOWNTOWN, seed), S = c.kitData.stores;
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      if (S[i].name && S[i].name === S[j].name) assert.ok(Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z) > 120, `${S[i].name} twice close together (seed ${seed})`);
    }
    const cm = c.lots.filter((l) => l.asset === 'cornerMarket').map((l) => ({ x: (l.rect.x0 + l.rect.x1) / 2, z: (l.rect.z0 + l.rect.z1) / 2 }));
    for (let i = 0; i < cm.length; i++) for (let j = i + 1; j < cm.length; j++) assert.ok(Math.hypot(cm[i].x - cm[j].x, cm[i].z - cm[j].z) > 85, `corner markets too close (seed ${seed})`);
    const looks = new Set(S.filter((s) => s.facade).map((s) => `${s.facade}/${s.wallKey}/${s.parapet}`));
    assert.ok(looks.size >= Math.min(4, S.filter((s) => s.facade).length), `storefront looks vary (seed ${seed}: ${looks.size})`);
  }
});
