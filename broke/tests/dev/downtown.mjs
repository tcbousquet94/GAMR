// Dev check: three street-level views up into the downtown core (variety of towers and blocks).
import { startServer, openGame } from '../browser/lib.mjs';
const seed = process.argv[2] || '1', label = process.argv[3] || 'dt';
const srv = await startServer();
const { browser, page } = await openGame(srv.url, `seed=${seed}&shot=1&quality=high`);
await page.waitForFunction(() => window.__broke?.view?.composer, null, { timeout: 300000 });
await page.waitForTimeout(1500);
for (let i = 0; i < 3; i++) {
  await page.evaluate(`(() => { const B = __broke, D = B.game.city.kitData, list = [...D.towers.filter((q) => !q.far), ...D.blocks];
    const t = list[Math.floor(list.length * ${i} / 3)], px = t.x + Math.sin(t.yaw) * 30 + Math.cos(t.yaw) * 10, pz = t.z + Math.cos(t.yaw) * 30 - Math.sin(t.yaw) * 10;
    B.pose({ x: px, y: 0.3, z: pz, yaw: Math.atan2(-(t.x - px), -(t.z - pz)), pitch: 0.3 }); })()`);
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `/home/user/GAMR/broke/shots/${label}-${i}.png`, timeout: 180000 });
}
await browser.close(); srv.stop(); process.exit(0);
