// Entry point: screens, run lifecycle, fixed-step simulation loop, rendering, audio, debug API.
// URL params: seed, quality (auto|high|medium|low), t (start at minute), god=1, perf=1, autostart=1, bot=<scenario>.

import { DT } from './core/config.js';
import { Game } from './sim/game.js';
import { downtown } from './city/districts/downtown.js';
import { DEE } from './sim/survivors/dee.js';
import { View } from './render/view.js';
import { Input } from './input/input.js';
import { Hud } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { Audio } from './audio/audio.js';
import { Perf } from './debug/perf.js';
import { installDebug } from './debug/api.js';
import { TouchControls } from './ui/touch.js';
import { ABILITY_ICONS } from './ui/hud.js';
import { icon } from './ui/icons.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const view = new View(canvas, { quality: params.get('quality') || 'auto', preserve: params.has('shot') || params.has('bot') });
const input = new Input(canvas);
const touch = new TouchControls(document.getElementById('touch'), Object.fromEntries(Object.entries(ABILITY_ICONS).map(([k, v]) => [k, icon(v, '#ffffff', 64, true)])));
input.touch = touch;
touch.attach(canvas);
if (touch.enabled) {
  document.body.classList.add('touch');
  const menu = document.createElement('button');
  menu.className = 't-menu'; menu.textContent = '≡'; menu.setAttribute('aria-label', 'Pause');
  menu.onclick = () => (app.paused ? resume() : pause());
  document.getElementById('touch').appendChild(menu);
}
touch.setVisible(false);
const hud = new Hud(document.getElementById('hud'));
const audio = new Audio();
const perf = new Perf(document.getElementById('perf'));
const app = {
  game: null, view, input, hud, audio, perf, state: 'title', seed: params.get('seed') || String(Math.floor(Math.random() * 1e6)),
  acc: 0, last: performance.now(), driver: null, stepsPerFrame: 1, paused: false,
};

const screens = new Screens(document.getElementById('screens'), {
  start: (seed) => { audio.start(); startRun(seed); },
  resume: () => resume(),
  restart: (same) => { audio.start(); startRun(same ? app.seed : String(Math.floor(Math.random() * 1e6))); },
  quality: (q) => { view.qualityName = q; if (q !== 'auto') view.setQuality(q); },
  volume: (v) => audio.setVolume(v),
  sens: (v) => { input.sens = v; },
});

export function startRun(seed, opts = {}) {
  app.seed = String(seed);
  const url = new URL(location.href);
  url.searchParams.set('seed', app.seed);
  history.replaceState(null, '', url);
  // A fresh Game every run: no boss, wave, shop or clock state can carry over.
  const g = (app.game = new Game({ seed: app.seed, district: downtown, survivor: DEE, startMinutes: opts.startMinutes ?? +(params.get('t') || 0) }));
  if (params.get('god') === '1' || opts.god) g.godMode = true;
  view.load(g);
  hud.bind(g, DEE, touch);
  audio.bind(g);
  input.yaw = g.player.yaw;
  input.pitch = 0;
  g.events.on('playerDeath', (d) => setTimeout(() => { if (app.game === g) { app.state = 'dead'; input.enabled = false; input.unlock(); touch.setVisible(false); screens.show('dead', d); } }, 1600));
  g.events.on('win', (r) => setTimeout(() => { if (app.game === g) { app.state = 'won'; input.enabled = false; input.unlock(); touch.setVisible(false); screens.show('won', r); } }, 900));
  app.state = 'playing';
  app.paused = false;
  input.enabled = true;
  screens.show(null);
  hud.setVisible(true);
  input.lock();
  return g;
}

function pause() {
  if (app.state !== 'playing') return;
  touch.setVisible(false);
  app.paused = true;
  input.enabled = false;
  input.unlock();
  screens.show('pause', { seed: app.seed, quality: view.qualityName, volume: audio.volume, sens: input.sens });
}
function resume() {
  app.paused = false;
  touch.setVisible(true);
  input.enabled = true;
  screens.show(null);
  input.lock();
}

addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (app.state === 'playing') (app.paused ? resume() : pause()); }
  if (e.code === 'F3') { perf.toggle(); e.preventDefault(); }
  if (e.code === 'KeyM') audio.setVolume(audio.volume > 0 ? 0 : 0.8);
});
document.addEventListener('pointerlockchange', () => {
  // Losing pointer lock mid-run (Esc in most browsers) pauses.
  if (!document.pointerLockElement && app.state === 'playing' && !app.paused && !app.driver && input.wasLocked) pause();
  input.wasLocked = !!document.pointerLockElement;
});
addEventListener('resize', () => view.resize());

function frame(now) {
  requestAnimationFrame(frame);
  const g = app.game;
  let dt = Math.min(0.1, (now - app.last) / 1000);
  app.last = now;
  // Recording: animate exactly the sim time that elapsed this frame.
  if (app.driver && app.fixedRenderDt) dt = app.stepsPerFrame * DT;
  if (!g) return;
  if (app.state === 'playing' && !app.paused) {
    if (app.driver) {
      // Bot / test driver: run N sim steps per rendered frame.
      for (let i = 0; i < app.stepsPerFrame && app.driver; i++) {
        const r = app.driver.next();
        if (r.done) { app.driver = null; app.onDriverDone?.(); }
      }
    } else {
      app.acc += dt * g.timeScale;
      let n = 0;
      while (app.acc >= DT && n < 8) { g.step(input.sample()); app.acc -= DT; n++; }
      if (n === 8) app.acc = 0;
    }
  } else if (app.state !== 'playing' && g.state !== 'won') {
    // Keep the world alive behind the death screen.
    app.acc += dt;
    while (app.acc >= DT) { g.step(); app.acc -= DT; }
  }
  view.render(dt);
  app.onFrame?.();
  hud.update(dt);
  audio.tick(dt, {
    intensity: Math.min(6, g.clock.tier + (g.exit.state === 'called' ? 1 : 0) + (g.boss?.alive ? 1 : 0)),
    paused: app.paused, steam: steamNear(g),
  });
  audio.frame(g);
  perf.frame(dt, view, g);
}

function steamNear(g) {
  const P = g.player.pos;
  let best = 99;
  for (const l of view.fx?.steamSpots || []) best = Math.min(best, Math.hypot(l.x - P.x, l.z - P.z));
  return Math.max(0, 1 - best / 12);
}

installDebug(app, { startRun });
if (params.get('autostart') === '1' || params.has('bot') || params.has('shot')) startRun(app.seed);
else {
  // Title screen over a live city backdrop.
  const g = (app.game = new Game({ seed: app.seed, district: downtown, survivor: DEE }));
  g.director.enabled = false;
  view.load(g);
  hud.bind(g, DEE, touch);
  hud.setVisible(false);
  app.state = 'title';
  screens.show('title', { survivor: DEE, seed: app.seed });
}
requestAnimationFrame(frame);
