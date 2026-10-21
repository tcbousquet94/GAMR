// The warehouse base template: every base is a warehouse with this one layout. It reads as a real city warehouse
// and plays as a castle:
//   walls  - chain-link with barbed wire and brick sections, a rolling vehicle gate (main gate) and a side gate,
//            shipping containers stacked two high as wall sections and towers (ladders on the yard side), a guard
//            booth by the gate, floodlights on poles;
//   yard   - box trucks, pallets and crates as cover, open enough to fight in;
//   keep   - loading docks with roll-up doors (inner gate) and a side door, pallet racks forming lanes, a mezzanine
//            catwalk for high ground, an upstairs office with the safe (the capture point), a roof with skylights.
// Built in the same local frame as businesses: u along the front street (u=0 at the block corner), v into the block.
// Slots: gang colours/signage, fence vs brick sections, container colours, props, upgrade visuals (data only).

import { MAT, TAG } from '../kit.js';
import { G } from '../modules/building.js';
import { placeProp } from '../modules/streets.js';
import { TAGS } from './worn.js';

export const WH = { U0: 2, V0: 2, WU: 48, WV: 44, lane: 5, floor: 1.2, eave: 10, cat: 5.6 };
const FENCE_H = 4.0, COLLIDE_H = 6;
export const GANG_COLORS = { neutral: 0x8a8590, gang0: 0x2f7fe0, gang1: 0xe0453a };
const CONTAINER_COLORS = [0x8a3a2a, 0x2f5f8a, 0x4a6a3a, 0xb07a2a, 0x6a6a72, 0x7a2a3a];

// Compound + service lane around it (kept clear of fill so every wall can be reached from outside).
export function warehouseFootprint(fr) {
  const { U0, V0, WU, WV, lane } = WH;
  return fr.rect(-0.5, 0, U0 + WU + lane, V0 + WV + lane);
}

