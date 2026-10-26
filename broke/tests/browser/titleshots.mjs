// The title's attract mode: the splash, then the menu over each shot of the city tour, desktop and phone.
//   CHROME_PATH=... node tests/browser/titleshots.mjs
import { mkdirSync } from 'node:fs';
import { startServer, openGame } from './lib.mjs';

const OUT = new URL('../../shots/title/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const srv = await startServer();
for (const mobile of [false, true]) {
  const tag = mobile ? 'phone' : 'desk';
  const { browser, page, errors } = await openGame(srv.url, 'seed=5', { mobile });
  await page.waitForFunction(() => window.__broke.app.state === 'title' && window.__broke.app.titleCam, null, { timeout: 300000, polling: 500 });
  // Mid-shot (fade cleared), so the frame shows the city rather than the cut to black.
  const at = (i) => page.evaluate((i) => { const T = window.__broke.app.titleCam; T.i = i; T.t = 3.5; T.update(0); }, i);
  await at(0); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}${tag}-splash.png` });
  await page.evaluate(() => document.querySelector('#t-enter').click());
  await page.waitForTimeout(3000); // the menu's entrance
  const n = await page.evaluate(() => window.__broke.app.titleCam.shots.length);
  console.log(tag, 'shots', await page.evaluate(() => window.__broke.app.titleCam.shots.map((s) => s.caption)));
  for (let i = 0; i < n; i++) { await at(i); await page.waitForTimeout(2500); await page.screenshot({ path: `${OUT}${tag}-shot${i}.png` }); }
  console.log(tag, 'errors', errors.filter((e) => !/404/.test(e)));
  await browser.close();
}
srv.stop(); process.exit(0);
