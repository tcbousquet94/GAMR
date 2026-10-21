// Kit data: the plain-data description of a remastered-look street scene, shared by the hand-made test street ("h"),
// the neighbourhood modules and the generated city. No Three.js here: the sim builds colliders from it in Node and
// render/kit turns the same data into meshes.
//
// All coordinates are world metres. `y` on an item is the level it stands on (default CURB = lot / sidewalk level).
//   pads      [{ surf, poly:[[x,z]...], y0, y1, tint }]      flat slabs (lawns, drives, lots, plazas, parking)
//   ribbons   [{ surf, pts:[{x,z}], width, y, tint }]          curving walks and lanes
//   kerbs     [{ pts:[{x,z}], red:[segment index...], y }]      kerb runs (raised concrete), some painted red
//   paint     [{ x, z, w, d, yaw, color, y }]                   lane lines, stop bars, crosswalk stripes, stalls
//   houses / apartments / stores / warehouses / sheds           buildings (see render/kit/*.js for the fields)
//   fences    [{ kind: chain|wood|block|barbed, a:{x,z}, b:{x,z}, h, y }]
//   palms, trees, shrubs, hedges, poleLines, lights, cars, trucks, bins, hydrants, props, people

export const CURB = 0.15;
export const FH = 2.9, FL = 0.45; // floor height, foundation height (houses)

export function emptyKitData() {
  return {
    pads: [], ribbons: [], kerbs: [], paint: [], houses: [], apartments: [], stores: [], warehouses: [], sheds: [], fences: [],
    palms: [], trees: [], shrubs: [], hedges: [], poleLines: [], lights: [], cars: [], trucks: [], bins: [], hydrants: [], props: [], people: [], manholes: [],
  };
}
export function mergeKitData(into, from) { for (const k of Object.keys(from)) (into[k] ||= []).push(...from[k]); return into; }

// A frame for building a module inside a rectangle: local u (across) / v (deep) from one corner, rotated so the
// module's "front" faces the chosen street. at(u,v) -> world {x,z}; yaw(a) turns a local yaw into a world yaw.
export function frame(rect, front) {
  const w = rect.x1 - rect.x0, d = rect.z1 - rect.z0;
  // front: which side of the rect is the street the module faces ('s' = +z, 'n' = -z, 'e' = +x, 'w' = -x).
  const F = {
    s: { W: w, D: d, at: (u, v) => ({ x: rect.x0 + u, z: rect.z1 - v }), yaw: 0 },
    n: { W: w, D: d, at: (u, v) => ({ x: rect.x1 - u, z: rect.z0 + v }), yaw: Math.PI },
    e: { W: d, D: w, at: (u, v) => ({ x: rect.x1 - v, z: rect.z1 - u }), yaw: Math.PI / 2 },
    w: { W: d, D: w, at: (u, v) => ({ x: rect.x0 + v, z: rect.z0 + u }), yaw: -Math.PI / 2 },
  }[front];
  return { ...F, front, rect, yawOf: (a) => a + F.yaw, pt: (u, v) => { const p = F.at(u, v); return [p.x, p.z]; } };
}

export function houseHeight(h) { return h.height ?? FL + (h.floors || 1) * FH; }
// Yaw of a house from `yaw` or a compass `front`.
export const FRONT_YAW = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };
export const houseYaw = (h) => h.yaw ?? FRONT_YAW[h.front ?? 's'];

// Colliders for a rotated rectangle: exact for axis-aligned, a fill of small boxes otherwise (no invisible corners).
export function rotRect(add, cx, cz, w, d, yaw, y0, y1, tag) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const aligned = Math.abs(s) < 1e-3 || Math.abs(c) < 1e-3;
  if (aligned) { const hw = Math.abs(c) > 0.5 ? w / 2 : d / 2, hd = Math.abs(c) > 0.5 ? d / 2 : w / 2; add(cx - hw, y0, cz - hd, cx + hw, y1, cz + hd, tag); return; }
  const st = 1.2;
  for (let u = -w / 2 + st / 2; u < w / 2; u += st) for (let v = -d / 2 + st / 2; v < d / 2; v += st) {
    const x = cx + u * c + v * s, z = cz - u * s + v * c;
    add(x - st / 2, y0, z - st / 2, x + st / 2, y1, z + st / 2, tag);
  }
}

