// Dev check after the lighting fixes: a business sign up close, inside a laundromat (or any shop), the warehouse-edge
// street, and frame-to-frame change with a still camera.
import { startServer, openGame } from '../browser/lib.mjs';
const seed = process.argv[2] || '1', label = process.argv[3] || 'fix';
const srv = await startServer();
const { browser, page } = await openGame(srv.url, `seed=${seed}&shot=1&quality=high`);
await page.waitForFunction(() => window.__broke?.view?.composer, null, { timeout: 300000 });
await page.waitForTimeout(1500);
const views = {
  sign: `(() => { const B = __broke, b = B.game.turf.businesses[0], d = { x: b.door.x - b.doorInside.x, z: b.door.z - b.doorInside.z }, l = Math.hypot(d.x, d.z);
    const px = b.door.x + d.x / l * 12, pz = b.door.z + d.z / l * 12; B.pose({ x: px, y: 0.3, z: pz, yaw: Math.atan2(-(b.door.x - px), -(b.door.z - pz)), pitch: 0.15 }); return b.name; })()`,
  inside: `(() => { const B = __broke, T = B.game.turf.businesses, b = T.find((q) => q.type === 'laundromat') || T.find((q) => q.type === 'boxing') || T[0];
    const d = { x: b.doorInside.x - b.door.x, z: b.doorInside.z - b.door.z }, l = Math.hypot(d.x, d.z);
    const px = b.doorInside.x + d.x / l * 1.5, pz = b.doorInside.z + d.z / l * 1.5; B.pose({ x: px, y: 0.3, z: pz, yaw: Math.atan2(-d.x, -d.z), pitch: -0.1 }); B.view.rig.dist = 2.2; return b.type + ':' + b.name; })()`,
  edge: `(() => { __broke.pose({ x: 42, y: 0.3, z: 250, yaw: 0, pitch: 0.1 }); return 'edge'; })()`,
};
const grab = () => page.evaluate(() => { const v = __broke.view, P = __broke.game.player; window.__lastCam = [v.camera.position.x, v.camera.position.y, v.camera.position.z, P.pos.x, P.pos.z, v.rig.cur].map((q) => +q.toFixed(3)); const c = document.getElementById('game'); const g = document.createElement('canvas'); g.width = 320; g.height = 180; const x = g.getContext('2d'); x.drawImage(c, 0, 0, 320, 180); return Array.from(x.getImageData(0, 0, 320, 180).data); });
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++; return +(n / (a.length / 4) * 100).toFixed(2); };
for (const [name, js] of Object.entries(views)) {
  const what = await page.evaluate(js);
  await page.waitForTimeout(3500);
  await page.waitForTimeout(4000);
  const a = await grab(); const ca = await page.evaluate(() => window.__lastCam); await page.waitForTimeout(500); const b = await grab(); const cb = await page.evaluate(() => window.__lastCam);
  await page.screenshot({ path: `/home/user/GAMR/broke/shots/${label}-${name}.png`, timeout: 180000 });
  console.log(name, what, 'still-camera change %', diff(a, b), 'cam/player/boom before', JSON.stringify(ca), 'after', JSON.stringify(cb));
}
await browser.close(); srv.stop(); process.exit(0);
