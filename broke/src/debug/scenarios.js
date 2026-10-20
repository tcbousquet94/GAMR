// Bot scenarios. Each is a generator that yields once per sim step, so the browser can render while it runs and
// Node can run it flat out. Every scenario writes plain numbers into ctx.results.

import { DT } from '../core/config.js';
import { EMPTY_INPUT } from '../sim/game.js';
import { Bot } from './bot.js';

export function makeCtx(game, nav) {
  const ctx = { game, nav, bot: new Bot(game, nav), results: {}, simTime: 0 };
  ctx.step = (input) => { game.step(input); ctx.simTime += DT; };
  return ctx;
}

function* runFor(ctx, seconds, inputFn) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) { ctx.step(inputFn(i)); yield; }
}
function* until(ctx, cond, maxSec, inputFn) {
  const n = Math.round(maxSec / DT);
  for (let i = 0; i < n; i++) { if (cond()) return true; ctx.step(inputFn(i)); yield; }
  return cond();
}

// Find a flat, open patch of street near the spawn for movement measurements.
function openStreet(game) {
  const s = game.city.spawn;
  return { x: s.x, z: s.z, yaw: Math.PI }; // the outer west street runs north-south; face north (-z)
}

export function* movement(ctx) {
  const g = ctx.game, P = g.player, R = (ctx.results.movement = {});
  g.director.enabled = false;
  const s = openStreet(g);
  const reset = () => { P.body.pos.x = s.x; P.body.pos.z = s.z; P.body.pos.y = 0.2; P.body.vel = { x: 0, y: 0, z: 0 }; };
  reset();
  yield* runFor(ctx, 0.5, () => ({ ...EMPTY_INPUT, yaw: s.yaw }));
  let z0 = P.pos.z;
  yield* runFor(ctx, 1, () => ({ ...EMPTY_INPUT, yaw: s.yaw, moveZ: 1 }));
  z0 = P.pos.z;
  yield* runFor(ctx, 2, () => ({ ...EMPTY_INPUT, yaw: s.yaw, moveZ: 1 }));
  R.walkSpeed = +(Math.abs(P.pos.z - z0) / 2).toFixed(2);
  z0 = P.pos.z;
  yield* runFor(ctx, 2, () => ({ ...EMPTY_INPUT, yaw: s.yaw, moveZ: 1, sprint: true }));
  z0 = P.pos.z;
  yield* runFor(ctx, 2, () => ({ ...EMPTY_INPUT, yaw: s.yaw, moveZ: 1, sprint: true }));
  R.sprintSpeed = +(Math.abs(P.pos.z - z0) / 2).toFixed(2);
  // Single and double jump peak heights from standing.
  yield* runFor(ctx, 1, () => ({ ...EMPTY_INPUT, yaw: s.yaw }));
  let y0 = P.pos.y, peak = y0;
  yield* runFor(ctx, 1.2, (i) => { peak = Math.max(peak, P.pos.y); return { ...EMPTY_INPUT, yaw: s.yaw, jumpPressed: i === 0 }; });
  R.jumpHeight = +(peak - y0).toFixed(2);
  yield* runFor(ctx, 0.5, () => ({ ...EMPTY_INPUT, yaw: s.yaw }));
  y0 = P.pos.y; peak = y0;
  yield* runFor(ctx, 1.6, (i) => { peak = Math.max(peak, P.pos.y); return { ...EMPTY_INPUT, yaw: s.yaw, jumpPressed: i === 0 || i === 20 }; });
  R.doubleJumpHeight = +(peak - y0).toFixed(2);
  R.grounded = P.body.onGround;
  // Mantle: jump at a parked car / dumpster nearby and see if we end up on top.
  const prop = g.world.solids.items.filter((b) => b.tag === 4 && b.maxY > 1.2 && b.maxY < 2.4 && Math.hypot((b.minX + b.maxX) / 2 - s.x, (b.minZ + b.maxZ) / 2 - s.z) < 90)[0];
  if (prop) {
    const cx = (prop.minX + prop.maxX) / 2, cz = (prop.minZ + prop.maxZ) / 2;
    // Stand 2.5 m off the prop's +x face, facing it.
    const sx = prop.maxX + 2.5;
    if (g.world.fits(sx, prop.minY + 0.05, cz, 0.4, 1.8)) {
      P.body.pos = { x: sx, y: prop.minY + 0.05, z: cz }; P.body.vel = { x: 0, y: 0, z: 0 };
      yield* runFor(ctx, 0.3, () => ({ ...EMPTY_INPUT, yaw: Math.PI / 2 }));
      yield* runFor(ctx, 1.2, (i) => ({ ...EMPTY_INPUT, yaw: Math.PI / 2, moveZ: 1, jumpPressed: i === 6 }));
      R.mantleOnto = P.pos.y > prop.maxY - 0.2 ? 1 : 0;
      R.mantlePropHeight = +(prop.maxY - prop.minY).toFixed(2);
    }
  }
  reset();
}

