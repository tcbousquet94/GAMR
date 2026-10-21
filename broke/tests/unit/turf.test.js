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

test('corner markets are walk-in: through the door, blocked by the counter, staffed and lit', async () => {
  const { isWalkIn, storeToWorld, BODEGA, bodegaFixtures } = await import('../../src/city/kitdata/bodega.js');
  const { houseYaw } = await import('../../src/city/kitdata/data.js');
  let checked = 0;
  for (const seed of [454473, 825919, 583812]) {
    const g = new TurfGame({ seed, survivor: DEE });
    const stores = g.city.kitData.stores.filter(isWalkIn);
    for (const s of stores.slice(0, 2)) {
      const P = g.player, yaw = houseYaw(s);
      const local = () => { const dx = P.pos.x - s.x, dz = P.pos.z - s.z, c = Math.cos(yaw), sn = Math.sin(yaw); return { x: dx * c - dz * sn, z: dx * sn + dz * c }; };
      const out = storeToWorld(s, 0, s.d / 2 + 1.5);
      Object.assign(P.body.pos, { x: out.x, y: (s.y ?? 0.15) + 0.4, z: out.z }); Object.assign(P.body.vel, { x: 0, y: 0, z: 0 });
      for (let i = 0; i < 30; i++) g.step({ yaw });
      for (let i = 0; i < 90; i++) g.step({ moveZ: 1, yaw });
      const l = local(), counter = bodegaFixtures(s.w, s.d).find((f) => f.name === 'counter');
      assert.ok(l.z < s.d / 2 - 1.5, `walked in (seed ${seed}, ${s.name}, local z ${l.z.toFixed(2)})`);
      assert.ok(l.z > counter.z1 - 0.05, 'stopped by the counter, not through it');
      assert.ok(Math.abs(l.x) < s.w / 2 - BODEGA.wall, 'inside the walls');
      checked++;
    }
    assert.ok(g.city.kitData.people.some((p) => p.pose === 'counter'), 'a clerk');
    assert.ok(g.city.kit.lights.some((l) => l.kind === 'shop' && l.tint), 'a room light');
  }
  assert.ok(checked >= 3, `checked ${checked} markets`);
});

test('cafe storefronts are walk-in rooms: open inside, glazed, staffed and lit', () => {
  const g = new TurfGame({ seed: 454473, survivor: DEE });
  const s = g.city.kit.signs.find((q) => q.text === 'LUMO CAFE');
  assert.ok(s, 'Lumo Cafe is on this seed');
  // 4 m in from the sign is inside the room, not inside a solid building.
  const ix = s.cx - s.nx * 4, iz = s.cz - s.nz * 4;
  assert.ok(g.world.fits(ix - s.nz * 1.2, 0.2, iz + s.nx * 1.2, 0.3, 1.8) || g.world.fits(ix, 0.2, iz, 0.3, 1.8), 'room interior is open');
  assert.ok((g.city.kit.interiorPeople || []).some((p) => p.pose === 'counter'), 'a barista');
  assert.ok(g.city.kit.lights.some((l) => l.tint && Math.hypot(l.x - s.cx, l.z - s.cz) < 14), 'room light');
  assert.ok(!g.city.kit.quads.some((q) => Math.hypot(q.cx - s.cx, q.cz - s.cz) < 1.5 && q.cy < 2.5), 'no opaque window panel');
});
