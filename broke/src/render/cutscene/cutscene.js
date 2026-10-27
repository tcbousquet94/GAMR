// Cutscenes: a list of shots played over the live city. Each shot has a length, a camera move, and optionally a
// subtitle, a title card, a newspaper, night, slow motion and a handheld shake; sound cues fire at set times. A cast
// of puppets (instanced people from the shared person generator) is posed every frame by the scene's own functions,
// written against "story time", which runs slower than real time in slow-motion shots. The camera drives
// view.camOverride; the overlay (letterbox bars, subtitles, cards, fades, a Skip button) is plain DOM. Reads the game,
// never writes it. See inauguration.js for a scene.

import * as THREE from 'three';
import { RigType, rootMatrix } from '../rig.js';
import { loModel } from '../people/lo.js';
import { personMaterial } from '../kit/people.js';
import { humanPose } from '../models/humanoid.js';

const ease = (t) => t * t * (3 - 2 * t);
const lerpV = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });

const CSS = `
#cutscene{position:fixed;inset:0;z-index:30;pointer-events:none;font-family:'Cormorant Garamond',Georgia,serif;color:#f2ece0}
#cutscene .cs-bar{position:absolute;left:0;right:0;height:11vh;background:#000}
#cutscene .cs-bar.top{top:0}#cutscene .cs-bar.bot{bottom:0}
#cutscene .cs-fade{position:absolute;inset:0;background:#000;opacity:1}
#cutscene .cs-sub{position:absolute;left:8%;right:8%;bottom:13vh;text-align:center;font-size:clamp(17px,2.6vw,28px);line-height:1.3;text-shadow:0 2px 6px #000,0 0 2px #000;opacity:0;transition:opacity .35s}
#cutscene .cs-sub b{font-variant:small-caps;letter-spacing:.06em;color:#d8c8a8;margin-right:.4em;font-weight:600}
#cutscene .cs-card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;letter-spacing:.32em;text-transform:uppercase;font-size:clamp(16px,2.4vw,26px);opacity:0;transition:opacity .8s}
#cutscene .cs-card small{display:block;margin-top:.8em;letter-spacing:.2em;font-size:.62em;opacity:.7;font-style:italic;text-transform:none}
#cutscene .cs-paper{position:absolute;left:50%;top:50%;width:min(78vw,560px);padding:26px 30px 30px;background:#e9e2cf;color:#1c1a16;box-shadow:0 20px 60px #000;transform:translate(-50%,-50%) rotate(-2.5deg) scale(1);opacity:0;transition:opacity .6s}
#cutscene .cs-paper .mast{font:700 clamp(22px,4vw,40px)/1 'Cormorant Garamond',Georgia,serif;text-align:center;border-bottom:3px double #1c1a16;padding-bottom:8px}
#cutscene .cs-paper .date{display:flex;justify-content:space-between;font:italic 13px Georgia,serif;border-bottom:1px solid #1c1a16;padding:4px 0;margin-bottom:12px}
#cutscene .cs-paper h2{font:800 clamp(24px,4.6vw,46px)/1.02 Georgia,serif;margin:0 0 10px;text-transform:uppercase;letter-spacing:-.01em}
#cutscene .cs-paper p{font:15px/1.4 Georgia,serif;margin:0;columns:2;column-gap:18px;text-align:justify}
#cutscene .cs-skip{position:absolute;right:18px;bottom:calc(11vh + 12px);pointer-events:auto;background:rgba(0,0,0,.45);color:#f2ece0;border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:8px 16px;font:600 15px 'Cormorant Garamond',Georgia,serif;letter-spacing:.08em;cursor:pointer}
`;

