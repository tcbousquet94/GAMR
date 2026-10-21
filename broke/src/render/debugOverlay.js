// Debug overlay (F2): the territory data drawn into the world. Block borders + ids, territory adjacency lines,
// warehouse siege data (staging areas green, breach points red, defender posts blue, the safe gold), business raid
// data (register green, approach points red cones, defender posts blue), cover points (with the direction they
// protect from), climb points, and battle-zone boundaries (raid orange, siege red, turf war cyan).
// Drawn on top of everything (no depth test) so it reads from above and through walls.

import * as THREE from 'three';

const COL = { block: 0xffffff, adj: 0xffd34a, capture: 0x3cff9a, approach: 0xff4a3a, defend: 0x4aa8ff, cover: 0xffe066, climb: 0xc77dff, raid: 0xff9a3c, siege: 0xff3a5a, turf: 0x4fe8ff, staging: 0x7dff4a, breach: 0xff2a2a, safe: 0xffd34a };

export function buildDebugOverlay(turf) {
  const group = new THREE.Group();
  group.name = 'debug-overlay';
  group.renderOrder = 10;
  const lineMat = (c, opacity = 0.95) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity, depthTest: false, fog: false });
  const lines = (pts, c, op) => { const g = new THREE.BufferGeometry().setFromPoints(pts); const l = new THREE.LineSegments(g, lineMat(c, op)); l.renderOrder = 10; l.frustumCulled = false; group.add(l); return l; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rectPts = (r, y, out) => { out.push(V(r.x0, y, r.z0), V(r.x1, y, r.z0), V(r.x1, y, r.z0), V(r.x1, y, r.z1), V(r.x1, y, r.z1), V(r.x0, y, r.z1), V(r.x0, y, r.z1), V(r.x0, y, r.z0)); };

  // Block borders (each rect of the block) and adjacency between block centres.
  const bp = [], ap = [];
  for (const b of turf.blocks) for (const r of b.rects) rectPts(r, 0.5, bp);
  // Adjacency between warehouse territories (safe to safe).
  for (const t of turf.territories) for (const n of t.adjacent) if (n > t.id) { const a = turf.warehouses[t.warehouse].safe, o = turf.warehouses[turf.territories[n].warehouse].safe; ap.push(V(a.x, 18, a.z), V(o.x, 18, o.z)); }
  lines(bp, COL.block, 0.9);
  lines(ap, COL.adj, 0.9);
  // Battle zones.
  const rd = [], sg = [], tw = [];
  for (const z of turf.zones.raid) rectPts(z.boundary, 0.8, rd);
  for (const z of turf.zones.siege) rectPts(z.boundary, 1.1, sg);
  for (const z of turf.zones.turfWar) rectPts(z.boundary, 1.4, tw);
  lines(rd, COL.raid, 0.8); lines(sg, COL.siege, 0.95); lines(tw, COL.turf, 0.9);
  // Warehouse links to their businesses.
  const lk = [];
  for (const w of turf.warehouses) for (const id of w.businesses) { const b = turf.businesses[id]; lk.push(V(w.safe.x, 12, w.safe.z), V(b.capture.x, 12, b.capture.z)); }
  lines(lk, COL.safe, 0.7);
  // Points as instanced markers.
  const marker = (geo, color, pts, scale = 1) => {
    if (!pts.length) return;
    const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95, fog: false }), pts.length);
    const M = new THREE.Matrix4();
    pts.forEach((p, i) => m.setMatrixAt(i, M.makeScale(scale, scale, scale).setPosition(p.x, p.y, p.z)));
    m.renderOrder = 11; m.frustumCulled = false;
    group.add(m);
  };
  const biz = turf.businesses;
  const whs = turf.warehouses;
  marker(new THREE.BoxGeometry(1.4, 1.4, 1.4), COL.safe, whs.map((w) => ({ x: w.safe.x, y: w.safe.y + 1.4, z: w.safe.z })));
  marker(new THREE.CylinderGeometry(0.15, 0.15, 6, 6).translate(0, 3, 0), COL.staging, whs.flatMap((w) => w.staging.map((p) => ({ x: p.x, y: 0, z: p.z }))));
  marker(new THREE.BoxGeometry(2.4, 1.4, 0.1).translate(0, 5.2, 0), COL.staging, whs.flatMap((w) => w.staging.map((p) => ({ x: p.x, y: 0, z: p.z }))));
  marker(new THREE.OctahedronGeometry(0.75), COL.breach, whs.flatMap((w) => w.breach.map((p) => ({ x: p.x, y: (p.y || 0) + 1.3, z: p.z }))));
  marker(new THREE.BoxGeometry(0.8, 0.8, 0.8), COL.defend, whs.flatMap((w) => w.defenderPosts.map((p) => ({ x: p.x, y: p.y + 0.8, z: p.z }))));
  marker(new THREE.OctahedronGeometry(0.7), COL.capture, biz.map((b) => ({ x: b.capture.x, y: b.capture.y + 1.2, z: b.capture.z })), 1);
  marker(new THREE.ConeGeometry(0.7, 1.6, 6), COL.approach, biz.flatMap((b) => b.approach.map((p) => ({ x: p.x, y: (p.y || 0) + 1.2, z: p.z }))));
  marker(new THREE.BoxGeometry(0.8, 0.8, 0.8), COL.defend, biz.flatMap((b) => b.defenderPosts.map((p) => ({ x: p.x, y: p.y + 0.8, z: p.z }))));
  marker(new THREE.SphereGeometry(0.22, 6, 4), COL.cover, turf.cover.map((c) => ({ x: c.x, y: c.y + 0.25, z: c.z })));
  const cv = [];
  for (const c of turf.cover) cv.push(V(c.x, c.y + 0.25, c.z), V(c.x + c.protects.x * 0.7, c.y + 0.25, c.z + c.protects.z * 0.7));
  lines(cv, COL.cover, 0.8);
  const cl = [];
  for (const c of turf.climbs) cl.push(V(c.base.x, c.base.y + 0.3, c.base.z), V(c.top.x, c.top.y + 0.3, c.top.z));
  lines(cl, COL.climb, 1);
  marker(new THREE.SphereGeometry(0.45, 8, 6), COL.climb, turf.climbs.flatMap((c) => [{ x: c.base.x, y: c.base.y + 0.3, z: c.base.z }, { x: c.top.x, y: c.top.y + 0.3, z: c.top.z }]));
  // Block id labels (with the territory they belong to) and warehouse labels.
  for (const b of turf.blocks) group.add(textSprite(`#${b.id} ${b.zone}`, b.territory != null ? `${whs[b.territory].name}` : 'unclaimed', b.center.x, 22, b.center.z));
  for (const w of whs) group.add(textSprite(`SAFE ${w.name}`, `${w.breach.length} breach \u00b7 ${w.staging.length} staging \u00b7 ${w.defenderPosts.length} posts`, w.safe.x, 30, w.safe.z));
  group.visible = false;
  return group;
}

function textSprite(a, b, x, y, z) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(16,12,24,0.78)'; g.beginPath(); g.roundRect(4, 4, 504, 120, 18); g.fill();
  g.fillStyle = '#ffffff'; g.font = '700 46px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(a, 256, 54);
  g.fillStyle = '#ffd34a'; g.font = '600 32px system-ui, sans-serif'; g.fillText(b, 256, 102);
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false }));
  s.position.set(x, y, z); s.scale.set(26, 6.5, 1); s.renderOrder = 12;
  return s;
}
