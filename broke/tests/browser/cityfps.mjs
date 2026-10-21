// 100-seed render sweep: for each seed, start a run in one long-lived page, stand at several viewpoints (spawn
// looking down the avenue, the landmark block, mid-map, the station) and record fps, frame-time p95, draw calls
// and triangles. Under headless SwiftShader fps is CPU-rasterised and far below real GPUs, so the budget checks
// are on draw calls / triangles; fps is recorded for relative comparison between seeds.
//   node tests/browser/cityfps.mjs [count=100] [quality=medium]
// Writes reports/cityfps.json.

import { mkdirSync, writeFileSync } from 'node:fs';
import { startServer, openGame } from './lib.mjs';

const COUNT = +(process.argv[2] || 100);
const QUALITY = process.argv[3] || 'medium';
const BUDGET = { calls: 450, triangles: 2.5e6 };

const srv = await startServer();
const rows = [];
const failures = [];
try {
  const { browser, page, errors } = await openGame(srv.url, `seed=1&bot=1&quality=${QUALITY}`, { width: 960, height: 540 });
  await page.waitForTimeout(1500);
  for (let seed = 1; seed <= COUNT; seed++) {
    const r = await page.evaluate(async (seed) => {
      const B = window.__broke;
      const t0 = performance.now();
      B.start(String(seed));
      const loadMs = performance.now() - t0;
      const g = B.game, c = g.city;
      const lm = c.landmark?.rect;
      const views = {
        spawn: { x: c.spawn.x, z: c.spawn.z, yaw: -Math.PI / 2 },
        landmark: lm ? { x: lm.x0 - 6, z: (lm.z0 + lm.z1) / 2, yaw: -Math.PI / 2, pitch: 0.25 } : null,
        middle: { x: c.size / 2 + 3, z: c.size / 2 + 3, yaw: Math.PI * 0.75 },
        station: { x: c.exit.center.x - 12, z: c.exit.center.z - 12, yaw: -Math.PI * 0.75 },
      };
      const out = { loadMs: Math.round(loadMs) };
      for (const [k, v] of Object.entries(views)) {
        if (!v) continue;
        B.pose({ x: v.x, y: 0.3, z: v.z, yaw: v.yaw, pitch: v.pitch || 0.08 });
        await new Promise((r) => setTimeout(r, 500)); // camera settles
        B.app.perf.frames = []; // measure this viewpoint only
        await new Promise((r) => setTimeout(r, 2000));
        const p = B.perf();
        out[k] = { fps: p.fps, p95Ms: p.p95Ms, calls: p.calls, tris: p.triangles, enemies: p.enemies };
      }
      return out;
    }, seed);
    rows.push({ seed, ...r });
    for (const [k, v] of Object.entries(r)) {
      if (typeof v !== 'object') continue;
      if (v.calls > BUDGET.calls) failures.push(`seed ${seed} ${k}: ${v.calls} draw calls > ${BUDGET.calls}`);
      if (v.tris > BUDGET.triangles) failures.push(`seed ${seed} ${k}: ${v.tris} triangles > ${BUDGET.triangles}`);
    }
    if (seed % 10 === 0) console.log(`seed ${seed}: ${JSON.stringify(r)}`);
  }
  const errs = errors.filter((e) => !/Pointer Lock|404|fonts/.test(e));
  if (errs.length) failures.push(...errs.slice(0, 5).map((e) => `page error: ${e}`));
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
} finally { srv.stop(); }

const stat = (key, view) => {
  const v = rows.map((r) => r[view]?.[key]).filter((x) => x != null).sort((a, b) => a - b);
  return v.length ? { min: v[0], median: v[v.length >> 1], max: v[v.length - 1] } : null;
};
const views = ['spawn', 'landmark', 'middle', 'station'];
const summary = { seeds: rows.length, quality: QUALITY, renderer: 'headless SwiftShader (CPU) — fps is not representative of a GPU', budget: BUDGET, failures };
for (const v of views) summary[v] = { fps: stat('fps', v), calls: stat('calls', v), tris: stat('tris', v) };
summary.loadMs = (() => { const v = rows.map((r) => r.loadMs).sort((a, b) => a - b); return { min: v[0], median: v[v.length >> 1], max: v[v.length - 1] }; })();
mkdirSync(new URL('../../reports/', import.meta.url), { recursive: true });
writeFileSync(new URL('../../reports/cityfps.json', import.meta.url), JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
process.exit(failures.length ? 1 : 0);
