// The hero scene: one residential T-junction (a wide avenue with a side street running into it) used to develop and
// sign off the remastered look before it is rolled out to the generated city. This module is plain data plus physics
// colliders (no Three.js), so the sim can walk it in Node; render/hero/scene.js turns the same data into meshes.
//
// Local frame: origin at the junction centre, -z is north (away from the player's start), +x east. Everything is
// shifted by O so world coordinates are positive (the flow field and world bounds expect 0..size).

import { Box, World } from '../sim/physics.js';
import { TAG } from '../city/kit.js';

export const O = 160, SIZE = 320;
export const CURB_H = 0.15;

// Roads (asphalt at y=0) and the raised blocks between them (kerb, verge, sidewalk, lots at y=CURB_H).
export const AVENUE = { z0: -30, z1: -16, name: 'Palmetto Avenue' }; // runs east-west
export const SIDE = { x0: -7, x1: 7, name: 'Laurel Street' };          // runs south from the avenue
export const CORNER_R = 6.5;
export const VERGE = 1.7, WALK = 1.7;

// Houses. front: the side facing the street (s = +z, n = -z, e = +x, w = -x). Footprints are in local metres.
export const HOUSES = [
  { id: 'h1', x: -63, z: -44, w: 16, d: 11, front: 's', floors: 1, wall: 'stucco', wallColor: 0xd8c3a0, trim: 0xd8d0c0, roof: 'hip', roofColor: 0x8a7f74, door: 0x5a4030, fence: 'chain' },
  { id: 'h2', bars: true, x: -37, z: -43, w: 12, d: 11, front: 's', floors: 1, wall: 'siding', wallColor: 0x8a7a68, trim: 0xd6cfc0, roof: 'gableFront', roofColor: 0x6e655e, door: 0x7a3a2a, porch: { depth: 2.2, steps: 'center' } },
  { id: 'g1', x: -12, z: -41, w: 18, d: 10, front: 's', floors: 1, wall: 'stucco', wallColor: 0xcfc6b4, trim: 0x9a948a, roof: 'flat', roofColor: 0x6a6660, garage: 2, height: 3.6 },
  { id: 'h4', bars: true, x: 10, z: -46, w: 13, d: 10, front: 's', floors: 1, wall: 'siding', wallColor: 0x9a9c98, trim: 0xdcd6ca, roof: 'gable', roofColor: 0x5e5a58, door: 0x3a4a5a, fence: 'wood' },
  { id: 'h5', x: 36, z: -46, w: 19, d: 13, front: 's', floors: 2, wall: 'siding', wallColor: 0x6a5242, trim: 0xd2cabc, roof: 'hip', roofColor: 0x5e5854, door: 0x4a3426, porch: { depth: 2.6, steps: 'left', railing: true }, chimney: true, wall2: 'brick', wall2Color: 0xa08474 },
  { id: 'h6', bars: true, x: 68, z: -48, w: 16, d: 12, front: 's', floors: 1, wall: 'stucco', wallColor: 0xb8b6ae, trim: 0xd6d0c4, roof: 'hip', roofColor: 0x7a6a5e, door: 0x2a3a2a, fence: 'block' },
  { id: 'h7', bars: true, x: -88, z: -46, w: 15, d: 11, front: 's', floors: 1, wall: 'siding', wallColor: 0x6e7a6a, trim: 0xd8d2c4, roof: 'gable', roofColor: 0x5a524c, door: 0x5a3020, fence: 'wood' },
  // Back row (depth behind the avenue's houses).
  { id: 'b1', x: -45, z: -80, w: 14, d: 11, front: 's', floors: 2, wall: 'stucco', wallColor: 0xc8b8a0, trim: 0xd6cfc0, roof: 'hip', roofColor: 0x7a6e64 },
  { id: 'b2', x: 0, z: -84, w: 16, d: 12, front: 's', floors: 1, wall: 'siding', wallColor: 0x8a8070, trim: 0xd6cfc0, roof: 'gable', roofColor: 0x5a5450 },
  { id: 'b3', x: 52, z: -82, w: 14, d: 12, front: 's', floors: 2, wall: 'stucco', wallColor: 0xb0a898, trim: 0xd6cfc0, roof: 'hip', roofColor: 0x6a5e56 },
  // Corners and down the side street.
  { id: 's1', x: 34, z: 14, w: 14, d: 12, front: 'w', floors: 1, wall: 'stucco', wallColor: 0xd0c8b4, trim: 0xdad4c8, roof: 'hip', roofColor: 0x80766c, door: 0x3a4a3a, fence: 'chain' },
  { id: 's2', bars: true, x: -26, z: 6, w: 14, d: 13, front: 'e', floors: 1, wall: 'siding', wallColor: 0x7e8a92, trim: 0xdad4c8, roof: 'gable', roofColor: 0x5a5654, door: 0x6a2a2a, fence: 'wood', porch: { depth: 2, steps: 'center' } },
  { id: 's3', x: 22, z: 40, w: 13, d: 11, front: 'w', floors: 1, wall: 'siding', wallColor: 0xa08a70, trim: 0xd6cec0, roof: 'gableFront', roofColor: 0x6a5e54, door: 0x2a2a30, porch: { depth: 2, steps: 'center' } },
  { id: 's4', bars: true, x: -22, z: 36, w: 14, d: 12, front: 'e', floors: 2, wall: 'stucco', wallColor: 0xc4b498, trim: 0xd4ccbc, roof: 'hip', roofColor: 0x6e6258, door: 0x4a3020, fence: 'chain' },
  { id: 's5', x: 22, z: 66, w: 14, d: 12, front: 'w', floors: 1, wall: 'stucco', wallColor: 0xbcc0b4, trim: 0xdad4c8, roof: 'hip', roofColor: 0x6a6460, door: 0x3a3020, fence: 'wood' },
  // Beyond the corner lawns, so the junction is enclosed rather than open to the horizon.
  { id: 'e1', x: 62, z: 6, w: 15, d: 12, front: 'n', floors: 1, wall: 'stucco', wallColor: 0xc8b89c, trim: 0xd6cfc0, roof: 'hip', roofColor: 0x6e645a, door: 0x4a3020, bars: true },
  { id: 'e2', x: 86, z: 4, w: 14, d: 12, front: 'n', floors: 2, wall: 'siding', wallColor: 0x7a8278, trim: 0xd6cfc0, roof: 'gable', roofColor: 0x5a5450, door: 0x3a2a20 },
  { id: 'w1', x: -60, z: 8, w: 15, d: 12, front: 'n', floors: 1, wall: 'siding', wallColor: 0x9a8a72, trim: 0xd6cfc0, roof: 'gable', roofColor: 0x5e5650, door: 0x5a2a20, porch: { depth: 2, steps: 'center' } },
  { id: 'w2', x: -84, z: 6, w: 14, d: 12, front: 'n', floors: 1, wall: 'stucco', wallColor: 0xb4ac9c, trim: 0xd6cfc0, roof: 'hip', roofColor: 0x6a6058, door: 0x2a3a2a, bars: true },
  { id: 's6', x: -22, z: 64, w: 13, d: 12, front: 'e', floors: 1, wall: 'siding', wallColor: 0x9a8a7a, trim: 0xd6cec0, roof: 'gable', roofColor: 0x58524e, door: 0x2a3a4a, porch: { depth: 2, steps: 'center' } },
];