export function* climb(ctx) {
  const g = ctx.game, P = g.player, R = (ctx.results.climb = {});
  g.director.enabled = false;
  // Nearest tall ladders to the spawn; plan a path to a roof node at the top and let the bot climb it.
  const s = g.city.spawn;
  const ladders = g.world.climbs.items.filter((c) => c.maxY > 14 && c.minY < 1).sort((a, b) => d2(a, s) - d2(b, s));
  R.laddersTried = 0;
  R.onRoof = 0;
  for (const c of ladders.slice(0, 5)) {
    const tops = ctx.nav.nodesInRect(c.minX - 2, c.minZ - 2, c.maxX + 2, c.maxZ + 2).filter((i) => ctx.nav.y[i] > c.maxY - 1.6 && ctx.nav.y[i] <= c.maxY + 0.6);
    if (!tops.length) continue;
    R.laddersTried++;
    const t = tops[0];
    const goal = { x: ctx.nav.x[t], y: ctx.nav.y[t], z: ctx.nav.z[t] };
    const bot = ctx.bot;
    bot.goTo(goal);
    if (!bot.path) continue;
    const t0 = ctx.simTime;
    let peak = 0, climbT = 0;
    yield* until(ctx, () => bot.arrived(1.5), 60, () => { peak = Math.max(peak, P.pos.y); if (P.climbing) climbT += DT; return bot.input(DT); });
    R.reachedHeight = +peak.toFixed(2);
    R.ladderTop = +c.maxY.toFixed(2);
    R.onRoof = bot.arrived(1.5) && P.pos.y > 13 ? 1 : 0;
    R.climbTime = +climbT.toFixed(2);
    R.totalTime = +(ctx.simTime - t0).toFixed(2);
    if (R.onRoof) {
      // And back down: drop off the roof to the street via the path planner.
      bot.goTo({ x: s.x, y: 0.15, z: s.z });
      const t1 = ctx.simTime;
      yield* until(ctx, () => P.pos.y < 1 && P.body.onGround, 40, () => bot.input(DT));
      R.backDown = P.pos.y < 1 ? 1 : 0;
      R.downTime = +(ctx.simTime - t1).toFixed(2);
      break;
    }
  }
}

