// A walk-in cafe on a building's ground floor, after the user's reference image (style only): polished concrete
// floor and ceiling, warm concrete walls with a dark olive back wall carrying the cafe's name and a palm, floor-to-
// ceiling glass along the street with a door, a structural column, a wood-fronted counter with a stone top down one
// side (register, pastry case) with the barista behind it and the espresso bar and a big chalk menu board on the wall,
// a rust banquette along the back with tables, wood tables and chairs by the window, black pendant lights, a potted
// plant, a framed sunset print and a "GOOD COFFEE / BETTER DAYS" sign on the column.
//
// Room frame: x runs along the street face (from the face's left end, seen from outside), v runs into the building.
// Called by modules/building.js after it carves the room out of the building.

import { MAT, TAG } from '../kit.js';
import { Rng } from '../../core/rng.js';
import { facePoint } from './building.js';

const G = 0.15;
const C = {
  floor: 0x8a8274, ceiling: 0x6e675c, wall: 0x8c8474, back: 0x4a4838, wood: 0x7a4a2a, woodDark: 0x4a2e1c, stone: 0x2a2826,
  metal: 0x1e1e20, glassFrame: 0x2a2a2c, rust: 0x7a3a24, cream: 0xe8dcc0, chalk: 0x1a1c1a, leaf: 0x3a6a32, pot: 0x8a7a68,
  warm: 0xffd8a0, sunset: 0xd8742a,
};

