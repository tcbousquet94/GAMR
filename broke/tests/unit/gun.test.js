// Gunplay: the revolver (hitscan, headshots, falloff, spread, cylinder and reload, cocking), hold-to-aim, and the
// player-made character kit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, EMPTY_INPUT } from '../../src/sim/game.js';
import { downtown } from '../../src/city/districts/downtown.js';
import { generateCity } from '../../src/city/generator.js';
import { FlowField } from '../../src/sim/flow.js';
import { makeCustomHero } from '../../src/sim/survivors/custom.js';
import { damageAt, coneSample, raySphere } from '../../src/sim/gun.js';
import { GUNS, CAM } from '../../src/core/config.js';
import { Rng } from '../../src/core/rng.js';
import { makePerson } from '../../src/render/people/person.js';
import { sanitizeControl } from '../../src/sim/commands.js';
import { AimAssist } from '../../src/input/aimAssist.js';

const R = GUNS.revolver;
const city = generateCity(downtown, 7);
const flow = new FlowField(city.world, city.size);
const HERO = makeCustomHero({ ...makePerson(3, 'crew'), name: 'Tester' });
const newGame = () => { const g = new Game({ seed: 7, district: downtown, survivor: HERO, city, flow }); g.director.enabled = false; return g; };
const street = (g) => ({ x: g.city.spawn.x, y: 0.15, z: g.city.spawn.z });

// Input yaw/pitch that put the (recoil-free) aim ray through point q.
function aimAt(g, q) {
  const p = g.player;
  p.recoil.pitch = p.recoil.yaw = 0;
  let yaw = p.yaw, pitch = p.pitch;
  for (let i = 0; i < 4; i++) {
    p.yaw = yaw; p.pitch = pitch;
    const { origin: o } = p.aim();
    const dx = q.x - o.x, dy = q.y - o.y, dz = q.z - o.z;
    yaw = Math.atan2(-dx, -dz);
    pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }
  return { yaw, pitch };
}
// Hold aim for a moment (gun up), then one click aimed at q. Returns the shot event.
function shootAt(g, q, { aim = true } = {}) {
  let shot = null;
  const off = g.events.on('shot', (d) => (shot = d));
  for (let i = 0; i < 20; i++) g.step({ ...EMPTY_INPUT, ...aimAt(g, q), aim });
  g.step({ ...EMPTY_INPUT, ...aimAt(g, q), aim, primary: true });
  g.step({ ...EMPTY_INPUT, ...aimAt(g, q), aim });
  off();
  return shot;
}
function target(g, dz = 10) {
  const s = street(g);
  const e = g.spawnEnemy('canvasser', { x: s.x, y: 0.15, z: s.z - dz });
  e.stunned = 999; e.hp = e.maxHp = 1000;
  return e;
}
const pt = (e, part) => e.hitPoints().find((h) => h.part === part);

test('damage falls off with range and headshots multiply it', () => {
  assert.equal(damageAt(R, 5, false), R.damage);
  assert.equal(damageAt(R, R.falloff[0], false), R.damage);
  assert.equal(damageAt(R, R.falloff[1] + 50, false), R.damage * R.minMul);
  const mid = damageAt(R, (R.falloff[0] + R.falloff[1]) / 2, false);
  assert.ok(mid < R.damage && mid > R.damage * R.minMul);
  assert.equal(damageAt(R, 5, true), R.damage * R.headMul);
});

test('ray/sphere and cone sampling', () => {
  assert.ok(Math.abs(raySphere({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: -10 }, 1) - 9) < 1e-9);
  assert.equal(raySphere({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 3, y: 0, z: -10 }, 1), -1);
  const rng = new Rng('cone'), d = { x: 0, y: 0, z: -1 };
  for (let i = 0; i < 200; i++) {
    const v = coneSample(d, 0.05, rng);
    assert.ok(Math.abs(Math.hypot(v.x, v.y, v.z) - 1) < 1e-9);
    assert.ok(Math.acos(-v.z) <= 0.05 + 1e-9);
  }
  assert.deepEqual(coneSample(d, 0, rng), d);
});

