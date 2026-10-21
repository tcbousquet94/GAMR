// Character models in smooth, organic forms: Dee (teal), Speakerphone Guy, Scooter Bro, the Canvasser, the HOA
// President, her drones. Survivor accents are saturated; every enemy is muted olive / gray / brown / dusty.
// Cloth parts (hems, jacket flaps, drawstrings) are separate rig parts the actor layer swings on springs.

import { scap, sball, sbox, scyl, slathe, smoothMerge as fmergeSmooth, at } from '../facet.js';
import { humanoid } from './humanoid.js';

// ---- DEE OKAFOR (teal scrubs, white sneakers, dark hair in a big high bun) ------------------------------------
export function deeModel() {
  const TEAL = 0x1fa89a, TEAL_D = 0x168276, SKIN = 0xc28a63, HAIR = 0x34251e;
  const hair = [
    sball(0.133, HAIR, at(0, 0.235, 0.012, 0, 0, 0, 1, 1.05, 1.06), 18), // cap of hair, pulled back
    sball(0.115, HAIR, at(0, 0.18, 0.05, 0, 0, 0, 1.02, 1.0, 0.9), 14),
    sball(0.115, HAIR, at(0, 0.45, 0.06), 16), // signature bun, exaggerated for readability from behind
    scap(0.025, 0.16, 0x2a1d18, at(0, 0.39, 0.06, 0, 0, Math.PI / 2), 8), // hair tie
  ];
  return humanoid({
    skin: SKIN, shirt: TEAL, sleeve: TEAL, cuff: SKIN, pants: TEAL, pantsLow: TEAL, shoes: 0xf0efea, sole: 0xd6d4ce,
    build: 0.92, chest: 0.95, legWidth: 1.18, flare: 1.15, headScale: 1.03,
    face: { brows: 'calm', lip: 0x7a4438 },
    extra: {
      head: hair,
      torso: [
        // V-neck, white cross on the chest, pens in the pocket.
        sbox(0.1, 0.1, 0.02, SKIN, at(0, 0.5, -0.11, 0, 0, Math.PI / 4), 0.01),
        sbox(0.07, 0.022, 0.012, 0xffffff, at(0.085, 0.4, -0.118), 0.006), sbox(0.022, 0.07, 0.012, 0xffffff, at(0.085, 0.4, -0.118), 0.006),
        scyl(0.007, 0.007, 0.09, 0x2a3a8a, at(-0.09, 0.42, -0.115)), scyl(0.007, 0.007, 0.08, 0xd0d0d0, at(-0.075, 0.415, -0.115)),
      ],
      legR: [sbox(0.05, 0.14, 0.12, TEAL_D, at(0.085, -0.24, 0), 0.02)], // cargo pocket
      foreR: [scap(0.012, 0.13, 0x9be6dc, at(0, -0.33, -0.07, Math.PI / 2, 0, 0), 6)], // syringe dart in hand
    },
    cloth: [
      // Scrub-top hem: flares over the hips and swings as she runs.
      { name: 'hem', parent: 'torso', pivot: [0, 0.06, 0], geos: [slathe([[0.155, 0.0], [0.17, -0.06], [0.185, -0.13], [0.19, -0.15]], TEAL_D, at(0, 0, 0), 0.68)] },
    ],
  });
}

// Overlays: character-specific upper-body actions layered on the animator's locomotion pose (p is mutated).
export function deeOverlay(p, st) {
  if (st.firing && !st.climb) { p.armR = [1.45 + st.pitch, 0, 0.1]; p.foreR = [0.05, 0, 0]; p.torso[1] -= 0.15; }
  if (st.throwT > 0) { p.armL = [2.6 * st.throwT, 0, -0.4]; p.foreL = [0.3, 0, 0]; p.torso[1] += 0.3 * st.throwT; }
  if (st.spin > 0) { p.hips[1] += st.spin * Math.PI * 4; p.armL = [0.2, 0, -1.3]; p.armR = [0.2, 0, 1.3]; }
  if (st.cart) { p.armL = [1.3, 0, 0]; p.armR = [1.3, 0, 0]; p.foreL = [0.2, 0, 0]; p.foreR = [0.2, 0, 0]; p.torso[0] -= 0.3; }
}