// Palms (h: trunk height, lean: metres of lean at the top), broadleaf trees and shrubs.
export const PALMS = [
  { x: -58, z: -36.5, h: 13, lean: [0.8, 0.3] }, { x: -9, z: -60, h: 15, lean: [-0.6, 0.2] }, { x: 14, z: -38, h: 11.5, lean: [0.5, -0.6] },
  { x: 54, z: -37, h: 14, lean: [-1.0, 0.2] }, { x: 70, z: -64, h: 16, lean: [0.4, 0.5] }, { x: -28, z: -66, h: 14.5, lean: [0.6, 0.3] },
  { x: -82, z: -38, h: 12, lean: [0.3, -0.3] }, { x: 92, z: -46, h: 15, lean: [-0.4, 0.2] }, { x: 26, z: -8.5, h: 12.5, lean: [-0.6, -0.4] },
  { x: -13, z: -11.5, h: 12, lean: [0.4, -0.3] }, { x: 31, z: -64, h: 13, lean: [0.2, 0.5] }, { x: -46, z: -64, h: 12, lean: [-0.3, 0.2] },
  { x: 11.5, z: 24, h: 11, lean: [0.3, 0.2] }, { x: -11.5, z: 50, h: 13, lean: [-0.3, 0.1] },
  { x: -36, z: -74, h: 16, lean: [0.5, 0.2] }, { x: 18, z: -80, h: 17, lean: [-0.4, 0.3] }, { x: 60, z: -76, h: 15, lean: [0.3, -0.2] }, { x: -76, z: -88, h: 16, lean: [0.2, 0.3] },
];
export const TREES = [
  { x: -52, z: -63, r: 4.5, h: 7 }, { x: 40, z: -66, r: 5, h: 8 }, { x: 2, z: -70, r: 5.5, h: 8.5 }, { x: -92, z: -66, r: 5, h: 7.5 },
  { x: 82, z: -70, r: 5, h: 8 }, { x: 48, z: -2, r: 4, h: 6.5 }, { x: -40, z: -16 + 9, r: 3.5, h: 6 }, { x: 20, z: -72, r: 4, h: 7 },
  { x: -70, z: -74, r: 6.5, h: 11 }, { x: -20, z: -72, r: 6, h: 10.5 }, { x: 26, z: -88, r: 7, h: 12 }, { x: 64, z: -88, r: 6.5, h: 11 },
  { x: -30, z: -98, r: 7, h: 12 }, { x: 10, z: -104, r: 7.5, h: 12.5 }, { x: 88, z: -96, r: 7, h: 12 }, { x: -100, z: -90, r: 7, h: 11.5 },
  { x: -60, z: -104, r: 7, h: 12 }, { x: 45, z: -108, r: 7, h: 12 }, { x: 110, z: -70, r: 6, h: 10 },
  { x: 74, z: 22, r: 6.5, h: 11 }, { x: 100, z: 16, r: 7, h: 12 }, { x: -72, z: 24, r: 6.5, h: 11 }, { x: -100, z: 20, r: 7, h: 12 }, { x: 46, z: 30, r: 6, h: 10 },
];
export const SHRUBS = [
  { x: -68, z: -37.5, r: 0.9 }, { x: -58, z: -37.5, r: 0.8 }, { x: -42, z: -36.5, r: 0.7 }, { x: 4.5, z: -40.0, r: 0.8 }, { x: 15.5, z: -40.0, r: 0.9 },
  { x: 27, z: -36.5, r: 0.8 }, { x: 50, z: -36.5, r: 1.0 }, { x: 63, z: -40.8, r: 0.8 }, { x: 74, z: -40.8, r: 0.7 }, { x: 26.5, z: 10, r: 0.9 }, { x: 26.5, z: 18, r: 0.8 },
];

