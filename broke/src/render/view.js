// Renderer, scene, lights, fog, bloom, quality tiers and dynamic resolution. Owns the city meshes, sky, actors
// and effects for one run; dispose() tears it all down so restarts never leak state.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildCity } from './cityMesh.js';
import { buildSky, sampleLighting } from './sky.js';
import { CameraRig } from './camera.js';
import { Actors } from './actors.js';
import { Fx } from './fx.js';

// Sun sits to the south-west so it lights the facades you see heading east toward the subway.
const SUN_AZ = Math.PI * 0.82;

export const QUALITY = {
  high: { pixelRatio: 1.5, shadows: 2048, bloom: true, pointLights: 6 },
  medium: { pixelRatio: 1.0, shadows: 1024, bloom: true, pointLights: 4 },
  low: { pixelRatio: 0.75, shadows: 0, bloom: false, pointLights: 2 },
};

export class View {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.info.autoReset = false; // count every pass of the composer, reset once per frame
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 4000);
    this.qualityName = opts.quality || 'auto';
    this.dynScale = 1;
    this.frameMs = [];
  }

  // Build everything for a run.
  load(game) {
    this.dispose();
    const scene = (this.scene = new THREE.Scene());
    this.game = game;
    scene.fog = new THREE.FogExp2(0xd99a7a, 0.004);
    this.sky = buildSky(scene);
    this.hemi = new THREE.HemisphereLight(0x8fa0d8, 0x5a4048, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffc27a, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -70; this.sun.shadow.camera.right = 70; this.sun.shadow.camera.top = 70; this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 400;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target);
    // A small pool of real point lights that follow the nearest streetlights / neon to the camera.
    this.points = [];
    for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffa34d, 0, 16, 1.6); scene.add(l); this.points.push(l); }
    this.city = buildCity(game.city, scene);
    this.lightList = game.city.kit.lights.filter((l) => l.radius > 0 && l.kind !== 'steam');
    this.rig = new CameraRig(this.camera);
    this.actors = new Actors(scene, game, this);
    this.fx = new Fx(scene, game, this);
    this.setQuality(this.qualityName === 'auto' ? 'high' : this.qualityName);
    this.lodT = 0;
    this.pointT = 0;
    this.frame = 0;
    this.autoQ = this.qualityName === 'auto' ? { frames: 0, ms: 0 } : null;
    this.resize();
  }

  setQuality(name) {
    this.qualityName = name;
    this.q = QUALITY[name];
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixelRatio) * this.dynScale);
    r.shadowMap.enabled = this.q.shadows > 0;
    this.sun.castShadow = this.q.shadows > 0;
    if (this.q.shadows) { this.sun.shadow.mapSize.set(this.q.shadows, this.q.shadows); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.composer?.dispose?.();
    this.composer = null;
    if (this.q.bloom) {
      const c = new EffectComposer(r);
      c.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.5, 0.82);
      c.addPass(this.bloom);
      c.addPass(new OutputPass());
      this.composer = c;
    }
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q?.pixelRatio ?? 1) * this.dynScale);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
  }

  // Called once per rendered frame with real dt (seconds) and the interpolation alpha.
  render(dt) {
    const t0 = performance.now();
    const g = this.game;
    const P = g.player;
    this.frame++;
    // Time of day from the clock.
    const L = sampleLighting(g.district.lighting.keys, g.clock.minutes);
    this.applyLighting(L);
    // Camera.
    this.rig.update(dt, P, g.world, P.sprinting);
    const cam = this.camera.position;
    // Shadows follow the player; refresh the shadow map every 3rd frame.
    const sp = P.pos;
    const el = THREE.MathUtils.degToRad(L.sunEl), az = SUN_AZ;
    this.sun.position.set(sp.x + Math.cos(az) * Math.cos(el) * 150, sp.y + Math.sin(el) * 150 + 20, sp.z + Math.sin(az) * Math.cos(el) * 150);
    this.sun.target.position.set(sp.x, sp.y, sp.z);
    this.sun.target.updateMatrixWorld();
    if (this.q.shadows && this.frame % 3 === 0) this.renderer.shadowMap.needsUpdate = true;
    // LOD + nearest point lights a few times a second.
    this.lodT -= dt;
    if (this.lodT <= 0) { this.lodT = 0.5; this.city.updateLod(cam); this.placePointLights(cam, L.night); }
    this.city.tick(g.time);
    this.actors.update(dt);
    this.fx.update(dt);
    this.renderer.info.reset();
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
    const ms = performance.now() - t0;
    this.trackPerf(ms, dt);
  }

  applyLighting(L) {
    const s = this.sky.uniforms;
    s.uTop.value.copy(L.top); s.uMid.value.copy(L.mid); s.uHor.value.copy(L.hor); s.uSunCol.value.copy(L.sun); s.uNight.value = L.night;
    const el = THREE.MathUtils.degToRad(L.sunEl);
    s.uSunDir.value.set(Math.cos(SUN_AZ) * Math.cos(el), Math.sin(el), Math.sin(SUN_AZ) * Math.cos(el));
    this.sun.color.copy(L.sun); this.sun.intensity = L.sunI;
    this.hemi.color.copy(L.hemiSky); this.hemi.groundColor.copy(L.hemiGround); this.hemi.intensity = L.hemiI;
    this.scene.fog.color.copy(L.fog); this.scene.fog.density = L.fogD;
    this.sky.cloudMat.color.copy(L.mid).lerp(L.hor, 0.35).multiplyScalar(1.1);
    this.city.setNight(L.night);
    this.night = L.night;
    if (this.bloom) this.bloom.strength = 0.4 + 0.5 * L.night;
  }

  placePointLights(cam, night) {
    const n = this.q.pointLights;
    const near = this.lightList
      .map((l) => ({ l, d: (l.x - cam.x) ** 2 + (l.z - cam.z) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, n);
    this.points.forEach((pl, i) => {
      const e = near[i];
      if (!e || night < 0.15) { pl.intensity = 0; return; }
      pl.position.set(e.l.x, e.l.y - 0.4, e.l.z);
      pl.color.set(e.l.color);
      pl.distance = e.l.radius * 2;
      pl.intensity = 30 * night;
    });
  }

  trackPerf(ms, dt) {
    this.frameMs.push(dt * 1000);
    if (this.frameMs.length > 120) this.frameMs.shift();
    const info = this.renderer.info.render;
    this.perf = { cpuMs: ms, calls: info.calls, triangles: info.triangles, dt: dt * 1000 };
    // Auto quality: after ~90 frames pick the tier; afterwards nudge resolution under load.
    if (this.autoQ) {
      this.autoQ.frames++;
      if (this.autoQ.frames > 30) this.autoQ.ms += dt * 1000;
      if (this.autoQ.frames === 120) {
        const avg = this.autoQ.ms / 90;
        this.setQuality(avg > 30 ? 'low' : avg > 19 ? 'medium' : 'high');
        this.autoQ = null;
      }
    } else if (this.frame % 60 === 0 && this.frameMs.length >= 60) {
      const avg = this.frameMs.reduce((a, b) => a + b, 0) / this.frameMs.length;
      const before = this.dynScale;
      if (avg > 20 && this.dynScale > 0.6) this.dynScale = Math.max(0.6, this.dynScale - 0.1);
      else if (avg < 13 && this.dynScale < 1) this.dynScale = Math.min(1, this.dynScale + 0.05);
      if (before !== this.dynScale) this.resize();
    }
  }

  dispose() {
    if (!this.scene) return;
    this.fx?.dispose();
    this.actors?.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    this.composer?.dispose?.();
    this.scene = null;
    this.renderer.renderLists.dispose();
  }
}
