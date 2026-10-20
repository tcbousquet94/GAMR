// WebAudio-synthesized cartoony SFX + a tiny looping chiptune. No assets.
// The AudioContext is created lazily on the first real user gesture (pointerdown / keydown).

const RATE_LIMIT = 0.04; // seconds between identical sfx
const BPM = 110;
const STEP = 60 / BPM / 2; // eighth notes
const LOOKAHEAD = 0.12;

// 8 bars of eighth notes (MIDI, 0 = rest)
const MELODY = [
  76, 0, 79, 76, 72, 0, 74, 76,
  77, 0, 81, 77, 74, 0, 75, 76,
  79, 79, 0, 76, 84, 0, 81, 79,
  77, 76, 74, 72, 74, 0, 0, 0,
  76, 0, 79, 76, 72, 0, 74, 76,
  77, 0, 81, 77, 74, 0, 78, 79,
  81, 79, 77, 76, 74, 76, 72, 0,
  71, 0, 67, 71, 72, 0, 79, 0,
];
// quarter notes
const BASS = [
  48, 55, 48, 55, 41, 48, 41, 48, 45, 52, 45, 52, 43, 50, 43, 50,
  48, 55, 48, 55, 50, 57, 50, 57, 41, 48, 43, 50, 43, 50, 48, 36,
];

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.muted = false;
    this.last = Object.create(null);
    this.musicOn = false;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;

    const gesture = () => this.ensure();
    window.addEventListener('pointerdown', gesture, true);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM' && !e.repeat) this.toggleMute();
      gesture();
    }, true);
    window.addEventListener('touchstart', gesture, { capture: true, passive: true });

    const ev = game.events;
    if (ev) {
      ev.on('sfx', (p) => this.play(p?.name, p?.volume ?? 1));
      ev.on('game:start', () => this.startMusic());
      // The contract lists Audio as a consumer of these; the per-name rate limit dedupes
      // against any matching sfx event emitted the same frame.
      ev.on('lock', (p) => { if (p?.target) this.play('lock'); });
      ev.on('defeat', (p) => { if (p?.target?.team !== 'hero') this.play('defeat'); });
    }
  }

  update() {}

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch { return; }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(c.destination);
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = 0.55;
      this.sfxBus.connect(this.master);
      this.musicBus = c.createGain();
      this.musicBus.gain.value = 0.11;
      this.musicBus.connect(this.master);
      // 1s white noise buffer, shared
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (this.musicOn) this.scheduleStart();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, t, 0.03);
    }
    this.game.events?.emit('popup', { text: this.muted ? 'Sound: off' : 'Sound: on', position: null, style: 'info' });
  }

  // ------------------------------------------------------------ primitives
  // Oscillator with pitch sweep and an attack/decay envelope.
  tone(type, f0, f1, dur, vol = 0.3, when = 0, bus = this.sfxBus, opts = {}) {
    const c = this.ctx;
    const t = c.currentTime + when;
    vol = Math.max(0.0002, vol);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (opts.vib) {
      const l = c.createOscillator();
      const lg = c.createGain();
      l.frequency.value = opts.vib;
      lg.gain.value = opts.vibDepth ?? f0 * 0.06;
      l.connect(lg).connect(o.frequency);
      l.start(t); l.stop(t + dur + 0.05);
    }
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.3, when = 0, filter = 'bandpass', f0 = 1000, f1 = f0, q = 1, bus = this.sfxBus) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------ sfx
  play(name, vol = 1) {
    if (!name || !this.ctx || this.ctx.state !== 'running' || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - (this.last[name] ?? -1) < RATE_LIMIT) return;
    this.last[name] = now;
    const v = Math.max(0, Math.min(1.5, vol));
    const fn = SFX[name];
    if (fn) fn(this, v);
  }

  // ------------------------------------------------------------ music
  startMusic() {
    this.musicOn = true;
    if (this.ctx) this.scheduleStart();
  }

  scheduleStart() {
    if (this.timer) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    // tab was hidden / throttled: don't machine-gun the backlog
    if (this.nextTime < c.currentTime - 0.05) this.nextTime = c.currentTime + 0.05;
    while (this.nextTime < c.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime - c.currentTime);
      this.step = (this.step + 1) % MELODY.length;
      this.nextTime += STEP;
    }
  }

  playStep(i, when) {
    const bus = this.musicBus;
    const m = MELODY[i];
    if (m) {
      const held = MELODY[(i + 1) % MELODY.length] === 0;
      const dur = STEP * (held ? 1.7 : 0.85);
      this.tone('square', mtof(m), 0, dur, 0.22, when, bus, { attack: 0.004 });
      // a tiny echo for sparkle
      this.tone('square', mtof(m), 0, dur * 0.6, 0.05, when + STEP * 0.5, bus, { attack: 0.004 });
    }
    if (i % 2 === 0) {
      const b = BASS[i >> 1];
      this.tone('triangle', mtof(b), 0, STEP * 1.7, 0.5, when, bus, { attack: 0.004 });
    } else {
      // off-beat hat
      this.noise(0.03, 0.12, when, 'highpass', 7000, 7000, 0.7, bus);
    }
    if (i % 8 === 0) this.noise(0.08, 0.22, when, 'lowpass', 400, 120, 1, bus); // soft kick-ish thump
  }
}

