// Shared faceted humanoid: hips, torso, head, two-segment arms and legs. Characters supply colours, build and
// extra geometry per part (hair, props, face). Local space: feet at y=0, facing -z.

import { fbox, fcyl, fball, merge, at } from '../facet.js';

export function humanoid(s) {
  const k = s.build || 1; // girth
  const skin = s.skin;
  const X = (name) => s.extra?.[name] || [];
  const parts = [];
  const part = (name, parent, pivot, geos) => parts.push({ name, parent, pivot, geo: merge(geos) });
  const sw = 0.22 * k; // shoulder half-width
  part('hips', null, [0, 0.95, 0], [fbox(0.34 * k, 0.22, 0.22 * k, s.pants, at(0, -0.02, 0)), ...X('hips')]);
  part('torso', 'hips', [0, 0.07, 0], [
    fbox(0.42 * k, 0.34, 0.25 * k, s.shirt, at(0, 0.36, 0)),
    fbox(0.38 * k, 0.24, 0.23 * k, s.shirtLow ?? s.shirt, at(0, 0.11, 0)),
    ...X('torso'),
  ]);
  const hs = s.headScale || 1;
  part('head', 'torso', [0, 0.56, 0], [
    fcyl(0.06, 0.07, 0.1, skin, at(0, 0.02, 0)),
    fbox(0.23 * hs, 0.27 * hs, 0.25 * hs, skin, at(0, 0.19 * hs, 0), { jitter: 0.025 }),
    // Face, simplified to readable shapes: eyes, brows, mouth, nose.
    ...face(s.face || {}, hs),
    ...X('head'),
  ]);
  for (const side of [-1, 1]) {
    const L = side < 0 ? 'L' : 'R';
    part(`arm${L}`, 'torso', [side * sw, 0.48, 0], [fbox(0.12 * k, 0.32, 0.12 * k, s.sleeve ?? s.shirt, at(0, -0.14, 0)), ...X(`arm${L}`)]);
    part(`fore${L}`, `arm${L}`, [0, -0.3, 0], [
      fbox(0.105 * k, 0.26, 0.105 * k, s.cuff ?? s.sleeve ?? s.shirt, at(0, -0.12, 0)),
      s.noHands ? null : fbox(0.11 * (s.handScale || 1), 0.12 * (s.handScale || 1), 0.1 * (s.handScale || 1), skin, at(0, -0.3, 0)),
      ...X(`fore${L}`),
    ]);
    part(`leg${L}`, 'hips', [side * 0.1 * k, -0.06, 0], [fbox(0.16 * k, 0.46, 0.17 * k, s.pants, at(0, -0.21, 0)), ...X(`leg${L}`)]);
    part(`shin${L}`, `leg${L}`, [0, -0.44, 0], [
      fbox(0.14 * k, 0.42, 0.15 * k, s.pantsLow ?? s.pants, at(0, -0.2, 0)),
      fbox(0.15 * (s.shoeScale || 1), 0.11, 0.3 * (s.shoeScale || 1), s.shoes, at(0, -0.4, -0.05)),
      s.sole ? fbox(0.155 * (s.shoeScale || 1), 0.03, 0.31 * (s.shoeScale || 1), s.sole, at(0, -0.455, -0.05), { jitter: 0 }) : null,
      ...X(`shin${L}`),
    ]);
  }
  return { parts };
}

