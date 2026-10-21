// City test: generates N seeds (default 100) and checks, per seed:
//  - exit reachable from spawn; % of shops / spawn points / walkable surface reachable
//  - bot sprint time spawn -> exit (target 60-90 s)
//  - interactable counts and per-lot density
//  - at least two routes between any two modules (the region graph has no bridges)
//  - vertical connections: links street<->mid and mid<->roof per lot
// Browser fps per seed comes from tests/browser/cityfps.mjs and is merged in when reports/cityfps.json exists.
// Usage: node tests/city/city100.mjs [count=100] [workers=4]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../', import.meta.url);

async function checkSeed(seed) {
  const { Game } = await import(new URL('src/sim/game.js', ROOT));
  const { downtown } = await import(new URL('src/city/districts/downtown.js', ROOT));
  const { DEE } = await import(new URL('src/sim/survivors/dee.js', ROOT));
  const { NavGraph, regionOf } = await import(new URL('src/city/nav.js', ROOT));
  const { makeCtx, traverse } = await import(new URL('src/debug/scenarios.js', ROOT));
  const t0 = performance.now();
  const g = new Game({ seed, district: downtown, survivor: DEE });
  const genMs = performance.now() - t0;
  const c = g.city;
  const nav = new NavGraph(g.world, c.size);
  const start = nav.nearest(c.spawn.x, 0.2, c.spawn.z);
  const seen = nav.reachableFrom(start);
  let reach = 0;
  for (const v of seen) reach += v;
  const B = c.exit.board;
  const exitNode = nav.nearest((B.x0 + B.x1) / 2, B.y, (B.z0 + B.z1) / 2, 4);
  const panel = c.exit.panel;
  const panelNode = nav.nearest(panel.x - 1.2, panel.y, panel.z, 3);
  const front = (it) => nav.nearest(it.x + Math.sin(it.yaw) * 1.2, it.y, it.z + Math.cos(it.yaw) * 1.2, 2.5);
  const shops = c.interactables;
  const shopReach = shops.filter((it) => { const n = front(it); return n >= 0 && seen[n]; }).length;
  const spawnReach = c.spawnPoints.filter((s) => { const n = nav.nearest(s.x, s.y, s.z, 2); return n >= 0 && seen[n]; }).length;
  const counts = {};
  for (const it of shops) counts[it.type] = (counts[it.type] || 0) + 1;
  // Two routes: region graph from mutual (two-way) nav edges between different regions.
  const region = new Array(nav.x.length);
  for (let i = 0; i < nav.x.length; i++) region[i] = regionOf(c, nav.x[i], nav.z[i]);
  const edgeSet = new Set();
  for (let a = 0; a < nav.x.length; a++) {
    if (!seen[a]) continue;
    const e = nav.adj[a];
    for (let k = 0; k < e.length; k += 3) {
      const b = e[k];
      if (region[a] !== region[b]) edgeSet.add(`${region[a]}|${region[b]}`);
    }
  }
  const und = new Map();
  for (const key of edgeSet) {
    const [ra, rb] = key.split('|');
    if (!edgeSet.has(`${rb}|${ra}`)) continue; // one-way (drop only)
    if (!und.has(ra)) und.set(ra, new Set());
    und.get(ra).add(rb);
  }
  const bridges = findBridges(und).filter(([u, v]) => u.startsWith('lot') || v.startsWith('lot'));
  const lotsWithFewEntries = c.lots.filter((l) => (und.get(`lot${l.id}`)?.size || 0) < 2).map((l) => `${l.id}:${l.type}`);
  // Vertical links.
  const links = c.kit.links;
  const perLot = c.lots.map((l) => links.filter((k) => k.module === l.id && (k.to === 'mid' || k.to === 'roof' || k.from === 'mid')).length);
  const midLinks = links.filter((k) => k.from === 'street' && k.to === 'mid').length;
  const roofLinks = links.filter((k) => k.to === 'roof').length;
  // Traversal with the bot (no enemies).
  const ctx = makeCtx(g, nav);
  for (const _ of traverse(ctx));
  const T = ctx.results.traverse;
  return {
    seed, genMs: +genMs.toFixed(0), size: +c.size.toFixed(0),
    exitReachable: !!(exitNode >= 0 && seen[exitNode] && panelNode >= 0 && seen[panelNode]),
    walkableReach: +(reach / nav.x.length).toFixed(3),
    shops: shops.length, shopReach: +(shopReach / shops.length).toFixed(3), counts,
    spawnPoints: c.spawnPoints.length, spawnReach: +(spawnReach / Math.max(1, c.spawnPoints.length)).toFixed(3),
    perLotShops: +(shops.length / c.lots.length).toFixed(2),
    bridges: bridges.length, lotsWithFewEntries,
    midLinks, roofLinks, minLinksPerLot: Math.min(...perLot),
    traverseReached: T.reached, traverseTime: T.time, traversePath: T.pathLength,
    modules: c.moduleCounts,
  };
}