// ---- SPEAKERPHONE GUY (muted: olive puffer vest, dusty maroon-brown shirt, phone held up to his mouth) ---------
export function speakerphoneModel() {
  const VEST = 0x5d6145, VEST_D = 0x4f5339, SHIRT = 0x6b4f47, SKIN = 0xb98a6a, HAIR = 0x3b2c24;
  const vest = [];
  for (let i = 0; i < 4; i++) vest.push(slathe([[0.0, -0.05], [0.205, -0.05], [0.215, 0.0], [0.205, 0.05], [0.0, 0.05]], i % 2 ? VEST : VEST_D, at(0, 0.13 + i * 0.1, 0), 0.68));
  return humanoid({
    skin: SKIN, shirt: SHIRT, sleeve: SHIRT, pants: 0x3a3a3f, shoes: 0x5a4636, build: 1.12, chest: 1.05,
    face: { brows: 'angry', mouth: 'yell', stubble: 0x5a4a40 },
    extra: {
      head: [
        sball(0.13, HAIR, at(0, 0.27, 0.01, 0, 0, 0, 1, 0.6, 1.02), 14),
        ...[[-0.06, 0.34, 0.0, 0.3], [0.05, 0.35, -0.03, -0.3], [0.0, 0.34, 0.06, 0.4], [-0.02, 0.36, -0.06, -0.5]].map(([x, y, z, r]) => scap(0.028, 0.06, HAIR, at(x, y, z, r, 0, r * 0.6), 6)),
      ],
      torso: [...vest, scyl(0.006, 0.006, 0.22, 0x8a8a88, at(0, 0.38, -0.115, 0.15, 0, 0)), scap(0.016, 0.03, 0x9a9a9a, at(0, 0.26, -0.13, 0, 0, Math.PI / 2), 6)],
      // Phone in the right hand, screen facing his mouth.
      foreR: [sbox(0.075, 0.15, 0.015, 0x1d1d22, at(0, -0.33, -0.04), 0.008), sbox(0.06, 0.12, 0.004, 0x4a6070, at(0, -0.33, -0.049), 0.002)],
    },
  });
}
export function speakerphoneOverlay(p, st) {
  // Phone held up in front of his face, other fist clenched; leans in aggressively.
  if (st.stun <= 0) { p.armR = [1.1, 0, 0.35]; p.foreR = [1.6, 0, 0]; }
  p.torso[0] -= 0.12;
  if (st.windup > 0) { p.armR = [1.3 + st.windup * 0.4, 0, 0.3]; p.torso[0] += 0.3 * st.windup; p.head[0] -= 0.3 * st.windup; }
}

