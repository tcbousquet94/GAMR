// Shops: affordability, delivery, price scaling with the clock, one use per machine, the call panel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, EMPTY_INPUT } from '../../src/sim/game.js';
import { downtown } from '../../src/city/districts/downtown.js';
import { generateCity } from '../../src/city/generator.js';
import { FlowField } from '../../src/sim/flow.js';
import { DEE } from '../../src/sim/survivors/dee.js';
import { ECON } from '../../src/core/config.js';

const city = generateCity(downtown, 7);
const flow = new FlowField(city.world, city.size);
const newGame = (startMinutes = 0) => { const g = new Game({ seed: 7, district: downtown, survivor: DEE, city, flow, startMinutes }); g.director.enabled = false; return g; };

function standAt(g, it) {
  const P = g.player;
  Object.assign(P.body.pos, { x: it.x + Math.sin(it.yaw) * 1.2, y: it.y + 0.02, z: it.z + Math.cos(it.yaw) * 1.2 });
  P.yaw = Math.atan2(-(it.x - P.pos.x), -(it.z - P.pos.z));
}

test('run starts with $3.40', () => assert.equal(newGame().economy.cents, ECON.startCents));

test('cannot buy what you cannot afford; buying deducts and always delivers', () => {
  const g = newGame();
  const it = g.city.interactables.find((i) => i.type === 'vending');
  standAt(g, it);
  g.economy.cents = 0;
  let refused = 0;
  g.events.on('cantAfford', () => refused++);
  g.step({ ...EMPTY_INPUT, yaw: g.player.yaw, interact: true });
  assert.equal(refused, 1);
  assert.equal(it.used, false);
  assert.equal(Object.keys(g.player.inv).length, 0);
  const price = g.economy.price(it);
  g.economy.cents = price;
  g.step({ ...EMPTY_INPUT, yaw: g.player.yaw, interact: true });
  assert.equal(g.economy.cents, 0);
  assert.equal(it.used, true);
  assert.equal(Object.values(g.player.inv).reduce((a, b) => a + b, 0), 1);
  // Used machines can't be bought from again.
  g.economy.cents = 10000;
  g.step({ ...EMPTY_INPUT, yaw: g.player.yaw, interact: true });
  assert.equal(g.economy.cents, 10000);
});

test('each shop type delivers its tier', () => {
  const g = newGame();
  for (const [type, check] of [['vending', 'common'], ['newsbox', 'common'], ['locker', 'uncommon']]) {
    const it = g.city.interactables.find((i) => i.type === type && !i.used);
    assert.ok(it, `${type} exists`);
    standAt(g, it);
    g.economy.cents = 100000;
    let got = null;
    const off = g.events.on('purchase', (d) => (got = d));
    g.step({ ...EMPTY_INPUT, yaw: g.player.yaw, interact: true });
    off();
    assert.ok(got && got.tier === check, `${type} -> ${got && got.tier}`);
  }
  const lf = g.city.interactables.find((i) => i.type === 'lostfound');
  standAt(g, lf);
  g.economy.cents = 100000;
  g.step({ ...EMPTY_INPUT, yaw: g.player.yaw, interact: true });
  assert.ok(['airhorn', 'cart'].includes(g.player.equipment));
});

test('prices rise with the difficulty clock', () => {
  const it = city.interactables.find((i) => i.type === 'locker');
  const early = newGame(0).economy.price(it), late = newGame(12).economy.price(it);
  assert.ok(late > early * 1.8, `${early} -> ${late}`);
});

test('call panel starts the train countdown once', () => {
  const g = newGame();
  const panel = g.city.interactables.find((i) => i.type === 'callpanel');
  assert.ok(panel);
  standAt(g, panel);
  g.step({ ...EMPTY_INPUT, yaw: g.player.yaw, interact: true });
  assert.equal(g.exit.state, 'called');
  const t = g.exit.t;
  g.step({ ...EMPTY_INPUT, yaw: g.player.yaw, interact: true });
  assert.ok(g.exit.t > t && g.exit.state === 'called');
});

test('equipment: airhorn stuns and knocks back, cart plows through enemies; both go on cooldown', () => {
  const g = newGame();
  const P = g.player;
  P.equipment = 'airhorn';
  const s = g.city.spawn;
  const f = P.forward();
  const e = g.spawnEnemy('canvasser', { x: s.x + f.x * 5, y: 0.15, z: s.z + f.z * 5 });
  g.step({ ...EMPTY_INPUT, yaw: P.yaw, equipment: true });
  assert.ok(e.stunned > 1.5);
  assert.ok(P.equipCd > 20);
  g.step({ ...EMPTY_INPUT, yaw: P.yaw, equipment: true });
  assert.ok(P.equipCd > 20 && g.stats.equipUses === 1, 'cooldown respected');
  const g2 = newGame();
  const P2 = g2.player;
  P2.equipment = 'cart';
  P2.yaw = 0; // ride north along the street
  const f2 = P2.forward();
  const e2 = g2.spawnEnemy('canvasser', { x: s.x + f2.x * 8, y: 0.15, z: s.z + f2.z * 8 });
  e2.stunned = 99;
  const hp = e2.hp;
  for (let i = 0; i < 90; i++) g2.step({ ...EMPTY_INPUT, yaw: P2.yaw, equipment: i === 0 });
  assert.ok(e2.hp < hp, 'cart hit');
});
