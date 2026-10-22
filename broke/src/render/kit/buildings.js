// Non-house buildings for the remastered look, on top of the house builder (same walls, openings and trim):
// apartment walk-ups (unit doors on every floor, a front walkway with railing, an outside stair), corner stores
// (storefront glazing, awning, lettered sign board, window posters), tilt-up warehouses (roll-up doors, painted band,
// wall lamps, bollards), and yard buildings (garages, sheds, site offices).

import * as THREE from 'three';
import { mat } from './batch.js';
import { buildHouse } from './houses.js';
import { CURB, houseYaw } from '../../city/kitdata/data.js';
import { BODEGA, bodegaFixtures } from '../../city/kitdata/bodega.js';

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
  g.textBaseline = 'middle';
  g.fillStyle = fg; g.font = `${opts.painted ? 'italic 800' : '900'} ${Math.round(c.height * main)}px ${opts.painted ? 'Georgia, serif' : 'Arial Black, Arial, sans-serif'}`;
  if (opts.painted) {
    // Hand-painted wall layout: the name across the top, painted products bottom-left, prices bottom-right.
    g.textAlign = 'left'; g.fillText(text, c.width * 0.04, c.height * 0.3, c.width * 0.92);
    if (opts.icons) for (let i = 0; i < 8; i++) { const hgt = c.height * (i % 2 ? 0.26 : 0.34), x = c.width * (0.05 + i * 0.05); g.fillStyle = ['#2a5aa8', '#c83a2a', '#e8e4dc', '#3a8a4a', '#d8b030'][i % 5]; g.fillRect(x, c.height * 0.94 - hgt, c.width * 0.032, hgt); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, c.height * 0.94 - hgt, c.width * 0.032, c.height * 0.04); }
    if (opts.sub) { g.fillStyle = opts.subColor || fg; g.textAlign = 'right'; g.font = `900 ${Math.round(c.height * 0.4)}px Arial Black, Arial, sans-serif`; g.fillText(opts.sub, c.width * 0.96, c.height * 0.75, c.width * 0.5); }
  } else {
    g.textAlign = 'center'; g.fillText(text, c.width / 2, c.height * (opts.sub ? 0.32 : 0.54), c.width * 0.92);
    if (opts.sub) { g.fillStyle = opts.subColor || fg; g.font = `900 ${Math.round(c.height * 0.36)}px Arial Black, Arial, sans-serif`; g.fillText(opts.sub, c.width / 2, c.height * 0.76, c.width * 0.9); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: opts.painted ? 0.9 : 0.7, transparent: !!opts.painted, alphaTest: opts.painted ? 0.05 : 0, polygonOffset: true, polygonOffsetFactor: -2 }));
}