export class Cutscene {
  // scene: { shots, cast?: [{ spec, scale?, at(story) -> {x,y,z,yaw,pitch?,roll?,pose?,hidden?} }], cues?: [{ t, fn }] }
  constructor(view, scene, { onDone } = {}) {
    this.view = view;
    this.shots = scene.shots;
    this.cues = (scene.cues || []).slice().sort((a, b) => a.t - b.t);
    this.onDone = onDone;
    this.t = 0; // real seconds since the start
    this.story = 0; // story time: slower in slow-motion shots
    this.i = 0;
    this.shotT = 0;
    this.done = false;
    this.nightWas = view.night || 0;
    // The cast: one instanced rig per person.
    const pm = personMaterial(), m4 = new THREE.Matrix4();
    this.m4 = m4;
    this.cast = (scene.cast || []).map((c) => {
      const rig = new RigType(loModel(c.spec), 1, view.scene, { shadows: true });
      for (const m of rig.meshes) { m.material = pm; m.receiveShadow = true; }
      return { ...c, rig, scale: c.scale ?? Math.max(0.88, Math.min(1.08, (c.spec.height || 1.8) / 1.8)) };
    });
    this.extra = scene.props || []; // plain meshes the scene adds (an open door, a muzzle flash)
    for (const o of this.extra) view.scene.add(o);
    // The player's own figure stays out of the scene while it plays.
    view.actors?.dee?.setVisible(false);
    view.camOverride = () => this.cam;
    this.cam = { pos: { x: 0, y: 10, z: 0 }, target: { x: 0, y: 0, z: -1 } };
    this.buildOverlay();
    this.skipKey = (e) => { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.finish(); } };
    addEventListener('keydown', this.skipKey, true);
    this.update(0);
  }

  buildOverlay() {
    if (!document.getElementById('cs-style')) { const s = document.createElement('style'); s.id = 'cs-style'; s.textContent = CSS; document.head.appendChild(s); }
    const el = (this.el = document.createElement('div'));
    el.id = 'cutscene';
    el.innerHTML = `<div class="cs-bar top"></div><div class="cs-bar bot"></div><div class="cs-sub"></div><div class="cs-paper"></div><div class="cs-card"></div><div class="cs-fade"></div><button class="cs-skip">Skip ›</button>`;
    document.body.appendChild(el);
    this.$ = { sub: el.querySelector('.cs-sub'), card: el.querySelector('.cs-card'), paper: el.querySelector('.cs-paper'), fade: el.querySelector('.cs-fade') };
    el.querySelector('.cs-skip').onclick = () => this.finish();
  }

  get shot() { return this.shots[this.i]; }

  update(dt) {
    if (this.done) return;
    if (this.frozen) dt = 0; // held on a frame (screenshot tests)
    let s = this.shot;
    this.t += dt;
    this.shotT += dt;
    this.story += dt * (s.rate ?? 1);
    while (this.shotT >= s.dur) {
      this.shotT -= s.dur;
      this.i++;
      if (this.i >= this.shots.length) { this.finish(); return; }
      s = this.shot;
    }
    while (this.cues.length && this.cues[0].t <= this.t) this.cues.shift().fn();
    const k = Math.min(1, this.shotT / s.dur);
    // Camera.
    if (s.cam) {
      const c = s.cam(s.ease === false ? k : ease(k), this.story);
      if (s.shake) {
        const a = s.shake, T = this.t;
        c.pos = { x: c.pos.x + Math.sin(T * 13.1) * 0.05 * a + Math.sin(T * 5.3) * 0.08 * a, y: c.pos.y + Math.sin(T * 11.7) * 0.04 * a, z: c.pos.z + Math.sin(T * 7.9) * 0.05 * a };
      }
      this.cam = c;
    }
    this.view.setNight?.(s.night ?? 0);
    // Overlay: fades in and out at the shot's edges, letterbox, subtitle, card, newspaper.
    const fi = s.fadeIn ?? 0, fo = s.fadeOut ?? 0;
    let black = s.black ? 1 : 0;
    if (fi) black = Math.max(black, 1 - this.shotT / fi);
    if (fo) black = Math.max(black, 1 - (s.dur - this.shotT) / fo);
    this.$.fade.style.opacity = Math.max(0, Math.min(1, black)).toFixed(3);
    const sub = typeof s.sub === 'function' ? s.sub(this.shotT) : s.sub;
    this.setHtml('sub', sub || '');
    this.$.sub.style.opacity = sub ? 1 : 0;
    this.setHtml('card', s.card || '');
    this.$.card.style.opacity = s.card ? 1 : 0;
    this.setHtml('paper', s.paper || '');
    this.$.paper.style.opacity = s.paper ? 1 : 0;
    if (s.paper) this.$.paper.style.transform = `translate(-50%,-50%) rotate(${(-2.5 + k * 1.2).toFixed(2)}deg) scale(${(0.92 + k * 0.14).toFixed(3)})`;
    // Cast.
    for (const c of this.cast) {
      c.rig.begin();
      const p = c.at(this.story, s);
      if (p && !p.hidden) {
        rootMatrix(p.x, p.y, p.z, p.yaw ?? 0, c.scale, this.m4, p.roll ?? 0, p.pitch ?? 0);
        c.rig.add(this.m4, p.pose || humanPose({ phase: 0, speed: 0, t: this.story }));
      }
      c.rig.end();
    }
    for (const o of this.extra) o.userData.update?.(this.story, s);
  }

  // Fast-forward to `t` real seconds (screenshot tests); cues on the way are dropped.
  seek(t) { const f = this.frozen; this.frozen = false; this.cues = this.cues.filter((c) => c.t > t); while (!this.done && this.t + 1 / 30 < t) this.update(1 / 30); this.frozen = f; }

  setHtml(k, html) { if (this.$[k].dataset.h !== html) { this.$[k].dataset.h = html; this.$[k].innerHTML = html; } }

  finish() {
    if (this.done) return;
    this.done = true;
    removeEventListener('keydown', this.skipKey, true);
    for (const c of this.cast) for (const m of c.rig.meshes) { this.view.scene?.remove(m); m.geometry.dispose(); }
    for (const o of this.extra) { this.view.scene?.remove(o); o.traverse?.((m) => { m.geometry?.dispose(); m.material?.dispose?.(); }); }
    this.view.actors?.dee?.setVisible(true);
    this.view.camOverride = null;
    this.view.setNight?.(this.nightWas);
    this.el.remove();
    this.onDone?.();
  }
}

export { lerpV, ease };
