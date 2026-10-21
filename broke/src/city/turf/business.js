// The business base template: one shared layout every business uses, so capturing always works the same way.
// It reads as a real corner business (storefront, big windows, roll-down gate, counter and register) and plays as a
// defendable base: a side alley with a back door, a roof reached by an alley ladder with AC units for cover,
// sidewalk cover out front and a small fenced back lot.
//
// Built in a local frame: u runs along the street frontage (u=0 at the block corner), v runs from the property
// line into the block. Per-type differences live in slots (TYPES below), never in the layout.

import { MAT, TAG } from '../kit.js';
import { G } from '../modules/building.js';
import { placeProp } from '../modules/streets.js';
import { TAGS } from './worn.js';
import { Rng } from '../../core/rng.js';

// Business types with a full walk-in interior (seen through clear front windows).
const FURNISHED = new Set(['diner']);

export const TEMPLATE = { F: 13, D: 16, H: 7.4, A: 4.2, L: 9, ground: 3.4, wall: 0.3 };

// Slots per business type: sign, awning colour, window display, interior and exterior props.
export const TYPES = {
  bodega: { label: 'Bodega', sign: 'neon', signColor: 0x33e0ff, awning: 0x2f7a4a, wall: 0x6a3d34, display: ['COLD BEER', 'LOTTO', 'ATM'], names: ['Rivera Deli & Grocery', 'Lucky Star Bodega', '24/7 Mini Mart', 'El Sol Grocery', 'Corner Stop', 'Golden Apple Deli', 'Big Mike Deli', 'Nice Price Market'] },
  pawn: { label: 'Pawn Shop', sign: 'neon', signColor: 0xffd34a, awning: 0x6e2f5c, wall: 0x5c3530, display: ['WE BUY GOLD', 'LOANS'], names: ['Gold & Pawn', 'Second Chance Pawn', 'King Loans', 'Cash Kings', 'Lucky 7 Pawn'] },
  laundromat: { label: 'Laundromat', sign: 'store', signColor: 0x8fd4ff, awning: 0x3a6aa8, wall: 0x7c7884, display: ['WASH & FOLD'], names: ['Suds City', 'Spin Cycle', 'Bubbles Laundromat', 'Clean Getaway'] },
  boxing: { label: 'Boxing Gym', sign: 'paint', signColor: 0xe8e0d0, awning: 0x8a2a2a, wall: 0x4f3431, display: ['NO PAIN', 'FIGHT NIGHT'], names: ['Ironside Boxing', 'Glass Jaw Gym', 'Southpaw Club', 'Bell to Bell Boxing'] },
  auto: { label: 'Auto Shop', sign: 'paint', signColor: 0xffb03a, awning: 0x4a4652, wall: 0x6f6c76, display: ['BRAKES', 'TIRES'], names: ["Tony's Auto", 'Quick Lube & Tire', 'Downtown Auto Body', 'Lug Nut Garage'] },
  clinic: { label: 'Clinic', sign: 'store', signColor: 0xe8f4ee, awning: 0x4a8a7a, wall: 0x7c7884, display: ['WALK-INS'], names: ['Downtown Walk-In Clinic', 'Mercy Street Clinic', 'Fifth St Urgent Care'] },
  diner: { label: 'Diner', sign: 'neon', signColor: 0xff5fd0, awning: 0xb03a3a, wall: 0x8a8590, display: ['OPEN 24 HRS', 'PIE'], names: ['Night Owl Diner', "Rosie's Grill", 'The Starlite', 'Eastside Eats', 'Pancake Palace'] },
};

// Frame helpers. C = block corner on the property line; tu = unit vector along the frontage; tv = into the block.
export function frame(C, tu, tv) {
  const at = (u, v) => ({ x: C.x + tu.x * u + tv.x * v, z: C.z + tu.z * u + tv.z * v });
  const rect = (u0, v0, u1, v1) => {
    const a = at(u0, v0), b = at(u1, v1);
    return { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) };
  };
  return { at, rect, tu, tv, C, out: { x: -tv.x, z: -tv.z }, yawOut: Math.atan2(-tv.x, -tv.z) };
}

// Footprint the business reserves in its block (building, alley, back lot) plus a buffer.
export function footprint(fr) {
  const T = TEMPLATE;
  return fr.rect(-0.5, 0, T.F + T.A + 1, T.D + T.L + 1);
}

