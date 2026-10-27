// "Inauguration Day": the story's opening (BROKE: The Detail). Walt Mercer, head of the White House security detail,
// stands half a step behind the new President on the North Portico steps. He sees a side door that should be locked
// standing open, turns too late; the shot comes from inside; the President dies in his arms. Three days later the
// papers say he froze. At night, across the street, he decides it wasn't a lone gunman.
// Staged on the city's White House (city.civic): the front wall is found with a raycast, so it works on any seed.
// Walt wears the player's own face (the creator look) in a dark suit.

import * as THREE from 'three';
import { makePerson } from '../people/person.js';
import { humanPose } from '../models/humanoid.js';
import { lerpV, ease } from './cutscene.js';

const SUIT = (top, under = 0xe8e6e0) => ({
  top: { type: 'jacket', color: top, collar: 0x141414, worn: 0.1 }, under: { type: 'tee', color: under },
  bottom: { type: 'slacks', color: top, worn: 0.1, belt: 0x141414 }, shoes: { type: 'shoes', color: 0x161616 },
});
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const span = (t, a, b) => clamp01((t - a) / (b - a));

// Story-time beats (see the shot list: slow motion stretches 26..30 s of film into 1.35 s of story).
const SHOT_T = 26.12; // the gunshot
const FALL_END = 28.6;

