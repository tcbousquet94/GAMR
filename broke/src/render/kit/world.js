// Builds meshes for a kit-data scene (the "h" neighbourhood, modules, generated streets): every item goes into a
// Batch per surface material (optionally per spatial chunk, so big cities still frustum-cull), then each batch is
// merged into one mesh per material. Returns the group, the lamp positions (for night lights) and sign meshes.

import * as THREE from 'three';
import { Batch } from './batch.js';
import { kitMaterials } from './materials.js';
import { buildHouse } from './houses.js';
import { apartment, store, warehouse, shed, tower, blockExtras } from './buildings.js';
import { fence, prop, truck, manhole } from './props.js';
import { pad, ribbonMesh, kerb, paint, tuftSpots } from './ground.js';
import { palm, tree, shrub, tufts } from './vegetation.js';
import { poleLine, streetlight, car, bin, hydrant } from './street.js';
import { Rng } from '../../core/rng.js';
import { addKitBoxes } from './classify.js';

// kit: optionally the generator's Kit, whose plain boxes are drawn with kit materials too (see classify.js).
// With `chunk` set, street-level detail is split into chunk x chunk metre cells that are only built when the camera
// comes within range and are thrown away again when it leaves, so a big town costs memory only around the player
// (phones crash otherwise). Big pads and the tower skyline are built up front.
export function buildKitWorld(D, { chunk = 0, seed = 'kit', kit = null } = {}) {
  const rng = new Rng(`kitworld:${seed}`);
  const jobs = new Map(); // chunk key -> [(batch, rng, extras) => void]
  const keyOf = (x, z) => (chunk && x != null ? `${Math.floor(x / chunk)},${Math.floor(z / chunk)}` : 'g');
  const at = (x, z, fn) => { const k = keyOf(x, z); if (!jobs.has(k)) jobs.set(k, []); jobs.get(k).push(fn); };
  const skyline = new Batch(); // towers: never distance-culled, they are the skyline
  const extras = [], lamps = [];
  for (const p of D.pads) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of p.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const big = !chunk || (x1 - x0) * (z1 - z0) > chunk * chunk * 0.5;
    at(big ? null : (x0 + x1) / 2, (z0 + z1) / 2, (b) => pad(b, p));
  }
  for (const r of D.ribbons) at(r.pts[0].x, r.pts[0].z, (b) => ribbonMesh(b, r));
  for (const k of D.kerbs) at(k.pts[0].x, k.pts[0].z, (b) => kerb(b, k));
  for (const p of D.paint) at(p.x, p.z, (b) => paint(b, p));
  for (const m of D.manholes) at(m.x, m.z, (b) => manhole(b, m));
  for (const h of D.houses) at(h.x, h.z, (b, r) => buildHouse(b, h, r));
  for (const a of D.apartments) at(a.x, a.z, (b, r) => apartment(b, a, r));
  for (const s of D.stores) at(s.x, s.z, (b, r, ex) => store(b, s, r, ex));
  for (const w of D.warehouses) at(w.x, w.z, (b, r) => warehouse(b, w, r));
  for (const s of D.sheds) at(s.x, s.z, (b, r) => shed(b, s, r));
  for (const t of D.towers || []) tower(skyline, t, rng, extras);
  // Mid-rise storefront blocks: shops on the ground floor, flats above, flat roof with parapet.
  for (const k of D.blocks || []) at(k.x, k.z, (b, r, ex) => { buildHouse(b, { ...k, roof: 'flat', storefront: true, fl: 0.15, door: 0x2a2a2a }, r); blockExtras(b, k, r, ex); });
  for (const f of D.fences) at(f.a.x, f.a.z, (b) => fence(b, f));
  for (const p of D.palms) at(p.x, p.z, (b, r) => palm(b, p, r));
  for (const t of D.trees) at(t.x, t.z, (b, r) => tree(b, t, r));
  for (const s of D.shrubs) at(s.x, s.z, (b, r) => shrub(b, s.x, s.y ?? 0.15, s.z, s.r, r));
  for (const l of D.poleLines) if (l.length > 1) at(l[0].x, l[0].z, (b, r) => poleLine(b, l, r));
  const NULL_BATCH = new Proxy({}, { get: () => () => null }); // lamp positions without building the pole
  for (const s of D.lights) { lamps.push(streetlight(NULL_BATCH, s)); at(s.x, s.z, (b) => streetlight(b, s)); }
  for (const c of D.cars) at(c.x, c.z, (b, r) => car(b, c, r));
  for (const t of D.trucks) at(t.x, t.z, (b) => truck(b, t));
  for (const k of D.bins) at(k.x, k.z, (b) => bin(b, k));
  for (const h of D.hydrants) at(h.x, h.z, (b) => hydrant(b, h.x, h.z));
  for (const p of D.props) at(p.x ?? p.a?.x, p.z ?? p.a?.z, (b, r) => prop(b, p, r));
  if (kit) {
    const parts = new Map(); // the generator's boxes and window quads, split by chunk the same way
    const part = (x, z) => { const k = keyOf(x, z); if (!parts.has(k)) { parts.set(k, { quads: [], boxes: [] }); at(x, z, (b) => addKitBoxes(parts.get(k), () => b)); } return parts.get(k); };
    for (const q of kit.quads) part(q.cx, q.cz).quads.push(q);
    for (const b of kit.boxes) part(b.cx, b.cz).boxes.push(b);
  }
  for (const s of tuftSpots(D, rng)) at(s[0], s[1], (b, r) => tufts(b, [s], r));

  const group = new THREE.Group();
  group.name = 'kit-world';
  const M = kitMaterials(), shared = new Set(Object.values(M));
  const noCast = ['roadPaint', 'grass', 'asphalt', 'tuft', 'curb', 'redCurb', 'shopGlass'];
  const FOLIAGE = ['leaves', 'frond', 'chainlink', 'tuft'];
  const foliage = []; // live list of leaf-card meshes (hidden from the AO pass)
  const build = (k) => {
    const b = new Batch(), ex = [];
    for (const fn of jobs.get(k)) fn(b, new Rng(`kitworld:${seed}:${k}`), ex);
    const g = b.build(M, { noCast });
    for (const e of ex) g.add(e);
    g.traverse((m) => { if (m.isMesh && FOLIAGE.includes(m.name)) foliage.push(m); });
    group.add(g);
    return g;
  };
  const drop = (g) => {
    group.remove(g);
    g.traverse((m) => {
      if (!m.isMesh) return;
      m.geometry.dispose();
      const i = foliage.indexOf(m); if (i >= 0) foliage.splice(i, 1);
      for (const mt of [].concat(m.material)) if (!shared.has(mt)) { mt.map?.dispose(); mt.dispose(); }
    });
  };
  if (jobs.has('g')) build('g');
  if (Object.keys(skyline.lists).length) group.add(skyline.build(M, { noCast }));
  for (const e of extras) group.add(e);
  const chunks = [...jobs.keys()].filter((k) => k !== 'g').map((k) => { const [i, j] = k.split(',').map(Number); return { k, cx: (i + 0.5) * chunk, cz: (j + 0.5) * chunk, g: null }; });
  // Keep chunks within `far` built and shown; drop those well beyond it. At most `budget` new chunks per call
  // (nearest first) so walking never stalls on a burst of builds; budget Infinity fills the view at once.
  const cull = (cam, far = 420, budget = 2) => {
    const R = far + chunk * 0.71, R2 = R * R, D2 = (R + chunk * 1.5) ** 2;
    const want = [];
    for (const c of chunks) {
      const d = (c.cx - cam.x) ** 2 + (c.cz - cam.z) ** 2;
      if (d < R2) { if (c.g) c.g.visible = true; else want.push([d, c]); } else if (c.g) { if (d > D2) { drop(c.g); c.g = null; } else c.g.visible = false; }
    }
    want.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < want.length && i < budget; i++) want[i][1].g = build(want[i][1].k);
  };
  if (!chunk) for (const c of chunks) c.g = build(c.k);
  return { group, lamps, cull, foliage };
}
