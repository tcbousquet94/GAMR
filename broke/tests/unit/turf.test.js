// Turf-war foundations: deterministic map generation, the territory model, and the command layer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTurf } from '../../src/city/turf/generate.js';
import { DOWNTOWN } from '../../src/city/turf/districts/downtown.js';
import { TurfGame, LEADER } from '../../src/sim/turf/turfGame.js';
import { DEE } from '../../src/sim/survivors/dee.js';

const city = generateTurf(DOWNTOWN, 11);

test('map generation is deterministic per seed and differs between seeds', () => {
  assert.equal(JSON.stringify(generateTurf(DOWNTOWN, 11).turf), JSON.stringify(city.turf));
  assert.notEqual(JSON.stringify(generateTurf(DOWNTOWN, 12).turf.blocks), JSON.stringify(city.turf.blocks));
});

test('territory model: 6-8 warehouses, each with 1-3 businesses, every business linked once', () => {
  const T = city.turf;
  assert.ok(T.warehouses.length >= 6 && T.warehouses.length <= 8);
  for (const w of T.warehouses) assert.ok(w.businesses.length >= 1 && w.businesses.length <= 3, `warehouse ${w.id}`);
  for (const b of T.businesses) assert.equal(T.warehouses.filter((w) => w.businesses.includes(b.id)).length, 1);
  assert.equal(T.warehouses.filter((w) => w.hq != null).length, 2);
  for (const h of T.hqs) assert.equal(T.businesses[h.diner].type, 'diner');
  for (const w of T.warehouses) {
    assert.ok(w.staging.length >= 2 && new Set(w.staging.map((s) => s.side)).size >= 2);
    for (const k of ['mainGate', 'sideGate', 'fenceCut', 'containerWall', 'dockDoor', 'sideDoor', 'skylight']) assert.ok(w.breach.some((p) => p.kind === k), `breach ${k}`);
    for (const k of ['containerTop', 'guardBooth', 'yardCover', 'dockDoor', 'catwalk', 'office']) assert.ok(w.defenderPosts.some((p) => p.kind === k), `post ${k}`);
    assert.ok(w.safe && w.siegeEquipment.length === 4 && w.upgradeSlots.length === 7);
  }
});

test('commands: control moves the leader; unknown or not-yet-built commands are rejected', () => {
  const g = new TurfGame({ seed: 11, survivor: DEE, city });
  const p0 = { ...g.player.pos };
  for (let i = 0; i < 90; i++) g.step({ moveZ: 1, yaw: g.player.yaw });
  assert.ok(Math.hypot(g.player.pos.x - p0.x, g.player.pos.z - p0.z) > 3);
  assert.equal(g.commands.log.length, 90);
  assert.equal(g.submit({ type: 'capture', actor: LEADER }).ok, false);
  assert.equal(g.submit({ type: 'control', actor: 'gang9:nobody', input: {} }).ok, false);
  assert.equal(g.submit({ type: 'teleport', actor: LEADER }).ok, false);
});

test('the same command log replays to the same state', () => {
  const run = () => {
    const g = new TurfGame({ seed: 11, survivor: DEE, city: generateTurf(DOWNTOWN, 11) });
    for (let i = 0; i < 240; i++) g.step({ moveZ: i < 120 ? 1 : 0, moveX: i > 60 ? 1 : 0, sprint: i % 50 < 25, jumpPressed: i % 70 === 0, yaw: 0.3 + i * 0.004 });
    return JSON.stringify({ p: g.player.pos, v: g.player.body.vel, hp: g.player.hp });
  };
  assert.equal(run(), run());
});

test('control input is sanitised (no injected fields, clamped values)', () => {
  const g = new TurfGame({ seed: 11, survivor: DEE, city });
  g.submit({ type: 'control', actor: LEADER, input: { moveX: 99, sprint: 'yes', godMode: true } });
  g.step();
  const c = g.controls[LEADER];
  assert.equal(c.moveX, 1);
  assert.equal(c.sprint, false);
  assert.equal(c.godMode, undefined);
});

test('the leader spawns standing in the HQ yard (no stuck / fall recovery)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const g = new TurfGame({ seed, survivor: DEE });
    let recovers = 0;
    g.events.on('recover', () => recovers++);
    for (let i = 0; i < 300; i++) g.step({});
    assert.equal(recovers, 0, `seed ${seed}`);
    assert.ok(g.player.body.onGround);
  }
});
