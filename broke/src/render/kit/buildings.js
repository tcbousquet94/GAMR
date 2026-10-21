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
    sign(s.name, W * 0.8, 1.9, 0, H - 1.35, z0 + 0.03, 0, null, '#a8281e', { painted: true, sub: '99¢ & UP', subColor: '#b8261e', icons: true });
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