export function* combat(ctx) {
  const g = ctx.game, P = g.player, R = (ctx.results.combat = {});
  g.director.enabled = false;
  const s = openStreet(g);
  P.body.pos = { x: s.x, y: 0.2, z: s.z }; P.body.vel = { x: 0, y: 0, z: 0 };
  yield* runFor(ctx, 0.3, () => ({ ...EMPTY_INPUT, yaw: s.yaw }));
  // A stunned dummy 14 m ahead.
  const dummy = g.spawnEnemy('canvasser', { x: s.x, y: 0.15, z: s.z - 14 });
  dummy.maxHp = dummy.hp = 100000;
  const keep = () => { dummy.stunned = 99; };
  const dmg0 = g.combat.totalDamage;
  let hits = 0;
  const off = g.events.on('hit', () => hits++);
  const aim = () => { keep(); const o = P.aim().origin; const c = dummy.center(); return { yaw: Math.atan2(-(c.x - o.x), -(c.z - o.z)), pitch: Math.atan2(c.y - o.y, Math.hypot(c.x - o.x, c.z - o.z)) }; };
  yield* runFor(ctx, 3, () => ({ ...EMPTY_INPUT, ...aim(), primary: true }));
  R.primaryDps = +((g.combat.totalDamage - dmg0) / 3).toFixed(1);
  R.primaryHits = hits;
  R.shots = g.stats.shots;
  // Homing check: aim 10 degrees off and fire.
  const d1 = g.combat.totalDamage;
  yield* runFor(ctx, 1.5, () => { const a = aim(); return { ...EMPTY_INPUT, yaw: a.yaw + 0.17, pitch: a.pitch, primary: true }; });
  R.homingDps = +((g.combat.totalDamage - d1) / 1.5).toFixed(1);
  // Sprinting while firing keeps sprint speed.
  const z0 = P.pos.z;
  yield* runFor(ctx, 0.6, () => ({ ...EMPTY_INPUT, ...aim(), moveZ: 1, sprint: true, primary: true }));
  R.sprintWhileFiring = P.sprinting ? 1 : 0;
  R.movedWhileFiring = +Math.abs(P.pos.z - z0).toFixed(2);
  off();
  // Secondary: clipboard bounces among a cluster of dummies.
  P.body.pos = { x: s.x, y: 0.2, z: s.z }; P.body.vel = { x: 0, y: 0, z: 0 };
  const cluster = [];
  for (let i = 0; i < 5; i++) { const e = g.spawnEnemy('canvasser', { x: s.x + (i - 2) * 1.8, y: 0.15, z: s.z - 18 - (i % 2) * 2 }); e.stunned = 99; cluster.push(e); }
  let bounces = 0;
  const off2 = g.events.on('bounce', () => bounces++);
  yield* runFor(ctx, 0.2, () => ({ ...EMPTY_INPUT, ...aim() }));
  yield* runFor(ctx, 2, (i) => { for (const e of cluster) e.stunned = 99; return { ...EMPTY_INPUT, ...aimAt(P, cluster[2]), secondary: i === 0 }; });
  R.clipboardBounces = bounces;
  off2();
  // Utility: Salsa Step distance and i-frames.
  const before = { ...P.pos };
  let dodged = 0;
  const off3 = g.events.on('dodged', () => dodged++);
  yield* runFor(ctx, 0.05, (i) => ({ ...EMPTY_INPUT, yaw: s.yaw, moveX: 1, utility: i === 0 }));
  g.combat.hurtPlayer(P, 5, { source: 'test' });
  R.salsaDistance = +Math.hypot(P.pos.x - before.x, P.pos.z - before.z).toFixed(2);
  R.salsaDodgedHit = dodged;
  off3();
  yield* runFor(ctx, 0.5, () => ({ ...EMPTY_INPUT, yaw: s.yaw }));
  // Special: Code Blue on the cluster.
  P.body.pos = { x: s.x, y: 0.2, z: s.z }; P.body.vel = { x: 0, y: 0, z: 0 };
  let syr = 0;
  const off4 = g.events.on('impact', (e) => { if (e.kind === 'syringe') syr++; });
  const y0 = P.pos.y;
  let peak = y0;
  yield* runFor(ctx, 3, (i) => { peak = Math.max(peak, P.pos.y); for (const e of cluster) e.stunned = 99; return { ...EMPTY_INPUT, ...aimAt(P, cluster[2]), special: i === 0 }; });
  R.codeBlueSyringes = syr;
  R.codeBlueLeap = +(peak - y0).toFixed(2);
  R.codeBlueSlowed = cluster.filter((e) => e.slowMul < 1).length;
  off4();
  for (const e of [dummy, ...cluster]) e.alive = false;
}

function aimAt(P, e) {
  const o = P.aim().origin;
  const c = e.center();
  return { yaw: Math.atan2(-(c.x - o.x), -(c.z - o.z)), pitch: Math.atan2(c.y - o.y, Math.hypot(c.x - o.x, c.z - o.z)) };
}

export function* shopping(ctx) {
  const g = ctx.game, P = g.player, R = (ctx.results.shopping = {});
  g.director.enabled = false;
  const bot = ctx.bot;
  R.startCents = g.economy.cents;
  const s = P.pos;
  // Broke attempt first: set cents to 0, try nearest vending machine, expect a refusal.
  const shops = g.city.interactables.filter((i) => i.type !== 'callpanel' && i.y < 1).sort((a, b) => d2(a, s) - d2(b, s));
  let refused = 0;
  const offR = g.events.on('cantAfford', () => refused++);
  let bought = 0, delivered = 0;
  const offB = g.events.on('purchase', () => bought++);
  const offI = g.events.on('item', () => delivered++);
  let tries = 0;
  for (const it of shops.slice(0, 6)) {
    if (bought >= 3) break;
    tries++;
    const f = { x: it.x + Math.sin(it.yaw) * 1.3, y: it.y, z: it.z + Math.cos(it.yaw) * 1.3 };
    bot.goTo(f);
    yield* until(ctx, () => bot.arrived(1.6), 40, () => bot.input(DT));
    if (!bot.arrived(1.6)) continue;
    bot.face(it);
    const saved = g.economy.cents;
    if (tries === 1) {
      g.economy.cents = 0;
      yield* runFor(ctx, 0.1, (i) => ({ ...EMPTY_INPUT, yaw: bot.lookYaw, interact: i === 0 }));
      g.economy.cents = saved;
    }
    g.economy.cents = Math.max(g.economy.cents, g.economy.price(it) + 50);
    const before = g.economy.cents;
    yield* runFor(ctx, 0.1, (i) => ({ ...EMPTY_INPUT, yaw: bot.lookYaw, interact: i === 0 }));
    if (it.used) R.lastPricePaid = before - g.economy.cents;
  }
  R.refusedWhenBroke = refused;
  R.purchases = bought;
  R.itemsDelivered = delivered;
  R.inventory = Object.values(P.inv).reduce((a, b) => a + b, 0) + (P.equipment ? 1 : 0);
  R.shopsTried = tries;
  offR(); offB(); offI();
}

