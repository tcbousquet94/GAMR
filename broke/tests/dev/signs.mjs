// Dev check: look at the first business sign up close and report the sign mesh state.
import { startServer, openGame } from '../browser/lib.mjs';
const q = process.argv[2] || 'high';
const srv = await startServer();
const { browser, page } = await openGame(srv.url, `seed=1&shot=1&quality=${q}`);
await page.waitForFunction(() => window.__broke?.view?.composer, null, { timeout: 300000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const B = __broke, b = B.game.turf.businesses[0], d = { x: b.door.x - b.doorInside.x, z: b.door.z - b.doorInside.z }, l = Math.hypot(d.x, d.z);
  const px = b.door.x + d.x / l * 12, pz = b.door.z + d.z / l * 12;
  B.pose({ x: px, y: 0.3, z: pz, yaw: Math.atan2(-(b.door.x - px), -(b.door.z - pz)), pitch: 0.15 });
  const s = B.view.cityMesh.signs;
  return { name: b.name, visible: s.mesh?.visible, n: s.mesh?.geometry.index.count / 6, map: !!s.material.map, mt: s.material.type, inScene: !!s.mesh?.parent };
});
await page.waitForTimeout(3000);
await page.screenshot({ path: `/home/user/GAMR/broke/shots/signs-${q}.png`, timeout: 180000 });
console.log(JSON.stringify(info));
await browser.close(); srv.stop(); process.exit(0);
