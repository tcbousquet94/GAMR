// Path executability probe: the bot walks to random nav-reachable goals with no enemies. Reports success rate and
// where it stalled (position, what it was standing near, the edge it was trying to take). Usage:
//   node tests/city/pathprobe.mjs [seed] [goals]
import { Game } from '../../src/sim/game.js';
import { downtown } from '../../src/city/districts/downtown.js';
import { DEE } from '../../src/sim/survivors/dee.js';
import { NavGraph } from '../../src/city/nav.js';
import { Bot } from '../../src/debug/bot.js';
import { Rng } from '../../src/core/rng.js';
import { DT } from '../../src/core/config.js';

export function probe(seed, goals = 20, { verbose = false, nav = null, game = null, street = false } = {}) {
  const g = game || new Game({ seed, district: downtown, survivor: DEE });
  g.director.enabled = false;
  g.godMode = true;
  nav = nav || new NavGraph(g.world, g.city.size);
  const rng = new Rng(`probe:${seed}`);
  const start = nav.nearest(g.city.spawn.x, 0.2, g.city.spawn.z);
  const seen = nav.reachableFrom(start);
  const pool = [];
  for (let i = 0; i < nav.x.length; i += 7) if (seen[i] && (!street || nav.y[i] < 1)) pool.push(i);
  const fails = [];
  let ok = 0, totalT = 0;
  for (let k = 0; k < goals; k++) {
    const t = pool[Math.floor(rng.next() * pool.length)];
    const goal = { x: nav.x[t], y: nav.y[t], z: nav.z[t] };
    const bot = new Bot(g, nav);
    const from = [g.player.pos.x, g.player.pos.y, g.player.pos.z].map((v) => +v.toFixed(2));
    bot.goTo(goal);
    if (!bot.path) { fails.push({ goal, why: 'nopath', from: { ...g.player.pos } }); continue; }
    const d = Math.hypot(goal.x - g.player.pos.x, goal.z - g.player.pos.z);
    const limit = 20 + d / 4 + Math.abs(goal.y - g.player.pos.y);
    let tt = 0, best = Infinity, bestT = 0, stall = null;
    while (tt < limit) {
      g.step(bot.input(DT)); tt += DT;
      if (bot.arrived(1.5)) break;
      const rem = bot.path ? bot.path.length - bot.i : 1e9;
      if (rem < best) { best = rem; bestT = tt; }
      if (tt - bestT > 6) { // no path progress for 6 s
        const p = g.player.pos;
        const w = bot.path?.[bot.i];
        stall = { at: [p.x, p.y, p.z].map((v) => +v.toFixed(1)), next: w && [w.x, w.y, w.z, w.type], climbing: !!g.player.climbing, onGround: g.player.body.onGround };
        break;
      }
    }
    if (bot.arrived(1.5)) { ok++; totalT += tt; }
    else {
      fails.push({ goal: [goal.x, goal.y, goal.z], from, why: stall ? 'stall' : 'timeout', ...stall });
      // Start the next goal from the spawn so one failure doesn't cascade.
      const s = g.city.spawn;
      Object.assign(g.player.body.pos, { x: s.x, y: 0.2, z: s.z });
      Object.assign(g.player.body.vel, { x: 0, y: 0, z: 0 });
      g.player.climbing = null;
    }
  }
  const res = { seed, goals, ok, rate: +(ok / goals).toFixed(2), avgTime: ok ? +(totalT / ok).toFixed(1) : 0, fails };
  if (verbose) console.log(JSON.stringify(res, null, 1));
  return res;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seed = +(process.argv[2] || 1), n = +(process.argv[3] || 20);
  probe(seed, n, { verbose: true });
}
