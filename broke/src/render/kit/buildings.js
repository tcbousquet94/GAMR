// Non-house buildings for the remastered look, on top of the house builder (same walls, openings and trim):
// apartment walk-ups (unit doors on every floor, a front walkway with railing, an outside stair), corner stores
// (storefront glazing, awning, lettered sign board, window posters), tilt-up warehouses (roll-up doors, painted band,
// wall lamps, bollards), and yard buildings (garages, sheds, site offices).

import * as THREE from 'three';
import { mat } from './batch.js';
import { buildHouse } from './houses.js';
import { CURB, houseYaw } from '../../city/kitdata/data.js';

const FH = 2.9;
const local = (b, B) => { const M = mat(b.x, b.y ?? CURB, b.z, houseYaw(b)); return (key, x0, y0, z0, x1, y1, z1, color = 0xffffff) => B.boxM(key, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), M.clone().multiply(mat((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)), color); };

export function apartment(B, a, rng) {
  const floors = a.floors || 2, fl = 0.3;
  buildHouse(B, { ...a, roof: 'flat', floors, wall: 'stucco', units: true, fl, door: rng.pick([0x5a4030, 0x3a4a5a, 0x6a2a2a]) }, rng);
  const box = local(a, B), W = a.w, D = a.d, z0 = D / 2, rail = 0x3a3a3c;
  for (let f = 1; f < floors; f++) {
    const y = fl + f * FH;
    box('concrete', -W / 2 - 4.6, y - 0.18, z0, W / 2, y, z0 + 1.7, 0xc8c4bc); // walkway
    for (let x = -W / 2 - 4.4; x <= W / 2; x += 3) box('metalPaint', x - 0.05, 0, z0 + 1.55, x + 0.05, y, z0 + 1.65, rail); // posts
    box('metalPaint', -W / 2 - 4.6, y + 0.95, z0 + 1.6, W / 2, y + 1.0, z0 + 1.68, rail);
    for (let x = -W / 2 - 4.5; x < W / 2; x += 0.12) box('metalPaint', x - 0.01, y, z0 + 1.62, x + 0.01, y + 0.95, z0 + 1.64, rail);
  }
  // Outside stair up the left end, parallel to the front.
  const top = fl + FH, steps = 16;
  for (let i = 0; i < steps; i++) box('concrete', -W / 2 - 4.6 + i * (4.4 / steps), 0, z0 + 1.75, -W / 2 - 4.6 + (i + 1) * (4.4 / steps), (i + 1) * top / steps, z0 + 2.9, 0xbcb8b0);
  box('metalPaint', -W / 2 - 4.6, 0, z0 + 2.85, -W / 2 - 0.2, 0.06, z0 + 2.9, rail);
}

// Sign boards with painted lettering: one small mesh per sign (a canvas texture each).
export function signMesh(text, w, h, bg, fg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * c.width, Math.random() * c.height, 20 + Math.random() * 60, 2); // weathering
  g.fillStyle = fg; g.font = `900 ${Math.round(c.height * 0.62)}px Arial Black, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height * 0.54, c.width * 0.92);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
}

export function store(B, s, rng, extras) {
  const H = 4.4, W = s.w, D = s.d;
  buildHouse(B, { ...s, roof: 'flat', height: H, floors: 1, wall: 'stucco', trim: 0xd0c8b8, storefront: true, door: 0x2a2a2a, fl: 0.15 }, rng);
  const box = local(s, B), z0 = D / 2;
  // Awning: a sloped fabric band with a valance, over the storefront.
  const M = mat(s.x, s.y ?? CURB, s.z, houseYaw(s));
  B.boxM('trim', W - 0.6, 0.06, 1.7, M.clone().multiply(mat(0, 3.15, z0 + 0.8, 0, 0.32)), s.awning);
  box('trim', -W / 2 + 0.3, 2.62, z0 + 1.55, W / 2 - 0.3, 2.95, z0 + 1.62, s.awning);
  // Posters in the windows, a lit sign board above the awning.
  for (let i = 0; i < 6; i++) { const x = -W / 2 + 1.2 + rng.range(0, W - 2.4); if (Math.abs(x) < 1.4) continue; box('trim', x - 0.3, 1.2, z0 - 0.12, x + 0.3, 2.0, z0 - 0.1, rng.pick([0xd8b030, 0xc83a2a, 0x2a6ac8, 0xe8e4dc])); }
  if (extras && typeof document !== 'undefined') {
    const sg = signMesh(s.name || 'MARKET', W - 2, 0.9, '#e8e2d0', '#' + (s.awning >>> 0).toString(16).padStart(6, '0'));
    sg.position.set(0, 3.65, z0 + 0.13); sg.applyMatrix4(M); extras.push(sg);
    box('metalPaint', -W / 2 + 0.8, 3.15, z0 + 0.02, W / 2 - 0.8, 4.15, z0 + 0.1, 0x3a3a3c);
  }
}

export function warehouse(B, w, rng) {
  const H = w.h || 8, W = w.w, D = w.d;
  buildHouse(B, { ...w, roof: 'flat', height: H, floors: 1, wall: 'concrete', wallColor: w.color, trim: 0x9a968e, garage: w.doors, doorW: 4.0, doorH: 4.4, doorKey: 'metal', doorColor: 0xc8c8c0, industrial: true, fl: 0.12 }, rng);
  const box = local(w, B), z0 = D / 2, Mw = mat(w.x, w.y ?? CURB, w.z, houseYaw(w));
  // Painted band under the parapet, wall lamps and bollards at each door.
  box('trim', -W / 2 - 0.03, H - 1.5, -D / 2 - 0.03, W / 2 + 0.03, H - 1.1, D / 2 + 0.03, w.stripe);
  const n = w.doors, gw = 4.0, gap = (W - n * gw) / (n + 1);
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + gap + i * (gw + gap) + gw / 2;
    box('metalPaint', x - 0.25, 5.0, z0, x + 0.25, 5.25, z0 + 0.5, 0x5a5a5c); box('lamp', x - 0.2, 4.98, z0 + 0.1, x + 0.2, 5.0, z0 + 0.45);
    for (const s of [-1, 1]) B.add('metalPaint', new THREE.CylinderGeometry(0.11, 0.11, 1.1, 10), Mw.clone().multiply(mat(x + s * (gw / 2 + 0.35), 0.55, z0 + 0.4)), 0xd8b020, { uv: 'native' });
  }
}

export function shed(B, s, rng) {
  if (s.kind === 'garage') buildHouse(B, { ...s, wall: 'stucco', wallColor: s.color, trim: 0xd0c8b8, roof: 'flat', height: 2.9, floors: 1, garage: 1, doorW: Math.min(s.w - 1.2, 3.0), doorH: 2.2, fl: 0.08 }, rng);
  else if (s.kind === 'office') buildHouse(B, { ...s, wall: 'stucco', wallColor: s.color, trim: 0xb0aca4, roof: 'flat', height: s.h || 3.2, floors: 1, door: 0x3a3a3c, fl: 0.2 }, rng);
  else buildHouse(B, { ...s, wall: 'planks', wallColor: s.color || 0x9a8a72, trim: 0x8a7a64, roof: 'flat', height: s.h || 2.3, floors: 1, garage: 1, doorW: 1.2, doorH: 1.9, doorKey: 'planks', doorColor: 0x8a7a64, fl: 0.05 }, rng);
}
