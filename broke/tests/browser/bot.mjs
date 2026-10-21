// Bot test: runs the scenario suite (movement, climb, combat, shopping, traverse, full run) and checks the numbers
// against the design targets. By default it runs inside the real game in headless Chromium (rendering, input
// plumbing and all); `--node` runs the same scenarios against the bare sim, which is ~100x faster.
//   node tests/browser/bot.mjs [--node] [--seeds 1,2,3]
// Writes reports/bot.json; exits non-zero if any check fails.

import { mkdirSync, writeFileSync } from 'node:fs';
import { startServer, openGame } from './lib.mjs';

const args = process.argv.slice(2);
const NODE = args.includes('--node');
const seedArg = args[args.indexOf('--seeds') + 1];
const SEEDS = args.includes('--seeds') ? seedArg.split(',').map(Number) : [1, 2, 3];
const NAMES = ['movement', 'climb', 'combat', 'shopping', 'traverse', 'fullRun'];

// [scenario, key, min, max] — targets from DESIGN.md.
const CHECKS = [
  ['movement', 'walkSpeed', 6.5, 8], ['movement', 'sprintSpeed', 9.5, 11.5],
  ['movement', 'jumpHeight', 1.5, 2.1], ['movement', 'doubleJumpHeight', 3, 3.8],
  ['climb', 'onRoof', 1, 1], ['climb', 'backDown', 1, 1],
  ['combat', 'primaryHits', 5, 99], ['combat', 'clipboardBounces', 3, 99], ['combat', 'salsaDistance', 9, 14],
  ['combat', 'salsaDodgedHit', 1, 1], ['combat', 'codeBlueSyringes', 10, 99],
  ['shopping', 'refusedWhenBroke', 1, 1], ['shopping', 'itemsDelivered', 1, 99],
  ['traverse', 'reached', 1, 1], ['traverse', 'time', 60, 90],
  ['fullRun', 'reachedPanel', 1, 1], ['fullRun', 'called', 1, 1], ['fullRun', 'bossSpawned', 1, 1],
  ['fullRun', 'trainArrived', 1, 1], ['fullRun', 'won', 1, 1],
];

async function runNode(seed) {
  const { Game } = await import('../../src/sim/game.js');
  const { downtown } = await import('../../src/city/districts/downtown.js');
  const { DEE } = await import('../../src/sim/survivors/dee.js');
  const { NavGraph } = await import('../../src/city/nav.js');
  const { makeCtx, SCENARIOS } = await import('../../src/debug/scenarios.js');
  const out = {};
  for (const name of NAMES) {
    const g = new Game({ seed, district: downtown, survivor: DEE });
    const ctx = makeCtx(g, new NavGraph(g.world, g.city.size));
    // The full run is a loop check (does every stage happen?), so the bot is invulnerable; balance is for humans.
    for (const _ of SCENARIOS[name](ctx, { god: true })) { /* run flat out */ }
    out[name] = ctx.results[name];
  }
  return out;
}

async function runBrowser(srv, seed) {
  const out = {};
  for (const name of NAMES) {
    const { browser, page, errors } = await openGame(srv.url, `mode=turf&seed=${seed}&bot=1&quality=low`);
    try {
      await page.waitForTimeout(800);
      out[name] = await page.evaluate(async ([n]) => {
        await new Promise((r) => setTimeout(r, 200));
        const res = await window.__broke.run(n, { stepsPerFrame: 12, opts: { god: true } });
        return { ...res[n], fps: window.__broke.perf().fps };
      }, [name]);
      out[name].pageErrors = errors.filter((e) => !/Pointer Lock|404|fonts/.test(e)).length;
    } finally {
      await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
    }
  }
  return out;
}

const report = { mode: NODE ? 'node' : 'browser', seeds: {}, failures: [] };
const srv = NODE ? null : await startServer();
try {
  for (const seed of SEEDS) {
    const t = Date.now();
    const r = NODE ? await runNode(seed) : await runBrowser(srv, seed);
    report.seeds[seed] = r;
    for (const [sc, key, lo, hi] of CHECKS) {
      const v = r[sc]?.[key];
      if (!(v >= lo && v <= hi)) report.failures.push(`seed ${seed} ${sc}.${key} = ${v} (want ${lo}..${hi})`);
    }
    for (const sc of NAMES) if (r[sc]?.pageErrors) report.failures.push(`seed ${seed} ${sc}: ${r[sc].pageErrors} page errors`);
    console.log(`seed ${seed} (${((Date.now() - t) / 1000).toFixed(0)}s)`);
    for (const sc of NAMES) console.log(`  ${sc.padEnd(9)} ${JSON.stringify(r[sc])}`);
  }
} finally { srv?.stop(); }
mkdirSync(new URL('../../reports/', import.meta.url), { recursive: true });
writeFileSync(new URL('../../reports/bot.json', import.meta.url), JSON.stringify(report, null, 1));
console.log(report.failures.length ? `FAIL\n  ${report.failures.join('\n  ')}` : 'PASS: all bot checks within targets');
process.exit(report.failures.length ? 1 : 0);