// ---- SCOOTER BRO (muted: slate hoodie, brown backwards cap, khaki cargos, sunglasses, e-scooter) ----------------
export function scooterModel() {
  const HOOD = 0x676b72, HOOD_D = 0x575b62, SKIN = 0xc09576, CAP = 0x4a4038;
  const m = humanoid({
    skin: SKIN, shirt: HOOD, sleeve: HOOD, pants: 0x7c785c, shoes: 0x8a8682, sole: 0xc8c4bc, legWidth: 1.15,
    face: { shades: true, mouth: 'grin', brows: 'happy' },
    extra: {
      head: [
        sball(0.135, CAP, at(0, 0.25, 0.005, 0, 0, 0, 1, 0.75, 1.04), 16),
        sbox(0.17, 0.02, 0.11, 0x3c342e, at(0, 0.24, 0.16, -0.15, 0, 0), 0.01), // brim, worn backwards
      ],
      torso: [slathe([[0.0, 0.0], [0.15, 0.0], [0.19, 0.08], [0.14, 0.16], [0.0, 0.18]], HOOD_D, at(0, 0.48, 0.1), 0.6)], // hood
      legL: [sbox(0.05, 0.12, 0.13, 0x6a664c, at(-0.09, -0.24, 0), 0.02)], legR: [sbox(0.05, 0.12, 0.13, 0x6a664c, at(0.09, -0.24, 0), 0.02)],
    },
    cloth: [
      // Hoodie drawstrings.
      { name: 'stringL', parent: 'torso', pivot: [-0.045, 0.5, -0.11], geos: [scap(0.006, 0.13, 0xb0aca4, at(0, -0.07, 0), 4)] },
      { name: 'stringR', parent: 'torso', pivot: [0.045, 0.5, -0.11], geos: [scap(0.006, 0.13, 0xb0aca4, at(0, -0.07, 0), 4)] },
    ],
  });
  m.parts.push({
    name: 'scooter', parent: null, pivot: [0, 0, 0], geo: fmergeSmooth([
      sbox(0.18, 0.05, 0.95, 0x2c2c30, at(0, 0.12, 0), 0.02),
      scyl(0.13, 0.13, 0.05, 0x232326, at(0, 0.13, -0.55, 0, 0, Math.PI / 2), 16), scyl(0.13, 0.13, 0.05, 0x232326, at(0, 0.13, 0.5, 0, 0, Math.PI / 2), 16),
      scyl(0.022, 0.022, 1.0, 0x3a3a3e, at(0, 0.62, -0.55)),
      scap(0.02, 0.46, 0x3a3a3e, at(0, 1.1, -0.55, 0, 0, Math.PI / 2), 6),
      scap(0.03, 0.06, 0x6a5a48, at(-0.24, 1.1, -0.55, 0, 0, Math.PI / 2), 6), scap(0.03, 0.06, 0x6a5a48, at(0.24, 1.1, -0.55, 0, 0, Math.PI / 2), 6),
      sball(0.03, 0xaaa79c, at(0.15, 1.13, -0.55), 8), // bell
    ]),
  });
  return m;
}
export function scooterOverlay(p, st, hipsT) {
  // Crouched on the deck, hands on the bars, one foot forward. Leans into his own turns.
  hipsT[1] += 0.14;
  const bank = p.torso[2];
  p.legL = [0.5, 0, 0]; p.shinL = [-0.8, 0, 0]; p.footL = [0.3, 0, 0]; p.legR = [-0.15, 0, 0]; p.shinR = [-0.6, 0, 0]; p.footR = [0.75, 0, 0];
  p.torso = [-0.55 + p.torso[0] * 0.3, 0, bank * 1.6];
  p.armL = [1.0, 0, -0.15]; p.foreL = [0.3, 0, 0]; p.armR = [1.0, 0, 0.15]; p.foreR = [0.3, 0, 0];
  p.head[0] += 0.35;
  p.hips = [0, 0, bank * 0.8];
  if (st.windup > 0) { p.armR = [1.3, 0, 0.3]; p.foreR = [0.9 + Math.sin(st.t * 30) * 0.3, 0, 0]; } // ringing the bell
  if (st.crashed) { p.torso = [0.6, 0, 0.5]; p.head = [0.4, 0, 0.4]; p.armL = [2.4, 0, -0.6]; p.armR = [2.2, 0, 0.7]; p.scooter = { r: [0, 0.8, 1.4], t: [0.5, 0.15, 0.2] }; }
}

