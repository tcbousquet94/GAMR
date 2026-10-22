// Every generated city is checked: you can walk from the spawn to every door (businesses, homes, walk-in markets),
// no buildings overlap, and the city stays inside a size budget so phones stay smooth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTurf } from '../../src/city/turf/generate.js';
import { DOWNTOWN } from '../../src/city/turf/districts/downtown.js';
import { TOWN } from '../../src/city/turf/districts/town.js';
import { walkable, reachDoors, overlaps, budget } from '../../src/city/check.js';

// Budgets: about 25% over the largest of the first dozen seeds (boxes are the generator's own; the kit buildings are
// batched per chunk). Raise them deliberately, with a frame-rate check on a phone, never to make a test pass.
const DOWNTOWN_BUDGET = { boxes: 13000, buildings: 250, props: 950, people: 140, lights: 310 };
const TOWN_BUDGET = { boxes: 24500, buildings: 980, props: 1550, people: 520, lights: 820 };

const check = (c, B, label) => {
  const W = walkable(c.world, c.spawn, c.bounds);
  const r = reachDoors(c, W);
  assert.ok(r.total > 10, `${label}: doors found`);
  assert.equal(r.missing.length, 0, `${label}: unreachable doors ${JSON.stringify(r.missing.slice(0, 5))}`);
  const o = overlaps(c);
  assert.equal(o.length, 0, `${label}: overlapping buildings ${JSON.stringify(o.slice(0, 3))}`);
  const b = budget(c);
  for (const k of Object.keys(B)) assert.ok(b[k] <= B[k], `${label}: ${k} ${b[k]} over budget ${B[k]}`);
};

for (const seed of [1, 5, 11, 942824]) test(`Downtown seed ${seed}: every door reachable, no overlaps, within budget`, () => check(generateTurf(DOWNTOWN, seed), DOWNTOWN_BUDGET, `downtown ${seed}`));
test('Palmetto Bay: every door reachable, no overlaps, within budget', () => check(generateTurf(TOWN, 396873), TOWN_BUDGET, 'town'));
