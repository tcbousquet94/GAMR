// All sound is synthesized: city ambience (traffic rumble, passing cars, distant sirens, steam), a music track
// that adds layers with each difficulty tier, and a punchy sound for every hit, ability, pickup, purchase and bark.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.musicOn = true;
    this.intensity = 0;
    this.started = false;
  }

  // Must be called from a user gesture.
  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.32; this.musicBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.5; this.ambBus.connect(this.master);
    // Shared noise buffer.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Simple reverb (feedback delay) for space.
    this.verb = ctx.createDelay(1); this.verb.delayTime.value = 0.13;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const vf = ctx.createBiquadFilter(); vf.type = 'lowpass'; vf.frequency.value = 2400;
    this.verb.connect(vf).connect(fb).connect(this.verb);
    const vout = ctx.createGain(); vout.gain.value = 0.35;
    vf.connect(vout).connect(this.master);
    this.startAmbience();
    this.nextBeat = ctx.currentTime + 0.1;
    this.step = 0;
    this.started = true;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  // ---------- primitives ----------
  env(g, t, a, d, peak = 1) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  osc(type, f, t, dur, peak, dest = this.sfxBus, f2 = null, verb = false) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    this.env(g, t, 0.004, dur, peak);
    o.connect(g).connect(dest);
    if (verb) g.connect(this.verb);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  noiseHit(t, dur, peak, type, freq, q = 1, dest = this.sfxBus, f2 = null) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    this.env(g, t, 0.003, dur, peak);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // ---------- sfx ----------
  play(name, p = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const r = (a, b) => a + Math.random() * (b - a);
    switch (name) {
      // Revolver: a sharp crack, a low body thump and a short tail that rings off the street.
      case 'revolver': this.noiseHit(t, 0.05, 0.9, 'highpass', 900); this.noiseHit(t, 0.32, 0.55, 'lowpass', 2600, 0.8, undefined, 250); this.osc('sine', 120, t, 0.16, 0.6, undefined, 45); this.noiseHit(t + 0.06, 0.5, 0.08, 'bandpass', 700, 0.6, undefined, 300); break;
      // Someone else's gun down the street: the same crack, quieter and duller.
      case 'gunshot': this.noiseHit(t, 0.05, 0.35, 'highpass', 700); this.noiseHit(t, 0.3, 0.3, 'lowpass', 1600, 0.8, undefined, 220); this.osc('sine', 110, t, 0.14, 0.25, undefined, 45); break;
      case 'dryFire': this.noiseHit(t, 0.025, 0.25, 'highpass', 5000); break;
      case 'reloadRound': this.noiseHit(t, 0.03, 0.2, 'bandpass', r(2800, 3400), 4); this.osc('triangle', r(1900, 2200), t, 0.03, 0.04); break;
      case 'reloadStart': this.noiseHit(t, 0.06, 0.18, 'bandpass', 1500, 3); break;
      case 'reloadDone': this.noiseHit(t, 0.04, 0.25, 'bandpass', 1200, 3); this.noiseHit(t + 0.08, 0.05, 0.25, 'highpass', 2500); break;
      case 'headshot': this.osc('triangle', 1700, t, 0.05, 0.12, undefined, 2400); this.noiseHit(t, 0.06, 0.3, 'highpass', 3000); break;
      case 'dart': this.noiseHit(t, 0.06, 0.18, 'bandpass', r(3500, 4500), 2); this.osc('triangle', 1800, t, 0.05, 0.05, undefined, 900); break;
      case 'hit': this.noiseHit(t, 0.05, 0.3, 'highpass', 1800); this.osc('square', p.crit ? 900 : r(380, 460), t, 0.07, p.crit ? 0.16 : 0.1, undefined, p.crit ? 1400 : 200); break;
      case 'kill': this.osc('sine', 140, t, 0.22, 0.45, undefined, 50); this.noiseHit(t, 0.14, 0.25, 'lowpass', 900); break;
      case 'clipboard': this.noiseHit(t, 0.25, 0.25, 'bandpass', 900, 1.2, undefined, 2400); break;
      case 'bounce': this.osc('triangle', NOTE(76 + Math.min(10, p.n * 2)), t, 0.18, 0.22, undefined, null, true); break;
      case 'salsa': this.noiseHit(t, 0.3, 0.3, 'bandpass', 600, 1, undefined, 3000); for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.07, 0.04, 0.14, 'highpass', 6000); break;
      case 'codeblue': this.osc('square', 988, t, 0.12, 0.14); this.osc('square', 988, t + 0.18, 0.12, 0.14); this.noiseHit(t + 0.35, 2.0, 0.12, 'highpass', 3000); break;
      case 'syringe': this.noiseHit(t, 0.05, 0.08, 'highpass', 4000); break;
      case 'jump': this.osc('sine', 260, t, 0.1, 0.08, undefined, 420); break;
      case 'airjump': this.osc('sine', 380, t, 0.12, 0.08, undefined, 640); this.noiseHit(t, 0.1, 0.06, 'highpass', 3000); break;
      case 'climb': this.osc('square', r(180, 240), t, 0.03, 0.05); break;
      case 'mantle': this.noiseHit(t, 0.08, 0.1, 'lowpass', 700); break;
      case 'coin': { const n = 84 + Math.min(12, p.combo || 0); this.osc('triangle', NOTE(n), t, 0.09, 0.12); this.osc('triangle', NOTE(n + 7), t + 0.05, 0.12, 0.1, undefined, null, true); break; }
      case 'purchase': this.noiseHit(t, 0.06, 0.3, 'highpass', 2500); this.osc('triangle', NOTE(88), t + 0.05, 0.3, 0.2, undefined, null, true); this.osc('triangle', NOTE(93), t + 0.12, 0.4, 0.2, undefined, null, true); break;
      case 'nope': this.osc('sawtooth', 140, t, 0.18, 0.12); this.osc('sawtooth', 132, t + 0.1, 0.2, 0.1); break;
      case 'item': for (let i = 0; i < 4; i++) this.osc('sine', NOTE(79 + i * 4), t + i * 0.06, 0.25, 0.1, undefined, null, true); break;
      case 'airhorn': for (const f of [233, 294, 349]) this.osc('sawtooth', f, t, 0.9, 0.18, undefined, f * 0.98); break;
      case 'cart': for (let i = 0; i < 40; i++) this.noiseHit(t + i * 0.12, 0.04, 0.08, 'bandpass', r(1500, 3000), 3); break;
      case 'explode': this.osc('sine', 90, t, 0.4, 0.5, undefined, 35); this.noiseHit(t, 0.35, 0.35, 'lowpass', 1600, 1, undefined, 200); break;
      case 'lightning': this.noiseHit(t, 0.15, 0.25, 'bandpass', 5000, 0.5); this.osc('sawtooth', 1200, t, 0.1, 0.06, undefined, 300); break;
      case 'hurt': this.osc('sawtooth', 220, t, 0.16, 0.18, undefined, 110); this.noiseHit(t, 0.1, 0.2, 'lowpass', 800); break;
      case 'blocked': this.osc('triangle', 1200, t, 0.08, 0.12); this.osc('triangle', 1600, t + 0.04, 0.08, 0.1); break;
      case 'phone': for (let i = 0; i < 3; i++) { this.osc('square', 1300, t + i * 0.18, 0.08, 0.1); this.osc('square', 1650, t + i * 0.18 + 0.08, 0.08, 0.1); } break;
      case 'wave': this.osc('sawtooth', 160, t, 0.5, 0.25, undefined, 70); this.noiseHit(t, 0.4, 0.2, 'bandpass', 500, 0.8); break;
      case 'bell': for (let i = 0; i < 2; i++) { this.osc('sine', 2600, t + i * 0.22, 0.4, 0.12, undefined, null, true); this.osc('sine', 3900, t + i * 0.22, 0.25, 0.05); } break;
      case 'crash': this.noiseHit(t, 0.4, 0.4, 'lowpass', 3000, 1, undefined, 300); this.osc('square', 300, t, 0.2, 0.1, undefined, 80); break;
      case 'chirp': this.osc('sine', 700, t, 0.12, 0.12, undefined, 1100); break;
      case 'gavel': this.osc('sine', 70, t, 0.7, 0.8, undefined, 30); this.noiseHit(t, 0.5, 0.5, 'lowpass', 600, 1, undefined, 80); this.osc('square', 180, t, 0.08, 0.25); break;
      case 'notice': this.noiseHit(t, 0.2, 0.1, 'bandpass', 1500, 2, undefined, 600); break;
      case 'drone': this.osc('sawtooth', 110, t, 0.8, 0.06, undefined, 140); break;
      case 'intro': this.sting(t, p.boss); break;
      case 'tier': this.osc('sawtooth', NOTE(50), t, 1.2, 0.18); this.osc('sawtooth', NOTE(57), t, 1.2, 0.14); this.osc('sine', NOTE(38), t, 1.2, 0.3); break;
      case 'trainCalled': for (const [i, n] of [[0, 76], [1, 72], [2, 79]]) this.osc('sine', NOTE(n), t + i * 0.3, 0.6, 0.2, undefined, null, true); break;
      case 'trainHorn': for (const f of [311, 370]) this.osc('sawtooth', f, t, 1.6, 0.16, undefined, f * 0.99); break;
      case 'death': for (const [i, n] of [[0, 62], [1, 61], [2, 60], [3, 59]]) this.osc('sawtooth', NOTE(n - 12), t + i * 0.4, i === 3 ? 1.2 : 0.38, 0.16, undefined, i === 3 ? NOTE(n - 13) : null); break;
      case 'win': for (const [i, n] of [[0, 72], [1, 76], [2, 79], [3, 84]]) this.osc('triangle', NOTE(n), t + i * 0.12, 0.5, 0.18, undefined, null, true); break;
      default: break;
    }
  }

  sting(t, boss) {
    const base = boss ? 38 : 45;
    for (const iv of [0, 7, 12, 15]) this.osc('sawtooth', NOTE(base + iv), t, boss ? 1.8 : 0.9, 0.11, undefined, null, true);
    this.osc('sine', NOTE(base - 12), t, boss ? 2 : 1, 0.35);
    this.noiseHit(t, 0.6, 0.2, 'lowpass', 2000, 1, undefined, 200);
  }

  // Voice-ish bark: buzzy source through two formant filters with a pitch contour, one blip per syllable.
  bark(text, type) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    const base = { speakerphone: 120, scooter: 170, canvasser: 210, hoa: 190, drone: 400 }[type] || 160;
    const syl = Math.min(9, Math.max(2, Math.round(text.length / 4)));
    const yell = /!/.test(text) ? 1.25 : 1;
    for (let i = 0; i < syl; i++) {
      const t = t0 + i * 0.085;
      const o = c.createOscillator(); o.type = 'sawtooth';
      const f = base * yell * (1 + 0.25 * Math.sin(i * 1.7 + text.length)) * (type === 'canvasser' ? 1 + i * 0.03 : 1);
      o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * (i === syl - 1 ? 0.8 : 1.05), t + 0.08);
      const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 600 + (i % 3) * 250; f1.Q.value = 5;
      const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1700 + (i % 2) * 500; f2.Q.value = 6;
      const g = c.createGain(); this.env(g, t, 0.01, 0.08, type === 'hoa' ? 0.3 : 0.2);
      o.connect(f1).connect(g); o.connect(f2).connect(g);
      // Speakerphone Guy sounds like he's on a cheap phone speaker.
      if (type === 'speakerphone') { const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700; g.connect(hp).connect(this.sfxBus); } else g.connect(this.sfxBus);
      o.start(t); o.stop(t + 0.12);
    }
  }

  // ---------- ambience ----------
  startAmbience() {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    const g = c.createGain(); g.gain.value = 0.22;
    s.connect(lp).connect(g).connect(this.ambBus);
    s.start();
    this.steamGain = c.createGain(); this.steamGain.gain.value = 0;
    const s2 = c.createBufferSource(); s2.buffer = this.noise; s2.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
    s2.connect(hp).connect(this.steamGain).connect(this.ambBus);
    s2.start();
    this.ambT = 0;
  }

  carPass(t) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(900, t + 1.2); f.frequency.linearRampToValueAtTime(250, t + 2.8);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 1.2); g.gain.linearRampToValueAtTime(0.0001, t + 2.8);
    const pan = c.createStereoPanner(); pan.pan.setValueAtTime(-0.9, t); pan.pan.linearRampToValueAtTime(0.9, t + 2.8);
    s.connect(f).connect(g).connect(pan).connect(this.ambBus);
    s.start(t); s.stop(t + 3);
  }

  siren(t) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'triangle';
    for (let i = 0; i < 8; i++) { o.frequency.setValueAtTime(i % 2 ? 640 : 860, t + i * 0.55); }
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 1); g.gain.linearRampToValueAtTime(0.0001, t + 4.4);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
    o.connect(lp).connect(g).connect(this.ambBus); g.connect(this.verb);
    o.start(t); o.stop(t + 4.5);
  }

  // ---------- music ----------
  // Called every frame: schedules beats ahead of time. Intensity 0..6 adds layers.
  tick(dt, state) {
    if (!this.ctx) return;
    const c = this.ctx;
    this.intensity = state.intensity;
    if (this.steamGain) this.steamGain.gain.setTargetAtTime(state.steam * 0.05, c.currentTime, 0.3);
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = 2 + Math.random() * 4;
      if (Math.random() < 0.6) this.carPass(c.currentTime + 0.05);
      if (Math.random() < 0.12) this.siren(c.currentTime + 0.1);
    }
    if (!this.musicOn || state.paused) return;
    const bpm = 92 + state.intensity * 6;
    const spb = 60 / bpm / 4; // sixteenth notes
    while (this.nextBeat < c.currentTime + 0.12) {
      this.beat(this.nextBeat, this.step, state.intensity);
      this.nextBeat += spb;
      this.step++;
    }
  }

  beat(t, s, I) {
    const bar = Math.floor(s / 16) % 4, st = s % 16;
    const prog = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]]; // Dm  Bb  F  C
    const ch = prog[bar];
    const M = this.musicBus;
    // Pad: always, swells on the bar.
    if (st === 0) for (const n of ch) this.pad(t, NOTE(n), 60 / (92 + I * 6) * 4);
    // Kick.
    if (I >= 0 && (st === 0 || (I >= 2 && st === 8) || (I >= 3 && st === 10))) this.osc('sine', 120, t, 0.25, 0.7, M, 42);
    // Hats.
    if (I >= 1 && st % 2 === 0) this.noiseHit(t, st % 4 === 2 ? 0.05 : 0.025, st % 4 === 2 ? 0.16 : 0.08, 'highpass', 7000, 1, M);
    // Bass.
    if (I >= 1 && [0, 3, 6, 10, 12].includes(st)) this.bass(t, NOTE(ch[0] - 24 + (st === 10 ? 7 : 0)), I);
    // Snare.
    if (I >= 2 && (st === 4 || st === 12)) { this.noiseHit(t, 0.14, 0.35, 'bandpass', 1800, 0.8, M); this.osc('triangle', 220, t, 0.08, 0.2, M, 150); }
    // Arp.
    if (I >= 3 && st % 2 === 1) this.osc('square', NOTE(ch[(st >> 1) % 3] + 12 + (st > 8 ? 12 : 0)), t, 0.08, 0.05, M);
    // Total Gridlock / boss: distorted stabs. Jury Duty: organ.
    if (I >= 4 && (st === 0 || st === 7)) for (const n of ch) this.osc('sawtooth', NOTE(n), t, 0.12, 0.06, M);
    if (I >= 5 && st === 0) for (const n of ch) this.osc('square', NOTE(n + 12), t, 0.9, 0.035, M);
  }

  pad(t, f, dur) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 + this.intensity * 250;
    for (const d of [-6, 6]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
    lp.connect(g).connect(this.musicBus); g.connect(this.verb);
  }

  bass(t, f, I) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(300 + I * 120, t); lp.frequency.exponentialRampToValueAtTime(120, t + 0.18);
    const g = c.createGain(); this.env(g, t, 0.005, 0.2, 0.3);
    o.connect(lp).connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + 0.25);
  }

  // Wire the sim's events to sounds.
  bind(game) {
    this.offs?.forEach((o) => o());
    const E = game.events;
    let combo = 0, comboT = 0;
    const P = game.player;
    const near = (pos, r = 45) => !pos || Math.hypot(pos.x - P.pos.x, pos.z - P.pos.z) < r;
    this.offs = [
      E.on('ability', (a) => this.play(a.kind === 'dart' ? 'dart' : a.kind)),
      E.on('hit', (d) => { if (d.source !== 'burn') this.play(d.source === 'revolver' && d.part === 'head' ? 'headshot' : 'hit', { crit: d.crit }); }),
      ...['dryFire', 'reloadRound', 'reloadStart', 'reloadDone'].map((k) => E.on(k, () => this.play(k))),
      E.on('kill', (d) => { if (near(d.pos)) this.play(d.type === 'notice' ? 'notice' : 'kill'); }),
      E.on('bounce', (d) => this.play('bounce', d)),
      E.on('impact', (d) => { if (d.kind === 'syringe' && Math.random() < 0.3) this.play('syringe'); }),
      E.on('jump', (d) => this.play(d.air ? 'airjump' : 'jump')),
      E.on('climbStart', () => this.play('climb')),
      E.on('mantle', () => this.play('mantle')),
      E.on('pickup', (d) => {
        if (d.kind !== 'coin') return;
        const now = performance.now() / 1000;
        combo = now - comboT < 0.6 ? combo + 1 : 0; comboT = now;
        this.play('coin', { combo });
      }),
      E.on('purchase', () => this.play('purchase')),
      E.on('cantAfford', () => this.play('nope')),
      E.on('item', () => this.play('item')),
      E.on('equipment', (d) => this.play(d.id === 'airhorn' ? 'airhorn' : 'cart')),
      E.on('explosion', (d) => { if (near(d.pos)) this.play('explode'); }),
      E.on('lightning', () => this.play('lightning')),
      E.on('playerHurt', () => this.play('hurt')),
      E.on('blocked', () => this.play('blocked')),
      E.on('dodged', () => this.play('blocked')),
      E.on('bell', (d) => { if (near(d.pos)) this.play('bell'); }),
      E.on('crash', (d) => { if (near(d.pos)) this.play('crash'); }),
      E.on('enemyAttack', (d) => { if (d.kind === 'soundwave' && near(d.pos)) this.play('wave'); else if (d.kind === 'gunshot' && near(d.pos, 90)) this.play('gunshot'); else if (d.kind === 'punch' && near(d.pos)) this.play('hit'); }),
      E.on('power', () => this.play('item')),
      E.on('waveStart', () => this.play('tier')),
      E.on('bark', (d) => { const e = game.enemies.find((x) => x.id === d.id); if (e && near(e.pos, 40)) this.bark(d.text, d.type); }),
      E.on('latch', () => this.play('chirp')),
      E.on('bossSlam', () => this.play('gavel')),
      E.on('bossAttack', (d) => { if (/Parking/.test(d.name)) this.play('drone'); }),
      E.on('intro', (d) => this.play('intro', { boss: d.boss })),
      E.on('tier', () => this.play('tier')),
      E.on('trainCalled', () => this.play('trainCalled')),
      E.on('trainArrived', () => this.play('trainHorn')),
      E.on('playerDeath', () => this.play('death')),
      E.on('win', () => this.play('win')),
    ];
    // Speakerphone wind-up ring: watch for telegraph starts.
    this.watch = game;
  }

  // Per-frame: telegraph sounds that depend on state rather than events.
  frame(game) {
    if (!this.ctx) return;
    const P = game.player;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const starting = e.telegraph > 0 && !e._teleSound;
      if (starting && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 35) {
        if (e.type === 'speakerphone') this.play('phone');
        if (e.type === 'canvasser') this.play('chirp');
        if (e.type === 'drone') this.play('drone');
      }
      e._teleSound = e.telegraph > 0;
    }
  }
}
