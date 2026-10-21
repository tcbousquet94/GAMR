// The worn, lived-in layer (PS2-era crime-city look): wooden utility poles with sagging power lines along the ring
// and industrial streets, rooftop billboards with satirical ads, graffiti on walls, and beat-up cars (faded paint,
// primer hoods, mismatched doors, rust). Pure dressing: colliders only where you could walk into something.

import { MAT, TAG } from '../kit.js';
import { G } from '../modules/building.js';
import { R } from './raster.js';

const ADS = [
  ['LAWYER UP', '1-800-SUE-THEM'], ['PAYDAY PALS', 'CASH TODAY. REGRET TOMORROW.'], ['BIG GULP CITY', '64 OZ · 99¢'],
  ['SMILE DENTAL', 'WE TAKE PAYMENT PLANS'], ['VOTE NO', 'ON EVERYTHING'], ['FIRST NATIONAL DEBT', 'WE OWN YOUR TOMORROW'],
  ['QUIKBAIL', 'OPEN 24 HOURS'], ['MEGA LOTTO', 'YOU COULD BE NEXT'], ['ACE STORAGE', 'YOUR STUFF. OUR PROBLEM.'],
];
const AD_COLORS = [0xd8a83a, 0x3a7ad8, 0xd84a3a, 0x2f9d6a, 0xe8e4dc, 0x8a3ab0];
export const TAGS = ['BROKE', 'KREW 9', 'SOUTH SIDE', 'NO RENT', 'KING ROLLO', 'DEBT IS A TRAP', 'EVICT THIS', 'FOREVER BUSTED', 'YARD DOGZ', 'PAY UP'];
const TAG_COLORS = [0x33e0ff, 0xff3fb8, 0xffd34a, 0x7dff4a, 0xe8e4dc, 0xff7a3a, 0x2f7fe0, 0xe0453a];

export function wornCity(kit, city, raster) {
  powerLines(kit, city, raster);
  billboards(kit, city, raster);
  edgeGraffiti(kit, city);
}

// Utility poles at the curb along ring / residential / industrial cell sides, wires sagging between neighbours.
function powerLines(kit, city, raster) {
  const L = city.layout, sw = city.district.roads.sidewalk;
  const mc = { x: L.sizeX / 2, z: L.sizeZ / 2 };
  for (const c of L.cells) {
    const blk = city.blocks[c.block];
    const ring = Math.hypot((c.rect.x0 + c.rect.x1) / 2 - mc.x, (c.rect.z0 + c.rect.z1) / 2 - mc.z) > L.size * 0.22;
    if (!(blk.zone === 'residential' || blk.zone === 'industrial' || (ring && blk.zone !== 'park'))) continue;
    for (const side of ['n', 'w']) {
      if (!city.sideOpen(c, side)) continue;
      const r = c.rect, alongX = side === 'n';
      const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
      const at = (u) => alongX ? { x: r.x0 + u, z: r.z0 - sw + 0.35 } : { x: r.x0 - sw + 0.35, z: r.z0 + u };
      let prev = null;
      for (let u = 4; u <= len - 2; u += 26) {
        const p = at(u);
        if (raster.get(p.x, p.z) & (R.NOFURN | R.DIAG)) { prev = null; continue; }
        pole(kit, p.x, p.z, alongX);
        if (prev) wires(kit, prev, p, alongX);
        prev = p;
      }
    }
  }
}

function pole(kit, x, z, alongX) {
  const H = 9.4, wood = 0x5a4636;
  kit.solid(x - 0.13, G, z - 0.13, x + 0.13, H, z + 0.13, wood, MAT.STD, TAG.PROP);
  // Crossarm across the street direction... runs perpendicular to the wires.
  if (alongX) kit.box(x - 0.08, H - 0.6, z - 1.1, x + 0.08, H - 0.45, z + 1.1, wood);
  else kit.box(x - 1.1, H - 0.6, z - 0.08, x + 1.1, H - 0.45, z + 0.08, wood);
  for (const o of [-0.9, 0, 0.9]) { const ix = alongX ? x : x + o, iz = alongX ? z + o : z; kit.box(ix - 0.05, H - 0.45, iz - 0.05, ix + 0.05, H - 0.25, iz + 0.05, 0x9ab0a8); }
  if (kit.rng.chance(0.3)) kit.box(x + (alongX ? 0 : 0.3), H - 2.6, z + (alongX ? 0.3 : 0), x + (alongX ? 0.5 : 0.8), H - 1.4, z + (alongX ? 0.8 : 0.5), 0x6a6a72, MAT.METAL); // transformer
}