// Every collider a kit-data scene needs (buildings, porches, fences, trunks, poles, cars, bins...). add(x0,y0,z0,x1,y1,z1,tag)
export function kitColliders(D, add, TAG) {
  for (const h of D.houses) {
    const y = h.y ?? CURB, yaw = houseYaw(h);
    rotRect(add, h.x, h.z, h.w, h.d, yaw, y, y + houseHeight(h) + 2, TAG.BUILDING);
    if (h.porch) { const c = Math.cos(yaw), s = Math.sin(yaw), off = h.d / 2 + h.porch.depth / 2; rotRect(add, h.x + off * s, h.z + off * c, h.w - 1, h.porch.depth, yaw, y, y + FL, TAG.PLATFORM); }
  }
  for (const a of D.apartments) rotRect(add, a.x, a.z, a.w, a.d, houseYaw(a), a.y ?? CURB, (a.y ?? CURB) + (a.floors || 2) * 3 + 1.2, TAG.BUILDING);
  for (const s of D.stores) rotRect(add, s.x, s.z, s.w, s.d, houseYaw(s), s.y ?? CURB, (s.y ?? CURB) + 4.6, TAG.BUILDING);
  for (const w of D.warehouses) rotRect(add, w.x, w.z, w.w, w.d, houseYaw(w), w.y ?? CURB, (w.y ?? CURB) + (w.h || 8), TAG.BUILDING);
  for (const s of D.sheds) rotRect(add, s.x, s.z, s.w, s.d, houseYaw(s), s.y ?? CURB, (s.y ?? CURB) + (s.h || 2.6), TAG.BUILDING);
  for (const f of D.fences) {
    const y = f.y ?? CURB, dx = f.b.x - f.a.x, dz = f.b.z - f.a.z, L = Math.hypot(dx, dz);
    if (L < 0.2) continue;
    if (Math.abs(dx) < 0.05 || Math.abs(dz) < 0.05) { add(Math.min(f.a.x, f.b.x) - 0.06, y, Math.min(f.a.z, f.b.z) - 0.06, Math.max(f.a.x, f.b.x) + 0.06, y + f.h, Math.max(f.a.z, f.b.z) + 0.06, TAG.PROP); continue; }
    for (let t = 0; t < L; t += 0.5) { const x = f.a.x + dx * t / L, z = f.a.z + dz * t / L; add(x - 0.25, y, z - 0.25, x + 0.25, y + f.h, z + 0.25, TAG.PROP); }
  }
  for (const p of D.palms) add(p.x - 0.25, p.y ?? 0, p.z - 0.25, p.x + 0.25, (p.y ?? 0) + p.h, p.z + 0.25, TAG.PROP);
  for (const t of D.trees) add(t.x - 0.25, t.y ?? 0, t.z - 0.25, t.x + 0.25, (t.y ?? 0) + t.h * 0.6, t.z + 0.25, TAG.PROP);
  for (const l of D.poleLines) for (const p of l) add(p.x - 0.16, 0, p.z - 0.16, p.x + 0.16, 10, p.z + 0.16, TAG.PROP);
  for (const s of D.lights) add(s.x - 0.12, 0, s.z - 0.12, s.x + 0.12, 8, s.z + 0.12, TAG.PROP);
  for (const c of D.cars) rotRect(add, c.x, c.z, 1.8, 4.6, c.yaw, c.y ?? 0, (c.y ?? 0) + 1.45, TAG.PROP);
  for (const t of D.trucks) rotRect(add, t.x, t.z, 2.4, 7.2, t.yaw, t.y ?? 0, (t.y ?? 0) + 3.4, TAG.PROP);
  for (const b of D.bins) add(b.x - 0.32, b.y ?? CURB, b.z - 0.36, b.x + 0.32, (b.y ?? CURB) + 1.1, b.z + 0.36, TAG.PROP);
  for (const p of D.props) { const r = PROP_SIZE[p.type]; if (r) rotRect(add, p.x, p.z, r[0], r[1], p.yaw || 0, p.y ?? CURB, (p.y ?? CURB) + r[2], TAG.PROP); }
}
// Collider footprint (w, d, h) for solid props.
export const PROP_SIZE = { dumpster: [1.9, 1.2, 1.3], ice: [1.3, 0.8, 1.9], phone: [0.5, 0.4, 2.1], newsbox: [0.5, 0.45, 1.1], shed: [2.4, 2, 2.4], hoop: [0.3, 0.3, 3.2], pallets: [1.2, 1.0, 1.0], container: [2.4, 6, 2.6], bench: [1.6, 0.5, 0.8] };

// Raised block slabs (sidewalks, lots) need colliders too; pads above the ground get theirs from their polygon bounds.
export function padColliders(D, add, TAG) {
  for (const p of D.pads) {
    if (!p.solid) continue;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of p.poly) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
    add(x0, p.y0, z0, x1, p.y1, z1, TAG.GROUND);
  }
}
