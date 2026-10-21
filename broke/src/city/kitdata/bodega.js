// The walk-in corner market (a bodega) inside every `market` store of the kit: one layout shared by the colliders
// (kitdata/data.js), the renderer (render/kit/buildings.js) and the staff and lights the generator places, so what you
// see is exactly what you bump into. Sim-safe (no Three.js).
//
// Store-local frame (as the kit builds houses): x across the frontage (-W/2..W/2), z from the back (-D/2) to the front
// (+D/2), y up from the store's base. The glass door is centred in the front wall.

import { houseYaw, CURB } from './data.js';

export const BODEGA = {
  wall: 0.24, // wall thickness (matches the house builder)
  floor: 0.15, // the slab the room stands on
  height: 4.4, // roof
  doorHalf: 0.9, // door opening half-width, centred on the front wall
};

// Fixtures that block movement: [name, x0, z0, x1, z1, height]. Inner half sizes a (x) and b (z).
export function bodegaFixtures(W, D) {
  const a = W / 2 - BODEGA.wall, b = D / 2 - BODEGA.wall;
  return [
    ['coolers', -a, -b + 1.6, -a + 0.85, b - 2.2, 2.25], // glass-door coolers down the left wall
    ['counter', -2.8, -b + 1.4, 1.4, -b + 2.1, 1.02], // the counter across the back
    ['backShelves', -3.2, -b, 0.6, -b + 0.45, 2.1], // cigarettes and sundries behind the counter
    ['bottleShelves', a - 0.6, -b + 1.0, a, b - 2.4, 2.3], // bottles and snacks down the right wall
    ['chipRack', 0.4, -b + 3.2, 1.2, -b + 4.0, 1.45], // a wire rack of chips in front of the counter
    ['crates', a - 1.45, -b + 1.3, a - 0.65, b - 3.6, 0.95], // stacked milk crates and boxes along the shelves
  ].map(([name, x0, z0, x1, z1, h]) => ({ name, x0, z0, x1, z1, h }));
}

// Store-local -> world (x, z) for a store record.
export function storeToWorld(s, lx, lz) {
  const yaw = houseYaw(s), c = Math.cos(yaw), sn = Math.sin(yaw);
  return { x: s.x + lx * c + lz * sn, z: s.z - lx * sn + lz * c };
}

export const isWalkIn = (s) => (s.kind || 'market') === 'market';

// The clerk behind the counter (a kit-data person) and the room light, in world terms.
export function bodegaStaff(s, seed) {
  const W = s.w, D = s.d, b = D / 2 - BODEGA.wall, y = (s.y ?? CURB) + BODEGA.floor;
  const p = storeToWorld(s, -0.8, -b + 0.85);
  const facing = houseYaw(s) + Math.PI; // people face -z in their own frame; the clerk looks at the door (+z here)
  const light = storeToWorld(s, 0, -0.5);
  return {
    clerk: { x: p.x, y, z: p.z, yaw: facing, seed, pose: 'counter' },
    light: { x: light.x, y: y + 3.4, z: light.z },
    W,
  };
}
