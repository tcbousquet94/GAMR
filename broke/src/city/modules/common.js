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
  if (opts.landmark) return landmarkSpire(kit, t, podH, towerH, opts);
  building(kit, t, towerH, { style: 'glass', base: podH, roof: false, windowStart: podH + 1.2 });
  // Faceted crown so towers read like the reference skyline.
  const cx = (t.x0 + t.x1) / 2, cz = (t.z0 + t.z1) / 2, w = (t.x1 - t.x0) * 0.75;
  const crown = rng.pick(pal.tower);
  // Crowns: a stepped cap or a mechanical penthouse with a roof band; never tilted (that read as broken).
  if (rng.chance(0.5)) {
    kit.boxC(cx, towerH + 1.5, cz, w * 0.9, 3, w * 0.9, crown, MAT.STD);
    kit.boxC(cx, towerH + 4.5, cz, w * 0.62, 3, w * 0.62, crown, MAT.STD);
    kit.boxC(cx, towerH + 7, cz, w * 0.34, 2, w * 0.34, crown, MAT.STD);
  } else {
    kit.boxC(cx, towerH + 3, cz, w * 0.8, 6, w * 0.8, crown, MAT.STD, { ry: Math.PI / 4 });
    kit.boxC(cx, towerH + 6.2, cz, w * 0.86, 0.5, w * 0.86, pal.metal, MAT.METAL, { ry: Math.PI / 4 });
  }
  kit.box(cx - 0.15, towerH, cz - 0.15, cx + 0.15, towerH + 14, cz + 0.15, pal.metal, MAT.METAL);
  kit.light(cx, towerH + 14, cz, 0xff3355, 0, 'beacon');
  if (opts.name !== false) {
    const f = opts.signFace || 'n';
    const p = f === 'n' ? { x: cx, z: t.z0 - 0.1, nx: 0, nz: -1 } : f === 's' ? { x: cx, z: t.z1 + 0.1, nx: 0, nz: 1 } : f === 'w' ? { x: t.x0 - 0.1, z: cz, nx: -1, nz: 0 } : { x: t.x1 + 0.1, z: cz, nx: 1, nz: 0 };
    kit.sign(towerName(rng), 'tower', p.x, towerH - 4, p.z, (t.x1 - t.x0) * 0.7, 2.2, p.nx, p.nz, rng.pick([0x33e0ff, 0xe8e4f0, 0xb04bff]));
  }
  return t;
}

// The district landmark: a stepped art-deco shaft with two setbacks, lit crown bands and a needle spire. It is
// visible from every street, so it doubles as the player's compass (spawn on the avenue, landmark mid-route).
function landmarkSpire(kit, t, podH, H, opts) {
  const { pal } = kit;
  const stone = 0x8c8696, trim = 0xd8c8a8, warm = 0xffd27a;
  const tiers = [[0, 0.62], [3, 0.84], [6, 1]];
  let base = podH;
  for (const [ins, frac] of tiers) {
    const r = { x0: t.x0 + ins, z0: t.z0 + ins, x1: t.x1 - ins, z1: t.z1 - ins };
    const top = podH + (H - podH) * frac;
    building(kit, r, top, { style: 'glass', base, roof: false, windowStart: base + 1.2 });
    // Stone cornice at each setback, with a band of lit crown windows just below it.
    kit.box(r.x0 - 0.4, top - 0.2, r.z0 - 0.4, r.x1 + 0.4, top + 0.9, r.z1 + 0.4, trim);
    kit.box(r.x0, top, r.z0, r.x1, top + 0.3, r.z1, stone);
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const n = Math.floor((nx ? d : w) / 2.2);
      for (let i = 0; i < n; i++) {
        const a = (i + 0.5) * ((nx ? d : w) / n);
        const x = nx ? (nx < 0 ? r.x0 - 0.05 : r.x1 + 0.05) : r.x0 + a;
        const z = nz ? (nz < 0 ? r.z0 - 0.05 : r.z1 + 0.05) : r.z0 + a;
        kit.quad(x, top - 1.6, z, 1.2, 2.2, nx, nz, 0xe8d8b0, warm);
      }
    }
    base = top;
  }
  // Crown: stacked shrinking drums, then the needle and its beacon.
  const cx = (t.x0 + t.x1) / 2, cz = (t.z0 + t.z1) / 2;
  let s = (t.x1 - t.x0) - 16, y = H;
  for (let k = 0; k < 4; k++) {
    const h = 4.5 - k * 0.6;
    kit.boxC(cx, y + h / 2, cz, s, h, s, k % 2 ? trim : stone, MAT.STD, { ry: k % 2 ? Math.PI / 4 : 0 });
    for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) kit.quad(cx + nx * (s / 2 + 0.05), y + h * 0.55, cz + nz * (s / 2 + 0.05), s * 0.7, h * 0.4, nx, nz, 0xe8d8b0, warm);
    y += h; s *= 0.7;
  }
  kit.box(cx - 0.5, y, cz - 0.5, cx + 0.5, y + 10, cz + 0.5, pal.metal, MAT.METAL);
  kit.box(cx - 0.18, y + 10, cz - 0.18, cx + 0.18, y + 30, cz + 0.18, pal.metal, MAT.METAL);
  kit.light(cx, y + 30, cz, 0xff3355, 0, 'beacon');
  kit.light(cx, H + 4, cz, warm, 0, 'beacon');
  const f = opts.signFace || 'n';
  const p = f === 'n' ? { x: cx, z: t.z0 - 0.5, nx: 0, nz: -1 } : f === 's' ? { x: cx, z: t.z1 + 0.5, nx: 0, nz: 1 } : f === 'w' ? { x: t.x0 - 0.5, z: cz, nx: -1, nz: 0 } : { x: t.x1 + 0.5, z: cz, nx: 1, nz: 0 };
  kit.sign('FIRST NATIONAL DEBT', 'tower', p.x, podH + (H - podH) * 0.62 - 4, p.z, (t.x1 - t.x0) * 0.85, 2.6, p.nx, p.nz, 0xffd27a);
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