export function buildBusiness(kit, fr, biz, opts = {}) {
  const T = TEMPLATE, { rng, pal } = kit;
  const S = TYPES[biz.type];
  const { F, D, H, A, L, wall: t } = T, GH = T.ground;
  const R = (u0, v0, u1, v1) => fr.rect(u0, v0, u1, v1);
  const solid = (u0, v0, u1, v1, y0, y1, color, mat = MAT.STD, tag = TAG.BUILDING) => {
    const r = R(u0, v0, u1, v1);
    return kit.solid(r.x0, y0, r.z0, r.x1, y1, r.z1, color, mat, tag);
  };
  const box = (u0, v0, u1, v1, y0, y1, color, mat = MAT.STD) => { const r = R(u0, v0, u1, v1); kit.box(r.x0, y0, r.z0, r.x1, y1, r.z1, color, mat); };
  const P = (u, v, y = G) => { const p = fr.at(u, v); return { x: p.x, y, z: p.z }; };
  const wallC = S.wall, trim = 0x8f8a93, glass = 0x6f9ac8, floorC = 0x8a8590;
  const out = fr.out;
  biz.cover = [];
  const cover = (u0, v0, u1, v1, y0, y1, kind) => { const r = R(u0, v0, u1, v1); biz.cover.push({ ...r, y0, y1, kind }); };

  // Ground: lot floor, alley paving, back lot.
  solid(0, 0, F, D, -1, G, floorC, MAT.STD, TAG.GROUND);
  kit.boxes[kit.boxes.length - 1].surf = 'tile'; // shop floor: vinyl tile in the kit look
  solid(F, 0, F + A, D + L, -1, G, 0x46434c, MAT.STD, TAG.GROUND);
  solid(0, D, F, D + L, -1, G, 0x5a5660, MAT.STD, TAG.GROUND);

  // ---- front wall (v = 0..t): big window, door with a roll-down gate, piers ------------------------------------
  const doorU0 = F - 3.6, doorU1 = F - 1.8, winU0 = 0.6, winU1 = F - 4.1;
  solid(0, 0, winU0, t, G, GH, wallC);
  solid(winU0, 0, winU1, t, G, 0.85, wallC); // knee wall
  solid(winU0, 0, winU1, t, 0.85, 2.85, glass, MAT.GLASS); // big front window
  if (FURNISHED.has(biz.type)) kit.boxes[kit.boxes.length - 1].surf = 'shopGlass';
  solid(winU0, 0, winU1, t, 2.85, GH, wallC);
  solid(winU1, 0, doorU0, t, G, GH, wallC);
  solid(doorU0, 0, doorU1, t, 2.55, GH, wallC); // over the door
  solid(doorU1, 0, F, t, G, GH, wallC);
  // Roll-down security gate: rolled up into its housing (open). Later it can drop and block the door.
  box(doorU0 - 0.15, -0.35, doorU1 + 0.15, 0, 2.55, 2.95, 0x55525a, MAT.METAL);
  for (let y = 2.6; y < 2.95; y += 0.08) box(doorU0 - 0.1, -0.37, doorU1 + 0.1, -0.35, y, y + 0.03, 0x6a6770, MAT.METAL);
  const gr = R(doorU0, -0.4, doorU1, 0);
  biz.gate = { ...gr, y0: G, y1: 2.55, open: true };
  biz.door = P((doorU0 + doorU1) / 2, -0.8);
  biz.doorInside = P((doorU0 + doorU1) / 2, 1.2);
  // Mullions on the big window.
  for (let u = winU0 + 2.5; u < winU1 - 0.5; u += 2.5) box(u - 0.06, -0.05, u + 0.06, t + 0.05, 0.85, 2.85, pal.metal, MAT.METAL);

  // ---- side walls ----------------------------------------------------------------------------------------------
  // Corner side (u = 0): windows when it faces a street (a true corner shop), blank otherwise.
  if (opts.cornerStreet) {
    solid(0, t, t, 1.4, G, GH, wallC);
    solid(0, 1.4, t, 7.6, G, 0.85, wallC);
    solid(0, 1.4, t, 7.6, 0.85, 2.85, glass, MAT.GLASS);
    if (FURNISHED.has(biz.type)) kit.boxes[kit.boxes.length - 1].surf = 'shopGlass';
    solid(0, 1.4, t, 7.6, 2.85, GH, wallC);
    solid(0, 7.6, t, D, G, GH, wallC);
  } else solid(0, t, t, D, G, GH, wallC);
  // Alley side (u = F): the back door near the rear.
  const bd0 = D - 3.6, bd1 = D - 2.4;
  solid(F - t, t, F, bd0, G, GH, wallC);
  solid(F - t, bd0, F, bd1, 2.3, GH, wallC);
  solid(F - t, bd1, F, D, G, GH, wallC);
  box(F, bd0 - 0.1, F + 0.08, bd1 + 0.1, G, 2.35, 0x3a3640, MAT.METAL); // door frame
  // Tag on the alley wall, between the street and the ladder.
  { const g = fr.at(F + 0.04, 4.5); kit.sign(rng.pick(TAGS), 'graffiti', g.x, 1.8, g.z, 3.5, 1.3, fr.tu.x, fr.tu.z, rng.pick([0x33e0ff, 0xff3fb8, 0xffd34a, 0x7dff4a, 0xe8e4dc])); }
  biz.backDoor = P(F + 1.2, (bd0 + bd1) / 2);
  biz.backDoorInside = P(F - 1.2, (bd0 + bd1) / 2);
  kit.light(fr.at(F + 0.3, bd1 + 0.4).x, 2.9, fr.at(F + 0.3, bd1 + 0.4).z, 0xffb36a, 5, 'alley');
  // Back wall.
  solid(0, D - t, F, D, G, GH, wallC);

  // ---- upper floor mass, roof, parapet, AC units ------------------------------------------------------------------
  solid(0, 0, F, D, GH, H, wallC);
  box(-0.2, -0.2, F + 0.2, D + 0.2, H - 0.45, H, trim); // cornice
  const par = (u0, v0, u1, v1) => solid(u0, v0, u1, v1, H, H + 0.6, pal.roof, MAT.STD, TAG.RAIL);
  par(0, 0, F, 0.3); par(0, D - 0.3, F, D); par(0, 0.3, 0.3, D - 0.3); par(F - 0.3, 0.3, F, D - 0.3);
  box(0.3, 0.3, F - 0.3, D - 0.3, H - 0.02, H + 0.02, pal.roof);
  for (const [u, v] of [[3.2, 5], [3.2, 11]]) {
    solid(u - 1.0, v - 0.75, u + 1.0, v + 0.75, H, H + 1.25, 0x9a98a0, MAT.METAL, TAG.PROP);
    box(u - 0.6, v - 0.45, u + 0.6, v + 0.45, H + 1.25, H + 1.32, 0x55525a, MAT.METAL); // fan grille
    cover(u - 1.0, v - 0.75, u + 1.0, v + 0.75, H, H + 1.25, 'ac');
  }
  box(F - 4, 7, F - 2.6, 8.4, H, H + 0.5, 0x6a6770); // roof hatch
  // Upper-floor windows (lit at night) on the street faces.
  for (let u = 1.8; u < F - 1; u += 3.2) kit.quad(fr.at(u, -0.04).x, 5.4, fr.at(u, -0.04).z, 1.6, 1.7, out.x, out.z, rng.pick(pal.windowDay), rng.chance(0.55) ? rng.pick(pal.windowNight) : pal.windowDark);
  if (opts.cornerStreet) for (let v = 2; v < D - 1; v += 3.2) {
    const p = fr.at(-0.04, v), n = { x: -fr.tu.x, z: -fr.tu.z };
    kit.quad(p.x, 5.4, p.z, 1.6, 1.7, n.x, n.z, rng.pick(pal.windowDay), rng.chance(0.5) ? rng.pick(pal.windowNight) : pal.windowDark);
  }
  biz.roof = P(F / 2 + 1.5, D / 2, H);

  // Alley ladder up to the roof (on the business's alley wall).
  const lv = 8.6;
  const lr = R(F, lv, F + 0.9, lv + 1.0);
  kit.climb(lr.x0, 0, lr.z0, lr.x1, H + 0.7, lr.z1, 'ladder', 'street', 'roof');
  biz.ladder = { bottom: P(F + 1.6, lv + 0.5), top: P(F - 1.2, lv + 0.5, H) };

  // ---- storefront dressing: awning, sign, window display, interior glow ----------------------------------------
  const ap = fr.at(winU0 + (doorU1 - winU0) / 2, -0.9);
  const along = Math.abs(fr.tu.x) > 0.5;
  kit.boxC(ap.x, 3.05, ap.z, along ? doorU1 - winU0 + 0.6 : 1.8, 0.16, along ? 1.8 : doorU1 - winU0 + 0.6, S.awning, MAT.STD, {
    rx: along ? -out.z * 0.3 : 0, rz: along ? 0 : out.x * 0.3,
  });
  const sp = fr.at(F / 2, -0.12);
  kit.sign(biz.name.toUpperCase(), S.sign === 'store' ? 'store' : S.sign, sp.x, 4.25, sp.z, F - 2, 1.25, out.x, out.z, S.signColor);
  const dsp = fr.at((winU0 + winU1) / 2, 0.36);
  kit.sign(rng.pick(S.display), 'neon', dsp.x, 2.2, dsp.z, Math.min(4, winU1 - winU0 - 1), 0.6, out.x, out.z, S.signColor);
  // Interior glow panel behind the window (the kit look draws it as an opaque window, so a furnished room skips it).
  if (!FURNISHED.has(biz.type)) kit.quad(fr.at((winU0 + winU1) / 2, 0.4).x, 1.85, fr.at((winU0 + winU1) / 2, 0.4).z, winU1 - winU0 - 0.4, 1.9, out.x, out.z, 0x4a5670, 0xffd9a0);
  kit.light(fr.at(F / 2, D / 2).x, 3.0, fr.at(F / 2, D / 2).z, 0xfff0d8, 9, 'shop');
  if (S.sign === 'neon') kit.light(sp.x + out.x * 0.6, 4.3, sp.z + out.z * 0.6, S.signColor, 6, 'neon');
  // Interior ceiling trim so the room reads from the windows.
  box(t, t, F - t, D - t, GH - 0.12, GH - 0.06, 0xd8d4cc);

  // ---- counter with the register (the capture point) -------------------------------------------------------------
  const cu0 = F - 6.3, cu1 = F - 5.3, cv0 = 1.5, cv1 = 5.2;
  solid(cu0, cv0, cu1, cv1, G, 1.12, 0x4a4652, MAT.STD, TAG.PROP);
  box(cu0 - 0.08, cv0 - 0.08, cu1 + 0.08, cv1 + 0.08, 1.12, 1.18, 0xc8c0b8);
  cover(cu0, cv0, cu1, cv1, G, 1.12, 'counter');
  const reg = fr.at((cu0 + cu1) / 2, cv0 + 1.0);
  kit.box(reg.x - 0.22, 1.18, reg.z - 0.18, reg.x + 0.22, 1.42, reg.z + 0.18, 0x2a2830, MAT.METAL);
  kit.box(reg.x - 0.16, 1.42, reg.z - 0.12, reg.x + 0.16, 1.58, reg.z + 0.02, 0x3cff9a, MAT.GLOW);
  biz.capture = { x: reg.x, y: 1.18, z: reg.z };
  biz.counterBehind = P(cu0 - 0.9, (cv0 + cv1) / 2);

  // ---- per-type interior and exterior props (slots) ----------------------------------------------------------------
  INTERIOR[biz.type]?.({ solid, box, cover, P, fr, F, D, GH, rng, pal, biz, out, kit, corner: !!opts.cornerStreet });

  // ---- sidewalk out front: cover (planters, bench, newspaper box) and a parked car at the curb ----------------------
  const sw = opts.sidewalk ?? 3.2;
  const walkU = (u, v) => fr.at(u, -v);
  const keep = (u) => u > doorU0 - 1.0 && u < doorU1 + 1.0; // never in front of the door
  const planters = [1.6, winU1 - 1.2].filter((u) => !keep(u));
  for (const u of planters) { const p = walkU(u, 1.0); placeProp(kit, 'planter', p.x, G, p.z); biz.cover.push({ prop: 'planter', x: p.x, z: p.z }); }
  { const p = walkU((winU0 + winU1) / 2, 0.75); placeProp(kit, 'bench', p.x, G, p.z, along ? Math.PI / 2 : 0); biz.cover.push({ prop: 'bench', x: p.x, z: p.z }); }
  { const p = walkU(doorU1 + 0.7, sw - 0.7); kit.solid(p.x - 0.3, G, p.z - 0.3, p.x + 0.3, G + 1.1, p.z + 0.3, 0x2f6fbf, MAT.METAL, TAG.PROP); kit.box(p.x - 0.32, G + 0.75, p.z - 0.32, p.x + 0.32, G + 0.95, p.z + 0.32, 0xd8e4f0); }
  if (opts.parking !== false) { const p = walkU(F / 2 - 1, sw + 1.3); placeProp(kit, 'car', p.x, 0, p.z, along ? Math.PI / 2 : 0, rng.pick([0x7a8090, 0x9a9ea6, 0x5d6478, 0x8a7a70, 0xc8c4bc])); biz.cover.push({ prop: 'car', x: p.x, z: p.z }); }
  exteriorExtras(kit, fr, biz);

  // ---- back lot: chain-link fence, dumpster; open to the alley -------------------------------------------------------
  const fence = (u0, v0, u1, v1) => { solid(u0, v0, u1, v1, G, G + 2.1, null, MAT.METAL, TAG.PROP); box(u0, v0, u1, v1, G, G + 2.1, 0x8a8a90, MAT.METAL); };
  fence(0, D + L - 0.08, F, D + L);
  fence(-0.08, D, 0, D + L);
  { const p = fr.at(2.2, D + L - 1.4); placeProp(kit, 'dumpster', p.x, G, p.z, along ? Math.PI / 2 : 0, rng.pick([0x3d4a3a, 0x40424a])); biz.cover.push({ prop: 'dumpster', x: p.x, z: p.z }); }
  { const p = fr.at(F - 2, D + 2.5); placeProp(kit, 'crate', p.x, G, p.z); }
  biz.backLot = P(F / 2, D + L / 2);
  biz.alleyMouth = P(F + A / 2, -1.2);
  biz.alleyEnd = P(F + A / 2, D + L + 0.8);
  // Defender posts: behind the counter, at the windows, on the roof (over the street), out front.
  biz.defenderPosts = [
    { ...biz.counterBehind, kind: 'counter' },
    { ...P(winU0 + 1.5, 1.0), kind: 'window' },
    { ...P(winU1 - 1.0, 1.0), kind: 'window' },
    { ...P(F / 2 - 2, 1.4, H), kind: 'roof' },
    { ...P(F / 2 + 3, 1.4, H), kind: 'roof' },
    { ...P(2.6, -1.6), kind: 'front' },
  ];
  // Spawn points for later AI: inside the door and in the alley.
  kit.spawn(biz.doorInside.x, G, biz.doorInside.z, 'door');
  kit.spawn(biz.alleyMouth.x, G, biz.alleyMouth.z, 'alley');
  // Laundry line across the alley from the business roofline to the neighbour.
  biz.laundry = { a: P(F + 0.05, D * 0.3, 5.6), b: P(F + A - 0.05, D * 0.3, 5.6) };
  return biz;
}