// ---- THE CANVASSER (muted: dusty tan jacket, sage shirt, lanyard and ID, clipboard, huge grin) -----------------
export function canvasserModel() {
  const JACKET = 0x9a8862, JACKET_D = 0x87764f, SHIRT = 0x848c7a, SKIN = 0xcf9f7c, HAIR = 0x5b3e2a;
  const flap = (side) => slathe([[0.0, 0.0], [0.09, 0.0], [0.1, -0.2], [0.11, -0.3], [0.0, -0.32]], side < 0 ? JACKET : JACKET_D, at(0, 0, 0, 0, 0, 0, 1, 1, 0.5), 1, 10);
  return humanoid({
    skin: SKIN, shirt: SHIRT, sleeve: JACKET, pants: 0x38383d, shoes: 0x5e4a38,
    face: { brows: 'happy', mouth: 'grin' },
    extra: {
      head: [sball(0.135, HAIR, at(0, 0.25, 0.015, 0, 0, 0, 1.02, 0.85, 1.05), 16), scap(0.04, 0.08, HAIR, at(0.04, 0.33, -0.08, -0.9, 0, -0.3), 8)],
      torso: [
        slathe([[0.0, 0.2], [0.2, 0.2], [0.21, 0.42], [0.16, 0.54], [0.0, 0.56]], JACKET, at(0, 0, 0.005), 0.66), // jacket shoulders
        scyl(0.006, 0.006, 0.22, 0x55606c, at(-0.04, 0.38, -0.12, 0, 0, 0.15)), scyl(0.006, 0.006, 0.22, 0x55606c, at(0.04, 0.38, -0.12, 0, 0, -0.15)),
        sbox(0.075, 0.1, 0.01, 0xe6e2d6, at(0, 0.24, -0.125), 0.006), // ID card
      ],
      foreL: [sbox(0.24, 0.32, 0.025, 0x5a4434, at(0.06, -0.3, -0.08, 0.3, 0, 0), 0.01), sbox(0.2, 0.22, 0.006, 0xe8e4d8, at(0.06, -0.27, -0.097, 0.3, 0, 0), 0.003), sbox(0.06, 0.025, 0.03, 0x8a8a88, at(0.06, -0.14, -0.06, 0.3, 0, 0), 0.008)],
    },
    cloth: [
      // Open jacket fronts flap as he hustles toward you.
      { name: 'flapL', parent: 'torso', pivot: [-0.11, 0.22, -0.04], geos: [flap(-1)] },
      { name: 'flapR', parent: 'torso', pivot: [0.11, 0.22, -0.04], geos: [flap(1)] },
    ],
  });
}
export function canvasserOverlay(p, st) {
  p.armL = [0.9, 0, -0.1]; p.foreL = [0.9, 0, 0]; // clipboard held up
  p.armR = [0.6 + Math.sin(st.t * 3) * 0.15, 0, 0.9]; p.foreR = [0.6, 0, 0]; // open, welcoming hand
  if (st.windup > 0) { p.torso[0] += 0.25 * st.windup; p.armR = [1.8, 0, 0.5]; }
  if (st.latched) { p.armL = [1.6, 0, -0.5]; p.armR = [1.6, 0, 0.5]; p.foreL = [1.0, 0, 0]; p.foreR = [1.0, 0, 0]; p.torso[0] -= 0.3; }
}

