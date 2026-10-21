// Renderer for the hero scene (?scene=hero): the remastered look's lighting model. Bright neutral daylight from a
// clear sun and a pale sky, image-based ambient from that sky, soft PCF sun shadows, screen-space ambient occlusion
// (GTAO) for contact darkening under eaves and in corners, light distance haze only (scene fog), MSAA, and ACES
// filmic tone mapping. No colour grade or vignette. At night the sun goes out and the streetlights and windows stay warm.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { View } from '../view.js';
import { CameraRig } from '../camera.js';
import { Actors } from '../actors.js';
import { Fx } from '../fx.js';
import { Telegraphs } from '../telegraphs.js';
import { RigType, rootMatrix } from '../rig.js';
import { humanPose } from '../models/humanoid.js';
import { buildHeroScene } from './scene.js';
import { heroMaterials } from './materials.js';
import { personModel, personMaterial } from './people.js';
import { PEOPLE, O } from '../../hero/layout.js';

// Sun from the south-east, fairly high: street faces read lit and shadows fall forward-left across the road.
const SUN = new THREE.Vector3(0.55, 0.66, 0.42).normalize();
const DAY = { sun: 0xfff1de, sunI: 4.2, sky: 0xbfd0e2, ground: 0x7a7468, hemiI: 0.24, env: 0.38, fog: 0xd2dbe3, fogD: 0.0016, exposure: 0.88 };
const NIGHT = { sun: 0x8fa0c8, sunI: 0.35, sky: 0x2a3448, ground: 0x0e0e12, hemiI: 0.45, env: 0.1, fog: 0x10141c, fogD: 0.006, exposure: 1.1 };

export const HERO_QUALITY = {
  high: { pixelRatio: 1.5, shadows: 2048, ao: true, msaa: 4, pointLights: 5 },
  medium: { pixelRatio: 1.0, shadows: 2048, ao: true, msaa: 2, pointLights: 4 },
  low: { pixelRatio: 0.8, shadows: 1024, ao: false, msaa: 0, pointLights: 2 },
};

export class HeroView extends View {
  load(game) {
    this.dispose();
    const scene = (this.scene = new THREE.Scene());
    this.game = game;
    this.night = 0;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.sky = buildHeroSky();
    scene.add(this.sky.mesh);
    scene.fog = new THREE.FogExp2(DAY.fog, DAY.fogD);
    this.hemi = new THREE.HemisphereLight(DAY.sky, DAY.ground, DAY.hemiI);
    this.sun = new THREE.DirectionalLight(DAY.sun, DAY.sunI);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.04; this.sun.shadow.radius = 3; this.sun.shadow.blurSamples = 10;
    scene.add(this.hemi, this.sun, this.sun.target);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    // World.
    const built = buildHeroScene();
    scene.add(built.group);
    this.world = built.group;
    this.lamps = built.lamps;
    this.foliage = built.group.children.filter((m) => m.name === 'leaves' || m.name === 'frond' || m.name === 'chainlink');
    this.points = [];
    for (let i = 0; i < 5; i++) { const l = new THREE.PointLight(0xffb878, 0, 22, 1.8); scene.add(l); this.points.push(l); }
    // Characters: the player (shared actor layer) plus idle locals, all in the skin/fabric material.
    this.rig = new CameraRig(this.camera);
    this.rig.baseFov = 48; this.rig.dist = 3.4; this.rig.side = 0.25; this.rig.height = 1.95;
    this.actors = new Actors(scene, game, this);
    const pm = personMaterial();
    for (const m of this.actors.dee.meshes) { m.material = pm; m.receiveShadow = true; }
    this.people = {};
    for (const look of new Set(PEOPLE.map((p) => p.look))) {
      this.people[look] = new RigType(personModel(look), 4, scene);
      for (const m of this.people[look].meshes) { m.material = pm; m.receiveShadow = true; }
    }
    this.fx = new Fx(scene, game, this);
    this.tele = new Telegraphs(scene, game);
    this.city = null; this.details = null; this.edges = null;
    this.setQuality(this.qualityName === 'auto' ? 'high' : this.qualityName);
    this.frame = 0;
    this.t = 0;
    this.setNight(0);
    this.resize();
  }

