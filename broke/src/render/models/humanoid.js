// Shared humanoid built from smooth organic forms (lathed torso, capsule limbs, rounded head), with optional cloth
// parts that the actor layer swings on springs. Local space: feet at y=0, facing -z. Characters supply colours,
// build, face style and extra geometry per part.

import { scap, sball, sbox, scyl, slathe, smoothMerge as merge, at } from '../facet.js';

export function humanoid(s) {
  const k = s.build || 1; // girth
  const skin = s.skin;
  const X = (name) => s.extra?.[name] || [];
  const parts = [];
  const part = (name, parent, pivot, geos) => parts.push({ name, parent, pivot, geo: merge(geos) });
  const sw = 0.2 * k; // shoulder half-width
  part('hips', null, [0, 0.95, 0], [
    slathe([[0.0, -0.12], [0.15 * k, -0.11], [0.17 * k, -0.02], [0.15 * k, 0.08], [0.0, 0.09]], s.pants, at(0, 0, 0), 0.72),
    ...X('hips'),
  ]);
  // Torso: waist to shoulders, tapered, flattened front-to-back.
  const chest = s.chest ?? 1;
  part('torso', 'hips', [0, 0.07, 0], [
    slathe([[0.0, -0.02], [0.15 * k, -0.02], [0.16 * k, 0.12], [0.185 * k * chest, 0.32], [0.2 * k * chest, 0.44], [0.15 * k, 0.53], [0.06, 0.56], [0.0, 0.565]], s.shirt, at(0, 0, 0), 0.62),
    ...X('torso'),
  ]);
  const hs = s.headScale || 1;
  part('head', 'torso', [0, 0.55, 0], [
    scyl(0.05, 0.058, 0.12, skin, at(0, 0.03, 0)),
    sball(0.125 * hs, skin, at(0, 0.2 * hs, -0.005, 0, 0, 0, 1, 1.12, 1.04), 18),
    sball(0.03 * hs, skin, at(-0.122 * hs, 0.19 * hs, 0.01, 0, 0, 0, 0.6, 1, 1), 8), sball(0.03 * hs, skin, at(0.122 * hs, 0.19 * hs, 0.01, 0, 0, 0, 0.6, 1, 1), 8),
    ...face(s.face || {}, hs, skin),
    ...X('head'),
  ]);
  for (const side of [-1, 1]) {
    const L = side < 0 ? 'L' : 'R';
    part(`arm${L}`, 'torso', [side * sw, 0.47, 0], [sball(0.075 * k, s.sleeve ?? s.shirt, at(0, -0.01, 0), 12), scap(0.058 * k, 0.2, s.sleeve ?? s.shirt, at(0, -0.14, 0)), ...X(`arm${L}`)]);
    part(`fore${L}`, `arm${L}`, [0, -0.29, 0], [
      scap(0.05 * k, 0.18, s.cuff ?? s.sleeve ?? s.shirt, at(0, -0.12, 0)),
      s.noHands ? null : sball(0.058 * (s.handScale || 1), skin, at(0, -0.29, -0.005, 0, 0, 0, 0.85, 1.15, 0.7), 12),
      ...X(`fore${L}`),
    ]);
    const lr = (s.legWidth || 1) * k;
    part(`leg${L}`, 'hips', [side * 0.09 * k, -0.05, 0], [scap(0.08 * lr, 0.3, s.pants, at(0, -0.21, 0)), ...X(`leg${L}`)]);
    const ss = s.shoeScale || 1;
    part(`shin${L}`, `leg${L}`, [0, -0.43, 0], [
      scap(0.065 * lr * (s.flare || 1), 0.3, s.pantsLow ?? s.pants, at(0, -0.2, 0)),
      sbox(0.13 * ss, 0.1, 0.28 * ss, s.shoes, at(0, -0.405, -0.05), 0.045),
      s.sole ? sbox(0.135 * ss, 0.035, 0.29 * ss, s.sole, at(0, -0.455, -0.05), 0.015) : null,
      ...X(`shin${L}`),
    ]);
  }
  for (const c of s.cloth || []) part(c.name, c.parent, c.pivot, c.geos);
  return { parts };
}