// ---- THE HOA PRESIDENT (~5.5 m): khaki suit, argyle vest, gray bouffant, glasses on a chain, clipboard, gavel --
export function hoaModel() {
  const SUIT = 0x837f5d, SUIT_D = 0x726e50, VEST = 0x7a766f, SKIN = 0xd0a283, HAIR = 0x8c8781, PAPER = 0xe6dfcc;
  const hair = [];
  const curls = [[0, 0.33, 0], [-0.09, 0.31, 0.03], [0.09, 0.31, 0.03], [-0.12, 0.24, 0.03], [0.12, 0.24, 0.03], [0, 0.3, 0.1], [-0.06, 0.37, -0.03], [0.06, 0.37, -0.03], [0, 0.25, 0.13], [-0.09, 0.18, 0.09], [0.09, 0.18, 0.09], [-0.04, 0.38, 0.06], [0.05, 0.36, 0.08]];
  for (const [x, y, z] of curls) hair.push(sball(0.072, HAIR, at(x, y, z), 10));
  const argyle = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) argyle.push(sbox(0.06, 0.06, 0.008, (i + j) % 2 ? 0x6c6862 : 0x8a867e, at(-0.075 + i * 0.075, 0.17 + j * 0.08, -0.112, 0, 0, Math.PI / 4), 0.004));
  const tail = (side) => slathe([[0.0, 0.0], [0.1, 0.0], [0.11, -0.18], [0.0, -0.2]], side < 0 ? SUIT : SUIT_D, at(0, 0, 0, 0, 0, 0, 1, 1, 0.5), 1, 10);
  return humanoid({
    skin: SKIN, shirt: VEST, sleeve: SUIT, pants: SUIT, pantsLow: SUIT_D, shoes: 0x3a3028, build: 1.22, chest: 1.05, headScale: 1.05,
    face: { brows: 'angry', mouth: 'yell', brow: 0x6a645e },
    extra: {
      head: [
        ...hair,
        // Glasses with a chain.
        sbox(0.07, 0.04, 0.012, 0x2a2622, at(-0.048, 0.215, -0.14), 0.008), sbox(0.07, 0.04, 0.012, 0x2a2622, at(0.048, 0.215, -0.14), 0.008),
        scap(0.005, 0.18, 0x8a7a50, at(-0.11, 0.12, -0.11, 0.3, 0, 0), 4), scap(0.005, 0.18, 0x8a7a50, at(0.11, 0.12, -0.11, 0.3, 0, 0), 4),
      ],
      torso: [
        slathe([[0.0, 0.18], [0.23, 0.18], [0.24, 0.42], [0.18, 0.54], [0.0, 0.56]], SUIT, at(0, 0, 0.01), 0.66), // suit shoulders
        ...argyle,
        sbox(0.12, 0.07, 0.015, 0xece8dc, at(0, 0.5, -0.11), 0.01), sbox(0.04, 0.28, 0.012, 0x5e5f44, at(0, 0.36, -0.118), 0.006), // collar + tie
      ],
      foreL: [
        sbox(0.5, 0.66, 0.05, 0x4a3a2e, at(0.05, -0.42, -0.12), 0.02), sbox(0.42, 0.5, 0.008, PAPER, at(0.05, -0.45, -0.148), 0.004),
        sbox(0.14, 0.05, 0.05, 0x8a8a88, at(0.05, -0.1, -0.12), 0.012),
        sbox(0.3, 0.035, 0.006, 0x5a4a3c, at(0.05, -0.3, -0.153), 0.003), sbox(0.34, 0.03, 0.006, 0x5a4a3c, at(0.05, -0.38, -0.153), 0.003),
      ],
      foreR: [scyl(0.022, 0.028, 0.4, 0x4a3426, at(0, -0.35, -0.12, Math.PI / 2, 0, 0)), scyl(0.075, 0.075, 0.26, 0x3e2a1e, at(0, -0.35, -0.34, 0, 0, Math.PI / 2), 16)],
    },
    cloth: [
      { name: 'tailL', parent: 'torso', pivot: [-0.1, 0.02, 0.04], geos: [tail(-1)] },
      { name: 'tailR', parent: 'torso', pivot: [0.1, 0.02, 0.04], geos: [tail(1)] },
    ],
  });
}
export function hoaOverlay(p, st) {
  p.armL = [0.85, 0, -0.2]; p.foreL = [0.6, 0, 0];
  p.armR = [0.4 + p.armR[0] * 0.3, 0, 0.25]; p.foreR = [0.7, 0, 0];
  if (st.attack === 'gavel') { const w = st.windup; p.armR = w < 1 ? [2.6 * w, 0, 0.3] : [0.3, 0, 0.2]; p.foreR = [w < 1 ? 0.6 : 1.2, 0, 0]; p.torso[0] += w < 1 ? 0.15 * w : -0.4; }
  if (st.attack === 'notices') { p.armL = [1.6, 0, -0.3]; p.foreL = [0.3, 0, 0]; p.head[0] -= 0.1; }
  if (st.attack === 'drones') { p.armR = [2.8 * st.windup, 0, 0.6]; p.foreR = [0.2, 0, 0]; }
}