export function buildWarehouse(kit, fr, wh) {
  const { rng, pal } = kit;
  const { U0, V0, WU, WV, floor: FL, eave: EV, cat: CY } = WH;
  const U1 = U0 + WU, V1 = V0 + WV;
  const R = (u0, v0, u1, v1) => fr.rect(u0, v0, u1, v1);
  const solid = (u0, v0, u1, v1, y0, y1, color, mat = MAT.STD, tag = TAG.BUILDING) => { const r = R(u0, v0, u1, v1); return kit.solid(r.x0, y0, r.z0, r.x1, y1, r.z1, color, mat, tag); };
  const box = (u0, v0, u1, v1, y0, y1, color, mat = MAT.STD) => { const r = R(u0, v0, u1, v1); kit.box(r.x0, y0, r.z0, r.x1, y1, r.z1, color, mat); };
  const coll = (u0, v0, u1, v1, y0, y1, tag = TAG.PROP) => { const r = R(u0, v0, u1, v1); kit.collider(r.x0, y0, r.z0, r.x1, y1, r.z1, tag); };
  const P = (u, v, y = G) => { const p = fr.at(u, v); return { x: +p.x.toFixed(2), y, z: +p.z.toFixed(2) }; };
  const along = Math.abs(fr.tu.x) > 0.5; // frontage runs along world x
  const yawU = along ? Math.PI / 2 : 0, yawV = along ? 0 : Math.PI / 2; // prop yaw for "long along u" / "long along v"
  const gang = GANG_COLORS[wh.owner] ?? GANG_COLORS.neutral;
  const s = (wh.siege = { staging: [], breach: [], defenderPosts: [], cover: [] });
  const fenceSegs = (wh.fenceSections = []);

  // ---- ground: yard slab, lanes ------------------------------------------------------------------------------------
  solid(0, 0, U1 + WH.lane, V1 + WH.lane, -1, G, 0x5d5a62, MAT.STD, TAG.GROUND);
  // Oil stains and painted bay lines in the yard.
  for (let u = U0 + 6; u < U1 - 4; u += 4.5) box(u, V0 + 9, u + 0.12, V0 + 15, G, G + 0.02, 0xc8b04a);

  // ---- perimeter -------------------------------------------------------------------------------------------------------
  // Each edge is a list of sections; style slot per section: 'fence' | 'brick' | 'containers' | gate openings.
  const brickChance = wh.upgrades?.brick ? 1 : 0.35;
  const fence = (u0, v0, u1, v1, style) => {
    const horiz = Math.abs(v1 - v0) < 0.6;
    if (style === 'brick') {
      solid(u0, v0, u1, v1, G, FENCE_H, 0x7a4a3a, MAT.STD, TAG.BUILDING);
      box(u0 - 0.05, v0 - 0.05, u1 + 0.05, v1 + 0.05, FENCE_H - 0.25, FENCE_H, 0x9a8a80);
      coll(u0, v0, u1, v1, FENCE_H, COLLIDE_H, TAG.BOUNDARY);
      // Tags on the street face of the wall.
      const o = outward(u0, v0, u1, v1);
      const n = { x: fr.tu.x * o.u + fr.tv.x * o.v, z: fr.tu.z * o.u + fr.tv.z * o.v };
      const len = horiz ? u1 - u0 : v1 - v0;
      if (len > 5 && rng.chance(0.75)) { const m = fr.at((u0 + u1) / 2, (v0 + v1) / 2); kit.sign(rng.pick(TAGS), 'graffiti', m.x + n.x * 0.32, rng.range(1.5, 2.6), m.z + n.z * 0.32, Math.min(6, len - 1), 1.5, n.x, n.z, rng.pick([0x33e0ff, 0xff3fb8, 0xffd34a, 0xe8e4dc, 0x7dff4a])); }
    } else {
      coll(u0, v0, u1, v1, G, COLLIDE_H, TAG.PROP);
      box(u0, v0, u1, v1, G, FENCE_H, 0x9a9ca4, MAT.GLASS); // chain-link reads see-through
      const len = horiz ? u1 - u0 : v1 - v0;
      for (let t = 0; t <= len + 0.01; t += 3) {
        const a = horiz ? [u0 + t - 0.06, v0 - 0.06, u0 + t + 0.06, v1 + 0.06] : [u0 - 0.06, v0 + t - 0.06, u1 + 0.06, v0 + t + 0.06];
        box(a[0], a[1], a[2], a[3], G, FENCE_H + 0.5, 0x5a5860, MAT.METAL);
      }
      // Barbed-wire coil along the top.
      for (let t = 0; t < len; t += 0.6) {
        const a = horiz ? [u0 + t, v0 - 0.18, u0 + t + 0.3, v1 + 0.18] : [u0 - 0.18, v0 + t, u1 + 0.18, v0 + t + 0.3];
        box(a[0], a[1], a[2], a[3], FENCE_H + 0.15 + ((t * 5) % 2) * 0.12, FENCE_H + 0.32 + ((t * 5) % 2) * 0.12, 0x3a3840, MAT.METAL);
      }
    }
    fenceSegs.push({ id: fenceSegs.length, style, a: P(u0, v0), b: P(u1, v1), mid: P((u0 + u1) / 2, (v0 + v1) / 2), out: outward(u0, v0, u1, v1) });
  };
  const outward = (u0, v0, u1, v1) => {
    if (Math.abs(v1 - v0) < 0.6) return v0 < V0 + 1 ? { u: 0, v: -1 } : { u: 0, v: 1 };
    return u0 < U0 + 1 ? { u: -1, v: 0 } : { u: 1, v: 0 };
  };
  const t = 0.25;
  // Front (v = V0): brick or fence, the main gate, then a container tower at the far corner.
  const gU0 = U0 + 13, gU1 = gU0 + 8.5;
  fence(U0, V0, gU0 - 0.6, V0 + t, rng.chance(brickChance) ? 'brick' : 'fence');
  // Gate posts.
  for (const u of [gU0 - 0.6, gU1]) solid(u, V0 - 0.15, u + 0.6, V0 + 0.45, G, 5.2, 0x6a6670, MAT.STD, TAG.BUILDING);
  const towerU0 = U1 - 12.2;
  fence(gU1 + 0.6, V0, towerU0, V0 + t, rng.chance(brickChance) ? 'brick' : 'fence');
  // Corner side (u = U0): fence with the side gate.
  const sgV0 = V0 + 27, sgV1 = sgV0 + 2.4;
  fence(U0, V0 + t, U0 + t, sgV0, 'fence');
  fence(U0, sgV1, U0 + t, V1, rng.chance(brickChance) ? 'brick' : 'fence');
  // Back (v = V1): brick.
  fence(U0, V1 - t, U1 - 2.44, V1, 'brick');
  // Far side (u = U1): a wall of containers stacked two high (outer face on the fence line).
  const cColor = () => rng.pick(CONTAINER_COLORS);
  const containerTops = [];
  const container = (u0, v0, u1, v1, level, color) => {
    const y0 = G + level * 2.6, y1 = y0 + 2.6;
    solid(u0, v0, u1, v1, y0, y1, color, MAT.METAL, TAG.BUILDING);
    const horiz = u1 - u0 > v1 - v0;
    const len = horiz ? u1 - u0 : v1 - v0;
    for (let k = 0.5; k < len; k += 0.9) {
      const a = horiz ? [u0 + k, v0 - 0.04, u0 + k + 0.25, v1 + 0.04] : [u0 - 0.04, v0 + k, u1 + 0.04, v0 + k + 0.25];
      box(a[0], a[1], a[2], a[3], y0 + 0.1, y1 - 0.1, shade(color, 0.82), MAT.METAL);
    }
  };
  let v = V0;
  while (v < V1 - 0.5) {
    const len = Math.min(rng.chance(0.5) ? 12.2 : 6.1, V1 - v);
    container(U1 - 2.44, v, U1, v + len, 0, cColor());
    if (len > 3) container(U1 - 2.44, v, U1, v + len, 1, cColor());
    if (len > 3) containerTops.push(P(U1 - 1.22, v + len / 2, G + 5.2));
    s.breach.push({ ...P(U1 + 1.4, v + len / 2), kind: 'containerWall', climb: true });
    v += len;
  }
  fenceSegs.push({ id: fenceSegs.length, style: 'containers', a: P(U1, V0), b: P(U1, V1), mid: P(U1, (V0 + V1) / 2), out: { u: 1, v: 0 } });
  // Front-right tower: containers along the front edge, two high.
  container(towerU0, V0, U1, V0 + 2.44, 0, cColor());
  container(towerU0, V0, U1, V0 + 2.44, 1, cColor());
  containerTops.push(P((towerU0 + U1) / 2, V0 + 1.22, G + 5.2));
  s.breach.push({ ...P((towerU0 + U1) / 2, V0 - 1.4), kind: 'containerWall', climb: true });
  // Ladders on the yard side of the container walls.
  const ladderV = [V0 + 9, V0 + 33];
  for (const lv of ladderV) { const r = R(U1 - 2.44 - 0.9, lv, U1 - 2.44, lv + 1.0); kit.climb(r.x0, 0, r.z0, r.x1, G + 5.2 + 0.7, r.z1, 'ladder', 'street', 'roof'); }
  { const r = R(towerU0 + 3, V0 + 2.44, towerU0 + 4, V0 + 2.44 + 0.9); kit.climb(r.x0, 0, r.z0, r.x1, G + 5.2 + 0.7, r.z1, 'ladder', 'street', 'roof'); }

  // Main gate: a rolling gate slid open along the inside of the fence (state slot: open now, closed in sieges).
  box(gU0, V0 + 0.4, gU0 + 8.5, V0 + 0.6, G, 0.25, 0x3a3840, MAT.METAL); // track
  const gateOpenU = gU1 + 0.6;
  box(gateOpenU, V0 + 0.35, gateOpenU + 8.5, V0 + 0.5, G + 0.1, 3.8, 0x7e8088, MAT.GLASS);
  for (let k = 0; k <= 8.5; k += 1.7) box(gateOpenU + k - 0.05, V0 + 0.32, gateOpenU + k + 0.05, V0 + 0.53, G + 0.1, 3.8, 0x5a5860, MAT.METAL);
  wh.gate = { kind: 'main', ...rectOf(R(gU0, V0, gU1, V0 + 0.6)), y0: G, y1: 3.8, open: true, rammable: true };
  // Side gate: a swing gate standing open against the inside of the fence.
  box(U0 + 0.3, sgV1, U0 + 2.6, sgV1 + 0.1, G, 2.4, 0x7e8088, MAT.GLASS);
  wh.sideGate = { kind: 'side', ...rectOf(R(U0, sgV0, U0 + t, sgV1)), y0: G, y1: 2.4, open: true };
  // Sign over the gate on a gantry, in the owner's colour.
  box(gU0 - 0.6, V0 - 0.1, gU1 + 0.6, V0 + 0.4, 5.2, 5.6, 0x4a4650, MAT.METAL);
  const sp = fr.at((gU0 + gU1) / 2, V0 - 0.2);
  kit.sign(wh.name.toUpperCase(), 'paint', sp.x, 6.3, sp.z, 9, 1.2, fr.out.x, fr.out.z, 0xe8e4dc);
  box(gU0 - 0.6, V0 - 0.15, gU1 + 0.6, V0 - 0.1, 5.65, 7.0, gang); // backing board in gang colour

  // Guard booth just inside the main gate.
  const bu0 = gU0 - 4.2, bv0 = V0 + 1.0;
  solid(bu0, bv0, bu0 + 3, bv0 + 3, G, 2.9, 0xc8c4bc, MAT.STD, TAG.BUILDING);
  box(bu0 - 0.2, bv0 - 0.2, bu0 + 3.2, bv0 + 3.2, 2.9, 3.1, 0x4a4650);
  box(bu0 + 0.4, bv0 - 0.03, bu0 + 2.6, bv0, 1.2, 2.3, 0x6f9ac8, MAT.GLASS);
  kit.light(fr.at(bu0 + 1.5, bv0 + 1.5).x, 2.6, fr.at(bu0 + 1.5, bv0 + 1.5).z, 0xfff0d8, 5, 'shop');
  wh.booth = P(bu0 + 1.5, bv0 + 3.8);

  // Floodlights on poles in the yard corners (upgrade slot: more of them).
  wh.floodlights = [];
  for (const [u, vv] of [[U0 + 1.2, V0 + 1.2], [U1 - 3.2, V0 + 3.4], [U0 + 1.2, V0 + 20], [U1 - 3.2, V0 + 20]]) {
    const p = P(u, vv);
    kit.solid(p.x - 0.15, G, p.z - 0.15, p.x + 0.15, 8.4, p.z + 0.15, 0x4a4650, MAT.METAL, TAG.PROP);
    kit.box(p.x - 0.6, 8.2, p.z - 0.3, p.x + 0.6, 8.7, p.z + 0.3, 0x2a2830, MAT.METAL);
    kit.light(p.x, 8.4, p.z, 0xfff4dc, 22, 'flood');
    wh.floodlights.push(p);
  }

  // ---- yard props: box trucks, pallets, crates (cover) -------------------------------------------------------------
  const yard = { u0: U0 + 2, v0: V0 + 4, u1: U1 - 3.5, v1: V0 + 16 };
  const truck = (u, vv) => {
    // Box truck: cab + box, long along v (backed up toward the docks).
    solid(u - 1.25, vv, u + 1.25, vv + 5.2, G + 0.5, G + 3.6, 0xe8e4dc, MAT.STD, TAG.PROP);
    solid(u - 1.2, vv - 2.2, u + 1.2, vv, G + 0.5, G + 2.6, rng.pick([0x8a3a2a, 0x3a5a7a, 0xc8c4bc]), MAT.STD, TAG.PROP);
    box(u - 1.1, vv - 2.25, u + 1.1, vv - 2.2, G + 1.7, G + 2.4, 0x2a3440, MAT.GLASS);
    for (const [du, dv] of [[-1.25, -1.4], [1.25, -1.4], [-1.25, 3.6], [1.25, 3.6]]) box(u + du - 0.15, vv + dv - 0.45, u + du + 0.15, vv + dv + 0.45, G, G + 0.9, 0x1b1b1e);
    s.cover.push({ ...rectOf(R(u - 1.25, vv - 2.2, u + 1.25, vv + 5.2)), y0: G, y1: G + 3.6, kind: 'truck' });
  };
  truck(U0 + 9, V0 + 9.5);
  if (rng.chance(0.7)) truck(U0 + 31, V0 + 8);
  const pallets = [];
  for (let k = 0; k < 24 && pallets.length < 6; k++) { // keep drawing until the yard has its cover stacks
    const u = rng.range(yard.u0 + 2, yard.u1 - 2), vv = rng.range(yard.v0 + 1, yard.v1);
    if (Math.abs(u - (U0 + 9)) < 2.6 || (Math.abs(u - (U0 + 31)) < 2.6 && vv > V0 + 4)) continue;
    if (u > gU0 - 2.5 && u < gU1 + 2.5 && vv < V0 + 10) continue; // keep the gate mouth (and the yard spawn) clear
    const h = rng.chance(0.5) ? 1.1 : 0.55;
    solid(u - 0.6, vv - 0.6, u + 0.6, vv + 0.6, G, G + h, rng.chance(0.6) ? 0xa48a62 : 0x8a7a68, MAT.STD, TAG.PROP);
    s.cover.push({ ...rectOf(R(u - 0.6, vv - 0.6, u + 0.6, vv + 0.6)), y0: G, y1: G + h, kind: 'pallets' });
    pallets.push(P(u, vv));
  }
  for (let k = 0; k < 3; k++) { const p = P(rng.range(U0 + 3, U0 + 7), rng.range(V0 + 14, V0 + 19)); placeProp(kit, 'crate', p.x, G, p.z); }
  placeProp(kit, 'dumpster', P(U0 + 3, V1 - 2.5).x, G, P(U0 + 3, V1 - 2.5).z, yawU, 0x3d4a3a);

  // ---- the building (the keep) ----------------------------------------------------------------------------------------
  const B = { u0: U0 + 6, v0: V0 + 21, u1: U1 - 6, v1: V1 - 0.6 };
  const wallC = rng.pick([0x7c7884, 0x8a7a6a, 0x6f6c76]);
  const W = 0.4;
  // Floor at dock height.
  solid(B.u0, B.v0, B.u1, B.v1, -1, FL, 0x6a6670, MAT.STD, TAG.GROUND);
  // Front wall with three dock doors (open roll-up doors: the inner gate).
  const docks = [[B.u0 + 3, B.u0 + 7], [B.u0 + 9.5, B.u0 + 13.5], [B.u0 + 16, B.u0 + 20]];
  let a = B.u0;
  for (const [d0, d1] of docks) { solid(a, B.v0, d0, B.v0 + W, FL, EV, wallC); solid(d0, B.v0, d1, B.v0 + W, FL + 4.2, EV, wallC); box(d0 - 0.1, B.v0 - 0.3, d1 + 0.1, B.v0, FL + 4.2, FL + 4.8, 0x55525a, MAT.METAL); a = d1; }
  solid(a, B.v0, B.u1, B.v0 + W, FL, EV, wallC);
  wh.docks = docks.map(([d0, d1]) => ({ outside: P((d0 + d1) / 2, B.v0 - 1.2, FL), inside: P((d0 + d1) / 2, B.v0 + 1.6, FL), open: true }));
  // Dock platform with stairs at its end; bumpers.
  solid(B.u0 + 1, B.v0 - 3.4, docks[2][1] + 1.5, B.v0, G, FL, 0x8a8590, MAT.STD, TAG.PLATFORM);
  rampUV(kit, fr, docks[2][1] + 1.5, B.v0 - 3.4, docks[2][1] + 5, B.v0 - 0.6, '-u', G, FL, 0x8a8590);
  for (const [d0, d1] of docks) for (const u of [d0 + 0.3, d1 - 0.6]) box(u, B.v0 - 3.55, u + 0.3, B.v0 - 3.4, 0.5, FL - 0.1, 0x1b1b1e);
  // Side wall (corner side) with the side door and its steps; the other walls plain.
  const sdV0 = B.v1 - 5, sdV1 = sdV0 + 1.2;
  solid(B.u0, B.v0, B.u0 + W, sdV0, FL, EV, wallC);
  solid(B.u0, sdV0, B.u0 + W, sdV1, FL + 2.3, EV, wallC);
  solid(B.u0, sdV1, B.u0 + W, B.v1, FL, EV, wallC);
  rampUV(kit, fr, B.u0 - 3.2, sdV0 - 0.4, B.u0, sdV1 + 0.4, '+u', G, FL, 0x8a8590);
  wh.sideDoor = { outside: P(B.u0 - 3.8, (sdV0 + sdV1) / 2), inside: P(B.u0 + 1.2, (sdV0 + sdV1) / 2, FL) };
  solid(B.u1 - W, B.v0, B.u1, B.v1, FL, EV, wallC);
  solid(B.u0, B.v1 - W, B.u1, B.v1, FL, EV, wallC);
  // Walls below the floor slab (plinth) and the cornice, painted stripe in the owner's colour, high windows.
  box(B.u0 - 0.05, B.v0 - 0.05, B.u1 + 0.05, B.v1 + 0.05, EV - 0.5, EV, 0x9a96a0);
  box(B.u0 - 0.06, B.v0 - 0.06, B.u1 + 0.06, B.v0, 6.4, 7.0, gang);
  for (let u = B.u0 + 2; u < B.u1 - 2; u += 4) kit.quad(fr.at(u, B.v0 - 0.05).x, 8.0, fr.at(u, B.v0 - 0.05).z, 2.6, 1.2, fr.out.x, fr.out.z, 0x6c86ad, rng.chance(0.4) ? 0xffd9a0 : 0x2a3348);
  const nameP = fr.at((B.u0 + B.u1) / 2 + 6, B.v0 - 0.08);
  kit.sign(wh.name.toUpperCase(), 'paint', nameP.x, 8.6, nameP.z, 14, 1.4, fr.out.x, fr.out.z, 0xe8e4dc);
  // Roof with skylights (holes you can drop through), parapet, a ladder up the corner-side wall.
  const sky = [[B.u0 + 6, B.u0 + 9], [B.u0 + 15, B.u0 + 18], [B.u0 + 24, B.u0 + 27]], skV0 = B.v0 + 8, skV1 = skV0 + 3;
  solid(B.u0, B.v0, B.u1, skV0, EV - 0.4, EV, 0x6a6670, MAT.STD, TAG.BUILDING);
  solid(B.u0, skV1, B.u1, B.v1, EV - 0.4, EV, 0x6a6670, MAT.STD, TAG.BUILDING);
  let su = B.u0;
  for (const [k0, k1] of sky) { solid(su, skV0, k0, skV1, EV - 0.4, EV, 0x6a6670, MAT.STD, TAG.BUILDING); box(k0 - 0.15, skV0 - 0.15, k1 + 0.15, skV1 + 0.15, EV, EV + 0.35, 0x8a8590); box(k0, skV0, k1, skV1, EV + 0.3, EV + 0.36, 0xa8c8e0, MAT.GLASS); su = k1; }
  solid(su, skV0, B.u1, skV1, EV - 0.4, EV, 0x6a6670, MAT.STD, TAG.BUILDING);
  wh.skylights = sky.map(([k0, k1]) => ({ roof: P((k0 + k1) / 2, skV0 - 1.4, EV), drop: P((k0 + k1) / 2, (skV0 + skV1) / 2, FL) }));
  for (const [u0, v0, u1, v1] of [[B.u0, B.v0, B.u1, B.v0 + 0.3], [B.u0, B.v1 - 0.3, B.u1, B.v1], [B.u0, B.v0, B.u0 + 0.3, B.v1], [B.u1 - 0.3, B.v0, B.u1, B.v1]]) solid(u0, v0, u1, v1, EV, EV + 0.7, 0x7a7680, MAT.STD, TAG.RAIL);
  for (const [u, vv] of [[B.u0 + 30, B.v0 + 4], [B.u0 + 30, B.v1 - 5]]) { solid(u - 1, vv - 0.8, u + 1, vv + 0.8, EV, EV + 1.3, 0x9a98a0, MAT.METAL, TAG.PROP); s.cover.push({ ...rectOf(R(u - 1, vv - 0.8, u + 1, vv + 0.8)), y0: EV, y1: EV + 1.3, kind: 'ac' }); }
  { const r = R(B.u0 - 0.9, B.v0 + 2, B.u0, B.v0 + 3); kit.climb(r.x0, 0, r.z0, r.x1, EV + 0.7, r.z1, 'ladder', 'street', 'roof'); }
  wh.roof = P((B.u0 + B.u1) / 2, B.v1 - 3, EV);
  // Interior: pallet racks in two rows with lanes between, lit by hanging lamps.
  const racks = [];
  for (const rv of [B.v0 + 6.5, B.v0 + 11.5]) for (const [r0, r1] of [[B.u0 + 2, B.u0 + 10], [B.u0 + 13, B.u0 + 21]]) {
    solid(r0, rv, r1, rv + 1.2, FL, FL + 4.4, null, MAT.STD, TAG.PROP);
    for (const y of [FL, FL + 1.5, FL + 3.0, FL + 4.3]) box(r0, rv, r1, rv + 1.2, y, y + 0.1, 0xc87a2a, MAT.METAL);
    for (const u of [r0, r1 - 0.12]) box(u, rv, u + 0.12, rv + 1.2, FL, FL + 4.4, 0x2f5f8a, MAT.METAL);
    for (let k = 0; k < 6; k++) box(r0 + 0.3 + k * 1.3, rv + 0.1, r0 + 1.4 + k * 1.3, rv + 1.1, FL + 0.1 + (k % 3) * 1.5, FL + 1.2 + (k % 3) * 1.5, rng.pick([0xa48a62, 0x8a7a68, 0xc8c4bc, 0x6a5a48]));
    s.cover.push({ ...rectOf(R(r0, rv, r1, rv + 1.2)), y0: FL, y1: FL + 4.4, kind: 'rack' });
    racks.push(P((r0 + r1) / 2, rv + 0.6, FL));
  }
  for (let u = B.u0 + 5; u < B.u1 - 3; u += 8) kit.light(fr.at(u, B.v0 + 9).x, EV - 1.5, fr.at(u, B.v0 + 9).z, 0xfff0d8, 12, 'shop');
  // Mezzanine catwalk along the back wall and the far side, stairs up from the floor, railings.
  const cw = 2.2;
  solid(B.u0 + W, B.v1 - W - cw, B.u1 - W, B.v1 - W, CY - 0.3, CY, 0x6a6670, MAT.METAL, TAG.PLATFORM);
  solid(B.u1 - W - cw, B.v0 + 5, B.u1 - W, B.v1 - W - cw, CY - 0.3, CY, 0x6a6670, MAT.METAL, TAG.PLATFORM);
  const railC = 0xc8a83a;
  const officeU0 = B.u1 - W - 10, officeV0 = B.v1 - W - cw - 6;
  // Pipe railings (posts, top and knee rails) over one thin collider; they stop at the office.
  const railing = (u0, v0, u1, v1) => {
    const r = R(u0, v0, u1, v1); kit.collider(r.x0, CY, r.z0, r.x1, CY + 1.05, r.z1, TAG.RAIL);
    const alongU = u1 - u0 > v1 - v0, len = alongU ? u1 - u0 : v1 - v0;
    for (const [y0, y1] of [[CY + 0.98, CY + 1.05], [CY + 0.5, CY + 0.55]]) box(u0, v0, u1, v1, y0, y1, railC, MAT.METAL);
    for (let t = 0; t <= len; t += 2) { const a = alongU ? u0 + t : u0, b = alongU ? v0 : v0 + t; box(a, b, a + (alongU ? 0.06 : u1 - u0), b + (alongU ? v1 - v0 : 0.06), CY, CY + 1.0, railC, MAT.METAL); }
  };
  railing(B.u0 + W + 11, B.v1 - W - cw - 0.1, officeU0, B.v1 - W - cw);
  railing(B.u1 - W - cw - 0.1, B.v0 + 5, B.u1 - W - cw, officeV0);
  // Stairs: along the back wall, rising toward the corner side, landing on the catwalk's end.
  rampUV(kit, fr, B.u0 + W + 2.5, B.v1 - W - cw - 2.2, B.u0 + W + 11, B.v1 - W - cw, '-u', FL, CY, 0x8a8590);
  solid(B.u0 + W, B.v1 - W - cw - 2.2, B.u0 + W + 2.5, B.v1 - W - cw, CY - 0.3, CY, 0x6a6670, MAT.METAL, TAG.PLATFORM);
  wh.catwalk = [P(B.u0 + 14, B.v1 - W - cw / 2, CY), P(B.u1 - W - cw / 2, B.v0 + 8, CY), P(B.u1 - W - cw / 2, B.v0 + 14, CY)];
  // Office on the mezzanine in the far back corner: floor slab, walls with doors to both catwalks, a window over
  // the floor, desk, cabinets and the safe (the capture point).
  const O = { u0: B.u1 - W - 10, v0: B.v1 - W - cw - 6, u1: B.u1 - W, v1: B.v1 - W - cw };
  solid(O.u0, O.v0, O.u1, O.v1, CY - 0.3, CY, 0x6a6670, MAT.STD, TAG.PLATFORM);
  for (const u of [O.u0 + 0.2, O.u1 - cw - 0.2]) solid(u - 0.2, O.v0 - 0.2, u + 0.2, O.v0 + 0.2, FL, CY - 0.3, 0x5a5860, MAT.METAL, TAG.PROP); // columns
  const OW = 0.2, OH = CY + 2.8, offC = 0xd8d4cc;
  // Front wall (toward the floor): window, and a door from the side catwalk at its far end.
  solid(O.u0, O.v0, O.u1 - cw - 0.1, O.v0 + OW, CY, CY + 1.0, offC);
  solid(O.u0, O.v0, O.u1 - cw - 0.1, O.v0 + OW, CY + 1.0, CY + 2.2, 0x9ab8d0, MAT.GLASS);
  solid(O.u0, O.v0, O.u1 - cw - 0.1, O.v0 + OW, CY + 2.2, OH, offC);
  solid(O.u1 - cw - 0.1, O.v0, O.u1, O.v0 + OW, CY + 2.2, OH, offC); // over the side-catwalk door (catwalk runs in here)
  // Corner-side wall closed; the office's back is open onto the back catwalk (the second way in).
  solid(O.u0, O.v0 + OW, O.u0 + OW, O.v1, CY, OH, offC);
  box(O.u0, O.v0, O.u1, O.v1, OH - 0.05, OH + 0.12, 0x8a8590); // ceiling
  solid(O.u0 + 1, O.v0 + 1, O.u0 + 3.4, O.v0 + 2.1, CY, CY + 0.8, 0x6a4a3a, MAT.STD, TAG.PROP); // desk
  for (let k = 0; k < 3; k++) solid(O.u0 + 4 + k * 0.6, O.v1 - 0.6, O.u0 + 4.5 + k * 0.6, O.v1, CY, CY + 1.3, 0x7a7680, MAT.METAL, TAG.PROP); // cabinets
  const sf = { u0: O.u1 - cw - 1.6, v0: O.v0 + 1.4, u1: O.u1 - cw - 0.4, v1: O.v0 + 2.6 };
  solid(sf.u0, sf.v0, sf.u1, sf.v1, CY, CY + 1.3, 0x3a3d48, MAT.METAL, TAG.PROP);
  box(sf.u0 + 0.15, sf.v0 - 0.03, sf.u0 + 0.5, sf.v0, CY + 0.5, CY + 0.85, 0xc8a83a, MAT.METAL); // dial
  wh.safe = { ...P((sf.u0 + sf.u1) / 2, (sf.v0 + sf.v1) / 2, CY + 1.3) };
  wh.office = P(O.u0 + 3, O.v0 + 3.5, CY);
  kit.light(fr.at((O.u0 + O.u1) / 2, (O.v0 + O.v1) / 2).x, OH - 0.4, fr.at((O.u0 + O.u1) / 2, (O.v0 + O.v1) / 2).z, 0xfff0d8, 7, 'shop');
  s.cover.push({ ...rectOf(R(O.u0 + 1, O.v0 + 1, O.u0 + 3.4, O.v0 + 2.1)), y0: CY, y1: CY + 0.8, kind: 'desk' });

  // ---- siege data -------------------------------------------------------------------------------------------------------
  // Breach points: main gate (rammable), side gate, cuttable fence sections, the container walls (above), dock doors,
  // side door, skylights.
  s.breach.unshift(
    { ...P((gU0 + gU1) / 2, V0 - 1.6), kind: 'mainGate', rammable: true },
    { ...P(U0 - 1.6, (sgV0 + sgV1) / 2), kind: 'sideGate' },
  );
  for (const f of fenceSegs) if (f.style === 'fence' || f.style === 'brick') {
    const o = f.out;
    s.breach.push({ x: +(f.mid.x + (fr.tu.x * o.u + fr.tv.x * o.v) * 1.6).toFixed(2), y: G, z: +(f.mid.z + (fr.tu.z * o.u + fr.tv.z * o.v) * 1.6).toFixed(2), kind: f.style === 'brick' ? 'brickWall' : 'fenceCut', section: f.id });
  }
  for (const d of wh.docks) s.breach.push({ ...d.outside, kind: 'dockDoor' });
  s.breach.push({ ...wh.sideDoor.outside, kind: 'sideDoor' });
  for (const k of wh.skylights) s.breach.push({ ...k.roof, kind: 'skylight' });
  // Defender posts: container tops, guard booth, yard cover, dock doors, catwalk, office.
  for (const p of containerTops) s.defenderPosts.push({ ...p, kind: 'containerTop' });
  s.defenderPosts.push({ ...wh.booth, kind: 'guardBooth' });
  for (const p of pallets.slice(0, 3)) s.defenderPosts.push({ ...p, kind: 'yardCover' });
  for (const d of wh.docks) s.defenderPosts.push({ ...d.inside, kind: 'dockDoor' });
  for (const p of wh.catwalk) s.defenderPosts.push({ ...p, kind: 'catwalk' });
  s.defenderPosts.push({ ...wh.office, kind: 'office' });
  wh.capture = wh.safe;
  // Slots for later systems (data only for now).
  wh.siegeEquipment = [
    { kind: 'ramTruck', target: 'mainGate', from: 'staging' },
    { kind: 'boltCutters', targets: fenceSegs.filter((f) => f.style === 'fence').map((f) => f.id) },
    { kind: 'ladders', targets: ['containerWall', 'building'] },
    { kind: 'forklift', spawn: P(U0 + 20, V0 + 17), targets: ['catwalk', 'containers'] },
  ];
  wh.upgradeSlots = [
    { kind: 'brickWalls', sections: fenceSegs.filter((f) => f.style === 'fence').map((f) => f.id) },
    { kind: 'reinforcedGate', gate: 'main' },
    { kind: 'floodlights', positions: [P(U0 + 22, V0 + 1.2), P(U0 + 1.2, V1 - 2), P(U1 - 3.2, V1 - 2)] },
    { kind: 'cameras', mounts: [P(gU0 - 0.3, V0, 5.2), P(B.u0, B.v0, EV), P(B.u1, B.v0, EV)] },
    { kind: 'barbedWire', sections: fenceSegs.map((f) => f.id) },
    { kind: 'guardDog', kennel: P(U0 + 3, V0 + 18) },
    { kind: 'barricades', positions: [...wh.docks.map((d) => d.inside), P((gU0 + gU1) / 2, V0 + 2.5)] },
  ];
  wh.upgrades = wh.upgrades || {};
  // Spawn points for later AI and the player start (just inside the gate).
  kit.spawn(P((gU0 + gU1) / 2, V0 + 5).x, G, P((gU0 + gU1) / 2, V0 + 5).z, 'yard');
  kit.spawn(wh.docks[1].inside.x, FL, wh.docks[1].inside.z, 'door');
  wh.yardSpawn = P((gU0 + gU1) / 2, V0 + 6);
  wh.compound = rectOf(R(U0, V0, U1, V1));
  return wh;
}

