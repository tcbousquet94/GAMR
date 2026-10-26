// Street fights in the browser: start a run, fast-forward into wave 1, look at the crew and the HUD, pick up a
// power-up, then go down and check the game-over screen and the board.
//   CHROME_PATH=... node tests/browser/arcadeshots.mjs
import { mkdirSync } from 'node:fs';
import { startServer, openGame } from './lib.mjs';

const OUT = new URL('../../shots/arcade/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const srv = await startServer();
const { browser, page, errors } = await openGame(srv.url, 'seed=5');
await page.waitForFunction(() => window.__broke.app.state === 'title', null, { timeout: 300000, polling: 500 });
await page.evaluate(() => document.querySelector('#s-start').click());
await page.waitForFunction(() => window.__broke.app.state === 'playing' && window.__broke.game.arcade, null, { timeout: 300000, polling: 500 });
// Fast-forward the sim into the first wave (the page itself runs about one frame a second headless).
const ff = (s) => page.evaluate((s) => { const g = window.__broke.game; g.godMode = true; for (let i = 0; i < s * 60; i++) g.step({ moveX: 0, moveZ: 0, yaw: g.player.yaw, pitch: 0 }); }, s);
await ff(16);
// Face the nearest Viper.
await page.evaluate(() => {
  const g = window.__broke.game, P = g.player.pos;
  const e = g.enemies.filter((q) => q.alive).sort((a, b) => Math.hypot(a.pos.x - P.x, a.pos.z - P.z) - Math.hypot(b.pos.x - P.x, b.pos.z - P.z))[0];
  if (e) window.__broke.pose({ x: P.x, y: P.y, z: P.z, yaw: Math.atan2(-(e.pos.x - P.x), -(e.pos.z - P.z)), pitch: 0.05 });
  g.arcade.grant('double'); g.arcade.grant('rapid');
  g.pickups.spawnPower({ x: P.x - Math.sin(g.player.yaw) * 4, y: P.y + 0.6, z: P.z - Math.cos(g.player.yaw) * 4 }, 'score');
  g.arcade.score = 4280; g.arcade.combo = { n: 4, t: 3 };
});
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}fight.png` });
const state = await page.evaluate(() => { const g = window.__broke.game; return { wave: g.arcade.wave, alive: g.enemies.filter((e) => e.alive).map((e) => e.type), hp: Math.round(g.player.hp) }; });
console.log('state', JSON.stringify(state));
// Go down.
await page.evaluate(() => { const g = window.__broke.game; g.godMode = false; g.combat.hurtPlayer(g.player, 9999, { source: 'test' }); });
await page.waitForFunction(() => document.querySelector('.panel.over'), null, { timeout: 120000, polling: 500 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}over.png` });
console.log('board', await page.evaluate(() => document.querySelector('#o-board').textContent));
await page.evaluate(() => { document.querySelector('#o-tag').value = 'Lou'; document.querySelector('#o-send').click(); });
await page.waitForTimeout(800);
console.log('status', await page.evaluate(() => document.querySelector('#o-status').textContent));
console.log('errors', errors);
await browser.close(); srv.stop?.(); srv.proc?.kill?.(); process.exit(0);
