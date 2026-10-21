// Generated city in the kit look, seen from the "h" camera angle: for each seed, stand in the junction at the front-left
// corner of a neighbourhood-module block and look up its front street into the block, exactly as the "h" spawn does.
// Writes shots/kit/<label>/seed<N>.png, then grid.png with "h" first for side-by-side comparison.
//   node tests/browser/kitshots.mjs [label] [seeds,comma,separated]
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { startServer, openGame } from './lib.mjs';

const label = process.argv[2] || 'latest';
const seeds = (process.argv[3] || '1,2,3,4,5').split(',');
const OUT = new URL(`../../shots/kit/${label}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const SETUP = `(() => {
  const B = __broke, c = B.game.city, cells = c.layout.cells;
  const pref = ['crescent', 'culdesac', 'cornerstore', 'alley', 'warehouse'];
  let cell = null;
  for (const m of pref) { cell = cells.find((q) => q.module === m); if (cell) break; }
  const S = c.district.roads.street;
  let front = 's', r;
  if (cell) { r = cell.rect; front = ['s', 'n', 'e', 'w'].find((k) => c.sideOpen(cell, k)) || 's'; }
  else { const h = c.kitData.houses[0]; r = { x0: h.x - 30, z0: h.z - 30, x1: h.x + 30, z1: h.z + 30 }; }
  // Local frame of the front street: u along it (from the front-left corner), v into the block.
  const F = { s: (u, v) => [r.x0 + u, r.z1 - v], n: (u, v) => [r.x1 - u, r.z0 + v], e: (u, v) => [r.x1 - v, r.z1 - u], w: (u, v) => [r.x0 + v, r.z0 + u] }[front];
  const [px, pz] = F(-0.55 * S, -0.6 * S), [tx, tz] = F(30, 14);
  B.pose({ x: px, y: 0.3, z: pz, yaw: Math.atan2(-(tx - px), -(tz - pz)), pitch: -0.12 });
  return { module: cell?.module || 'lots', front };
})()`;

const srv = await startServer();
const errs = [];
try {
  for (const seed of seeds) {
    const { browser, page, errors } = await openGame(srv.url, `seed=${seed}&shot=1&quality=high`);
    await page.waitForFunction(() => window.__broke?.view?.composer, null, { timeout: 300000 });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(SETUP);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}seed${seed}.png`, timeout: 180000 });
    const perf = await page.evaluate(() => window.__broke.perf());
    console.log(`seed ${seed}`, JSON.stringify({ ...info, fps: perf.fps, calls: perf.calls, tris: perf.triangles }));
    errs.push(...errors.filter((e) => !/Pointer Lock|404/.test(e)).map((e) => `seed ${seed}: ${e}`));
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
  }
  // Grid: "h" first, then the seeds.
  const H = new URL('../../shots/hero/latest/hero.png', import.meta.url).pathname;
  const imgs = [existsSync(H) ? ['h (test scene)', H] : null, ...seeds.map((s) => [`seed ${s}`, `${OUT}seed${s}.png`])].filter(Boolean);
  const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
  const { browser, page } = await openGame(srv.url, 'scene=none&quality=low', { width: 1940, height: 1100 });
  await page.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(3,640px);gap:6px;padding:6px;font:600 18px sans-serif;color:#eee">${imgs.map(([t, p]) => `<div><img src="${b64(p)}" style="width:640px;display:block"><div style="padding:3px 0">${t}</div></div>`).join('')}</body>`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}grid.png`, fullPage: true });
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
} finally { srv.stop(); }
if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
process.exit(errs.length ? 1 : 0);
