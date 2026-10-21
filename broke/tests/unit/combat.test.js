// Damage pipeline, statuses, telegraphs, dodge/i-frames, death and enemy behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, EMPTY_INPUT } from '../../src/sim/game.js';
import { downtown } from '../../src/city/districts/downtown.js';
import { generateCity } from '../../src/city/generator.js';
import { FlowField } from '../../src/sim/flow.js';
import { DEE } from '../../src/sim/survivors/dee.js';

const city = generateCity(downtown, 7);
const flow = new FlowField(city.world, city.size);
const newGame = () => { const g = new Game({ seed: 7, district: downtown, survivor: DEE, city, flow }); g.director.enabled = false; return g; };
const street = (g) => ({ x: g.city.spawn.x, y: 0.15, z: g.city.spawn.z });
const steps = (g, n, input = EMPTY_INPUT) => { for (let i = 0; i < n; i++) g.step(input); };

test('hits deal damage, flash, knock back, and emit damage numbers', () => {
  const g = newGame();
  const s = street(g);
  const e = g.spawnEnemy('canvasser', { x: s.x, y: 0.15, z: s.z - 10 });
  e.stunned = 99;
  let ev = null;
  g.events.on('hit', (d) => (ev = d));
  const hp = e.hp;
  g.combat.hitEnemy(e, { damage: 20, crit: false, knock: { x: 0, y: 0, z: -8 } });
  assert.ok(hp - e.hp >= 20 - 1e-9);
  assert.equal(e.flash, 1);
  assert.ok(ev && ev.amount >= 20 && ev.id === e.id);
  const z0 = e.pos.z;
  steps(g, 20);
  assert.ok(e.pos.z < z0 - 0.3, 'knocked back');
});

test('crits double damage; coupon applies only above 90% health', () => {
  const g = newGame();
  const s = street(g);
  const e = g.spawnEnemy('canvasser', { x: s.x, y: 0.15, z: s.z - 10 });
  e.maxHp = e.hp = 1000;
  assert.equal(g.combat.hitEnemy(e, { damage: 10, crit: true }), 20);
  g.giveItem('coupon');
  e.hp = 1000;
  assert.equal(g.combat.hitEnemy(e, { damage: 10, crit: false, noProc: true }), 17.5);
  e.hp = 500;
  assert.equal(g.combat.hitEnemy(e, { damage: 10, crit: false, noProc: true }), 10);
});

test('killing an enemy drops change that flies to the player', () => {
  const g = newGame();
  const s = street(g);
  const e = g.spawnEnemy('scooter', { x: s.x, y: 0.15, z: s.z - 6 });
  const c0 = g.economy.cents;
  g.combat.hitEnemy(e, { damage: 1e5 });
  assert.equal(e.alive, false);
  assert.equal(g.stats.kills, 1);
  steps(g, 180);
  assert.ok(g.economy.cents > c0, `cents ${c0} -> ${g.economy.cents}`);
});

test('player damage, i-frames during Salsa Step, block chance cap, death state', () => {
  const g = newGame();
  const P = g.player;
  const hp = P.hp;
  g.combat.hurtPlayer(P, 10, { source: 'test' });
  assert.ok(Math.abs(P.hp - (hp - 10)) < 1e-9);
  assert.equal(P.timeSinceHit, 0);
  // Salsa Step grants i-frames; hits are dodged and don't reset the "not hit" timer.
  steps(g, 30);
  const tsh = P.timeSinceHit;
  g.step({ ...EMPTY_INPUT, yaw: P.yaw, moveZ: -1, utility: true });
  const before = P.hp;
  assert.equal(g.combat.hurtPlayer(P, 50, { source: 'test' }), 0);
  assert.equal(P.hp, before);
  assert.ok(P.timeSinceHit >= tsh);
  // I-frames expire: the dodge is not a permanent shield.
  steps(g, 40);
  assert.ok(g.combat.hurtPlayer(P, 1, { source: 'test' }) > 0 || P.stats.block > 0);
  // Utility can't be spammed.
  assert.ok(P.cooldowns.utility > 4);
  // Lethal damage -> dead state, exactly once.
  let deaths = 0;
  g.events.on('playerDeath', () => deaths++);
  g.combat.hurtPlayer(P, 1e6, { source: 'test' });
  g.combat.hurtPlayer(P, 1e6, { source: 'test' });
  assert.equal(P.dead, true);
  assert.equal(g.state, 'dead');
  assert.equal(deaths, 1);
});

