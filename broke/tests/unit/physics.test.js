// Movement and collision: walking, sprinting, jumping, step-up, mantling, climbing, walls, no tunnelling,
// knockback clamping, fall recovery.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, Box, makeBody, moveBody } from '../../src/sim/physics.js';
import { Player } from '../../src/sim/player.js';
import { computeStats } from '../../src/sim/stats.js';
import { Events } from '../../src/core/events.js';
import { Rng } from '../../src/core/rng.js';
import { DEE } from '../../src/sim/survivors/dee.js';
import { EMPTY_INPUT } from '../../src/sim/game.js';
import { COMBAT, PHYS } from '../../src/core/config.js';

function flatWorld() {
  const w = new World();
  w.addSolid(new Box(-100, -1, -100, 100, 0, 100));
  return w;
}

// Minimal game stub for Player so movement can be tested without a city.
function stubGame(world) {
  const g = {
    world, events: new Events(), rng: new Rng(1), clock: { tier: 0 }, state: 'playing', stats: { shots: 0 },
    combat: { hurtPlayer: (p, d) => { p.hp -= d; } }, economy: { tryInteract() {} },
    projectiles: { dart() {}, clipboard() {}, syringe() {} }, aimTarget: () => null, aimPoint: () => ({ x: 0, y: 0, z: -10 }),
    useEquipment() {},
  };
  return g;
}

function run(p, frames, input) { for (let i = 0; i < frames; i++) p.update(1 / 60, typeof input === 'function' ? input(i) : input); }

test('walk and sprint speeds match survivor stats', () => {
  const g = stubGame(flatWorld());
  const p = new Player(g, DEE, { x: 0, y: 0, z: 0, yaw: 0 });
  run(p, 60, { ...EMPTY_INPUT, moveZ: 1 });
  const z0 = p.pos.z;
  run(p, 120, { ...EMPTY_INPUT, moveZ: 1 });
  assert.ok(Math.abs(Math.abs(p.pos.z - z0) / 2 - DEE.base.speed) < 0.1, 'walk speed');
  run(p, 60, { ...EMPTY_INPUT, moveZ: 1, sprint: true });
  const z1 = p.pos.z;
  run(p, 60, { ...EMPTY_INPUT, moveZ: 1, sprint: true });
  assert.ok(Math.abs(Math.abs(p.pos.z - z1) - DEE.base.speed * 1.45) < 0.15, 'sprint speed');
  assert.ok(p.pos.z < 0, 'yaw 0 moves toward -z');
});

test('single jump ~1.8 m, double jump ~3.3 m, third jump refused', () => {
  const g = stubGame(flatWorld());
  const p = new Player(g, DEE, { x: 0, y: 0, z: 0, yaw: 0 });
  run(p, 10, EMPTY_INPUT);
  let peak = 0;
  run(p, 70, (i) => { peak = Math.max(peak, p.pos.y); return { ...EMPTY_INPUT, jumpPressed: i === 0 }; });
  assert.ok(peak > 1.6 && peak < 2.0, `jump peak ${peak}`);
  run(p, 30, EMPTY_INPUT);
  peak = 0;
  run(p, 120, (i) => { peak = Math.max(peak, p.pos.y); return { ...EMPTY_INPUT, jumpPressed: i === 0 || i === 20 || i === 40 }; });
  assert.ok(peak > 3.0 && peak < 3.7, `double jump peak ${peak} (third press must not add height)`);
  assert.ok(p.body.onGround);
});

test('walls block movement and fast bodies do not tunnel', () => {
  const w = flatWorld();
  w.addSolid(new Box(-5, 0, -10.3, 5, 10, -10)); // 0.3 m thin wall
  const b = makeBody(0, 0, 0);
  b.vel = { x: 0, y: 0, z: -200 }; // 3.3 m per frame
  for (let i = 0; i < 30; i++) { moveBody(b, w, 1 / 60); b.vel.z = -200; }
  assert.ok(b.pos.z > -10 + b.r - 0.01, `body ended at ${b.pos.z}`);
  assert.ok(b.blocked);
});

test('step-up over curbs and stairs, but not over a 1 m wall', () => {
  const w = flatWorld();
  w.addSolid(new Box(-5, 0, -3, 5, 0.4, -2)); // curb-ish step
  const b = makeBody(0, 0.01, 0);
  for (let i = 0; i < 40; i++) { b.vel.z = -6; b.vel.y -= 0.5; moveBody(b, w, 1 / 60); }
  assert.ok(b.pos.z < -2.5, 'stepped onto the curb');
  const w2 = flatWorld();
  w2.addSolid(new Box(-5, 0, -3, 5, 1.0, -2));
  const c = makeBody(0, 0.01, 0);
  c.canMantle = false;
  for (let i = 0; i < 60; i++) { c.vel.z = -6; c.vel.y -= 0.5; moveBody(c, w2, 1 / 60); }
  assert.ok(c.pos.z > -3 + c.r - 0.01, 'blocked by a 1 m wall on the ground');
});

