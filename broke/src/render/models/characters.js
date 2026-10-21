// Character models: Dee (teal), Speakerphone Guy, Scooter Bro, the Canvasser, the HOA President, her drones.
// Survivor accents are saturated; every enemy is muted olive / gray / brown / dusty so survivors always read.

import { fbox, fcyl, fball, fcone, merge, at } from '../facet.js';
import { humanoid, humanPose } from './humanoid.js';

// ---- DEE OKAFOR (teal scrubs, white sneakers, dark hair in a big high bun) ------------------------------------
export function deeModel() {
  const TEAL = 0x1fa89a, TEAL_D = 0x178a7e, SKIN = 0xc28a63, HAIR = 0x3a2a22;
  const hair = [
    fbox(0.25, 0.12, 0.27, HAIR, at(0, 0.32, 0.01)),
    fbox(0.25, 0.2, 0.08, HAIR, at(0, 0.2, 0.11)),
    fbox(0.03, 0.16, 0.2, HAIR, at(-0.12, 0.24, 0.02)), fbox(0.03, 0.16, 0.2, HAIR, at(0.12, 0.24, 0.02)),
    // Signature bun, exaggerated so it reads from behind at gameplay distance.
    fball(0.13, HAIR, at(0, 0.47, 0.06), { detail: 1 }),
    fball(0.07, 0x2e211b, at(0.05, 0.53, 0.1), { detail: 0 }),
  ];
  return humanoid({
    skin: SKIN, shirt: TEAL, shirtLow: TEAL_D, sleeve: TEAL, cuff: SKIN, pants: TEAL, pantsLow: TEAL_D, shoes: 0xf0efea, sole: 0xd8d6d0,
    build: 0.92, headScale: 1.02,
    face: { brows: 'calm', lip: 0x7a4438 },
    extra: {
      head: hair,
      torso: [
        // White cross on the chest pocket side, V-neck, pens.
        fbox(0.08, 0.025, 0.02, 0xffffff, at(0.1, 0.42, -0.13), { jitter: 0 }), fbox(0.025, 0.08, 0.02, 0xffffff, at(0.1, 0.42, -0.13), { jitter: 0 }),
        fbox(0.1, 0.08, 0.02, SKIN, at(0, 0.5, -0.12, 0, 0, Math.PI / 4), { jitter: 0 }),
        fbox(0.45, 0.06, 0.26, TEAL_D, at(0, -0.02, 0)), // drawstring waistband
      ],
      legR: [fbox(0.04, 0.16, 0.17, TEAL_D, at(0.09, -0.25, 0))], // cargo pocket
      foreR: [fbox(0.05, 0.05, 0.16, 0x9be6dc, at(0, -0.3, -0.08))], // syringe dart in hand
    },
  });
}

export function deePose(st) {
  const p = humanPose(st);
  if (st.firing && !st.climb) { p.armR = [1.45 + st.pitch, 0, 0.1]; p.foreR = [0.05, 0, 0]; p.torso[1] = -0.15; }
  if (st.throwT > 0) { p.armL = [2.6 * st.throwT, 0, -0.4]; }
  if (st.spin > 0) { p.hips.r[1] = st.spin * Math.PI * 4; p.armL = [0.2, 0, -1.3]; p.armR = [0.2, 0, 1.3]; }
  return p;
}

// ---- SPEAKERPHONE GUY (muted: olive puffer vest, dusty maroon-brown shirt, phone held up to his mouth) ---------
export function speakerphoneModel() {
  const VEST = 0x5d6145, VEST_D = 0x4d5039, SHIRT = 0x6b4f47, SKIN = 0xb98a6a, HAIR = 0x3b2c24;
  const vest = [];
  for (let i = 0; i < 4; i++) vest.push(fbox(0.47, 0.085, 0.3, i % 2 ? VEST : VEST_D, at(0, 0.18 + i * 0.09, 0)));
  return humanoid({
    skin: SKIN, shirt: SHIRT, sleeve: SHIRT, pants: 0x3a3a3f, shoes: 0x5a4636, build: 1.12,
    face: { brows: 'angry', mouth: 'yell', stubble: 0x5a4a40 },
    extra: {
      head: [
        // Spiky hair.
        fbox(0.25, 0.08, 0.27, HAIR, at(0, 0.33, 0)),
        fcone(0.06, 0.12, HAIR, at(-0.06, 0.41, 0.02, 0.2, 0, 0.3)), fcone(0.06, 0.13, HAIR, at(0.05, 0.42, -0.02, -0.3, 0, -0.2)), fcone(0.06, 0.11, HAIR, at(0, 0.4, 0.08, 0.5, 0, 0)),
      ],
      torso: [...vest, fbox(0.03, 0.2, 0.02, 0x8a8a88, at(0, 0.36, -0.14), { jitter: 0 }), fcyl(0.025, 0.025, 0.06, 0x9a9a9a, at(0, 0.26, -0.15, Math.PI / 2, 0, 0))],
      // Phone in the right hand, screen facing his mouth.
      foreR: [fbox(0.08, 0.15, 0.02, 0x1d1d22, at(0, -0.33, -0.04), { jitter: 0 }), fbox(0.06, 0.11, 0.005, 0x4a6070, at(0, -0.33, -0.052), { jitter: 0 })],
    },
  });
}
export function speakerphonePose(st) {
  const p = humanPose(st);
  // Phone held up in front of his face, other fist clenched; leans in aggressively.
  p.armR = [1.1, 0, 0.35]; p.foreR = [1.6, 0, 0];
  p.torso = [-0.18 - st.speed * 0.1, 0, 0];
  if (st.windup > 0) { p.armR = [1.3 + st.windup * 0.4, 0, 0.3]; p.torso = [0.1 * st.windup, 0, 0]; p.head = [-0.3 * st.windup, 0, 0]; }
  if (st.stun > 0) { p.head = [0.4, 0, Math.sin(st.t * 12) * 0.3]; p.armR = [0.2, 0, 0.3]; p.foreR = [0.2, 0, 0]; }
  return p;
}

