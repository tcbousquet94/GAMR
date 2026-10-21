// Entry point: screens, run lifecycle, fixed-step simulation loop, rendering, audio, debug API.
// URL params: seed, quality (auto|high|medium|low), t (start at minute), god=1, perf=1, autostart=1, bot=<scenario>.

import { DT } from './core/config.js';
import { Game } from './sim/game.js';
import { TurfGame } from './sim/turf/turfGame.js';
import { downtown } from './city/districts/downtown.js';
import { DEE } from './sim/survivors/dee.js';
import { View } from './render/view.js';
import { KitView } from './render/kit/kitView.js';
import { HeroGame } from './sim/hero/heroGame.js';
import { TownGame } from './sim/town/townGame.js';
import { MAPS, DEFAULT_MAP } from './maps/index.js';
import { loadMap } from './city/maps/load.js';
import { Input } from './input/input.js';
import { Hud } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { Audio } from './audio/audio.js';
import { Perf } from './debug/perf.js';
import { installDebug } from './debug/api.js';
import { TouchControls } from './ui/touch.js';
import { ABILITY_ICONS } from './ui/hud.js';
import { icon } from './ui/icons.js';
import { FlyCam } from './debug/flycam.js';
import { buildDebugOverlay } from './render/debugOverlay.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
// Look-development street for the remastered art direction: ?scene=hero, or press H on the title screen (remembered
// for the session, so it also works where the URL can't be edited).
const sceneFlag = () => { try { return sessionStorage.getItem('broke.scene'); } catch { return null; } };
const HERO = params.get('scene') === 'hero' || (params.get('scene') == null && sceneFlag() === 'hero');
const CLASSIC = params.get('mode') === 'classic'; // the retired roguelike keeps its old renderer
// Modes: the town game on the handcrafted map (default; ?map=<name>), ?mode=turf (the turf war on a generated seed),
// ?mode=classic (the roguelike), ?scene=hero ("h", the look test).
const TURF = params.get('mode') === 'turf';
const TOWN = !HERO && !CLASSIC && !TURF;
let townMap = null;
const loadTownMap = async () => { const name = MAPS[params.get('map')] ? params.get('map') : DEFAULT_MAP; const [base, edits] = await MAPS[name].load(); townMap = { name, base: base.default, edits: edits.default }; };
const newTown = () => new TownGame({ city: loadMap(townMap.base, townMap.edits), survivor: DEE });
const view = new (CLASSIC ? View : KitView)(canvas, { quality: params.get('quality') || 'auto', preserve: params.has('shot') || params.has('bot') });
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
  map: () => showMap(),
  mapBack: () => (app.mapFromPlay ? resume() : pause()),
});
app.fly = new FlyCam(input);

// Town map (M or the pause menu). Only the turf game has one.
function showMap() {
  const g = app.game;
  if (!g?.turf) return;
  if (app.state === 'playing' && !app.paused) { app.mapFromPlay = true; pause(); } else app.mapFromPlay = false;
  screens.show('map', { turf: g.turf, buildings: (g.city.buildings || []).map((b) => b.rect), player: { x: g.player.pos.x, z: g.player.pos.z, yaw: g.player.yaw }, seed: app.seed });
}
function toggleOverlay(on) {
  const g = app.game;
  if (!g?.turf) return false;
  if (!app.overlay || app.overlay.game !== g) { app.overlay = { game: g, group: buildDebugOverlay(g.turf) }; view.scene.add(app.overlay.group); }
  app.overlay.group.visible = on ?? !app.overlay.group.visible;
  view.clearAir = app.overlay.group.visible;
  return app.overlay.group.visible;
}
app.toggleOverlay = toggleOverlay;
app.showMap = showMap;