// ---- Parking-enforcement drone (~1 m across): smooth shell, four rotors, a printed ticket hanging below ---------
export function droneModel() {
  const BODY = 0x6a6a5a, DARK = 0x3a3a36;
  const g = [sball(0.24, BODY, at(0, 0, 0, 0, 0, 0, 1, 0.45, 1), 16), sbox(0.28, 0.08, 0.28, DARK, at(0, -0.1, 0), 0.03), sball(0.06, 0x1a1a1e, at(0, -0.12, -0.17), 10)];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    g.push(scap(0.025, 0.36, DARK, at(x * 0.22, 0.03, z * 0.22, 0, (Math.PI / 4) * x * z, Math.PI / 2), 6));
    g.push(scyl(0.045, 0.045, 0.1, DARK, at(x * 0.4, 0.09, z * 0.4), 10));
  }
  g.push(sbox(0.15, 0.2, 0.006, 0xe6dfcc, at(0, -0.26, 0.1), 0.003));
  const rotors = [];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) rotors.push(scyl(0.2, 0.2, 0.01, 0x2a2a28, at(x * 0.4, 0.15, z * 0.4), 18));
  return { parts: [{ name: 'body', parent: null, pivot: [0, 0, 0], geo: fmergeSmooth(g) }, { name: 'rotors', parent: 'body', pivot: [0, 0, 0], geo: fmergeSmooth(rotors) }] };
}

// Spring-driven cloth for an entity: lag angles from its local acceleration plus a small idle flutter.
export function clothSpring(state, dt, vel, yaw, t, names) {
  const s = (state.cloth = state.cloth || { ax: 0, az: 0, vx: 0, vz: 0, lx: 0, lz: 0 });
  const c = Math.cos(yaw), si = Math.sin(yaw);
  // Velocity in the character's local frame (forward = -z).
  const fwd = -(vel.x * -si + vel.z * -c);
  const side = vel.x * c - vel.z * si;
  const k = 40, d = 7;
  const tx = Math.max(-0.7, Math.min(0.7, -fwd * 0.05)), tz = Math.max(-0.5, Math.min(0.5, side * 0.04));
  s.vx += ((tx - s.ax) * k - s.vx * d) * dt; s.ax += s.vx * dt;
  s.vz += ((tz - s.az) * k - s.vz * d) * dt; s.az += s.vz * dt;
  const flutter = Math.sin(t * 7.3) * 0.04 * Math.min(1, Math.hypot(vel.x, vel.z) / 4) + Math.sin(t * 1.7) * 0.02;
  const out = {};
  for (const n of names) {
    const sgn = /L$/.test(n) ? -1 : /R$/.test(n) ? 1 : 0;
    // Flaps fan outward when moving fast; hems lift backward.
    out[n] = n === 'hem' ? [-s.ax * 0.9 + flutter, 0, s.az * 0.6] : /^string/.test(n) ? [s.ax * 2.2 + flutter * 3, 0, sgn * 0.05] : [-s.ax * 1.2 + flutter, sgn * Math.min(0.5, Math.abs(s.ax) * 0.8), s.az];
  }
  return out;
}

export const CLOTH = { dee: ['hem'], scooter: ['stringL', 'stringR'], canvasser: ['flapL', 'flapR'], hoa: ['tailL', 'tailR'], speakerphone: [] };

export const OVERLAY = { dee: deeOverlay, speakerphone: speakerphoneOverlay, scooter: scooterOverlay, canvasser: canvasserOverlay, hoa: hoaOverlay };
