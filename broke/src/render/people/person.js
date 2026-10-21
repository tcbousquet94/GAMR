// The one human generator. Every character (the player, crew, rival gang members, neutral defenders, pedestrians)
// is a Person spec from here: body type, height, age, sex, skin tone, face, hair, facial hair and an outfit. Both
// levels of detail are built from the same spec: lo.js (the instanced segmented humanoid for distant characters) and
// hi.js (the continuous skinned close-up model). Specs are deterministic per seed so crews and crowds don't clone.

import { Rng } from '../../core/rng.js';

export const SKIN_TONES = [0xf0c8aa, 0xe2b394, 0xd2a07e, 0xc08a66, 0xa87252, 0x8c5a3e, 0x6e4430, 0x55331f, 0x40261a];
export const HAIR_COLORS = { black: 0x16110e, darkBrown: 0x2c1e16, brown: 0x4a3222, lightBrown: 0x76583a, blond: 0xa8844e, auburn: 0x6a3420 };
const TEES = [0xe6e4de, 0x8e9196, 0x2a3346, 0x1e1e20, 0x5a6248, 0x6a2a2e, 0xb8963e, 0x4a6a8a, 0xc8c2b4];
const JEANS = [0x34507a, 0x2c3c58, 0x4a5e7a, 0x22283a, 0x5a6c86];
const SLACKS = [0x9a8a6c, 0x5a5a5e, 0x2a2a2e, 0x6a5a48, 0x7a7466];
const JACKETS = [0x7c6040, 0x4e5236, 0x22262e, 0x2c3448, 0x5a3a2a, 0x8a8478];
const HOODIES = [0x8a8a8e, 0x1e1e22, 0x2a3346, 0x5a2a2e, 0x3e4a3a];

// Gang accents for crew and rivals (worn as the top or a bandana-coloured detail).
export const GANG_ACCENTS = [0x3f7a3a, 0x7a3a8a, 0xb08a2a, 0x2a5a9a, 0x9a2a2a, 0x2a8a8a];

// Lou Mancuso: 52, ex-bus driver. Heavy-set, greying and receding, a thick moustache, a worn tan work jacket over a
// grey henley, faded jeans with a belt, brown work boots.
export const LOU_LOOK = {
  id: 'lou', name: 'Lou Mancuso', sex: 'm', age: 52, height: 1.78, build: 1.12, belly: 0.6, shoulders: 1.04, hipW: 1.04,
  skin: 0xd2a07e, skinVar: 0.5,
  face: { jaw: 1.08, chin: 1.05, nose: 1.12, noseW: 1.1, brow: 1.15, cheek: 1.0, lips: 0.9, ears: 1.05, eye: 0x4a3a2a, wrinkles: 0.75, jowls: 0.5 },
  hair: { style: 'receding', color: HAIR_COLORS.darkBrown, grey: 0.55 },
  facial: { style: 'mustache', color: HAIR_COLORS.darkBrown, grey: 0.5 },
  outfit: {
    top: { type: 'jacket', color: 0x8a6a44, collar: 0x4a3426, worn: 0.8 },
    under: { type: 'henley', color: 0x7a7e84 },
    bottom: { type: 'jeans', color: 0x4a5e7a, worn: 0.7, belt: 0x3a2618 },
    shoes: { type: 'boots', color: 0x5a3e28 },
  },
};

