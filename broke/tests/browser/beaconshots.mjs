// Beacon, the town hero, for review against references/hero-beacon.jpg: front, back, running and flying.
// Writes shots/beacon/<name>.png.   node tests/browser/beaconshots.mjs
import { mkdirSync } from 'node:fs';
import { startServer, openGame } from './lib.mjs';

const OUT = new URL('../../shots/beacon/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const look = `window.$flyTo = (f, t) => { const dx = t.x - f.x, dy = t.y - f.y, dz = t.z - f.z; __broke.fly(true, { x: f.x, y: f.y, z: f.z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }); };`;
const SHOTS = [
  ['front', `(() => { const P = __broke.game.player, f = P.forward(); $flyTo({ x: P.pos.x + f.x * 3.2 + 0.6, y: P.pos.y + 1.5, z: P.pos.z + f.z * 3.2 }, { x: P.pos.x, y: P.pos.y + 1.1, z: P.pos.z }); })()`],
  ['back', `(() => { const P = __broke.game.player, f = P.forward(); $flyTo({ x: P.pos.x - f.x * 3 + 1, y: P.pos.y + 1.6, z: P.pos.z - f.z * 3 }, { x: P.pos.x, y: P.pos.y + 1.1, z: P.pos.z }); })()`],
  ['run', `(() => { __broke.fly(false); __broke.hold({ moveZ: 1, sprint: true }); })()`],
  ['fly', `(() => { __broke.hold(null); __broke.step(1, { special: true }); __broke.step(150, { moveZ: 1, sprint: true, pitch: 1.0 }); __broke.step(1, { pitch: 0.02 }); __broke.hold({ moveZ: 1, sprint: true }); })()`],
  ['flyside', `(() => { __broke.hold(null); const P = __broke.game.player, r = P.right(), f = P.forward(); $flyTo({ x: P.pos.x + r.x * 5 + f.x * 1.5, y: P.pos.y + 1.2, z: P.pos.z + r.z * 5 + f.z * 1.5 }, { x: P.pos.x, y: P.pos.y + 0.6, z: P.pos.z }); })()`],
];
const srv = await startServer();
let errs = [];
try {
  const { browser, page, errors } = await openGame(srv.url, `shot=1&quality=high`);
  await page.waitForFunction(() => window.__broke?.view?.composer && window.__broke.game?.town, null, { timeout: 300000 });
  await page.waitForTimeout(2500);
  await page.evaluate(look);
  for (const [name, js] of SHOTS) {
    await page.evaluate(js);
    await page.waitForTimeout(name === 'fly' ? 3500 : 2200);
    await page.screenshot({ path: `${OUT}${name}.png`, timeout: 180000 });
    console.log(name, await page.evaluate(() => { const P = __broke.game.player; return { y: +P.pos.y.toFixed(1), flying: P.hero?.flying }; }));
  }
  errs = errors.filter((e) => !/Pointer Lock|404/.test(e));
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
} finally { srv.stop(); }
if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
process.exit(errs.length ? 1 : 0);