// Utility poles (wires run between consecutive poles of a line) and streetlights (arm points toward `to`).
export const POLE_LINES = [
  [{ x: -96, z: -31.2 }, { x: -60, z: -31.2 }, { x: -24, z: -31.2 }, { x: 12, z: -31.2 }, { x: 48, z: -31.2 }, { x: 84, z: -31.2 }],
  [{ x: 12, z: -31.2 }, { x: 8.7, z: -12.5 }, { x: 8.7, z: 22 }, { x: 8.7, z: 56 }],
];
export const STREETLIGHTS = [{ x: 9.3, z: -13.6, yaw: Math.PI * 0.75 }, { x: -9.3, z: -13.6, yaw: -Math.PI * 0.72 }, { x: 40, z: -31.4, yaw: 0 }, { x: -44, z: -31.4, yaw: 0 }, { x: 8.7, z: 40, yaw: -Math.PI / 2 }, { x: -8.7, z: 12, yaw: Math.PI / 2 }, { x: -8.7, z: 68, yaw: Math.PI / 2 }];

// Parked cars (yaw 0 = nose toward -z), bins, idle pedestrians.
export const CARS = [
  { x: -33, z: -28.8, yaw: -Math.PI / 2, color: 0x56606a }, { x: -48.5, z: -37.5, yaw: 0, color: 0x8a8678 }, { x: -5.9, z: 30, yaw: Math.PI, color: 0x6a2e2a },
  { x: 5.9, z: 58, yaw: 0, color: 0x2e3a4a }, { x: 62, z: -28.8, yaw: Math.PI / 2, color: 0xb8b4a8 },
];
export const BINS = [{ x: -20, z: -32.6, c: 0x2e4a32 }, { x: -18.9, z: -32.6, c: 0x2a3a5a }, { x: 21, z: -32.6, c: 0x2e4a32 }, { x: -9.2, z: 14, c: 0x252528 }, { x: 9.2, z: 31, c: 0x2e4a32 }];
export const PEOPLE = [
  { x: 21.5, z: -9.8, yaw: Math.PI * 0.55, look: 'jersey' }, { x: 33.5, z: -34.6, yaw: -0.3, look: 'tank' },
  { x: 35.2, z: -35.3, yaw: 2.5, look: 'jersey' }, { x: -46.5, z: -34.6, yaw: 0.6, look: 'tee' },
];
export const SPAWN = { x: 1.6, z: 7, yaw: 0 };

