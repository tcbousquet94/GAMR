// Street furniture and set-piece props as faceted geometry. Instanced by type in cityMesh.js; tinted props
// (cars, dumpsters, trucks, trees) use a white-ish body so instanceColor sets the paint.

import { fbox, fcyl, fball, fcone, merge, at } from '../facet.js';

let cache = null;

export function propGeometries() {
  if (cache) return cache;
  const W = 0xffffff, DARK = 0x222228, GLASS = 0x2c3446, METAL = 0x2a2a30;
  const wheel = (x, z, r = 0.34) => fcyl(r, r, 0.24, 0x1b1b1e, at(x, r, z, 0, 0, Math.PI / 2), { n: 14 });
  cache = {
    car: merge([
      fbox(1.9, 0.62, 4.4, W, at(0, 0.62, 0)),
      fbox(1.7, 0.55, 2.3, W, at(0, 1.18, 0.15), { jitter: 0.04 }),
      fbox(1.72, 0.42, 2.0, GLASS, at(0, 1.2, 0.15), { jitter: 0.02 }),
      fbox(1.6, 0.2, 0.1, 0xffe6b0, at(0, 0.72, -2.2), { jitter: 0 }), fbox(1.6, 0.15, 0.1, 0x7a2a2a, at(0, 0.75, 2.2), { jitter: 0 }),
      wheel(-0.85, 1.4), wheel(0.85, 1.4), wheel(-0.85, -1.4), wheel(0.85, -1.4),
    ]),
    van: merge([
      fbox(2.1, 1.9, 5.2, W, at(0, 1.25, 0)), fbox(2.12, 0.6, 1.1, GLASS, at(0, 1.75, -2.1)),
      wheel(-0.95, 1.8, 0.38), wheel(0.95, 1.8, 0.38), wheel(-0.95, -1.8, 0.38), wheel(0.95, -1.8, 0.38),
    ]),
    truck: merge([
      fbox(2.5, 2.5, 6.8, W, at(0, 1.6, 0)), fbox(2.4, 1.3, 1.6, W, at(0, 1.05, -3.9)), fbox(2.3, 0.7, 0.1, GLASS, at(0, 1.4, -4.7)),
      fbox(2.6, 0.12, 2.8, 0x6a5a48, at(0, 2.95, 0.3)), // awning over the serving window
      wheel(-1.1, 2.3, 0.45), wheel(1.1, 2.3, 0.45), wheel(-1.1, -3.6, 0.45), wheel(1.1, -3.6, 0.45),
    ]),
    hydrant: merge([fcyl(0.18, 0.22, 0.6, 0x7a6a50, at(0, 0.3, 0)), fball(0.18, 0x7a6a50, at(0, 0.65, 0), { detail: 0 }), fcyl(0.06, 0.06, 0.5, 0x6a5a40, at(0, 0.45, 0, 0, 0, Math.PI / 2))]),
    trashcan: merge([fcyl(0.33, 0.28, 0.95, 0x3c4440, at(0, 0.48, 0), { n: 8 }), fcyl(0.36, 0.36, 0.06, 0x2e3430, at(0, 0.98, 0), { n: 8 })]),
    dumpster: merge([fbox(2.0, 1.25, 3.6, W, at(0, 0.7, 0)), fbox(2.1, 0.1, 3.7, 0x2b2b2e, at(0, 1.38, 0, 0.05, 0, 0))]),
    busshelter: merge([
      fbox(1.8, 0.12, 4.4, METAL, at(0, 2.55, 0)), fbox(0.08, 2.5, 4.3, 0x7fa4c8, at(0.85, 1.25, 0), { jitter: 0 }),
      fbox(0.1, 2.5, 0.1, METAL, at(-0.85, 1.25, -2.1)), fbox(0.1, 2.5, 0.1, METAL, at(-0.85, 1.25, 2.1)),
      fbox(0.5, 0.45, 3.4, 0x4a4650, at(0.5, 0.45, 0)), fbox(0.06, 1.6, 1.2, 0xe0c890, at(0.8, 1.4, 1.4), { jitter: 0 }),
    ]),
    bikerack: merge([0, 1, 2].map((i) => fbox(0.06, 0.8, 0.7, METAL, at(0, 0.4, -0.9 + i * 0.9), { jitter: 0 }))),
    bench: merge([fbox(0.55, 0.08, 1.9, 0x5a4636, at(0, 0.46, 0)), fbox(0.08, 0.45, 1.9, 0x5a4636, at(0.28, 0.75, 0)), fbox(0.5, 0.45, 0.08, METAL, at(0, 0.22, -0.85)), fbox(0.5, 0.45, 0.08, METAL, at(0, 0.22, 0.85))]),
    planter: merge([fbox(2.0, 0.9, 2.0, 0x6a6672, at(0, 0.45, 0)), fbox(1.8, 0.1, 1.8, 0x3a2e26, at(0, 0.88, 0))]),
    tree: merge([fcyl(0.12, 0.18, 2.4, 0x4a3a2c, at(0, 1.2, 0), { n: 9 }), fball(1.2, W, at(0, 2.9, 0), { detail: 2, jitter: 0.12 }), fball(0.9, W, at(0.55, 3.6, 0.2), { detail: 1, jitter: 0.1 }), fball(0.8, W, at(-0.5, 3.4, -0.35), { detail: 1, jitter: 0.1 })]),
    streetlight: merge([
      fcyl(0.1, 0.14, 6.4, METAL, at(0, 3.2, 0), { n: 6 }), fbox(0.12, 0.12, 1.8, METAL, at(0, 6.3, -0.85)),
      fbox(0.5, 0.18, 0.6, 0x3a3a40, at(0, 6.2, -1.6)),
    ]),
    trafficlight: merge([
      fcyl(0.1, 0.12, 5.4, METAL, at(0, 2.7, 0), { n: 6 }), fbox(0.12, 0.12, 3.5, METAL, at(0, 5.3, -1.7)),
      fbox(0.38, 1.0, 0.32, 0x24242a, at(0, 4.8, -3.3)), fbox(0.22, 0.22, 0.05, 0xff9a3c, at(0, 5.05, -3.48), { jitter: 0 }), fbox(0.22, 0.22, 0.05, 0x3a5a3a, at(0, 4.6, -3.48), { jitter: 0 }),
    ]),
    picnic: merge([fbox(1.6, 0.08, 2.0, 0x8a6a48, at(0, 0.76, 0)), fbox(0.35, 0.06, 2.0, 0x7a5a3c, at(-0.8, 0.45, 0)), fbox(0.35, 0.06, 2.0, 0x7a5a3c, at(0.8, 0.45, 0)), fbox(1.6, 0.7, 0.08, 0x6a4a30, at(0, 0.38, -0.8)), fbox(1.6, 0.7, 0.08, 0x6a4a30, at(0, 0.38, 0.8))]),
    ibeams: merge([0, 1, 2, 3, 4].map((i) => fbox(0.32, 0.32, 6.0, 0x6a5148, at(-0.5 + (i % 3) * 0.48, 0.16 + Math.floor(i / 3) * 0.34, 0)))),
    barrier: merge([fbox(0.5, 0.9, 1.9, 0xb8b0a0, at(0, 0.45, 0)), fbox(0.52, 0.18, 1.92, 0x8a6a3a, at(0, 0.7, 0), { jitter: 0 })]),
    kiosk: merge([fbox(2.3, 2.3, 2.3, 0x5a5262, at(0, 1.15, 0)), fbox(2.7, 0.2, 2.7, 0x3a3442, at(0, 2.4, 0)), fbox(1.5, 0.7, 0.05, 0xffd8a0, at(0, 1.4, -1.17), { jitter: 0 })]),
    crate: merge([fbox(1.2, 1.2, 1.2, 0x7a6448, at(0, 0.6, 0)), fbox(1.22, 0.1, 1.22, 0x5e4a34, at(0, 0.6, 0), { jitter: 0 })]),
    revolvingdoor: merge([fcyl(1.6, 1.6, 0.25, 0x3a3a40, at(0, 3.3, 0), { n: 10 }), fcyl(1.6, 1.6, 3.2, 0x8ab4d8, at(0, 1.6, 0), { n: 10, jitter: 0 }), fbox(3.0, 3.1, 0.06, 0x2a2a30, at(0, 1.6, 0, 0, 0.6, 0), { jitter: 0 })]),
  };
  // Doors are solid in the kit only as visuals; keep them from blocking the lobby (no collider is placed for them).
  return cache;
}

