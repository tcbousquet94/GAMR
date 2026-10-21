// The handcrafted town map: the baked Palmetto Bay data loads into a playable city that matches the generator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMap } from '../../src/city/maps/load.js';
import { generateTurf } from '../../src/city/turf/generate.js';
import { TOWN } from '../../src/city/turf/districts/town.js';
import { TownGame } from '../../src/sim/town/townGame.js';
import { DEE } from '../../src/sim/survivors/dee.js';
import base from '../../src/maps/palmetto/base.js';
import edits from '../../src/maps/palmetto/edits.js';

const city = loadMap(base, edits);

test('the baked map matches the generator for its seed', () => {
  const gen = generateTurf(TOWN, base.seed);
  assert.equal(city.turf.blocks.length, gen.turf.blocks.length);
  assert.equal(city.turf.warehouses.length, gen.turf.warehouses.length);
  assert.equal(city.kitData.houses.length, gen.kitData.houses.length);
  assert.ok(city.bounds.x1 - city.bounds.x0 > 700, 'map is the bigger town size');
});

test('the town edits name the hoods and the key places', () => {
  assert.equal(city.town.name, 'Palmetto Bay');
  for (const role of ['cityHall', 'police', 'heroBase']) assert.ok(city.town.places.some((p) => p.role === role), role);
  assert.ok(city.turf.blocks.every((b) => b.hood));
});

test('the hero spawns standing and can walk the town', () => {
  const g = new TownGame({ city: loadMap(base, edits), survivor: DEE });
  let recovers = 0;
  g.events.on('recover', () => recovers++);
  const p0 = { ...g.player.pos };
  for (let i = 0; i < 300; i++) g.step(i < 60 ? {} : { moveZ: 1, yaw: g.player.yaw });
  assert.equal(recovers, 0);
  assert.ok(g.player.body.onGround);
  assert.ok(Math.hypot(g.player.pos.x - p0.x, g.player.pos.z - p0.z) > 5, 'hero moved');
  assert.match(g.objective(), /\w/);
});