// kind: 'market' (glazed storefront, awning, sign board), 'taco' (a small stand with barred windows, a stone-look
// base and a ring of lettered boards around its roof), 'discount' (a plain stucco box with its name, prices and
// products painted straight onto the street wall).
// opts.interior === false leaves a walk-in market's room out (storeInterior draws it: near the camera only).
export function store(B, s, rng, extras, opts = {}) {
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
    const ink = s.awning ? hex(s.awning) : '#a8281e'; // painted lettering in the shop's own colour
    sign(s.name, W * 0.8, 1.9, 0, H - 1.35, z0 + 0.03, 0, null, ink, { painted: true, sub: rng.pick(['99¢ & UP', 'EVERYTHING 99¢', 'BIG SAVINGS', 'TODO BARATO']), subColor: ink, icons: true });
    return;
  }
  // The walk-in market's look varies (catalogue shopStyle): wall, storeys, parapet, and the facade treatment.
  const floors = s.floors || 1, H = floors > 1 ? 7.4 : 4.4, facade = s.facade || 'awning', parapet = s.parapet || 'flat';
  const wall = s.wallKey === 'brick' ? 'brick' : 'stucco', wallColor = s.wallKey === 'block' ? (s.wallColor ?? 0xd0c8b8) : s.wallColor;
  buildHouse(B, { ...s, roof: 'flat', height: H, floors, wall, wallColor, trim: 0xd0c8b8, storefront: true, door: 0x2a2a2a, fl: 0.15, walkIn: true }, rng);
  if (s.wallKey === 'block') for (let y = 0.6; y < H; y += 0.4) box('trim', -W / 2 - 0.01, y, z0 - 0.02, W / 2 + 0.01, y + 0.02, z0 + 0.012, 0xb8b0a0); // block coursing on the street face
  if (parapet === 'stepped') { // a raised false front over the middle of the facade
    box(wall, -W * 0.28, H, z0 - 0.24, W * 0.28, H + 1.4, z0, wallColor ?? 0xe0d6c0);
    box(wall, -W * 0.4, H, z0 - 0.24, W * 0.4, H + 0.8, z0, wallColor ?? 0xe0d6c0);
    box('trim', -W * 0.29, H + 1.4, z0 - 0.3, W * 0.29, H + 1.52, z0 + 0.06, 0xd8d0c0); box('trim', -W * 0.41, H + 0.8, z0 - 0.3, W * 0.41, H + 0.92, z0 + 0.06, 0xd8d0c0);
  } else if (parapet === 'cornice') box('trim', -W / 2 - 0.15, H + 0.45, z0 - 0.3, W / 2 + 0.15, H + 0.7, z0 + 0.18, 0xc8c0b0);
  const posters = () => { for (let i = 0; i < 3; i++) { const x = -W / 2 + 1.2 + rng.range(0, W - 2.4); if (Math.abs(x) < 1.4) continue; box('trim', x - 0.3, 2.05, z0 - 0.12, x + 0.3, 2.65, z0 - 0.1, rng.pick([0xd8b030, 0xc83a2a, 0x2a6ac8, 0xe8e4dc])); } };
  if (facade === 'canopy') {
    // A flat steel canopy on two posts, the name on its fascia, a smaller board over the door.
    box('metalPaint', -W / 2 + 0.2, 3.0, z0, W / 2 - 0.2, 3.22, z0 + 2.3, 0x3a3e44);
    for (const x of [-W / 2 + 0.5, W / 2 - 0.5]) box('metalPaint', x - 0.06, 0, z0 + 2.1, x + 0.06, 3.0, z0 + 2.22, 0x3a3e44);
    box('metalPaint', -W / 2 + 0.2, 2.85, z0 + 2.3, W / 2 - 0.2, 3.5, z0 + 2.36, s.awning);
    sign(s.name || 'MARKET', W - 1.4, 0.55, 0, 3.17, z0 + 2.38, 0, hex(s.awning), '#f2ede2');
    posters();
  } else if (facade === 'painted') {
    // No awning: coloured stripes and the name painted straight onto the wall above the windows.
    for (const [y, c] of [[2.88, s.awning], [3.02, 0xe8e2d0]]) box('trim', -W / 2, y, z0, W / 2, y + 0.1, z0 + 0.012, c);
    sign(s.name || 'MARKET', W * 0.86, 1.0, 0, 3.75, z0 + 0.02, 0, null, hex(s.awning), { painted: true });
    posters();
  } else if (facade === 'boxsign') {
    // A lit box sign up on the roof on two legs, a short awning strip over the door.
    const sw = Math.min(W - 2, 9), y0 = H + (parapet === 'stepped' ? 1.5 : 0.6);
    for (const x of [-sw / 2 + 0.6, sw / 2 - 0.6]) box('metalPaint', x - 0.06, H, z0 - 1.2, x + 0.06, y0 + 0.1, z0 - 1.08, 0x4a4a4c);
    box('metalPaint', -sw / 2, y0 + 0.1, z0 - 1.3, sw / 2, y0 + 1.6, z0 - 0.98, 0x2a2a2c);
    sign(s.name || 'MARKET', sw - 0.2, 1.3, 0, y0 + 0.85, z0 - 0.97, 0, '#f2ede2', hex(s.awning));
    B.boxM('trim', 3.4, 0.06, 1.2, M.clone().multiply(mat(0, 2.85, z0 + 0.55, 0, 0.32)), s.awning);
    posters();
  } else {
    // Awning: a sloped fabric band with a valance, over the storefront; a sign board above it.
    B.boxM('trim', W - 0.6, 0.06, 1.7, M.clone().multiply(mat(0, 3.15, z0 + 0.8, 0, 0.32)), s.awning);
    box('trim', -W / 2 + 0.3, 2.62, z0 + 1.55, W / 2 - 0.3, 2.95, z0 + 1.62, s.awning);
    posters();
    box('metalPaint', -W / 2 + 0.8, 3.15, z0 + 0.02, W / 2 - 0.8, 4.15, z0 + 0.1, 0x3a3a3c);
    sign(s.name || 'MARKET', W - 2, 0.9, 0, 3.65, z0 + 0.13, 0, '#e8e2d0', hex(s.awning));
  }
  if (opts.interior !== false) bodegaInterior(box, sign, s, rng);
}