function face(f, hs, skin) {
  const z = -0.128 * hs;
  const y = 0.21 * hs;
  const g = [];
  for (const sx of [-1, 1]) {
    if (!f.shades) {
      g.push(sball(0.022, f.white ?? 0xf4f0ea, at(sx * 0.047 * hs, y, z + 0.006, 0, 0, 0, 1, f.squint ? 0.5 : 1, 0.6), 10));
      g.push(sball(0.013, f.eye ?? 0x1f1814, at(sx * 0.047 * hs, y - 0.002, z - 0.004), 8));
    }
    // Brows: angry slant down toward the nose, happy arch up, calm level.
    const tilt = f.brows === 'angry' ? sx * 0.5 : f.brows === 'happy' ? -sx * 0.25 : 0;
    g.push(scap(0.009, 0.045, f.brow ?? 0x3a2a22, at(sx * 0.05 * hs, y + 0.045 + (f.brows === 'angry' ? -0.005 : 0), z + 0.002, 0, 0, Math.PI / 2 + tilt), 6));
  }
  if (f.shades) g.push(sbox(0.2 * hs, 0.05, 0.04, 0x141418, at(0, y, z + 0.004), 0.018));
  g.push(sball(0.024, skin, at(0, y - 0.04, z - 0.004, 0, 0, 0, 0.8, 1.1, 1), 8)); // nose
  if (f.mouth === 'yell') g.push(sball(0.05, 0x3a1414, at(0, y - 0.11, z + 0.012, 0, 0, 0, 1.1, 0.75, 0.5), 12), sbox(0.07, 0.014, 0.02, 0xf4f0ea, at(0, y - 0.083, z + 0.004), 0.006));
  else if (f.mouth === 'grin') g.push(sbox(0.1, 0.03, 0.03, 0xf4f0ea, at(0, y - 0.1, z + 0.008), 0.014), scap(0.007, 0.09, 0x5a2a24, at(0, y - 0.118, z + 0.01, 0, 0, Math.PI / 2), 6));
  else g.push(scap(0.008, 0.045, f.lip ?? 0x7a4038, at(0, y - 0.1, z + 0.008, 0, 0, Math.PI / 2), 6));
  if (f.stubble) g.push(sball(0.118 * hs, f.stubble, at(0, y - 0.07, -0.01, 0, 0, 0, 1, 0.62, 1.04), 14));
  return g;
}

// Procedural poses. st: { phase, speed (0 idle .. 1 run), air, climb, aimR, aimL, lean, t }
// Positive rx swings a limb forward (toward -z). Positive torso rx leans back.
export function humanPose(st) {
  const sw = Math.sin(st.phase), cw = Math.cos(st.phase);
  const amp = 0.25 + 0.65 * st.speed;
  const breathe = Math.sin(st.t * 1.6) * 0.015 * (1 - st.speed);
  const p = {
    hips: { r: [0, Math.sin(st.phase) * 0.08 * st.speed, 0], t: [0, Math.abs(cw) * 0.05 * st.speed, 0] },
    torso: [-(st.lean ?? 0.12 * st.speed) + breathe, -Math.sin(st.phase) * 0.12 * st.speed, 0],
    head: [st.headPitch ?? 0.05 * st.speed, Math.sin(st.phase) * 0.06 * st.speed, 0],
    legL: [sw * amp, 0, 0], legR: [-sw * amp, 0, 0],
    shinL: [-Math.max(0, -cw) * amp * 1.3 - 0.05, 0, 0], shinR: [-Math.max(0, cw) * amp * 1.3 - 0.05, 0, 0],
    armL: [-sw * amp * 0.8, 0, -0.1 - breathe], armR: [sw * amp * 0.8, 0, 0.1 + breathe],
    foreL: [0.3 + 0.6 * st.speed, 0, 0], foreR: [0.3 + 0.6 * st.speed, 0, 0],
  };
  if (st.air) {
    p.legL = [0.6, 0, 0]; p.shinL = [-1.0, 0, 0]; p.legR = [-0.3, 0, 0]; p.shinR = [-0.5, 0, 0];
    p.armL = [0.6, 0, -0.7]; p.armR = [-0.3, 0, 0.7];
  }
  if (st.climb) {
    const c = Math.sin(st.t * 10);
    p.armL = [2.7 + c * 0.35, 0, -0.1]; p.armR = [2.7 - c * 0.35, 0, 0.1];
    p.foreL = [0.4, 0, 0]; p.foreR = [0.4, 0, 0];
    p.legL = [0.9 + c * 0.4, 0, 0]; p.legR = [0.9 - c * 0.4, 0, 0];
    p.shinL = [-1.2, 0, 0]; p.shinR = [-1.2, 0, 0];
    p.torso = [0.15, 0, 0];
  }
  if (st.aimR != null) { p.armR = [1.5 + st.aimR, 0, 0.05]; p.foreR = [0.1, 0, 0]; }
  if (st.aimL != null) { p.armL = [1.5 + st.aimL, 0, -0.05]; p.foreL = [0.1, 0, 0]; }
  // Cloth parts: the actor layer passes spring-driven lag angles in st.cloth.
  if (st.cloth) for (const [name, r] of Object.entries(st.cloth)) p[name] = r;
  return p;
}
