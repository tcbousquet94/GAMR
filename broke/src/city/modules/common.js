// Helpers shared by modules: perimeter building rows, glass towers on podiums, trees, low cover walls.

import { MAT, TAG } from '../kit.js';
import { building, plank, fireEscape, G } from './building.js';
import { placeProp } from './streets.js';
import { towerName } from '../names.js';

// Lines the given sides of a rect with buildings. Returns [{r, h, side}].
export function perimeter(kit, rect, sides, lot, opts = {}) {
  const { rng } = kit;
  const out = [];
  const depth = {};
  for (const s of ['n', 's', 'w', 'e']) depth[s] = sides.includes(s) ? opts.depth ?? rng.range(14, 19) : 0;
  const [rmin, rmax] = opts.heights || [15, 25];
  for (const side of sides) {
    const alongX = side === 'n' || side === 's';
    const a0 = alongX ? rect.x0 : rect.z0 + depth.n;
    const a1 = alongX ? rect.x1 : rect.z1 - depth.s;
    let prev = null;
    for (let a = a0; a < a1 - 6; ) {
      let w = rng.range(14, 26);
      if (a1 - (a + w) < 10) w = a1 - a;
      const d = depth[side];
      let r;
      if (side === 'n') r = { x0: a, z0: rect.z0, x1: a + w, z1: rect.z0 + d };
      if (side === 's') r = { x0: a, z0: rect.z1 - d, x1: a + w, z1: rect.z1 };
      if (side === 'w') r = { x0: rect.x0, z0: a, x1: rect.x0 + d, z1: a + w };
      if (side === 'e') r = { x0: rect.x1 - d, z0: a, x1: rect.x1, z1: a + w };
      const h = Math.round(rng.range(rmin, rmax));
      const out_ = side; // outward face
      const inward = { n: 's', s: 'n', w: 'e', e: 'w' }[side];
      const facesStreet = lot && lot.sides[side] === 'street';
      const fe = [];
      if (rng.chance(0.65) || !prev) fe.push(out_);
      if (rng.chance(0.45) || fe.length === 0) fe.push(inward);
      building(kit, r, h, { storefront: facesStreet ? [out_] : [], fireEscape: fe, style: opts.style });
      // Back-alley side gets graffiti now and then.
      if (!facesStreet && rng.chance(0.35)) graffiti(kit, r, out_);
      const b = { r, h, side };
      out.push(b);
      // Gap (a passage into the lot) or a shared wall.
      const gap = rng.chance(opts.gapChance ?? 0.3) ? rng.range(5, 7) : 0;
      // Gaps become passages into the lot; a plank across is added once the next building's height is known.
      if (gap > 0 && a + w + gap < a1 - 6) b.gapAfter = gap;
      if (prev && prev.gapAfter) {
        const hh = Math.min(prev.h, h);
        if (Math.abs(prev.h - h) <= 2) {
          if (alongX) plank(kit, prev.r.x1 - 0.5, (r.z0 + r.z1) / 2 - 1, r.x0 + 0.5, (r.z0 + r.z1) / 2 + 1, hh);
          else plank(kit, (r.x0 + r.x1) / 2 - 1, prev.r.z1 - 0.5, (r.x0 + r.x1) / 2 + 1, r.z0 + 0.5, hh);
        }
        kit.spawn(alongX ? prev.r.x1 + prev.gapAfter / 2 : (r.x0 + r.x1) / 2, G, alongX ? (r.z0 + r.z1) / 2 : prev.r.z1 + prev.gapAfter / 2, 'alley');
      }
      prev = b;
      a += w + gap;
    }
  }
  return { buildings: out, depth };
}

