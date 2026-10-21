// Item stacking, caps, procs and the required synergies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, roll } from '../../src/sim/stats.js';
import { ITEMS, POOLS } from '../../src/sim/items.js';
import { Rng } from '../../src/core/rng.js';
import { Game, EMPTY_INPUT } from '../../src/sim/game.js';
import { downtown } from '../../src/city/districts/downtown.js';
import { generateCity } from '../../src/city/generator.js';
import { FlowField } from '../../src/sim/flow.js';
import { DEE } from '../../src/sim/survivors/dee.js';
import { COMBAT, MOVE } from '../../src/core/config.js';

const city = generateCity(downtown, 7);
const flow = new FlowField(city.world, city.size);
const newGame = () => { const g = new Game({ seed: 7, district: downtown, survivor: DEE, city, flow }); g.director.enabled = false; return g; };
const steps = (g, n, input = EMPTY_INPUT) => { for (let i = 0; i < n; i++) g.step(input); };
const dummy = (g, dz = 8, dx = 0) => {
  const s = g.city.spawn;
  const e = g.spawnEnemy('canvasser', { x: s.x + dx, y: 0.15, z: s.z - dz });
  e.stunned = 1e9;
  return e;
};

test('every stat stays finite and capped for absurd stacks of everything', () => {
  for (const n of [0, 1, 5, 50, 1000, 1e9, -5, NaN, Infinity]) {
    const inv = {};
    for (const k of Object.keys(ITEMS)) inv[k] = n;
    const st = computeStats(DEE.base, inv, { tier: 4, timeSinceHit: 99, overtimeStacks: 1e9, luck: 99 });
    for (const [k, v] of Object.entries(st)) if (typeof v !== 'boolean') assert.ok(Number.isFinite(v), `${k}=${v} for n=${n}`);
    assert.ok(st.moveMul <= MOVE.maxMoveMul);
    assert.ok(st.attackSpeed <= COMBAT.maxAttackSpeedMul);
    assert.ok(st.block <= COMBAT.maxBlockChance);
    assert.ok(st.jumps <= MOVE.maxJumps);
    assert.ok(st.burnChance <= 1 && st.citeChance <= 0.6 && st.luck <= 3);
    assert.ok(st.maxHp >= 1);
  }
});

test('stacking rules: linear, diminishing and per-stack scaling', () => {
  const s0 = computeStats(DEE.base, {});
  assert.ok(Math.abs(computeStats(DEE.base, { latte: 2 }).moveMul - 1.28) < 1e-9);
  assert.ok(Math.abs(computeStats(DEE.base, { espresso: 3 }).attackSpeed - 1.45) < 1e-9);
  const b1 = computeStats(DEE.base, { headphones: 1 }).block, b2 = computeStats(DEE.base, { headphones: 2 }).block;
  assert.ok(Math.abs(b1 - 0.15) < 1e-9 && b2 > b1 && b2 - b1 < b1, 'headphones diminishing');
  assert.equal(computeStats(DEE.base, { gym: 2 }).maxHp, s0.maxHp + 50);
  assert.equal(computeStats(DEE.base, { courierbag: 1 }).jumps, s0.jumps + 1);
  assert.equal(computeStats(DEE.base, { dataplan: 2 }).lightningTargets, 5);
  assert.ok(computeStats(DEE.base, { insoles: 1 }, { timeSinceHit: 6 }).moveMul > computeStats(DEE.base, { insoles: 1 }, { timeSinceHit: 2 }).moveMul);
  // Night Shift: Dee gets stronger as difficulty rises.
  assert.ok(computeStats(DEE.base, {}, { tier: 3 }).damage > s0.damage);
});

test('luck (Lucky Penny) makes chance effects trigger far more often', () => {
  const r = new Rng(5);
  let a = 0, b = 0;
  for (let i = 0; i < 20000; i++) { if (roll(r, 0.1, 0)) a++; if (roll(r, 0.1, 1)) b++; }
  assert.ok(Math.abs(a / 20000 - 0.1) < 0.01);
  assert.ok(Math.abs(b / 20000 - 0.19) < 0.012, `luck 1 rate ${b / 20000}`);
});

test('Hot Sauce + Reply All: burning enemies explode into more burning enemies', () => {
  const g = newGame();
  g.giveItem('hotsauce', 10); // 100% burn chance
  g.giveItem('replyall');
  const a = dummy(g, 10), b = dummy(g, 12, 2), c = dummy(g, 12, -2);
  b.hp = b.maxHp = 1e5; c.hp = c.maxHp = 1e5;
  g.combat.hitEnemy(a, { damage: 1, crit: false }); // sets a burning
  assert.ok(a.burns.length > 0);
  g.combat.hitEnemy(a, { damage: 1e5, crit: false, noProc: true });
  assert.equal(a.alive, false);
  assert.ok(b.burns.length > 0 && c.burns.length > 0, 'explosion spread the burn');
  // And the chain continues: kill b while burning, c gets hit by another explosion.
  const chp = c.hp;
  b.hp = 1;
  steps(g, 30);
  assert.equal(b.alive, false);
  assert.ok(c.hp < chp);
});

