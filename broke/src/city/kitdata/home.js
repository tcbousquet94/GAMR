// The walk-in home inside every ordinary kit house, after the user's reference (style only): the front door stands
// open onto a living room (sofa, coffee table, TV between speakers, rug, stairs up the left wall in two-storey
// houses), a cased opening through to a kitchen-diner across the back (cabinets, sink, stove, fridge, a table with
// chairs). One layout shared by the colliders (kitdata/data.js), the renderer (render/kit/houses.js) and the resident
// and room light the generator places, so what you see is what you bump into. Sim-safe (no Three.js).
//
// House-local frame (as the kit builds houses): x across the front (-W/2..W/2), z from the back (-D/2) to the street
// face (+D/2), y up from the lot. The floor is the top of the foundation (FL).

import { FL, FH, houseYaw, CURB } from './data.js';

export const HOME = {
  wall: 0.24, // wall thickness (matches the house builder)
  doorHalf: 0.75, // front door opening half-width (1.5 m: a comfortable way in past the open door leaf)
  doorH: 2.2,
  kitchen: 3.9, // depth of the kitchen-diner across the back, wall to partition centre
  part: 0.12, // partition half-thickness
  openHalf: 0.8, // half-width of the cased opening in the partition
};

// Ordinary pitched-roof houses big enough for rooms (not shops, garages, walk-ups or sheds).
// Square-on only: an angled house's colliders are a fill of small boxes, too coarse for walls and a doorway.
const squareOn = (h) => { const y = houseYaw(h), c = Math.abs(Math.cos(y)), s = Math.abs(Math.sin(y)); return Math.min(c, s) < 1e-3; };
export const isHome = (h) => !h.garage && !h.storefront && !h.units && !h.industrial && !h.walkIn && h.roof && h.roof !== 'flat' && h.w >= 8.5 && h.d >= 9 && squareOn(h);

// Front door centre (x), as the house builder places it.
export const homeDoorX = (h) => -h.w / 2 + (h.porch?.steps === 'left' ? 2.2 : h.w / 2 + (h.w > 14 ? -1.6 : 0.4));

export function homeLayout(h) {
  const W = h.w, D = h.d, t = HOME.wall, a = W / 2 - t, b = D / 2 - t;
  const zp = -D / 2 + HOME.kitchen, p = HOME.part;
  const stairs = (h.floors || 1) > 1 ? { x0: -a, x1: -a + 1.0, z0: zp + p, z1: b - 0.9 } : null;
  const xo = -a + (stairs ? 1.0 : 0) + 1.5; // the opening to the kitchen, just right of the stairs
  const zl = zp + p + 1.75; // sofa / TV centre line
  const kz0 = -b, kz1 = zp - p, kz = (kz0 + 0.62 + kz1) / 2; // kitchen floor, table centre line
  const tx = Math.min(a - 1.6, xo + 2.4); // table centre
  const F = [
    ['sofa', a - 3.5, zl - 1.0, a - 2.6, zl + 1.0, 0.85],
    ['table', a - 2.25, zl - 0.6, a - 1.45, zl + 0.6, 0.42],
    ['tv', a - 0.55, zl - 0.8, a, zl + 0.8, 1.25],
    ['speakerA', a - 0.45, zl - 1.35, a - 0.05, zl - 0.95, 1.05],
    ['speakerB', a - 0.45, zl + 0.95, a - 0.05, zl + 1.35, 1.05],
    ['counterBack', -a, kz0, a - 0.85, kz0 + 0.62, 0.92],
    ['counterSide', -a, kz0 + 0.62, -a + 0.62, kz1 - 0.6, 0.92],
    ['fridge', a - 0.82, kz0, a, kz0 + 0.75, 1.8],
    ['dining', tx - 0.7, kz - 0.4, tx + 0.7, kz + 0.4, 0.76],
    ['plant', a - 0.5, b - 0.5, a - 0.1, b - 0.1, 0.9],
  ].map(([name, x0, z0, x1, z1, h]) => ({ name, x0, z0, x1, z1, h }));
  const chairs = [[tx - 1.05, kz, 1, 0], [tx + 1.05, kz, -1, 0], [tx - 0.35, kz - 0.65, 0, 1], [tx + 0.35, kz + 0.65, 0, -1]];
  for (const [x, z] of chairs) F.push({ name: 'chair', x0: x - 0.22, z0: z - 0.22, x1: x + 0.22, z1: z + 0.22, h: 0.9 });
  return { W, D, a, b, zp, p, xo, stairs, zl, kz0, kz1, kz, tx, chairs, fixtures: F, ceil: FL + FH, doorX: homeDoorX(h) };
}

// House-local -> world (x, z).
export function homeToWorld(h, lx, lz) {
  const yaw = houseYaw(h), c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: h.x + lx * c + lz * s, z: h.z - lx * s + lz * c };
}

// The room light (one per home, over the opening so it reaches both rooms) and, in about half of them, someone on
// the sofa watching TV. Placed by position, no rng.
export function homeLife(h, seed) {
  const L = homeLayout(h), y = (h.y ?? CURB) + FL;
  const lp = homeToWorld(h, (L.xo + L.a) / 2 - 0.5, L.zp + 1.2);
  const out = { light: { x: lp.x, y: y + FH - 0.35, z: lp.z }, resident: null };
  if (seed % 2 === 0) {
    const p = homeToWorld(h, L.a - 3.0, L.zl + (seed % 3 - 1) * 0.5);
    const yaw = houseYaw(h), f = { x: Math.cos(yaw), z: -Math.sin(yaw) }; // local +x: toward the TV
    out.resident = { x: p.x, y: y + 0.45 - 0.82, z: p.z, yaw: Math.atan2(-f.x, -f.z), seed, pose: 'sit' };
  }
  return out;
}
