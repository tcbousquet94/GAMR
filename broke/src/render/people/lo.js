// Distant level of detail: a Person spec on the shared segmented humanoid (instanced, cheap). Same rig and colours as
// the close-up model, so the switch at ~10 m only changes the detail, not the person.

import { humanoid } from '../models/humanoid.js';
import { sball, sbox, scap, at } from '../facet.js';
import { greyed } from './person.js';

export function loModel(spec) {
  const o = spec.outfit, top = o.top.type, skin = spec.skin;
  const bare = top === 'tank' || top === 'jersey';
  const short = top === 'tee';
  const sleeve = bare ? skin : o.top.color;
  const hair = greyed(spec.hair.color, spec.hair.grey);
  const head = [];
  const st = spec.hair.style;
  if (st !== 'bald') head.push(sball(0.128, hair, at(0, st === 'buzz' ? 0.225 : 0.235, 0.012, 0, 0, 0, 1.0, st === 'receding' ? 0.5 : 0.62, 1.05), 16));
  if (st === 'long' || st === 'ponytail') head.push(scap(0.06, 0.16, hair, at(0, 0.12, 0.08), 10));
  if (st === 'bun') head.push(sball(0.06, hair, at(0, 0.3, 0.09), 12));
  if (st === 'curly') head.push(sball(0.14, hair, at(0, 0.25, 0.01, 0, 0, 0, 1.05, 0.75, 1.08), 14));
  if (spec.facial?.style === 'mustache') head.push(sbox(0.06, 0.012, 0.02, greyed(spec.facial.color, spec.facial.grey), at(0, 0.115, -0.125), 0.006));
  if (spec.facial?.style === 'beard') head.push(sball(0.11, greyed(spec.facial.color, spec.facial.grey), at(0, 0.1, -0.035, 0, 0, 0, 1, 0.75, 1.05), 12));
  const def = humanoid({
    skin, shirt: o.top.color, sleeve, cuff: bare || short ? skin : o.top.color,
    pants: o.bottom.color, pantsLow: o.bottom.type === 'shorts' ? skin : o.bottom.color,
    shoes: o.shoes.color, sole: o.shoes.type === 'sneakers' ? 0xe0ded8 : 0x2a2420,
    build: spec.build, chest: spec.sex === 'f' ? 1.02 : 1.0, legWidth: 1.05, headScale: 1.0,
    face: { brows: 'calm', lip: 0x6a3a30, eye: spec.face.eye },
    extra: { head },
    cloth: [
      // Sidearm in the right hand: shown only in the aim stance (the actor layer scales it in and out).
      { name: 'gun', parent: 'foreR', pivot: [0, -0.33, 0], geos: [sbox(0.035, 0.12, 0.17, 0x1c1c1e, at(0, -0.02, -0.05), 0.01), sbox(0.03, 0.09, 0.03, 0x2a2420, at(0, -0.04, 0.02), 0.008)] },
    ],
  });
  return def;
}
