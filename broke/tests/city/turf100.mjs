// Turf-war map test: generates N seeds (default 100) and checks, per seed:
//  Map (Part 1)
//  - generation succeeds; deterministic (same seed -> same strategy data)
//  - every business reachable on foot from every other (two-way reachability through the spawn)
//  - block adjacency connected; territory adjacency connected; warehouse blocks hold one warehouse; other blocks
//    hold businesses (unclaimed blocks counted)
//  - both HQs exist and are far apart
//  - every business: >= 2 reachable approach points and a reachable roof
//  - landmark visible from most street positions (raycast samples, percentage)
//  - no buildings over roads or the diagonal, nothing floating, doors / alleys / gates clear
//  - navigation covers streets, alleys, interiors and roofs
//  Warehouses
//  - >= 2 staging areas on different sides, all reachable; every breach point reachable
//  - every business linked to exactly one warehouse, within a reasonable walk
//  - the safe reachable from every breach point; defenders reach every post (container tops, catwalk, office ...)
// Usage: node tests/city/turf100.mjs [count=100] [workers=4]   -> reports/turf100.json
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../', import.meta.url);
const WALK_MAX = 450; // metres, warehouse gate -> linked business door
const TAG = { BUILDING: 2, PROP: 4 };

async function checkSeed(seed) {
  const { generateTurf } = await import(new URL('src/city/turf/generate.js', ROOT));
  const { DOWNTOWN } = await import(new URL('src/city/turf/districts/downtown.js', ROOT));
  const { NavGraph } = await import(new URL('src/city/nav.js', ROOT));
  const t0 = performance.now();
  const city = generateTurf(DOWNTOWN, seed);
  const genMs = performance.now() - t0;
  const T = city.turf, world = city.world;
  const again = generateTurf(DOWNTOWN, seed).turf;
  const deterministic = JSON.stringify(again) === JSON.stringify(T);
  const nav = new NavGraph(world, city.size);
  const N = nav.x.length;
  // Reverse adjacency for "can get back" reachability.
  const radj = Array.from({ length: N }, () => []);
  for (let a = 0; a < N; a++) { const e = nav.adj[a]; for (let i = 0; i < e.length; i += 3) radj[e[i]].push(a); }
  const reach = (start, rev = false) => {
    const seen = new Uint8Array(N);
    if (start < 0) return seen;
    const q = [start]; seen[start] = 1;
    while (q.length) { const a = q.pop(); if (rev) { for (const b of radj[a]) if (!seen[b]) { seen[b] = 1; q.push(b); } } else { const e = nav.adj[a]; for (let i = 0; i < e.length; i += 3) if (!seen[e[i]]) { seen[e[i]] = 1; q.push(e[i]); } } }
    return seen;
  };
  const node = (p, r = 2.5) => nav.nearest(p.x, p.y ?? 0.15, p.z, r);
  const start = node(city.spawn);
  const fwd = reach(start), back = reach(start, true);
  const both = (p, r) => { const n = node(p, r); return n >= 0 && fwd[n] && back[n]; };

  // --- businesses: mutual reachability, approach points, roofs ---
  const bizReach = T.businesses.filter((b) => both(b.doorInside) && both(b.door)).length;
  const approachOk = T.businesses.filter((b) => b.approach.filter((p) => both(p, 3)).length >= 2).length;
  const roofOk = T.businesses.filter((b) => both(b.roof, 2)).length;
  // --- graph structure ---
  const connected = (items, adjOf) => { if (!items.length) return true; const seen = new Set([items[0].id]); const q = [items[0]]; while (q.length) { const a = q.pop(); for (const n of adjOf(a)) if (!seen.has(n)) { seen.add(n); q.push(items.find((x) => x.id === n)); } } return seen.size === items.length; };
  const blocksConnected = connected(T.blocks, (b) => b.adjacent);
  const territoriesConnected = connected(T.territories, (t) => t.adjacent);
  const whBlocksOk = T.blocks.filter((b) => b.warehouse != null).every((b) => T.warehouses.filter((w) => w.block === b.id).length === 1);
  const unclaimed = T.blocks.filter((b) => b.warehouse == null && !b.businesses.length).length;
  // --- HQs ---
  const hqs = T.warehouses.filter((w) => w.hq != null);
  const hqDist = hqs.length === 2 ? Math.hypot(hqs[0].safe.x - hqs[1].safe.x, hqs[0].safe.z - hqs[1].safe.z) : 0;
  const hqFar = hqs.length === 2 && hqDist >= city.size * 0.4;
  const dinersOk = hqs.every((w) => T.businesses.some((b) => b.warehouse === w.id && b.type === 'diner'));
  // --- landmark visibility ---
  const L = T.landmarks[0];
  const targets = [L.height * 0.7, L.height, L.top - 4].map((y) => ({ x: L.x, y, z: L.z }));
  let seenN = 0, samples = 0;
  for (const s of T.roads.segments.filter((q) => q.open)) {
    const r = s.rect, alongX = s.axis === 'h';
    const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
    for (let t = 4; t < len - 2; t += 8) for (const off of [0.25, 0.5, 0.75]) {
      const x = alongX ? r.x0 + t : r.x0 + (r.x1 - r.x0) * off, z = alongX ? r.z0 + (r.z1 - r.z0) * off : r.z0 + t;
      samples++;
      if (targets.some((q) => world.segmentClear({ x, y: 1.7, z }, q))) seenN++;
    }
  }
  const landmarkVisible = seenN / samples;
  // --- overlaps / floating ---
  const roadRects = [...T.roads.segments.filter((s) => s.open).map((s) => s.rect), ...T.roads.intersections.map((I) => I.rect)];
  const ov = (a, b, m = 0.25) => a.minX < b.x1 - m && a.maxX > b.x0 + m && a.minZ < b.z1 - m && a.maxZ > b.z0 + m;
  const solids = world.solids.items;
  const overRoad = solids.filter((s) => (s.tag & TAG.BUILDING) && s.maxY > 1 && roadRects.some((r) => ov(s, r))).length;
  const D = T.roads.diagonal;
  const dd = (x, z) => { const dx = D.bx - D.ax, dz = D.bz - D.az, L2 = dx * dx + dz * dz; const t = Math.max(0, Math.min(1, ((x - D.ax) * dx + (z - D.az) * dz) / L2)); return Math.hypot(x - (D.ax + dx * t), z - (D.az + dz * t)); };
  const overDiag = solids.filter((s) => (s.tag & TAG.BUILDING) && s.maxY > 1 && dd((s.minX + s.maxX) / 2, (s.minZ + s.maxZ) / 2) < D.width / 2 - 1).length;
  const sites = [...T.businesses.map((b) => b.footprint), ...T.warehouses.map((w) => w.footprint)];
  const inSite = (s) => sites.some((f) => s.minX >= f.x0 - 1 && s.maxX <= f.x1 + 1 && s.minZ >= f.z0 - 1 && s.maxZ <= f.z1 + 1);
  const floating = solids.filter((s) => (s.tag & TAG.PROP) && s.minY > 0.35 && s.maxY - s.minY < 6 && !inSite(s) && !solids.some((o) => o !== s && Math.abs(o.maxY - s.minY) < 0.08 && o.minX < s.maxX && o.maxX > s.minX && o.minZ < s.maxZ && o.maxZ > s.minZ)).length;
  // --- doors, alleys, gates clear (a body fits and it's reachable) ---
  const fitsAt = (p) => { const n = node(p, 2); return n >= 0 && world.fits(nav.x[n], nav.y[n] + 0.05, nav.z[n], 0.35, 1.7); };
  const doorPts = [];
  for (const b of T.businesses) doorPts.push(b.door, b.doorInside, b.backDoor, ...b.approach.filter((p) => p.kind !== 'street'));
  for (const w of T.warehouses) {
    const g = { x: (w.gate.x0 + w.gate.x1) / 2, y: 0.15, z: (w.gate.z0 + w.gate.z1) / 2 };
    doorPts.push(g, w.sideDoor.outside, w.sideDoor.inside, ...w.docks.flatMap((d) => [d.outside, d.inside]));
  }
  const doorsBlocked = doorPts.filter((p) => !(fitsAt(p) && both(p, 2.5))).length;
  // --- nav coverage by category ---
  const cov = (pts, r) => pts.length ? pts.filter((p) => both(p, r)).length / pts.length : 1;
  const streetPts = T.roads.segments.filter((s) => s.open).map((s) => ({ x: (s.rect.x0 + s.rect.x1) / 2, y: 0, z: (s.rect.z0 + s.rect.z1) / 2 }));
  const coverage = {
    streets: cov(streetPts, 3),
    alleys: cov(T.businesses.flatMap((b) => b.approach.filter((p) => p.kind !== 'street')), 2.5),
    interiors: cov([...T.businesses.map((b) => b.doorInside), ...T.warehouses.flatMap((w) => [w.docks[1].inside, w.office])], 2),
    roofs: cov([...T.businesses.map((b) => b.roof), ...T.warehouses.map((w) => w.roof)], 2),
  };
  // --- warehouses: staging, breach, links, safe, posts ---
  const wh = T.warehouses.map((w) => {
    const sides = new Set(w.staging.map((s) => s.side));
    const stagingOk = w.staging.length >= 2 && sides.size >= 2 && w.staging.every((s) => both(s, 3));
    const safeNode = node({ x: w.safe.x, y: w.safe.y - 1.3, z: w.safe.z }, 2.5);
    const toSafe = reach(safeNode, true), fromSafe = reach(safeNode);
    const breachUnreachable = w.breach.filter((p) => !both(p, 3)).map((p) => p.kind);
    const breachNoSafe = w.breach.filter((p) => { const n = node(p, 3); return !(n >= 0 && toSafe[n]); }).map((p) => p.kind);
    const postsUnreachable = w.defenderPosts.filter((p) => { const n = node(p, 2); return !(n >= 0 && fromSafe[n]); }).map((p) => p.kind);
    const g = { x: (w.gate.x0 + w.gate.x1) / 2, y: 0.15, z: (w.gate.z0 + w.gate.z1) / 2 };
    const walks = w.businesses.map((id) => { const p = nav.path(node(g), node(T.businesses[id].door), 600000); return p ? Math.round(p.reduce((s, q, i) => s + (i ? Math.hypot(q.x - p[i - 1].x, q.z - p[i - 1].z) : 0), 0)) : Infinity; });
    return { id: w.id, hq: w.hq, businesses: w.businesses.length, staging: w.staging.length, stagingOk, breach: w.breach.length, breachUnreachable, breachNoSafe, posts: w.defenderPosts.length, postsUnreachable, safeReached: safeNode >= 0 && fwd[safeNode] === 1, walks };
  });
  const linkCounts = T.businesses.map((b) => T.warehouses.filter((w) => w.businesses.includes(b.id)).length);
  return {
    seed, genMs: Math.round(genMs), deterministic, size: [T.size.x, T.size.z], blocks: T.blocks.length, warehouses: T.warehouses.length, businesses: T.businesses.length,
    bizMutual: bizReach / T.businesses.length, approachOk: approachOk / T.businesses.length, roofOk: roofOk / T.businesses.length,
    blocksConnected, territoriesConnected, whBlocksOk, unclaimed, hqs: hqs.length, hqDist: Math.round(hqDist), hqFar, dinersOk,
    landmarkVisible: +landmarkVisible.toFixed(3), overRoad, overDiag, floating, doorsBlocked, coverage,
    linksOk: linkCounts.every((n) => n === 1), whLinksPerWarehouse: wh.map((w) => w.businesses), maxWalk: Math.max(...wh.flatMap((w) => w.walks)),
    wh, cover: T.cover.length, climbs: T.climbs.length,
  };
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
  const ok = results.filter((r) => !r.error);
  const fail = (pred) => ok.filter(pred).map((r) => r.seed);
  const stat = (f) => { const v = ok.map(f).filter(Number.isFinite).sort((a, b) => a - b); return v.length ? { min: v[0], median: v[v.length >> 1], max: v[v.length - 1] } : null; };
  const whAll = ok.flatMap((r) => r.wh.map((w) => ({ ...w, seed: r.seed })));
  const summary = {
    seeds: N,
    errors: results.filter((r) => r.error).map((r) => ({ seed: r.seed, error: r.error.split('\n')[0] })),
    nonDeterministic: fail((r) => !r.deterministic),
    businessesNotMutuallyReachable: fail((r) => r.bizMutual < 1),
    businessesWithFewerThan2Approaches: fail((r) => r.approachOk < 1),
    businessRoofUnreachable: fail((r) => r.roofOk < 1),
    blockGraphDisconnected: fail((r) => !r.blocksConnected),
    territoryGraphDisconnected: fail((r) => !r.territoriesConnected),
    warehouseBlockProblems: fail((r) => !r.whBlocksOk),
    hqProblems: fail((r) => r.hqs !== 2 || !r.hqFar || !r.dinersOk),
    buildingsOverRoads: fail((r) => r.overRoad > 0),
    buildingsOverDiagonal: fail((r) => r.overDiag > 0),
    floatingProps: fail((r) => r.floating > 0),
    doorsOrAlleysBlocked: fail((r) => r.doorsBlocked > 0),
    navCoverageGaps: fail((r) => Object.values(r.coverage).some((v) => v < 1)),
    businessLinkProblems: fail((r) => !r.linksOk),
    walkTooFar: fail((r) => r.maxWalk > WALK_MAX),
    stagingProblems: [...new Set(whAll.filter((w) => !w.stagingOk).map((w) => w.seed))],
    breachUnreachable: [...new Set(whAll.filter((w) => w.breachUnreachable.length).map((w) => `${w.seed}:${w.breachUnreachable.join('/')}`))],
    safeNotReachableFromBreach: [...new Set(whAll.filter((w) => w.breachNoSafe.length).map((w) => `${w.seed}:${w.breachNoSafe.join('/')}`))],
    postsUnreachable: [...new Set(whAll.filter((w) => w.postsUnreachable.length).map((w) => `${w.seed}:${w.postsUnreachable.join('/')}`))],
    landmarkVisible: stat((r) => r.landmarkVisible),
    warehouses: stat((r) => r.warehouses), businesses: stat((r) => r.businesses), blocks: stat((r) => r.blocks), unclaimedBlocks: stat((r) => r.unclaimed),
    businessesPerWarehouse: stat((r) => Math.max(...r.whLinksPerWarehouse)), minBusinessesPerWarehouse: stat((r) => Math.min(...r.whLinksPerWarehouse)),
    hqDistance: stat((r) => r.hqDist), maxWalk: stat((r) => r.maxWalk),
    staging: stat((r) => Math.min(...r.wh.map((w) => w.staging))), breachPoints: stat((r) => Math.min(...r.wh.map((w) => w.breach))), defenderPosts: stat((r) => Math.min(...r.wh.map((w) => w.posts))),
    coverPoints: stat((r) => r.cover), climbPoints: stat((r) => r.climbs), genMs: stat((r) => r.genMs),
    elapsedSec: Math.round((Date.now() - t0) / 1000),
  };
  mkdirSync(new URL('reports/', ROOT), { recursive: true });
  writeFileSync(new URL('reports/turf100.json', ROOT), JSON.stringify({ summary, results }, null, 1));
  console.log('\n' + JSON.stringify(summary, null, 1));
  const failures = Object.entries(summary).filter(([, v]) => Array.isArray(v) && v.length).map(([k]) => k);
  process.exit(failures.length ? 1 : 0);
}