// Interior slot fillers. Aisles run front-to-back in the half of the shop away from the door and counter.
const INTERIOR = {
  bodega({ solid, cover, F, D }) {
    for (const u of [1.5, 4.1]) { solid(u, 6.5, u + 0.9, D - 2.2, G, 1.7, 0x7a6a58, MAT.STD, TAG.PROP); cover(u, 6.5, u + 0.9, D - 2.2, G, 1.7, 'shelf'); }
    solid(0.35, D - 1.2, F - 0.35, D - 0.35, G, 2.1, 0xd8e4f0, MAT.GLASS, TAG.PROP); // drink fridges
    for (let u = 7.2; u < F - 3.5; u += 1.0) solid(u, 7, u + 0.8, 7.8, G, 0.75 + ((u * 7) % 3) * 0.12, 0xb04a3c, MAT.STD, TAG.PROP); // soda cases
  },
  pawn({ solid, box, cover, F, D }) {
    for (const [u0, v0, u1, v1] of [[0.4, 6, 1.4, D - 1], [3, 8, 7.5, 9], [F - 1.4, 6.5, F - 0.4, D - 4.2]]) {
      solid(u0, v0, u1, v1, G, 0.9, 0x3a3640, MAT.STD, TAG.PROP);
      box(u0 + 0.05, v0 + 0.05, u1 - 0.05, v1 - 0.05, 0.9, 1.25, 0xb8d8e8, MAT.GLASS);
      cover(u0, v0, u1, v1, G, 0.9, 'case');
    }
    for (let k = 0; k < 4; k++) box(2 + k * 2.2, D - 0.45, 3.4 + k * 2.2, D - 0.32, 1.4, 2.4, [0xc89a3a, 0x8a8a90, 0x6a3d34, 0x3a6aa8][k]); // guitars, TVs on the back wall
  },
  laundromat({ solid, cover, F, D }) {
    for (let v = 6; v < D - 1.2; v += 1.0) { solid(0.35, v, 1.2, v + 0.85, G, 1.05, 0xe8e4dc, MAT.STD, TAG.PROP); }
    for (let u = 3; u < F - 1.5; u += 1.0) { solid(u, D - 1.2, u + 0.85, D - 0.35, G, 1.8, 0xd8d4cc, MAT.STD, TAG.PROP); }
    solid(4, 8, 7.5, 9.2, G, 0.9, 0x8a7a68, MAT.STD, TAG.PROP); // folding table
    cover(4, 8, 7.5, 9.2, G, 0.9, 'table');
  },
  boxing({ solid, box, cover, F, D, GH }) {
    solid(0.6, 8, 7, D - 0.8, G, 0.75, 0x4a3a3a, MAT.STD, TAG.PROP); // ring
    for (const y of [1.35, 1.8]) { box(0.6, 8, 7, 8.06, y, y + 0.04, 0xe8e0d0); box(0.6, D - 0.86, 7, D - 0.8, y, y + 0.04, 0xe8e0d0); box(0.6, 8, 0.66, D - 0.8, y, y + 0.04, 0xe8e0d0); box(6.94, 8, 7, D - 0.8, y, y + 0.04, 0xe8e0d0); }
    cover(0.6, 8, 7, D - 0.8, G, 0.75, 'ring');
    for (const v of [6.6, 9.4, 12.2]) { box(F - 2.0, v - 0.02, F - 1.96, v + 0.02, 2.2, GH - 0.1, 0x2a2830); solid(F - 2.3, v - 0.3, F - 1.7, v + 0.3, 0.9, 2.2, 0x8a2a2a, MAT.STD, TAG.PROP); } // heavy bags
  },
  auto({ solid, box, cover, F, D, rng }) {
    solid(1.0, 6.5, 6.5, 12.5, G, 0.35, 0x5a5660, MAT.METAL, TAG.PROP); // lift platform
    box(1.2, 6.2, 1.5, 12.8, G, 1.8, 0xc8a83a, MAT.METAL); box(6.0, 6.2, 6.3, 12.8, G, 1.8, 0xc8a83a, MAT.METAL);
    solid(1.3, 6.8, 6.2, 12.2, 1.6, 2.9, rng.pick([0x9a3a3a, 0x3a6aa8, 0xc8c4bc]), MAT.STD, TAG.PROP); // car up on the lift
    cover(1.0, 6.5, 6.5, 12.5, G, 0.35, 'lift');
    for (let k = 0; k < 3; k++) solid(F - 1.4, 7 + k * 1.3, F - 0.4, 8 + k * 1.3, G, 0.6 + 0.25 * k, 0x2a2830, MAT.STD, TAG.PROP); // tyres
  },
  clinic({ solid, cover, F, D }) {
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) solid(1.0 + k * 1.0, 7 + r * 2.2, 1.7 + k * 1.0, 7.7 + r * 2.2, G, 0.85, 0x3a6a8a, MAT.STD, TAG.PROP); // waiting-room chairs
    solid(F - 1.5, 6.5, F - 0.4, 10.5, G, 1.0, 0xd8d4cc, MAT.STD, TAG.PROP); // reception desk, clear of the back door
    cover(F - 1.5, 6.5, F - 0.4, 10.5, G, 1.0, 'desk');
  },
  diner(c) { buildDiner(c); },
};

