// window.__broke: lets the headless bot, screenshot capture and perf tests drive the real game in the browser.

import { NavGraph } from '../city/nav.js';
import { makeCtx, SCENARIOS } from './scenarios.js';
import { EMPTY_INPUT } from '../sim/game.js';

export function installDebug(app, { startRun }) {
  const api = {
    app,
    get game() { return app.game; },
    get view() { return app.view; },
    start: (seed, opts) => startRun(seed, opts),
    perf: () => ({ ...app.perf.stats, ...app.view.city?.stats() }),
    // Run a bot scenario inside the live game. Resolves with its numeric results.
    run(name, { stepsPerFrame = 4, opts = {} } = {}) {
      const g = app.game;
      const nav = (api.nav = api.nav?.world === g.world ? api.nav : new NavGraph(g.world, g.city.size));
      const ctx = makeCtx(g, nav);
      ctx.maxEnemies = 0;
      const gen = SCENARIOS[name](ctx, opts);
      app.stepsPerFrame = stepsPerFrame;
      return new Promise((resolve) => {
        app.driver = (function* () { for (const _ of gen) { ctx.maxEnemies = Math.max(ctx.maxEnemies, g.enemies.filter((e) => e.alive).length); yield; } })();
        app.onDriverDone = () => resolve(ctx.results);
      });
    },
    // Place the player / camera for screenshots, then step a few frames so everything settles.
    pose({ x, y, z, yaw = 0, pitch = 0 }) {
      const P = app.game.player;
      Object.assign(P.body.pos, { x, y, z });
      Object.assign(P.body.vel, { x: 0, y: 0, z: 0 });
      P.yaw = yaw; P.pitch = pitch;
      app.input.yaw = yaw; app.input.pitch = pitch;
      for (let i = 0; i < 3; i++) app.game.step({ ...EMPTY_INPUT, yaw, pitch });
    },
    step(n = 1, input = {}) { for (let i = 0; i < n; i++) app.game.step({ ...EMPTY_INPUT, yaw: app.game.player.yaw, pitch: app.game.player.pitch, ...input }); },
    setMinutes(m) { app.game.clock.time = m * 60; app.game.clock.update(0); },
  };
  window.__broke = api;
  return api;
}