export function furnishCafe(kit, q, H) {
  const { L, s0, s1, depth: Dd, name } = q;
  const rng = new Rng(`cafe:${name}:${Math.round(L.ax)}:${Math.round(L.az)}:${s0}`);
  const W = s1 - s0;
  const tu = { x: (L.bx - L.ax) / L.len, z: (L.bz - L.az) / L.len }, tv = { x: -L.nx, z: -L.nz };
  const at = (x, v) => facePoint(L, (s0 + x) / L.len, -v);
  const rect = (x0, v0, x1, v1) => { const a = at(x0, v0), b = at(x1, v1); return { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) }; };
  const surf = (s) => { kit.boxes[kit.boxes.length - 1].surf = s; };
  const bx = (x0, v0, x1, v1, y0, y1, color, s, mat = MAT.STD) => { const r = rect(x0, v0, x1, v1); kit.box(r.x0, y0, r.z0, r.x1, y1, r.z1, color, mat); if (s) surf(s); };
  const sd = (x0, v0, x1, v1, y0, y1, color, s, mat = MAT.STD, tag = TAG.PROP) => { const r = rect(x0, v0, x1, v1); kit.solid(r.x0, y0, r.z0, r.x1, y1, r.z1, color, mat, tag); if (s) surf(s); };
  const glow = (x0, v0, x1, v1, y0, y1, color) => bx(x0, v0, x1, v1, y0, y1, color, null, MAT.GLOW);
  const sign = (text, kind, x, v, y, w, h, n, color) => { const p = at(x, v); kit.sign(text, kind, p.x, y, p.z, w, h, n.x, n.z, color); };
  const yawOf = (d) => Math.atan2(-d.x, -d.z);
  const dir = (dx, dv) => ({ x: tu.x * dx + tv.x * dv, z: tu.z * dx + tv.z * dv });
  const facingFront = { x: -tv.x, z: -tv.z }, facingLeft = { x: tu.x, z: tu.z }, facingRight = { x: -tu.x, z: -tu.z };
  const brand = name.replace(/\s+CAFE$/, '');

  // ---- shell: floor, linings, ceiling, the glass front with its door, a column -------------------------------------
  sd(0, 0, W, Dd, G - 0.5, G, C.floor, 'concrete', MAT.STD, TAG.GROUND);
  bx(0, 0, 0.03, Dd, G, H, C.wall, 'plaster'); bx(W - 0.03, 0, W, Dd, G, H, C.wall, 'plaster');
  bx(0, Dd - 0.03, W, Dd, G, H, C.back, 'plaster');
  bx(0, 0, W, Dd, H - 0.03, H, C.ceiling, 'concrete');
  const D0 = 1.0, D1 = 2.7; // the door opening (x)
  const pane = (x0, x1) => { sd(x0, 0, x1, 0.1, G, H - 0.45, 0xffffff, 'shopGlass', MAT.GLASS, TAG.BUILDING); for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / Math.max(1, Math.round((x1 - x0) / 2.2))) bx(x - 0.04, -0.02, x + 0.04, 0.12, G, H - 0.45, C.glassFrame, 'metalPaint'); };
  pane(0, D0); pane(D1, W);
  sd(0, 0, W, 0.12, H - 0.45, H, C.glassFrame, 'metalPaint', MAT.STD, TAG.BUILDING); // transom
  bx(D0, -0.02, D0 + 0.06, 0.12, G, H - 0.45, C.glassFrame, 'metalPaint'); bx(D1 - 0.06, -0.02, D1, 0.12, G, H - 0.45, C.glassFrame, 'metalPaint');
  bx(0, 0.12, W, 0.2, G, G + 0.12, C.glassFrame, 'metalPaint'); // sill
  bx(D0 + 0.15, 0.6, D1 - 0.15, 1.6, G, G + 0.012, 0x1e1e1e, 'rubber'); // door mat
  const colX = Math.min(W - 4.6, W * 0.55), colV = 2.0;
  sd(colX - 0.3, colV - 0.3, colX + 0.3, colV + 0.3, G, H, 0x9a9282, 'concrete', MAT.STD, TAG.BUILDING);
  bx(colX - 0.26, colV - 0.32, colX + 0.26, colV - 0.3, 1.5, 2.6, 0x2a2622, 'trim');
  sign('GOOD', 'menu', colX, colV - 0.33, 2.45, 0.5, 0.09, facingFront, 0xe8dcc0);
  sign('COFFEE', 'menu', colX, colV - 0.33, 2.3, 0.5, 0.09, facingFront, 0xe8dcc0);
  bx(colX - 0.08, colV - 0.33, colX + 0.08, colV - 0.32, 1.98, 2.14, 0xe8dcc0, 'trim');
  sign('BETTER', 'menu', colX, colV - 0.33, 1.83, 0.5, 0.09, facingFront, 0xe8dcc0);
  sign('DAYS', 'menu', colX, colV - 0.33, 1.68, 0.5, 0.09, facingFront, 0xe8dcc0);
  // A potted plant by the column.
  bx(colX - 0.95, colV - 0.25, colX - 0.45, colV + 0.25, G, G + 0.5, C.pot, 'trim');
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, p = at(colX - 0.7 + Math.cos(a) * 0.22, colV + Math.sin(a) * 0.22); kit.boxC(p.x, G + 0.95 + (k % 3) * 0.18, p.z, 0.08, 0.7, 0.32, C.leaf, MAT.STD, { ry: a, rz: 0.5, surf: 'trim' }); }

  // ---- the counter down the far side, the espresso bar and the menu board behind it --------------------------------
  const cx0 = W - 3.1, cx1 = W - 2.35, cv0 = 1.6, cv1 = Math.max(cv0 + 3.5, Dd - 2.4);
  sd(cx0, cv0, cx1, cv1, G, 1.0, C.wood, 'planks');
  for (let v = cv0 + 0.5; v < cv1; v += 0.6) bx(cx0 - 0.01, v, cx0, v + 0.03, G + 0.05, 0.95, C.woodDark, 'planks'); // vertical slats
  bx(cx0 - 0.1, cv0 - 0.06, cx1 + 0.04, cv1 + 0.06, 1.0, 1.06, C.stone, 'trim');
  // Register and pastry case on top.
  bx(cx0 + 0.1, cv0 + 0.4, cx0 + 0.5, cv0 + 0.85, 1.06, 1.3, 0x1a1a1c, 'metalPaint');
  bx(cx0 + 0.14, cv0 + 0.45, cx0 + 0.18, cv0 + 0.8, 1.3, 1.55, 0x1a1a1c, 'metalPaint');
  bx(cx0 + 0.05, cv0 + 1.2, cx1 - 0.05, cv0 + 2.6, 1.06, 1.12, 0x2a2826, 'metalPaint');
  for (let k = 0; k < 4; k++) bx(cx0 + 0.15, cv0 + 1.3 + k * 0.32, cx1 - 0.15, cv0 + 1.55 + k * 0.32, 1.12, 1.2, 0xc8904a, 'trim');
  bx(cx0 + 0.05, cv0 + 1.2, cx1 - 0.05, cv0 + 2.6, 1.12, 1.55, 0xffffff, 'shopGlass');
  // Espresso bar along the wall: machine, grinder, cups, a fridge.
  sd(W - 0.7, cv0 - 0.4, W, Dd - 1.0, G, 0.95, C.woodDark, 'planks');
  bx(W - 0.72, cv0 - 0.4, W, Dd - 1.0, 0.95, 1.0, C.stone, 'trim');
  bx(W - 0.62, cv0 + 0.3, W - 0.08, cv0 + 1.4, 1.0, 1.55, 0xb8bcc0, 'chrome');
  for (let k = 0; k < 3; k++) bx(W - 0.7, cv0 + 0.45 + k * 0.32, W - 0.62, cv0 + 0.55 + k * 0.32, 1.12, 1.25, 0x1a1a1c, 'metalPaint');
  bx(W - 0.5, cv0 + 1.7, W - 0.2, cv0 + 2.0, 1.0, 1.55, 0x2a2a2c, 'metalPaint'); // grinder
  for (let k = 0; k < 5; k++) bx(W - 0.45, cv0 + 2.3 + k * 0.14, W - 0.35, cv0 + 2.4 + k * 0.14, 1.0, 1.12, 0xf2efe8, 'trim'); // cups
  bx(W - 0.62, cv0 + 3.0, W - 0.08, cv0 + 3.4, 1.0, 1.4, 0xd8d4cc, 'trim'); // milk jugs and syrups
  // The big menu board on the side wall above the espresso bar.
  const mv = cv0 + 1.4, menuN = facingRight;
  bx(W - 0.09, mv - 1.3, W - 0.03, mv + 1.3, 1.85, 3.75, C.woodDark, 'planks');
  bx(W - 0.1, mv - 1.22, W - 0.09, mv + 1.22, 1.93, 3.67, C.chalk, 'trim');
  sign(name, 'menu', W - 0.11, mv, 3.5, 2.2, 0.22, menuN, 0xf2ecd8);
  const items = [['ESPRESSO', ''], ['AMERICANO', '3.00'], ['LATTE', '3.25'], ['CAPPUCCINO', '3.75'], ['COLD BREW', '3.75'], ['MATCHA LATTE', '3.50'], ['PASTRIES', '3.00']];
  items.forEach(([it, pr], k) => { sign(`${it}${pr ? ' · ' + pr : ''}`, 'menu', W - 0.11, mv, 3.22 - k * 0.18, 2.1, 0.14, menuN, 0xe8e2d0); });

  // ---- back wall: the cafe's name with a palm, a framed sunset print, a small menu; a banquette with tables ------
  const logoX = Math.max(2.6, (W - 3.2) * 0.5);
  sign(brand, 'menu', logoX - 0.45, Dd - 0.05, 2.85, 3.6, 0.6, facingFront, C.cream);
  sign('CAFE', 'menu', logoX - 0.45, Dd - 0.05, 2.32, 2.2, 0.26, facingFront, C.cream);
  palm(logoX + 1.0, 2.3, 1.05);
  // Sunset print.
  const px = Math.min(W - 4.0, logoX + 2.4);
  bx(px - 0.5, Dd - 0.06, px + 0.5, Dd - 0.03, 1.9, 3.1, 0x2a1e16, 'planks');
  bx(px - 0.42, Dd - 0.07, px + 0.42, Dd - 0.06, 1.98, 3.02, C.sunset, 'trim');
  bx(px - 0.42, Dd - 0.075, px + 0.42, Dd - 0.07, 1.98, 2.3, 0x3a1e1a, 'trim');
  palm(px + 0.05, 2.25, 0.45, Dd - 0.08, 0x1a1210);
  // Small menu poster.
  bx(0.9, Dd - 0.06, 1.6, Dd - 0.03, 2.0, 3.0, 0x1a1a1a, 'trim');
  for (let k = 0; k < 6; k++) bx(1.0, Dd - 0.065, 1.5, Dd - 0.06, 2.2 + k * 0.12, 2.24 + k * 0.12, 0xb8b0a0, 'trim');
  // Banquette and its tables.
  const b0 = 0.4, b1 = Math.max(b0 + 2, cx0 - 0.9);
  sd(b0, Dd - 0.6, b1, Dd - 0.03, G, G + 0.32, C.woodDark, 'planks');
  bx(b0, Dd - 0.6, b1, Dd - 0.03, G + 0.32, G + 0.46, C.rust, 'rubber');
  sd(b0, Dd - 0.2, b1, Dd - 0.03, G + 0.46, 1.25, C.rust, 'rubber');
  const seats = [];
  for (let x = b0 + 0.8; x < b1 - 0.6; x += 1.9) {
    table(x, Dd - 1.25, 0.75);
    chair(x, Dd - 1.95, 1);
    seats.push({ x, v: Dd - 0.4, face: dir(0, -1) });
  }
  // Tables by the window.
  for (let x = 1.4; x < colX - 1.0; x += 2.4) for (const v of [2.4, Math.min(Dd - 3.2, 4.8)]) {
    table(x, v, 0.8);
    chair(x, v - 0.7, 1); chair(x, v + 0.7, -1);
    seats.push({ x, v: v - 0.7, face: dir(0, 1), chair: true }, { x, v: v + 0.7, face: dir(0, -1), chair: true });
  }

  // ---- pendant lights ---------------------------------------------------------------------------------------------
  const pendant = (x, v, y = 3.05) => {
    bx(x - 0.02, v - 0.02, x + 0.02, v + 0.02, y + 0.22, H - 0.03, C.metal);
    bx(x - 0.28, v - 0.2, x + 0.28, v + 0.2, y + 0.06, y + 0.22, C.metal, 'metalPaint');
    bx(x - 0.36, v - 0.26, x + 0.36, v + 0.26, y, y + 0.08, C.metal, 'metalPaint');
    glow(x - 0.3, v - 0.2, x + 0.3, v + 0.2, y - 0.01, y, C.warm);
  };
  for (const v of [cv0 + 0.8, (cv0 + cv1) / 2, cv1 - 0.8]) pendant((cx0 + cx1) / 2 - 0.6, v);
  for (let x = 1.4; x < colX - 1.0; x += 2.4) pendant(x, 3.6, 2.75);
  for (let x = b0 + 0.8; x < b1 - 0.6; x += 3.8) pendant(x, Dd - 1.25, 2.6);
  const light = (x, v, power) => { const p = at(x, v); kit.light(p.x, 3.2, p.z, 0xffd8a0, 8, 'shop'); Object.assign(kit.lights[kit.lights.length - 1], { power, tint: 0xffd8a0 }); };
  light(W * 0.35, Dd * 0.4, 0.45); light(cx0 - 0.5, (cv0 + cv1) / 2, 0.4);

  // ---- people: the barista behind the counter, two customers ----------------------------------------------------
  const people = (kit.interiorPeople ||= []);
  const s0n = rng.int(1, 1e6);
  { const p = at(cx1 + 0.75, (cv0 + cv1) / 2 - 0.6); people.push({ x: p.x, y: G, z: p.z, yaw: yawOf(facingRight), pose: 'counter', seed: s0n }); }
  const pickSeats = rng.shuffle(seats.slice()).slice(0, 2);
  pickSeats.forEach((q, i) => { const p = at(q.x, q.v); people.push({ x: p.x, y: G + 0.46 - 0.82, z: p.z, yaw: yawOf(q.face), pose: 'sit', seed: s0n + 1 + i }); });
  // A paper cup and napkins on a window table.
  bx(1.3, 2.3, 1.4, 2.4, 0.78, 0.92, 0xf2efe8, 'trim'); bx(1.55, 2.25, 1.7, 2.35, 0.78, 0.9, 0xe8e4dc, 'trim');

  function table(x, v, s) {
    sd(x - s / 2, v - s / 2, x + s / 2, v + s / 2, 0.74, 0.78, C.wood, 'planks');
    bx(x - 0.04, v - 0.04, x + 0.04, v + 0.04, G, 0.74, C.metal, 'metalPaint');
    bx(x - 0.25, v - 0.25, x + 0.25, v + 0.25, G, G + 0.03, C.metal, 'metalPaint');
  }
  function chair(x, v, faceV) {
    // faceV: +1 faces into the room (+v), -1 faces the front. Seat, a back on the far side, four legs.
    bx(x - 0.22, v - 0.22, x + 0.22, v + 0.22, G + 0.42, G + 0.47, C.woodDark, 'planks');
    const bv = faceV > 0 ? v - 0.22 : v + 0.18;
    bx(x - 0.22, bv, x + 0.22, bv + 0.04, G + 0.47, G + 0.95, C.woodDark, 'planks');
    for (const [dx, dv] of [[-0.19, -0.19], [0.17, -0.19], [-0.19, 0.17], [0.17, 0.17]]) bx(x + dx, v + dv, x + dx + 0.03, v + dv + 0.03, G, G + 0.42, C.woodDark, 'planks');
  }
  // A palm on the back wall in cream (or in silhouette on the print): trunk segments and fronds in the wall plane.
  function palm(x, y0, h, vv = Dd - 0.05, color = C.cream) {
    const n = 5;
    for (let k = 0; k < n; k++) { const t = k / n, p = at(x + Math.sin(t * 1.2) * h * 0.12, vv); rot(p, y0 - h + h * t + h / n / 2, 0.06 * h, h / n, 0.02, -0.12, color); }
    const top = at(x + Math.sin(1.2) * h * 0.12, vv), ty = y0 + 0.02;
    for (const a of [-1.15, -0.65, -0.2, 0.25, 0.7, 1.2]) { const L = 0.55 * h, cxu = Math.sin(a) * L * 0.5, cy = Math.cos(a) * L * 0.5 * 0.55; const p = { x: top.x + tu.x * cxu, z: top.z + tu.z * cxu }; rot(p, ty + cy - 0.04 * h, 0.07 * h, L, 0.02, a + Math.sign(a || 1) * 0.35, color); }
  }
  // A box in the back-wall plane rotated about the wall normal (fronds and trunk segments).
  function rot(p, y, w, hgt, d, ang, color) {
    const alongX = Math.abs(tu.x) > 0.5;
    kit.boxC(p.x, y, p.z, alongX ? w : d, hgt, alongX ? d : w, color, MAT.STD, alongX ? { rz: -ang * Math.sign(tu.x), surf: 'trim' } : { rx: ang * Math.sign(tu.z), surf: 'trim' });
  }
}