// ---- SCOOTER BRO (muted: slate hoodie, brown backwards cap, khaki cargos, sunglasses, e-scooter) ----------------
export function scooterModel() {
  const HOOD = 0x676b72, HOOD_D = 0x585c63, SKIN = 0xc09576, CAP = 0x4a4038;
  const m = humanoid({
    skin: SKIN, shirt: HOOD, shirtLow: HOOD_D, sleeve: HOOD, pants: 0x7c785c, shoes: 0x8a8682, sole: 0xc8c4bc,
    face: { shades: true, mouth: 'grin', brows: 'happy' },
    extra: {
      head: [
        fbox(0.26, 0.09, 0.28, CAP, at(0, 0.33, 0)),
        fbox(0.2, 0.025, 0.12, 0x3c342e, at(0, 0.3, 0.17)), // brim, worn backwards
        fbox(0.25, 0.1, 0.08, 0x2e2a28, at(0, 0.21, 0.11)),
      ],
      torso: [fbox(0.36, 0.16, 0.14, HOOD_D, at(0, 0.5, 0.15)), fcyl(0.01, 0.01, 0.14, 0xb0aca4, at(-0.05, 0.36, -0.14)), fcyl(0.01, 0.01, 0.14, 0xb0aca4, at(0.05, 0.36, -0.14))],
      legL: [fbox(0.05, 0.13, 0.17, 0x6a664c, at(-0.09, -0.24, 0))], legR: [fbox(0.05, 0.13, 0.17, 0x6a664c, at(0.09, -0.24, 0))],
    },
  });
  // Scooter is its own part under the hips so it doesn't swing with the legs.
  m.parts.push({
    name: 'scooter', parent: null, pivot: [0, 0, 0], geo: merge([
      fbox(0.2, 0.06, 0.95, 0x2c2c30, at(0, 0.12, 0)),
      fcyl(0.14, 0.14, 0.06, 0x232326, at(0, 0.14, -0.55, 0, 0, Math.PI / 2), { n: 8 }),
      fcyl(0.14, 0.14, 0.06, 0x232326, at(0, 0.14, 0.5, 0, 0, Math.PI / 2), { n: 8 }),
      fcyl(0.025, 0.025, 1.0, 0x3a3a3e, at(0, 0.62, -0.55)),
      fbox(0.5, 0.04, 0.04, 0x3a3a3e, at(0, 1.1, -0.55)),
      fbox(0.07, 0.05, 0.05, 0x6a5a48, at(-0.22, 1.1, -0.55)), fbox(0.07, 0.05, 0.05, 0x6a5a48, at(0.22, 1.1, -0.55)),
      fcyl(0.035, 0.035, 0.03, 0xaaa79c, at(0.15, 1.13, -0.55)), // bell
    ]),
  });
  return m;
}
export function scooterPose(st) {
  const p = humanPose({ ...st, speed: 0, phase: 0 });
  // Crouched on the deck, hands on the bars, one foot forward.
  p.hips.t = [0, 0.02, 0];
  p.legL = [0.5, 0, 0]; p.shinL = [-0.8, 0, 0]; p.legR = [-0.15, 0, 0]; p.shinR = [-0.6, 0, 0];
  p.torso = [-0.55, 0, 0];
  p.armL = [1.0, 0, -0.15]; p.foreL = [0.3, 0, 0]; p.armR = [1.0, 0, 0.15]; p.foreR = [0.3, 0, 0];
  p.head = [0.35, 0, 0];
  p.hips.t[1] += 0.12;
  if (st.windup > 0) { p.armR = [1.3, 0, 0.3]; p.foreR = [0.9 + Math.sin(st.t * 30) * 0.3, 0, 0]; } // ringing the bell
  if (st.crashed) { p.torso = [0.6, 0, 0.5]; p.head = [0.4, 0, 0.4]; p.armL = [2.4, 0, -0.6]; p.armR = [2.2, 0, 0.7]; p.scooter = { r: [0, 0.8, 1.4], t: [0.5, 0.15, 0.2] }; }
  return p;
}