// A walk-in market's room on its own (the near-camera interior layer).
export function storeInterior(B, s, rng, extras) {
  if ((s.kind || 'market') !== 'market') return;
  const M = mat(s.x, s.y ?? CURB, s.z, houseYaw(s));
  const box = local(s, B);
  const sign = (text, w, h, x, y, z, ry, bg, fg, o) => { if (!extras || typeof document === 'undefined') return; const m = signMesh(text, w, h, bg, fg, o); m.position.set(x, y, z); m.rotation.y = ry; m.updateMatrix(); m.applyMatrix4(M); extras.push(m); };
  bodegaInterior(box, sign, s, rng);
}

// The walk-in bodega, after the user's reference image (style only): worn checker floor, grimy cream walls, a low
// dark ceiling with pipes and a fluorescent tube, glass-door coolers ("COLD BEER & SODAS") down the left, the counter
// across the back with the register and the clerk's shelves behind, a green BODEGA sign, bottle shelves down the
// right, a chip rack, milk crates and boxes, lotto / EBT / ATM signs, a back door, a mop and a stool. Fixture
// footprints come from kitdata/bodega.js so the colliders match.
function bodegaInterior(box, sign, s, rng) {
  const W = s.w, D = s.d, a = W / 2 - BODEGA.wall, b = D / 2 - BODEGA.wall, F = BODEGA.floor, CEIL = 3.3;
  const fx = Object.fromEntries(bodegaFixtures(W, D).map((f) => [f.name, f]));
  const pick = (arr) => arr[Math.floor(rng.next() * arr.length)];
  // Floor: worn grey-and-cream checker.
  const sq = 0.8;
  for (let x = -a, i = 0; x < a - 0.01; x += sq, i++) for (let z = -b, j = 0; z < b - 0.01; z += sq, j++) box('concrete', x, F, z, Math.min(a, x + sq), F + 0.006, Math.min(b, z + sq), (i + j) % 2 ? 0x2c2b29 : 0xa8a290);
  // Walls: grimy cream lining, darker at the foot; a low dark ceiling with pipes and a tube light.
  const lining = (x0, z0, x1, z1) => { box('plaster', x0, F, z0, x1, CEIL, z1, 0xb4a888); box('plaster', x0, F, z0, x1, 0.5, z1, 0x8a8068); };
  lining(-a, -b, -a + 0.02, b); lining(a - 0.02, -b, a, b); lining(-a, -b, a, -b + 0.02);
  box('plaster', -a, 2.75, b - 0.02, a, CEIL, b, 0xb4a888); // over the front glass
  box('concrete', -a, CEIL, -b, a, CEIL + 0.04, b, 0x4a4640);
  for (const z of [-b + 0.4, 0.6]) box('metalPaint', -a, CEIL - 0.14, z - 0.05, a, CEIL - 0.04, z + 0.05, 0x5a5a58); // pipes
  box('metalPaint', -1.0, CEIL - 0.12, -0.7, 1.0, CEIL - 0.04, -0.3, 0xc8c8c4); box('lamp', -0.95, CEIL - 0.15, -0.65, 0.95, CEIL - 0.12, -0.35, 0xfff2d6); // tube fixture
  box('metalPaint', -1.0, CEIL - 0.12, 2.3, 1.0, CEIL - 0.04, 2.7, 0xc8c8c4); box('lamp', -0.95, CEIL - 0.15, 2.35, 0.95, CEIL - 0.12, 2.65, 0xfff2d6);

  // Coolers down the left wall: dark cabinets, glass doors, lit shelves of cans and bottles.
  { const c = fx.coolers, x1 = c.x1, n = Math.max(2, Math.round((c.z1 - c.z0) / 0.8));
    // Cabinet shell (back, base, top, end caps) so the stock behind the glass shows.
    box('metalPaint', c.x0, F, c.z0, c.x0 + 0.06, F + c.h, c.z1, 0x26302a); box('metalPaint', c.x0, F, c.z0, x1, F + 0.2, c.z1, 0x26302a);
    box('metalPaint', c.x0, F + c.h - 0.1, c.z0, x1, F + c.h, c.z1, 0x26302a);
    box('metalPaint', c.x0, F, c.z0, x1, F + c.h, c.z0 + 0.05, 0x26302a); box('metalPaint', c.x0, F, c.z1 - 0.05, x1, F + c.h, c.z1, 0x26302a);
    box('lamp', c.x0 + 0.08, F + c.h - 0.13, c.z0 + 0.1, x1 - 0.1, F + c.h - 0.1, c.z1 - 0.1, 0xf2f6ff);
    box('metalPaint', c.x0, F + c.h, c.z0, x1 + 0.05, F + c.h + 0.35, c.z1, 0x1e6a3a); // green header
    for (let k = 0; k < n; k++) {
      const z0 = c.z0 + ((c.z1 - c.z0) * k) / n + 0.04, z1 = c.z0 + ((c.z1 - c.z0) * (k + 1)) / n - 0.04;
      for (let r = 0; r < 4; r++) {
        const y = F + 0.25 + r * 0.48;
        box('trim', x1 - 0.55, y, z0 + 0.03, x1 - 0.06, y + 0.03, z1 - 0.03, 0xd8d8d0); // shelf
        for (let zz = z0 + 0.06; zz < z1 - 0.1; zz += 0.11) box('trim', x1 - 0.32, y + 0.03, zz, x1 - 0.22, y + 0.03 + (r % 2 ? 0.16 : 0.24), zz + 0.07, pick([0xc83a2a, 0x2a5aa8, 0xd8b030, 0x3a8a4a, 0xe8e4dc, 0x8a3a8a]));
      }
      box('shopGlass', x1 - 0.02, F + 0.08, z0, x1, F + c.h - 0.08, z1, 0xffffff);
      box('metalPaint', x1, F + 0.08, z1 - 0.04, x1 + 0.03, F + c.h - 0.08, z1, 0x8a8e94); // door frame
      box('chrome', x1 + 0.03, F + 1.0, z1 - 0.12, x1 + 0.06, F + 1.5, z1 - 0.08, 0xffffff); // handle
    }
    sign('COLD BEER & SODAS', Math.min(3.2, c.z1 - c.z0 - 0.4), 0.42, x1 + 0.06, F + c.h + 0.18, (c.z0 + c.z1) / 2, Math.PI / 2, '#1e6a3a', '#f2ecd8');
  }
  // Left wall by the door: lotto and EBT posters, an ATM.
  sign('PLAY LOTTO', 0.9, 1.1, -a + 0.03, 2.35, b - 1.0, Math.PI / 2, '#ece2c4', '#b8261e', { sub: 'MILLIONS IN PRIZES', subColor: '#3a3a3a' });
  sign('WE ACCEPT EBT', 0.7, 0.7, -a + 0.9, 2.3, -b + 0.03, 0, '#ece6d0', '#3a3a3a', { sub: 'FOOD STAMPS' });
  box('metalPaint', -a, F, b - 2.05, -a + 0.55, F + 1.6, b - 1.45, 0x3a3e44); // ATM
  box('trim', -a + 0.55, F + 1.0, b - 1.95, -a + 0.57, F + 1.35, b - 1.55, 0x6a9ab8);
  sign('ATM', 0.55, 0.3, -a + 0.58, F + 1.48, b - 1.75, Math.PI / 2, '#1e6a3a', '#ffffff', { sub: 'HERE' });

  // The counter across the back: wood front, worn top, register, a scratch-ticket case, a tip jar.
  { const c = fx.counter;
    box('planks', c.x0, F, c.z0, c.x1, F + c.h, c.z1, 0x5a3a26);
    box('trim', c.x0 - 0.05, F + c.h, c.z0 - 0.05, c.x1 + 0.05, F + c.h + 0.05, c.z1 + 0.08, 0x6e6458);
    box('metalPaint', -0.7, F + c.h + 0.05, c.z0 + 0.15, -0.2, F + c.h + 0.3, c.z0 + 0.55, 0x2a2a2c); // register
    box('trim', -0.65, F + c.h + 0.3, c.z0 + 0.2, -0.25, F + c.h + 0.45, c.z0 + 0.25, 0x3a8a6a);
    box('shopGlass', c.x0 + 0.2, F + c.h + 0.05, c.z0 + 0.1, c.x0 + 1.3, F + c.h + 0.35, c.z1 - 0.05, 0xffffff); // scratch tickets
    for (let k = 0; k < 6; k++) box('trim', c.x0 + 0.25 + k * 0.17, F + c.h + 0.06, c.z0 + 0.2, c.x0 + 0.38 + k * 0.17, F + c.h + 0.08, c.z1 - 0.15, pick([0xd8b030, 0xc83a2a, 0x2a6ac8, 0x3a8a4a]));
    box('shopGlass', 0.6, F + c.h + 0.05, c.z1 - 0.3, 0.8, F + c.h + 0.3, c.z1 - 0.1, 0xffffff); // tip jar
  }
  // Behind the counter: shelves of cigarettes and sundries; the BODEGA sign above; a back door.
  { const c = fx.backShelves;
    box('planks', c.x0, F, c.z0, c.x1, F + c.h, c.z1, 0x4a3426);
    for (let r = 0; r < 5; r++) { const y = F + 0.3 + r * 0.36; for (let x = c.x0 + 0.08; x < c.x1 - 0.12; x += 0.16) box('trim', x, y, c.z1 - 0.02, x + 0.13, y + 0.2 + (r % 2) * 0.06, c.z1 + 0.06, pick([0xe8e4dc, 0xc83a2a, 0x2a5aa8, 0xd8b030, 0x3a3a3a, 0x8a6a3a])); }
    sign('BODEGA', 2.6, 0.75, (c.x0 + c.x1) / 2, F + c.h + 0.6, -b + 0.04, 0, '#1e6a3a', '#f2ecd8', { sub: 'THANK YOU, COME AGAIN!', subColor: '#e8e0c8' });
  }
  box('metalPaint', 1.7, F, -b, 2.6, F + 2.15, -b + 0.06, 0x3a3a38); box('chrome', 2.45, F + 1.0, -b + 0.06, 2.52, F + 1.08, -b + 0.1, 0xffffff);
  sign('NO LOITERING', 0.6, 0.2, 2.15, F + 1.5, -b + 0.08, 0, '#e8e4dc', '#2a2a2a');
  sign('PALMETTO', 0.7, 0.95, 3.4, 2.3, -b + 0.03, 0, '#e8e4dc', '#2a2a2a', { sub: '2002' });
  // Mop and bucket by the back door, a stool behind the counter.
  box('metalPaint', 2.9, F, -b + 0.4, 3.3, F + 0.32, -b + 0.8, 0x6a6a6e); box('planks', 3.05, F + 0.3, -b + 0.55, 3.09, F + 1.5, -b + 0.59, 0x8a6a4a);
  box('chrome', 1.75, F, -b + 0.95, 1.8, F + 0.7, -b + 1.0, 0xffffff); box('rubber', 1.55, F + 0.7, -b + 0.75, 2.0, F + 0.78, -b + 1.2, 0x8a2622);

  // Bottle shelves down the right wall; a cigarette sign and an energy-drink sign over them.
  { const c = fx.bottleShelves;
    box('planks', c.x0, F, c.z0, c.x1, F + c.h, c.z1, 0x3e2e22);
    for (let r = 0; r < 5; r++) { const y = F + 0.25 + r * 0.42; box('trim', c.x0 - 0.03, y - 0.03, c.z0, c.x0, y, c.z1, 0x2a2420); for (let z = c.z0 + 0.06; z < c.z1 - 0.1; z += 0.17) { const hgt = r < 2 ? 0.32 : 0.26; box('trim', c.x0 - 0.02, y, z, c.x0 + 0.08, y + hgt, z + 0.08, pick([0xa8701e, 0x4a8a3a, 0xd8d4c8, 0x8a2a1e, 0x3a3a52, 0xc8a040])); box('trim', c.x0, y + hgt, z + 0.02, c.x0 + 0.06, y + hgt + 0.06, z + 0.06, 0xd8c8a0); } }
    sign('CIGARETTES', 2.4, 0.8, a - 0.03, 2.85, (c.z0 + c.z1) / 2 - 1.0, -Math.PI / 2, '#b8261e', '#f2ecd8', { sub: 'FILTER KINGS' });
    sign('ENERGIA', 1.0, 0.5, c.x0 - 0.04, F + c.h - 0.4, c.z1 - 0.8, -Math.PI / 2, '#2a7a3a', '#f2ecd8', { sub: 'GUARANA' });
  }
  // A wire rack of chips in front of the counter.
  { const c = fx.chipRack;
    for (const [x, z] of [[c.x0, c.z0], [c.x1, c.z0], [c.x0, c.z1], [c.x1, c.z1]]) box('metalPaint', x - 0.02, F, z - 0.02, x + 0.02, F + c.h, z + 0.02, 0x2a2a2c);
    for (let r = 0; r < 4; r++) { const y = F + 0.2 + r * 0.32; box('metalPaint', c.x0, y, c.z0, c.x1, y + 0.02, c.z1, 0x3a3a3c); for (let k = 0; k < 3; k++) box('trim', c.x0 + 0.04 + k * 0.25, y + 0.02, c.z0 + 0.1, c.x0 + 0.24 + k * 0.25, y + 0.26, c.z1 - 0.1, pick([0xd8b030, 0xc83a2a, 0x3a8a4a, 0xe8a030])); }
  }
  // Milk crates and boxes along the bottle shelves.
  { const c = fx.crates;
    for (let z = c.z0; z < c.z1 - 0.4; z += 0.55) { const n = 1 + Math.floor(rng.next() * 2); for (let k = 0; k < n; k++) box(rng.next() < 0.6 ? 'metalPaint' : 'planks', c.x0 + 0.05, F + k * 0.36, z, c.x0 + 0.5, F + (k + 1) * 0.36 - 0.02, z + 0.5, rng.next() < 0.6 ? pick([0x2a4a9a, 0xb8302a]) : 0xa88a5a); }
  }
  // A green trash can by the door and a mat inside it.
  box('metalPaint', a - 1.1, F, b - 1.1, a - 0.5, F + 0.95, b - 0.5, 0x2a5a3a);
  box('planks', -0.75, F, b - 1.3, 0.75, F + 0.012, b - 0.35, 0x6a4a30);
}

