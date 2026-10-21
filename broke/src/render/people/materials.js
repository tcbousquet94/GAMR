// Materials for the close-up human. Every pattern is computed in the bind-pose ("rest") space of the skinned mesh,
// so fabric weave, seams, pockets, freckles and wrinkles stay glued to the body as it animates. Small relief (pores,
// twill, stitching, wrinkles, strands) is a screen-space bump from the derivatives of a procedural height.

import * as THREE from 'three';

const NOISE = /* glsl */`
  varying vec3 vRest; varying vec3 vRestN;
  float ph(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float pn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(ph(i), ph(i+vec3(1,0,0)), f.x), mix(ph(i+vec3(0,1,0)), ph(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(ph(i+vec3(0,0,1)), ph(i+vec3(1,0,1)), f.x), mix(ph(i+vec3(0,1,1)), ph(i+vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm3(vec3 p){ return pn(p) * 0.5 + pn(p * 2.03) * 0.3 + pn(p * 4.1) * 0.2; }
  float seg(vec3 p, vec3 a, vec3 b){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
  float band(float x, float c, float w){ return 1.0 - smoothstep(0.0, w, abs(x - c)); }
  float hgt; float rough; float metal;
  vec3 bumpN(vec3 n, float h, float s){
    vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
    float hx = dFdx(h), hy = dFdy(h);
    vec3 r1 = cross(dpdy, n), r2 = cross(n, dpdx);
    float det = dot(dpdx, r1);
    vec3 g = sign(det) * (hx * r1 + hy * r2);
    return normalize(abs(det) * n - g * s);
  }`;