// Ramp in local axes: uphill along +u/-u/+v/-v, mapped onto the kit's world-axis ramps.
function rampUV(kit, fr, u0, v0, u1, v1, up, y0, y1, color) {
  const r = fr.rect(u0, v0, u1, v1);
  const vec = up === '+u' ? fr.tu : up === '-u' ? { x: -fr.tu.x, z: -fr.tu.z } : up === '+v' ? fr.tv : { x: -fr.tv.x, z: -fr.tv.z };
  const dir = Math.abs(vec.x) > 0.5 ? (vec.x > 0 ? 'x+' : 'x-') : vec.z > 0 ? 'z+' : 'z-';
  kit.ramp(r.x0, r.z0, r.x1, r.z1, dir, y0, y1, color, { solidBelow: true });
}

const rectOf = (r) => ({ x0: +r.x0.toFixed(2), z0: +r.z0.toFixed(2), x1: +r.x1.toFixed(2), z1: +r.z1.toFixed(2) });
function shade(c, k) { const r = ((c >> 16) & 255) * k, g = ((c >> 8) & 255) * k, b = (c & 255) * k; return (r << 16) | (g << 8) | b; }

export const WAREHOUSE_NAMES = ['Pier 9 Freight', 'Riverside Storage', 'Atlas Cold Storage', 'Union Supply Co.', 'Greystone Logistics', 'Harbor Bonded', 'Eastside Wholesale', 'Ironline Freight', 'Northgate Depot', 'Canal St Storage'];
export const HQ_WAREHOUSE_NAMES = ["Sal's Wholesale", 'Blue Plate Supply'];