// High-rise in one of four styles (all from the same shell code):
//   piers   window-bay facade between protruding concrete piers
//   brick   brick with punched windows, belt courses, a heavy cornice and a timber water tank on the roof
//   plaster rendered walls with wide windows and ribbon ledges every few floors
//   glass   a reflective curtain wall with slim corner fins
// Footprint: a plain slab, an L (a wing set back to one side) or a setback upper shaft. Crown: flat parapet, stepped,
// a sloped hat, or a rooftop billboard. A glazed podium at street level.
const SKIN = { piers: 'facade', brick: 'punchBrick', plaster: 'punchPlaster', glass: 'curtain' };
export function tower(B, t, rng, extras) {
  const style = t.style || 'piers', box = local(t, B), W = t.w, D = t.d, H = t.h, pod = 5.2, conc = t.color ?? 0xc8c2b6;
  const skin = SKIN[style], tint = t.skinTint ?? 0xffffff;
  box('concrete', -W / 2, 0, -D / 2, W / 2, pod, D / 2, conc);
  box('carGlass', -W / 2 + 0.6, 0.3, D / 2 - 0.25, W / 2 - 0.6, pod - 1.0, D / 2 + 0.02, 0xffffff);
  box('concrete', -W / 2 - 0.3, pod - 0.6, -D / 2 - 0.3, W / 2 + 0.3, pod, D / 2 + 0.3, conc);
  // Footprint sections: [cx, cz, w, d, y0, y1].
  let secs;
  if (t.shape === 'L' && W > 22) secs = [[-W * 0.18, 0, W * 0.64, D, pod, H], [W * 0.32, -D * 0.2, W * 0.36, D * 0.6, pod, H * rng.range(0.55, 0.8)]];
  else if (t.setback && H > 40) { const sb = H * rng.range(0.6, 0.78); secs = [[0, 0, W, D, pod, sb], [0, 0, W * 0.76, D * 0.76, sb, H]]; }
  else secs = [[0, 0, W, D, pod, H]];
  for (const [cx, cz, w, d, y0, y1] of secs) {
    const X0 = cx - w / 2, X1 = cx + w / 2, Z0 = cz - d / 2, Z1 = cz + d / 2;
    box(skin, X0 + 0.3, y0, Z0 + 0.3, X1 - 0.3, y1, Z1 - 0.3, tint);
    const piers = (len, f) => { const n = Math.max(2, Math.round(len / 7) + 1); for (let i = 0; i < n; i++) { const a = -len / 2 + (len * i) / (n - 1), cw = i === 0 || i === n - 1 ? 1.5 : 0.7; f(a, cw); } };
    if (style === 'piers') {
      piers(w, (a, cw) => { box('concrete', cx + a - cw / 2, y0, Z1 - 0.4, cx + a + cw / 2, y1, Z1 + 0.25, conc); box('concrete', cx + a - cw / 2, y0, Z0 - 0.25, cx + a + cw / 2, y1, Z0 + 0.4, conc); });
      piers(d, (a, cw) => { box('concrete', X1 - 0.4, y0, cz + a - cw / 2, X1 + 0.25, y1, cz + a + cw / 2, conc); box('concrete', X0 - 0.25, y0, cz + a - cw / 2, X0 + 0.4, y1, cz + a + cw / 2, conc); });
    } else if (style === 'glass') {
      for (const [x, z] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) box('metalPaint', x - 0.35, y0, z - 0.35, x + 0.35, y1, z + 0.35, 0x8a9098);
    } else {
      // Ledges: belt courses (brick) every 4 floors, ribbon ledges (plaster) every 3.
      const every = style === 'brick' ? 14 : 10.5;
      for (let y = y0 + every; y < y1 - 2; y += every) box(style === 'brick' ? 'concrete' : 'trim', X0 + 0.15, y - 0.18, Z0 + 0.15, X1 - 0.15, y, Z1 - 0.15, style === 'brick' ? 0xc8c0b0 : conc);
      for (const [x, z] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) box(style === 'brick' ? 'concrete' : 'plaster', x - 0.45, y0, z - 0.45, x + 0.45, y1, z + 0.45, style === 'brick' ? 0xb8ae9c : conc); // quoins / corner pilasters
    }
    // Crown.
    const cornice = style === 'brick' ? 1.4 : style === 'glass' ? 0.6 : 1.1;
    box('concrete', X0 - 0.35, y1, Z0 - 0.35, X1 + 0.35, y1 + cornice, Z1 + 0.35, style === 'glass' ? 0x8a9098 : conc);
    box('tarGravel', X0 + 0.2, y1, Z0 + 0.2, X1 - 0.2, y1 + 0.3, Z1 - 0.2, 0xffffff);
  }
  const [tcx, tcz, tw, td, , top] = secs[0];
  const crown = t.crown || 'flat', Mw = mat(t.x, t.y ?? CURB, t.z, houseYaw(t));
  if (crown === 'stepped') { box('concrete', tcx - tw * 0.3, top, tcz - td * 0.3, tcx + tw * 0.3, top + 3.5, tcz + td * 0.3, conc); box('concrete', tcx - tw * 0.16, top + 3.5, tcz - td * 0.16, tcx + tw * 0.16, top + 6.5, tcz + td * 0.16, conc); }
  else if (crown === 'hat') {
    const ht = Math.min(tw, td) * 0.35, g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4);
    B.add(style === 'glass' ? 'curtain' : 'metal', g, Mw.clone().multiply(mat(tcx, top + 1 + ht / 2, tcz, 0, 0, 0, tw, ht, td)), style === 'glass' ? 0xffffff : 0x7a8a82);
  } else box('concrete', tcx - tw * 0.22, top, tcz - td * 0.18, tcx + tw * 0.22, top + 4, tcz + td * 0.18, conc); // mechanical penthouse
  if (style === 'brick') waterTank(B, Mw, tcx + tw * 0.25, top + 0.3, tcz - td * 0.2);
  if (crown === 'billboard') billboard(B, Mw, tcx, top + 1.2, tcz + td / 2 - 1.5, Math.min(tw - 2, 14), rng, extras);
  else if (rng.chance(0.5)) for (const sx of [-1, 1]) B.add('metalPaint', new THREE.CylinderGeometry(0.06, 0.1, 9, 6), Mw.clone().multiply(mat(tcx + sx * tw * 0.12, top + 8, tcz)), 0x8a8a8c, { uv: 'native' });
}