// Exterior slot props: stacked soda cases, tyres and oil drums, window bars, gym posters, the clinic cross.
function exteriorExtras(kit, fr, biz) {
  const T = TEMPLATE;
  const along = Math.abs(fr.tu.x) > 0.5;
  const P = (u, v) => fr.at(u, v);
  if (biz.type === 'bodega') {
    const p = P(T.F - 4.5, -0.55);
    for (let k = 0; k < 3; k++) kit.solid(p.x - 0.45, G + k * 0.32, p.z - 0.3, p.x + 0.45, G + 0.3 + k * 0.32, p.z + 0.3, k % 2 ? 0xb04a3c : 0x3a6aa8, MAT.STD, TAG.PROP);
    biz.cover.push({ x0: p.x - 0.45, z0: p.z - 0.3, x1: p.x + 0.45, z1: p.z + 0.3, y0: G, y1: G + 0.94, kind: 'cases' });
  }
  if (biz.type === 'auto') {
    for (let k = 0; k < 4; k++) { const p = P(T.F + 0.9, T.D + 1 + k * 1.6); kit.solid(p.x - 0.5, G, p.z - 0.5, p.x + 0.5, G + 0.9 + (k % 2) * 0.3, p.z + 0.5, 0x2a2830, MAT.STD, TAG.PROP); } // tyre stacks in the alley-side lot
    for (let k = 0; k < 3; k++) { const p = P(3 + k * 1.0, T.D + T.L - 3.5); kit.solid(p.x - 0.35, G, p.z - 0.35, p.x + 0.35, G + 1.0, p.z + 0.35, [0x3a6aa8, 0xb04a3c, 0x4a6a3a][k], MAT.METAL, TAG.PROP); } // oil drums
  }
  if (biz.type === 'pawn') {
    // Bars over the front window.
    for (let u = 0.8; u < T.F - 4.2; u += 0.35) { const a = P(u, -0.06); kit.box(a.x - 0.025, 0.85, a.z - 0.025, a.x + 0.025, 2.85, a.z + 0.025, 0x2a2830, MAT.METAL); }
  }
  if (biz.type === 'boxing') {
    for (let k = 0; k < 3; k++) { const p = P(1.6 + k * 2.6, 0.32); kit.sign(['FIGHT NIGHT', 'NO PAIN', 'SPARRING'][k], 'paint', p.x, 1.9, p.z, 1.6, 1.2, -fr.tv.x, -fr.tv.z, [0xe8e0d0, 0xff5a3c, 0xffd34a][k]); }
  }
  if (biz.type === 'clinic') {
    const p = P(T.F / 2, -0.14);
    kit.box(p.x - 0.12, 5.6, p.z - 0.12, p.x + 0.12, 6.8, p.z + 0.12, 0xe03a3a, MAT.GLOW);
    kit.box(p.x - (along ? 0.6 : 0.12), 6.08, p.z - (along ? 0.12 : 0.6), p.x + (along ? 0.6 : 0.12), 6.32, p.z + (along ? 0.12 : 0.6), 0xe03a3a, MAT.GLOW);
  }
}

export function businessName(type, rng, used) {
  const pool = TYPES[type].names.filter((n) => !used.has(n));
  const name = pool.length ? rng.pick(pool) : `${TYPES[type].label} #${used.size + 1}`;
  used.add(name);
  return name;
}

