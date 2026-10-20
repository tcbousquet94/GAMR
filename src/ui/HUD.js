// HUD: Kingdom-Hearts layout, EarthBound style. Pure DOM/CSS/SVG inside #hud.
// Reads game.player / game.party / game.target lazily and touches the DOM only when values change.
import * as THREE from 'three';
import './hud.css';
import { HEROES, PLAYER } from '../core/config.js';

const COMMANDS = [
  { id: 'bash', label: 'Bash', key: '1' },
  { id: 'psi', label: 'PSI', key: '2' },
  { id: 'goods', label: 'Goods', key: '3' },
  { id: 'mom', label: 'Call Mom', key: '4' },
];
const POOL_SIZE = 32;
const DLG_CPS = 42;          // typed characters per second
const DLG_BLIP_EVERY = 4;    // letters per blip
const DLG_MAX_QUEUE = 3;
const HINT_TIME = 12;

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;
const MP_R = 43;
const MP_C = 2 * Math.PI * MP_R;

const css = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

function restartAnim(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth; // reflow so the animation restarts
  node.classList.add(cls);
}

// ---------------------------------------------------------------------------
// Portrait painter (runs once per hero)
// ---------------------------------------------------------------------------
export function paintPortrait(look = {}, size = 160) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.scale(size / 128, size / 128);
  const ink = '#2a1a2e';
  const skin = css(look.skin ?? 0xffd3a8);
  const hair = css(look.hair ?? 0x4a2c1a);
  const shirt = css(look.shirt ?? 0xffd23f);
  const style = look.hairStyle || 'buzz';

  const circle = (x, y, r, fill, stroke = ink, lw = 4) => {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
  };
  const ellipse = (x, y, rx, ry, rot, fill, stroke = ink, lw = 4) => {
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
  };

  // Background disc: soft sky gradient
  g.save();
  g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.clip();
  const bg = g.createRadialGradient(64, 50, 10, 64, 64, 70);
  bg.addColorStop(0, '#fffbe8');
  bg.addColorStop(1, '#a8dcff');
  g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
  // checker sparkle
  g.globalAlpha = 0.18; g.fillStyle = '#ffffff';
  for (let i = 0; i < 8; i++) { g.fillRect(i * 16, 0, 8, 128); }
  g.globalAlpha = 1;

  // Shoulders / shirt
  ellipse(64, 134, 46 * (look.bulk || 1), 34, 0, shirt);
  if (look.stripe != null) {
    g.save(); g.beginPath(); g.ellipse(64, 134, 46 * (look.bulk || 1), 34, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = css(look.stripe); g.fillRect(0, 112, 128, 7);
    g.restore();
    ellipse(64, 134, 46 * (look.bulk || 1), 34, 0, null);
  }

  // Back hair (pigtails)
  if (style === 'pigtails') {
    ellipse(25, 74, 13, 19, 0.35, hair);
    ellipse(103, 74, 13, 19, -0.35, hair);
  }

  // Head + ears
  circle(28, 66, 7, skin);
  circle(100, 66, 7, skin);
  circle(64, 60, 36, skin);

  // Hair / cap
  if (style === 'cap') {
    const cap = css(look.capColor ?? 0xe8423c);
    // tufts at the sides
    ellipse(32, 56, 7, 10, 0.4, hair);
    ellipse(96, 56, 7, 10, -0.4, hair);
    g.beginPath(); g.arc(64, 56, 37, Math.PI * 1.02, Math.PI * 1.98); g.closePath();
    g.fillStyle = cap; g.fill(); g.lineWidth = 4; g.strokeStyle = ink; g.stroke();
    // brim sticking out to the right
    ellipse(82, 51, 30, 8, -0.12, cap);
    // button + shine
    circle(64, 20, 4, cap, ink, 3);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath(); g.ellipse(48, 36, 10, 5, -0.6, 0, Math.PI * 2); g.fill();
  } else if (style === 'pigtails') {
    g.beginPath(); g.arc(64, 58, 37, Math.PI * 1.05, Math.PI * 1.95);
    g.quadraticCurveTo(84, 46, 64, 40); g.quadraticCurveTo(44, 46, 29, 51); g.closePath();
    g.fillStyle = hair; g.fill(); g.lineWidth = 4; g.strokeStyle = ink; g.stroke();
    const bow = css(look.bow ?? 0xff5f9e);
    g.fillStyle = bow; g.lineWidth = 3;
    g.beginPath(); g.moveTo(86, 26); g.lineTo(100, 16); g.lineTo(102, 34); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(86, 26); g.lineTo(76, 12); g.lineTo(70, 30); g.closePath(); g.fill(); g.stroke();
    circle(86, 26, 4.5, bow, ink, 3);
  } else {
    // buzz
    g.beginPath(); g.arc(64, 60, 37, Math.PI * 1.08, Math.PI * 1.92);
    g.quadraticCurveTo(64, 34, 33, 49); g.closePath();
    g.fillStyle = hair; g.fill(); g.lineWidth = 4; g.strokeStyle = ink; g.stroke();
  }
  if (look.accessory === 'headband') {
    g.save(); g.beginPath(); g.arc(64, 60, 36, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#ff4f6a'; g.fillRect(20, 40, 90, 9);
    g.fillStyle = '#ffffff'; g.fillRect(20, 43, 90, 2.5);
    g.restore();
    circle(64, 60, 36, null);
  }

  // Cheeks
  g.fillStyle = 'rgba(255, 110, 130, 0.45)';
  g.beginPath(); g.ellipse(42, 76, 7, 4.5, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(86, 76, 7, 4.5, 0, 0, Math.PI * 2); g.fill();

  // Eyes
  for (const x of [52, 76]) {
    ellipse(x, 66, 4.6, 7, 0, ink, null);
    circle(x + 1.5, 63, 1.8, '#fff', null);
  }
  if (look.accessory === 'glasses') {
    g.lineWidth = 3.5; g.strokeStyle = ink; g.fillStyle = 'rgba(255,255,255,0.25)';
    for (const x of [52, 76]) { g.beginPath(); g.arc(x, 66, 11, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.beginPath(); g.moveTo(63, 65); g.lineTo(65, 65); g.stroke();
  }

  // Smile
  g.lineWidth = 3.5; g.strokeStyle = ink; g.lineCap = 'round';
  g.beginPath(); g.arc(64, 78, 9, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  g.restore();

  // Rim
  circle(64, 64, 62, null, ink, 5);
  return c;
}

function ringSvg(withMp) {
  const v = withMp ? '-62 -62 124 124' : '-60 -60 120 120';
  return `<svg viewBox="${v}">
    <circle class="hh-ring-track" r="${RING_R}" stroke-width="12"/>
    <circle class="hh-ring-bg" r="${RING_R}" stroke-width="7"/>
    <circle class="hh-ring hp" r="${RING_R}" stroke-width="7" transform="rotate(-90)"
      stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="0"/>
    ${withMp ? `<circle class="hh-ring-track" r="${MP_R}" stroke-width="8"/>
    <circle class="hh-ring-bg" r="${MP_R}" stroke-width="4.5"/>
    <circle class="hh-ring mp" r="${MP_R}" stroke-width="4.5" transform="rotate(-90)"
      stroke-dasharray="${MP_C.toFixed(2)}" stroke-dashoffset="0"/>` : ''}
  </svg>`;
}

// Chunky white cursor arrow (original glyph)
const CURSOR_SVG = `<svg viewBox="0 0 30 24" width="30" height="24">
  <path d="M3 4 L20 4 L20 0 L29 12 L20 24 L20 20 L3 20 Z" fill="#fff" stroke="#2a1a2e" stroke-width="3" stroke-linejoin="round"/>
  <path d="M6 8 L18 8" stroke="#ff9ab8" stroke-width="3" stroke-linecap="round"/>
</svg>`;

// ---------------------------------------------------------------------------
export class HUD {
  constructor(game) {
    this.game = game;
    this.events = game.events;
    let root = document.getElementById('hud');
    if (!root) { root = el('div', '', document.body); root.id = 'hud'; }
    this.root = root;
    this.tmp = new THREE.Vector3();
    this.W = window.innerWidth;
    this.H = window.innerHeight;

    this.sel = 0;
    this.prev = Object.create(null); // cached last-written values
    this.hintT = -1;
    this.titleGone = false;

    this.build();
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    this.listen();
  }

  // ---------------------------------------------------------------- build
  build() {
    const r = this.root;
    this.vignette = el('div', 'hh-vignette', r);
    this.reticle = el('div', 'hh-reticle hh-hidden', r,
      '<div class="r1"></div><div class="r2"><i></i><i></i><i></i><i></i></div><div class="r3"></div>');
    this.popLayer = el('div', 'hh-pops', r);

    // Lock-on (top-left)
    const tl = el('div', 'hh-corner hh-tl', r);
    this.lock = el('div', 'hh-lock', tl,
      '<div class="badge"><span>LOCK ON!</span></div><div class="tn"></div>' +
      '<div class="ebar"><i class="chip"></i><i class="fill"></i></div>');
    this.lockName = this.lock.querySelector('.tn');
    this.lockBar = this.lock.querySelector('.ebar');
    this.lockFill = this.lock.querySelector('.fill');
    this.lockChip = this.lock.querySelector('.chip');
    this.chip = 1;
    this.chipDelay = 0;

    // Party (top-right)
    const tr = el('div', 'hh-corner hh-tr', r);
    const party = el('div', 'hh-party', tr);
    this.partyEls = ['dot', 'moose'].map((id) => {
      const box = el('div', 'hh-pm', party);
      const port = el('div', 'hh-port', box, ringSvg(false));
      port.appendChild(paintPortrait(HEROES[id]?.look, 116));
      el('div', 'zzz', port, 'z<small>z</small>z');
      el('div', 'eb', port, '<div class="hh-blush"><i></i></div>');
      const nm = el('div', 'nm', box, HEROES[id]?.name || id);
      const hpn = el('div', 'hpn', box, '');
      return { id, box, port, ring: port.querySelector('.hp'), nm, hpn, disp: -1 };
    });

    // Command menu (bottom-left)
    const bl = el('div', 'hh-corner hh-bl', r);
    const cmd = el('div', 'hh-cmd', bl);
    this.cmdHead = el('div', 'hh-cmd-head', cmd, '<span>Pip</span>').firstChild;
    this.rows = COMMANDS.map((c, i) => {
      const row = el('div', 'hh-cmd-row' + (i === 0 ? ' sel' : ''), cmd);
      const cd = el('div', 'cd', row);
      const inner = el('div', 'in', row);
      el('div', 'cur', inner, CURSOR_SVG);
      el('span', 'key', inner, c.key);
      el('span', 'lbl', inner, c.label);
      const info = el('span', 'info', inner, '');
      return { ...c, row, info, cd };
    });
    el('div', 'hh-cmd-foot', cmd, '1-4 quick · ↑↓/wheel select · E use');

    // Player status (bottom-right)
    const br = el('div', 'hh-corner hh-br', r);
    const me = el('div', 'hh-me', br);
    const stats = el('div', 'hh-me-stats hh-eb', me,
      '<div class="hh-stat hpline"><b>HP</b><span class="v">0</span><span class="mx">/0</span></div>' +
      '<div class="hh-me-bar hp"><i></i></div>' +
      '<div class="hh-stat mpline"><b>MP</b><span class="v">0</span><span class="mx">/0</span></div>' +
      '<div class="hh-me-bar mp"><i></i></div>');
    const [hpLine, mpLine] = stats.querySelectorAll('.hh-stat');
    this.hpLine = hpLine;
    this.hpV = hpLine.querySelector('.v');
    this.hpMx = hpLine.querySelector('.mx');
    this.mpV = mpLine.querySelector('.v');
    this.mpMx = mpLine.querySelector('.mx');
    this.hpBar = stats.querySelector('.hh-me-bar.hp i');
    this.mpBar = stats.querySelector('.hh-me-bar.mp i');
    this.mePort = el('div', 'hh-port hh-me-port', me, ringSvg(true));
    this.mePort.appendChild(paintPortrait(HEROES.pip?.look, 164));
    this.meName = el('div', 'nm', this.mePort, HEROES.pip?.name || 'Pip');
    this.hpRing = this.mePort.querySelector('.hp');
    this.mpRing = this.mePort.querySelector('.mp');
    this.emb = el('div', 'hh-emb hh-hidden', br,
      '<div class="hh-blush"><i></i></div><span>Embarrassed</span><span class="t"></span>');
    this.embT = this.emb.querySelector('.t');
    this.dispHp = -1;
    this.dispMp = -1;

    // Popups pool
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push({
        el: el('div', 'hh-pp', this.popLayer), active: false, t: 0, life: 0.9,
        pos: new THREE.Vector3(), world: false, ox: 0, oy: 0, rise: 70, cls: '',
      });
    }
    this.poolNext = 0;
    this.activePops = 0;

    // Dialogue
    this.dlg = el('div', 'hh-dlg', r,
      '<div class="win hh-eb"><div class="spk hh-eb hh-hidden"><i class="hh-phone hh-hidden"></i><span></span></div>' +
      '<div class="txt"></div><div class="more"></div></div>');
    this.dlgSpk = this.dlg.querySelector('.spk');
    this.dlgSpkName = this.dlgSpk.querySelector('span');
    this.dlgPhone = this.dlgSpk.querySelector('.hh-phone');
    this.dlgTxt = this.dlg.querySelector('.txt');
    this.dlgQueue = [];
    this.dlgCur = null;

    // Wave banner
    this.wave = el('div', 'hh-wave', r, '<div class="bar"><small></small><span></span></div>');
    this.waveText = this.wave.querySelector('span');
    this.waveSmall = this.wave.querySelector('small');
    this.waveT = 0;

    // Player down
    this.down = el('div', 'hh-down hh-hidden', r,
      '<div class="t"></div><div class="s">Mom is probably on her way. Probably.</div>');
    this.downText = this.down.querySelector('.t');
    this.downT = 0;

    // Controls hint
    this.hint = el('div', 'hh-hint hh-hidden', r,
      'WASD move · Mouse look · Click/J Bash · Space jump · Shift dodge · Tab/R lock-on · ↑↓/wheel + E menu · 1-4 commands · M mute');

    // Title
    this.root.classList.add('hh-pre');
    this.title = el('div', 'hh-title', r);
    el('div', 'bg', this.title);
    const logo = el('div', 'hh-logo', this.title);
    let d = 0;
    for (const [w, cls] of [['HALLWAY', 'w w1'], ['HEROES', 'w w2']]) {
      const row = el('div', cls, logo);
      for (const ch of w) {
        const s = el('span', '', row, ch);
        s.style.animationDelay = `${(d++ * 0.08).toFixed(2)}s`;
      }
    }
    el('div', 'hh-sub', this.title, 'Episode 1: The Courtyard Incident');
    el('div', 'hh-tag', this.title,
      'Armed with a baseball bat, a permission slip, and Mom on speed dial. Homework is due Monday.');
    const ctrls = el('div', 'hh-ctrls hh-eb', this.title);
    ctrls.innerHTML = '<ul>' + [
      ['WASD', 'Move'], ['Mouse', 'Look around'], ['Click / J', 'Bash'], ['Space', 'Jump'],
      ['Shift', 'Dodge roll'], ['Tab / R / MMB', 'Lock-on'], ['↑↓ / Wheel + E', 'Command menu'],
      ['1-4', 'Quick commands'], ['M', 'Mute'],
    ].map(([k, v]) => `<li><kbd>${k}</kbd>${v}</li>`).join('') + '</ul>';
    el('div', 'hh-press', this.title, 'Press any key or click to start');
  }

  onResize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    const s = Math.max(0.5, Math.min(1.2, Math.min(this.W / 1280, this.H / 720) * 1.0));
    // keep the HUD a bit larger on small screens than linear scaling would give
    const ui = Math.max(0.5, Math.min(1.2, Math.pow(s, 0.75)));
    this.root.style.setProperty('--ui-scale', ui.toFixed(3));
  }

  // ---------------------------------------------------------------- events
  listen() {
    const ev = this.events;
    if (!ev) return;
    ev.on('damage', (p) => this.onDamage(p));
    ev.on('heal', (p) => this.onHeal(p));
    ev.on('popup', (p) => this.popup(p?.text, p?.position ?? null, p?.style || 'info'));
    ev.on('dialogue', (p) => this.queueDialogue(p));
    ev.on('command', (p) => this.flashCommand(p?.name));
    ev.on('wave', (p) => this.showWave(p));
    ev.on('player:down', () => this.setDown(true));
    ev.on('player:up', () => this.setDown(false));
    ev.on('game:start', () => this.hideTitle());
    ev.on('lock', (p) => { if (p?.target) restartAnim(this.lock, 'pulse'); });
  }

  anchorOf(target, k = 1) {
    const o = target?.object3d;
    if (!o) return null;
    const v = this.tmp;
    o.getWorldPosition ? o.getWorldPosition(v) : v.copy(o.position);
    v.y += (target.height ?? 1.6) * k;
    return v;
  }

  onDamage(p) {
    const t = p?.target;
    if (!t) return;
    const pos = this.anchorOf(t, 1.05);
    const hero = t.team === 'hero';
    const amt = Math.round(p.amount ?? 0);
    const jx = (Math.random() - 0.5) * 34;
    if (amt > 0) {
      const cls = p.crit ? 'big' : hero ? 'hurt' : 'hit';
      this.popup(String(amt), pos, cls, jx, 0);
    }
    if (p.text) {
      this.popup(p.text, pos, p.crit ? 'word big' : 'word', jx * 0.5, amt > 0 ? -34 : 0);
    }
    if (t === this.game.player) restartAnim(this.mePort, 'hurt');
    else {
      const pm = this.partyEls.find((e) => this.partyMember(e.id) === t);
      if (pm) restartAnim(pm.port, 'hurt');
    }
  }

  onHeal(p) {
    const t = p?.target;
    if (!t) return;
    const pos = this.anchorOf(t, 1.05);
    const amt = Math.round(p.amount ?? 0);
    if (amt > 0) this.popup('+' + amt, pos, 'heal');
    if (p.text) this.popup(p.text, pos, 'heal word', 0, amt > 0 ? -32 : 0);
  }

  // ---------------------------------------------------------------- popups
  popup(text, position, style = 'info', ox = 0, oy = 0) {
    if (text == null || text === '') return;
    // find a free slot, else recycle the oldest (round robin)
    let p = null;
    for (let i = 0; i < POOL_SIZE; i++) {
      const c = this.pool[(this.poolNext + i) % POOL_SIZE];
      if (!c.active) { p = c; this.poolNext = (this.poolNext + i + 1) % POOL_SIZE; break; }
    }
    if (!p) { p = this.pool[this.poolNext]; this.poolNext = (this.poolNext + 1) % POOL_SIZE; this.activePops--; }
    const isWorld = !!(position && position.isVector3 !== false && typeof position.x === 'number');
    p.world = isWorld;
    if (isWorld) p.pos.set(position.x, position.y, position.z);
    const big = /\bbig\b/.test(style);
    p.life = big ? 1.15 : style.includes('status') || style.includes('info') ? 1.3 : 0.9;
    if (!isWorld) {
      // center of screen, stack downward if several
      let n = 0;
      for (const q of this.pool) if (q.active && !q.world) n++;
      p.life += 0.6;
      oy += (n % 4) * 52;
    }
    p.t = 0;
    p.ox = ox;
    p.oy = oy;
    p.rise = isWorld ? (big ? 80 : 64) : 36;
    p.active = true;
    this.activePops++;
    const cls = 'hh-pp ' + style + (isWorld ? '' : ' center');
    if (p.cls !== cls) { p.el.className = cls; p.cls = cls; }
    p.el.textContent = text;
    p.el.style.display = 'block';
    p.el.style.opacity = '0';
  }

  updatePopups(dt) {
    if (this.activePops <= 0) return;
    const cam = this.game.camera;
    const v = this.tmp;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) {
        p.active = false;
        this.activePops--;
        p.el.style.display = 'none';
        continue;
      }
      let x, y;
      if (p.world) {
        if (!cam || !this.project(p.pos, v)) { p.el.style.opacity = '0'; continue; }
        x = v.x; y = v.y;
      } else {
        x = this.W * 0.5; y = this.H * 0.36;
      }
      const ease = 1 - (1 - k) * (1 - k);
      x += p.ox;
      y += p.oy - p.rise * ease;
      // pop-in: overshoot then settle
      const s = p.t < 0.08 ? 0.5 + (p.t / 0.08) * 0.85 : p.t < 0.18 ? 1.35 - ((p.t - 0.08) / 0.1) * 0.35 : 1;
      const o = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
      p.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%) scale(${s.toFixed(3)})`;
      p.el.style.opacity = o.toFixed(3);
    }
  }

  // world -> screen px into `out`; false if behind camera / off-screen
  project(pos, out, margin = 0.15) {
    const cam = this.game.camera;
    out.copy(pos).applyMatrix4(cam.matrixWorldInverse);
    if (out.z > -0.1) return false;
    out.applyMatrix4(cam.projectionMatrix);
    if (out.x < -1 - margin || out.x > 1 + margin || out.y < -1 - margin || out.y > 1 + margin) return false;
    out.x = (out.x * 0.5 + 0.5) * this.W;
    out.y = (-out.y * 0.5 + 0.5) * this.H;
    return true;
  }

  // ---------------------------------------------------------------- dialogue
  queueDialogue(p) {
    if (!p?.text) return;
    this.dlgQueue.push({ speaker: p.speaker || '', text: String(p.text), duration: p.duration ?? 3.5 });
    while (this.dlgQueue.length > DLG_MAX_QUEUE) this.dlgQueue.shift();
    if (!this.dlgCur) this.nextDialogue();
  }

  nextDialogue() {
    const m = this.dlgQueue.shift();
    this.dlgCur = m || null;
    if (!m) { this.dlg.classList.remove('on', 'done'); return; }
    m.shown = 0; m.acc = 0; m.hold = 0; m.blip = 0;
    const spk = m.speaker;
    this.dlgSpk.classList.toggle('hh-hidden', !spk);
    this.dlgSpkName.textContent = spk;
    this.dlgPhone.classList.toggle('hh-hidden', !/^mom\b/i.test(spk));
    this.dlgTxt.textContent = '';
    this.dlg.classList.remove('done');
    this.dlg.classList.add('on');
  }

  updateDialogue(dt) {
    const m = this.dlgCur;
    if (!m) return;
    if (m.shown < m.text.length) {
      // type faster when more messages are waiting
      m.acc += dt * DLG_CPS * (this.dlgQueue.length ? 1.6 : 1);
      let n = m.shown;
      while (m.acc >= 1 && n < m.text.length) {
        m.acc -= 1;
        const ch = m.text[n++];
        if (ch !== ' ' && ++m.blip % DLG_BLIP_EVERY === 0) this.events.emit('sfx', { name: 'menu', volume: 0.3, blip: true });
      }
      if (n !== m.shown) {
        m.shown = n;
        this.dlgTxt.textContent = m.text.slice(0, n);
        if (n >= m.text.length) this.dlg.classList.add('done');
      }
    } else {
      m.hold += dt;
      const hold = this.dlgQueue.length ? Math.min(m.duration, 1.6) : m.duration;
      if (m.hold >= hold) this.nextDialogue();
    }
  }

  // ---------------------------------------------------------------- banners
  showWave(p) {
    const idx = p?.index ?? 1;
    const title = p?.title ? String(p.title).toUpperCase() : '';
    const label = /^wave/i.test(title) ? title : `WAVE ${idx}${title ? ': ' + title : ''}`;
    this.waveText.textContent = label;
    this.waveSmall.textContent = '★ GET READY ★';
    this.wave.classList.remove('on');
    void this.wave.offsetWidth;
    this.wave.classList.add('on');
    this.waveT = 3.3;
  }

  setDown(on) {
    const name = this.game.player?.name || 'Pip';
    if (on) {
      this.downText.textContent = `${name} fainted... respawning`;
      this.down.classList.remove('hh-hidden');
      void this.down.offsetWidth;
      this.down.classList.add('on');
      this.downT = 0;
    } else {
      this.down.classList.remove('on');
      this.downT = 0.6; // fade-out timer, then hide
    }
  }

  hideTitle() {
    if (this.titleGone) return;
    this.titleGone = true;
    this.root.classList.remove('hh-pre');
    this.title.classList.add('out');
    setTimeout(() => this.title.classList.add('hh-hidden'), 650);
    this.hint.classList.remove('hh-hidden');
    this.hintT = HINT_TIME;
  }

  // ---------------------------------------------------------------- commands
  flashCommand(name) {
    const r = this.rows.find((x) => x.id === name);
    if (r) restartAnim(r.row, 'flash');
  }

  setSel(i) {
    if (i === this.sel) return;
    this.rows[this.sel].row.classList.remove('sel');
    this.sel = i;
    this.rows[i].row.classList.add('sel');
  }

  updateMenu() {
    const g = this.game;
    const input = g.input;
    if (input && g.started) {
      const n = this.rows.length;
      if (input.pressed('menuUp')) { this.setSel((this.sel + n - 1) % n); this.events.emit('sfx', { name: 'menu' }); }
      if (input.pressed('menuDown')) { this.setSel((this.sel + 1) % n); this.events.emit('sfx', { name: 'menu' }); }
      if (input.pressed('menuConfirm')) {
        this.events.emit('sfx', { name: 'select' });
        this.events.emit('command', { name: this.rows[this.sel].id });
      }
      for (let i = 0; i < 4; i++) {
        if (input.pressed('cmd' + (i + 1))) {
          this.setSel(i);
          this.events.emit('sfx', { name: 'select' });
          this.events.emit('command', { name: this.rows[i].id });
        }
      }
      if (input.pressed('attack')) this.flashCommand('bash');
    }

    const pl = g.player;
    const name = pl?.name || HEROES.pip?.name || 'Pip';
    this.setText('cmdHead', this.cmdHead, name);

    // PSI
    const cost = pl?.psiCost ?? PLAYER.psi?.cost ?? 8;
    const mp = pl?.mp ?? 0;
    const psiOff = mp < cost;
    this.setText('psiInfo', this.rows[1].info, `${cost} MP`);
    this.setClass('psiOff', this.rows[1].row, 'off', psiOff);
    this.setClass('psiMp', this.rows[1].info, 'mp', true);
    // Goods
    const goods = pl?.goods ?? PLAYER.goods?.count ?? 0;
    this.setText('goodsInfo', this.rows[2].info, `x${goods}`);
    this.setClass('goodsOff', this.rows[2].row, 'off', goods <= 0);
    // Mom
    const cd = Math.max(0, pl?.momCooldown ?? 0);
    const cdMax = pl?.momCooldownMax ?? PLAYER.mom?.cooldown ?? 45;
    const momTxt = cd > 0 ? `${Math.ceil(cd)}s` : '♥';
    this.setText('momInfo', this.rows[3].info, momTxt);
    this.setClass('momReady', this.rows[3].info, 'ready', cd <= 0);
    this.setClass('momOff', this.rows[3].row, 'off', cd > 0);
    const frac = cd > 0 ? Math.min(1, cd / cdMax) : 0;
    this.setStyle('momCd', this.rows[3].cd, 'transform', `scaleX(${frac.toFixed(3)})`);
  }

  // ---------------------------------------------------------------- DOM cache helpers
  setText(key, node, v) {
    if (this.prev[key] === v) return;
    this.prev[key] = v;
    node.textContent = v;
  }
  setClass(key, node, cls, on) {
    if (this.prev[key] === on) return;
    this.prev[key] = on;
    node.classList.toggle(cls, on);
  }
  setStyle(key, node, prop, v) {
    if (this.prev[key] === v) return;
    this.prev[key] = v;
    node.style[prop] = v;
  }
  setAttr(key, node, attr, v) {
    if (this.prev[key] === v) return;
    this.prev[key] = v;
    node.setAttribute(attr, v);
  }

  partyMember(id) {
    const party = this.game.party;
    if (!party) return null;
    for (const m of party) if (m && (m.heroId === id || m.name?.toLowerCase() === id)) return m;
    return null;
  }

  // ---------------------------------------------------------------- per-frame
  updatePlayer(dt) {
    const pl = this.game.player;
    const maxHp = pl?.maxHp ?? PLAYER.maxHp;
    const hp = Math.max(0, pl?.hp ?? maxHp);
    const maxMp = pl?.maxMp ?? PLAYER.maxMp;
    const mp = Math.max(0, pl?.mp ?? maxMp);
    // smooth the ring
    this.dispHp = this.dispHp < 0 ? hp : this.dispHp + (hp - this.dispHp) * Math.min(1, dt * 12);
    this.dispMp = this.dispMp < 0 ? mp : this.dispMp + (mp - this.dispMp) * Math.min(1, dt * 12);
    const hf = maxHp > 0 ? Math.min(1, this.dispHp / maxHp) : 0;
    const mf = maxMp > 0 ? Math.min(1, this.dispMp / maxMp) : 0;
    this.setAttr('hpRing', this.hpRing, 'stroke-dashoffset', (RING_C * (1 - hf)).toFixed(1));
    this.setAttr('mpRing', this.mpRing, 'stroke-dashoffset', (MP_C * (1 - mf)).toFixed(1));
    this.setStyle('hpBar', this.hpBar, 'transform', `scaleX(${hf.toFixed(3)})`);
    this.setStyle('mpBar', this.mpBar, 'transform', `scaleX(${mf.toFixed(3)})`);
    this.setText('hpV', this.hpV, String(Math.ceil(hp)));
    this.setText('hpMx', this.hpMx, '/' + Math.round(maxHp));
    this.setText('mpV', this.mpV, String(Math.floor(mp)));
    this.setText('mpMx', this.mpMx, '/' + Math.round(maxMp));
    const rf = maxHp > 0 ? hp / maxHp : 0;
    const crit = rf <= 0.25, low = !crit && rf <= 0.5;
    this.setClass('meLow', this.mePort, 'low', low);
    this.setClass('meCrit', this.mePort, 'crit', crit);
    this.setClass('hpLow', this.hpLine, 'low', low);
    this.setClass('hpCrit', this.hpLine, 'crit', crit && hp > 0);
    this.setClass('meKo', this.mePort, 'ko', pl ? pl.alive === false : false);
    this.setText('meName', this.meName, pl?.name || 'Pip');

    // Embarrassed
    const st = pl?.status;
    const emb = !!st?.has?.('embarrassed');
    this.setClass('emb', this.emb, 'hh-hidden', !emb);
    this.setClass('vig', this.vignette, 'on', emb);
    if (emb) {
      const left = st.list?.get?.('embarrassed');
      this.setText('embT', this.embT, left != null ? `${Math.max(0, left).toFixed(1)}s` : '');
    }
  }

  updateParty() {
    for (const e of this.partyEls) {
      const m = this.partyMember(e.id);
      const maxHp = m?.maxHp ?? 100;
      const hp = Math.max(0, m?.hp ?? maxHp);
      const f = maxHp > 0 ? Math.min(1, hp / maxHp) : 0;
      const k = 'pm' + e.id;
      this.setAttr(k + 'ring', e.ring, 'stroke-dashoffset', (RING_C * (1 - f)).toFixed(1));
      this.setClass(k + 'down', e.box, 'down', m ? m.alive === false : false);
      this.setClass(k + 'low', e.port, 'low', f <= 0.5 && f > 0.25);
      this.setClass(k + 'crit', e.port, 'crit', f <= 0.25);
      this.setClass(k + 'emb', e.box, 'emb', !!m?.status?.has?.('embarrassed'));
      this.setText(k + 'hp', e.hpn, m ? `${Math.ceil(hp)}/${Math.round(maxHp)}` : '');
      if (m?.name) this.setText(k + 'nm', e.nm, m.name);
    }
  }

  updateLock(dt) {
    const g = this.game;
    const t = g.target && g.target.alive !== false ? g.target : null;
    this.setClass('lockOn', this.lock, 'on', !!t);
    if (t !== this.lockTarget) {
      this.lockTarget = t;
      if (t) {
        this.chip = Math.min(1, (t.hp ?? 1) / (t.maxHp || 1));
        this.chipDelay = 0;
      }
    }
    if (t) {
      this.setText('lockName', this.lockName, t.name || '???');
      const f = Math.max(0, Math.min(1, (t.hp ?? 0) / (t.maxHp || 1)));
      if (f < this.chip) {
        if (this.prev.lockF !== undefined && f < this.prev.lockF) this.chipDelay = 0.45;
        this.chipDelay -= dt;
        if (this.chipDelay <= 0) this.chip = Math.max(f, this.chip - dt * 0.7);
      } else this.chip = f;
      this.prev.lockF = f;
      this.setStyle('lockFill', this.lockFill, 'transform', `scaleX(${f.toFixed(3)})`);
      this.setStyle('lockChip', this.lockChip, 'transform', `scaleX(${this.chip.toFixed(3)})`);
      this.setClass('lockLow', this.lockBar, 'low', f <= 0.5 && f > 0.25);
      this.setClass('lockCrit', this.lockBar, 'crit', f <= 0.25);
    }

    // reticle
    let show = false;
    if (t && g.camera && t.object3d) {
      const v = this.tmp;
      t.object3d.getWorldPosition ? t.object3d.getWorldPosition(v) : v.copy(t.object3d.position);
      v.y += (t.height ?? 1.6) * 0.6;
      if (this.project(v, v, 0)) {
        show = true;
        this.reticle.style.transform = `translate3d(${v.x.toFixed(1)}px,${v.y.toFixed(1)}px,0)`;
      }
    }
    this.setClass('ret', this.reticle, 'hh-hidden', !show);
  }

  update(rawDt = 0.016) {
    const dt = Math.min(rawDt || 0, 0.1);
    const g = this.game;
    if (g.started && !this.titleGone) this.hideTitle();
    g.camera?.updateMatrixWorld?.();

    this.updateMenu();
    this.updatePlayer(dt);
    this.updateParty();
    this.updateLock(dt);
    this.updatePopups(dt);
    this.updateDialogue(dt);

    if (this.waveT > 0) {
      this.waveT -= dt;
      if (this.waveT <= 0) this.wave.classList.remove('on');
    }
    if (this.downT > 0 && !this.down.classList.contains('on')) {
      this.downT -= dt;
      if (this.downT <= 0) this.down.classList.add('hh-hidden');
    }
    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0) {
        this.hint.classList.add('fade');
        setTimeout(() => this.hint.classList.add('hh-hidden'), 1300);
      }
    }
  }
}