function face(f, hs) {
  const dark = f.eye ?? 0x1f1a1a;
  const z = -0.128 * hs;
  const g = [];
  const y = 0.22 * hs;
  for (const sx of [-1, 1]) {
    if (f.shades) continue;
    g.push(fbox(0.045, f.squint ? 0.02 : 0.04, 0.02, f.white ?? 0xf2efe8, at(sx * 0.055 * hs, y, z), { jitter: 0, shade: 0 }));
    g.push(fbox(0.022, f.squint ? 0.018 : 0.03, 0.022, dark, at(sx * 0.055 * hs, y, z - 0.008), { jitter: 0, shade: 0 }));
    // Brows: angry slants inward-down, friendly arch up.
    const tilt = f.brows === 'angry' ? sx * 0.45 : f.brows === 'happy' ? -sx * 0.2 : 0;
    g.push(fbox(0.07, 0.022, 0.025, f.brow ?? 0x3a2a22, at(sx * 0.058 * hs, y + 0.055, z - 0.004, 0, 0, tilt), { jitter: 0 }));
  }
  if (f.shades) g.push(fbox(0.2 * hs, 0.06, 0.03, 0x111114, at(0, y, z - 0.01), { jitter: 0, shade: 0.02 }));
  g.push(fbox(0.04, 0.06, 0.04, f.nose ?? 0x000000, at(0, y - 0.045, z - 0.012), { jitter: 0.005 }));
  // Mouth.
  if (f.mouth === 'yell') g.push(fbox(0.09, 0.07, 0.02, 0x3a1616, at(0, y - 0.12, z), { jitter: 0.01 }), fbox(0.08, 0.015, 0.022, 0xf2efe8, at(0, y - 0.09, z - 0.002), { jitter: 0 }));
  else if (f.mouth === 'grin') g.push(fbox(0.11, 0.035, 0.02, 0xf2efe8, at(0, y - 0.11, z), { jitter: 0 }), fbox(0.12, 0.012, 0.022, 0x3a1616, at(0, y - 0.13, z - 0.002), { jitter: 0 }));
  else g.push(fbox(0.07, 0.016, 0.02, f.lip ?? 0x6a3a32, at(0, y - 0.11, z), { jitter: 0 }));
  if (f.stubble) g.push(fbox(0.235 * hs, 0.1, 0.03, f.stubble, at(0, y - 0.12, z + 0.008), { jitter: 0.01 }));
  return g;
}

// Procedural poses. st: { phase, speed (0 idle .. 1 run), air, climb, aimR, aimL, lean, t }
export function humanPose(st) {
  const sw = Math.sin(st.phase), cw = Math.cos(st.phase);
  const amp = 0.25 + 0.65 * st.speed;
  const p = {
    hips: { r: [0, 0, 0], t: [0, Math.abs(cw) * 0.05 * st.speed, 0] },
    torso: [-(st.lean ?? 0.12 * st.speed), 0, 0],
    head: [st.headPitch ?? 0.05 * st.speed, 0, 0],
    legL: [sw * amp, 0, 0], legR: [-sw * amp, 0, 0],
    shinL: [-Math.max(0, -cw) * amp * 1.3 - 0.05, 0, 0], shinR: [-Math.max(0, cw) * amp * 1.3 - 0.05, 0, 0],
    armL: [-sw * amp * 0.8, 0, -0.08], armR: [sw * amp * 0.8, 0, 0.08],
    foreL: [0.3 + 0.6 * st.speed, 0, 0], foreR: [0.3 + 0.6 * st.speed, 0, 0],
  };
  if (st.air) {
    p.legL = [0.6, 0, 0]; p.shinL = [-1.0, 0, 0]; p.legR = [-0.3, 0, 0]; p.shinR = [-0.5, 0, 0];
    p.armL = [0.6, 0, -0.7]; p.armR = [-0.3, 0, 0.7];
  }
  if (st.climb) {
    const c = Math.sin(st.t * 10);
    p.armL = [2.7 + c * 0.35, 0, -0.1]; p.armR = [2.7 - c * 0.35, 0, 0.1];
    p.foreL = [-0.4, 0, 0]; p.foreR = [-0.4, 0, 0];
    p.legL = [0.9 + c * 0.4, 0, 0]; p.legR = [0.9 - c * 0.4, 0, 0];
    p.shinL = [-1.2, 0, 0]; p.shinR = [-1.2, 0, 0];
    p.torso = [0.15, 0, 0];
  }
  if (st.aimR != null) { p.armR = [1.5 + st.aimR, 0, 0.05]; p.foreR = [0.1, 0, 0]; }
  if (st.aimL != null) { p.armL = [1.5 + st.aimL, 0, -0.05]; p.foreL = [0.1, 0, 0]; }
  return p;
}
