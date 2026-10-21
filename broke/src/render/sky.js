// Sky dome (gradient + sun/moon glow + stars), faceted cloud slabs, and the time-of-day lighting rig driven by the
// difficulty clock: golden hour -> dusk at Rush Hour -> full night by Gridlock.

import * as THREE from 'three';
import { fball, at } from './facet.js';

export function buildSky(scene) {
  const uniforms = {
    uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 0.2, -1) }, uSunCol: { value: new THREE.Color() }, uNight: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uTop, uMid, uHor, uSunDir, uSunCol; uniform float uNight; varying vec3 vDir;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){
        float y = vDir.y;
        vec3 c = y > 0.12 ? mix(uMid, uTop, smoothstep(0.12, 0.7, y)) : mix(uHor, uMid, smoothstep(-0.05, 0.12, y));
        float sd = max(0.0, dot(normalize(vDir), normalize(uSunDir)));
        c += uSunCol * (pow(sd, 400.0) * 3.0 + pow(sd, 12.0) * 0.35) * (1.0 - uNight * 0.6);
        vec3 q = floor(vDir * 380.0);
        float star = step(0.9965, h(q)) * smoothstep(0.1, 0.5, y) * uNight;
        c += vec3(star) * 0.9;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  dome.scale.setScalar(3000);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);
  // Low-poly cloud slabs in a wide ring, tinted each frame.
  const cloudMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.85 });
  const cloudGeo = fball(1, 0xffffff, at(0, 0, 0, 0, 0, 0, 1, 0.22, 0.6), { detail: 1, jitter: 0.25, shade: 0.12 });
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, 26);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + Math.sin(i * 7.3) * 0.2;
    const r = 2000 + (i % 5) * 160;
    q.setFromAxisAngle(v.set(0, 1, 0), -a);
    m4.compose(v.set(Math.cos(a) * r, 380 + (i % 4) * 110, Math.sin(a) * r), q, s.set(150 + (i % 3) * 60, 60, 110));
    clouds.setMatrixAt(i, m4);
  }
  clouds.frustumCulled = false;
  scene.add(clouds);
  return { dome, uniforms, clouds, cloudMat };
}

const lerpC = (a, b, t, out) => out.set(a).lerp(_tmp.set(b), t);
const _tmp = new THREE.Color();

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
  L.sunI = a.sunI + (b.sunI - a.sunI) * s; L.hemiI = a.hemiI + (b.hemiI - a.hemiI) * s; L.fogD = a.fogD + (b.fogD - a.fogD) * s;
  L.night = a.night + (b.night - a.night) * s; L.sunEl = a.sunEl + (b.sunEl - a.sunEl) * s;
  return L;
}
