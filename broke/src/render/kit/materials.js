// Surface materials for the remastered look (the kit's material library; heroMaterials is the original name). Each surface is a MeshStandardMaterial with colour, roughness and
// normal maps (textures.js) in world-space metres (geometry UVs are metres; `tile` is the texture's world size),
// tinted per vertex, plus procedural wear in the shader so repetition never reads: large-scale grime drift, rising
// damp and dirt at the foot of walls, drip streaks, and darkening where walls meet the ground (cheap corner AO on top
// of the screen-space AO pass).

import * as THREE from 'three';
import { heroTextures } from './textures.js';

// tile: metres per texture repeat. wear: grime strength. Other fields go to the material.
const SURF = {
  asphalt: { tex: 'asphalt', tile: 9, wear: 0.55 },
  concrete: { tex: 'concrete', tile: 3, wear: 0.8 },
  curb: { tex: 'concrete', tile: 2.2, wear: 1 },
  redCurb: { tex: 'redPaint', tile: 2, wear: 0.6 },
  grass: { tex: 'grass', tile: 5.5, wear: 0.45 },
  dirt: { tex: 'dirt', tile: 3, wear: 0.2 },
  siding: { tex: 'siding', tile: 2.4, wear: 1 },
  stucco: { tex: 'stucco', tile: 3, wear: 1.1 },
  brick: { tex: 'brick', tile: 1.3, wear: 0.9 },
  shingles: { tex: 'shingles', tile: 1.5, wear: 0.6 },
  metal: { tex: 'metal', tile: 1.2, wear: 0.7, metalness: 0.5 },
  garageDoor: { tex: 'garageDoor', tile: 2.4, wear: 0.9 },
  trim: { tex: 'paint', tile: 1, wear: 0.9 },
  planks: { tex: 'planks', tile: 1.6, wear: 0.6 },
  chainlink: { tex: 'chainlink', tile: 0.5, wear: 0, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6 },
  palmBark: { tex: 'palmBark', tile: 1.6, wear: 0 },
  bark: { tex: 'bark', tile: 1.2, wear: 0 },
  tile: { tex: 'tile', tile: 1.2, wear: 0.4 },
  plaster: { tex: 'paint', tile: 1.5, wear: 0.8 },
  facade: { tex: 'facade', tile: 7, wear: 0.6, envMapIntensity: 1.2 },
  window: { tex: 'window', tile: 1, wear: 0, roughness: 0.06, envMapIntensity: 1.6 },
  frond: { tex: 'frond', tile: 1, wear: 0, alphaTest: 0.5, side: THREE.DoubleSide },
  tuft: { tex: 'tuft', tile: 1, wear: 0, alphaTest: 0.5, side: THREE.DoubleSide },
  leaves: { tex: 'leaves', tile: 1, wear: 0, alphaTest: 0.5, side: THREE.DoubleSide },
  roadPaint: { tex: 'roadPaint', tile: 2.5, wear: 0.3, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 },
  tarGravel: { tex: 'tarGravel', tile: 2, wear: 0.5 },
  metalPaint: { tex: 'paint', tile: 1, wear: 0.4, metalness: 0.55 },
  rubber: { tex: 'paint', tile: 0.5, wear: 0, roughness: 0.9 },
};

const GLSL_NOISE = /* glsl */`
  float hw_h(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float hw_n(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hw_h(i), hw_h(i + vec3(1,0,0)), f.x), mix(hw_h(i + vec3(0,1,0)), hw_h(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hw_h(i + vec3(0,0,1)), hw_h(i + vec3(1,0,1)), f.x), mix(hw_h(i + vec3(0,1,1)), hw_h(i + vec3(1,1,1)), f.x), f.y), f.z);
  }`;

function addWear(mat, wear) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWear = { value: wear };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHwPos; varying vec3 vHwN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvHwPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vHwN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vHwPos; varying vec3 vHwN; uniform float uWear;\n${GLSL_NOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 wp = vHwPos; float wall = 1.0 - abs(vHwN.y);
          float big = hw_n(wp * 0.22), mid = hw_n(wp * 0.9 + 7.0), fine = hw_n(wp * 3.7);
          float grime = mix(1.05, 0.84, big) * mix(1.02, 0.95, mid);
          float base = wall * exp(-max(wp.y, 0.0) / 0.5) * 0.28;           // dirt / damp at the foot of walls
          float streak = wall * smoothstep(0.62, 0.9, hw_n(vec3((wp.x + wp.z) * 2.6, wp.y * 0.12, 3.0))) * 0.16;
          float blot = smoothstep(0.7, 0.95, hw_n(wp * 0.6 + 21.0)) * 0.12 * (1.0 - wall);
          float k = mix(1.0, grime * (1.0 - base - streak - blot) * mix(0.97, 1.03, fine), uWear);
          diffuseColor.rgb *= k;
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (hw_n(vHwPos * 0.5) - 0.5) * 0.15 * uWear, 0.04, 1.0);')
      // Fade normal-map detail with distance: far surfaces keep their colour texture but stop sparkling and shimmering.
      .replace('#include <normal_fragment_maps>', '{ vec3 hwGeoN = normal;\n#include <normal_fragment_maps>\n normal = normalize(mix(normal, hwGeoN, smoothstep(25.0, 110.0, length(vViewPosition)) * 0.85)); }');
  };
  mat.customProgramCacheKey = () => `hero-wear-${wear > 0}`;
}

let mats = null;
export function heroMaterials() {
  if (mats) return mats;
  const T = heroTextures();
  mats = {};
  for (const [key, s] of Object.entries(SURF)) {
    const t = T[s.tex];
    const clone = (tx) => { const c = tx.clone(); c.repeat.set(1 / s.tile, 1 / s.tile); c.needsUpdate = true; return c; };
    const { tex, tile, wear, ...rest } = s;
    const m = new THREE.MeshStandardMaterial({
      map: clone(t.map), normalMap: clone(t.normalMap), roughnessMap: clone(t.roughnessMap), vertexColors: true,
      roughness: 1, metalness: 0, ...rest,
    });
    m.normalScale.set(1, 1);
    addWear(m, wear); // wear 0 still gets the distance fade of normal detail
    m.name = key;
    mats[key] = m;
  }
  // Untextured specials.
  mats.carPaint = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  mats.carGlass = new THREE.MeshStandardMaterial({ color: 0x1a2026, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.5 });
  mats.chrome = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.25, metalness: 1 });
  mats.lamp = new THREE.MeshStandardMaterial({ color: 0xfff2d6, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.3 });
  mats.wire = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6 });
  return mats;
}

export const kitMaterials = heroMaterials;
