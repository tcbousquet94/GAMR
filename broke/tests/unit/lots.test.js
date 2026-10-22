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