// ---- the diner -----------------------------------------------------------------------------------------------------
// A real all-night diner, the gang HQ's front room: checkerboard floor, red-and-chrome walls, booths along the windows,
// a long counter with stools in front of the back bar (coffee, pie, shakes) and the kitchen pass, a menu board, a
// jukebox, the memorial wall of photos (kept for later systems), and a working kitchen behind (grill line, fryers,
// prep table, fridge, dish sink) with a clear path from the dining room to the back door. Staff and regulars sit and
// stand in it (`biz.patrons`, drawn by the kit view). Layout in the template frame: u along the street (door at the
// alley end), v into the block; the template's register counter by the door stays as the host stand.
const DINER = {
  // Sun-faded and grimy, after the reference: nothing in here has been repainted since the eighties.
  red: 0x8e2a24, cream: 0xb8ab8a, green: 0x485440, chrome: 0xaeb2b6, black: 0x1c1a20, white: 0xe2ddd0, steel: 0x8a9098,
  wood: 0x6e4a32, vinyl: 0x8a2622, laminate: 0x8a7a5c, floor: 0x5c5a54, floor2: 0x504e49, warm: 0xffe2b0, board: 0x16161a,
  ceiling: 0x8c826e,
};
function buildDiner({ solid, box, cover, fr, F, D, GH, biz, kit, corner }) {
  // Its own random stream, so furnishing the diner never reshuffles the rest of the city.
  const rng = new Rng(`diner:${biz.name}:${biz.block}`);
  const C = DINER, t = 0.3, Gt = G;
  const surf = (s) => { kit.boxes[kit.boxes.length - 1].surf = s; };
  const bx = (u0, v0, u1, v1, y0, y1, color, s, mat) => { box(u0, v0, u1, v1, y0, y1, color, mat); if (s) surf(s); };
  const sd = (u0, v0, u1, v1, y0, y1, color, s, mat) => { solid(u0, v0, u1, v1, y0, y1, color, mat, TAG.PROP); if (s) surf(s); };
  const glow = (u0, v0, u1, v1, y0, y1, color) => box(u0, v0, u1, v1, y0, y1, color, MAT.GLOW);
  const at3 = (u, v, y) => { const p = fr.at(u, v); return { x: p.x, y, z: p.z }; };
  const dir = (du, dv) => ({ x: fr.tu.x * du + fr.tv.x * dv, z: fr.tu.z * du + fr.tv.z * dv });
  const yawOf = (du, dv) => { const d = dir(du, dv); return Math.atan2(-d.x, -d.z); };
  const sign = (text, kind, u, v, y, w, h, n, color) => { const p = fr.at(u, v); kit.sign(text, kind, p.x, y, p.z, w, h, n.x, n.z, color); };
  // Room lights: dim and warm (power scales the kit view's interior point light; tint is its colour).
  const light = (u, v, y, color, r, power = 0.45) => { const p = fr.at(u, v); kit.light(p.x, y, p.z, color, r, 'shop'); Object.assign(kit.lights[kit.lights.length - 1], { power, tint: color }); };
  // The template's own ceiling light too: dimmer and warmer in here.
  const room = fr.rect(0, 0, F, D);
  for (const l of kit.lights) if (l.kind === 'shop' && l.x >= room.x0 && l.x <= room.x1 && l.z >= room.z0 && l.z <= room.z1) Object.assign(l, { power: 0.35, tint: 0xffd8a8, y: 2.6 });
  const SEAT = 0.46; // seat top above the floor
  const PASS = 12.0, CV0 = 9.0, CV1 = 9.75, BAR0 = 11.55; // pass wall, counter, back counter (v)
  const toPass = dir(0, -1), fromCorner = dir(1, 0), fromAlley = dir(-1, 0); // sign normals per wall

  // ---- floor: worn square tile in two close tones (dining room), white tile in the kitchen -------------------------
  for (let u = 0; u < F - 0.01; u += 1) for (let v = 0; v < PASS - 0.01; v += 1) {
    const u1 = Math.min(F - t, u + 1), v1 = Math.min(PASS, v + 1), u0 = Math.max(t, u), v0 = Math.max(t, v);
    bx(u0, v0, u1, v1, Gt, Gt + 0.006, rng.chance(0.5) ? C.floor : C.floor2, 'tile');
  }
  bx(t, PASS, F - t, D - t, Gt, Gt + 0.006, 0xd8d6d0, 'tile');

  // ---- walls: green tile below a red stripe, cream square tile above ------------------------------------------------
  const wall = (u0, v0, u1, v1, upper = true) => {
    bx(u0, v0, u1, v1, Gt, 0.88, C.green, 'tile');
    bx(u0, v0, u1, v1, 0.88, 1.0, C.red, 'tile');
    if (upper) bx(u0, v0, u1, v1, 1.0, GH - 0.12, C.cream, 'tile');
  };
  wall(F - t - 0.03, t, F - t, PASS);
  if (corner) { wall(t, t, t + 0.03, 1.4); wall(t, 1.4, t + 0.03, 7.6, false); wall(t, 7.6, t + 0.03, PASS); }
  else wall(t, t, t + 0.03, PASS);
  // Pass wall: a wide open pass to the kitchen (u 3..9.6) and the kitchen doorway (u 10.9..12.1).
  const pw = (u0, u1, y0, y1) => solid(u0, PASS, u1, PASS + 0.25, y0, y1, C.cream, MAT.STD, TAG.BUILDING);
  pw(t, 3, Gt, GH); pw(9.6, 10.9, Gt, GH); pw(12.1, F - t, Gt, GH);
  pw(3, 9.6, Gt, 1.15); pw(3, 9.6, 1.9, GH); pw(10.9, 12.1, 2.3, GH);
  wall(t, PASS - 0.03, 3, PASS); wall(9.6, PASS - 0.03, 10.9, PASS); wall(12.1, PASS - 0.03, F - t, PASS);
  bx(3, PASS - 0.03, 9.6, PASS, 1.9, GH - 0.12, C.cream, 'tile');
  bx(3, PASS - 0.25, 9.6, PASS + 0.25, 1.15, 1.2, C.steel, 'metalPaint'); // pass shelf
  bx(4.6, PASS + 0.02, 7.8, PASS + 0.12, 1.78, 1.84, C.chrome, 'chrome'); // order rail
  for (let k = 0; k < 6; k++) bx(4.7 + k * 0.5, PASS + 0.04, 4.9 + k * 0.5, PASS + 0.06, 1.58, 1.78, 0xfaf6ea, 'trim'); // tickets
  for (let k = 0; k < 3; k++) { bx(3.6 + k * 1.9, PASS - 0.2, 4.1 + k * 1.9, PASS + 0.1, 1.2, 1.26, C.white, 'trim'); bx(3.7 + k * 1.9, PASS - 0.15, 4.0 + k * 1.9, PASS + 0.05, 1.26, 1.32, k === 1 ? 0xd8a040 : 0x8a4a2a, 'trim'); } // plates up
  glow(3.1, PASS - 0.05, 9.5, PASS + 0.2, 1.87, 1.9, 0xffc070); // heat lamps
  bx(12.04, PASS + 0.25, 12.1, PASS + 1.2, Gt, 2.2, 0x2a2a2e, 'metalPaint'); // kitchen door, swung open
  bx(12.03, PASS + 0.55, 12.04, PASS + 0.9, 1.4, 1.75, 0xa8c0cc, 'carGlass');

  // ---- back wall dressing: the name in red script, menu boards, the house rules, clock, speaker, vent ---------------
  const name = biz.name.replace(/\s+Diner$/i, '');
  sign(name, 'script', 6.3, PASS - 0.06, 3.08, 3.0, 0.4, toPass, C.red);
  bx(5.1, PASS - 0.05, 7.5, PASS - 0.02, 2.66, 2.94, 0x6a1a18, 'trim'); // DINER plate
  sign('DINER', 'plate', 6.3, PASS - 0.06, 2.8, 2.2, 0.27, toPass, 0x6a1a18);
  const boards = [
    [3.25, ['2 EGGS & TOAST  3.25', 'WAFFLE  2.75', 'BURGER  4.25', 'CHEESEBURGER  4.75']],
    [5.85, ['CLUB SANDWICH  4.50', 'TUNA MELT  4.25', 'FRIES  .95', 'COFFEE  .75']],
  ];
  for (const [u0, lines] of boards) {
    bx(u0, PASS - 0.05, u0 + 2.4, PASS - 0.02, 1.95, 2.6, C.board, 'trim');
    lines.forEach((l, k) => sign(l, 'menu', u0 + 1.2, PASS - 0.06, 2.5 - k * 0.15, 2.2, 0.13, toPass, 0xf2efe8));
  }
  bx(8.4, PASS - 0.05, 9.5, PASS - 0.02, 1.95, 2.6, C.red, 'trim');
  ['WE RESERVE', 'THE RIGHT TO', 'REFUSE SERVICE', 'TO ANYONE'].forEach((l, k) => sign(l, 'menu', 8.95, PASS - 0.06, 2.48 - k * 0.14, 1.0, 0.11, toPass, 0xf4ecdc));
  // Clock, wall speaker and a vent grille to the left of the sign.
  bx(2.25, PASS - 0.06, 2.75, PASS - 0.02, 2.55, 3.05, C.white, 'trim'); bx(2.24, PASS - 0.07, 2.76, PASS - 0.06, 2.55, 2.58, C.black);
  bx(2.49, PASS - 0.08, 2.51, PASS - 0.07, 2.8, 2.98, C.black); bx(2.5, PASS - 0.08, 2.64, PASS - 0.07, 2.79, 2.81, C.black);
  bx(0.7, PASS - 0.2, 1.1, PASS - 0.02, 2.7, 3.1, 0x2a2a2e, 'metalPaint'); // speaker
  bx(1.3, PASS - 0.06, 1.9, PASS - 0.02, 2.55, 3.15, 0x8a8a86, 'metalPaint'); // vent grille
  for (let k = 0; k < 6; k++) bx(1.32, PASS - 0.07, 1.88, PASS - 0.06, 2.6 + k * 0.09, 2.63 + k * 0.09, 0x4a4a48);

  bx(t, t, F - t, PASS, GH - 0.14, GH - 0.12, C.ceiling, 'tile'); // drop-tile ceiling, yellowed

  // ---- fluorescent tube fixtures on short rods ----------------------------------------------------------------------
  const tube = (u, v, len, alongU) => {
    const [a0, a1, b0, b1] = alongU ? [u - len / 2, u + len / 2, v - 0.16, v + 0.16] : [u - 0.16, u + 0.16, v - len / 2, v + len / 2];
    bx(a0, b0, a1, b1, 2.82, 2.92, 0xd8d8d4, 'metalPaint');
    glow(a0 + 0.05, b0 + 0.06, a1 - 0.05, b1 - 0.06, 2.79, 2.82, 0xf2ead2);
    for (const k of [0.2, 0.8]) { const uu = alongU ? a0 + (a1 - a0) * k : u, vv = alongU ? v : b0 + (b1 - b0) * k; bx(uu - 0.015, vv - 0.015, uu + 0.015, vv + 0.015, 2.92, GH - 0.14, C.black); }
  };
  tube(3.2, 2.8, 1.8, true); tube(7.0, 2.8, 1.8, true); tube(4.4, 7.4, 1.8, true); tube(8.4, 7.4, 1.8, true);
  light(4.4, 7.4, 2.6, 0xffe2b8, 9); light(4.4, 2.8, 2.6, 0xffe2b8, 9, 0.35);

  // ---- booths: red tufted benches, wood-laminate tables on pedestals ------------------------------------------------
  const booth = (u0, v0, along) => {
    const L = 1.75;
    const seat = (a0, a1, back) => {
      const r = along === 'u' ? [a0, v0, a1, v0 + L] : [u0, a0, u0 + L, a1];
      const R = (x0, x1) => (along === 'u' ? [x0, r[1], x1, r[3]] : [r[0], x0, r[2], x1]);
      sd(...r, Gt, Gt + 0.36, 0x4a2a24, 'trim');
      bx(...r, Gt + 0.36, SEAT, C.vinyl, 'rubber');
      const bk = back < 0 ? R(a0, a0 + 0.16) : R(a1 - 0.16, a1);
      sd(...bk, SEAT, 1.3, C.vinyl, 'rubber');
      // Tufting: shallow horizontal seams across the backrest.
      for (const y of [0.75, 1.0]) bx(...(back < 0 ? R(a0 + 0.16, a0 + 0.17) : R(a1 - 0.17, a1 - 0.16)), y, y + 0.02, 0x6a1a18, 'rubber');
      cover(...r, Gt, 1.3, 'booth');
    };
    const top = (a, b, c, d) => { sd(a, b, c, d, 0.72, 0.76, C.laminate, 'planks'); bx(a, b, c, d, 0.7, 0.72, C.chrome, 'chrome'); };
    if (along === 'u') {
      seat(u0, u0 + 0.55, -1); seat(u0 + 1.25, u0 + 1.8, 1);
      top(u0 + 0.58, v0 + 0.1, u0 + 1.22, v0 + 1.55);
      bx(u0 + 0.86, v0 + 0.78, u0 + 0.94, v0 + 0.86, Gt, 0.7, 0x2a2a2e, 'metalPaint');
      bx(u0 + 0.7, v0 + 0.62, u0 + 1.1, v0 + 1.02, Gt, Gt + 0.03, 0x2a2a2e, 'metalPaint');
      tableTop(u0 + 0.9, v0 + 0.35);
      return [{ u: u0 + 0.3, v: v0 + 0.85, fu: 1, fv: 0 }, { u: u0 + 1.5, v: v0 + 0.85, fu: -1, fv: 0 }];
    }
    seat(v0, v0 + 0.55, -1); seat(v0 + 1.25, v0 + 1.8, 1);
    top(u0 + 0.1, v0 + 0.58, u0 + 1.55, v0 + 1.22);
    bx(u0 + 0.78, v0 + 0.86, u0 + 0.86, v0 + 0.94, Gt, 0.7, 0x2a2a2e, 'metalPaint');
    bx(u0 + 0.62, v0 + 0.7, u0 + 1.02, v0 + 1.1, Gt, Gt + 0.03, 0x2a2a2e, 'metalPaint');
    tableTop(u0 + 0.35, v0 + 0.9);
    return [{ u: u0 + 0.85, v: v0 + 0.3, fu: 0, fv: 1 }, { u: u0 + 0.85, v: v0 + 1.5, fu: 0, fv: -1 }];
  };
  // On every table: a napkin dispenser, ketchup and mustard, salt and pepper.
  function tableTop(u, v) {
    bx(u - 0.06, v - 0.08, u + 0.06, v + 0.08, 0.76, 0.9, C.chrome, 'chrome');
    bx(u + 0.12, v - 0.04, u + 0.17, v + 0.01, 0.76, 0.94, 0xb02020, 'trim');
    bx(u + 0.12, v + 0.05, u + 0.17, v + 0.1, 0.76, 0.94, 0xd8b020, 'trim');
    bx(u - 0.16, v - 0.05, u - 0.12, v - 0.01, 0.76, 0.84, 0xe8eef2, 'trim'); bx(u - 0.16, v + 0.01, u - 0.12, v + 0.05, 0.76, 0.84, 0x3a3a3a, 'trim');
  }
  const seats = [];
  for (let i = 0; i < 3; i++) seats.push(...booth(0.5 + i * 1.95, 0.35, 'u'));
  for (let i = 0; i < 3; i++) seats.push(...booth(t + 0.05, 3.0 + i * 1.95, 'v'));

  // ---- window blinds: slats tilted open, so the room still shows from the street ----------------------------------
  const winU0 = 0.6, winU1 = F - 4.1;
  for (let y = 1.0; y < 2.8; y += 0.11) bx(winU0, t + 0.02, winU1, t + 0.05, y, y + 0.022, 0xd8d0c0, 'trim');
  bx(winU0, t + 0.01, winU1, t + 0.07, 2.8, 2.86, 0xc8c0b0, 'trim');
  if (corner) {
    for (let y = 1.0; y < 2.8; y += 0.11) bx(t + 0.02, 1.4, t + 0.05, 7.6, y, y + 0.022, 0xd8d0c0, 'trim');
    bx(t + 0.01, 1.4, t + 0.07, 7.6, 2.8, 2.86, 0xc8c0b0, 'trim');
  }

  // ---- the counter: green tile front with a red band, grey laminate top, seven chrome stools ----------------------
  const cu0 = 2.6, cu1 = 10.2;
  sd(cu0, CV0, cu1, CV1, Gt, 0.95, C.green, 'tile');
  bx(cu0 - 0.01, CV0 - 0.01, cu1 + 0.01, CV1 + 0.01, 0.75, 0.86, C.red, 'tile');
  bx(cu0 - 0.08, CV0 - 0.14, cu1 + 0.08, CV1 + 0.02, 0.95, 1.03, 0x8a8680, 'trim');
  bx(cu0, CV0 - 0.02, cu1, CV0, 0.1, 0.18, C.chrome, 'chrome'); // foot rail
  cover(cu0, CV0, cu1, CV1, Gt, 0.95, 'counter');
  const stools = [];
  for (let k = 0; k < 7; k++) {
    const u = 3.1 + k * 1.05, v = CV0 - 0.65;
    bx(u - 0.05, v - 0.05, u + 0.05, v + 0.05, Gt, 0.64, C.chrome, 'chrome');
    bx(u - 0.17, v - 0.17, u + 0.17, v + 0.17, Gt, Gt + 0.05, C.chrome, 'chrome');
    bx(u - 0.21, v - 0.21, u + 0.21, v + 0.21, 0.64, 0.68, C.chrome, 'chrome');
    bx(u - 0.2, v - 0.2, u + 0.2, v + 0.2, 0.68, 0.76, C.vinyl, 'rubber');
    stools.push({ u, v });
  }
  // On the counter: napkins, condiments, a cake stand under glass, cups.
  for (const u of [3.6, 6.2, 8.8]) { bx(u - 0.06, CV0 + 0.25, u + 0.06, CV0 + 0.4, 1.03, 1.17, C.chrome, 'chrome'); bx(u + 0.12, CV0 + 0.28, u + 0.17, CV0 + 0.33, 1.03, 1.21, 0xb02020, 'trim'); bx(u + 0.21, CV0 + 0.28, u + 0.26, CV0 + 0.33, 1.03, 1.21, 0xd8b020, 'trim'); }
  bx(4.6, CV0 + 0.15, 5.1, CV0 + 0.6, 1.03, 1.07, C.chrome, 'chrome');
  bx(4.65, CV0 + 0.2, 5.05, CV0 + 0.55, 1.07, 1.2, 0xe8c890, 'trim');
  bx(4.6, CV0 + 0.15, 5.1, CV0 + 0.6, 1.2, 1.38, 0xe8eef2, 'carGlass');
  for (const u of [5.6, 7.6]) bx(u - 0.05, CV0 + 0.1, u + 0.05, CV0 + 0.2, 1.03, 1.12, C.white, 'trim');

  // ---- back counter under the pass: coffee, shakes, soda, a cooler ------------------------------------------------
  sd(cu0, BAR0, cu1, PASS, Gt, 0.95, C.steel, 'metalPaint');
  bx(cu0, BAR0 - 0.02, cu1, PASS, 0.95, 0.99, 0x8a8680, 'trim');
  for (const u of [2.75, 9.15]) {
    bx(u, BAR0 + 0.05, u + 0.9, PASS - 0.02, 0.99, 1.62, C.steel, 'metalPaint');
    glow(u + 0.1, BAR0 + 0.04, u + 0.8, BAR0 + 0.06, 1.0, 1.04, 0xff7030);
    for (const k of [0.25, 0.65]) bx(u + k - 0.1, BAR0 + 0.1, u + k + 0.1, BAR0 + 0.3, 1.04, 1.28, 0x2a1a10, 'carGlass');
  }
  bx(4.0, BAR0 + 0.1, 4.4, BAR0 + 0.35, 0.99, 1.45, 0x8ad0c8, 'metalPaint'); // shake mixer
  for (let k = 0; k < 4; k++) bx(7.1 + k * 0.3, BAR0 + 0.05, 7.2 + k * 0.3, BAR0 + 0.2, 1.25, 1.4, C.chrome, 'chrome'); // soda taps
  bx(7.0, BAR0 + 0.15, 8.2, PASS - 0.02, 0.99, 1.15, C.red, 'trim');

  // ---- dining-room walls: posters, a street sign, a framed picture, payphone, extinguisher, restrooms, jukebox -----
  // Corner wall (over the side booths): street sign, "EAT HERE / BE HAPPY", a framed picture.
  bx(t + 0.03, 8.55, t + 0.06, 9.35, 1.95, 2.95, C.red, 'trim');
  sign('EAT HERE', 'menu', t + 0.07, 8.95, 2.8, 0.75, 0.1, fromCorner, 0xf4ecdc);
  bx(t + 0.06, 8.8, t + 0.08, 9.1, 2.3, 2.55, 0xc88a3a, 'trim'); bx(t + 0.08, 8.85, t + 0.09, 9.05, 2.38, 2.48, 0x6a2a1a, 'trim'); // a burger
  sign('BE HAPPY', 'menu', t + 0.07, 8.95, 2.07, 0.75, 0.1, fromCorner, 0xf4ecdc);
  bx(t + 0.03, 9.6, t + 0.07, 10.2, 2.25, 2.75, 0x8a6a3a, 'planks'); bx(t + 0.07, 9.65, t + 0.08, 10.15, 2.3, 2.7, 0x7a7a6a, 'trim'); // framed picture
  if (!corner) { sign('PALMETTO AVE', 'plate', t + 0.05, 5.0, 2.45, 1.3, 0.2, fromCorner, 0x1e2a24); }
  else sign('PALMETTO AVE', 'plate', t + 0.05, 8.0, 2.7, 1.1, 0.16, fromCorner, 0x1e2a24);
  // Alley wall by the pass: "TRY OUR DAILY SPECIALS!", the payphone and an extinguisher.
  const aw = F - t - 0.04;
  bx(aw - 0.03, 9.2, aw, 10.0, 1.85, 2.95, C.red, 'trim');
  ['TRY OUR', 'DAILY', 'SPECIALS!'].forEach((l, k) => sign(l, 'menu', aw - 0.04, 9.6, 2.82 - k * 0.15, 0.7, 0.11, fromAlley, 0xf4ecdc));
  bx(aw - 0.05, 9.4, aw - 0.03, 9.8, 2.05, 2.3, 0xc88a3a, 'trim');
  bx(aw - 0.14, 10.5, aw, 10.85, 1.2, 1.75, 0x3a3a3e, 'metalPaint'); // payphone
  bx(aw - 0.2, 10.55, aw - 0.14, 10.65, 1.4, 1.65, C.black, 'trim');
  bx(aw - 0.15, 11.2, aw, 11.4, 0.9, 1.4, 0xc02020, 'trim'); // extinguisher
  // Restrooms door on the corner wall by the counter end, and the jukebox in the corner.
  bx(t, 10.4, t + 0.06, 11.4, Gt, 2.1, 0x2a2622, 'planks');
  bx(t + 0.06, 10.85, t + 0.08, 10.95, 1.0, 1.06, C.chrome, 'chrome');
  sign('RESTROOMS', 'menu', t + 0.1, 10.9, 2.3, 1.0, 0.12, fromCorner, 0xf2efe8);
  sd(2.0, 11.0, 2.55, 11.7, Gt, 1.4, C.wood, 'planks');
  glow(2.05, 10.98, 2.5, 11.0, 0.5, 1.2, 0xff9a3c);
  bx(2.0, 11.0, 2.55, 11.7, 1.4, 1.52, C.chrome, 'chrome');

  // ---- memorial wall: photos of the fallen on the alley wall across from the booths, a shelf of candles ------------
  const MW0 = 3.2, MW1 = 8.6, mu = F - t - 0.05;
  bx(mu - 0.04, MW0, mu, MW1, 1.15, 2.85, 0x2a2228, 'planks');
  for (let k = 0; k < 9; k++) {
    const v = MW0 + 0.35 + (k % 5) * 1.05 + (k > 4 ? 0.5 : 0), y = k > 4 ? 1.35 : 2.05;
    bx(mu - 0.07, v, mu - 0.04, v + 0.48, y, y + 0.6, 0xd8cdb8, 'trim');
    bx(mu - 0.08, v + 0.05, mu - 0.07, v + 0.43, y + 0.05, y + 0.55, rng.pick([0x6a5a50, 0x8a7a6a, 0x5a6a7a, 0x7a6a5a]), 'trim');
  }
  sd(mu - 0.3, MW0 + 0.4, mu, MW1 - 0.4, 1.0, 1.05, C.wood, 'planks');
  for (let k = 0; k < 7; k++) { const v = MW0 + 0.7 + k * 0.62; bx(mu - 0.2, v, mu - 0.14, v + 0.06, 1.05, 1.17, 0xf2e8d8, 'trim'); glow(mu - 0.19, v + 0.01, mu - 0.15, v + 0.05, 1.17, 1.22, 0xffb040); }
  bx(mu - 0.26, MW1 - 1.2, mu - 0.1, MW1 - 1.04, 1.05, 1.35, 0x3a7a3a, 'trim'); bx(mu - 0.3, MW1 - 1.25, mu - 0.06, MW1 - 1.0, 1.35, 1.48, 0xd84a6a, 'trim');
  sign('NEVER FORGOTTEN', 'menu', mu - 0.09, (MW0 + MW1) / 2, 2.98, 2.6, 0.18, fromAlley, 0xffd34a);
  biz.memorialWall = { a: fr.at(mu, MW0), b: fr.at(mu, MW1), y0: 1.15, y1: 2.85 };

  // ---- kitchen: tiled walls, grill line under a hood, fryers, range, prep table, fridge, dish sink ------------------
  const KB = D - t;
  bx(t, KB - 0.03, F - t, KB, Gt, 2.2, 0xe4e2dc, 'tile'); // white tile behind the line
  sd(0.6, KB - 0.85, 2.0, KB, Gt, 0.92, C.steel, 'metalPaint'); // fryers
  bx(0.7, KB - 0.75, 1.25, KB - 0.1, 0.92, 0.95, 0xc8a040, 'trim'); bx(1.35, KB - 0.75, 1.9, KB - 0.1, 0.92, 0.95, 0xc8a040, 'trim');
  sd(2.0, KB - 0.85, 4.6, KB, Gt, 0.9, C.steel, 'metalPaint'); // flat-top
  bx(2.05, KB - 0.8, 4.55, KB - 0.05, 0.9, 0.94, 0x2a2828, 'metalPaint');
  for (let k = 0; k < 4; k++) bx(2.3 + k * 0.55, KB - 0.6, 2.6 + k * 0.55, KB - 0.3, 0.94, 0.97, 0x6a3a22, 'trim');
  sd(4.6, KB - 0.85, 6.4, KB, Gt, 0.9, C.steel, 'metalPaint'); // range
  for (const u of [5.0, 5.9]) { bx(u - 0.2, KB - 0.65, u + 0.2, KB - 0.25, 0.9, 0.93, C.black); bx(u - 0.15, KB - 0.6, u + 0.15, KB - 0.3, 0.93, 1.12, 0x9a9aa0, 'chrome'); }
  bx(0.5, KB - 1.1, 6.5, KB, 2.25, 2.9, C.steel, 'metalPaint'); // hood
  glow(0.6, KB - 1.05, 6.4, KB - 0.95, 2.22, 2.25, 0xfff0d0);
  sd(2.6, 13.3, 6.4, 14.0, Gt, 0.92, C.steel, 'metalPaint'); // prep table
  bx(2.6, 13.3, 6.4, 14.0, 0.92, 0.95, C.chrome, 'chrome');
  bx(3.0, 13.45, 3.6, 13.85, 0.95, 0.98, 0xd8b070, 'planks'); bx(4.4, 13.45, 4.8, 13.85, 0.95, 1.1, 0x3a7a3a, 'trim'); bx(5.2, 13.4, 5.9, 13.9, 0.95, 1.05, C.white, 'trim');
  cover(2.6, 13.3, 6.4, 14.0, Gt, 0.92, 'prep');
  sd(7.0, KB - 0.8, 8.6, KB, Gt, 2.2, C.steel, 'metalPaint'); // fridge
  bx(7.75, KB - 0.82, 7.85, KB - 0.8, 0.9, 1.9, C.chrome, 'chrome');
  sd(9.0, KB - 0.7, 10.6, KB, Gt, 0.9, C.steel, 'metalPaint'); // dish sink
  bx(9.1, KB - 0.6, 10.5, KB - 0.1, 0.88, 0.9, 0x8ab0c0, 'carGlass');
  for (let k = 0; k < 4; k++) bx(9.15 + k * 0.08, KB - 0.55, 9.2 + k * 0.08, KB - 0.25, 0.9, 1.15, C.white, 'trim');
  sd(t + 0.05, 12.6, t + 0.55, 15.0, Gt, 1.9, 0x8a8478, 'metalPaint'); // dry storage shelving
  tube(4, 14.0, 1.8, true);
  light(4, 14, 2.6, 0xf2f0e4, 7, 0.4);

  // ---- people: Sal behind the counter, a cook on the line, a waitress, the regulars ------------------------------
  const person = (u, v, y, fu, fv, pose, seed) => biz.patrons.push({ ...at3(u, v, y), yaw: yawOf(fu, fv), pose, seed });
  biz.patrons = [];
  const s0 = rng.int(1, 1e6);
  person(6.6, CV1 + 0.65, Gt, 0, -1, 'counter', s0 + 1); // Sal
  person(3.3, KB - 1.25, Gt, 0, 1, 'cook', s0 + 2);
  person(9.0, 6.2, Gt, -0.4, 1, 'stand', s0 + 3); // waitress, by the register
  const sitters = rng.shuffle(seats.slice()).slice(0, 3);
  sitters.forEach((q, i) => person(q.u, q.v, SEAT - 0.82, q.fu, q.fv, 'sit', s0 + 10 + i));
  for (const k of rng.shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, 2)) person(stools[k].u, stools[k].v, 0.76 - 0.82, 0, 1, 'sitCounter', s0 + 20 + k);
}