// Tarjan bridge finding on an undirected adjacency map.
function findBridges(adj) {
  const disc = new Map(), low = new Map(), out = [];
  let t = 0;
  const dfs = (u, parent) => {
    disc.set(u, t); low.set(u, t); t++;
    for (const v of adj.get(u) || []) {
      if (!disc.has(v)) {
        dfs(v, u);
        low.set(u, Math.min(low.get(u), low.get(v)));
        if (low.get(v) > disc.get(u)) out.push([u, v]);
      } else if (v !== parent) low.set(u, Math.min(low.get(u), disc.get(v)));
    }
  };
  for (const u of adj.keys()) if (!disc.has(u)) dfs(u, null);
  return out;
}

if (!isMainThread) {
  for (const seed of workerData.seeds) {
    try { parentPort.postMessage(await checkSeed(seed)); } catch (e) { parentPort.postMessage({ seed, error: String(e.stack || e) }); }
  }
} else {
  const N = +(process.argv[2] || 100), W = +(process.argv[3] || 4);
  const seeds = Array.from({ length: N }, (_, i) => i + 1);
  const results = [];
  const t0 = Date.now();
  await Promise.all(Array.from({ length: W }, (_, w) => new Promise((res) => {
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { seeds: seeds.filter((_, i) => i % W === w) } });
    worker.on('message', (r) => { results.push(r); process.stdout.write(r.error ? 'E' : '.'); });
    worker.on('exit', res);
  })));
  results.sort((a, b) => a.seed - b.seed);
  const fpsFile = new URL('reports/cityfps.json', ROOT);
  const fps = existsSync(fpsFile) ? JSON.parse(readFileSync(fpsFile, 'utf8')) : null;
  if (fps) for (const r of results) { const f = fps.seeds?.find((x) => x.seed === r.seed); if (f) Object.assign(r, { fps: f.fps, drawCalls: f.drawCalls, triangles: f.triangles }); }
  const ok = results.filter((r) => !r.error);
  const fail = (pred) => ok.filter(pred).map((r) => r.seed);
  const stat = (k) => { const v = ok.map((r) => r[k]).filter(Number.isFinite).sort((a, b) => a - b); return v.length ? { min: v[0], median: v[v.length >> 1], max: v[v.length - 1] } : null; };
  const summary = {
    seeds: N, errors: results.filter((r) => r.error).map((r) => ({ seed: r.seed, error: r.error.split('\n')[0] })),
    exitUnreachable: fail((r) => !r.exitReachable),
    traverseFailed: fail((r) => !r.traverseReached),
    traverseOutOfRange: fail((r) => r.traverseReached && (r.traverseTime < 60 || r.traverseTime > 90)),
    shopsUnreachable: fail((r) => r.shopReach < 1),
    bridgeSeeds: fail((r) => r.bridges > 0),
    lotsWithOneEntry: fail((r) => r.lotsWithFewEntries.length > 0),
    lotsWithoutVerticalLinks: fail((r) => r.minLinksPerLot < 1),
    traverseTime: stat('traverseTime'), walkableReach: stat('walkableReach'), shopReach: stat('shopReach'), spawnReach: stat('spawnReach'),
    shops: stat('shops'), spawnPoints: stat('spawnPoints'), midLinks: stat('midLinks'), roofLinks: stat('roofLinks'), genMs: stat('genMs'),
    fps: fps ? stat('fps') : 'run tests/browser/cityfps.mjs', drawCalls: fps ? stat('drawCalls') : null,
    elapsedSec: Math.round((Date.now() - t0) / 1000),
  };
  mkdirSync(new URL('reports/', ROOT), { recursive: true });
  writeFileSync(new URL('reports/city100.json', ROOT), JSON.stringify({ summary, results }, null, 1));
  console.log('\n' + JSON.stringify(summary, null, 1));
  const hard = summary.errors.length + summary.exitUnreachable.length + summary.traverseFailed.length;
  process.exit(hard ? 1 : 0);
}
