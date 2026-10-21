// Screenshot capture for visual review against /references. Writes shots/*.png.
// Usage: node tests/browser/screenshots.mjs [seed] [names,comma,separated]
import { startServer, openGame } from './lib.mjs';
import { mkdirSync } from 'node:fs';

const seed = process.argv[2] || '1';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const OUT = new URL('../../shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// Each shot: setup runs in the page (via __broke), then we wait and capture.
const SHOTS = {
  spawn: { min: 0, js: `__broke.step(5)` },
  street: { min: 1, js: `(() => { const g=__broke.game; const e=g.city.exit; const s=g.city.spawn; __broke.pose({x:s.x, y:0.2, z:s.z, yaw:Math.PI, pitch:0.02}); })()` },
  dusk: { min: 3.4, js: `(() => { const s=__broke.game.city.spawn; __broke.pose({x:s.x, y:0.2, z:s.z, yaw:-Math.PI/2, pitch:0.08}); })()` },
  night: { min: 7, js: `(() => { const s=__broke.game.city.spawn; __broke.pose({x:s.x, y:0.2, z:s.z, yaw:-Math.PI/2 + 0.3, pitch:0.12}); })()` },
  rooftop: { min: 4, js: `(() => { const g=__broke.game; const c=g.world.climbs.items.filter(c=>c.maxY>17&&c.maxY<26)[0]; const top=c.maxY-0.6; __broke.pose({x:(c.minX+c.maxX)/2 - (c.wall?c.wall.x:0)*0.1 + (c.wall?c.wall.x*1.2:0), y:top+0.3, z:(c.minZ+c.maxZ)/2 + (c.wall?c.wall.z*1.2:0), yaw:Math.atan2(-(g.city.size/2-c.minX),-(g.city.size/2-c.minZ)), pitch:-0.05}); __broke.step(30); })()` },
  combat: { min: 2, js: `(() => { const g=__broke.game; const s=g.city.spawn; __broke.pose({x:s.x, y:0.2, z:s.z, yaw:0, pitch:0.0}); for (const [t,dz,dx] of [['speakerphone',12,-2],['scooter',16,2.5],['canvasser',7,1],['canvasser',9,-1.5]]) { const e=g.spawnEnemy(t,{x:s.x+dx,y:0.15,z:s.z-dz}); e.spawnT=9; e.yaw=Math.PI; } g.enemies[0].telegraph=0.8; g.director.enabled=false; __broke.step(20, {primary:true}); __broke.step(1); })()` },
  lineup: { min: 0.5, js: `(() => { const g=__broke.game; const s=g.city.spawn; g.director.enabled=false; __broke.pose({x:s.x, y:0.2, z:s.z, yaw:0, pitch:-0.12}); const types=['speakerphone','scooter','canvasser']; types.forEach((t,i)=>{ const e=g.spawnEnemy(t,{x:s.x-2.2+i*2.2,y:0.15,z:s.z-6}); e.spawnT=9; e.stunned=0; e.yaw=0; e.attackCd=99; }); __broke.step(2); g.enemies.forEach(e=>{e.yaw=0; e._ry=0;}); })()` },
  boss: { min: 5, js: `(() => { const g=__broke.game; const ex=g.city.exit; g.director.enabled=false; __broke.pose({x:ex.center.x-30, y:0.2, z:ex.center.z-18, yaw:-Math.PI/2+0.35, pitch:0.22}); g.exit.call(); __broke.step(200); g.timeScale=1; g.slowmo=0; const b=g.boss; if(b){ b.body.pos.x=ex.center.x-16; b.body.pos.z=ex.center.z-19; b.attackCd=99; b.yaw=Math.PI/2; b._ry=b.yaw; } for(let i=0;i<3;i++) g.spawnEnemy('drone',{x:ex.center.x-17+i*2,y:6,z:ex.center.z-14}); g.spawnEnemy('notice',{x:ex.center.x-20,y:3,z:ex.center.z-17},['Section 7.1','Lawn Height!']); })()` },
  hud: { min: 6, js: `(() => { const g=__broke.game; g.director.enabled=false; for (const id of ['latte','espresso','espresso','coupon','hotsauce','dataplan','replyall','insoles','gavel']) g.giveItem(id); g.player.equipment='airhorn'; g.economy.cents=1234; g.player.hp=48; g.player.cooldowns.utility=3; const s=g.city.spawn; __broke.pose({x:s.x, y:0.2, z:s.z, yaw:-Math.PI/2+0.2, pitch:0.05}); })()` },
  phone: { min: 0.6, mobile: true, js: `(() => { const g=__broke.game; const s=g.city.spawn; g.director.enabled=false; __broke.pose({x:s.x, y:0.2, z:s.z, yaw:0, pitch:0.12}); })()` },
  wide: { min: 0.3, js: `(() => { const g=__broke.game; g.director.enabled=false; const s=g.city.spawn; const W=g.city.W, B=g.city.B; __broke.pose({x:W+B+W*0.5, y:0.2, z:s.z, yaw:-Math.PI/2 + 0.25, pitch:0.2}); __broke.view.rig.dist=6; })()` },
  landmark: { min: 1.5, js: `(() => { const g=__broke.game; g.director.enabled=false; const s=g.city.spawn; __broke.pose({x:s.x, y:0.2, z:s.z, yaw:-Math.PI/2, pitch:0.3}); __broke.view.rig.dist=5; })()` },
  viaduct: { min: 2, js: `(() => { const g=__broke.game; g.director.enabled=false; const S=g.city.size; const e=g.city.edges.rail; const ex=g.city.exit.center; g.time=8; __broke.pose({x:S-8, y:0.2, z:ex.z-40, yaw:-Math.PI/2-0.6, pitch:0.28}); __broke.view.rig.dist=6; })()` },
  overpass: { min: 2.5, js: `(() => { const g=__broke.game; g.director.enabled=false; const s=g.city.spawn; __broke.pose({x:9, y:0.2, z:s.z+20, yaw:Math.PI/2+0.45, pitch:0.2}); })()` },
  dee: { min: 0.5, js: `(() => { const g=__broke.game; const s=g.city.spawn; g.director.enabled=false; __broke.pose({x:s.x, y:0.2, z:s.z, yaw:0, pitch:-0.35}); __broke.view.rig.dist=2.6; })()` },
};

const srv = await startServer();
let errs = [];
try {
  for (const [name, sh] of Object.entries(SHOTS)) {
    if (only && !only.includes(name)) continue;
    const { browser, page, errors } = await openGame(srv.url, `seed=${seed}&shot=1&quality=high&t=${sh.min}`, { mobile: !!sh.mobile });
    await page.waitForTimeout(1500);
    await page.evaluate(sh.js);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}${name}.png` });
    const perf = await page.evaluate(() => window.__broke.perf());
    console.log(name, JSON.stringify({ fps: perf.fps, calls: perf.calls, tris: perf.triangles }));
    errs = errs.concat(errors.filter((e) => !/Pointer Lock|404/.test(e)).map((e) => `${name}: ${e}`));
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
  }
} finally { srv.stop(); }
if (errs.length) console.log("PAGE ERRORS:\n" + errs.join("\n"));
process.exit(errs.length ? 1 : 0);
