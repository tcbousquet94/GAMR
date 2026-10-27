// The trailer montage (render/montage.js), sampled as it plays: a frame on entering each segment and every few
// seconds of the fight. shots/trailer/<nn>-<segment>.png.   node tests/browser/trailershots.mjs [seed]
import { mkdirSync } from 'node:fs';
import { startServer, openGame } from './lib.mjs';

const seed = process.argv[2] || '203943';
const OUT = new URL('../../shots/trailer/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const srv = await startServer();
let errs = [];
try {
  const { browser, page, errors } = await openGame(srv.url, `mode=turf&seed=${seed}&trailer=1&shot=1&quality=low`, { width: 800, height: 450 });
  await page.waitForFunction(() => window.__montage?.(), null, { timeout: 300000 });
  let n = 0, last = '', lastT = -9;
  for (let i = 0; i < 900; i++) {
    const s = await page.evaluate(() => { const m = window.__montage?.(); return m ? { kind: m.seg?.kind, t: m.t, segT: m.segT, kills: window.__broke.game.arcade?.kills } : null; });
    if (!s) break;
    const midStaged = s.kind !== 'combat' && s.kind !== last && s.segT > 1.2;
    if (midStaged || (s.kind === 'combat' && s.t - lastT > 2.5) || (s.kind === 'boom' && s.segT > 1.2 && last !== 'boom')) {
      n++; last = s.kind; lastT = s.t;
      await page.screenshot({ path: `${OUT}${String(n).padStart(2, '0')}-${s.kind}.png`, timeout: 180000 });
      console.log(n, JSON.stringify(s));
    }
    await page.waitForTimeout(400);
  }
  errs = errors.filter((e) => !/Pointer Lock|404|user gesture/.test(e));
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
} finally { srv.stop(); }
if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
process.exit(errs.length ? 1 : 0);
