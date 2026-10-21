// Free-fly debug camera (F1). Mouse looks, WASD moves along the view, Space / C rise and sink, Shift is fast.
// While it's on, the leader stands still (an empty control command each tick) and the view follows the camera.

export class FlyCam {
  constructor(input) { this.input = input; this.active = false; this.pos = { x: 0, y: 0, z: 0 }; }

  toggle(view) {
    this.active = !this.active;
    const I = this.input;
    if (this.active) {
      const c = view.camera.position;
      this.pos = { x: c.x, y: c.y, z: c.z };
      this.saved = { yaw: I.yaw, pitch: I.pitch };
      view.camOverride = () => this.pose();
    } else {
      view.camOverride = null;
      if (this.saved) { I.yaw = this.saved.yaw; I.pitch = this.saved.pitch; }
    }
    return this.active;
  }

  // Look straight down from above a point (used for the overlay screenshot and "overview" key).
  overview(x, z, height) { this.pos = { x, y: height, z: z + 0.01 }; this.input.pitch = -1.5; }

  update(dt) {
    if (!this.active) return;
    const k = this.input.keys, yaw = this.input.yaw, pitch = this.input.pitch;
    const sp = (k.has('ShiftLeft') || k.has('ShiftRight') ? 90 : 24) * dt;
    const cp = Math.cos(pitch);
    const f = { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp }, r = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const fw = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0), st = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), up = (k.has('Space') ? 1 : 0) - (k.has('KeyC') ? 1 : 0);
    this.pos.x += (f.x * fw + r.x * st) * sp; this.pos.y += (f.y * fw + up) * sp; this.pos.z += (f.z * fw + r.z * st) * sp;
  }

  pose() {
    const yaw = this.input.yaw, pitch = this.input.pitch, cp = Math.cos(pitch);
    return { pos: this.pos, target: { x: this.pos.x - Math.sin(yaw) * cp, y: this.pos.y + Math.sin(pitch), z: this.pos.z - Math.cos(yaw) * cp } };
  }
}
