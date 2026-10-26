// Street fights: waves spawn, the crew fights back, kills score with the combo, power-ups work, the run ends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTurf } from '../../src/city/turf/generate.js';
import { DOWNTOWN } from '../../src/city/turf/districts/downtown.js';
import { TurfGame } from '../../src/sim/turf/turfGame.js';
import { makeCustomHero } from '../../src/sim/survivors/custom.js';
import { defaultLook } from '../../src/ui/look.js';
import { waveMix, POWERS, ARCADE } from '../../src/sim/turf/arcade.js';
import { EMPTY_INPUT } from '../../src/sim/game.js';
import { DT } from '../../src/core/config.js';

const city = generateTurf(DOWNTOWN, 5);
const newGame = () => new TurfGame({ seed: 5, survivor: makeCustomHero(defaultLook()), city, arcade: true });
const run = (g, s) => { for (let i = 0; i < s / DT; i++) g.step(EMPTY_INPUT); };

test('waves grow and bring bruisers then heavies', () => {
  assert.equal(waveMix(1).heavy + waveMix(1).bruiser, 0);
  assert.ok(waveMix(2).bruiser > 0 && waveMix(3).heavy > 0);
  for (let n = 1; n < 12; n++) assert.ok(waveMix(n + 1).count > waveMix(n).count);
});

test('wave 1 spawns, the crew closes in and hurts a player who stands still, and the run ends with a result', () => {
  const g = newGame();
  const over = [];
  g.events.on('arcadeOver', (r) => over.push(r));
  run(g, 4);
  assert.equal(g.arcade.wave, 1);
  run(g, 10);
  assert.ok(g.enemies.some((e) => e.alive && ['gunman', 'bruiser', 'heavy'].includes(e.type)), 'crew on the street');
  const hp0 = g.player.hp;
  run(g, 60);
  assert.ok(g.player.hp < hp0 || g.player.dead, 'they fought back');
  for (let i = 0; i < 240 && !g.player.dead; i++) run(g, 1);
  assert.ok(g.player.dead, 'a player who never fights back goes down');
  assert.equal(over.length, 1);
  assert.ok(over[0].score > 0 && over[0].wave >= 1);
});

test('kills score with headshots and the combo; clearing a wave pays a bonus', () => {
  const g = newGame();
  g.godMode = true;
  run(g, 4);
  let killed = 0;
  for (let i = 0; i < 400 && g.arcade.wave === 1; i++) {
    for (const e of g.enemies) if (e.alive) { g.combat.hitEnemy(e, { damage: 9999, source: 'revolver', part: killed % 2 ? 'head' : 'body', noCrit: true }); killed++; }
    run(g, 0.5);
  }
  assert.ok(g.arcade.kills >= waveMix(1).count);
  assert.ok(g.arcade.headshots > 0);
  const min = waveMix(1).count * ARCADE.points.gunman + ARCADE.waveBonus;
  assert.ok(g.arcade.score >= min, `score ${g.arcade.score} >= ${min}`);
  assert.ok(g.arcade.best.n >= 2, 'a streak built up');
});

test('power-ups: double damage, rapid fire, adrenaline, armor, medkit', () => {
  const g = newGame();
  const P = g.player;
  const dmg = P.stats.damage, move = P.stats.moveMul;
  g.arcade.grant('double'); g.arcade.grant('speed'); g.arcade.grant('rapid');
  P.refreshStats();
  assert.equal(P.stats.damage, dmg * 2);
  assert.ok(P.stats.moveMul > move * 1.3);
  const ammo = P.gun.ammo;
  P.gun.fire(P, g);
  assert.equal(P.gun.ammo, ammo, 'rapid fire never empties the cylinder');
  g.arcade.grant('armor');
  assert.equal(P.barrier, 60);
  P.hp = 10; g.arcade.grant('medkit');
  assert.ok(P.hp >= 70);
  run(g, POWERS.double.time + 1);
  P.refreshStats();
  assert.equal(P.stats.damage, dmg, 'double damage wears off');
  // Walking into a dropped power-up grants it.
  g.pickups.spawnPower({ x: P.pos.x, y: P.pos.y + 0.6, z: P.pos.z }, 'score');
  run(g, 1);
  assert.ok(g.arcade.active('score'));
});
