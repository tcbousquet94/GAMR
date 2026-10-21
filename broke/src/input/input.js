// Keyboard + mouse (pointer lock) + gamepad -> one sim input object per fixed step. Edge-triggered actions
// (jump, abilities, interact) are latched until the next sim step consumes them so no press is ever lost.

const BINDS = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], sprint: ['ShiftLeft', 'ShiftRight'], secondary: [], utility: ['KeyQ'], special: ['KeyR'],
  equipment: ['KeyF'], interact: ['KeyE'],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.sens = 0.0022;
    this.mouse = { left: false, right: false };
    this.latched = {};
    this.sprintToggle = false;
    this.enabled = false;
    this.locked = false;
    this.onKey = (e) => {
      if (!this.enabled) return;
      if (e.type === 'keydown') {
        if (!e.repeat) this.press(e.code);
        this.keys.add(e.code);
        if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
      } else this.keys.delete(e.code);
    };
    this.onMouseMove = (e) => {
      if (!this.enabled || !this.locked) return;
      this.yaw -= e.movementX * this.sens;
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - e.movementY * this.sens));
    };
    this.onMouse = (e) => {
      if (!this.enabled || this.touch?.enabled) return;
      const down = e.type === 'mousedown';
      if (e.button === 0) this.mouse.left = down;
      if (e.button === 2) { this.mouse.right = down; if (down) this.latched.secondary = true; }
      if (down && !this.locked) this.lock();
    };
    this.onLock = () => { this.locked = document.pointerLockElement === this.canvas; };
    addEventListener('keydown', this.onKey);
    addEventListener('keyup', this.onKey);
    addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouse);
    addEventListener('mouseup', this.onMouse);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', this.onLock);
    addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
  }

  lock() { if (this.touch?.enabled) return; try { this.canvas.requestPointerLock?.(); } catch { /* ignored: some browsers refuse without a gesture */ } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  press(code) {
    for (const [action, codes] of Object.entries(BINDS)) {
      if (!codes.includes(code)) continue;
      if (action === 'jump') this.latched.jump = true;
      if (action === 'sprint') this.sprintToggle = !this.sprintToggle;
      if (['secondary', 'utility', 'special', 'equipment', 'interact'].includes(action)) this.latched[action] = true;
    }
  }

  down(action) { return BINDS[action].some((c) => this.keys.has(c)); }

  // Build the input for one sim step. Gamepad is polled here too.
  sample() {
    const gp = navigator.getGamepads?.()[0];
    let mx = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    let mz = (this.down('forward') ? 1 : 0) - (this.down('back') ? 1 : 0);
    let primary = this.mouse.left;
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      mx += dz(gp.axes[0]); mz -= dz(gp.axes[1]);
      this.yaw -= dz(gp.axes[2]) * 0.05; this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - dz(gp.axes[3]) * 0.04));
      const b = (i) => gp.buttons[i]?.pressed;
      if (b(7)) primary = true;
      this.edge(gp, 0, 'jump'); this.edge(gp, 6, 'secondary'); this.edge(gp, 1, 'utility'); this.edge(gp, 3, 'special'); this.edge(gp, 2, 'interact'); this.edge(gp, 5, 'equipment');
      if (b(10) && !this._gpSprint) this.sprintToggle = !this.sprintToggle;
      this._gpSprint = b(10);
    }
    // Touch: thumbstick, drag-to-look and round buttons.
    let touchSprint = false;
    if (this.touch?.enabled) {
      const t = this.touch.take();
      mx += t.mx; mz += t.mz;
      this.yaw -= t.look.dx * 0.0062; this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - t.look.dy * 0.0055));
      if (t.held.primary) primary = true;
      for (const k of ['jump', 'secondary', 'utility', 'special', 'equipment', 'interact']) if (t.latched[k]) this.latched[k] = true;
      touchSprint = t.sprint;
    }
    // Sprint: hold Shift, or toggle; stopping cancels the toggle.
    if (mz <= 0.1) this.sprintToggle = false;
    const out = {
      moveX: Math.max(-1, Math.min(1, mx)), moveZ: Math.max(-1, Math.min(1, mz)), yaw: this.yaw, pitch: this.pitch,
      sprint: this.sprintToggle || this.down('sprint') || touchSprint, jumpPressed: !!this.latched.jump, primary,
      secondary: !!this.latched.secondary || this.mouse.right, utility: !!this.latched.utility, special: !!this.latched.special,
      equipment: !!this.latched.equipment, interact: !!this.latched.interact,
    };
    this.latched = {};
    return out;
  }

  edge(gp, i, action) {
    this._gp = this._gp || {};
    const p = gp.buttons[i]?.pressed;
    if (p && !this._gp[i]) this.latched[action] = true;
    this._gp[i] = p;
  }

  dispose() {
    removeEventListener('keydown', this.onKey);
    removeEventListener('keyup', this.onKey);
    removeEventListener('mousemove', this.onMouseMove);
    removeEventListener('mouseup', this.onMouse);
  }
}