// Sidewalk paths through the south-east corner lawn: a curving walk that leaves the kerb line and swings inland.
export function cornerWalk() {
  // Leaves the side-street sidewalk (x≈9.9, z≈-0.5), arcs north-east through the lawn, then wanders east.
  const pts = [], cx = SIDE.x1 + 0.32 + VERGE + WALK / 2 + 7, cz = -0.5, r = 7;
  for (let i = 0; i <= 24; i++) { const a = Math.PI + (i / 24) * Math.PI / 2; pts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r }); }
  for (let i = 1; i <= 20; i++) { const t = i / 20; pts.push({ x: cx + t * 36, z: cz - r - 2.6 * Math.sin(t * Math.PI) + t * 1.2 }); }
  return pts;
}

// ---- physics ------------------------------------------------------------------------------------------------------
export function houseRect(h) {
  const sw = h.front === 'e' || h.front === 'w';
  const w = sw ? h.d : h.w, d = sw ? h.w : h.d;
  return { x0: h.x - w / 2, z0: h.z - d / 2, x1: h.x + w / 2, z1: h.z + d / 2 };
}
export function houseHeight(h) { return h.height ?? 0.45 + h.floors * 2.9; }

export function heroCity() {
  const world = new World();
  const solid = (x0, y0, z0, x1, y1, z1, tag = TAG.PROP) => world.addSolid(new Box(O + Math.min(x0, x1), y0, O + Math.min(z0, z1), O + Math.max(x0, x1), y1, O + Math.max(z0, z1), tag));
  const H = SIZE / 2 - 4;
  solid(-H, -1, -H, H, 0, H, TAG.GROUND);
  // Raised blocks with rounded kerbs at the junction (stair-stepped arc).
  solid(-H, 0, -H, H, CURB_H, AVENUE.z0, TAG.GROUND);
  for (const s of [-1, 1]) {
    const xi = s * SIDE.x1, xo = s * H;
    solid(xi + s * CORNER_R, 0, AVENUE.z1, xo, CURB_H, H, TAG.GROUND);
    solid(xi, 0, AVENUE.z1 + CORNER_R, xi + s * CORNER_R, CURB_H, H, TAG.GROUND);
    for (let k = 0; k < 6; k++) {
      const zA = AVENUE.z1 + k * CORNER_R / 6, zB = zA + CORNER_R / 6, zm = (zA + zB) / 2 - AVENUE.z1;
      const dx = CORNER_R - Math.sqrt(Math.max(0, CORNER_R ** 2 - (CORNER_R - zm) ** 2));
      solid(xi + s * dx, 0, zA, xi + s * CORNER_R, CURB_H, zB, TAG.GROUND);
    }
  }
  for (const h of HOUSES) {
    const r = houseRect(h), top = CURB_H + houseHeight(h) + 2;
    solid(r.x0, CURB_H, r.z0, r.x1, top, r.z1, TAG.BUILDING);
    if (h.porch) {
      const p = porchRect(h);
      solid(p.x0, CURB_H, p.z0, p.x1, CURB_H + 0.45, p.z1, TAG.PLATFORM);
    }
  }
  for (const p of PALMS) solid(p.x - 0.25, 0, p.z - 0.25, p.x + 0.25, p.h, p.z + 0.25);
  for (const t of TREES) solid(t.x - 0.25, 0, t.z - 0.25, t.x + 0.25, t.h * 0.6, t.z + 0.25);
  for (const l of POLE_LINES) for (const p of l) solid(p.x - 0.16, 0, p.z - 0.16, p.x + 0.16, 10, p.z + 0.16);
  for (const s of STREETLIGHTS) solid(s.x - 0.12, 0, s.z - 0.12, s.x + 0.12, 8.5, s.z + 0.12);
  for (const c of CARS) { const along = Math.abs(Math.sin(c.yaw)) > 0.5; const hw = along ? 2.3 : 0.9, hd = along ? 0.9 : 2.3; solid(c.x - hw, 0, c.z - hd, c.x + hw, 1.45, c.z + hd); }
  for (const b of BINS) solid(b.x - 0.32, 0, b.z - 0.36, b.x + 0.32, 1.1, b.z + 0.36);
  for (const f of fences()) solid(f.x0, CURB_H, f.z0, f.x1, CURB_H + f.h, f.z1, TAG.PROP);
  world.bounds = { minX: O - H, minZ: O - H, maxX: O + H, maxZ: O + H };
  return {
    hero: true, world, size: SIZE, seed: 'hero', interactables: [], spawnPoints: [], exit: null, buildings: [],
    kit: { lights: [], signs: [], props: [] },
    district: { id: 'hero', name: 'Palmetto Avenue', lighting: { keys: [] } },
    spawn: { x: O + SPAWN.x, y: 0.3, z: O + SPAWN.z, yaw: SPAWN.yaw },
  };
}