// A timber water tank on steel legs with a conical cap (classic on brick roofs).
export function waterTank(B, M, x, y, z) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.boxM('metalPaint', 0.16, 3, 0.16, M.clone().multiply(mat(x + dx * 1.2, y + 1.5, z + dz * 1.2)), 0x3a3a3c);
  B.add('planks', new THREE.CylinderGeometry(1.7, 1.75, 3.2, 16, 1), M.clone().multiply(mat(x, y + 4.6, z)), 0x9a8468, { uv: 'native', uvScale: [10.7, 3.2] });
  B.add('metal', new THREE.ConeGeometry(1.9, 1.3, 16), M.clone().multiply(mat(x, y + 6.85, z)), 0x6a6a68, { uv: 'native', uvScale: [6, 1.3] });
}
const ADS = [['LAWYER UP', '1-800-SUE-THEM'], ['PAYDAY PALS', 'CASH TODAY'], ['BIG GULP CITY', '64 OZ 99¢'], ['SMILE DENTAL', 'PAYMENT PLANS'], ['QUIKBAIL', 'OPEN 24 HOURS'], ['MEGA LOTTO', 'YOU COULD BE NEXT'], ['ACE STORAGE', 'YOUR STUFF. OUR PROBLEM.']];
const AD_BG = ['#d8a83a', '#3a6ab8', '#c84a3a', '#2f8d5a', '#e8e4dc', '#7a3aa0'];
// A rooftop billboard: steel frame, catwalk, a lettered ad facing the street (+z).
export function billboard(B, M, x, y, z, w, rng, extras) {
  const h = w * 0.34;
  for (const s2 of [-0.35, 0.35]) B.boxM('metalPaint', 0.25, h + 1.5, 0.25, M.clone().multiply(mat(x + s2 * w, y + (h + 1.5) / 2, z - 0.5)), 0x3a3840);
  B.boxM('metalPaint', w + 0.3, h + 0.3, 0.25, M.clone().multiply(mat(x, y + 1.5 + h / 2, z - 0.25)), 0x3a3840);
  B.boxM('metalPaint', w, 0.06, 0.8, M.clone().multiply(mat(x, y + 1.3, z + 0.3)), 0x4a4a4c);
  if (extras && typeof document !== 'undefined') {
    const [a, b] = rng.pick(ADS), bg = rng.pick(AD_BG);
    const m = signMesh(a, w, h, bg, bg === '#e8e4dc' ? '#2a2a2a' : '#ffffff', { sub: b, subColor: bg === '#e8e4dc' ? '#c83a2a' : '#ffffff' });
    m.position.set(x, y + 1.5 + h / 2, z - 0.1); m.updateMatrix(); m.applyMatrix4(M); extras.push(m);
  }
}