export function startRun(seed, opts = {}) {
  app.seed = String(seed);
  const url = new URL(location.href);
  url.searchParams.set('seed', app.seed);
  history.replaceState(null, '', url);
  // A fresh game every run so no state carries over. Default: the turf-war city. ?mode=classic keeps the retired
  // roguelike reachable (disconnected from the main game, left in place so nothing breaks).
  const startMinutes = opts.startMinutes ?? +(params.get('t') || 0);
  const g = (app.game = HERO ? new HeroGame({ survivor: DEE }) : TOWN ? newTown() : CLASSIC
    ? new Game({ seed: app.seed, district: downtown, survivor: DEE, startMinutes })
    : new TurfGame({ seed: app.seed, survivor: DEE, startMinutes }));
  if (params.get('god') === '1' || opts.god) g.godMode = true;
  if (app.fly?.active) app.fly.toggle(view);
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
  hud.setVisible(!HERO);
  if (HERO) heroCaption(g.city.district.name);
  input.lock();
  return g;
}

// Street-name caption (bottom centre), shown for a few seconds when the hero scene starts.
function heroCaption(text) {
  let el = document.getElementById('caption');
  if (!el) { el = document.createElement('div'); el.id = 'caption'; document.body.appendChild(el); }
  el.textContent = text;
  el.style.cssText = 'position:fixed;left:0;right:0;bottom:4%;text-align:center;font:800 44px/1 "Arial Black",Arial,sans-serif;color:#fff;letter-spacing:0.5px;-webkit-text-stroke:2px #111;paint-order:stroke;text-shadow:0 2px 3px rgba(0,0,0,0.6);pointer-events:none;transition:opacity 1s;opacity:1;z-index:5';
  clearTimeout(heroCaption.t);
  heroCaption.t = setTimeout(() => { el.style.opacity = params.has('shot') ? 1 : 0; }, 6000);
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
  if (e.code === 'KeyH' && (app.state === 'title' || app.paused)) { try { sessionStorage.setItem('broke.scene', HERO ? 'city' : 'hero'); } catch { /* storage blocked */ } location.reload(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (app.state === 'playing') (app.paused ? resume() : pause()); }
  if (e.code === 'F3') { perf.toggle(); e.preventDefault(); }
  if (e.code === 'KeyM' && app.game?.turf) { if (screens.current === 'map') app.mapFromPlay ? resume() : pause(); else if (app.state === 'playing') showMap(); }
  if (e.code === 'F1' && app.state === 'playing') { app.fly.toggle(view); e.preventDefault(); }
  if (e.code === 'F2') { toggleOverlay(); e.preventDefault(); }
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
  let dt = Math.max(1e-4, Math.min(0.1, (now - app.last) / 1000)); // the first rAF stamp can predate the load-time clock (never 0: the animator divides by dt)
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
      // Free-fly: the leader stands still (empty control) while the camera roams.
      if (app.fly.active) app.fly.update(dt);
      while (app.acc >= DT && n < 8) { g.step(app.fly.active ? { yaw: g.player.yaw, pitch: g.player.pitch } : app.held ? { ...app.held, yaw: g.player.yaw, pitch: g.player.pitch } : input.sample()); app.acc -= DT; n++; }
      if (n === 8) app.acc = 0;
    }
  } else if (app.state !== 'playing' && g.state !== 'won') {
    // Keep the world alive behind the death screen.
    app.acc += dt;
    while (app.acc >= DT) { g.step(); app.acc -= DT; }
  }
  view.render(dt);
  app.onFrame?.();
  hud.flying = app.fly.active; // the leader is parked while the camera roams: no "you are here" prompt
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
(TOWN ? loadTownMap() : Promise.resolve()).then(() => {
  if (HERO || params.get('autostart') === '1' || params.has('bot') || params.has('shot')) { startRun(app.seed); return; }
  // Title screen over a live city backdrop.
  const g = (app.game = CLASSIC ? new Game({ seed: app.seed, district: downtown, survivor: DEE }) : TOWN ? newTown() : new TurfGame({ seed: app.seed, survivor: DEE }));
  g.director.enabled = false;
  view.load(g);
  hud.bind(g, DEE, touch);
  hud.setVisible(false);
  app.state = 'title';
  screens.show('title', { survivor: DEE, seed: app.seed });
});
requestAnimationFrame(frame);
