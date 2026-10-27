// The story's opening cutscene ("Inauguration Day"), one frame per shot, held still: shots/story/<nn>-<shot>.png.
//   node tests/browser/storyshots.mjs [seed]
import { mkdirSync } from 'node:fs';
import { startServer, openGame } from './lib.mjs';

const seed = process.argv[2] || '203943';
const OUT = new URL('../../shots/story/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
// Real-time seconds into the scene: one frame from each shot.
const AT = [['card1', 2], ['wide', 8], ['walt', 12.5], ['ots', 18], ['eyes', 23], ['door', 25], ['shot', 27.6], ['low', 33], ['arms', 37], ['card2', 44], ['paper', 49], ['night', 54.5], ['silhouette', 60], ['title', 64]];
const srv = await startServer();
let errs = [];
try {
  const { browser, page, errors } = await openGame(srv.url, `mode=turf&seed=${seed}&story=1&shot=1&quality=high`);
  await page.waitForFunction(() => window.__cutscene?.(), null, { timeout: 300000 });
  await page.evaluate(() => { window.__cutscene().frozen = true; });
  for (const [i, [name, t]] of AT.entries()) {
    await page.evaluate((t) => window.__cutscene()?.seek(t), t);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${OUT}${String(i + 1).padStart(2, '0')}-${name}.png`, timeout: 180000 });
  }
  // Let it finish: play picks up across the street from the White House.
  await page.evaluate(() => { const c = window.__cutscene(); c.frozen = false; c.seek(1e9); });
  await page.waitForFunction(() => window.__broke?.game && !window.__cutscene?.(), null, { timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}15-play.png`, timeout: 180000 });
  errs = errors.filter((e) => !/Pointer Lock|404|user gesture/.test(e));
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
} finally { srv.stop(); }
if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
process.exit(errs.length ? 1 : 0);
