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
  // (A furnished interior puts its own register on its own counter and sets capture / counterBehind itself.)
  const cu0 = F - 6.3, cu1 = F - 5.3, cv0 = 1.5, cv1 = 5.2;
  if (!FURNISHED.has(biz.type)) {
    solid(cu0, cv0, cu1, cv1, G, 1.12, 0x4a4652, MAT.STD, TAG.PROP);
    box(cu0 - 0.08, cv0 - 0.08, cu1 + 0.08, cv1 + 0.08, 1.12, 1.18, 0xc8c0b8);
    cover(cu0, cv0, cu1, cv1, G, 1.12, 'counter');
    const reg = fr.at((cu0 + cu1) / 2, cv0 + 1.0);
    kit.box(reg.x - 0.22, 1.18, reg.z - 0.18, reg.x + 0.22, 1.42, reg.z + 0.18, 0x2a2830, MAT.METAL);
    kit.box(reg.x - 0.16, 1.42, reg.z - 0.12, reg.x + 0.16, 1.58, reg.z + 0.02, 0x3cff9a, MAT.GLOW);
    biz.capture = { x: reg.x, y: 1.18, z: reg.z };
    biz.counterBehind = P(cu0 - 0.9, (cv0 + cv1) / 2);
  }

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
// A real all-night diner, the gang HQ's front room, after the user's reference image (style only): a long stainless
// counter with red stools down the corner side (back bar, menu boards and an old TV behind it), red leather booths down
// the alley side under framed photos (the memorial wall) and a red neon OPEN, and the back wall straight ahead in dark
// wood with a black-and-white checker tile band, the big SAL'S DINER sign and a glass exit door. Worn checkerboard
// floor, a dark drop-tile ceiling with square light panels and a ceiling fan. Behind the back wall: the kitchen
// (grill line under a hood, fryers, prep table, fridge, dish sink) with a clear path to the back door. Staff and
// regulars sit and stand in it (`biz.patrons`, drawn by the kit view). Frame: u along the street (the front door is
// at the alley end), v into the block.
const DINER = {
  red: 0x8e2422, cream: 0xbcb091, check: 0xd8d0bc, black: 0x1c1a1a, chrome: 0xaeb2b6, steel: 0x8e9298, wood: 0x4a3426,
  green: 0x3e4636, vinyl: 0x7e1e1c, laminate: 0x9a8e74, floorA: 0x15181c, floorB: 0xbab6aa, ceiling: 0x6e665a,
  white: 0xe2ddd0, navy: 0x1e2a4a, panel: 0xf2ead2, shield: 0xcfc4a6, warm: 0xffe2b0, board: 0x16161a,
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
  const room = fr.rect(0, 0, F, D);
  for (const l of kit.lights) if (l.kind === 'shop' && l.x >= room.x0 && l.x <= room.x1 && l.z >= room.z0 && l.z <= room.z1) Object.assign(l, { power: 0.3, tint: 0xffd8a8, y: 2.6 });
  const SEAT = 0.46;
  const BACK = 12.0; // the back wall (v); the kitchen is behind it
  const fromCorner = dir(1, 0), fromAlley = dir(-1, 0), fromBack = dir(0, -1);
  const IN = t + 0.03, OUTU = F - t - 0.03; // inner faces of the side walls

  // ---- floor: worn black-and-cream checkerboard; white tile in the kitchen ----------------------------------------
  for (let u = 0; u < F - 0.01; u += 0.75) for (let v = 0; v < BACK - 0.01; v += 0.75) {
    const u0 = Math.max(t, u), v0 = Math.max(t, v), u1 = Math.min(F - t, u + 0.75), v1 = Math.min(BACK, v + 0.75);
    bx(u0, v0, u1, v1, Gt, Gt + 0.006, (Math.round(u / 0.75) + Math.round(v / 0.75)) % 2 ? C.floorA : C.floorB, 'concrete'); // speckled, worn
  }
  bx(t, BACK, F - t, D - t, Gt, Gt + 0.006, 0xd0cec6, 'tile');

  // ---- walls: dark green wainscot, a checker tile band, wallpaper (sides) / dark wood (back) above -----------------
  const band = (a0, a1, face) => {
    // face: 'corner' | 'alley' | 'back'. A strip of 0.15 m black and white tiles at 0.95..1.25 m.
    const sq = 0.15;
    const strip = (x0, x1, y0, y1, c, s) => face === 'back' ? bx(x0, BACK - 0.05, x1, BACK - 0.03, y0, y1, c, s)
      : face === 'corner' ? bx(IN, x0, IN + 0.02, x1, y0, y1, c, s) : bx(OUTU - 0.02, x0, OUTU, x1, y0, y1, c, s);
    strip(a0, a1, 0.95, 1.25, C.check, 'tile');
    for (let a = a0, i = 0; a < a1 - 0.01; a += sq, i++) for (let r = 0; r < 2; r++) if ((i + r) % 2 === 0) {
      const lift = face === 'back' ? 0 : 0.003, y = 0.95 + r * sq;
      if (face === 'back') bx(a, BACK - 0.06, Math.min(a1, a + sq), BACK - 0.05, y, y + sq, C.black, 'tile');
      else if (face === 'corner') bx(IN + 0.02, a, IN + 0.02 + lift, Math.min(a1, a + sq), y, y + sq, C.black, 'tile');
      else bx(OUTU - 0.02 - lift, a, OUTU - 0.02, Math.min(a1, a + sq), y, y + sq, C.black, 'tile');
    }
    strip(a0, a1, 1.25, 1.29, C.chrome, 'chrome');
  };
  const sideWall = (face, v0, v1, upper = true) => {
    const W = (y0, y1, c, s) => face === 'corner' ? bx(t, v0, IN, v1, y0, y1, c, s) : bx(OUTU, v0, F - t, v1, y0, y1, c, s);
    W(Gt, 0.95, C.green, 'planks');
    if (upper) W(1.29, GH - 0.12, C.cream, 'plaster');
    band(v0, v1, face);
  };
  sideWall('alley', t, BACK);
  if (corner) { sideWall('corner', t, 1.4); sideWall('corner', 1.4, 7.6, false); sideWall('corner', 7.6, BACK); }
  else sideWall('corner', t, BACK);
  // Back wall: openings for the kitchen door (u 0.5..1.6), the kitchen pass (u 2.0..3.6, 1.1..1.9 m) and the glass
  // exit door (u 6.0..7.0); dark wood above the band, green below.
  const bw = (u0, u1, y0, y1) => solid(u0, BACK, u1, BACK + 0.25, y0, y1, C.wood, MAT.STD, TAG.BUILDING);
  bw(t, 0.5, Gt, GH); bw(1.6, 2.0, Gt, GH); bw(3.6, 6.0, Gt, GH); bw(7.0, F - t, Gt, GH);
  bw(0.5, 1.6, 2.25, GH); bw(2.0, 3.6, Gt, 1.1); bw(2.0, 3.6, 1.9, GH); bw(6.0, 7.0, 2.25, GH);
  for (const [u0, u1] of [[t, 0.5], [1.6, 2.0], [3.6, 6.0], [7.0, F - t]]) {
    bx(u0, BACK - 0.03, u1, BACK, Gt, 0.95, C.green, 'planks');
    bx(u0, BACK - 0.03, u1, BACK, 1.29, GH - 0.12, C.wood, 'planks');
    band(u0, u1, 'back');
  }
  bx(2.0, BACK - 0.2, 3.6, BACK + 0.25, 1.1, 1.15, C.steel, 'metalPaint'); // pass shelf
  for (let k = 0; k < 2; k++) { bx(2.2 + k * 0.7, BACK - 0.15, 2.7 + k * 0.7, BACK + 0.1, 1.15, 1.2, C.white, 'trim'); bx(2.3 + k * 0.7, BACK - 0.1, 2.6 + k * 0.7, BACK + 0.05, 1.2, 1.26, 0x8a4a2a, 'trim'); }
  glow(2.05, BACK - 0.05, 3.55, BACK + 0.2, 1.87, 1.9, 0xffc070); // heat lamp
  // Glass exit door, swung open into the back; EXIT sign over it.
  bx(5.95, BACK - 0.04, 6.0, BACK + 0.25, Gt, 2.3, C.chrome, 'chrome'); bx(7.0, BACK - 0.04, 7.05, BACK + 0.25, Gt, 2.3, C.chrome, 'chrome');
  bx(5.95, BACK - 0.04, 7.05, BACK + 0.25, 2.25, 2.3, C.chrome, 'chrome');
  bx(6.97, BACK + 0.25, 7.02, BACK + 1.2, Gt, 2.2, C.chrome, 'chrome');
  bx(6.98, BACK + 0.3, 7.01, BACK + 1.15, 0.15, 2.15, 0xa8c0cc, 'shopGlass');
  bx(6.2, BACK - 0.08, 6.8, BACK - 0.03, 2.38, 2.6, C.black, 'trim');
  sign('EXIT', 'menu', 6.5, BACK - 0.09, 2.49, 0.5, 0.18, fromBack, 0xff3a2a);
  glow(6.22, BACK - 0.085, 6.78, BACK - 0.08, 2.4, 2.42, 0xff3020);
  // The big SAL'S DINER sign: a cream shield with a dark red rim, the name in red, DINER in navy, a red star.
  const name = biz.name.replace(/\s+Diner$/i, '').toUpperCase();
  bx(8.05, BACK - 0.07, 10.75, BACK - 0.03, 1.55, 3.0, 0x2a1e1a, 'trim');
  bx(8.12, BACK - 0.09, 10.68, BACK - 0.07, 1.62, 2.93, C.shield, 'trim');
  // Sign text is sized by its width (8:1), so the lettering gets wide sign areas over the shield.
  sign(name, 'script', 9.4, BACK - 0.1, 2.5, 5.2, 0.65, fromBack, 0xa82420);
  sign('DINER', 'menu', 9.4, BACK - 0.1, 1.98, 4.2, 0.52, fromBack, C.navy);
  sign('\u2605', 'menu', 9.4, BACK - 0.1, 1.73, 2.0, 0.25, fromBack, 0xa82420);
  // Framed notices either side of the exit.
  for (const [u, w, h, c] of [[4.6, 0.45, 0.6, 0xe8e0c8], [5.4, 0.4, 0.5, 0xd8c8a0], [7.6, 0.35, 0.5, 0xe8e0c8], [11.6, 0.6, 0.7, 0xd0c4a8]]) {
    bx(u - w / 2, BACK - 0.06, u + w / 2, BACK - 0.03, 1.6, 1.6 + h, 0x2a2420, 'trim');
    bx(u - w / 2 + 0.04, BACK - 0.065, u + w / 2 - 0.04, BACK - 0.06, 1.64, 1.56 + h, c, 'trim');
  }

  // ---- ceiling: dark drop tile, square light panels, a ceiling fan --------------------------------------------------
  bx(t, t, F - t, BACK, GH - 0.14, GH - 0.12, C.ceiling, 'tile');
  for (const u of [2.2, 6.5, 10.8]) for (const v of [2.5, 6.2, 9.9]) { bx(u - 0.36, v - 0.36, u + 0.36, v + 0.36, GH - 0.16, GH - 0.14, 0x9a968c, 'metalPaint'); glow(u - 0.3, v - 0.3, u + 0.3, v + 0.3, GH - 0.17, GH - 0.16, C.panel); }
  { const u = 6.5, v = 4.4;
    bx(u - 0.02, v - 0.02, u + 0.02, v + 0.02, 2.9, GH - 0.14, C.black);
    bx(u - 0.14, v - 0.14, u + 0.14, v + 0.14, 2.78, 2.9, 0x2a2420, 'metalPaint');
    bx(u - 0.75, v - 0.09, u + 0.75, v + 0.09, 2.82, 2.84, 0x3a2a20, 'planks');
    bx(u - 0.09, v - 0.75, u + 0.09, v + 0.75, 2.83, 2.85, 0x3a2a20, 'planks'); }
  light(6.5, 3.6, 2.5, 0xffe0b0, 9, 0.4); light(6.5, 8.8, 2.5, 0xffe0b0, 9, 0.4); light(2.0, 6.5, 2.5, 0xffe0b0, 7, 0.3);

  // ---- the counter down the corner side: stainless front, red trim, laminate top, eight chrome stools ------------
  const CU0 = 3.0, CU1 = 3.8, CV0 = 2.4, CV1 = 10.6;
  sd(CU0, CV0, CU1, CV1, Gt, 0.98, C.steel, 'metalPaint');
  bx(CU1, CV0 - 0.01, CU1 + 0.01, CV1 + 0.01, Gt, 0.1, C.black, 'trim'); // kick
  for (let v = CV0 + 0.6; v < CV1 - 0.3; v += 1.2) bx(CU1, v, CU1 + 0.012, v + 0.03, 0.12, 0.88, 0x6e7278, 'metalPaint'); // panel seams
  bx(CU0 - 0.02, CV0 - 0.02, CU1 + 0.02, CV1 + 0.02, 0.86, 0.94, C.red, 'trim');
  bx(CU0 - 0.08, CV0 - 0.08, CU1 + 0.14, CV1 + 0.08, 0.98, 1.04, 0x7a7468, 'trim');
  bx(CU1 + 0.12, CV0 - 0.08, CU1 + 0.15, CV1 + 0.08, 0.97, 1.05, C.chrome, 'chrome');
  cover(CU0, CV0, CU1, CV1, Gt, 0.98, 'counter');
  const stools = [];
  for (let k = 0; k < 8; k++) {
    const u = CU1 + 0.65, v = CV0 + 0.55 + k * 0.98;
    bx(u - 0.05, v - 0.05, u + 0.05, v + 0.05, Gt, 0.62, C.chrome, 'chrome');
    bx(u - 0.18, v - 0.18, u + 0.18, v + 0.18, Gt, Gt + 0.06, C.chrome, 'chrome');
    for (const y of [0.62, 0.66]) bx(u - 0.22, v - 0.22, u + 0.22, v + 0.22, y, y + 0.025, C.chrome, 'chrome');
    bx(u - 0.21, v - 0.21, u + 0.21, v + 0.21, 0.69, 0.78, C.vinyl, 'rubber');
    stools.push({ u, v });
  }
  // On the counter: a cake dome, napkins and condiments, cups, and the register (the capture point).
  bx(CU0 + 0.15, 4.0, CU0 + 0.65, 4.5, 1.04, 1.07, C.chrome, 'chrome');
  bx(CU0 + 0.2, 4.05, CU0 + 0.6, 4.45, 1.07, 1.18, 0xd8b880, 'trim');
  bx(CU0 + 0.15, 4.0, CU0 + 0.65, 4.5, 1.18, 1.38, 0xc8d4dc, 'shopGlass');
  for (const v of [5.6, 7.5, 9.4]) { bx(CU0 + 0.35, v, CU0 + 0.5, v + 0.12, 1.04, 1.18, C.chrome, 'chrome'); bx(CU0 + 0.55, v, CU0 + 0.6, v + 0.05, 1.04, 1.22, 0xb02020, 'trim'); bx(CU0 + 0.55, v + 0.07, CU0 + 0.6, v + 0.12, 1.04, 1.22, 0xd8b020, 'trim'); }
  for (const v of [6.6, 8.5]) bx(CU0 + 0.45, v, CU0 + 0.55, v + 0.1, 1.04, 1.13, C.white, 'trim');
  const reg = fr.at(CU0 + 0.4, CV0 + 0.5);
  kit.box(reg.x - 0.2, 1.04, reg.z - 0.2, reg.x + 0.2, 1.28, reg.z + 0.2, 0x2a2830, MAT.METAL);
  kit.box(reg.x - 0.14, 1.28, reg.z - 0.12, reg.x + 0.14, 1.42, reg.z + 0.04, 0x3cff9a, MAT.GLOW);
  biz.capture = { x: reg.x, y: 1.04, z: reg.z };
  biz.counterBehind = at3(2.1, (CV0 + CV1) / 2, Gt);

  // ---- back bar on the corner wall: coffee, soda fountain, shakes; menu boards and a TV above -------------------
  sd(IN, CV0, 0.95, CV1, Gt, 0.95, C.steel, 'metalPaint');
  bx(IN, CV0, 1.0, CV1, 0.95, 0.99, 0x7a7468, 'trim');
  bx(IN + 0.05, 3.0, 0.9, 3.8, 0.99, 1.7, C.steel, 'metalPaint'); // coffee machine
  glow(0.9, 3.1, 0.92, 3.7, 1.0, 1.04, 0xff7030);
  for (const v of [3.2, 3.55]) bx(0.7, v - 0.1, 0.9, v + 0.1, 1.04, 1.28, 0x2a1a10, 'carGlass');
  bx(IN + 0.05, 5.0, 0.85, 6.0, 0.99, 1.55, C.red, 'trim'); // soda fountain
  for (let k = 0; k < 4; k++) bx(0.85, 5.1 + k * 0.24, 0.95, 5.2 + k * 0.24, 1.25, 1.4, C.chrome, 'chrome');
  bx(IN + 0.1, 7.2, 0.7, 7.5, 0.99, 1.45, 0x8ad0c8, 'metalPaint'); // shake mixer
  bx(IN + 0.05, 8.4, 0.9, 9.6, 0.99, 1.2, 0xe8e4dc, 'trim'); // glasses and cups
  // Menu boards: four black boards hanging over the back bar, angled into the room.
  const items = [['BURGERS', 'HAMBURGER  3.95', 'CHEESEBURGER  4.25', 'PATTY MELT  4.50'], ['BREAKFAST', '2 EGGS ANY STYLE  3.25', 'PANCAKES  2.95', 'FRENCH TOAST  2.95'],
    ['SANDWICHES', 'CLUB  4.50', 'BLT  3.75', 'TUNA MELT  4.25'], ['DRINKS', 'COFFEE  .75', 'SODA  .95', 'MILKSHAKE  2.50']];
  items.forEach((lines, k) => {
    const v0 = 2.6 + k * 1.95;
    bx(IN, v0, IN + 0.05, v0 + 1.8, 1.95, 2.95, 0x3a2a20, 'planks');
    bx(IN + 0.05, v0 + 0.06, IN + 0.07, v0 + 1.74, 2.01, 2.89, C.board, 'trim');
    lines.forEach((l, j) => sign(l, 'menu', IN + 0.08, v0 + 0.9, 2.78 - j * 0.22, 1.6, j ? 0.13 : 0.17, fromCorner, j ? 0xf2efe8 : 0xffd34a));
  });
  // An old TV on a shelf in the back corner.
  bx(IN, 10.7, 1.0, 11.6, 2.25, 2.3, C.wood, 'planks');
  bx(IN + 0.05, 10.8, 0.85, 11.5, 2.3, 2.85, 0x2a2826, 'metalPaint');
  glow(0.85, 10.88, 0.87, 11.42, 2.38, 2.78, 0x9ab0b8);

  // ---- booths down the alley side: red leather, laminate tables with chrome edges -------------------------------
  const booth = (u0, v0, L) => {
    // Benches run across the room (along u) for L metres from the wall; the table sits between them.
    const seat = (a0, a1, back) => {
      sd(u0, a0, u0 + L, a1, Gt, Gt + 0.36, 0x3a1a16, 'trim');
      bx(u0, a0, u0 + L, a1, Gt + 0.36, SEAT, C.vinyl, 'rubber');
      const [b0, b1] = back < 0 ? [a0, a0 + 0.18] : [a1 - 0.18, a1];
      sd(u0, b0, u0 + L, b1, SEAT, 1.32, C.vinyl, 'rubber');
      for (let k = 1; k < 4; k++) bx(u0 + (L * k) / 4 - 0.01, back < 0 ? a0 + 0.18 : a1 - 0.19, u0 + (L * k) / 4 + 0.01, back < 0 ? a0 + 0.19 : a1 - 0.18, SEAT + 0.05, 1.3, 0x5a1412, 'rubber'); // channel seams
      cover(u0, a0, u0 + L, a1, Gt, 1.32, 'booth');
    };
    seat(v0, v0 + 0.6, -1); seat(v0 + 1.35, v0 + 1.95, 1);
    sd(u0 + 0.15, v0 + 0.62, u0 + L - 0.05, v0 + 1.33, 0.72, 0.76, C.laminate, 'planks');
    bx(u0 + 0.13, v0 + 0.6, u0 + L - 0.03, v0 + 1.35, 0.7, 0.73, C.chrome, 'chrome');
    bx(u0 + L / 2 - 0.04, v0 + 0.94, u0 + L / 2 + 0.04, v0 + 1.02, Gt, 0.7, 0x2a2a2e, 'metalPaint');
    const tu = u0 + L - 0.45, tv = v0 + 0.98;
    bx(tu - 0.06, tv - 0.08, tu + 0.06, tv + 0.08, 0.76, 0.92, C.chrome, 'chrome'); // napkins
    bx(tu - 0.2, tv - 0.05, tu - 0.15, tv, 0.76, 0.94, 0xb02020, 'trim'); bx(tu - 0.2, tv + 0.03, tu - 0.15, tv + 0.08, 0.76, 0.94, 0xd8b020, 'trim');
    bx(tu + 0.12, tv - 0.06, tu + 0.22, tv + 0.06, 0.76, 0.84, 0xc8b8a0, 'trim'); // sugar caddy
    return [{ u: u0 + L * 0.45, v: v0 + 0.32, fu: 0, fv: 1 }, { u: u0 + L * 0.45, v: v0 + 1.63, fu: 0, fv: -1 }];
  };
  const BL = 2.3, seats = [];
  for (let i = 0; i < 4; i++) seats.push(...booth(F - t - BL, 2.0 + i * 2.35, BL));
  { // Two more at the front window: the benches face each other along the glass.
    for (let i = 0; i < 2; i++) {
      const u0 = 4.6 + i * 2.1, v0 = 0.35, L = 1.6;
      for (const [a0, a1, back] of [[u0, u0 + 0.55, -1], [u0 + 1.3, u0 + 1.85, 1]]) {
        sd(a0, v0, a1, v0 + L, Gt, Gt + 0.36, 0x3a1a16, 'trim'); bx(a0, v0, a1, v0 + L, Gt + 0.36, SEAT, C.vinyl, 'rubber');
        const [b0, b1] = back < 0 ? [a0, a0 + 0.16] : [a1 - 0.16, a1];
        sd(b0, v0, b1, v0 + L, SEAT, 1.2, C.vinyl, 'rubber');
        cover(a0, v0, a1, v0 + L, Gt, 1.2, 'booth');
      }
      sd(u0 + 0.58, v0 + 0.1, u0 + 1.27, v0 + L - 0.1, 0.72, 0.76, C.laminate, 'planks');
      bx(u0 + 0.56, v0 + 0.08, u0 + 1.29, v0 + L - 0.08, 0.7, 0.73, C.chrome, 'chrome');
      bx(u0 + 0.88, v0 + 0.7, u0 + 0.96, v0 + 0.78, Gt, 0.7, 0x2a2a2e, 'metalPaint');
      seats.push({ u: u0 + 0.3, v: v0 + 0.8, fu: 1, fv: 0 }, { u: u0 + 1.55, v: v0 + 0.8, fu: -1, fv: 0 });
    }
  }
  // Blinds on the front window (and the corner windows), tilted open.
  for (let y = 1.0; y < 2.8; y += 0.11) bx(0.6, t + 0.02, F - 4.1, t + 0.05, y, y + 0.022, 0xc8c0b0, 'trim');
  if (corner) for (let y = 1.0; y < 2.8; y += 0.11) bx(t + 0.02, 1.4, t + 0.05, CV0 - 0.1, y, y + 0.022, 0xc8c0b0, 'trim');

  // ---- alley wall over the booths: the memorial wall (framed photos), a shelf, the neon OPEN, a city poster ------
  const MW0 = 2.4, MW1 = 10.6, mu = OUTU;
  for (let k = 0; k < 8; k++) {
    const v = MW0 + 0.25 + k * 1.02, y = k % 2 ? 1.75 : 1.95, h = k % 3 ? 0.55 : 0.7;
    if (v > 6.6 && v < 7.9) continue; // the shelf goes here
    bx(mu - 0.04, v, mu, v + 0.48, y, y + h, 0x2a2420, 'planks');
    bx(mu - 0.05, v + 0.05, mu - 0.04, v + 0.43, y + 0.05, y + h - 0.05, rng.pick([0x6a5a50, 0x8a7a6a, 0x5a6a7a, 0x7a6a5a, 0x9a8a72]), 'trim');
  }
  sd(mu - 0.28, 6.6, mu, 7.9, 1.95, 2.0, C.wood, 'planks');
  for (let k = 0; k < 5; k++) { const v = 6.75 + k * 0.24; bx(mu - 0.2, v, mu - 0.14, v + 0.06, 2.0, 2.12, 0xf2e8d8, 'trim'); glow(mu - 0.19, v + 0.01, mu - 0.15, v + 0.05, 2.12, 2.17, 0xffb040); }
  bx(mu - 0.24, 7.65, mu - 0.08, 7.8, 2.0, 2.3, 0x3a7a3a, 'trim');
  sign('NEVER FORGOTTEN', 'menu', mu - 0.05, 7.25, 2.62, 1.4, 0.14, fromAlley, 0xe8d8a8);
  biz.memorialWall = { a: fr.at(mu, MW0), b: fr.at(mu, MW1), y0: 1.75, y1: 2.65 };
  // Red neon OPEN by the front, and a city skyline poster.
  sign('OPEN', 'tower', mu - 0.05, 1.3, 2.3, 1.1, 0.42, fromAlley, 0xff3a2a);
  glow(mu - 0.03, 0.8, mu - 0.02, 1.8, 2.08, 2.1, 0xff3020);
  bx(mu - 0.04, 11.0, mu, 11.75, 1.55, 2.6, 0x16182a, 'trim');
  sign('PALMETTO BAY', 'menu', mu - 0.05, 11.375, 2.45, 0.7, 0.1, fromAlley, 0xe8e0c8);
  for (let k = 0; k < 5; k++) bx(mu - 0.05, 11.08 + k * 0.13, mu - 0.04, 11.18 + k * 0.13, 1.65, 1.85 + ((k * 7) % 4) * 0.12, 0x2a3048, 'trim');

  // ---- kitchen behind the back wall: grill line under a hood, fryers, prep table, fridge, dish sink ---------------
  const KB = D - t;
  bx(t, KB - 0.03, F - t, KB, Gt, 2.2, 0xe4e2dc, 'tile');
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
  sd(11.0, KB - 0.6, 12.6, KB, Gt, 1.9, 0x8a8478, 'metalPaint'); // dry storage shelving
  light(4, 14, 2.6, 0xf2f0e4, 7, 0.4);

  // ---- people: Sal behind the counter, a cook on the line, a waitress, the regulars ------------------------------
  const person = (u, v, y, fu, fv, pose, seed) => biz.patrons.push({ ...at3(u, v, y), yaw: yawOf(fu, fv), pose, seed });
  biz.patrons = [];
  const s0 = rng.int(1, 1e6);
  person(2.35, 6.4, Gt, 1, 0, 'counter', s0 + 1); // Sal
  person(3.3, KB - 1.25, Gt, 0, 1, 'cook', s0 + 2);
  person(8.6, 6.0, Gt, 1, 0.3, 'stand', s0 + 3); // waitress, at the booths
  const sitters = rng.shuffle(seats.slice()).slice(0, 4);
  sitters.forEach((q, i) => person(q.u, q.v, SEAT - 0.82, q.fu, q.fv, 'sit', s0 + 10 + i));
  for (const k of rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 2)) person(stools[k].u, stools[k].v, 0.78 - 0.82, -1, 0, 'sitCounter', s0 + 20 + k);
}
