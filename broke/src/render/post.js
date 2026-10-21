// Atmosphere pass: renders the scene into a target with depth, then composites aerial perspective (distance +
// height haze that turns distant towers warm blue-violet, brighter toward the sun) and the colour grade
// (warm, slightly desaturated, lifted shadows, vignette). Output is linear HDR for bloom + OutputPass.

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export class AtmospherePass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = true;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
    this.rt.depthTexture = new THREE.DepthTexture(1, 1);
    this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.uniforms = {
      tColor: { value: null }, tDepth: { value: null },
      projInv: { value: new THREE.Matrix4() }, viewInv: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() },
      sunDir: { value: new THREE.Vector3(0, 0.3, -1) }, sunColor: { value: new THREE.Color(1, 0.7, 0.45) },
      haze: { value: new THREE.Color(0.55, 0.52, 0.75) }, hazeFar: { value: new THREE.Color(0.75, 0.62, 0.7) },
      density: { value: 0.0022 }, falloff: { value: 0.011 }, night: { value: 0 },
      grade: { value: new THREE.Vector4(1.1, 1.0, 0.88, 0.88) }, // rgb tint, saturation
      lift: { value: 0.02 }, vignette: { value: 0.32 }, aspect: { value: 1 },
    };
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor, tDepth;
        uniform mat4 projInv, viewInv; uniform vec3 camPos, sunDir, sunColor, haze, hazeFar;
        uniform float density, falloff, night, lift, vignette, aspect; uniform vec4 grade;
        varying vec2 vUv;
        void main(){
          vec3 col = texture2D(tColor, vUv).rgb;
          float d = texture2D(tDepth, vUv).x;
          vec4 v = projInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          v /= v.w;
          vec3 wp = (viewInv * v).xyz;
          vec3 ray = wp - camPos;
          float dist = length(ray);
          vec3 dir = ray / max(dist, 1e-4);
          if (d < 0.99999) {
            // Height fog integral: haze is thick near the street and thins with altitude.
            float h0 = max(camPos.y, 0.0), h1 = max(wp.y, 0.0);
            float dh = h1 - h0;
            float hf = abs(dh) < 0.05 ? exp(-falloff * h0) : (exp(-falloff * h0) - exp(-falloff * h1)) / (falloff * dh);
            float od = dist * density * (0.35 + 0.65 * hf);
            float f = 1.0 - exp(-od);
            float sunAmt = pow(max(dot(dir, normalize(sunDir)), 0.0), 5.0);
            vec3 fogCol = mix(haze, hazeFar, smoothstep(80.0, 600.0, dist));
            fogCol = mix(fogCol, sunColor, sunAmt * (0.55 - 0.35 * night));
            col = mix(col, fogCol, f);
          }
          // Grade: warm tint, gentle desaturation, lifted blacks, vignette.
          col *= grade.rgb;
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, grade.a);
          col += lift * (1.0 - clamp(col, 0.0, 1.0)) * vec3(1.0, 0.92, 0.95);
          vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
          col *= 1.0 - vignette * smoothstep(0.35, 1.05, length(q));
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    }));
  }

  setSize(w, h) {
    this.rt.setSize(w, h);
    this.uniforms.aspect.value = w / Math.max(1, h);
  }

  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    const u = this.uniforms;
    u.tColor.value = this.rt.texture;
    u.tDepth.value = this.rt.depthTexture;
    u.projInv.value.copy(this.camera.projectionMatrixInverse);
    u.viewInv.value.copy(this.camera.matrixWorld);
    u.camPos.value.setFromMatrixPosition(this.camera.matrixWorld);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() { this.rt.dispose(); this.quad.dispose(); }
}
