// Regression tests for bugs found by the Phase 1 gameplay audit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, EMPTY_INPUT } from '../../src/sim/game.js';
import { downtown } from '../../src/city/districts/downtown.js';
import { generateCity } from '../../src/city/generator.js';
import { FlowField } from '../../src/sim/flow.js';
import { DEE } from '../../src/sim/survivors/dee.js';
import { COMBAT } from '../../src/core/config.js';
import { Box } from '../../src/sim/physics.js';

const city = generateCity(downtown, 7);
const flow = new FlowField(city.world, city.size);
const newGame = () => { const g = new Game({ seed: 7, district: downtown, survivor: DEE, city, flow }); g.director.enabled = false; return g; };
const steps = (g, n, input = EMPTY_INPUT) => { for (let i = 0; i < n; i++) g.step(input); };

test('stacked knockbacks never exceed the knockback cap', () => {
  const g = newGame();
  const P = g.player;
  for (let i = 0; i < 4; i++) P.knock(20, 4, 0);
  assert.ok(Math.hypot(P.body.vel.x, P.body.vel.z) <= COMBAT.knockbackMaxSpeed + 1e-9);
});

test('soundwaves stop at walls', () => {
  const g = newGame();
  const P = g.player;
  const s = g.city.spawn;
  P.body.pos = { x: s.x, y: 0.15, z: s.z };
  // A tall wall between the speaker and the player.
  g.world.addSolid(new Box(s.x - 6, 0, s.z - 4.5, s.x + 6, 12, s.z - 4, 2));
  assert.ok(!g.world.segmentClear({ x: s.x, y: 1.5, z: s.z - 12 }, { x: s.x, y: 1.5, z: s.z }), 'wall blocks sight');
  const e = g.spawnEnemy('speakerphone', { x: s.x, y: 0.15, z: s.z - 12 });
  e.stunned = 99;
  const hp = P.hp;
  for (const off of [-0.1, 0, 0.1]) g.projectiles.wave(e, { x: s.x, y: 1.5, z: s.z - 12 }, { x: Math.sin(off), y: 0, z: Math.cos(off) }, 9, 17);
  steps(g, 60);
  assert.equal(P.hp, hp);
});

test('pizza and gavel radii are capped', () => {
  const g = newGame();
  g.giveItem('pizza', 50); g.giveItem('gavel', 50);
  const st = g.player.stats;
  assert.ok(st.pizzaRadius <= 8 && st.pizzaRadius > 0);
  assert.ok(st.gavelRadius <= 16 && st.gavelRadius > 0);
});

test('relocating the boss with no spawn point in range never deletes it', () => {
  const g = newGame();
  g.exit.call();
  steps(g, 300);
  const b = g.boss;
  assert.ok(b && b.alive);
  g.director.pickSpawnPoint = () => null;
  g.director.levelSpawnPoint = () => null;
  g.director.relocate(b);
  assert.ok(b.alive, 'boss still alive');
  assert.equal(g.receipt().bossDefeated, false);
});

test('enemies parked under a player on a fire-escape landing climb up to them', () => {
  const g = newGame();
  const w = g.world;
  // A fire-escape ladder with its landing at 8 m; the player stands on the landing.
  const deckNear = (c) => w.solids.items.find((b) => b.tag === 8 && Math.abs(b.maxY - 8) < 0.01 && b.maxX - b.minX < 7 && b.maxZ - b.minZ < 7 && b.minX < c.maxX + 1.5 && b.maxX > c.minX - 1.5 && b.minZ < c.maxZ + 1.5 && b.maxZ > c.minZ - 1.5);
  const c = w.climbs.items.find((k) => k.wall && k.minY < 0.5 && k.maxY > 12 && k.maxY < 30 && deckNear(k));
  assert.ok(c, 'found a fire-escape ladder');
  const deck = deckNear(c);
  g.godMode = true;
  const P = g.player;
  const px = (deck.minX + deck.maxX) / 2, pz = (deck.minZ + deck.maxZ) / 2;
  P.body.pos = { x: px, y: 8.05, z: pz };
  const e = g.spawnEnemy('canvasser', { x: px + (c.minX - px) * 0.2, y: 0.15, z: pz });
  e.attackCd = 99;
  let best = 0;
  for (let i = 0; i < 60 * 25 && e.alive; i++) { P.body.pos = { x: px, y: 8.05, z: pz }; P.body.vel = { x: 0, y: 0, z: 0 }; g.step(EMPTY_INPUT); best = Math.max(best, e.pos.y); }
  assert.ok(best > 7, `enemy reached ${best.toFixed(1)} m`);
});