// A steel fire escape on a side wall (+x face): a landing per upper floor, railings, stairs between, a drop ladder.
export function fireEscape(B, M, xWall, zc, floors, fl, rng) {
  const c = 0x2a2a2c, w = 3.2;
  for (let f = 1; f < floors; f++) {
    const y = fl + f * 2.9;
    B.boxM('metalPaint', 1.1, 0.06, w, M.clone().multiply(mat(xWall + 0.55, y, zc)), c);
    B.boxM('metalPaint', 0.04, 0.04, w, M.clone().multiply(mat(xWall + 1.08, y + 0.95, zc)), c);
    for (let k = -1; k <= 1; k++) B.boxM('metalPaint', 0.04, 0.95, 0.04, M.clone().multiply(mat(xWall + 1.08, y + 0.48, zc + k * w / 2)), c);
    if (f > 1) { const L = Math.hypot(2.9, w * 0.8); B.boxM('metalPaint', 0.6, 0.05, L, M.clone().multiply(mat(xWall + 0.5, y - 1.45, zc, 0, Math.atan2(2.9, w * 0.8) * (f % 2 ? 1 : -1))), c); }
  }
  B.boxM('metalPaint', 0.4, 2.6, 0.05, M.clone().multiply(mat(xWall + 0.9, fl + 2.9 - 1.4, zc + w / 2 - 0.3)), c); // drop ladder
}