// ---- THE CANVASSER (muted: dusty tan jacket, sage shirt, lanyard and ID, clipboard, huge grin) -----------------
export function canvasserModel() {
  const JACKET = 0x9a8862, JACKET_D = 0x87764f, SHIRT = 0x848c7a, SKIN = 0xcf9f7c, HAIR = 0x5b3e2a;
  return humanoid({
    skin: SKIN, shirt: SHIRT, sleeve: JACKET, pants: 0x38383d, shoes: 0x5e4a38,
    face: { brows: 'happy', mouth: 'grin' },
    extra: {
      head: [
        fbox(0.26, 0.1, 0.28, HAIR, at(0, 0.33, 0.01)), fbox(0.26, 0.16, 0.06, HAIR, at(0, 0.22, 0.12)),
        fcone(0.07, 0.12, HAIR, at(0.05, 0.41, -0.06, -0.6, 0, -0.2)),
      ],
      torso: [
        fbox(0.15, 0.6, 0.27, JACKET, at(-0.15, 0.27, 0)), fbox(0.15, 0.6, 0.27, JACKET_D, at(0.15, 0.27, 0)), // open jacket
        fbox(0.02, 0.24, 0.02, 0x55606c, at(-0.05, 0.38, -0.135), { jitter: 0 }), fbox(0.02, 0.24, 0.02, 0x55606c, at(0.05, 0.38, -0.135), { jitter: 0 }),
        fbox(0.08, 0.11, 0.015, 0xe6e2d6, at(0, 0.22, -0.14), { jitter: 0 }), // ID card
      ],
      foreL: [fbox(0.24, 0.32, 0.03, 0x5a4434, at(0.06, -0.3, -0.08, 0.3, 0, 0)), fbox(0.2, 0.22, 0.01, 0xe8e4d8, at(0.06, -0.27, -0.1, 0.3, 0, 0), { jitter: 0 }), fbox(0.06, 0.03, 0.03, 0x8a8a88, at(0.06, -0.14, -0.06, 0.3, 0, 0), { jitter: 0 })],
    },
  });
}
export function canvasserPose(st) {
  const p = humanPose(st);
  p.armL = [0.9, 0, -0.1]; p.foreL = [0.9, 0, 0]; // clipboard held up
  p.armR = [0.6 + Math.sin(st.t * 3) * 0.15, 0, 0.9]; p.foreR = [0.6, 0, 0]; // open, welcoming hand
  if (st.windup > 0) { p.torso = [0.2 * st.windup, 0, 0]; p.armR = [1.8, 0, 0.5]; }
  if (st.latched) { p.armL = [1.6, 0, -0.5]; p.armR = [1.6, 0, 0.5]; p.foreL = [1.0, 0, 0]; p.foreR = [1.0, 0, 0]; p.torso = [-0.3, 0, 0]; }
  return p;
}