test('aimed body shot hits for full damage; a headshot does headMul times that', () => {
  const g = newGame();
  const e = target(g);
  let hit = null;
  g.events.on('hit', (d) => (hit = d));
  const s1 = shootAt(g, pt(e, 'body'));
  assert.ok(s1 && s1.hit && !s1.head, 'body hit');
  assert.equal(hit.part, 'body');
  assert.ok(Math.abs(hit.amount - R.damage) < 1e-6, `body ${hit.amount}`);
  const s2 = shootAt(g, pt(e, 'head'));
  assert.ok(s2.hit && s2.head, 'head hit');
  assert.ok(Math.abs(hit.amount - R.damage * R.headMul) < 1e-6, `head ${hit.amount}`);
});

test('holding aim raises the gun, tightens the spread and slows you down', () => {
  const g = newGame();
  const P = g.player;
  const hip = P.gun.spread(P);
  for (let i = 0; i < 30; i++) g.step({ ...EMPTY_INPUT, yaw: P.yaw, aim: true });
  assert.ok(P.aiming && P.aimBlend === 1);
  assert.ok(P.gun.spread(P) < hip / 10, 'aimed spread is far tighter than hip fire');
  assert.ok(P.camPose().dist < CAM.hip.dist && P.camPose().fov < CAM.hip.fov, 'camera pulls in');
  const walk = (aim) => {
    const h = newGame(), Q = h.player, p0 = { ...Q.pos };
    for (let i = 0; i < 90; i++) h.step({ ...EMPTY_INPUT, yaw: Q.yaw, moveZ: 1, sprint: true, aim });
    return Math.hypot(Q.pos.x - p0.x, Q.pos.z - p0.z);
  };
  assert.ok(walk(true) < walk(false) * 0.5, 'aiming walks, no sprint');
  for (let i = 0; i < 30; i++) g.step({ ...EMPTY_INPUT, yaw: P.yaw });
  assert.ok(!P.aiming && P.aimBlend === 0);
});

test('one click, one shot: the hammer must cock between shots', () => {
  const g = newGame();
  let shots = 0;
  g.events.on('shot', () => shots++);
  const P = g.player;
  for (let i = 0; i < 120; i++) g.step({ ...EMPTY_INPUT, yaw: P.yaw, primary: true }); // held for 2 s
  assert.equal(shots, 1);
  // A click just before the hammer is back is buffered and fires when it is.
  shots = 0;
  g.step({ ...EMPTY_INPUT, yaw: P.yaw, primary: false });
  g.step({ ...EMPTY_INPUT, yaw: P.yaw, primary: true });
  g.step({ ...EMPTY_INPUT, yaw: P.yaw, primary: false });
  for (let i = 0; i < 12; i++) g.step({ ...EMPTY_INPUT, yaw: P.yaw }); // 0.2 s in: the hammer isn't back yet
  g.step({ ...EMPTY_INPUT, yaw: P.yaw, primary: true });
  g.step({ ...EMPTY_INPUT, yaw: P.yaw });
  assert.equal(shots, 1, 'not yet');
  for (let i = 0; i < 40; i++) g.step({ ...EMPTY_INPUT, yaw: P.yaw });
  assert.equal(shots, 2);
});

test('six in the cylinder, reload a round at a time, firing cancels the reload', () => {
  const g = newGame();
  const P = g.player, gun = P.gun;
  const click = () => { g.step({ ...EMPTY_INPUT, yaw: P.yaw, primary: true }); for (let i = 0; i < 25; i++) g.step({ ...EMPTY_INPUT, yaw: P.yaw }); };
  for (let i = 0; i < 6; i++) click();
  assert.equal(gun.ammo, 0);
  let dry = 0;
  g.events.on('dryFire', () => dry++);
  click();
  assert.equal(dry, 1);
  assert.ok(gun.reloading, 'dry fire starts a reload');
  const full = Math.ceil((R.reloadStart + R.reloadRound * R.cylinder) * 60) + 2;
  for (let i = 0; i < full; i++) g.step({ ...EMPTY_INPUT, yaw: P.yaw });
  assert.equal(gun.ammo, R.cylinder);
  assert.ok(!gun.reloading);
  click(); click();
  g.step({ ...EMPTY_INPUT, yaw: P.yaw, reload: true });
  for (let i = 0; i < Math.ceil((R.reloadStart + R.reloadRound) * 60) + 2; i++) g.step({ ...EMPTY_INPUT, yaw: P.yaw });
  assert.equal(gun.ammo, 5);
  click();
  assert.ok(!gun.reloading, 'firing interrupted the reload');
  assert.equal(gun.ammo, 4);
});