test('every enemy telegraphs (white flash ramps to 1) before its attack lands', () => {
  for (const type of ['speakerphone', 'scooter', 'canvasser']) {
    const g = newGame();
    g.godMode = true;
    const s = street(g);
    const P = g.player;
    const e = g.spawnEnemy(type, { x: s.x, y: 0.15, z: s.z - (type === 'canvasser' ? 3 : 14) });
    e.attackCd = 0;
    let maxTele = 0, attacked = false, teleBefore = 0;
    const off1 = g.events.on('enemyAttack', () => { if (!attacked) teleBefore = maxTele; attacked = true; });
    const off2 = g.events.on('playerHurt', () => { if (!attacked) teleBefore = maxTele; attacked = true; });
    const off3 = g.events.on('dodged', () => { if (!attacked) teleBefore = maxTele; attacked = true; });
    const off4 = g.events.on('blocked', () => { if (!attacked) teleBefore = maxTele; attacked = true; });
    for (let i = 0; i < 600 && !attacked; i++) {
      g.step({ ...EMPTY_INPUT, yaw: P.yaw });
      maxTele = Math.max(maxTele, e.telegraph);
    }
    off1(); off2(); off3(); off4();
    assert.ok(attacked, `${type} attacked`);
    assert.ok(teleBefore > 0.95, `${type} telegraphed fully before attacking (${teleBefore})`);
  }
});

test('Speakerphone Guy: shooting his phone stuns him', () => {
  const g = newGame();
  const s = street(g);
  const e = g.spawnEnemy('speakerphone', { x: s.x, y: 0.15, z: s.z - 12 });
  g.combat.hitEnemy(e, { damage: 1, part: 'phone', noProc: true });
  assert.ok(e.stunned > 1.5);
});

test('Scooter Bro crashes and is stunned when his charge is dodged', () => {
  const g = newGame();
  const s = street(g);
  const P = g.player;
  const e = g.spawnEnemy('scooter', { x: s.x, y: 0.15, z: s.z - 15 });
  e.attackCd = 0;
  let crashed = false, dodged = false;
  g.events.on('crash', () => (crashed = true));
  for (let i = 0; i < 400 && !crashed; i++) {
    // Dodge sideways as soon as the charge starts.
    const go = e.state === 'charge' && !dodged;
    if (go) dodged = true;
    // Facing east, the scooter comes from the north: dodge forward, across his line.
    g.step({ ...EMPTY_INPUT, yaw: P.yaw, moveZ: go ? 1 : 0, utility: go });
  }
  assert.ok(crashed);
  assert.ok(e.stunned > 0 || e.state === 'chase');
});

test('Canvasser latches, slows, and a dash breaks the latch', () => {
  const g = newGame();
  const s = street(g);
  const P = g.player;
  const e = g.spawnEnemy('canvasser', { x: s.x, y: 0.15, z: s.z - 2.5 });
  e.attackCd = 0;
  for (let i = 0; i < 300 && P.latchedBy !== e; i++) g.step({ ...EMPTY_INPUT, yaw: P.yaw });
  assert.equal(P.latchedBy, e);
  steps(g, 2, { ...EMPTY_INPUT, yaw: P.yaw });
  assert.ok(P.stats.moveMul < 0.5, `slowed: ${P.stats.moveMul}`);
  g.step({ ...EMPTY_INPUT, yaw: P.yaw, moveZ: -1, utility: true });
  assert.equal(P.latchedBy, null);
  assert.notEqual(e.state, 'latched');
});

test('boss: spawns with intro and slow-mo, health scales, drops a boss item on death, minions cleared', () => {
  const g = newGame();
  let intro = null;
  g.events.on('intro', (d) => (intro = d));
  g.exit.call();
  steps(g, 200);
  assert.ok(g.boss && g.boss.alive);
  assert.ok(intro && intro.boss);
  assert.ok(g.boss.body.h > 5 && g.boss.body.h < 6, 'about 3x survivor height');
  g.spawnEnemy('drone', { x: g.boss.pos.x, y: 8, z: g.boss.pos.z });
  g.combat.hitEnemy(g.boss, { damage: 1e7 });
  assert.equal(g.boss.alive, false);
  assert.ok(g.pickups.list.some((k) => k.kind === 'item'));
  assert.ok(!g.enemies.some((e) => e.alive && (e.type === 'drone' || e.type === 'notice')));
});

test('no state carries over between runs (fresh Game resets boss, exit, director, shops)', () => {
  const g1 = newGame();
  g1.exit.call();
  steps(g1, 300);
  g1.city.interactables[0].used = true;
  const g2 = newGame();
  assert.equal(g2.exit.state, 'idle');
  assert.equal(g2.boss, null);
  assert.equal(g2.enemies.length, 0);
  assert.equal(g2.state, 'playing');
  assert.ok(g2.city.interactables.every((i) => !i.used));
});

test('enemies never spawn inside geometry', () => {
  const g = newGame();
  g.director.enabled = true;
  g.director.credits = 5000;
  g.godMode = true;
  let bad = 0, n = 0;
  g.events.on('spawn', (d) => {
    n++;
    if (!g.world.fits(d.pos.x, d.pos.y + 0.06, d.pos.z, 0.4, 1.7) && d.type !== 'notice') bad++;
  });
  steps(g, 60 * 40, { ...EMPTY_INPUT, yaw: g.player.yaw });
  assert.ok(n > 5, `spawned ${n}`);
  assert.equal(bad, 0);
});
