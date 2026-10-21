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

export const TEMPLATE = { F: 13, D: 16, H: 7.4, A: 4.2, L: 9, ground: 3.4, wall: 0.3 };

// Slots per business type: sign, awning colour, window display, interior and exterior props.
export const TYPES = {
  bodega: { label: 'Bodega', sign: 'neon', signColor: 0x33e0ff, awning: 0x2f7a4a, wall: 0x6a3d34, display: ['COLD BEER', 'LOTTO', 'ATM'], names: ['Rivera Deli & Grocery', 'Lucky Star Bodega', '24/7 Mini Mart', 'El Sol Grocery', 'Corner Stop', 'Golden Apple Deli', 'Big Mike Deli', 'Nice Price Market'] },
  pawn: { label: 'Pawn Shop', sign: 'neon', signColor: 0xffd34a, awning: 0x6e2f5c, wall: 0x5c3530, display: ['WE BUY GOLD', 'LOANS'], names: ['Gold & Pawn', 'Second Chance Pawn', 'King Loans', 'Cash Kings', 'Lucky 7 Pawn'] },
  laundromat: { label: 'Laundromat', sign: 'store', signColor: 0x8fd4ff, awning: 0x3a6aa8, wall: 0x7c7884, display: ['WASH & FOLD'], names: ['Suds City', 'Spin Cycle', 'Bubbles Laundromat', 'Clean Getaway'] },
  boxing: { label: 'Boxing Gym', sign: 'paint', signColor: 0xe8e0d0, awning: 0x8a2a2a, wall: 0x4f3431, display: ['NO PAIN', 'FIGHT NIGHT'], names: ['Ironside Boxing', 'Glass Jaw Gym', 'Southpaw Club', 'Bell to Bell Boxing'] },
  auto: { label: 'Auto Shop', sign: 'paint', signColor: 0xffb03a, awning: 0x4a4652, wall: 0x6f6c76, display: ['BRAKES', 'TIRES'], names: ["Tony's Auto", 'Quick Lube & Tire', 'Downtown Auto Body', 'Lug Nut Garage'] },
  clinic: { label: 'Clinic', sign: 'store', signColor: 0xe8f4ee, awning: 0x4a8a7a, wall: 0x7c7884, display: ['WALK-INS'], names: ['Downtown Walk-In Clinic', 'Mercy Street Clinic', 'Fifth St Urgent Care'] },
  diner: { label: 'Diner (HQ)', sign: 'neon', signColor: 0xff5fd0, awning: 0xb03a3a, wall: 0x8a8590, display: ['OPEN 24 HRS', 'PIE'], names: [] },
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
  kit.quad(fr.at((winU0 + winU1) / 2, 0.4).x, 1.85, fr.at((winU0 + winU1) / 2, 0.4).z, winU1 - winU0 - 0.4, 1.9, out.x, out.z, 0x4a5670, 0xffd9a0);
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
  INTERIOR[biz.type]?.({ solid, box, cover, P, fr, F, D, GH, rng, pal, biz, out });

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
  diner({ solid, box, cover, F, D, biz, fr }) {
    // Booths along the side wall, a long counter with stools, and a memorial wall kept clear for later.
    for (let v = 6; v < D - 2; v += 2.6) {
      solid(0.35, v, 2.2, v + 0.45, G, 1.15, 0xb03a3a, MAT.STD, TAG.PROP);
      solid(0.6, v + 0.75, 1.9, v + 1.55, G, 0.8, 0xd8d4cc, MAT.STD, TAG.PROP);
      cover(0.35, v, 2.2, v + 0.45, G, 1.15, 'booth');
    }
    solid(4.2, 6.2, 5.2, D - 1.6, G, 1.05, 0xd8d4cc, MAT.STD, TAG.PROP);
    cover(4.2, 6.2, 5.2, D - 1.6, G, 1.05, 'counter');
    for (let v = 6.8; v < D - 2; v += 1.3) box(5.6, v, 6.0, v + 0.4, G, 0.75, 0xb03a3a);
    const m = { u0: 7, u1: F - 0.6, v: D - 0.36 };
    box(m.u0, m.v - 0.02, m.u1, m.v, 1.2, 2.8, 0x2a2830);
    biz.memorialWall = { a: fr.at(m.u0, m.v), b: fr.at(m.u1, m.v), y0: 1.2, y1: 2.8 };
  },
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
