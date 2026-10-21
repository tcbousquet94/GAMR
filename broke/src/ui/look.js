// The player's character look: a Person spec (see ../render/people/person.js) plus a name, remembered in this browser.
// The creator edits it through the choices below; anything missing or malformed falls back to the default.

import { makePerson, SKIN_TONES, HAIR_COLORS } from '../render/people/person.js';

const KEY = 'broke.look.v1';

export const CHOICES = {
  sex: [['m', 'Masculine'], ['f', 'Feminine']],
  build: [[0.9, 'Lean'], [1.0, 'Average'], [1.1, 'Broad'], [1.22, 'Heavy']],
  height: [[1.62, 'Short'], [1.72, 'Medium'], [1.82, 'Tall'], [1.92, 'Very tall']],
  age: [[22, '20s'], [34, '30s'], [46, '40s'], [58, '50s+']],
  skin: SKIN_TONES.map((c, i) => [c, `Tone ${i + 1}`]),
  hairStyle: [['short', 'Short'], ['buzz', 'Buzz'], ['curly', 'Curly'], ['long', 'Long'], ['ponytail', 'Ponytail'], ['bun', 'Bun'], ['receding', 'Receding'], ['bald', 'Bald']],
  hairColor: Object.entries(HAIR_COLORS).map(([k, c]) => [c, k.replace(/([A-Z])/g, ' $1').replace(/^./, (x) => x.toUpperCase())]),
  facial: [['none', 'Clean'], ['stubble', 'Stubble'], ['mustache', 'Mustache'], ['goatee', 'Goatee'], ['beard', 'Beard']],
  top: [['jacket', 'Work jacket'], ['hoodie', 'Hoodie'], ['tee', 'T-shirt'], ['longsleeve', 'Long sleeve'], ['tank', 'Tank top'], ['jersey', 'Jersey']],
  topColor: [0x8a6a44, 0x22262e, 0x2a3346, 0x5a2a2e, 0x3f7a3a, 0x7a3a8a, 0xb08a2a, 0x8e9196, 0xe6e4de, 0x4e5236].map((c) => [c, '']),
  bottom: [['jeans', 'Jeans'], ['slacks', 'Slacks'], ['shorts', 'Shorts']],
  bottomColor: [0x34507a, 0x22283a, 0x4a5e7a, 0x2a2a2e, 0x6a5a48, 0x9a8a6c].map((c) => [c, '']),
  shoes: [['boots', 'Boots'], ['sneakers', 'Sneakers'], ['shoes', 'Shoes']],
  shoeColor: [0x5a3e28, 0x1e1e20, 0xe6e4de, 0x8a8a8e, 0x3a2a20].map((c) => [c, '']),
};

// A default leader: a seeded crew member in a work jacket.
export function defaultLook() {
  return randomLook(7, 'Lou');
}

export function randomLook(seed = Math.floor(Math.random() * 1e9), name = '') {
  const p = makePerson(`leader:${seed}`, 'pedestrian');
  p.name = name;
  if (p.age < 20) p.age = 24;
  p.hair.grey = Math.min(0.6, p.hair.grey);
  if (p.facial) p.facial.grey = Math.min(0.6, p.facial.grey || 0);
  return p;
}

// Apply one creator choice to a look (returns a new spec, the old one is untouched).
export function setChoice(look, key, value) {
  const l = structuredClone(look);
  const o = l.outfit;
  switch (key) {
    case 'sex': l.sex = value; if (value === 'f') { l.facial = { style: 'none' }; l.shoulders = 0.9; l.hipW = 1.1; } else { l.shoulders = 1.03; l.hipW = 1.0; } break;
    case 'build': l.build = value; l.belly = Math.max(0, (value - 1) * 3); break;
    case 'height': l.height = value * (l.sex === 'f' ? 0.94 : 1); break;
    case 'age': l.age = value; l.face.wrinkles = Math.max(0, (value - 32) / 45); l.face.jowls = Math.max(0, (value - 45) / 40); l.hair.grey = Math.max(0, Math.min(0.6, (value - 38) / 40)); if (l.facial) l.facial.grey = l.hair.grey; break; // greying stops short of reading as bare scalp
    case 'skin': l.skin = value; break;
    case 'hairStyle': l.hair.style = value; break;
    case 'hairColor': l.hair.color = value; if (l.facial) l.facial.color = value; break;
    case 'facial': l.facial = value === 'none' ? { style: 'none' } : { style: value, color: l.hair.color, grey: l.hair.grey }; break;
    case 'top': o.top.type = value; o.under = value === 'jacket' || value === 'hoodie' ? (o.under || { type: 'tee', color: 0xe6e4de }) : null; break;
    case 'topColor': o.top.color = value; break;
    case 'bottom': o.bottom.type = value; break;
    case 'bottomColor': o.bottom.color = value; break;
    case 'shoes': o.shoes.type = value; break;
    case 'shoeColor': o.shoes.color = value; break;
    case 'name': l.name = String(value).slice(0, 24); break;
  }
  return l;
}

// The current value of a choice, for highlighting the selected option.
export function getChoice(l, key) {
  const o = l.outfit;
  return { sex: l.sex, build: l.build, height: l.height / (l.sex === 'f' ? 0.94 : 1), age: l.age, skin: l.skin, hairStyle: l.hair.style, hairColor: l.hair.color,
    facial: l.facial?.style || 'none', top: o.top.type, topColor: o.top.color, bottom: o.bottom.type, bottomColor: o.bottom.color, shoes: o.shoes.type, shoeColor: o.shoes.color }[key];
}

const valid = (l) => l && typeof l === 'object' && l.outfit?.top && l.outfit.bottom && l.outfit.shoes && l.hair && l.face && Number.isFinite(l.height) && Number.isFinite(l.skin);

export function loadLook() {
  try {
    const l = JSON.parse(localStorage.getItem(KEY));
    if (valid(l)) return l;
  } catch { /* storage blocked or bad data */ }
  return defaultLook();
}

export function saveLook(l) {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* storage blocked: the look lasts this session only */ }
}
