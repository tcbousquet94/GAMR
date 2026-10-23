// Small 2D helpers. Coordinates: x east, z south (so north is -z), metres; y is up and never used here.

export const SIDES = ['n', 'e', 's', 'w'];
export const NORMAL = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }; // outward, toward the street on that side
export const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' };
export const NEXT = { n: 'e', e: 's', s: 'w', w: 'n' }; // clockwise
// Yaw (radians, about +y) that turns a model whose front faces local +z to face the given side.
export const FRONT_YAW = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };

export const center = (r) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });
export const area = (r) => (r.x1 - r.x0) * (r.z1 - r.z0);
export const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));

// A rect against side `side` of r: u0..u1 along that side, d0..d1 deep from it. u runs clockwise around the block
// (from the right-hand end of the side as seen from its street).
export function sideRect(r, side, u0, u1, d0, d1) {
  if (side === 'n') return { x0: r.x0 + u0, x1: r.x0 + u1, z0: r.z0 + d0, z1: r.z0 + d1 };
  if (side === 's') return { x0: r.x1 - u1, x1: r.x1 - u0, z0: r.z1 - d1, z1: r.z1 - d0 };
  if (side === 'w') return { x0: r.x0 + d0, x1: r.x0 + d1, z0: r.z1 - u1, z1: r.z1 - u0 };
  return { x0: r.x1 - d1, x1: r.x1 - d0, z0: r.z0 + u0, z1: r.z0 + u1 };
}
export const sideLength = (r, side) => (side === 'n' || side === 's' ? r.x1 - r.x0 : r.z1 - r.z0);

// A placed thing's local frame: front (local +z) toward its street, local x across the frontage.
// toWorld(lot, x, z): local metres from the lot centre -> world {x, z}.
export function toWorld(o, x, z) {
  const c = Math.cos(o.yaw), s = Math.sin(o.yaw);
  return { x: o.center.x + x * c + z * s, z: o.center.z - x * s + z * c };
}
