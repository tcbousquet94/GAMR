// Ground telegraphs: while an enemy winds up, the area its attack will cover is painted on the ground and fills
// as the wind-up completes. Scooter Bro: his charge lane. Speakerphone Guy: the soundwave cone. Canvasser: the short
// lunge. HOA President: the gavel shockwave's full radius (jump it). Complements the white body flash.

import * as THREE from 'three';

const POOL = 24;
const LANE = 0, CONE = 1, RING = 2;

const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = `uniform float uK; uniform float uShape; uniform float uT; uniform vec3 uCol; varying vec2 vUv;
  void main(){
    float a = 0.0;
    if (uShape < 0.5) {            // lane: uv.x across, uv.y along (0 at the enemy)
      float edge = step(0.86, abs(vUv.x - 0.5) * 2.0);
      float fill = step(vUv.y, uK) * 0.35;
      float chevron = step(0.75, fract(vUv.y * 6.0 - uT * 2.0 + abs(vUv.x - 0.5))) * 0.25;
      a = max(edge * 0.85, fill + chevron);
      a *= smoothstep(1.0, 0.85, vUv.y);
    } else if (uShape < 1.5) {     // cone: apex at uv (0.5, 0)
      vec2 p = vec2((vUv.x - 0.5) * 2.0, vUv.y);
      float inside = step(abs(p.x), p.y);
      float edge = smoothstep(0.92, 1.0, abs(p.x) / max(p.y, 1e-3)) * inside;
      float fill = step(p.y, uK) * 0.3 * inside;
      a = max(edge * 0.8, fill) * smoothstep(1.0, 0.9, p.y);
    } else {                       // ring: centre (0.5, 0.5)
      float r = length(vUv - 0.5) * 2.0;
      float band = smoothstep(0.93, 0.96, r) * smoothstep(1.0, 0.98, r);
      float fill = step(r, uK) * step(uK - 0.08, r) * 0.6 + step(r, 1.0) * 0.08;
      a = max(band, fill);
    }
    float pulse = 0.75 + 0.25 * sin(uT * (10.0 + 20.0 * uK));
    gl_FragColor = vec4(uCol, a * pulse * 0.9);
  }`;

export class Telegraphs {
  constructor(scene, game) {
    this.game = game;
    this.t = 0;
    this.geoFwd = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5); // extends toward -z
    this.geoCtr = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uK: { value: 0 }, uShape: { value: 0 }, uT: { value: 0 }, uCol: { value: new THREE.Color(0xff5a2e) } },
        vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      });
      const m = new THREE.Mesh(this.geoFwd, mat);
      m.visible = false; m.renderOrder = 4; m.frustumCulled = false;
      scene.add(m);
      this.pool.push(m);
    }
  }

  update(dt) {
    this.t += dt;
    const g = this.game, P = g.player;
    let n = 0;
    const put = (shape, x, y, z, yaw, w, len, k, col) => {
      if (n >= POOL) return;
      const m = this.pool[n++];
      m.visible = true;
      m.geometry = shape === RING ? this.geoCtr : this.geoFwd;
      m.position.set(x, y + 0.06, z);
      m.rotation.set(0, yaw, 0);
      m.scale.set(w, 1, len);
      const u = m.material.uniforms;
      u.uK.value = k; u.uShape.value = shape; u.uT.value = this.t; u.uCol.value.setHex(col);
    };
    for (const e of g.enemies) {
      if (!e.alive || !(e.telegraph > 0)) continue;
      const p = e.pos;
      const toP = Math.atan2(-(P.pos.x - p.x), -(P.pos.z - p.z));
      const k = e.telegraph;
      if (e.type === 'scooter') put(LANE, p.x, p.y, p.z, toP, 1.8, 24, k, 0xff5a2e);
      else if (e.type === 'speakerphone') put(CONE, p.x, p.y, p.z, toP, 2 * 17 * Math.tan(0.3), 17, k, 0xffb03a);
      else if (e.type === 'canvasser') put(LANE, p.x, p.y, p.z, toP, 1.2, 5, k, 0xff7a3a);
      else if (e.boss && e.state === 'gavel') put(RING, p.x, p.y, p.z, 0, 32, 32, k, 0xffe2a0);
    }
    for (let i = n; i < POOL; i++) this.pool[i].visible = false;
  }

  dispose() { for (const m of this.pool) { m.material.dispose(); m.removeFromParent(); } this.geoFwd.dispose(); this.geoCtr.dispose(); }
}
