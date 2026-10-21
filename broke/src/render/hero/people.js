// Ordinary people for the hero scene, on the shared humanoid at realistic proportions, in natural colours, plus the
// skin / fabric material used for every character there: fabric gets a fine weave (albedo and roughness break-up in
// the part's local space so it moves with the body), skin is smoother with a little sheen.

import * as THREE from 'three';
import { humanoid } from '../models/humanoid.js';
import { sball, scap, slathe, at } from '../facet.js';

const LOOKS = {
  // White tank top, belted blue jeans, dark sneakers.
  tank: { skin: 0x5e3d2a, shirt: 0xe6e4de, pants: 0x34507a, shoes: 0x2a2a2c, sole: 0xd8d6d0, hair: 0x15110e, belt: 0x4a3222, build: 1.06, sleeveless: true },
  // Green basketball jersey over a white tee, dark trousers.
  jersey: { skin: 0x6e4a34, shirt: 0x3f7a3a, sleeve: 0xe0deda, cuff: 0x6e4a34, pants: 0x2c2c30, shoes: 0xe8e6e0, sole: 0xc8c6c0, hair: 0x1a1410, build: 1.0 },
  // Grey tee, khakis, brown shoes.
  tee: { skin: 0xb88a6a, shirt: 0x7e8288, cuff: 0xb88a6a, pants: 0x9a8a6c, shoes: 0x4a3626, sole: 0x3a2a1e, hair: 0x3a2a20, build: 0.95 },
};

export function personModel(look) {
  const L = LOOKS[look];
  const sleeve = L.sleeveless ? L.skin : L.sleeve ?? L.shirt;
  return humanoid({
    skin: L.skin, shirt: L.shirt, sleeve, cuff: L.cuff ?? (L.sleeveless ? L.skin : sleeve), pants: L.pants, shoes: L.shoes, sole: L.sole,
    build: L.build, chest: 1.0, legWidth: 1.05, headScale: 1.0,
    face: { brows: 'calm', lip: 0x5a3028 },
    extra: {
      head: [sball(0.128, L.hair, at(0, 0.235, 0.012, 0, 0, 0, 1.0, 0.62, 1.05), 16)],
      hips: L.belt ? [slathe([[0.0, 0.06], [0.158, 0.06], [0.16, 0.1], [0.0, 0.1]], L.belt, at(0, 0, 0), 0.74)] : [],
      torso: L.sleeveless ? [scap(0.012, 0.16, L.shirt, at(-0.1, 0.42, 0, 0, 0, 0.15), 6), scap(0.012, 0.16, L.shirt, at(0.1, 0.42, 0, 0, 0, -0.15), 6)] : [],
    },
  });
}

let pm = null;
export function personMaterial() {
  if (pm) return pm;
  pm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
  pm.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLocal;
        float ph(vec3 p){ p = fract(p * 0.3183 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float pn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(ph(i), ph(i+vec3(1,0,0)), f.x), mix(ph(i+vec3(0,1,0)), ph(i+vec3(1,1,0)), f.x), f.y),
                     mix(mix(ph(i+vec3(0,0,1)), ph(i+vec3(1,0,1)), f.x), mix(ph(i+vec3(0,1,1)), ph(i+vec3(1,1,1)), f.x), f.y), f.z); }
        float skinK;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 c = diffuseColor.rgb;
          // Skin: warm, red over blue, not near-white. Everything else is cloth.
          skinK = smoothstep(0.04, 0.12, c.r - c.b) * smoothstep(0.9, 0.6, c.g + c.b) * step(c.g, c.r);
          float weave = pn(vLocal * 160.0) * 0.5 + pn(vLocal * 60.0) * 0.5;
          float folds = pn(vLocal * vec3(18.0, 6.0, 18.0));
          diffuseColor.rgb *= mix(0.95 + 0.06 * weave - 0.1 * folds, 0.97 + 0.05 * pn(vLocal * 60.0), skinK);
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.86, 0.48, skinK);')
      // Cloth folds as a screen-space bump (derivatives of a stretched noise), weaker on skin.
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float hgt = pn(vLocal * vec3(22.0, 7.0, 22.0));
          vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
          float hx = dFdx(hgt), hy = dFdy(hgt);
          vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          vec3 grad = sign(det) * (hx * r1 + hy * r2);
          normal = normalize(abs(det) * normal - grad * mix(0.0016, 0.0, skinK));
        }`);
  };
  pm.customProgramCacheKey = () => 'hero-person';
  return pm;
}
