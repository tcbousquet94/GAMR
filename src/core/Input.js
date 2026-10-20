// Unified keyboard / mouse / gamepad input. Call endFrame() once per frame after all systems update.

const KEYMAP = {
  Space: 'jump',
  ShiftLeft: 'dodge', ShiftRight: 'dodge',
  KeyJ: 'attack',
  Tab: 'lock', KeyR: 'lock',
  ArrowUp: 'menuUp', ArrowDown: 'menuDown',
  Enter: 'menuConfirm', KeyE: 'menuConfirm',
  Digit1: 'cmd1', Digit2: 'cmd2', Digit3: 'cmd3', Digit4: 'cmd4',
};

// Standard gamepad mapping
const PADMAP = { 0: 'jump', 1: 'dodge', 2: 'attack', 3: 'menuConfirm', 5: 'lock', 12: 'menuUp', 13: 'menuDown' };

const MOUSE_SENS = 0.0025;
const STICK_LOOK_SPEED = 2.6; // rad/s
const DEADZONE = 0.18;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.down = new Set();
    this.justPressed = new Set();
    this.move = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.padPrev = [];
    this.pointerLocked = false;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.justPressed.add('start');
      const a = KEYMAP[e.code];
      if (a) this.press(a);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const a = KEYMAP[e.code];
      if (a) this.down.delete(a);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.down.clear();
    });

    canvas.addEventListener('mousedown', (e) => {
      this.justPressed.add('start');
      if (!this.pointerLocked) {
        canvas.requestPointerLock?.();
        return; // first click only grabs the mouse
      }
      if (e.button === 0) this.press('attack');
      if (e.button === 1) this.press('lock');
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.down.delete('attack');
      if (e.button === 1) this.down.delete('lock');
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.look.dx += e.movementX * MOUSE_SENS;
      this.look.dy += e.movementY * MOUSE_SENS;
    });
    window.addEventListener('wheel', (e) => {
      if (!this.pointerLocked) return;
      this.press(e.deltaY > 0 ? 'menuDown' : 'menuUp');
      this.down.delete('menuDown');
      this.down.delete('menuUp');
    }, { passive: true });
  }

  press(action) {
    if (!this.down.has(action)) this.justPressed.add(action);
    this.down.add(action);
  }

  pressed(action) {
    return this.justPressed.has(action);
  }

  held(action) {
    return this.down.has(action);
  }

  consumeLook() {
    const out = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = 0;
    this.look.dy = 0;
    return out;
  }

  // Poll keyboard axes + gamepad. Called at the start of each frame by main.js.
  update(dt) {
    let x = 0, y = 0;
    if (this.keys.has('KeyW')) y += 1;
    if (this.keys.has('KeyS')) y -= 1;
    if (this.keys.has('KeyD')) x += 1;
    if (this.keys.has('KeyA')) x -= 1;

    const pad = navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
    if (pad) {
      const ax = pad.axes;
      const lx = Math.abs(ax[0]) > DEADZONE ? ax[0] : 0;
      const ly = Math.abs(ax[1]) > DEADZONE ? ax[1] : 0;
      x += lx;
      y -= ly;
      const rx = Math.abs(ax[2] ?? 0) > DEADZONE ? ax[2] : 0;
      const ry = Math.abs(ax[3] ?? 0) > DEADZONE ? ax[3] : 0;
      this.look.dx += rx * STICK_LOOK_SPEED * dt;
      this.look.dy += ry * STICK_LOOK_SPEED * dt;
      pad.buttons.forEach((b, i) => {
        const was = this.padPrev[i];
        const action = PADMAP[i];
        if (b.pressed && !was) {
          this.justPressed.add('start');
          if (action) this.press(action);
        } else if (!b.pressed && was && action) {
          this.down.delete(action);
        }
        this.padPrev[i] = b.pressed;
      });
    }

    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    this.move.x = x;
    this.move.y = y;
  }

  endFrame() {
    this.justPressed.clear();
  }
}
