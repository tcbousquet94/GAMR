// Animation frame strips: scripted motions recorded from a side camera, ~12 frames each, stitched into one PNG
// per motion in shots/strips/. Used to review weight, flow and snapping. Usage: node tests/browser/strips.mjs [names]
import { startServer, openGame } from './lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../../shots/strips/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const only = process.argv[2] ? process.argv[2].split(',') : null;

// Each motion runs in the page: setup(api) then input(i) per sim step for `steps` steps; a frame is captured every
// `every` steps. cam: side offset (metres to the right of the motion), height.
const MOTIONS = {
  wallrun: { steps: 90, every: 5, setup: 'wallSpot', input: (i) => ({ moveZ: 1, sprint: true }) },
  turn: { steps: 132, every: 6, setup: 'open', input: (i) => (i < 55 ? { moveZ: 1, sprint: true } : i < 95 ? { moveX: 1, sprint: false } : { moveZ: -1 }) },
  reverse: { steps: 110, every: 5, setup: 'open', input: (i) => (i < 60 ? { moveZ: 1, sprint: true } : { moveZ: -1, sprint: true }) },
  skidstop: { steps: 120, every: 5, setup: 'open', input: (i) => (i < 70 ? { moveZ: 1, sprint: true } : {}) },
  vault: { steps: 90, every: 4, setup: 'vaultSpot', input: (i) => ({ moveZ: 1, sprint: true }) },
  stairs: { steps: 160, every: 11, setup: 'stairSpot', input: (i) => ({ moveZ: 1 }) },
  hits: { steps: 150, every: 5, setup: 'open', input: (i) => ({}), events: [[10, 'front'], [45, 'back'], [80, 'left'], [115, 'right']] },
  shoot: { steps: 72, every: 3, setup: 'open', input: (i) => ({ primary: i < 40 }) },
  lookaround: { steps: 240, every: 10, setup: 'open', input: (i) => ({ dyaw: i < 120 ? Math.min(1, i / 60) * 2.0 : Math.max(0, 2.0 - (i - 120) / 40 * 2.0) }) },
  idle: { steps: 720, every: 48, setup: 'open', input: (i) => ({}) },
  death: { steps: 140, every: 6, zoom: 1.9, setup: 'deathSpot', input: (i) => ({}) },
};

