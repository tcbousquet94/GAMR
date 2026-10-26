// The title: the film-style opening (click to begin, the studio card, the production credit, the title card), then the menu over each shot of the
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
  // Hold the opening: drop its own timers (the 3 s auto-start, the title's boom, the menu's arrival), so it waits for
  // the click below and stays put while slow headless screenshots are taken. Reload so this runs before the page.
  await page.addInitScript(() => { const st = window.setTimeout; window.setTimeout = (fn, ms, ...a) => ([3000, 10400, 14400].includes(ms) ? 0 : st(fn, ms, ...a)); });
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => window.__broke?.game, null, { timeout: 300000, polling: 500 });
  await page.waitForFunction(() => window.__broke.app.state === 'title' && window.__broke.app.titleCam, null, { timeout: 300000, polling: 500 });
  // Mid-shot (fade cleared), so the frame shows the city rather than the cut to black.
  const at = (i) => page.evaluate((i) => { const T = window.__broke.app.titleCam; T.i = i; T.t = 3.5; T.update(0); }, i);
  await at(0); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}${tag}-begin.png` });
  await page.evaluate(() => document.querySelector('#t-begin').click());
  // Freeze the opening's timeline at a moment (seconds after the click) and take it.
  const moment = async (s, name) => {
    await page.evaluate((s) => { for (const a of document.querySelector('#t-open').getAnimations({ subtree: true })) { a.currentTime = s * 1000; a.pause(); } }, s);
    await page.screenshot({ path: `${OUT}${tag}-${name}.png`, timeout: 180000 });
  };
  await moment(3.2, 'studio');
  await moment(6.4, 'card1');
  await moment(12.8, 'card2');
  await page.evaluate(() => document.querySelector('#t-open')?.click()); // the first click turns the sound on...
  await page.evaluate(() => document.querySelector('#t-open')?.click()); // ...the second skips to the menu
  await page.waitForTimeout(3000); // the menu's entrance
  const n = await page.evaluate(() => window.__broke.app.titleCam.shots.length);
  console.log(tag, 'shots', await page.evaluate(() => window.__broke.app.titleCam.shots.map((s) => s.caption)));
  for (let i = 0; i < n; i++) { await at(i); await page.waitForTimeout(2500); await page.screenshot({ path: `${OUT}${tag}-shot${i}.png` }); }
  console.log(tag, 'errors', errors.filter((e) => !/404/.test(e)));
  await browser.close();
}
srv.stop(); process.exit(0);