test('recoil climbs the aim and springs back', () => {
  const g = newGame();
  const P = g.player;
  g.step({ ...EMPTY_INPUT, yaw: P.yaw, primary: true });
  assert.ok(P.recoil.pitch > R.recoil * 0.5);
  for (let i = 0; i < 60; i++) g.step({ ...EMPTY_INPUT, yaw: P.yaw });
  assert.ok(Math.abs(P.recoil.pitch) < 1e-3 && Math.abs(P.recoil.yaw) < 1e-3);
});

test('a round stops on the wall in front of the muzzle', () => {
  const g = newGame();
  const P = g.player;
  // Face the nearest wall from the street and shoot at it: the shot ends on the wall, short of its range.
  let best = null;
  for (let a = 0; a < 64; a++) {
    const yaw = (a / 64) * Math.PI * 2;
    P.yaw = yaw; P.pitch = 0;
    const { origin: o, dir } = P.aim();
    const t = g.world.raycast(o.x, o.y, o.z, dir.x, dir.y, dir.z, R.range);
    if (t > 3 && (!best || t < best.t)) best = { yaw, t };
  }
  let shot = null, impact = null;
  g.events.on('shot', (d) => (shot = d));
  g.events.on('impact', (d) => (impact = d));
  for (let i = 0; i < 20; i++) g.step({ ...EMPTY_INPUT, yaw: best.yaw, aim: true });
  g.step({ ...EMPTY_INPUT, yaw: best.yaw, aim: true, primary: true });
  assert.ok(shot && !shot.hit);
  assert.equal(impact?.kind, 'bullet');
  assert.ok(Math.hypot(shot.to.x - shot.from.x, shot.to.z - shot.from.z) < best.t + 1);
});

test('control commands carry aim and reload, sanitised', () => {
  const c = sanitizeControl({ aim: true, reload: 'yes' });
  assert.equal(c.aim, true);
  assert.equal(c.reload, false);
});

test('the custom hero carries the creator look and the player name', () => {
  assert.equal(HERO.name, 'Tester');
  assert.ok(HERO.aims && HERO.look.outfit);
  assert.equal(makeCustomHero({ ...makePerson(1), name: '  ' }).name, 'You');
});

test('aim assist: raising the gun snaps onto a body in the cone; the look slows on target; off means off', () => {
  const run = (enabled) => {
    const g = newGame();
    const e = target(g, 14);
    const P = g.player;
    const input = { yaw: 0.12, pitch: 0, sensMul: 1 }; // the target is straight down -z; look a little off to the side
    const aa = new AimAssist(input);
    aa.enabled = enabled;
    for (let i = 0; i < 40; i++) { aa.update(1 / 60, g); g.step({ ...EMPTY_INPUT, yaw: input.yaw, pitch: input.pitch, aim: true }); }
    return { aa, input, e };
  };
  const on = run(true);
  assert.equal(on.aa.on?.enemy?.id, on.e.id, 'reticle ends on the target');
  assert.equal(on.aa.on.part, 'body');
  assert.ok(Math.abs(on.input.yaw - Math.atan2(CAM.ads.side, 14)) < 0.02, `snapped from 0.12 to ${on.input.yaw}`); // centred from the aimed shoulder
  assert.ok(on.input.sensMul < CAM.adsSensMul, 'friction on target');
  const off = run(false);
  assert.equal(off.aa.on, null, 'no snap when disabled');
  assert.equal(off.input.yaw, 0.12);
});
