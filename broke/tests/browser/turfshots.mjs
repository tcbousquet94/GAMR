// Screenshots of the turf-war city for review: the landmark from street level, a bodega base close up (front and
// alley side), the debug overlay from above, the town map, plus street-level views of an HQ, a park and the edges.
//   node tests/browser/turfshots.mjs [seed] [names,comma,separated]
import { mkdirSync } from 'node:fs';
import { startServer, openGame } from './lib.mjs';

const seed = process.argv[2] || '1';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const OUT = new URL('../../shots/turf/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// Each shot runs in the page with __broke; helpers are injected first.
const HELPERS = `
  window.$look = (from, to) => { const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z; return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }; };
  window.$flyTo = (from, to) => { const a = $look(from, to); __broke.fly(true, { x: from.x, y: from.y, z: from.z, yaw: a.yaw, pitch: a.pitch }); };
  window.$biz = (type) => __broke.game.turf.businesses.find((b) => b.type === type);
  window.$out = (b) => { const d = { x: b.door.x - b.doorInside.x, z: b.door.z - b.doorInside.z }; const l = Math.hypot(d.x, d.z); return { x: d.x / l, z: d.z / l }; };
`;
const SHOTS = {
  landmark: `(() => { const g = __broke.game, T = g.turf, L = T.landmarks[0], w = g.world;
    // A street point 110-170 m from the spire that can see its top, looking up at it.
    let best = null;
    for (const s of T.roads.segments) { if (!s.open) continue; const x = (s.rect.x0 + s.rect.x1) / 2, z = (s.rect.z0 + s.rect.z1) / 2; const d = Math.hypot(x - L.x, z - L.z);
      if (d < 110 || d > 190) continue; if (w.segmentClear({ x, y: 1.7, z }, { x: L.x, y: L.height * 0.8, z: L.z })) { best = { x, z }; break; } }
    best = best || { x: L.x - 120, z: L.z + 60 };
    __broke.pose({ x: best.x, y: 0.3, z: best.z, yaw: Math.atan2(-(L.x - best.x), -(L.z - best.z)), pitch: 0.32 }); __broke.view.rig.dist = 4.5; })()`,
  bodega_front: `(() => { const b = $biz('bodega'); const o = $out(b); $flyTo({ x: b.door.x + o.x * 11 - o.z * 2, y: 2.6, z: b.door.z + o.z * 11 + o.x * 2 }, { x: b.capture.x - o.z * -2, y: 2.4, z: b.capture.z }); })()`,
  bodega_alley: `(() => { const b = $biz('bodega'); const o = $out(b); const m = b.approach.find((p) => p.kind === 'alley'), e = b.approach.find((p) => p.kind === 'back');
    $flyTo({ x: m.x + o.x * 3.5, y: 2.2, z: m.z + o.z * 3.5 }, { x: e.x, y: 3.2, z: e.z }); })()`,
  bodega_roof: `(() => { const b = $biz('bodega'); const o = $out(b); $flyTo({ x: b.roof.x + o.x * 16, y: 16, z: b.roof.z + o.z * 16 }, { x: b.roof.x, y: b.roof.y, z: b.roof.z }); })()`,
  warehouse_street: `(() => { const w = __broke.game.turf.warehouses.find((q) => q.hq == null) || __broke.game.turf.warehouses[0]; const g = { x: (w.gate.x0 + w.gate.x1) / 2, y: 3, z: (w.gate.z0 + w.gate.z1) / 2 }; const st = w.staging.find((q) => q.side === 'front'); const d = { x: st.x - g.x, z: st.z - g.z }, l = Math.hypot(d.x, d.z);
    $flyTo({ x: st.x + d.x / l * 7 + d.z / l * 9, y: 2.2, z: st.z + d.z / l * 7 - d.x / l * 9 }, { x: g.x - d.z / l * 6, y: 4, z: g.z + d.x / l * 6 }); })()`,
  yard_container: `(() => { const w = __broke.game.turf.warehouses.find((q) => q.hq == null) || __broke.game.turf.warehouses[0]; const c = w.defenderPosts.find((p) => p.kind === 'containerTop'); const d = w.docks[1].outside; $flyTo({ x: c.x, y: c.y + 1.7, z: c.z }, { x: d.x, y: 2, z: d.z }); })()`,
  floor_catwalk: `(() => { const w = __broke.game.turf.warehouses.find((q) => q.hq == null) || __broke.game.turf.warehouses[0]; const c = w.catwalk[0]; const d = w.docks[0].inside; $flyTo({ x: c.x, y: c.y + 1.7, z: c.z }, { x: d.x, y: 1.4, z: d.z }); })()`,
  office_safe: `(() => { const w = __broke.game.turf.warehouses.find((q) => q.hq == null) || __broke.game.turf.warehouses[0]; const o = w.office, s = w.safe; const d = { x: s.x - o.x, z: s.z - o.z }; $flyTo({ x: o.x - d.x * 0.15, y: o.y + 1.7, z: o.z - d.z * 0.15 }, { x: s.x, y: s.y - 0.4, z: s.z }); })()`,
  overlay: `(() => { const g = __broke.game; __broke.overlay(true); __broke.fly(true, { x: g.turf.size.x / 2, y: 430, z: g.turf.size.z / 2, down: true }); })()`,
  overlay_close: `(() => { const b = $biz('bodega'); const o = $out(b); __broke.overlay(true); $flyTo({ x: b.door.x + o.x * 40, y: 45, z: b.door.z + o.z * 40 }, { x: b.capture.x, y: 0, z: b.capture.z }); })()`,
  map: `(() => { __broke.map(); })()`,
  hq: `(() => { const b = __broke.game.turf.businesses.find((q) => q.hq === 1); const o = $out(b); $flyTo({ x: b.door.x + o.x * 12 + o.z * 4, y: 3, z: b.door.z + o.z * 12 - o.x * 4 }, { x: b.capture.x, y: 2.5, z: b.capture.z }); })()`,
  aerial: `(() => { const g = __broke.game, T = g.turf; $flyTo({ x: -40, y: 140, z: T.size.z + 40 }, { x: T.size.x * 0.55, y: 0, z: T.size.z * 0.45 }); })()`,
  river: `(() => { const g = __broke.game, T = g.turf; const c = T.connections.find((q) => q.side === 'e'); $flyTo({ x: c.x - 30, y: 4, z: c.z + 30 }, { x: c.x + 10, y: 2, z: c.z }); })()`,
  park: `(() => { const g = __broke.game, T = g.turf; const p = T.blocks.find((b) => b.zone === 'park') || T.blocks[0]; $flyTo({ x: p.bounds.x0 - 6, y: 9, z: p.bounds.z1 + 6 }, { x: p.center.x, y: 0, z: p.center.z }); })()`,
  street: `(() => { const g = __broke.game; const s = g.city.spawn; __broke.pose({ x: s.x, y: 0.3, z: s.z, yaw: s.yaw + Math.PI, pitch: 0.06 }); })()`,
};

const srv = await startServer();
let errs = [];
try {
  for (const [name, js] of Object.entries(SHOTS)) {
    if (only && !only.includes(name)) continue;
    const { browser, page, errors } = await openGame(srv.url, `seed=${seed}&shot=1&quality=high`);
    await page.waitForTimeout(1500);
    await page.evaluate(HELPERS);
    await page.evaluate(js);
    await page.waitForTimeout(name === 'map' ? 1200 : 2500);
    await page.screenshot({ path: `${OUT}${name}.png` });
    const perf = await page.evaluate(() => window.__broke.perf());
    console.log(name, JSON.stringify({ fps: perf.fps, calls: perf.calls, tris: perf.triangles }));
    errs = errs.concat(errors.filter((e) => !/Pointer Lock|404/.test(e)).map((e) => `${name}: ${e}`));
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
  }
} finally { srv.stop(); }
if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
process.exit(errs.length ? 1 : 0);