export function inauguration(game, { look, audio } = {}) {
  const civic = game.city?.civic, w = game.world;
  if (!civic) return null;
  const cx = civic.x;
  // The main block's front wall: a ray from the plaza, beside the portico, at first-floor height.
  const z0 = civic.z - 80;
  const hit = w.raycast(cx + 10.5, 6, z0, 0, 0, 1, 120);
  let F = z0 + hit;
  if (!(hit < 120) || Math.abs(F - (civic.z - 12)) > 8) F = civic.z - 12;
  const gy = (x, z, top = 4) => { const y = w.groundBelow(x, top, z, 0.2, 20); return Number.isFinite(y) ? y : 0.15; };
  const podY = gy(cx, F - 4, 3); // the portico floor
  const plazaY = gy(cx + 6, F - 17);

  // ---- the cast --------------------------------------------------------------------------------------------------
  const waltSpec = { ...(look || makePerson('walt-mercer')), outfit: SUIT(0x1b1c20) };
  const presSpec = { ...makePerson('president-hale'), sex: 'm', age: 46, height: 1.84, build: 1.0, belly: 0.1,
    hair: { style: 'short', color: 0x3a2a1e, grey: 0.25 }, facial: { style: 'none' }, outfit: SUIT(0x1c2640) };
  const agent = (seed) => ({ ...makePerson(seed, 'defender'), sex: 'm', age: 38, facial: { style: 'none' }, outfit: SUIT(0x18181b) });
  const stand = (t, i = 0) => {
    const p = humanPose({ phase: 0, speed: 0, t: t + i });
    p.hips = { r: [0, 0, Math.sin(t * 0.6 + i) * 0.03], t: [0, 0, 0] };
    p.armL = [0.05, 0, -0.1]; p.armR = [0.05, 0, 0.1]; p.foreL = [0.3, 0, 0]; p.foreR = [0.3, 0, 0];
    return p;
  };
  const run = (t, i) => humanPose({ phase: t * 9 + i, speed: 1, t });

  const PRES0 = { x: cx, y: podY, z: F - 6.6 };
  const WALT0 = { x: cx + 0.95, y: podY, z: F - 5.9 };
  const WALT_KNEEL = { x: cx + 0.72, y: podY, z: F - 5.45 };
  const DOOR = { x: cx - 3.4, y: podY, z: F };

  const president = {
    spec: presSpec,
    at: (t, s) => {
      if (s.night) return { hidden: true };
      if (t < SHOT_T) {
        const p = stand(t, 1);
        if (t > 14.5) { const wv = Math.sin(t * 5.5) * 0.25; p.armR = [2.55, 0, 0.45 + wv]; p.foreR = [0.55, 0, 0]; } // waving to the crowd
        p.head = [0.02, Math.sin(t * 0.5) * 0.25, 0];
        return { ...PRES0, yaw: 0, pose: p };
      }
      // Hit from behind-left: a jolt, a half turn, and down onto his back.
      const k = ease(span(t, SHOT_T + 0.08, FALL_END));
      const p = stand(t, 1);
      p.armR = [0.4 + 0.6 * (1 - k), 0, 0.6]; p.armL = [0.5, 0, -0.5 - 0.4 * k]; p.foreL = [0.9, 0, 0]; p.foreR = [0.6, 0, 0];
      p.torso = [0.25 * (1 - k), 0, 0];
      p.head = [-0.3 * k, 0.3 * k, 0];
      p.legL = [0.5 * k, 0, 0]; p.shinL = [-0.9 * k, 0, 0]; p.legR = [0.15 * k, 0, 0]; p.shinR = [-0.3 * k, 0, 0];
      return { x: PRES0.x, y: PRES0.y + 0.14 * k, z: PRES0.z, yaw: -0.35 * k, pitch: 1.48 * k, pose: p };
    },
  };

  const walt = {
    spec: waltSpec,
    at: (t, s) => {
      if (s.night) {
        // Across the street from the White House, three nights later: hands at his sides, looking at it.
        const p = stand(t, 3);
        p.armR = [0.08, 0, 0.12]; p.foreR = [0.15, 0, 0];
        p.head = [s.id === 'night' ? -0.05 : 0.08, s.id === 'night' ? 0.25 : 0, 0];
        return { x: cx + 6, y: plazaY, z: F - 17, yaw: Math.PI + 0.2, pose: p };
      }
      if (t < SHOT_T) {
        const p = stand(t, 2);
        // Scanning the crowd; then, in the close-up, his eyes find the open door.
        let yawH = Math.sin(t * 0.7) * 0.35;
        if (t > 20.6) yawH = 0.35 + 0.6 * ease(span(t, 20.6, 22.2)); // turns toward the door (to his left)
        p.head = [0.04, yawH, 0];
        p.armL = [0.12, 0, -0.08]; p.foreL = [0.9, 0, 0.2]; p.armR = [0.12, 0, 0.08]; p.foreR = [0.9, 0, -0.2]; // hands clasped in front
        return { ...WALT0, yaw: 0, pose: p };
      }
      // Too late: he turns, lunges for the President and goes down on one knee with him.
      const go = ease(span(t, SHOT_T + 0.05, 27.6)), kneel = ease(span(t, 27.4, FALL_END + 0.3));
      const pos = lerpV(WALT0, WALT_KNEEL, go);
      const p = run(t, 2);
      const k = kneel;
      p.torso = [-0.1 - 0.35 * k, 0, 0];
      p.legL = [p.legL[0] * (1 - k) + 1.45 * k, 0, 0]; p.shinL = [p.shinL[0] * (1 - k) - 1.5 * k, 0, 0];
      p.legR = [p.legR[0] * (1 - k) - 0.15 * k, 0, 0]; p.shinR = [p.shinR[0] * (1 - k) - 1.65 * k, 0, 0];
      p.armL = [0.6 + 0.4 * k, 0, -0.15]; p.armR = [0.6 + 0.4 * k, 0, 0.15]; p.foreL = [0.5, 0, 0]; p.foreR = [0.5, 0, 0];
      p.head = [0.35 * k, 0, 0];
      return { x: pos.x, y: pos.y - 0.5 * k, z: pos.z, yaw: (Math.PI / 2) * go, pose: p };
    },
  };

  const agents = [[cx - 3.2, F - 6.2, 0.2, 'agent-ruiz'], [cx + 3.6, F - 5.6, -0.15, 'agent-cole']].map(([x, z, yaw, seed], i) => ({
    spec: agent(seed),
    at: (t, s) => {
      if (s.night) return { hidden: true };
      const p = stand(t, 4 + i);
      if (t < SHOT_T + 0.15) { p.head = [0, Math.sin(t * 0.5 + i * 2) * 0.5, 0]; return { x, y: podY, z, yaw, pose: p }; }
      // Turning on the door, gun up.
      const k = ease(span(t, SHOT_T + 0.15, 27.2));
      const toDoor = Math.atan2(-(DOOR.x - x), -(DOOR.z - z));
      p.armR = [1.5 * k, 0, 0.05]; p.foreR = [0.1, 0, 0]; p.armL = [1.4 * k, 0, -0.25 * k]; p.foreL = [0.3, 0, 0];
      return { x, y: podY, z, yaw: yaw + (toDoor - yaw) * k, pose: p };
    },
  }));

  // The crowd at the iron fence: rows of onlookers; at the shot they scatter.
  const crowd = [];
  for (let i = 0; i < 30; i++) {
    const row = i % 3, col = Math.floor(i / 3);
    const x = cx - 15 + col * 3.2 + (row % 2) * 1.4 + Math.sin(i * 7.3) * 0.5, z = F - 14.2 - row * 1.6 - Math.cos(i * 3.1) * 0.4;
    const y = gy(x, z), dir = x < cx ? -1 : 1, spd = 4 + (i % 5) * 0.6;
    crowd.push({
      spec: makePerson(`inaug-${i}`),
      at: (t, s) => {
        if (s.night) return { hidden: true };
        if (t < SHOT_T + 0.2 + (i % 4) * 0.1) {
          const p = stand(t, i);
          if ((i % 4 === 1 && t > 14.5) || i % 7 === 0) { p.armR = [2.4 + Math.sin(t * 6 + i) * 0.2, 0, 0.4]; p.foreR = [0.4, 0, 0]; } // cheering
          p.head = [-0.08, Math.sin(t * 0.4 + i) * 0.3, 0];
          return { x, y, z, yaw: Math.PI, pose: p };
        }
        const dt = t - (SHOT_T + 0.2 + (i % 4) * 0.1), d = Math.min(26, dt * spd);
        const yaw = dir * 0.7 + Math.sin(i) * 0.3; // away from the White House and out to the sides
        return { x: x - Math.sin(yaw) * d, y, z: z - Math.cos(yaw) * d, yaw, pose: run(t, i) };
      },
    });
  }

  // ---- props: the side door standing open, and the muzzle flash inside it ----------------------------------------
  const door = new THREE.Group();
  const dark = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.5, 0.06), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  dark.position.set(DOOR.x, podY + 1.25, F - 0.03);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.45, 0.06), new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6 }));
  panel.geometry.translate(0.525, 0, 0);
  panel.position.set(DOOR.x - 0.55, podY + 1.25, F - 0.08);
  panel.rotation.y = 1.75; // swung out onto the portico
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }));
  flash.position.set(DOOR.x + 0.15, podY + 1.45, F - 0.35);
  flash.visible = false;
  door.add(dark, panel, flash);
  door.userData.update = (t, s) => { door.visible = !s.night; flash.visible = t >= SHOT_T && t < SHOT_T + 0.07; };

  // ---- shots -----------------------------------------------------------------------------------------------------
  const head = (p, h = 1.62) => ({ x: p.x, y: p.y + h, z: p.z });
  const shots = [
    { id: 'card1', dur: 4, black: 1, card: 'Palmetto Bay<small>Inauguration Day</small>' },
    { id: 'wide', dur: 6, fadeIn: 1.2, cam: (k) => ({ pos: lerpV({ x: cx + 38, y: podY + 16, z: F - 75 }, { x: cx + 16, y: podY + 8.5, z: F - 44 }, k), target: { x: cx, y: podY + 7, z: F - 3 } }) },
    { id: 'walt', dur: 5, cam: (k) => ({ pos: lerpV({ x: cx + 3.3, y: podY + 1.55, z: F - 9.8 }, { x: cx + 2.7, y: podY + 1.6, z: F - 9.0 }, k), target: head(WALT0, 1.55) }),
      sub: (t) => (t > 0.6 && t < 3.4 ? '<b>Voss (radio)</b> Two weeks, Walt. Then it’s fishing.' : t >= 3.6 ? '<b>Walt</b> Copy that.' : '') },
    { id: 'ots', dur: 5, cam: (k) => ({ pos: lerpV({ x: cx - 0.55, y: podY + 1.85, z: F - 4.9 }, { x: cx - 0.7, y: podY + 1.9, z: F - 5.2 }, k), target: { x: cx - 1.5, y: podY + 0.6, z: F - 20 } }) },
    { id: 'eyes', dur: 3.5, cam: (k) => ({ pos: lerpV({ x: cx + 0.7, y: podY + 1.62, z: F - 7.2 }, { x: cx + 0.78, y: podY + 1.64, z: F - 6.95 }, k), target: head(WALT0, 1.6) }) },
    { id: 'door', dur: 2.5, cam: (k) => ({ pos: lerpV({ x: cx - 1.2, y: podY + 1.55, z: F - 4.6 }, { x: cx - 1.8, y: podY + 1.5, z: F - 3.4 }, k), target: { x: DOOR.x, y: podY + 1.3, z: F } }),
      sub: '<b>Walt</b> …that door should be locked.' },
    { id: 'shot', dur: 4.5, rate: 0.3, shake: 1, ease: false, cam: (k) => ({ pos: lerpV({ x: cx - 4.6, y: podY + 1.6, z: F - 11.6 }, { x: cx - 4.2, y: podY + 1.55, z: F - 11.0 }, k), target: { x: cx + 0.2, y: podY + 1.3, z: F - 6.3 } }) },
    { id: 'low', dur: 4, rate: 0.6, cam: (k) => ({ pos: lerpV({ x: cx + 1.7, y: podY + 0.35, z: F - 9.4 }, { x: cx + 1.5, y: podY + 0.3, z: F - 9.0 }, k), target: { x: cx + 0.4, y: podY + 1.0, z: F - 6.0 } }) },
    { id: 'arms', dur: 6.5, fadeOut: 0.15, cam: (k) => ({ pos: lerpV({ x: cx + 2.0, y: podY + 1.25, z: F - 4.1 }, { x: cx + 1.7, y: podY + 1.1, z: F - 4.4 }, k), target: { x: cx + 0.3, y: podY + 0.55, z: F - 5.3 } }),
      sub: (t) => (t > 1.0 && t < 4.0 ? '<b>The President</b> …they were… inside…' : t >= 4.2 ? '<b>Walt</b> Stay with me. Stay with me—' : '') },
    { id: 'black', dur: 1.5, black: 1 },
    { id: 'card2', dur: 3, black: 1, card: 'Three days later' },
    { id: 'paper', dur: 5.5, black: 1, paper: `<div class="mast">The Palmetto Bay Herald</div><div class="date"><span>Late edition</span><span>Price 50¢</span></div>
      <h2>Bodyguard froze as President died</h2><p>Agent Walt Mercer, thirty years on the White House detail, has been suspended pending review. Police say the President was killed by a lone gunman who has not been found. Deputy Chief Harlan Voss now leads the detail. “Walt was a step away,” one witness said. “He just stood there.”</p>` },
    { id: 'night', dur: 5.5, night: 1, fadeIn: 1, cam: (k) => ({ pos: lerpV({ x: cx + 4.6, y: plazaY + 1.6, z: F - 15.0 }, { x: cx + 4.9, y: plazaY + 1.62, z: F - 15.4 }, k), target: { x: cx + 6, y: plazaY + 1.6, z: F - 17 } }),
      sub: (t) => (t > 1.5 ? '<b>Walt</b> Lone gunman. Sure.' : '') },
    { id: 'silhouette', dur: 6, night: 1, fadeOut: 1.6, cam: (k) => ({ pos: lerpV({ x: cx + 7.4, y: plazaY + 0.8, z: F - 21.5 }, { x: cx + 7.1, y: plazaY + 1.0, z: F - 20.6 }, k), target: { x: cx + 2.5, y: podY + 6, z: F } }) },
    { id: 'title', dur: 4, black: 1, card: 'BROKE<small>Chapter one · The Detail</small>' },
  ];

  // ---- sound -----------------------------------------------------------------------------------------------------
  const A = audio?.ctx ? audio : null;
  const bed = (at, dur, peak, freq, q) => { // a sustained filtered-noise bed (crowd murmur, screams)
    if (!A) return;
    const c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
    s.buffer = A.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + Math.min(1.5, dur / 3)); g.gain.setValueAtTime(peak, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(A.sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  };
  const cues = [
    { t: 0.2, fn: () => bed(0, 26, 0.05, 520, 0.5) }, // the crowd
    { t: 15.2, fn: () => bed(0, 3, 0.09, 1100, 0.7) }, // a cheer as he waves
    { t: 17.6, fn: () => bed(0, 2.5, 0.07, 1300, 0.7) },
    { t: 26.4, fn: () => { A?.play('revolver'); A?.play('gunshot'); } },
    { t: 26.6, fn: () => { bed(0, 4, 0.12, 1700, 1.6); A?.osc('sine', 3900, A.ctx.currentTime, 6, 0.025); } }, // screams; the ringing in his ears
    { t: 45.5, fn: () => A?.opening() },
    { t: 62.6, fn: () => A?.boom() },
  ];

  // Where play picks up: Walt across the street at night, facing the White House.
  const spawn = { x: cx + 6, y: plazaY + 0.05, z: F - 17, yaw: Math.PI + 0.2 };
  return { shots, cast: [president, walt, ...agents, ...crowd], props: [door], cues, spawn };
}