  setQuality(name) {
    if (!HERO_QUALITY[name]) name = 'high';
    this.qualityName = name;
    this.q = HERO_QUALITY[name];
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixelRatio) * this.dynScale);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sun.shadow.mapSize.set(this.q.shadows, this.q.shadows); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
    this.composer?.dispose?.();
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.q.msaa });
    const c = new EffectComposer(r, rt);
    c.addPass(new RenderPass(this.scene, this.camera));
    this.ao = null;
    if (this.q.ao) {
      const ao = new GTAOPass(this.scene, this.camera, 512, 512);
      ao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.3, thickness: 1.5, scale: 1.25, samples: 12 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      ao.blendIntensity = 1.0;
      // Leaf cards are alpha-tested; the AO G-buffer would see them as solid quads, so hide them for that pass.
      const render = ao.render.bind(ao);
      ao.render = (...a) => { for (const m of this.foliage) m.visible = false; render(...a); for (const m of this.foliage) m.visible = true; };
      c.addPass(ao);
      this.ao = ao;
    }
    c.addPass(new OutputPass());
    this.composer = c;
    this.resize();
  }

  resize() {
    super.resize();
    if (this.ao) { const s = this.composer.renderTarget1; this.ao.setSize(s.width, s.height); }
  }

  setNight(k) {
    this.night = k;
    const L = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), k);
    this.sun.color.copy(L(DAY.sun, NIGHT.sun)); this.sun.intensity = DAY.sunI + (NIGHT.sunI - DAY.sunI) * k;
    this.hemi.color.copy(L(DAY.sky, NIGHT.sky)); this.hemi.groundColor.copy(L(DAY.ground, NIGHT.ground)); this.hemi.intensity = DAY.hemiI + (NIGHT.hemiI - DAY.hemiI) * k;
    this.scene.fog.color.copy(L(DAY.fog, NIGHT.fog)); this.scene.fog.density = DAY.fogD + (NIGHT.fogD - DAY.fogD) * k;
    this.renderer.toneMappingExposure = DAY.exposure + (NIGHT.exposure - DAY.exposure) * k;
    this.sky.uniforms.uNight.value = k;
    const M = heroMaterials();
    M.lamp.emissiveIntensity = 6 * k;
    M.window.emissive = new THREE.Color(0xffc890); M.window.emissiveMap = M.window.map; M.window.emissiveIntensity = 0.9 * k;
    // Image-based ambient from the sky dome.
    this.envRT?.dispose();
    const envScene = new THREE.Scene();
    const dome = this.sky.mesh.clone(); dome.scale.setScalar(0.1); envScene.add(dome);
    this.envRT = this.pmrem.fromScene(envScene, 0.02);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = DAY.env + (NIGHT.env - DAY.env) * k;
    this.placeLamps();
  }

  // The real point lights go to the streetlights nearest the camera.
  placeLamps() {
    const c = this.camera.position, k = this.night;
    const near = this.lamps.map((l) => ({ l, d: (l.x - c.x) ** 2 + (l.z - c.z) ** 2 })).sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.points.length; i++) {
      const e = near[i], p = this.points[i];
      if (!e || k < 0.1) { p.intensity = 0; continue; }
      p.position.set(e.l.x, e.l.y - 0.3, e.l.z); p.intensity = 70 * k;
    }
  }

  render(dt) {
    const t0 = performance.now();
    const g = this.game, P = g.player;
    this.frame++; this.t += dt;
    this.rig.update(dt, P, g.world, P.sprinting);
    if (this.camOverride) { const c = this.camOverride(P); this.camera.position.set(c.pos.x, c.pos.y, c.pos.z); this.camera.lookAt(c.target.x, c.target.y, c.target.z); }
    this.sky.mesh.position.copy(this.camera.position);
    // Shadow frustum follows the camera's focus; re-render the map every other frame.
    const f = new THREE.Vector3(); this.camera.getWorldDirection(f);
    const c = this.camera.position.clone().addScaledVector(f.setY(0).normalize(), 30);
    this.sun.position.copy(c).addScaledVector(SUN, 150); this.sun.target.position.copy(c); this.sun.target.updateMatrixWorld();
    this.renderer.shadowMap.autoUpdate = false;
    if (this.frame % 2 === 0 || this.frame < 3) this.renderer.shadowMap.needsUpdate = true;
    if (this.night > 0.1 && this.frame % 30 === 0) this.placeLamps();
    this.actors.update(dt);
    this.updatePeople(dt);
    this.fx.update(dt);
    this.tele.update(dt);
    this.renderer.info.reset();
    this.composer.render(dt);
    this.trackPerf(performance.now() - t0, dt);
  }

  updatePeople() {
    for (const r of Object.values(this.people)) r.begin();
    const m = new THREE.Matrix4();
    PEOPLE.forEach((p, i) => {
      const st = { phase: 0, speed: 0, t: this.t + i * 1.7 };
      const pose = humanPose(st);
      // Idle weight shift and the odd gesture.
      pose.hips = { r: [0, 0, Math.sin(this.t * 0.6 + i) * 0.03], t: [Math.sin(this.t * 0.6 + i) * 0.02, 0, 0] };
      pose.armL = [0.05, 0, -0.12 - Math.sin(this.t * 0.6 + i) * 0.03]; pose.armR = [0.05, 0, 0.12];
      pose.foreL = [0.25, 0, 0]; pose.foreR = [0.25, 0, 0];
      if (i % 2 === 1) { pose.armR = [0.9 + Math.sin(this.t * 2 + i) * 0.25, 0, 0.3]; pose.foreR = [1.0, 0, 0]; }
      pose.head = [0.05, Math.sin(this.t * 0.4 + i * 2) * 0.4, 0];
      rootMatrix(O + p.x, 0.15, O + p.z, p.yaw, 1, m);
      this.people[p.look].add(m, pose);
    });
    for (const r of Object.values(this.people)) r.end();
  }

  // Auto quality only steps resolution here (the tiers are built around AO + shadows).
  trackPerf(ms, dt) {
    this.frameMs.push(dt * 1000);
    if (this.frameMs.length > 120) this.frameMs.shift();
    const info = this.renderer.info.render;
    this.perf = { cpuMs: ms, calls: info.calls, triangles: info.triangles, dt: dt * 1000 };
  }

  placePointLights() {}
  dispose() {
    this.envRT?.dispose();
    super.dispose();
  }
}