// Interactables (individual meshes: they change state when used).
export function interactableGeometry(type) {
  const DARK = 0x1e1e24;
  if (type === 'vending') return merge([
    fbox(1.1, 2.0, 0.9, 0x5a3a6a, at(0, 1.0, 0)), fbox(0.7, 1.3, 0.05, 0x1a1a22, at(-0.12, 1.15, -0.46), { jitter: 0 }),
    fbox(0.2, 0.6, 0.05, 0x3a3a44, at(0.38, 1.2, -0.46), { jitter: 0 }), fbox(0.9, 0.2, 0.06, 0x2a2a30, at(0, 0.3, -0.46), { jitter: 0 }),
  ]);
  if (type === 'newsbox') return merge([fbox(0.6, 0.95, 0.55, 0x3f5a78, at(0, 0.6, 0)), fbox(0.5, 0.35, 0.03, 0xd8d4c8, at(0, 0.8, -0.28), { jitter: 0 }), fbox(0.08, 0.12, 0.6, DARK, at(-0.22, 0.06, 0)), fbox(0.08, 0.12, 0.6, DARK, at(0.22, 0.06, 0))]);
  if (type === 'locker') return merge([
    fbox(2.4, 2.2, 0.7, 0x4f5a52, at(0, 1.1, 0)),
    ...[0, 1, 2, 3].flatMap((i) => [0, 1, 2].map((j) => fbox(0.5, 0.6, 0.03, 0x3a4440, at(-0.9 + i * 0.6, 0.45 + j * 0.65, -0.36), { jitter: 0 }))),
    fbox(0.4, 0.3, 0.04, 0x1a1a22, at(0.95, 1.6, -0.37), { jitter: 0 }),
  ]);
  if (type === 'lostfound') return merge([fbox(1.2, 0.9, 0.9, 0x6a5a40, at(0, 0.45, 0)), fbox(1.25, 0.12, 0.95, 0x4a3e2c, at(0, 0.95, 0.05, 0.25, 0, 0)), fbox(0.8, 0.25, 0.03, 0xe8dcc0, at(0, 0.6, -0.46), { jitter: 0 })]);
  if (type === 'callpanel') return merge([fbox(0.6, 1.5, 0.35, 0x2a3440, at(0, 0.75, 0)), fbox(0.4, 0.5, 0.03, 0x1a2230, at(0, 1.1, -0.18), { jitter: 0 })]);
  return merge([fbox(1, 1, 1, 0xffffff, at(0, 0.5, 0))]);
}