export function graffiti(kit, r, f) {
  const { rng } = kit;
  const words = ['BROKE', 'NO CABS', 'LATE AGAIN', 'EXACT CHANGE', 'TIP 0%', 'SURGE', 'OVERDRAFT', 'K.O.', 'RENT 2 HIGH'];
  const L = f === 'n' ? { x: (r.x0 + r.x1) / 2, z: r.z0 - 0.05, nx: 0, nz: -1 } : f === 's' ? { x: (r.x0 + r.x1) / 2, z: r.z1 + 0.05, nx: 0, nz: 1 }
    : f === 'w' ? { x: r.x0 - 0.05, z: (r.z0 + r.z1) / 2, nx: -1, nz: 0 } : { x: r.x1 + 0.05, z: (r.z0 + r.z1) / 2, nx: 1, nz: 0 };
  kit.sign(rng.pick(words), 'graffiti', L.x, G + 1.6, L.z, 5, 1.6, L.nx, L.nz, rng.pick([0x8a5bff, 0x33c0e0, 0xd04fa0, 0xb0a890]));
}

// Glass tower on a podium. Podium roof (accessible) at podH, tower rises above it.
export function towerOnPodium(kit, r, podH, towerH, opts = {}) {
  const { rng, pal } = kit;
  if (!opts.skipPodium) building(kit, r, podH, { style: 'concrete', storefront: opts.storefront || [], fireEscape: opts.fireEscape || [], clutter: true });
  const inset = Math.min((r.x1 - r.x0), (r.z1 - r.z0)) * 0.22;
  const t = { x0: r.x0 + inset, z0: r.z0 + inset, x1: r.x1 - inset, z1: r.z1 - inset };
  if (opts.towerShift) { t.x0 += opts.towerShift[0]; t.x1 += opts.towerShift[0]; t.z0 += opts.towerShift[1]; t.z1 += opts.towerShift[1]; }
  building(kit, t, towerH, { style: 'glass', base: podH, roof: false, windowStart: podH + 1.2 });
  // Faceted crown so towers read like the reference skyline.
  const cx = (t.x0 + t.x1) / 2, cz = (t.z0 + t.z1) / 2, w = (t.x1 - t.x0) * 0.75;
  const crown = rng.pick(pal.tower);
  if (rng.chance(0.5)) kit.boxC(cx, towerH + w * 0.35, cz, w, w * 0.7, w, crown, MAT.STD, { ry: Math.PI / 4, rx: 0.35 });
  else kit.boxC(cx, towerH + 3, cz, w * 0.8, 6, w * 0.8, crown, MAT.STD, { ry: Math.PI / 4 });
  kit.box(cx - 0.15, towerH, cz - 0.15, cx + 0.15, towerH + 14, cz + 0.15, pal.metal, MAT.METAL);
  kit.light(cx, towerH + 14, cz, 0xff3355, 0, 'beacon');
  if (opts.name !== false) {
    const f = opts.signFace || 'n';
    const p = f === 'n' ? { x: cx, z: t.z0 - 0.1, nx: 0, nz: -1 } : f === 's' ? { x: cx, z: t.z1 + 0.1, nx: 0, nz: 1 } : f === 'w' ? { x: t.x0 - 0.1, z: cz, nx: -1, nz: 0 } : { x: t.x1 + 0.1, z: cz, nx: 1, nz: 0 };
    kit.sign(towerName(rng), 'tower', p.x, towerH - 4, p.z, (t.x1 - t.x0) * 0.7, 2.2, p.nx, p.nz, rng.pick([0x33e0ff, 0xe8e4f0, 0xb04bff]));
  }
  return t;
}

export function tree(kit, x, z, y = G) {
  kit.prop('tree', x, y, z, kit.rng.range(0, Math.PI * 2), kit.rng.pick(kit.pal.foliage));
  kit.collider(x - 0.25, y, z - 0.25, x + 0.25, y + 3, z + 0.25, TAG.PROP);
}

export function planterTree(kit, x, z, y = G) {
  placeProp(kit, 'planter', x, y, z);
  tree(kit, x, z, y + 0.9);
}

export function lowWall(kit, x0, z0, x1, z1, h = 1.1, color = 0x6a6670, y = G) {
  kit.solid(x0, y, z0, x1, y + h, z1, color, MAT.STD, TAG.PROP);
}

export { plank, fireEscape, building, G, placeProp };