// Three wires, each two straight pieces dipping to a sag at mid-span.
function wires(kit, a, b, alongX) {
  const H = 9.4 - 0.3, sag = 0.9;
  const span = alongX ? b.x - a.x : b.z - a.z, half = span / 2;
  const tilt = Math.atan2(sag, half);
  for (const o of [-0.9, 0, 0.9]) {
    for (const k of [0, 1]) {
      const c = (alongX ? a.x : a.z) + half * (k + 0.5);
      const y = H - sag / 2;
      const sgn = k === 0 ? 1 : -1;
      if (alongX) kit.boxC(c, y, a.z + o, Math.hypot(half, sag), 0.03, 0.03, 0x1e1c22, MAT.METAL, { rz: -sgn * tilt });
      else kit.boxC(a.x + o, y, c, 0.03, 0.03, Math.hypot(half, sag), 0x1e1c22, MAT.METAL, { rx: sgn * tilt });
    }
  }
}

// Billboards on low rooftops facing their street.
function billboards(kit, city, raster) {
  const { rng } = kit;
  const cands = rng.shuffle((city.buildings || []).filter((b) => b.h < 26 && b.side && (b.rect.x1 - b.rect.x0) > 11 && (b.rect.z1 - b.rect.z0) > 11));
  let n = 0;
  for (const b of cands) {
    if (n >= 8) break;
    const r = b.rect, h = Math.round(b.h);
    const n2 = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[b.side];
    const alongX = b.side === 'n' || b.side === 's';
    const cx = alongX ? (r.x0 + r.x1) / 2 : b.side === 'w' ? r.x0 + 2 : r.x1 - 2;
    const cz = alongX ? (b.side === 'n' ? r.z0 + 2 : r.z1 - 2) : (r.z0 + r.z1) / 2;
    const W = 10, Hh = 3.8, y0 = h + 2.6;
    for (const o of [-3.5, 3.5]) { const px = cx + (alongX ? o : 0), pz = cz + (alongX ? 0 : o); kit.box(px - 0.12, h, pz - 0.12, px + 0.12, y0 + 0.2, pz + 0.12, 0x3a3840, MAT.METAL); }
    kit.boxC(cx, y0 + Hh / 2, cz, alongX ? W + 0.4 : 0.3, Hh + 0.4, alongX ? 0.3 : W + 0.4, 0x3a3840, MAT.METAL);
    const [title, tag] = ADS[(n + city.seed.length) % ADS.length];
    const fx = cx + n2[0] * 0.18, fz = cz + n2[1] * 0.18;
    kit.sign(`${title}|${tag}`, 'billboard', fx, y0 + Hh / 2, fz, W, Hh, n2[0], n2[1], rng.pick(AD_COLORS));
    kit.light(cx + n2[0] * 1.2, y0 - 0.1, cz + n2[1] * 1.2, 0xfff0d0, 0, 'beacon');
    n++;
  }
}

// Tags along the highway sound wall and on the warehouse brick sections facing the street.
function edgeGraffiti(kit, city) {
  const { rng } = kit;
  const { inner } = city, L = city.layout;
  if (city.district.edges.s === 'highway') {
    for (let x = inner.x0 + 10; x < inner.x1 - 10; x += rng.range(14, 30)) kit.sign(rng.pick(TAGS), 'graffiti', x, rng.range(1.4, 2.6), inner.z1 + 2.95, rng.range(4, 7), 1.6, 0, -1, rng.pick(TAG_COLORS));
  }
  void L;
}

// A beat-up car: faded paint, sometimes a primer hood, a mismatched door, rust spots. Returns the body colour.
export function beaterDressing(kit, x, z, yaw) {
  const { rng } = kit;
  const rot = (lx, lz) => ({ x: x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z: z - lx * Math.sin(yaw) + lz * Math.cos(yaw) });
  if (rng.chance(0.55)) { const p = rot(0, -1.6); kit.boxC(p.x, 0.94, p.z, 1.86, 0.03, 1.2, 0x6e6c68, MAT.STD, { ry: yaw }); }
  if (rng.chance(0.5)) { const sx = rng.chance(0.5) ? 1 : -1; const p = rot(sx * 0.958, 0.1); kit.boxC(p.x, 0.62, p.z, 0.02, 0.52, 1.0, rng.pick([0x8a3a2a, 0x2f5f8a, 0xb8b090, 0x4a6a3a]), MAT.STD, { ry: yaw }); }
  for (let k = 0; k < rng.int(1, 3); k++) { const sx = rng.chance(0.5) ? 1 : -1; const p = rot(sx * 0.96, rng.range(-1.8, 1.8)); kit.boxC(p.x, rng.range(0.4, 0.8), p.z, 0.02, rng.range(0.12, 0.3), rng.range(0.2, 0.5), 0x6a3a22, MAT.STD, { ry: yaw }); }
}
export const FADED = [0x8a7a6a, 0x6a6f5a, 0x7a6a5a, 0x9a968a, 0x7a5a48, 0x5a6470, 0xa09078];