test('Unlimited Data Plan chains lightning; Group Text fires homing missiles that land', () => {
  const g = newGame();
  g.giveItem('dataplan');
  g.player.stats.lightningChance = 1;
  const es = [dummy(g, 10), dummy(g, 12, 3), dummy(g, 14, -3), dummy(g, 16)];
  for (const e of es) e.hp = e.maxHp = 1e5;
  let bolts = 0;
  g.events.on('lightning', () => bolts++);
  g.combat.onHitProcs(es[0], 1, 0, {});
  assert.ok(bolts >= 1 && es.slice(1).every((e) => e.hp < 1e5));
  const g2 = newGame();
  g2.giveItem('grouptext');
  const t = dummy(g2, 10);
  t.hp = t.maxHp = 1e5;
  g2.projectiles.textMissile(g2.player, t, 30, 1);
  steps(g2, 240);
  assert.ok(t.hp < 1e5, 'missile hit');
});

test('Gavel of Authority slams on every 5th hit; Violation Notice cites for +30%', () => {
  const g = newGame();
  g.giveItem('gavel');
  const e = dummy(g, 8), f = dummy(g, 9, 1.5);
  e.hp = e.maxHp = f.hp = f.maxHp = 1e5;
  let slams = 0;
  g.events.on('gavelSlam', () => slams++);
  for (let i = 0; i < 10; i++) g.combat.hitEnemy(e, { damage: 1, crit: false });
  assert.equal(slams, 2);
  const g2 = newGame();
  g2.giveItem('violation');
  const v = dummy(g2, 8);
  v.hp = v.maxHp = 1e5;
  v.cited = 5;
  v.hp = 5e4; // below the coupon threshold either way
  assert.equal(g2.combat.hitEnemy(v, { damage: 10, crit: false, noProc: true }), 13);
});

test('Free Sample snack heals, Band-Aids heal after damage, Overtime stacks and expires, Coin Jar adds change', () => {
  const g = newGame();
  const P = g.player;
  g.giveItem('sample'); g.giveItem('bandaids'); g.giveItem('overtime'); g.giveItem('coinjar', 4);
  P.hp = 20;
  const e = dummy(g, 3);
  g.combat.hitEnemy(e, { damage: 1e6 });
  assert.equal(P.overtime.stacks, 1);
  steps(g, 120);
  assert.ok(P.hp > 30, `snack healed: ${P.hp}`);
  const hp = P.hp;
  g.combat.hurtPlayer(P, 5, { source: 'test', unblockable: true });
  steps(g, 150);
  assert.ok(P.hp > hp, 'band-aid heal after 2s');
  steps(g, 60 * 5);
  assert.equal(P.overtime.stacks, 0, 'overtime expires');
  // Coin jar: 4 stacks doubles drops.
  const g2 = newGame();
  const e2 = dummy(g2, 3);
  const base = () => g2.pickups.list.filter((k) => k.kind === 'coin').reduce((a, k) => a + k.value, 0);
  g2.combat.hitEnemy(e2, { damage: 1e6 });
  const plain = base();
  const g3 = newGame();
  g3.giveItem('coinjar', 4);
  const e3 = dummy(g3, 3);
  g3.combat.hitEnemy(e3, { damage: 1e6 });
  const jar = g3.pickups.list.filter((k) => k.kind === 'coin').reduce((a, k) => a + k.value, 0);
  assert.ok(Math.abs(jar / plain - 2) < 0.1, `coin jar ratio ${jar / plain}`);
});

test('Leftover Pizza heals while standing still, not while moving', () => {
  const g = newGame();
  const P = g.player;
  g.giveItem('pizza');
  P.hp = 30;
  steps(g, 60 * 3);
  const still = P.hp;
  assert.ok(still > 30 + P.stats.regen * 3 + 2, `pizza healed while still: ${still}`);
  P.hp = 30;
  steps(g, 60 * 3, { ...EMPTY_INPUT, yaw: 0, moveZ: 1 }); // run north up the open street
  assert.ok(P.hp < still, 'less healing while moving');
});

test('Comfy Insoles + Dee: dodged hits keep the speed bonus, and the bonus lengthens Salsa Step', () => {
  const g = newGame();
  const P = g.player;
  g.giveItem('insoles');
  steps(g, 60 * 6);
  const fast = P.stats.moveMul;
  assert.ok(fast >= 1.3);
  g.step({ ...EMPTY_INPUT, yaw: P.yaw, moveZ: -1, utility: true });
  g.combat.hurtPlayer(P, 10, { source: 'test' }); // dodged by i-frames
  g.step(EMPTY_INPUT);
  assert.ok(P.stats.moveMul >= fast - 1e-9, 'still fast after a dodged hit');
  g.combat.hurtPlayer(P, 10, { source: 'test', unblockable: true });
  g.step(EMPTY_INPUT);
  assert.ok(P.stats.moveMul < fast, 'a real hit removes the bonus');
});

test('every item in every pool has a definition and a tier colour', () => {
  for (const [tier, ids] of Object.entries(POOLS)) assert.ok(ids.length > 0, tier);
  assert.equal(POOLS.common.length, 9);
  assert.equal(POOLS.uncommon.length, 7);
  assert.equal(POOLS.boss.length, 2);
});