// Extras for mid-rise storefront blocks: a heavier cornice, rooftop water tank / AC / billboard, a fire escape.
export function blockExtras(B, b, rng, extras) {
  const M = mat(b.x, b.y ?? CURB, b.z, houseYaw(b)), fl = 0.15, H = fl + (b.floors || 3) * 2.9;
  const box = local(b, B);
  box('concrete', -b.w / 2 - 0.25, H + 0.5, -b.d / 2 - 0.25, b.w / 2 + 0.25, H + 0.85, b.d / 2 + 0.25, b.cornice ?? 0xc8c0b0);
  if (b.fireEscape && b.floors >= 3) fireEscape(B, M, b.w / 2, rng.range(-b.d / 4, b.d / 4), b.floors, fl, rng);
  const r = rng.next();
  if (r < 0.3) waterTank(B, M, rng.range(-b.w / 4, b.w / 4), H + 0.6, -b.d / 4);
  else if (r < 0.55 && b.w > 10) billboard(B, M, 0, H + 0.6, b.d / 2 - 1.2, Math.min(b.w - 2, 11), rng, extras);
  else { box('metal', -1.2, H, -1, 0.6, H + 1.1, 0.4, 0xb8b8b4); box('metal', 1.4, H, -2, 2.6, H + 0.9, -1, 0xb0b0ac); }
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
