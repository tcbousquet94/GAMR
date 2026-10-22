// Closed shops in the mayor game: plywood over the windows and door, a CLOSED notice and a FOR LEASE board, shown on
// every business the mayor's city has lost and hidden again when it reopens. One overlay per business, built once;
// sync(mayor) flips them. Materials and the two sign textures are shared, so a street of closures stays cheap.

import * as THREE from 'three';
import { signMesh } from './buildings.js';
import { houseYaw, CURB } from '../../city/kitdata/data.js';

export function buildClosedShops(city, mayor) {
  const group = new THREE.Group();
  group.name = 'closedShops';
  const items = new Map();
  const ply = new THREE.MeshStandardMaterial({ color: 0xb8956a, roughness: 0.95 });
  const plyDark = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.95 });
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const closed = typeof document !== 'undefined' ? signMesh('CLOSED', 1.6, 0.5, '#f2ede2', '#a82420') : null;
  const lease = typeof document !== 'undefined' ? signMesh('FOR LEASE', 2.2, 0.7, '#c83a2a', '#f2ede2') : null;
  const sign = (src, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), src.material); return m; };

  // Boards over one opening: a span from a to b (world), heights y0..y1, out = outward normal.
  const board = (g, a, b, y0, y1, out, mat = ply) => {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    if (L < 0.3) return;
    const ux = dx / L, uz = dz / L, n = Math.max(1, Math.round(L / 1.22));
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * L + 0.02, t1 = ((i + 1) / n) * L - 0.02;
      const m = new THREE.Mesh(cube, i % 2 ? plyDark : mat);
      m.scale.set(t1 - t0, y1 - y0, 0.03);
      m.position.set(a.x + ux * (t0 + t1) / 2 + out.x * 0.06, (y0 + y1) / 2, a.z + uz * (t0 + t1) / 2 + out.z * 0.06);
      m.rotation.y = Math.atan2(-uz, ux);
      g.add(m);
    }
  };
  const place = (g, src, w, h, p, y, out) => { if (!src) return; const m = sign(src, w, h); m.position.set(p.x + out.x * 0.09, y, p.z + out.z * 0.09); m.rotation.y = Math.atan2(out.x, out.z); g.add(m); };

  for (const b of mayor.businesses) {
    const g = new THREE.Group();
    if (b.ref.business != null) {
      const biz = city.businesses.find((q) => q.id === b.ref.business), f = biz?.front;
      if (!f) continue;
      board(g, f.win[0], f.win[1], f.winY[0], f.winY[1], f.out);
      board(g, f.door[0], f.door[1], f.doorY[0], f.doorY[1], f.out, plyDark);
      const mid = { x: (f.win[0].x + f.win[1].x) / 2, z: (f.win[0].z + f.win[1].z) / 2 }, dm = { x: (f.door[0].x + f.door[1].x) / 2, z: (f.door[0].z + f.door[1].z) / 2 };
      place(g, lease, 2.2, 0.7, mid, 1.9, f.out);
      place(g, closed, 1.2, 0.38, dm, 1.5, f.out);
    } else {
      const s = city.kitData.stores[b.ref.store];
      if (!s) continue;
      const yaw = houseYaw(s), c = Math.cos(yaw), sn = Math.sin(yaw), y = s.y ?? CURB;
      const W = (lx, lz) => ({ x: s.x + lx * c + lz * sn, z: s.z - lx * sn + lz * c });
      const out = { x: sn, z: c }, z0 = s.d / 2 + 0.02;
      board(g, W(-s.w / 2 + 0.5, z0), W(s.w / 2 - 0.5, z0), y + 0.45, y + 2.75, out);
      place(g, lease, 2.2, 0.7, W(-s.w / 4, z0), y + 1.9, out);
      place(g, closed, 1.2, 0.38, W(s.w / 6, z0), y + 1.5, out);
    }
    g.visible = !b.open;
    items.set(b.id, g);
    group.add(g);
  }
  return {
    group,
    sync(m) { for (const b of m.businesses) { const g = items.get(b.id); if (g) g.visible = !b.open; } },
    dispose() { cube.dispose(); ply.dispose(); plyDark.dispose(); },
  };
}
