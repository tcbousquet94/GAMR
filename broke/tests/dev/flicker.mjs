// Dev check: frame-to-frame flicker with a static camera (and with a tiny camera move), plus a screenshot.
//   node tests/dev/flicker.mjs [seed] [x] [z] [yaw] [label]
import { startServer, openGame } from '../browser/lib.mjs';
const [seed = '1', x = '40', z = '250', yaw = '0', label = 'flick'] = process.argv.slice(2);
const srv = await startServer();
const { browser, page } = await openGame(srv.url, `seed=${seed}&shot=1&quality=high`);
await page.waitForFunction(() => window.__broke?.view?.composer, null, { timeout: 300000 });
await page.waitForTimeout(1500);
await page.evaluate(`__broke.pose({ x: ${x}, y: 0.3, z: ${z}, yaw: ${yaw}, pitch: 0.1 })`);
await page.waitForTimeout(3000);
const grab = () => page.evaluate(() => { const c = document.getElementById('game'); const g = document.createElement('canvas'); g.width = 320; g.height = 180; const x = g.getContext('2d'); x.drawImage(c, 0, 0, 320, 180); return Array.from(x.getImageData(0, 0, 320, 180).data); });
const diff = (a, b) => { let n = 0, s = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); if (d > 24) n++; s += d; } return { changed: n, pct: +(n / (a.length / 4) * 100).toFixed(2) }; };
const a = await grab(); await page.waitForTimeout(400); const b = await grab(); await page.waitForTimeout(400); const c = await grab();
console.log('static', JSON.stringify(diff(a, b)), JSON.stringify(diff(b, c)));
await page.screenshot({ path: `/home/user/GAMR/broke/shots/${label}.png`, timeout: 180000 });
await browser.close(); srv.stop(); process.exit(0);
