// Sky dome: soft pastel gradient, a glowing horizon band, a low sun with a wide halo, and two layers of drifting
// procedural clouds lit warm on the sun side. Stars at night. Also samples the district's time-of-day keys.

import * as THREE from 'three';

export function buildSky(scene) {
  const uniforms = {
    uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 0.2, -1) }, uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uHor, uSunDir, uSunCol; uniform float uNight, uTime; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * n2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
      float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 sd = normalize(uSunDir);
        vec3 c = y > 0.1 ? mix(uMid, uTop, smoothstep(0.1, 0.75, y)) : mix(uHor, uMid, smoothstep(-0.04, 0.1, y));
        float sa = max(0.0, dot(d, sd));
        // Horizon glow, strongest toward the sun.
        c += uSunCol * smoothstep(0.25, -0.02, abs(y)) * (0.18 + 0.5 * pow(sa, 3.0)) * (1.0 - 0.7 * uNight);
        // Sun disc + halo.
        c += uSunCol * (pow(sa, 900.0) * 6.0 + pow(sa, 18.0) * 0.45 + pow(sa, 4.0) * 0.12) * (1.0 - 0.75 * uNight);
        // Two cloud layers projected onto a flat sky plane.
        if (y > 0.0) {
          vec2 p = d.xz / (y + 0.12);
          float t = uTime * 0.004;
          float c1 = smoothstep(0.5, 0.78, fbm(p * 0.9 + vec2(t, t * 0.4)));
          float c2 = smoothstep(0.55, 0.82, fbm(p * 2.2 + vec2(-t * 1.7, t)));
          float fade = smoothstep(0.0, 0.14, y) * (1.0 - smoothstep(0.55, 0.95, y) * 0.6);
          vec3 lit = mix(uHor * 1.15, uSunCol * 1.25 + vec3(0.12), pow(sa, 2.0));
          vec3 shade = mix(uMid, uTop, 0.35) * 0.92;
          vec3 cl = mix(shade, lit, 0.45 + 0.55 * pow(sa, 1.5));
          cl = mix(cl, vec3(0.16, 0.14, 0.3), uNight * 0.75);
          c = mix(c, cl, c1 * 0.75 * fade);
          c = mix(c, cl * 1.05, c2 * 0.5 * fade);
        }
        // Stars.
        vec3 q = floor(d * 380.0);
        c += vec3(step(0.9965, h3(q)) * smoothstep(0.12, 0.5, y) * uNight * 0.9);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  dome.scale.setScalar(3000);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);
  return { dome, uniforms, material: mat };
}

const _tmp = new THREE.Color();
const lerpC = (a, b, t, out) => out.set(a).lerp(_tmp.set(b), t);

// Sample the district's lighting keys at a time in minutes.
export function sampleLighting(keys, minutes) {
  let i = 0;
  while (i < keys.length - 1 && minutes > keys[i + 1].t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const t = b === a ? 0 : THREE.MathUtils.clamp((minutes - a.t) / (b.t - a.t), 0, 1);
  const s = THREE.MathUtils.smoothstep(t, 0, 1);
  const L = {};
  const col = (k, idx) => lerpC(idx == null ? a[k] : a[k][idx], idx == null ? b[k] : b[k][idx], s, new THREE.Color());
  L.top = col('sky', 0); L.mid = col('sky', 1); L.hor = col('sky', 2);
  L.sun = col('sun'); L.hemiSky = col('hemi', 0); L.hemiGround = col('hemi', 1); L.fog = col('fog');
  L.haze = col('haze'); L.hazeFar = col('hazeFar');
  L.sunI = a.sunI + (b.sunI - a.sunI) * s; L.hemiI = a.hemiI + (b.hemiI - a.hemiI) * s; L.fogD = a.fogD + (b.fogD - a.fogD) * s;
  L.night = a.night + (b.night - a.night) * s; L.sunEl = a.sunEl + (b.sunEl - a.sunEl) * s;
  return L;
}
