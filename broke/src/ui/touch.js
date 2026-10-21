// Touch controls (shown on coarse-pointer devices): a thumbstick on the left, drag anywhere on the right half to
// look, and translucent round buttons. Pushing the stick to its edge sprints.

const BUTTONS = [
  { id: 'primary', label: 'Darts', hold: true, cls: 'big' },
  { id: 'jump', label: 'Jump' },
  { id: 'secondary', label: 'Rounds' },
  { id: 'utility', label: 'Salsa' },
  { id: 'special', label: 'Code Blue' },
  { id: 'equipment', label: 'Equip' },
];

export class TouchControls {
  constructor(root, icons, labels = {}) {
    this.root = root;
    this.enabled = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
    this.look = { id: null, x: 0, y: 0, dx: 0, dy: 0 };
    this.held = {};
    this.latched = {};
    if (!this.enabled) return;
    root.innerHTML = `
      <div class="t-stick" id="t-stick"><div class="t-ring"></div><div class="t-knob" id="t-knob"></div><span>Move</span></div>
      <div class="t-buttons">${BUTTONS.map((b) => `<button class="t-btn ${b.cls || ''}" data-id="${b.id}"><img src="${icons[b.id] || ''}" alt=""><span>${labels[b.id] || b.label}</span></button>`).join('')}</div>
      <div class="t-hint" id="t-hint">⟷ Drag to look</div>`;
    root.style.display = 'block';
    const stickEl = root.querySelector('#t-stick');
    this.knob = root.querySelector('#t-knob');
    stickEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stickEl.setPointerCapture(e.pointerId);
      const r = stickEl.getBoundingClientRect();
      this.stick.id = e.pointerId; this.stick.ox = r.left + r.width / 2; this.stick.oy = r.top + r.height / 2;
      this.moveStick(e);
    });
    stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === this.stick.id) this.moveStick(e); });
    const endStick = (e) => { if (e.pointerId === this.stick.id) { this.stick.id = null; this.stick.x = this.stick.y = 0; this.knob.style.transform = ''; } };
    stickEl.addEventListener('pointerup', endStick);
    stickEl.addEventListener('pointercancel', endStick);
    for (const btn of root.querySelectorAll('.t-btn')) {
      const id = btn.dataset.id;
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.setPointerCapture(e.pointerId); this.held[id] = true; this.latched[id] = true; btn.classList.add('down'); });
      const up = () => { this.held[id] = false; btn.classList.remove('down'); };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
    }
    // Look: any touch that starts on the canvas (right of the stick) drags the camera.
    this.onLookDown = (e) => {
      if (e.pointerType === 'mouse' || this.look.id != null) return;
      this.look.id = e.pointerId; this.look.x = e.clientX; this.look.y = e.clientY;
      this.root.querySelector('#t-hint')?.classList.add('gone');
    };
    this.onLookMove = (e) => {
      if (e.pointerId !== this.look.id) return;
      this.look.dx += e.clientX - this.look.x; this.look.dy += e.clientY - this.look.y;
      this.look.x = e.clientX; this.look.y = e.clientY;
    };
    this.onLookUp = (e) => { if (e.pointerId === this.look.id) this.look.id = null; };
  }

  attach(canvas) {
    if (!this.enabled) return;
    canvas.addEventListener('pointerdown', this.onLookDown);
    addEventListener('pointermove', this.onLookMove);
    addEventListener('pointerup', this.onLookUp);
    addEventListener('pointercancel', this.onLookUp);
    canvas.style.touchAction = 'none';
  }

  moveStick(e) {
    const R = 52;
    let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    this.stick.x = dx / R; this.stick.y = -dy / R;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // Consumed once per sim step by Input.
  take() {
    const lat = this.latched;
    this.latched = {};
    const look = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = this.look.dy = 0;
    const mag = Math.hypot(this.stick.x, this.stick.y);
    return { mx: this.stick.x, mz: this.stick.y, sprint: mag > 0.88 && this.stick.y > 0.4, look, held: this.held, latched: lat };
  }

  setVisible(v) { if (this.enabled) this.root.style.display = v ? 'block' : 'none'; }
}
