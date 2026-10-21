// Builds meshes for a kit-data scene (the "h" neighbourhood, modules, generated streets): every item goes into a
// Batch per surface material (optionally per spatial chunk, so big cities still frustum-cull), then each batch is
// merged into one mesh per material. Returns the group, the lamp positions (for night lights) and sign meshes.

import * as THREE from 'three';
import { Batch } from './batch.js';
import { kitMaterials } from './materials.js';
import { buildHouse } from './houses.js';
import { apartment, store, warehouse, shed, tower } from './buildings.js';
import { fence, prop, truck, manhole } from './props.js';
import { pad, ribbonMesh, kerb, paint, tuftSpots } from './ground.js';
import { palm, tree, shrub, tufts } from './vegetation.js';
import { poleLine, streetlight, car, bin, hydrant } from './street.js';
import { Rng } from '../../core/rng.js';
import { addKitBoxes } from './classify.js';

// kit: optionally the generator's Kit, whose plain boxes are drawn with kit materials too (see classify.js).
export function buildKitWorld(D, { chunk = 0, seed = 'kit', kit = null } = {}) {
  const rng = new Rng(`kitworld:${seed}`);
  const batches = new Map();
  const B = (x, z) => {
    const k = chunk && x != null ? `${Math.floor(x / chunk)},${Math.floor(z / chunk)}` : 'g';
    if (!batches.has(k)) batches.set(k, new Batch());
    return batches.get(k);
  };
  const extras = [], lamps = [];
  for (const p of D.pads) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of p.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const big = !chunk || (x1 - x0) * (z1 - z0) > chunk * chunk * 0.5;
    pad(big ? B() : B((x0 + x1) / 2, (z0 + z1) / 2), p);
  }
  for (const r of D.ribbons) ribbonMesh(B(r.pts[0].x, r.pts[0].z), r);
  for (const k of D.kerbs) kerb(B(k.pts[0].x, k.pts[0].z), k);
  for (const p of D.paint) paint(B(p.x, p.z), p);
  for (const m of D.manholes) manhole(B(m.x, m.z), m);
  for (const h of D.houses) buildHouse(B(h.x, h.z), h, rng);
  for (const a of D.apartments) apartment(B(a.x, a.z), a, rng);
  for (const s of D.stores) store(B(s.x, s.z), s, rng, extras);
  for (const w of D.warehouses) warehouse(B(w.x, w.z), w, rng);
  for (const s of D.sheds) shed(B(s.x, s.z), s, rng);
  for (const t of D.towers || []) tower(B(t.x, t.z), t, rng);
  // Mid-rise storefront blocks: shops on the ground floor, flats above, flat roof with parapet.
  for (const b of D.blocks || []) buildHouse(B(b.x, b.z), { ...b, roof: 'flat', storefront: true, fl: 0.15, door: 0x2a2a2a }, rng);
  for (const f of D.fences) fence(B(f.a.x, f.a.z), f);
  for (const p of D.palms) palm(B(p.x, p.z), p, rng);
  for (const t of D.trees) tree(B(t.x, t.z), t, rng);
  for (const s of D.shrubs) shrub(B(s.x, s.z), s.x, s.y ?? 0.15, s.z, s.r, rng);
  for (const l of D.poleLines) if (l.length > 1) poleLine(B(l[0].x, l[0].z), l, rng);
  for (const s of D.lights) lamps.push(streetlight(B(s.x, s.z), s));
  for (const c of D.cars) car(B(c.x, c.z), c, rng);
  for (const t of D.trucks) truck(B(t.x, t.z), t);
  for (const b of D.bins) bin(B(b.x, b.z), b);
  for (const h of D.hydrants) hydrant(B(h.x, h.z), h.x, h.z);
  for (const p of D.props) prop(B(p.x ?? p.a?.x, p.z ?? p.a?.z), p, rng);
  if (kit) addKitBoxes(kit, B);
  const spots = tuftSpots(D, rng);
  for (const s of spots) tufts(B(s[0], s[1]), [s], rng);
  const group = new THREE.Group();
  group.name = 'kit-world';
  const M = kitMaterials();
  for (const b of batches.values()) group.add(b.build(M, { noCast: ['roadPaint', 'grass', 'asphalt', 'tuft', 'curb', 'redCurb'] }));
  for (const e of extras) group.add(e);
  return { group, lamps };
}