// body: GLSL run at the colour stage; may set diffuseColor.rgb, hgt (relief 0..1), rough, metal. bump: metres of relief.
function make(key, body, uniforms, { bump = 0.0006, roughness = 0.8, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness: 0, side });
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    const decl = Object.entries(uniforms).map(([n, u]) => `uniform ${typeof u.value === 'number' ? 'float' : u.value.isColor ? 'vec3' : 'vec3'} ${n};`).join('\n');
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest; varying vec3 vRestN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position; vRestN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${decl}\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n hgt = 0.0; rough = ${roughness.toFixed(3)}; metal = 0.0;\n{\n${body}\n}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = metal;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\nnormal = bumpN(normal, hgt, ${bump.toFixed(5)});`);
  };
  m.customProgramCacheKey = () => `person-${key}`;
  return m;
}
const col = (c) => ({ value: new THREE.Color(c) });
const vec = (v) => ({ value: new THREE.Vector3(...v) });

// ---- skin ---------------------------------------------------------------------------------------------------------------
export function skinMaterial(spec, head) {
  const stub = spec.facial?.style === 'stubble' ? 1 : spec.facial?.style === 'beard' || spec.facial?.style === 'goatee' ? 0.6 : spec.sex === 'm' ? 0.35 : 0;
  return make('skin', /* glsl */`
    vec3 q = vRest - uHead;
    vec3 c = uSkin;
    float blot = fbm3(vRest * 28.0);
    c *= 0.93 + 0.12 * blot * uVar;
    // Warmth where blood is close to the surface: cheeks, nose, ears, knuckles.
    float red = exp(-pow(length(vec3(abs(q.x) - 0.045, q.y - 0.13, q.z + 0.075)) / 0.022, 2.0)) * 0.7
              + exp(-pow(length(q - vec3(0.0, 0.124, -0.118)) / 0.014, 2.0))
              + exp(-pow(length(vec3(abs(q.x) - 0.078, q.y - 0.152, q.z - 0.008)) / 0.02, 2.0)) * 0.6;
    c = mix(c, c * vec3(1.14, 0.86, 0.84), clamp(red, 0.0, 1.0) * 0.45);
    // Lips.
    float lip = exp(-pow(length(vec2(q.x / 0.024, (q.y - 0.094) / 0.012)), 4.0)) * step(q.z, -0.088);
    c = mix(c, c * vec3(0.82, 0.56, 0.54), lip * 0.8);
    // Soft shadowing around the eyes.
    float socket = exp(-pow(length(vec3(abs(q.x) - 0.031, q.y - 0.158, q.z + 0.097)) / 0.02, 2.0));
    c *= 1.0 - socket * 0.18;
    // Stubble / shadow on the jaw, chin and upper lip (men), as tiny dark dots.
    float jaw = smoothstep(0.128, 0.11, q.y) * smoothstep(0.02, -0.02, q.z) * smoothstep(0.01, 0.06, length(q.xz)) * (1.0 - lip) * step(-0.02, q.y);
    float dots = step(0.55, ph(floor(vRest * 1400.0)));
    c = mix(c, uHair, jaw * uStubble * (0.25 + 0.35 * dots));
    diffuseColor.rgb = c;
    // Relief: pores everywhere; with age, forehead lines, crow's feet and the nasolabial folds.
    float pores = pn(vRest * 900.0);
    float fore = band(fract(q.y / 0.009), 0.5, 0.25) * smoothstep(0.172, 0.18, q.y) * smoothstep(0.215, 0.2, q.y) * step(q.z, -0.07);
    float crow = band(fract(atan(q.y - 0.158, abs(q.x) - 0.031) * 3.0), 0.5, 0.2) * exp(-pow((length(vec2(abs(q.x) - 0.047, q.y - 0.158))) / 0.012, 2.0)) * step(q.z, -0.06);
    float naso = exp(-pow(seg(vec3(abs(q.x), q.y, q.z), vec3(0.017, 0.118, -0.106), vec3(0.03, 0.09, -0.097)) / 0.004, 2.0));
    hgt = pores * 0.25 - (fore * 0.8 + crow * 0.6) * uAge - naso * (0.4 + uAge);
    rough = mix(0.55, 0.38, lip) - 0.08 * exp(-pow(length(q - vec3(0.0, 0.15, -0.11)) / 0.03, 2.0));
  `, { uSkin: col(spec.skin), uHead: vec(head), uVar: { value: spec.skinVar }, uAge: { value: spec.face.wrinkles }, uStubble: { value: stub }, uHair: col(spec.facial?.color ?? spec.hair.color) }, { bump: 0.0007, roughness: 0.55 });
}

export function eyeMaterial(spec, eyeL, eyeR) {
  return make('eye', /* glsl */`
    vec3 e = length(vRest - uEyeL) < length(vRest - uEyeR) ? uEyeL : uEyeR;
    vec3 n = normalize(vRest - e);
    float c = dot(n, vec3(0.0, 0.0, -1.0));
    float a = acos(clamp(c, -1.0, 1.0));
    vec3 sclera = vec3(0.86, 0.82, 0.78) * (1.0 - 0.15 * smoothstep(0.9, 1.5, a));
    float ring = smoothstep(0.5, 0.46, a);
    vec3 iris = uIris * (0.7 + 0.5 * pn(vec3(atan(n.y, n.x) * 9.0, a * 30.0, 0.0)));
    iris = mix(iris * 0.5, iris, smoothstep(0.48, 0.38, a));
    vec3 cc = mix(sclera, iris, ring);
    cc = mix(cc, vec3(0.02), smoothstep(0.19, 0.16, a));
    diffuseColor.rgb = cc;
    rough = 0.05;
  `, { uEyeL: vec(eyeL), uEyeR: vec(eyeR), uIris: col(spec.face.eye) }, { bump: 0, roughness: 0.05 });
}

// Hair: strands radiating from the crown, individual grey strands mixed in, darker at the roots.
export function hairMaterial(color, grey, crown, key = 'hair') {
  return make(key, /* glsl */`
    vec3 v = vRest - uCrown;
    float a = atan(v.x, v.z);
    float s = pn(vec3(a * 70.0, length(v) * 9.0, 0.0)) * 0.6 + pn(vRest * 420.0) * 0.4;
    float g = step(1.0 - uGrey, ph(floor(vec3(a * 140.0, length(v) * 30.0, 1.0))));
    vec3 c = mix(uColor, vec3(0.62, 0.6, 0.58), g * 0.85);
    c *= 0.65 + 0.55 * s;
    diffuseColor.rgb = c;
    hgt = s;
    rough = 0.5;
  `, { uColor: col(color), uGrey: { value: Math.min(1, grey) }, uCrown: vec(crown) }, { bump: 0.0012, roughness: 0.5 });
}

// ---- fabrics --------------------------------------------------------------------------------------------------------------
const FABRIC = {
  // Blue denim: diagonal twill, thread slubs, faded thighs and knees, whiskers, yellow-gold stitched seams, waistband,
  // back pockets, hem.
  denim: /* glsl */`
    vec3 p = vRest;
    float tw = sin((p.y + (p.x + p.z) * 0.7) * 6.2832 * 170.0) * 0.5 + 0.5;
    float slub = pn(vec3(p.x * 40.0, p.y * 900.0, p.z * 40.0));
    vec3 c = uColor * (0.86 + 0.16 * tw + 0.1 * slub);
    float fade = (smoothstep(0.55, 0.7, p.y) * smoothstep(0.9, 0.75, p.y) + smoothstep(0.38, 0.47, p.y) * smoothstep(0.58, 0.48, p.y) * 0.8) * smoothstep(-0.2, -0.7, vRestN.z);
    fade += 0.4 * smoothstep(0.6, 0.9, fbm3(p * 9.0));
    c = mix(c, vec3(0.62, 0.7, 0.8) * length(uColor) * 1.3, clamp(fade, 0.0, 1.0) * 0.45 * uWorn);
    float whisk = band(fract((p.y - abs(p.x) * 0.6) / 0.012), 0.5, 0.12) * smoothstep(0.8, 0.84, p.y) * smoothstep(0.92, 0.88, p.y) * step(p.z, -0.04);
    c = mix(c, c * 1.35, whisk * 0.6 * uWorn);
    float stitch = step(0.5, fract(p.y * 220.0));
    float outseam = smoothstep(0.92, 0.97, abs(vRestN.x)) * step(0.06, abs(p.x)) * step(p.y, 0.95);
    float waist = band(p.y, 0.94, 0.0025) + band(p.y, 0.972, 0.0025);
    float hem = band(p.y, 0.113, 0.002);
    float pocket = step(0.03, p.z) * step(0.03, abs(p.x)) * step(abs(p.x), 0.13) * step(0.83, p.y) * step(p.y, 0.95);
    float pedge = pocket * (band(abs(p.x), 0.035, 0.002) + band(abs(p.x), 0.125, 0.002) + band(p.y, 0.835, 0.002));
    c = mix(c, c * 0.62, outseam * 0.7 + step(0.94, p.y) * 0.08);
    c = mix(c, vec3(0.78, 0.6, 0.28), clamp((outseam * 0.5 + waist + hem + pedge) * stitch, 0.0, 1.0) * 0.85);
    diffuseColor.rgb = c;
    hgt = tw * 0.4 + slub * 0.3 - outseam * 0.5 + pedge;
    rough = 0.82;`,
  // Duck canvas work jacket: tight weave, mottled fading and grime, stitched shoulder and side seams, chest pockets with
  // flaps, placket stitching along the open front, waistband.
  canvas: /* glsl */`
    vec3 p = vRest;
    float wv = (sin(p.x * 6.2832 * 260.0) * sin(p.y * 6.2832 * 260.0) + sin(p.z * 6.2832 * 260.0) * sin(p.y * 6.2832 * 260.0)) * 0.25 + 0.5;
    float mot = fbm3(p * 7.0), grime = fbm3(p * 3.0 + 11.0);
    vec3 c = uColor * (0.88 + 0.12 * wv) * (0.92 + 0.16 * mot);
    c = mix(c, c * vec3(1.18, 1.14, 1.06), smoothstep(0.55, 0.85, mot) * 0.5 * uWorn);
    c *= 1.0 - smoothstep(0.55, 0.8, grime) * 0.18 * uWorn;
    float stitch = step(0.45, fract((p.x + p.y + p.z) * 240.0));
    float shoulder = band(p.y, 1.468, 0.003) * step(0.09, abs(p.x));
    float side = smoothstep(0.93, 0.98, abs(vRestN.x)) * step(abs(p.x), 0.24) * step(p.y, 1.36);
    vec2 pk = vec2(abs(p.x) - 0.1, p.y - 1.29);
    float pocket = step(p.z, -0.03) * step(abs(pk.x), 0.05) * step(abs(pk.y), 0.06);
    float pedge = pocket * (band(abs(pk.x), 0.048, 0.003) + band(pk.y, -0.058, 0.003));
    float flap = step(p.z, -0.03) * step(abs(pk.x), 0.052) * step(0.035, pk.y) * step(pk.y, 0.065);
    float open = 0.035 + (1.5 - p.y) * 0.05;
    float placket = step(p.z, -0.02) * band(abs(p.x), open + 0.012, 0.002);
    float hemband = smoothstep(0.92, 0.915, p.y);
    c = mix(c, c * 0.8, flap * 0.6 + hemband * 0.3);
    c = mix(c, c * 0.62, (shoulder + side) * 0.6);
    c = mix(c, uColor * 0.55, clamp((pedge + placket + shoulder * 0.7) * stitch, 0.0, 1.0) * 0.9);
    diffuseColor.rgb = c;
    hgt = wv * 0.3 + flap * 0.6 + pocket * 0.4 - (shoulder + side) * 0.5;
    rough = 0.86;`,
  corduroy: /* glsl */`
    vec3 p = vRest;
    float rib = sin(atan(p.x, p.z) * 140.0) * 0.5 + 0.5;
    diffuseColor.rgb = uColor * (0.7 + 0.45 * rib) * (0.9 + 0.2 * pn(p * 40.0));
    hgt = rib; rough = 0.9;`,
  // Cotton knit (tees, henleys, long sleeves): fine vertical wales, slight pilling, ribbed neckband, henley placket.
  knit: /* glsl */`
    vec3 p = vRest;
    float wale = sin((p.x * 0.7 + p.z * 0.7) * 6.2832 * 380.0) * 0.5 + 0.5;
    float pil = pn(p * 300.0);
    vec3 c = uColor * (0.92 + 0.08 * wale + 0.06 * pil) * (0.95 + 0.08 * fbm3(p * 6.0));
    float r = length(p.xz - vec2(0.0, 0.008));
    float neckband = step(1.43, p.y) * smoothstep(0.095, 0.085, r);
    c *= 1.0 - neckband * 0.1;
    float plk = uHenley * step(p.z, -0.02) * step(1.38, p.y) * step(abs(p.x), 0.014);
    float btn = uHenley * step(p.z, -0.02) * (step(length(vec2(p.x, p.y - 1.505)), 0.0045) + step(length(vec2(p.x, p.y - 1.465)), 0.0045) + step(length(vec2(p.x, p.y - 1.425)), 0.0045));
    c = mix(c, c * 0.78, plk * band(abs(p.x), 0.012, 0.002));
    c = mix(c, vec3(0.82, 0.8, 0.74), clamp(btn, 0.0, 1.0));
    diffuseColor.rgb = c;
    hgt = wale * 0.3 + pil * 0.2 + neckband * sin(atan(p.x, p.z) * 120.0) * 0.4 + btn;
    rough = 0.9;`,
  fleece: /* glsl */`
    vec3 p = vRest;
    float f = pn(p * 220.0);
    vec3 c = uColor * (0.9 + 0.12 * f) * (0.95 + 0.08 * fbm3(p * 5.0));
    float pocket = step(p.z, -0.05) * step(abs(p.x), 0.13) * step(0.95, p.y) * step(p.y, 1.12);
    float pedge = pocket * (band(p.y, 1.118, 0.003) + band(abs(p.x), 0.128, 0.003));
    float rib = smoothstep(0.935, 0.93, p.y);
    c = mix(c, c * 0.72, clamp(pedge + rib * 0.4, 0.0, 1.0));
    diffuseColor.rgb = c;
    hgt = f * 0.4 + pocket * 0.4 + rib * sin(atan(p.x, p.z) * 200.0) * 0.3;
    rough = 0.95;`,
  // Basketball jersey: perforated mesh with contrasting trim.
  jersey: /* glsl */`
    vec3 p = vRest;
    vec2 g = fract(vec2(p.x + p.z, p.y) * 260.0) - 0.5;
    float hole = smoothstep(0.22, 0.18, length(g));
    vec3 c = uColor * (1.0 - hole * 0.3);
    float r = length(p.xz - vec2(0.0, 0.008));
    float trim = step(1.4, p.y) * smoothstep(0.1, 0.09, r) + smoothstep(0.13, 0.135, abs(p.x)) * step(1.25, p.y);
    c = mix(c, vec3(0.88, 0.86, 0.82), clamp(trim, 0.0, 1.0) * 0.85);
    diffuseColor.rgb = c;
    hgt = 1.0 - hole;
    rough = 0.6;`,
  slacks: /* glsl */`
    vec3 p = vRest;
    float tw = sin((p.y + p.x * 0.8) * 6.2832 * 300.0) * 0.5 + 0.5;
    vec3 c = uColor * (0.94 + 0.06 * tw) * (0.95 + 0.08 * fbm3(p * 6.0));
    float crease = smoothstep(0.985, 1.0, -vRestN.z) * step(p.y, 0.85);
    float waist = band(p.y, 0.94, 0.003);
    c = mix(c, c * 0.8, waist);
    diffuseColor.rgb = c;
    hgt = tw * 0.2 + crease;
    rough = 0.75;`,
  // Leather (boots, belts): pebbled grain, flex creases over the toes, scuffs, a rubber sole with tread, laces, a welt.
  leather: /* glsl */`
    vec3 p = vRest;
    float grain = pn(p * 520.0);
    vec3 c = uColor * (0.85 + 0.2 * grain) * (0.9 + 0.15 * fbm3(p * 12.0));
    float crease = band(fract(p.z * 90.0), 0.5, 0.15) * smoothstep(0.045, 0.06, p.y) * smoothstep(0.1, 0.085, p.y) * step(p.z - uToe, 0.0);
    float scuff = smoothstep(0.6, 0.85, fbm3(p * 30.0)) * smoothstep(0.08, 0.04, p.y);
    c = mix(c, c * vec3(1.4, 1.3, 1.2), scuff * 0.5);
    float sole = smoothstep(0.034, 0.03, p.y) * uBoot;
    float tread = step(0.5, fract(p.z * 60.0)) * smoothstep(0.012, 0.0, p.y);
    float welt = band(p.y, 0.036, 0.003) * step(0.5, fract((p.x + p.z) * 300.0)) * uBoot;
    float lace = uBoot * step(p.z - uToe, -0.0) * step(0.075, p.y) * step(p.y, 0.19) * smoothstep(0.022, 0.012, abs(p.x - uFootX)) * band(fract((p.y + abs(p.x - uFootX) * 1.2) * 60.0), 0.5, 0.2) * step(vRestN.z, -0.3);
    float buckle = uBelt * step(p.z, -0.05) * step(abs(p.x), 0.024);
    c = mix(c, vec3(0.08, 0.07, 0.065) * (1.0 - tread * 0.4), sole);
    c = mix(c, vec3(0.7, 0.6, 0.4), welt * 0.6);
    c = mix(c, vec3(0.12, 0.1, 0.08), lace);
    c = mix(c, vec3(0.62, 0.56, 0.42), buckle);
    diffuseColor.rgb = c;
    hgt = grain * 0.4 - crease * 0.8 + lace * 0.5 + tread * sole;
    rough = mix(mix(0.62, 0.9, sole), 0.3, buckle);
    metal = buckle * 0.9;`,
  sneaker: /* glsl */`
    vec3 p = vRest;
    float g = pn(p * 400.0);
    vec3 c = uColor * (0.92 + 0.1 * g);
    float sole = smoothstep(0.038, 0.032, p.y);
    float stripe = band(p.y, 0.038, 0.002);
    float lace = step(p.z - uToe, 0.0) * step(0.06, p.y) * step(p.y, 0.11) * smoothstep(0.02, 0.01, abs(p.x - uFootX)) * band(fract((p.y + abs(p.x - uFootX)) * 70.0), 0.5, 0.2) * step(vRestN.z, -0.3);
    c = mix(c, vec3(0.86, 0.85, 0.82), sole);
    c = mix(c, c * 0.5, stripe + lace * 0.6);
    diffuseColor.rgb = c;
    hgt = g * 0.3 + lace * 0.5;
    rough = mix(0.55, 0.85, sole);`,
};

export function fabricMaterial(kind, color, opts = {}) {
  const u = { uColor: col(color), uWorn: { value: opts.worn ?? 0.4 }, uHenley: { value: opts.henley ? 1 : 0 }, uToe: { value: opts.toe ?? 0 }, uFootX: { value: opts.footX ?? 0 }, uBoot: { value: opts.boot ? 1 : 0 }, uBelt: { value: opts.belt ? 1 : 0 } };
  const bump = { denim: 0.00045, canvas: 0.0005, corduroy: 0.0008, knit: 0.0003, fleece: 0.0004, jersey: 0.0003, slacks: 0.0002, leather: 0.0004, sneaker: 0.0003 }[kind];
  return make(kind, FABRIC[kind], u, { bump, roughness: 0.8 });
}

export function gunMaterial() { return new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.35, metalness: 0.7 }); }