// Sprint from spawn to the exit with no enemies. Measures traversal time.
export function* traverse(ctx) {
  const g = ctx.game, P = g.player, R = (ctx.results.traverse = {});
  g.director.enabled = false;
  const ex = g.city.exit.panel;
  const bot = ctx.bot;
  bot.fight = false;
  bot.goTo({ x: ex.x - 1.5, y: ex.y, z: ex.z });
  const t0 = ctx.simTime;
  const start = { ...P.pos };
  let dist = 0, last = { ...P.pos };
  const ok = yield* until(ctx, () => bot.arrived(2.5), 240, () => { dist += Math.hypot(P.pos.x - last.x, P.pos.z - last.z); last = { ...P.pos }; return bot.input(DT); });
  R.reached = ok ? 1 : 0;
  R.time = +(ctx.simTime - t0).toFixed(1);
  R.pathLength = +dist.toFixed(0);
  R.straightLine = +Math.hypot(ex.x - start.x, ex.z - start.z).toFixed(0);
  R.replans = bot.replans;
}

// Full loop: fight your way to the panel, call the train, survive the boss wave, board.
export function* fullRun(ctx, opts = {}) {
  const g = ctx.game, P = g.player, R = (ctx.results.fullRun = {});
  g.director.enabled = true;
  if (opts.god) g.godMode = true;
  const bot = ctx.bot;
  bot.fight = true;
  const ex = g.city.exit;
  let won = false, died = false;
  const offW = g.events.on('win', () => (won = true));
  const offD = g.events.on('playerDeath', () => (died = true));
  let bossSeen = 0;
  const offI = g.events.on('intro', (e) => { if (e.boss) bossSeen = 1; });
  const t0 = ctx.simTime;
  bot.goTo({ x: ex.panel.x - 1.5, y: ex.panel.y, z: ex.panel.z });
  yield* until(ctx, () => bot.arrived(2.2) || died, 300, () => bot.input(DT));
  R.reachedPanel = bot.arrived(2.2) ? 1 : 0;
  R.timeToPanel = +(ctx.simTime - t0).toFixed(1);
  if (R.reachedPanel) {
    bot.face(ex.panel);
    for (let k = 0; k < 10 && g.exit.state === 'idle'; k++) {
      bot.pressed.interact = true;
      ctx.step(bot.input(DT)); yield;
      if (g.exit.state === 'idle') { bot.goTo({ x: ex.panel.x - 1.2, y: ex.panel.y, z: ex.panel.z }); yield* runFor(ctx, 0.3, () => bot.input(DT)); bot.face(ex.panel); }
    }
    R.called = g.exit.state !== 'idle' ? 1 : 0;
    // Hold the pit: kite around the boarding zone while fighting until the train arrives.
    const B = ex.board;
    const spots = [{ x: ex.center.x, y: ex.center.y, z: ex.center.z - 10 }, { x: ex.center.x - 12, y: -4, z: ex.center.z }, { x: ex.center.x, y: ex.center.y, z: ex.center.z + 10 }];
    let k = 0;
    yield* until(ctx, () => g.exit.state === 'arrived' || died, 200, () => {
      if (bot.arrived(2.5) || !bot.path) { bot.goTo(spots[k++ % spots.length]); }
      return bot.input(DT);
    });
    R.trainArrived = g.exit.state !== 'called' && g.exit.state !== 'idle' ? 1 : 0;
    bot.goTo({ x: (B.x0 + B.x1) / 2, y: B.y, z: (B.z0 + B.z1) / 2 });
    yield* until(ctx, () => won || died, 60, () => bot.input(DT));
  }
  R.won = won ? 1 : 0;
  R.died = died ? 1 : 0;
  R.bossSpawned = bossSeen;
  R.bossDefeated = g.boss && !g.boss.alive ? 1 : 0;
  R.kills = g.stats.kills;
  R.time = +(ctx.simTime - t0).toFixed(1);
  R.hpLeft = +P.hp.toFixed(1);
  R.cents = g.economy.cents;
  R.damageTaken = +g.stats.damageTaken.toFixed(0);
  R.dodges = bot.dodges || 0;
  R.maxEnemies = ctx.maxEnemies || 0;
  offW(); offD(); offI();
}

function d2(a, b) {
  const ax = a.x ?? (a.minX + a.maxX) / 2, az = a.z ?? (a.minZ + a.maxZ) / 2;
  return (ax - b.x) ** 2 + (az - b.z) ** 2;
}

export const SCENARIOS = { movement, climb, combat, shopping, traverse, fullRun };