// name -> (audio, vol) => void. All short and cartoony.
const SFX = {
  swing: (a, v) => {
    a.noise(0.14, 0.35 * v, 0, 'bandpass', 700, 2800, 1.5);
    a.tone('sine', 380, 180, 0.12, 0.08 * v);
  },
  hit: (a, v) => {
    a.tone('square', 260, 90, 0.09, 0.22 * v);
    a.noise(0.07, 0.4 * v, 0, 'lowpass', 2400, 600, 1);
  },
  smash: (a, v) => {
    a.tone('sine', 170, 40, 0.3, 0.6 * v);
    a.tone('square', 420, 110, 0.18, 0.18 * v);
    a.noise(0.25, 0.5 * v, 0, 'lowpass', 3000, 200, 1);
    a.tone('triangle', 1400, 1900, 0.08, 0.1 * v, 0.06);
  },
  jump: (a, v) => {
    a.tone('square', 260, 720, 0.14, 0.16 * v);
  },
  dodge: (a, v) => {
    a.noise(0.18, 0.3 * v, 0, 'highpass', 1200, 4000, 0.8);
    a.tone('triangle', 700, 260, 0.16, 0.12 * v);
  },
  psi: (a, v) => {
    const notes = [880, 1320, 1760, 2640];
    notes.forEach((f, i) => a.tone('sine', f, f * 1.02, 0.22, 0.14 * v, i * 0.04, a.sfxBus, { vib: 18, vibDepth: 30 }));
    a.tone('triangle', 440, 1760, 0.3, 0.12 * v);
    a.noise(0.3, 0.08 * v, 0, 'bandpass', 3000, 8000, 4);
  },
  heal: (a, v) => {
    [523, 659, 784, 1047].forEach((f, i) => a.tone('triangle', f, f, 0.16, 0.22 * v, i * 0.07));
    a.tone('sine', 2093, 2093, 0.3, 0.06 * v, 0.28);
  },
  phone: (a, v) => {
    // brrring-brrring
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < 7; k++) {
        a.tone('square', k % 2 ? 1250 : 1550, 0, 0.035, 0.07 * v, r * 0.38 + k * 0.04);
      }
    }
  },
  defeat: (a, v) => {
    a.tone('square', 900, 120, 0.4, 0.18 * v, 0, a.sfxBus, { vib: 22, vibDepth: 60 });
    a.noise(0.2, 0.25 * v, 0.05, 'bandpass', 1800, 300, 2);
    [784, 1047].forEach((f, i) => a.tone('triangle', f, f, 0.1, 0.12 * v, 0.32 + i * 0.07));
  },
  menu: (a, v) => {
    a.tone('square', 880, 880, 0.045, 0.1 * v);
  },
  select: (a, v) => {
    a.tone('square', 660, 660, 0.05, 0.12 * v);
    a.tone('square', 990, 990, 0.08, 0.12 * v, 0.05);
  },
  lock: (a, v) => {
    a.tone('triangle', 1200, 1200, 0.07, 0.2 * v);
    a.tone('triangle', 1800, 1800, 0.12, 0.2 * v, 0.06);
  },
  hurt: (a, v) => {
    a.tone('sawtooth', 420, 140, 0.2, 0.16 * v, 0, a.sfxBus, { vib: 30, vibDepth: 40 });
    a.noise(0.08, 0.25 * v, 0, 'lowpass', 1500, 400, 1);
  },
  status: (a, v) => {
    // sad trombone-ish wah-wah
    a.tone('triangle', 392, 370, 0.22, 0.2 * v, 0, a.sfxBus, { vib: 7, vibDepth: 12 });
    a.tone('triangle', 349, 262, 0.4, 0.2 * v, 0.22, a.sfxBus, { vib: 7, vibDepth: 14 });
  },
  denied: (a, v) => {
    a.tone('square', 160, 150, 0.08, 0.14 * v);
    a.tone('square', 160, 140, 0.1, 0.14 * v, 0.11);
  },
  ping: (a, v) => {
    a.tone('sine', 1560, 1560, 0.25, 0.22 * v);
    a.tone('sine', 3120, 3120, 0.12, 0.05 * v);
  },
  whistle: (a, v) => {
    a.tone('sine', 2100, 2300, 0.45, 0.16 * v, 0, a.sfxBus, { vib: 32, vibDepth: 120, attack: 0.02 });
  },
  chomp: (a, v) => {
    for (let i = 0; i < 2; i++) {
      a.tone('square', 220, 70, 0.07, 0.18 * v, i * 0.11);
      a.noise(0.06, 0.3 * v, i * 0.11, 'lowpass', 1200, 300, 1);
    }
  },
};
