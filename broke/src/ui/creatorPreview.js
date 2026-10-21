// Live turntable of the creator's look: the same distant-detail model the game draws the player with, in a small
// renderer of its own, standing in an idle pose with the revolver drawn now and then. Drag to turn it.

import * as THREE from 'three';
import { RigType, rootMatrix } from '../render/rig.js';
import { humanPose } from '../render/models/humanoid.js';
import { loModel } from '../render/people/lo.js';
import { personMaterial } from '../render/kit/people.js';

export class CreatorPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    this.camera.position.set(0, 1.25, 4.6);
    this.camera.lookAt(0, 1.0, 0);
    this.scene.add(new THREE.HemisphereLight(0xf4f0ea, 0x4a4450, 1.5));
    const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
    sun.position.set(2, 4, 3);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xbcd0ff, 1.2);
    rim.position.set(-3, 2, -3);
    this.scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.85, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
    this.scene.add(floor);
    // The model faces -z: start facing the camera, three-quarter on, turning slowly.
    this.yaw = Math.PI - 0.45; this.spin = 0.2; this.t = 0; this.m4 = new THREE.Matrix4();
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); this.spin = 0; });
    canvas.addEventListener('pointermove', (e) => { if (drag != null) { this.yaw += (e.clientX - drag) * 0.012; drag = e.clientX; } });
    canvas.addEventListener('pointerup', () => { drag = null; });
    this.alive = true;
    this.last = performance.now();
    const loop = (now) => { if (!this.alive) return; requestAnimationFrame(loop); this.frame(Math.min(0.1, (now - this.last) / 1000)); this.last = now; };
    requestAnimationFrame(loop);
  }

  setLook(look) {
    if (this.rig) for (const m of this.rig.meshes) { this.scene.remove(m); m.dispose(); }
    this.rig = new RigType(loModel(look), 1, this.scene);
    for (const m of this.rig.meshes) m.material = personMaterial();
    this.scale = Math.max(0.88, Math.min(1.08, (look.height || 1.8) / 1.8));
  }

  frame(dt) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) { this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    this.t += dt;
    this.yaw += this.spin * dt;
    if (this.rig) {
      const pose = humanPose({ phase: 0, speed: 0, t: this.t });
      pose.hips = { r: [0, 0, Math.sin(this.t * 0.7) * 0.03], t: [Math.sin(this.t * 0.7) * 0.02, 0, 0] };
      pose.armL = [0.05, 0, -0.12]; pose.foreL = [0.2, 0, 0];
      // Every few seconds: draw the revolver and hold it up for a beat.
      const c = (this.t % 6) / 6, up = c > 0.55 && c < 0.85 ? Math.min(1, (c - 0.55) * 20, (0.85 - c) * 20) : 0;
      pose.armR = [0.05 + (Math.PI / 2 - 0.05) * up, 0, 0.12 - 0.27 * up]; pose.foreR = [0.2 * (1 - up) + 0.08 * up, 0, 0];
      if (up > 0) pose.torso = [0, -0.18 * up, 0]; // one-handed: the off hand stays down
      pose.gun = { r: [0, 0, 0], s: Math.max(0.001, up) };
      pose.head = [0.04, Math.sin(this.t * 0.5) * 0.25, 0];
      this.rig.begin();
      rootMatrix(0, 0, 0, this.yaw, this.scale, this.m4);
      this.rig.add(this.m4, pose);
      this.rig.end();
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.alive = false;
    if (this.rig) for (const m of this.rig.meshes) m.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}
