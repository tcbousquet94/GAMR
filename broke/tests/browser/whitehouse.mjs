// The White House (the first civic block): front from the plaza, a three-quarter view, and an aerial, in the turf war
// (a generated seed) and on the Palmetto Bay town map. Writes shots/whitehouse/<mode>-<view>.png.
//   node tests/browser/whitehouse.mjs [turfSeed]
import { mkdirSync } from 'node:fs';
import { startServer, openGame } from './lib.mjs';

const seed = process.argv[2] || '203943';
const OUT = new URL('../../shots/whitehouse/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const look = `window.$flyTo = (f, t) => { const dx = t.x - f.x, dy = t.y - f.y, dz = t.z - f.z; __broke.fly(true, { x: f.x, y: f.y, z: f.z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }); };`;
// The building's front faces -z; c.z is its centre (13 m from the front for the 26 m-deep version).
const VIEWS = {
  front: `(() => { const c = __broke.game.city.civic; $flyTo({ x: c.x, y: 1.7, z: c.z - 42 }, { x: c.x, y: 8, z: c.z }); })()`,
  three: `(() => { const c = __broke.game.city.civic; $flyTo({ x: c.x - 34, y: 6, z: c.z - 38 }, { x: c.x, y: 7, z: c.z }); })()`,
  aerial: `(() => { const c = __broke.game.city.civic; $flyTo({ x: c.x + 45, y: 40, z: c.z - 55 }, { x: c.x, y: 4, z: c.z }); })()`,
};
const srv = await startServer();
let errs = [];
try {
  for (const [mode, q] of [['turf', `mode=turf&seed=${seed}`], ['town', 'mode=town']]) {
    const { browser, page, errors } = await openGame(srv.url, `${q}&shot=1&quality=high`);
    await page.waitForFunction(() => window.__broke?.view?.composer && window.__broke.game?.city?.civic, null, { timeout: 300000 });
    await page.waitForTimeout(2000);
    await page.evaluate(look);
    for (const [v, js] of Object.entries(VIEWS)) {
      await page.evaluate(js);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${OUT}${mode}-${v}.png`, timeout: 180000 });
    }
    console.log(mode, await page.evaluate(() => JSON.stringify(__broke.game.city.civic)));
    errs.push(...errors.filter((e) => !/Pointer Lock|404/.test(e)).map((e) => `${mode}: ${e}`));
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
  }
} finally { srv.stop(); }
if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
process.exit(errs.length ? 1 : 0);