const PAGE = String.raw`
window.__strip = async function (name, spec) {
  const api = window.__broke, g = api.game, P = g.player, W = g.world, app = api.app;
  g.director.enabled = false; g.godMode = true;
  const spot = window.__spots[spec.setup](g);
  api.pose({ x: spot.x, y: spot.y, z: spot.z, yaw: spot.yaw, pitch: 0 });
  // Side camera: to the right of the starting heading, following along.
  const r = { x: Math.cos(spot.yaw), z: -Math.sin(spot.yaw) };
  const side = spot.camSide || 4.2;
  let sideSign = 1;
  api.view.camOverride = (Pl) => {
    // Use whichever side gives a clear line of sight to her.
    const tgt = { x: Pl.pos.x, y: Pl.pos.y + 0.9, z: Pl.pos.z };
    const camAt = (k) => ({ x: Pl.pos.x + r.x * side * k, y: Pl.pos.y + 1.3, z: Pl.pos.z + r.z * side * k });
    if (!W.segmentClear(camAt(sideSign), tgt) && W.segmentClear(camAt(-sideSign), tgt)) sideSign = -sideSign;
    return { pos: camAt(sideSign), target: tgt };
  };
  if (spot.after) spot.after(g);
  const W0 = spec.zoom > 1 ? 300 : 180, H0 = 300, frames = [];
  const canvas = api.view.renderer.domElement;
  let i = 0;
  await new Promise((resolve) => {
    app.stepsPerFrame = spec.every;
    app.fixedRenderDt = true;
    app.driver = (function* () {
      for (; i < spec.steps; i++) {
        const ev = (spec.events || []).find((e) => e[0] === i);
        if (ev) {
          const f = P.forward(), rr = P.right();
          const d = { front: f, back: { x: -f.x, z: -f.z }, left: { x: -rr.x, z: -rr.z }, right: rr }[ev[1]];
          g.events.emit('playerHurt', { amount: 14, source: 'test', from: { x: P.pos.x + d.x * 3, z: P.pos.z + d.z * 3 } });
        }
        const inp = spec.inputFn(i);
        g.step({ moveX: 0, moveZ: 0, yaw: spot.yaw + (inp.dyaw || 0), pitch: 0, sprint: false, jumpPressed: false, primary: false, secondary: false, utility: false, special: false, equipment: false, interact: false, ...inp });
        yield;
      }
    })();
    app.onDriverDone = resolve;
    app.onFrame = () => {
      if (i === 0) return;
      const c = document.createElement('canvas'); c.width = W0; c.height = H0;
      const cx = canvas.width / 2, cy = canvas.height * 0.5;
      const sc = canvas.height / 720 * (spec.zoom || 0.85); // framed on the whole body
      c.getContext('2d').drawImage(canvas, cx - (W0 / 2) * sc, cy - (H0 / 2) * sc, W0 * sc, H0 * sc, 0, 0, W0, H0);
      frames.push(c);
    };
  });
  app.onFrame = null;
  app.fixedRenderDt = false;
  const strip = document.createElement('canvas'); strip.width = W0 * frames.length; strip.height = H0 + 26;
  const x = strip.getContext('2d');
  x.fillStyle = '#111'; x.fillRect(0, 0, strip.width, strip.height);
  frames.forEach((f, k) => { x.drawImage(f, k * W0, 26); x.fillStyle = '#ddd'; x.font = '14px sans-serif'; x.fillText(name + ' #' + k, k * W0 + 8, 18); });
  return strip.toDataURL('image/png');
};
window.__spots = {
  open: (g) => { const s = g.city.spawn; return { x: s.x, y: 0.2, z: s.z + 30, yaw: 0 }; },
  wallSpot: (g) => {
    // Sidewalk along the east face of the first block, running north with the wall on the right.
    const b = g.city.blocks[0]; const x = b.x0 - 1.0; return { x, y: 0.2, z: b.z1 - 10, yaw: 0, camSide: -7 };
  },
  vaultSpot: (g) => {
    // A low wall/bench-height prop with open ground in front and behind.
    const W = g.world;
    for (const b of W.solids.items) {
      if (!(b.tag & 4)) continue;
      const h = b.maxY - b.minY; if (h < 0.8 || h > 1.25) continue;
      const along = (b.maxX - b.minX) > (b.maxZ - b.minZ) ? 'x' : 'z';
      const thick = along === 'x' ? b.maxZ - b.minZ : b.maxX - b.minX; if (thick > 1.2) continue;
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      const sx = along === 'x' ? cx : b.maxX + 7, sz = along === 'x' ? b.maxZ + 7 : cz;
      const ex = along === 'x' ? cx : b.minX - 3, ez = along === 'x' ? b.minZ - 3 : cz;
      if (!W.fits(sx, b.minY + 0.05, sz, 0.5, 1.9) || !W.fits(ex, b.minY + 0.05, ez, 0.5, 1.9)) continue;
      if (!W.segmentClear({ x: sx, y: b.minY + 0.5, z: sz }, { x: (sx + cx) / 2 + (along === 'x' ? 0 : 0.6), y: b.minY + 0.5, z: (sz + cz) / 2 })) continue;
      return { x: sx, y: b.minY + 0.05, z: sz, yaw: along === 'x' ? 0 : Math.PI / 2 };
    }
    const s = g.city.spawn; return { x: s.x, y: 0.2, z: s.z, yaw: 0 };
  },
  stairSpot: (g) => {
    // Bottom of a ramp/staircase built from steps (PLATFORM boxes stepping up 0.35 m).
    const W = g.world;
    const steps = W.solids.items.filter((b) => b.tag === 8 && Math.abs(b.maxY - 0.5) < 0.05 && (b.maxX - b.minX) < 5 && (b.maxZ - b.minZ) < 5);
    for (const b of steps) {
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      for (const [dx, dz, yaw] of [[0, 4, 0], [0, -4, Math.PI], [4, 0, Math.PI / 2], [-4, 0, -Math.PI / 2]]) {
        const ax = cx + dx, az = cz + dz;
        const up = W.groundBelow(cx - dx * 0.75, 3, cz - dz * 0.75, 0.1, 5);
        if (W.fits(ax, 0.2, az, 0.45, 1.9) && up > 0.6) return { x: ax, y: 0.2, z: az, yaw, camSide: 6 };
      }
    }
    const s = g.city.spawn; return { x: s.x, y: 0.2, z: s.z, yaw: 0 };
  },
  deathSpot: (g) => {
    const s = g.city.spawn;
    return { x: s.x, y: 0.2, z: s.z + 30, yaw: 0, camSide: 7, after: (g2) => {
      const e = g2.spawnEnemy('canvasser', { x: s.x + 2.2, y: 0.15, z: s.z + 30 - 1.2 }); e.spawnT = 9; e.stunned = 99; e.attackCd = 99; e.yaw = Math.PI / 2;
      setTimeout(() => {}, 0);
      g2._killAt = 30;
      const P = g2.player;
      const orig = g2.step.bind(g2); let n = 0;
      g2.step = (inp) => { n++; if (n === 30 && e.alive) g2.combat.hitEnemy(e, { damage: 1e5, crit: false }); return orig(inp); };
    } };
  },
};
`;

function withTimeout(ms, p, name) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + name)), ms))]); }
const srv = await startServer();
try {
  const { browser, page, errors } = await openGame(srv.url, 'seed=1&shot=1&quality=low&t=0.3', { width: 1280, height: 720 });
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e.stack || e).slice(0, 400)));
  await page.addScriptTag({ content: PAGE });
  await page.waitForTimeout(1500);
  for (const [name, m] of Object.entries(MOTIONS)) {
    if (only && !only.includes(name)) continue;
    await page.evaluate(() => window.__broke.start(window.__broke.app.seed, { god: true }));
    await page.waitForTimeout(800);
    const url = await withTimeout(90000, page.evaluate(([n, spec, fn]) => { spec.inputFn = new Function('i', 'return (' + fn + ')(i)'); return window.__strip(n, spec); }, [name, { ...m, input: undefined }, m.input.toString()]), name);
    writeFileSync(`${OUT}${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('strip', name);
  }
  if (errors.filter((e) => !/Pointer Lock|404/.test(e)).length) console.log('PAGE ERRORS', errors);
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
} finally { srv.stop(); }
process.exit(0);
