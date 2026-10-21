// Third-person over-the-shoulder camera. Matches the sim's aim origin (right shoulder) so the crosshair is honest,
// pulls in when a wall is behind the survivor, and adds shake/FOV kick for game feel.

import * as THREE from 'three';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.dist = 4.6;
    this.cur = 4.6;
    this.shake = 0;
    this.fovKick = 0;
    this.baseFov = 70;
    this.pos = new THREE.Vector3();
  }

  addShake(k) { this.shake = Math.min(1.2, this.shake + k); }

  update(dt, player, world, sprinting) {
    const p = player.pos;
    const yaw = player.yaw, pitch = player.pitch;
    const cp = Math.cos(pitch);
    const fwd = new THREE.Vector3(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const pivot = new THREE.Vector3(p.x, p.y + 1.65, p.z).addScaledVector(right, 0.7);
    // Collide the boom with the world.
    const back = fwd.clone().multiplyScalar(-1);
    const want = this.dist + (sprinting ? 0.5 : 0);
    const hit = world.raycast(pivot.x, pivot.y, pivot.z, back.x, back.y, back.z, want + 0.3);
    const target = Math.max(0.8, Math.min(want, hit - 0.3));
    this.cur = target < this.cur ? target : this.cur + (target - this.cur) * Math.min(1, dt * 4);
    this.pos.copy(pivot).addScaledVector(back, this.cur);
    if (this.shake > 0) {
      const s = this.shake * this.shake * 0.25;
      this.pos.x += (Math.random() - 0.5) * s; this.pos.y += (Math.random() - 0.5) * s; this.pos.z += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.pos.clone().add(fwd));
    this.fovKick += ((sprinting ? 7 : 0) - this.fovKick) * Math.min(1, dt * 5);
    const fov = this.baseFov + this.fovKick;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }
}
