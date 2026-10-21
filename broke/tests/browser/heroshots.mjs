// Hero-scene look development: screenshots of the remastered street and a side-by-side with the target image.
//   node tests/browser/heroshots.mjs [round-label] [names,comma,separated]
// Writes shots/hero/<label>/<name>.png and shots/hero/<label>/compare.png (target left, ours right).
import { mkdirSync, readFileSync } from 'node:fs';
import { startServer, openGame } from './lib.mjs';

const label = process.argv[2] || 'latest';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const OUT = new URL(`../../shots/hero/${label}/`, import.meta.url).pathname;
const TARGET = new URL('../../references/target-look.jpeg', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// Each shot: page-side setup run after load. The main one matches the target's camera: behind the player, walking
// north toward the junction with the houses across the avenue.
const SHOTS = {
  hero: `(async () => { const B = __broke, O = 160; B.pose({ x: O - 0.5, y: 0.3, z: O + 1, yaw: 0.12, pitch: -0.12 }); B.hold({ moveZ: 0.45 }); })()`,
  corner: `(async () => { const B = __broke, O = 160; B.pose({ x: O + 4, y: 0.3, z: O - 4, yaw: -0.95, pitch: -0.05 }); })()`,
  house: `(async () => { const B = __broke, O = 160; B.pose({ x: O + 30, y: 0.3, z: O - 26, yaw: -0.25, pitch: 0.05 }); })()`,
  side: `(async () => { const B = __broke, O = 160; B.pose({ x: O + 2, y: 0.3, z: O + 70, yaw: 0.0, pitch: -0.04 }); B.hold({ moveZ: 0.55 }); })()`,
  night: `(async () => { const B = __broke, O = 160; B.pose({ x: O + 1.6, y: 0.3, z: O + 9, yaw: 0, pitch: -0.05 }); B.night(1); })()`,
};

const srv = await startServer();
let errs = [];
try {
  for (const [name, js] of Object.entries(SHOTS)) {
    if (only && !only.includes(name)) continue;
    const { browser, page, errors } = await openGame(srv.url, `scene=hero&shot=1&quality=high`);
    await page.waitForTimeout(1500);
    await page.evaluate(js);
    await page.waitForTimeout(name === 'hero' || name === 'side' ? 1800 : 2500);
    await page.screenshot({ path: `${OUT}${name}.png` });
    const perf = await page.evaluate(() => window.__broke.perf());
    console.log(name, JSON.stringify({ fps: perf.fps, calls: perf.calls, tris: perf.triangles }));
    errs = errs.concat(errors.filter((e) => !/Pointer Lock|404/.test(e)).map((e) => `${name}: ${e}`));
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
  }
  // Side by side: the target on the left, our hero shot on the right, same height.
  if (!only || only.includes('hero')) {
    const { browser, page } = await openGame(srv.url, 'scene=hero&quality=low', { width: 1600, height: 470 });
    const b64 = (p, t) => `data:${t};base64,${readFileSync(p).toString('base64')}`;
    await page.setContent(`<body style="margin:0;background:#111;display:flex;gap:8px"><img src="${b64(TARGET, 'image/jpeg')}" style="height:445px"><img src="${b64(`${OUT}hero.png`, 'image/png')}" style="height:445px"></body>`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}compare.png`, fullPage: true });
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
  }
} finally { srv.stop(); }
if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
process.exit(errs.length ? 1 : 0);
