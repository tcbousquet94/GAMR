// The title: the film-style opening (click to begin, card one, the title card), then the menu over each shot of the
// city tour, desktop and phone.
//   CHROME_PATH=... node tests/browser/titleshots.mjs
import { mkdirSync } from 'node:fs';
import { startServer, openGame } from './lib.mjs';

const OUT = new URL('../../shots/title/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const srv = await startServer();
for (const mobile of [false, true]) {
  const tag = mobile ? 'phone' : 'desk';
  const { browser, page, errors } = await openGame(srv.url, 'seed=5', { mobile });
  page.setDefaultTimeout(180000); // software WebGL makes some frames slow to capture
  await page.waitForFunction(() => window.__broke.app.state === 'title' && window.__broke.app.titleCam, null, { timeout: 300000, polling: 500 });
  // Mid-shot (fade cleared), so the frame shows the city rather than the cut to black.
  const at = (i) => page.evaluate((i) => { const T = window.__broke.app.titleCam; T.i = i; T.t = 3.5; T.update(0); }, i);
  await at(0); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}${tag}-begin.png` });
  // Hold the opening (its timers would end it while slow headless screenshots are taken), then begin.
  await page.evaluate(() => { window.__st = setTimeout; window.setTimeout = (fn, ms, ...a) => (ms > 5000 ? 0 : window.__st(fn, ms, ...a)); });
  await page.evaluate(() => document.querySelector('#t-begin').click());
  await page.evaluate(() => { window.setTimeout = window.__st; });
  // Freeze the opening's timeline at a moment (seconds after the click) and take it.
  const moment = async (s, name) => {
    await page.evaluate((s) => { for (const a of document.querySelector('#t-open').getAnimations({ subtree: true })) { a.currentTime = s * 1000; a.pause(); } }, s);
    await page.screenshot({ path: `${OUT}${tag}-${name}.png`, timeout: 180000 });
  };
  await moment(2.6, 'card1');
  await moment(9, 'card2');
  await page.evaluate(() => document.querySelector('#t-open')?.click()); // skip to the menu (if it hasn't finished already)
  await page.waitForTimeout(3000); // the menu's entrance
  const n = await page.evaluate(() => window.__broke.app.titleCam.shots.length);
  console.log(tag, 'shots', await page.evaluate(() => window.__broke.app.titleCam.shots.map((s) => s.caption)));
  for (let i = 0; i < n; i++) { await at(i); await page.waitForTimeout(2500); await page.screenshot({ path: `${OUT}${tag}-shot${i}.png` }); }
  console.log(tag, 'errors', errors.filter((e) => !/404/.test(e)));
  await browser.close();
}
srv.stop(); process.exit(0);