// ---- THE HOA PRESIDENT (~5.5 m): khaki suit, argyle vest, gray bouffant, glasses on a chain, clipboard, gavel --
export function hoaModel() {
  const SUIT = 0x837f5d, SUIT_D = 0x726e50, VEST = 0x7a766f, SKIN = 0xd0a283, HAIR = 0x8c8781, PAPER = 0xe6dfcc;
  const hair = [];
  const curls = [[0, 0.36, 0], [-0.1, 0.33, 0.03], [0.1, 0.33, 0.03], [-0.13, 0.25, 0.02], [0.13, 0.25, 0.02], [0, 0.32, 0.1], [-0.07, 0.4, -0.03], [0.07, 0.4, -0.03], [0, 0.27, 0.12], [-0.09, 0.2, 0.08], [0.09, 0.2, 0.08]];
  for (const [x, y, z] of curls) hair.push(fball(0.085, HAIR, at(x, y, z), { detail: 0 }));
  const argyle = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) argyle.push(fbox(0.07, 0.07, 0.01, (i + j) % 2 ? 0x6c6862 : 0x8a867e, at(-0.09 + i * 0.09, 0.18 + j * 0.09, -0.128, 0, 0, Math.PI / 4), { jitter: 0 }));
  return humanoid({
    skin: SKIN, shirt: VEST, shirtLow: VEST, sleeve: SUIT, pants: SUIT, pantsLow: SUIT_D, shoes: 0x3a3028, build: 1.22, headScale: 1.05,
    face: { brows: 'angry', mouth: 'yell', brow: 0x6a645e },
    extra: {
      head: [
        ...hair,
        // Glasses with a chain.
        fbox(0.2, 0.05, 0.02, 0x2a2622, at(0, 0.23, -0.14), { jitter: 0 }),
        fbox(0.012, 0.18, 0.012, 0x8a7a50, at(-0.12, 0.12, -0.11, 0.3, 0, 0), { jitter: 0 }), fbox(0.012, 0.18, 0.012, 0x8a7a50, at(0.12, 0.12, -0.11, 0.3, 0, 0), { jitter: 0 }),
      ],
      torso: [
        fbox(0.16, 0.62, 0.3, SUIT, at(-0.17, 0.28, 0)), fbox(0.16, 0.62, 0.3, SUIT_D, at(0.17, 0.28, 0)), // suit jacket
        ...argyle,
        fbox(0.12, 0.08, 0.02, 0xece8dc, at(0, 0.52, -0.13), { jitter: 0 }), fbox(0.04, 0.3, 0.02, 0x5e5f44, at(0, 0.38, -0.135), { jitter: 0 }), // collar + tie
      ],
      // Giant clipboard (left) and gavel (right).
      foreL: [
        fbox(0.5, 0.66, 0.05, 0x4a3a2e, at(0.05, -0.42, -0.12)), fbox(0.42, 0.5, 0.01, PAPER, at(0.05, -0.45, -0.15), { jitter: 0 }),
        fbox(0.14, 0.05, 0.05, 0x8a8a88, at(0.05, -0.1, -0.12), { jitter: 0 }),
        fbox(0.3, 0.04, 0.012, 0x5a4a3c, at(0.05, -0.3, -0.157), { jitter: 0 }), fbox(0.34, 0.03, 0.012, 0x5a4a3c, at(0.05, -0.38, -0.157), { jitter: 0 }),
        fbox(0.25, 0.02, 0.012, 0x8a7a68, at(0.05, -0.5, -0.157), { jitter: 0 }),
      ],
      foreR: [fcyl(0.025, 0.03, 0.4, 0x4a3426, at(0, -0.35, -0.12, Math.PI / 2, 0, 0)), fcyl(0.08, 0.08, 0.26, 0x3e2a1e, at(0, -0.35, -0.34, 0, 0, Math.PI / 2), { n: 8 })],
    },
  });
}
export function hoaPose(st) {
  const p = humanPose({ ...st, speed: st.speed * 0.6 });
  p.armL = [0.85, 0, -0.2]; p.foreL = [0.6, 0, 0];
  p.armR = [0.4, 0, 0.25]; p.foreR = [0.7, 0, 0];
  p.torso = [-0.05, 0, 0];
  if (st.attack === 'gavel') { const w = st.windup; p.armR = w < 1 ? [2.6 * w, 0, 0.3] : [0.3, 0, 0.2]; p.foreR = [w < 1 ? 0.6 : 1.2, 0, 0]; p.torso = [w < 1 ? 0.15 * w : -0.4, 0, 0]; }
  if (st.attack === 'notices') { p.armL = [1.6, 0, -0.3]; p.foreL = [0.3, 0, 0]; p.head = [-0.1, 0, 0]; }
  if (st.attack === 'drones') { p.armR = [2.8 * st.windup, 0, 0.6]; p.foreR = [0.2, 0, 0]; }
  return p;
}

// ---- Parking-enforcement drone (~1 m across) and violation notices --------------------------------------------
export function droneModel() {
  const BODY = 0x6a6a5a, DARK = 0x3a3a36;
  const g = [fbox(0.42, 0.18, 0.42, BODY, at(0, 0, 0)), fbox(0.3, 0.1, 0.3, DARK, at(0, -0.14, 0)), fball(0.07, 0x1a1a1e, at(0, -0.16, -0.17), { detail: 0 })];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    g.push(fbox(0.42, 0.05, 0.06, DARK, at(x * 0.25, 0.05, z * 0.25, 0, (Math.PI / 4) * x * z, 0)));
    g.push(fcyl(0.05, 0.05, 0.1, DARK, at(x * 0.42, 0.1, z * 0.42)));
  }
  // Printer slot with a hanging ticket.
  g.push(fbox(0.16, 0.2, 0.01, 0xe6dfcc, at(0, -0.3, 0.12), { jitter: 0 }));
  const rotors = [];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) rotors.push(fcyl(0.2, 0.2, 0.012, 0x2a2a28, at(x * 0.42, 0.16, z * 0.42), { n: 8, jitter: 0 }));
  return { parts: [{ name: 'body', parent: null, pivot: [0, 0, 0], geo: merge(g) }, { name: 'rotors', parent: 'body', pivot: [0, 0, 0], geo: merge(rotors) }] };
}
