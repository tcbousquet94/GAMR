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

// Sign boards with lettering: one small mesh per sign (a canvas texture each). opts.sub: a second line;
// opts.painted: hand-painted on a wall (transparent ground, script-ish lettering, little product icons).
export function signMesh(text, w, h, bg, fg, opts = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.max(32, Math.round(512 * h / w));
  const g = c.getContext('2d');
  if (!opts.painted) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * c.width, Math.random() * c.height, 20 + Math.random() * 60, 2); }
  const main = opts.sub ? 0.5 : 0.62;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = fg; g.font = `${opts.painted ? 'italic 800' : '900'} ${Math.round(c.height * main)}px ${opts.painted ? 'Georgia, serif' : 'Arial Black, Arial, sans-serif'}`;
  g.fillText(text, c.width / 2, c.height * (opts.sub ? 0.32 : 0.54), c.width * 0.92);
  if (opts.sub) { g.fillStyle = opts.subColor || fg; g.font = `900 ${Math.round(c.height * 0.36)}px Arial Black, Arial, sans-serif`; g.fillText(opts.sub, c.width / 2, c.height * 0.76, c.width * 0.9); }
  if (opts.icons) for (let i = 0; i < 7; i++) { g.fillStyle = ['#2a5aa8', '#c83a2a', '#e8e4dc', '#3a8a4a', '#d8b030'][i % 5]; const x = c.width * (0.08 + i * 0.045), y = c.height * 0.72; g.fillRect(x, y - (i % 2 ? 26 : 34), 16, i % 2 ? 26 : 34); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: opts.painted ? 0.9 : 0.7, transparent: !!opts.painted, alphaTest: opts.painted ? 0.05 : 0, polygonOffset: true, polygonOffsetFactor: -2 }));
}

// kind: 'market' (glazed storefront, awning, sign board), 'taco' (a small stand with barred windows, a stone-look
// base and a ring of lettered boards around its roof), 'discount' (a plain stucco box with its name, prices and
// products painted straight onto the street wall).
export function store(B, s, rng, extras) {
  const kind = s.kind || 'market', W = s.w, D = s.d, z0 = D / 2;
  const M = mat(s.x, s.y ?? CURB, s.z, houseYaw(s));
  const box = local(s, B), hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');
  const sign = (text, w, h, x, y, z, ry, bg, fg, o) => { if (!extras || typeof document === 'undefined') return; const m = signMesh(text, w, h, bg, fg, o); m.position.set(x, y, z); m.rotation.y = ry; m.updateMatrix(); m.applyMatrix4(M); extras.push(m); };
  if (kind === 'taco') {
    const H = 3.4;
    buildHouse(B, { ...s, roof: 'flat', height: H, floors: 1, wall: 'stucco', wallColor: s.wallColor ?? 0xe6dcc6, trim: 0xd8d0c0, storefront: true, bars: true, door: 0x3a3a3c, fl: 0.15 }, rng);
    box('concrete', -W / 2 - 0.05, 0, -D / 2 - 0.05, W / 2 + 0.05, 1.0, D / 2 + 0.05, 0xb8aa94); // stone-look base band
    // Ring of sign boards standing on the roof edge, front and both sides, plus a smaller band under the eave.
    const bh = 1.1, y = H + bh / 2 + 0.15;
    box('metalPaint', -W / 2 - 0.2, H + 0.1, z0 + 0.1, W / 2 + 0.2, H + 0.2, z0 + 0.3, 0x5a5a5c);
    sign(s.name, W + 0.3, bh, 0, y, z0 + 0.32, 0, '#f2ede2', hex(s.awning));
    for (const sd of [-1, 1]) sign(rng.pick(['BURRITOS', 'TORTAS', 'ENCHILADAS', 'COMBINATIONS']), D - 0.4, bh * 0.85, sd * (W / 2 + 0.22), y - 0.05, 0, sd * Math.PI / 2, '#f2ede2', '#3a3a3a');
    sign('MENUDO · SABADO · DOMINGO', W - 0.4, 0.32, 0, H - 0.3, z0 + 0.2, 0, hex(s.wallColor ?? 0xe6dcc6), '#8a2a1a');
    return;
  }
  if (kind === 'discount') {
    const H = 4.6;
    buildHouse(B, { ...s, roof: 'flat', height: H, floors: 1, wall: 'stucco', wallColor: s.wallColor ?? 0xdccaa4, trim: 0xc8bca4, door: 0x2a2a2a, fl: 0.12, bars: true }, rng);
    sign(s.name, W * 0.62, 1.4, -W * 0.12, H - 1.2, z0 + 0.03, 0, null, '#a8281e', { painted: true, sub: '99¢ & UP', subColor: '#b8261e', icons: true });
    box('trim', W * 0.18, 1.0, z0 - 0.02, W * 0.38, 2.2, z0 + 0.02, 0xb82a22); // painted price board
    return;
  }
  const H = 4.4;
  buildHouse(B, { ...s, roof: 'flat', height: H, floors: 1, wall: 'stucco', trim: 0xd0c8b8, storefront: true, door: 0x2a2a2a, fl: 0.15 }, rng);
  // Awning: a sloped fabric band with a valance, over the storefront.
  B.boxM('trim', W - 0.6, 0.06, 1.7, M.clone().multiply(mat(0, 3.15, z0 + 0.8, 0, 0.32)), s.awning);
  box('trim', -W / 2 + 0.3, 2.62, z0 + 1.55, W / 2 - 0.3, 2.95, z0 + 1.62, s.awning);
  // Posters in the windows, a sign board above the awning.
  for (let i = 0; i < 6; i++) { const x = -W / 2 + 1.2 + rng.range(0, W - 2.4); if (Math.abs(x) < 1.4) continue; box('trim', x - 0.3, 1.2, z0 - 0.12, x + 0.3, 2.0, z0 - 0.1, rng.pick([0xd8b030, 0xc83a2a, 0x2a6ac8, 0xe8e4dc])); }
  box('metalPaint', -W / 2 + 0.8, 3.15, z0 + 0.02, W / 2 - 0.8, 4.15, z0 + 0.1, 0x3a3a3c);
  sign(s.name || 'MARKET', W - 2, 0.9, 0, 3.65, z0 + 0.13, 0, '#e8e2d0', hex(s.awning));
}

