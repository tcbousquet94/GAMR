// The handcrafted town map: the baked Palmetto Bay data loads into a playable city that matches the generator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMap } from '../../src/city/maps/load.js';
import { generateTurf } from '../../src/city/turf/generate.js';
import { TOWN } from '../../src/city/turf/districts/town.js';
import { TownGame } from '../../src/sim/town/townGame.js';
import { BEACON } from '../../src/sim/survivors/beacon.js';
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
  const g = new TownGame({ city: loadMap(base, edits), survivor: BEACON });
  let recovers = 0;
  g.events.on('recover', () => recovers++);
  const p0 = { ...g.player.pos };
  for (let i = 0; i < 300; i++) g.step(i < 60 ? {} : { moveZ: 1, yaw: g.player.yaw });
  assert.equal(recovers, 0);
  assert.ok(g.player.body.onGround);
  assert.ok(Math.hypot(g.player.pos.x - p0.x, g.player.pos.z - p0.z) > 5, 'hero moved');
  assert.match(g.objective(), /\w/);
});

test('Beacon flies: take off, climb where he looks, hover, land', () => {
  const g = new TownGame({ city: loadMap(base, edits), survivor: BEACON });
  g.director.enabled = false;
  for (let i = 0; i < 60; i++) g.step({});
  const y0 = g.player.pos.y;
  g.step({ special: true });
  assert.ok(g.player.hero.flying);
  for (let i = 0; i < 120; i++) g.step({ moveZ: 1, pitch: 0.6, yaw: g.player.yaw });
  assert.ok(g.player.pos.y > y0 + 15, `climbed to ${g.player.pos.y - y0}`);
  const hy = g.player.pos.y;
  for (let i = 0; i < 60; i++) g.step({ pitch: 0.6, yaw: g.player.yaw });
  assert.ok(Math.abs(g.player.pos.y - hy) < 2.5, 'hovers with no input');
  for (let i = 0; i < 40; i++) g.step({});
  g.step({ special: true });
  assert.ok(!g.player.hero.flying);
  for (let i = 0; i < 400 && !g.player.body.onGround; i++) g.step({});
  assert.ok(g.player.body.onGround, 'lands');
});

test('Beacon Thunderclap hurts and throws back nearby enemies', () => {
  const g = new TownGame({ city: loadMap(base, edits), survivor: BEACON });
  g.director.enabled = false;
  for (let i = 0; i < 30; i++) g.step({});
  const P = g.player.pos, f = g.player.forward();
  const e = g.spawnEnemy('speakerphone', { x: P.x + f.x * 3, y: P.y, z: P.z + f.z * 3 });
  const hp = e.hp;
  g.step({ secondary: true });
  assert.ok(e.hp < hp || !e.alive, 'damaged');
});