// Porch footprint in front of a house's street face.
export function porchRect(h) {
  const r = houseRect(h), d = h.porch.depth;
  if (h.front === 's') return { x0: r.x0 + 0.5, z0: r.z1, x1: h.wall2 ? r.x1 - 0.5 : r.x1 - 0.5, z1: r.z1 + d };
  if (h.front === 'n') return { x0: r.x0 + 0.5, z0: r.z0 - d, x1: r.x1 - 0.5, z1: r.z0 };
  if (h.front === 'e') return { x0: r.x1, z0: r.z0 + 0.5, x1: r.x1 + d, z1: r.z1 - 0.5 };
  return { x0: r.x0 - d, z0: r.z0 + 0.5, x1: r.x0, z1: r.z1 - 0.5 };
}

// Front-yard fences along the sidewalk for houses that have one: a run with a gap for the path/driveway.
export function fences() {
  const out = [];
  for (const h of HOUSES) {
    if (!h.fence) continue;
    const r = houseRect(h), kind = h.fence, H = kind === 'chain' ? 1.2 : kind === 'block' ? 1.4 : 1.1;
    if (h.front === 's') {
      const z = AVENUE.z0 - VERGE - WALK - 0.4, x0 = r.x0 - 2, x1 = r.x1 + 2, gx = h.x - 0.8;
      out.push({ kind, h: H, x0, z0: z - 0.04, x1: gx, z1: z + 0.04, along: 'x' }, { kind, h: H, x0: gx + 1.6, z0: z - 0.04, x1, z1: z + 0.04, along: 'x' });
    } else {
      const s = h.front === 'e' ? -1 : 1, x = s * (SIDE.x1 + VERGE + WALK + 0.4), z0 = r.z0 - 2, z1 = r.z1 + 2, gz = h.z - 0.8;
      out.push({ kind, h: H, x0: x - 0.04, z0, x1: x + 0.04, z1: gz, along: 'z' }, { kind, h: H, x0: x - 0.04, z0: gz + 1.6, x1: x + 0.04, z1, along: 'z' });
    }
  }
  return out;
}