// High-rise: a glazed podium, a shaft of facade between protruding concrete piers (corners heavier), an optional
// setback upper shaft, a parapet crown with a mechanical penthouse and antennas.
export function tower(B, t, rng) {
  const box = local(t, B), W = t.w, D = t.d, H = t.h, pod = 5.2, conc = t.color ?? 0xc8c2b6, glass = t.glassTint ?? 0xd8e0e8;
  box('concrete', -W / 2, 0, -D / 2, W / 2, pod, D / 2, conc);
  box('carGlass', -W / 2 + 0.6, 0.3, D / 2 - 0.25, W / 2 - 0.6, pod - 1.0, D / 2 + 0.02, 0xffffff);
  box('concrete', -W / 2 - 0.3, pod - 0.6, -D / 2 - 0.3, W / 2 + 0.3, pod, D / 2 + 0.3, conc);
  const setback = t.setback && H > 40 ? H * rng.range(0.62, 0.78) : H;
  const sections = setback < H ? [[W, D, pod, setback], [W * 0.78, D * 0.78, setback, H]] : [[W, D, pod, H]];
  for (const [w, d, y0, y1] of sections) {
    box('facade', -w / 2 + 0.3, y0, -d / 2 + 0.3, w / 2 - 0.3, y1, d / 2 - 0.3, glass);
    const piers = (len, f) => { const n = Math.max(2, Math.round(len / 7) + 1); for (let i = 0; i < n; i++) { const a = -len / 2 + (len * i) / (n - 1), cw = i === 0 || i === n - 1 ? 1.5 : 0.7; f(a, cw); } };
    piers(w, (a, cw) => { box('concrete', a - cw / 2, y0, d / 2 - 0.4, a + cw / 2, y1, d / 2 + 0.25, conc); box('concrete', a - cw / 2, y0, -d / 2 - 0.25, a + cw / 2, y1, -d / 2 + 0.4, conc); });
    piers(d, (a, cw) => { box('concrete', w / 2 - 0.4, y0, a - cw / 2, w / 2 + 0.25, y1, a + cw / 2, conc); box('concrete', -w / 2 - 0.25, y0, a - cw / 2, -w / 2 + 0.4, y1, a + cw / 2, conc); });
    box('concrete', -w / 2 - 0.3, y1, -d / 2 - 0.3, w / 2 + 0.3, y1 + 1.3, d / 2 + 0.3, conc); // crown / parapet
    box('tarGravel', -w / 2 + 0.2, y1, -d / 2 + 0.2, w / 2 - 0.2, y1 + 0.3, d / 2 - 0.2, 0xffffff);
  }
  const [tw, td, , top] = sections[sections.length - 1];
  box('concrete', -tw * 0.22, top, -td * 0.18, tw * 0.22, top + 4, td * 0.18, conc); // mechanical penthouse
  if (rng.chance(0.6)) for (const sx of [-1, 1]) B.add('metalPaint', new THREE.CylinderGeometry(0.06, 0.1, 9, 6), mat(t.x, (t.y ?? CURB) + top + 8, t.z).multiply(mat(sx * tw * 0.12, 0, 0)), 0x8a8a8c, { uv: 'native' });
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