// Sky: pale blue zenith to a bright hazy horizon, soft broken cloud, the sun's glow. Night: deep blue-black.
function buildHeroSky() {
  const uniforms = { uSun: { value: SUN.clone() }, uNight: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uSun; uniform float uNight;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += n(p) * a; p *= 2.03; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir); float y = max(d.y, 0.0);
        vec3 zen = vec3(0.46, 0.6, 0.76), hor = vec3(0.86, 0.88, 0.89);
        vec3 col = mix(hor, zen, pow(y, 0.55));
        // Clouds on a plane, thinning to haze at the horizon.
        vec2 uv = d.xz / max(d.y, 0.06) * 1.6;
        float c = smoothstep(0.45, 0.78, fbm(uv + vec2(3.0, 7.0)));
        col = mix(col, vec3(0.93, 0.93, 0.94) - 0.08 * fbm(uv * 3.0), c * smoothstep(0.02, 0.3, y) * 0.85);
        float s = max(dot(d, uSun), 0.0);
        col += vec3(1.0, 0.95, 0.85) * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.12);
        if (d.y < 0.0) col = hor * 0.9;
        vec3 night = mix(vec3(0.02, 0.03, 0.06), vec3(0.08, 0.1, 0.14), 1.0 - y);
        gl_FragColor = vec4(mix(col, night, uNight), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), material);
  mesh.frustumCulled = false; mesh.renderOrder = -1;
  return { mesh, uniforms };
}
