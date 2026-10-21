// Screenshots of the handcrafted town map (default mode): the spawn in front of City Hall, the hero base, the police
// station, and an aerial view of the whole town. Writes shots/town/<name>.png.
//   node tests/browser/townshots.mjs [map]
import { mkdirSync } from 'node:fs';
import { startServer, openGame } from './lib.mjs';

const map = process.argv[2] || 'palmetto';
const OUT = new URL('../../shots/town/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const HELPERS = `
  window.$look = (from, to) => { const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z; return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }; };
  window.$flyTo = (from, to) => { const a = $look(from, to); __broke.fly(true, { x: from.x, y: from.y, z: from.z, yaw: a.yaw, pitch: a.pitch }); };
  window.$place = (role) => __broke.game.town.places.find((p) => p.role === role);
`;
const SHOTS = {
  spawn: `(() => { const s = __broke.game.city.spawn, h = $place('cityHall'); __broke.pose({ x: s.x, y: 0.3, z: s.z, yaw: Math.atan2(-(h.x - s.x), -(h.z - s.z)), pitch: 0.1 }); })()`,
  hall: `(() => { const h = $place('cityHall'); $flyTo({ x: h.x + 30, y: 22, z: h.z + 45 }, { x: h.x, y: 4, z: h.z }); })()`,
  lighthouse: `(() => { const h = $place('heroBase'); $flyTo({ x: h.x + 35, y: 26, z: h.z + 40 }, { x: h.x, y: 3, z: h.z }); })()`,
  police: `(() => { const h = $place('police'); $flyTo({ x: h.x - 30, y: 20, z: h.z + 40 }, { x: h.x, y: 3, z: h.z }); })()`,
  aerial: `(() => { const b = __broke.game.city.bounds; $flyTo({ x: b.x0 - 60, y: 260, z: b.z1 + 60 }, { x: (b.x0 + b.x1) / 2, y: 0, z: (b.z0 + b.z1) / 2 }); })()`,
};

const srv = await startServer();
const errs = [];
try {
  const { browser, page, errors } = await openGame(srv.url, `map=${map}&shot=1&quality=high`);
  await page.waitForFunction(() => window.__broke?.view?.composer && window.__broke.game?.town, null, { timeout: 300000 });
  await page.waitForTimeout(2000);
  await page.evaluate(HELPERS);
  console.log('objective', await page.evaluate(() => window.__broke.game.objective()));
  for (const [name, js] of Object.entries(SHOTS)) {
    await page.evaluate(js);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}${name}.png`, timeout: 180000 });
    const perf = await page.evaluate(() => window.__broke.perf());
    console.log(name, JSON.stringify({ fps: perf.fps, calls: perf.calls, tris: perf.triangles }));
  }
  errs.push(...errors.filter((e) => !/Pointer Lock|404/.test(e)));
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
} finally { srv.stop(); }
if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
process.exit(errs.length ? 1 : 0);