test('jumping into a 1.5 m ledge mantles onto it', () => {
  const w = flatWorld();
  w.addSolid(new Box(-2, 0, -4, 2, 1.5, -2));
  const b = makeBody(0, 0.01, 0);
  let on = false;
  for (let i = 0; i < 90; i++) {
    b.vel.z = -7;
    if (i === 8) b.vel.y = 10.5;
    b.vel.y -= 0.5;
    moveBody(b, w, 1 / 60);
    if (b.onGround && Math.abs(b.pos.y - 1.5) < 0.05) on = true;
  }
  assert.ok(on, 'ended on top of the ledge');
});

test('climbing a ladder reaches the roof and only grabs when pushing toward the wall', () => {
  const w = flatWorld();
  w.addSolid(new Box(-10, 0, -20, 10, 15, -10)); // building, south face at z=-10
  const ladder = w.addClimb(new Box(-0.5, 0, -10, 0.5, 15.7, -8.9));
  ladder.wall = { x: 0, z: -1 };
  const g = stubGame(w);
  // Walking sideways through the ladder column must not grab it.
  const p0 = new Player(g, DEE, { x: -4, y: 0, z: -9.4, yaw: -Math.PI / 2 }); // facing +x
  run(p0, 90, { ...EMPTY_INPUT, yaw: -Math.PI / 2, moveZ: 1 });
  assert.equal(p0.climbing, null);
  assert.ok(p0.pos.y < 0.5 && p0.pos.x > 2, 'walked past the ladder');
  // Facing the wall: climbs to the roof.
  const p = new Player(g, DEE, { x: 0, y: 0, z: -8.5, yaw: 0 }); // facing -z, toward the wall
  let onRoof = false;
  run(p, 240, (i) => { if (p.body.onGround && p.pos.y > 14.9) onRoof = true; return { ...EMPTY_INPUT, yaw: 0, moveZ: i < 130 ? 1 : 0, jumpPressed: i === 1 }; });
  assert.ok(onRoof, `reached the roof, y=${p.pos.y}`);
  // Climb back down by pulling away from the wall.
  const q = new Player(g, DEE, { x: 0, y: 0, z: -8.5, yaw: 0 });
  run(q, 60, (i) => ({ ...EMPTY_INPUT, yaw: 0, moveZ: 1, jumpPressed: i === 1 }));
  const mid = q.pos.y;
  assert.ok(mid > 4, 'got some way up');
  run(q, 200, { ...EMPTY_INPUT, yaw: 0, moveZ: -1 });
  assert.ok(q.pos.y < 0.3, `climbed down to ${q.pos.y}`);
});

test('knockback is clamped and never pushes outside world bounds', () => {
  const w = flatWorld();
  w.bounds = { minX: -50, minZ: -50, maxX: 50, maxZ: 50 };
  const g = stubGame(w);
  const p = new Player(g, DEE, { x: 45, y: 0, z: 0, yaw: 0 });
  p.knock(1e6, 1e6, 0);
  const v = Math.hypot(p.body.vel.x, p.body.vel.z);
  assert.ok(v <= COMBAT.knockbackMaxSpeed + 1e-6, `knock speed ${v}`);
  run(p, 120, EMPTY_INPUT);
  assert.ok(p.pos.x <= 50 && Number.isFinite(p.pos.x));
});

test('falling out of the world recovers to last safe ground', () => {
  const w = new World();
  w.addSolid(new Box(-5, -1, -5, 5, 0, 5)); // small island
  const g = stubGame(w);
  const p = new Player(g, DEE, { x: 0, y: 0, z: 0, yaw: 0 });
  run(p, 60, EMPTY_INPUT);
  run(p, 120, { ...EMPTY_INPUT, moveZ: 1 }); // walk off the edge
  run(p, 300, EMPTY_INPUT); // fall, recover, stand still
  assert.ok(p.pos.y > -1 && Math.abs(p.pos.z) <= 5.5, `recovered at ${JSON.stringify(p.pos)}`);
  assert.ok(p.pos.y > PHYS.killY);
});

test('NaN input never corrupts position', () => {
  const g = stubGame(flatWorld());
  const p = new Player(g, DEE, { x: 0, y: 0, z: 0, yaw: 0 });
  run(p, 60, { ...EMPTY_INPUT, moveX: NaN, moveZ: Infinity, yaw: NaN, pitch: NaN });
  assert.ok(Number.isFinite(p.pos.x + p.pos.y + p.pos.z + p.yaw + p.pitch));
  assert.ok(Number.isFinite(computeStats(DEE.base, { latte: NaN }).moveMul));
});