// role: 'pedestrian' | 'crew' | 'rival' | 'defender'. gang: accent colour index for crew/rivals.
export function makePerson(seed, role = 'pedestrian', gang = 0) {
  const r = new Rng(`person:${seed}`);
  const sex = r.chance(role === 'pedestrian' ? 0.5 : 0.2) ? 'f' : 'm';
  const age = Math.round(role === 'pedestrian' ? r.range(17, 75) : r.range(18, 48));
  const tone = r.int(0, SKIN_TONES.length - 1);
  const build = r.range(0.88, 1.2) * (sex === 'f' ? 0.93 : 1);
  const greyK = Math.max(0, Math.min(1, (age - 38) / 30));
  const hairPool = sex === 'm' ? ['buzz', 'short', 'short', 'curly', 'receding', 'bald'] : ['long', 'bun', 'short', 'curly', 'ponytail'];
  let style = r.pick(hairPool);
  if (sex === 'm' && age < 30 && (style === 'receding' || style === 'bald')) style = 'short';
  const darkTone = tone >= 5;
  const hairColor = darkTone ? r.pick([HAIR_COLORS.black, HAIR_COLORS.darkBrown]) : r.pick(Object.values(HAIR_COLORS));
  const accent = GANG_ACCENTS[gang % GANG_ACCENTS.length];
  // Outfit: crews wear their colour; defenders dress like the business they guard (work clothes); everyone else varies.
  let topType = r.pick(['tee', 'tee', 'tank', 'longsleeve', 'hoodie', 'jacket']);
  if (sex === 'f' && topType === 'tank' && r.chance(0.5)) topType = 'tee';
  let topColor = r.pick(topType === 'hoodie' ? HOODIES : topType === 'jacket' ? JACKETS : TEES);
  if (role === 'crew' || role === 'rival') { topType = r.pick(['jersey', 'tee', 'tank', 'hoodie']); topColor = accent; }
  if (role === 'defender') { topType = r.pick(['longsleeve', 'jacket']); topColor = r.pick([0x3a4a5a, 0x4a4a3e, 0x6a5a48]); }
  const bottomType = r.pick(['jeans', 'jeans', 'slacks', sex === 'm' && r.chance(0.3) ? 'shorts' : 'jeans']);
  return {
    id: `p${seed}`, name: null, sex, age, role,
    height: (sex === 'm' ? r.range(1.68, 1.92) : r.range(1.56, 1.78)),
    build, belly: Math.max(0, r.range(-0.2, 0.7) + (age - 40) / 80), shoulders: sex === 'm' ? r.range(0.96, 1.1) : r.range(0.86, 0.96), hipW: sex === 'f' ? r.range(1.05, 1.18) : r.range(0.95, 1.05),
    skin: SKIN_TONES[tone], skinVar: r.range(0.2, 0.7),
    face: {
      jaw: r.range(0.9, 1.12) * (sex === 'f' ? 0.92 : 1), chin: r.range(0.85, 1.15), nose: r.range(0.85, 1.2), noseW: r.range(0.85, 1.25) * (darkTone ? 1.1 : 1),
      brow: r.range(0.85, 1.15) * (sex === 'f' ? 0.8 : 1), cheek: r.range(0.9, 1.15), lips: r.range(0.85, 1.25), ears: r.range(0.9, 1.1),
      eye: darkTone ? r.pick([0x2a1a10, 0x3a2614]) : r.pick([0x3a2614, 0x4a5a3a, 0x3a5a7a, 0x5a4a2a, 0x2a1a10]),
      wrinkles: Math.max(0, (age - 32) / 45), jowls: Math.max(0, (age - 45) / 40),
    },
    hair: { style, color: hairColor, grey: greyK * r.range(0.6, 1) },
    facial: sex === 'm' && age > 20 && r.chance(0.45) ? { style: r.pick(['stubble', 'mustache', 'goatee', 'beard']), color: hairColor, grey: greyK * r.range(0.6, 1.1) } : { style: 'none' },
    outfit: {
      top: { type: topType, color: topColor, collar: 0x2a2a2a, worn: r.range(0.1, 0.6), accent },
      under: topType === 'jacket' || topType === 'hoodie' ? { type: 'tee', color: r.pick(TEES) } : null,
      bottom: { type: bottomType, color: bottomType === 'jeans' ? r.pick(JEANS) : r.pick(SLACKS), worn: r.range(0.1, 0.6), belt: r.chance(0.5) ? 0x2a1e16 : null },
      shoes: { type: r.pick(['sneakers', 'sneakers', 'boots', 'shoes']), color: r.pick([0xe6e4de, 0x1e1e20, 0x5a3e28, 0x8a8a8e, 0x3a2a20]) },
    },
  };
}

// Mix a hair colour toward grey by the spec's grey amount.
export function greyed(c, k) {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, G = 168;
  const m = (x) => Math.round(x + (G - x) * Math.min(1, k));
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

// A-pose used to bind the skinned close-up model (arms out so the body field doesn't web them to the torso).
export const BIND_POSE = { armL: [0, 0, -0.42], armR: [0, 0, 0.42], legL: [0, 0, -0.04], legR: [0, 0, 0.04] };
// Height of the rig at scale 1 (crown of the close-up head), used to scale the root to the spec's height.
export const RIG_HEIGHT = 1.86;
