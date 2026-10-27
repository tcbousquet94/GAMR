// The montage: a trailer for the game, cut from the live city. A few held moments first (him at a gravesite at dusk;
// a visitor on his porch at night asking for one last job; an aerial of a car running up a street), then a real street
// fight: your character fights a wave of the Vipers on autopilot (can't die) while a camera director cuts between
// action shots every couple of seconds (over the shoulder, low and in front, a reverse from behind the enemy, a side
// track, a high wide), a slow-motion close-up on every kill, and an explosion in the middle of it. Letterbox bars, a
// hard grade, and the title card at the end. control() feeds the player's input in place of the keyboard; update()
// runs the camera, the staged people and props, and the overlay. What it does to the game: moves him to an open
// junction for the fight, holds the Vipers back until the fight cuts in, and sets off the explosion.

import * as THREE from 'three';
import { RigType, rootMatrix } from './rig.js';
import { loModel } from './people/lo.js';
import { makePerson } from './people/person.js';
import { personMaterial } from './kit/people.js';
import { humanPose } from './models/humanoid.js';
import { Batch } from './kit/batch.js';
import { car as buildCar } from './kit/street.js';
import { kitMaterials } from './kit/materials.js';

const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const CSS = `
#montage{position:fixed;inset:0;z-index:30;pointer-events:none}
#montage .m-bar{position:absolute;left:0;right:0;height:10vh;background:#000;transition:height .6s}
#montage .m-bar.top{top:0}#montage .m-bar.bot{bottom:0}
#montage .m-fade{position:absolute;inset:0;background:#000;opacity:1}
#montage .m-white{position:absolute;inset:0;background:#fff;opacity:0}
#montage .m-card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#f2ece0;font:600 clamp(40px,9vw,110px)/1 'Cormorant Garamond',Georgia,serif;letter-spacing:.18em;opacity:0;transition:opacity .5s}
#montage .m-card small{font:italic 500 clamp(14px,2vw,22px)/1.4 'Cormorant Garamond',Georgia,serif;letter-spacing:.12em;margin-top:.6em;opacity:.8}
#montage .m-sub{position:absolute;left:8%;right:8%;bottom:12vh;text-align:center;color:#f2ece0;font:500 clamp(17px,2.6vw,28px)/1.3 'Cormorant Garamond',Georgia,serif;text-shadow:0 2px 6px #000;opacity:0;transition:opacity .35s}
#montage .m-sub b{font-variant:small-caps;letter-spacing:.06em;color:#d8c8a8;margin-right:.4em}
#montage .m-skip{position:absolute;right:18px;bottom:calc(10vh + 12px);pointer-events:auto;background:rgba(0,0,0,.45);color:#f2ece0;border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:8px 16px;font:600 15px 'Cormorant Garamond',Georgia,serif;letter-spacing:.08em;cursor:pointer}
`;
const GRADE = 'contrast(1.18) saturate(0.82) brightness(0.95)';
const PI = Math.PI;
// A sharp black suit, white shirt (the montage's look for him). People face -z at yaw 0, like the player.
export const SUIT = { top: { type: 'jacket', color: 0x141519, collar: 0x0c0c0e, worn: 0.05 }, under: { type: 'tee', color: 0xf0eeea },
  bottom: { type: 'slacks', color: 0x141519, worn: 0.05, belt: 0x0c0c0e }, shoes: { type: 'shoes', color: 0x0e0e10 } };

export class ActionMontage {
  constructor(game, view, { look = null, title = 'BROKE', tagline = '', onDone } = {}) {
    this.g = game;
    this.view = view;
    this.onDone = onDone;
    this.t = 0;
    this.done = false;
    this.target = null;
    this.yaw = game.player.yaw;
    this.pitch = 0;
    this.tick = 0;
    this.shot = null;
    this.shotT = 0;
    this.order = ['ots', 'low', 'reverse', 'side', 'ots', 'wide', 'low', 'reverse'];
    this.n = 0;
    this.white = 0;
    this.killQueue = null;
    this.walkAway = null; // the explosion beat: he walks off, the blast behind him
    this.off = game.events.on('kill', (d) => { if (d.pos && !this.killQueue && this.seg?.kind === 'combat') this.killQueue = { ...d.pos }; });
    this.nightWas = view.night || 0;
    this.props = new THREE.Group();
    view.scene.add(this.props);
    this.puppets = [];
    this.buildSets(look);
    this.moveToStreet();
    // The cut: held moments first, then the fight with the explosion in the middle, then the title.
    this.segs = [
      this.grave && { kind: 'grave', dur: 4.5, night: 0.55, grade: 'grayscale(0.55) contrast(1.15) brightness(0.9)' },
      this.porch && { kind: 'porch', dur: 5, night: 1, sub: (t) => (t > 1.2 ? '<b>Visitor</b> One last job, Walt.' : '') },
      this.car && { kind: 'car', dur: 4, night: 0.35 },
      { kind: 'combat', dur: 9, flash: 0.35 },
      { kind: 'boom', dur: 3.6 },
      { kind: 'combat', dur: 8 },
      { kind: 'title', dur: 3.2 },
    ].filter(Boolean);
    this.si = -1;
    this.segT = 0;
    view.camOverride = () => this.cam;
    this.cam = { pos: { x: 0, y: 30, z: 0 }, target: { x: 0, y: 0, z: -1 } };
    this.canvas = view.renderer?.domElement;
    if (!document.getElementById('m-style')) { const st = document.createElement('style'); st.id = 'm-style'; st.textContent = CSS; document.head.appendChild(st); }
    const el = (this.el = document.createElement('div'));
    el.id = 'montage';
    el.innerHTML = `<div class="m-bar top"></div><div class="m-bar bot"></div><div class="m-sub"></div><div class="m-white"></div><div class="m-fade"></div><div class="m-card">${title}${tagline ? `<small>${tagline}</small>` : ''}</div><button class="m-skip">Skip ›</button>`;
    document.body.appendChild(el);
    this.$ = { fade: el.querySelector('.m-fade'), white: el.querySelector('.m-white'), card: el.querySelector('.m-card'), sub: el.querySelector('.m-sub') };
    el.querySelector('.m-skip').onclick = () => this.finish();
    this.key = (e) => { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.finish(); } };
    addEventListener('keydown', this.key, true);
    this.nextSeg();
  }

  get seg() { return this.segs?.[this.si]; }

  // ---- staged sets: the grave, the porch, the car -------------------------------------------------------------
  puppet(spec, at) {
    const rig = new RigType(loModel(spec), 1, this.view.scene, { shadows: true });
    const pm = personMaterial();
    for (const m of rig.meshes) { m.material = pm; m.receiveShadow = true; }
    const p = { rig, at, scale: Math.max(0.88, Math.min(1.08, (spec.height || 1.8) / 1.8)) };
    this.puppets.push(p);
    return p;
  }

  buildSets(look) {
    const g = this.g, w = g.world, T = g.turf, D = g.city.kitData;
    const gy = (x, z, top = 4) => { const y = w.groundBelow(x, top, z, 0.2, 20); return Number.isFinite(y) ? y : 0.15; };
    const me = { ...(look || makePerson('walt-mercer')), outfit: SUIT };
    const stand = (t, i = 0) => {
      const p = humanPose({ phase: 0, speed: 0, t: t + i });
      p.armL = [0.05, 0, -0.1]; p.armR = [0.05, 0, 0.1]; p.foreL = [0.3, 0, 0]; p.foreR = [0.3, 0, 0];
      return p;
    };
    const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const box = (w_, h, d, c, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w_, h, d), mat(c)); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; return m; };

    // The grave: a headstone with a fresh mound, older stones around it, in the middle of a park.
    const park = T?.blocks.find((b) => b.zone === 'park');
    if (park) {
      const x = park.center.x, z = park.center.z, y = gy(x, z);
      const set = new THREE.Group();
      set.add(box(0.7, 1.0, 0.16, 0x8a8a88, x, y + 0.5, z), box(0.8, 0.1, 0.24, 0x7a7a78, x, y + 0.05, z));
      set.add(box(0.9, 0.18, 1.9, 0x4a3a2a, x, y + 0.09, z - 1.15)); // fresh earth
      set.add(box(0.12, 0.32, 0.12, 0xc8c4bc, x + 0.28, y + 0.16, z - 0.25), box(0.14, 0.1, 0.14, 0xb02a2a, x + 0.28, y + 0.36, z - 0.25)); // flowers
      for (const [dx, dz] of [[-2.4, 0.4], [2.5, -0.2], [-2.2, 3.2], [0.3, 3.4], [2.7, 3.0], [-4.6, 1.5], [4.8, 1.6]]) set.add(box(0.6, 0.85, 0.14, 0x7e7e7c, x + dx, y + 0.42, z + dz, (dx * 0.07)));
      this.props.add(set);
      set.userData.seg = 'grave';
      this.puppet(me, (t, seg) => {
        if (seg !== 'grave') return null;
        const p = stand(t, 1);
        p.head = [0.5, 0, 0]; p.torso = [-0.06, 0, 0];
        p.armL = [0.15, 0, -0.06]; p.foreL = [0.95, 0, 0.25]; p.armR = [0.15, 0, 0.06]; p.foreR = [0.95, 0, -0.25]; // hands folded
        return { x, y, z: z - 2.5, yaw: PI, pose: p }; // facing the stone (+z)
      });
      this.grave = { x, y, z };
    }

    // The porch: his front door at night, someone on the step.
    const house = (D.houses || []).filter((h) => h.porch).sort((a, b) => Math.hypot(a.x - g.player.pos.x, a.z - g.player.pos.z) - Math.hypot(b.x - g.player.pos.x, b.z - g.player.pos.z))[0];
    if (house) {
      const yaw = house.yaw ?? { s: 0, e: PI / 2, n: PI, w: -PI / 2 }[house.front ?? 's'];
      const d = { x: Math.sin(yaw), z: Math.cos(yaw) }, side = { x: d.z, z: -d.x };
      const door = { x: house.x + d.x * (house.d / 2), z: house.z + d.z * (house.d / 2) };
      const yW = gy(door.x + d.x * 0.6, door.z + d.z * 0.6, 3), yV = gy(door.x + d.x * 1.6, door.z + d.z * 1.6, 3);
      const walt = { x: door.x + d.x * 0.3, y: yW, z: door.z + d.z * 0.3 }, vis = { x: door.x + d.x * 1.55 + side.x * 0.2, y: yV, z: door.z + d.z * 1.55 + side.z * 0.2 };
      this.puppet({ ...me, outfit: { ...SUIT, top: { type: 'longsleeve', color: 0x2a2c30 } } }, (t, seg) => {
        if (seg !== 'porch') return null;
        const p = stand(t, 2); p.head = [0.05, 0, 0]; p.armR = [0.25, 0, 0.12]; p.foreR = [1.2, 0, 0]; // hand on the door frame
        return { ...walt, yaw: yaw + PI, pose: p }; // in the doorway, facing out
      });
      const visitor = { ...makePerson('the-visitor'), sex: 'm', age: 58, facial: { style: 'mustache' },
        outfit: { top: { type: 'jacket', color: 0x5a4a3a, collar: 0x2a2018, worn: 0.3 }, under: { type: 'tee', color: 0xd8d4cc }, bottom: { type: 'slacks', color: 0x2a2a2e }, shoes: { type: 'shoes', color: 0x1a1a1a } } };
      this.puppet(visitor, (t, seg) => {
        if (seg !== 'porch') return null;
        const p = stand(t, 5); p.head = [-0.05, 0, 0]; p.armL = [0.1, 0, -0.1]; p.foreL = [0.4, 0, 0];
        return { ...vis, yaw, pose: p }; // on the step, facing the door
      });
      const light = new THREE.PointLight(0xffc88a, 30, 10, 1.6);
      light.position.set(door.x + d.x * 0.8, yW + 2.6, door.z + d.z * 0.8);
      light.userData.seg = 'porch';
      this.props.add(light);
      this.porch = { walt, vis, d, side };
    }

    // The car: a long street, a sedan running up it.
    const road = (T?.roads.segments || []).filter((q) => q.open).map((q) => ({ q, L: q.axis === 'v' ? q.rect.z1 - q.rect.z0 : q.rect.x1 - q.rect.x0 })).filter((r) => r.L > 70).sort((a, b) => b.L - a.L)[0];
    if (road) {
      const r = road.q.rect, v = road.q.axis === 'v';
      const B = new Batch();
      buildCar(B, { x: 0, y: 0, z: 0, yaw: 0, color: 0x101418 }, null);
      const mesh = B.build(kitMaterials(), {});
      const a = v ? { x: r.x0 + (r.x1 - r.x0) * 0.68, z: r.z1 - 4 } : { x: r.x0 + 4, z: r.z0 + (r.z1 - r.z0) * 0.68 };
      const dir = v ? { x: 0, z: -1 } : { x: 1, z: 0 };
      mesh.rotation.y = Math.atan2(-dir.x, -dir.z); // the model's nose is -z
      mesh.userData.seg = 'car';
      this.props.add(mesh);
      this.car = { mesh, a, dir, y: gy(a.x, a.z) - 0.12, L: road.L };
    }
  }

  // The fight plays out in the open: he starts in the middle of a four-way junction near the centre of town (the
  // run begins in a container yard, too tight for the cameras); the Vipers spawn around him from there.
  moveToStreet() {
    const g = this.g, T = g.turf, w = g.world;
    const L = T?.landmarks?.[0], c = L ? { x: L.x, z: L.z } : { x: g.player.pos.x, z: g.player.pos.z };
    const junction = (T?.roads.intersections || []).filter((I) => I.degree >= 4)
      .sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))
      .find((I) => w.fits(I.x, 0.2, I.z, 0.6, 1.9));
    if (!junction) return;
    const y = w.groundBelow(junction.x, 3, junction.z, 0.3, 10);
    const P = g.player;
    Object.assign(P.body.pos, { x: junction.x, y: (Number.isFinite(y) ? y : 0) + 0.05, z: junction.z });
    P.body.vel = { x: 0, y: 0, z: 0 };
    P.lastSafe = { ...P.body.pos };
  }

  // ---- autopilot -------------------------------------------------------------------------------------------------
  pickTarget() {
    const g = this.g, P = g.player.pos, eye = { x: P.x, y: P.y + 1.6, z: P.z };
    let best = null, bd = Infinity;
    for (const e of g.enemies) {
      if (!e.alive || e.loiter) continue;
      const c = e.center(), d = Math.hypot(c.x - P.x, c.z - P.z);
      const score = d + (d < 45 && g.world.segmentClear(eye, c) ? 0 : 60);
      if (score < bd) { bd = score; best = e; }
    }
    return best;
  }

  control() {
    const g = this.g, p = g.player, P = p.pos;
    this.tick++;
    const input = { moveX: 0, moveZ: 0, yaw: this.yaw, pitch: this.pitch, sprint: false, aim: false, primary: false, reload: false };
    if (p.gun && p.gun.ammo < 2) input.reload = true;
    // Before the fight cuts in he holds still (the staged shots are elsewhere and the Vipers are on their way).
    const k = this.seg?.kind;
    if (k !== 'combat' && k !== 'boom') return input;
    // The explosion beat: a slow walk away from it, no looking back.
    if (this.walkAway) { this.pitch *= 0.9; input.yaw = this.yaw = this.walkAway.yaw; input.pitch = this.pitch; input.moveZ = 0.42; return input; }
    if (!this.target?.alive || this.tick % 30 === 0) this.target = this.pickTarget();
    const e = this.target;
    if (!e) { input.moveZ = 0.4; return input; }
    const c = e.center(), dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz);
    const wantYaw = yawTo(dx, dz), wantPitch = Math.atan2(c.y - (P.y + 1.55), d);
    this.yaw = wrap(this.yaw + wrap(wantYaw - this.yaw) * 0.16);
    this.pitch += (wantPitch - this.pitch) * 0.16;
    const lined = Math.abs(wrap(wantYaw - this.yaw)) < 0.07;
    const seen = d < 40 && g.world.segmentClear({ x: P.x, y: P.y + 1.6, z: P.z }, c);
    input.yaw = this.yaw; input.pitch = this.pitch;
    if (seen && d < 32) {
      input.aim = true;
      input.primary = lined && this.tick % 2 === 0; // click per shot: press, release
      input.moveX = Math.sin(this.t * 0.9) > 0 ? 0.6 : -0.6; // strafe while shooting
      input.moveZ = d > 16 ? 0.5 : d < 7 ? -0.6 : 0;
    } else { input.moveZ = 1; input.sprint = true; }
    return input;
  }

  // ---- shots ---------------------------------------------------------------------------------------------------
  clear(a, b) { const w = this.g.world; return w.fits(a.x, a.y - 0.5, a.z, 0.3, 0.7) && w.segmentClear(a, b); }
  basis() { const P = this.g.player.pos, f = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; return { P, f, r: { x: -f.z, z: f.x } }; }
  aimPoint() { const e = this.target, { P, f } = this.basis(); return e?.alive ? e.center() : { x: P.x + f.x * 20, y: P.y + 1.4, z: P.z + f.z * 20 }; }

  // Combat: a kill gets a slow-motion close-up; otherwise the next shot in the rotation with a clear view.
  cut() {
    this.shotT = 0;
    if (this.killQueue) {
      const k = this.killQueue;
      this.killQueue = null;
      const s = this.killShot(k);
      if (s) { this.shot = s; this.g.doSlowmo?.(1.3, 0.22); this.white = 0.5; return; }
    }
    for (let i = 0; i < this.order.length; i++) { const s = this[this.order[this.n++ % this.order.length]](); if (s) { this.shot = s; return; } }
    this.shot = this.ots();
  }
  ots() {
    return { dur: 2.2, at: () => { const { P, f, r } = this.basis(); return { pos: { x: P.x + r.x * 0.62 - f.x * 1.7, y: P.y + 1.78, z: P.z + r.z * 0.62 - f.z * 1.7 }, target: this.aimPoint() }; } };
  }
  low() {
    const { P, f, r } = this.basis(), f0 = { ...f }, r0 = { ...r };
    if (!this.clear({ x: P.x + f0.x * 3.2 + r0.x * 1.1, y: P.y + 0.55, z: P.z + f0.z * 3.2 + r0.z * 1.1 }, { x: P.x, y: P.y + 1.5, z: P.z })) return null;
    return { dur: 1.8, at: (k) => { const Q = this.g.player.pos; return { pos: { x: Q.x + f0.x * (3.2 - k * 0.5) + r0.x * 1.1, y: Q.y + 0.55, z: Q.z + f0.z * (3.2 - k * 0.5) + r0.z * 1.1 }, target: { x: Q.x, y: Q.y + 1.45, z: Q.z } }; } };
  }
  reverse() {
    const e = this.target;
    if (!e?.alive) return null;
    const P = this.g.player.pos, c = e.center(), dx = P.x - c.x, dz = P.z - c.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
    const at = () => { const q = e.center(); return { x: q.x - ux * 1.7 + uz * 0.7, y: q.y + 0.75, z: q.z - uz * 1.7 - ux * 0.7 }; };
    const you = () => { const Q = this.g.player.pos; return { x: Q.x, y: Q.y + 1.3, z: Q.z }; };
    if (!this.clear(at(), you())) return null;
    let last = at();
    return { dur: 1.7, at: () => { if (e.alive) last = at(); return { pos: last, target: you() }; } };
  }
  side() {
    const { P, r } = this.basis(), s = Math.sin(this.t) > 0 ? 1 : -1, r0 = { x: r.x * s, z: r.z * s };
    if (!this.clear({ x: P.x + r0.x * 5, y: P.y + 1.3, z: P.z + r0.z * 5 }, { x: P.x, y: P.y + 1.3, z: P.z })) return null;
    return { dur: 2.0, at: () => { const Q = this.g.player.pos; return { pos: { x: Q.x + r0.x * 5, y: Q.y + 1.3, z: Q.z + r0.z * 5 }, target: { x: Q.x, y: Q.y + 1.25, z: Q.z } }; } };
  }
  wide() {
    const { P, f, r } = this.basis(), f0 = { ...f }, r0 = { ...r };
    if (!this.clear({ x: P.x - f0.x * 9 + r0.x * 7, y: P.y + 9, z: P.z - f0.z * 9 + r0.z * 7 }, { x: P.x, y: P.y + 1, z: P.z })) return null;
    return { dur: 2.4, at: (k) => { const Q = this.g.player.pos, A = this.aimPoint(); return { pos: { x: Q.x - f0.x * 9 + r0.x * 7, y: Q.y + 9 - k * 3, z: Q.z - f0.z * 9 + r0.z * 7 }, target: { x: (Q.x + A.x) / 2, y: Q.y + 1, z: (Q.z + A.z) / 2 } }; } };
  }
  killShot(k) {
    const P = this.g.player.pos, dx = k.x - P.x, dz = k.z - P.z, l = Math.hypot(dx, dz) || 1;
    for (const side of [1, -1]) {
      const a = { x: k.x - (dx / l) * 2.2 + (-dz / l) * 1.6 * side, y: k.y + 1.0, z: k.z - (dz / l) * 2.2 + (dx / l) * 1.6 * side }, b = { x: k.x, y: k.y + 0.7, z: k.z };
      if (this.clear(a, b)) return { dur: 1.5, kill: true, at: (q) => ({ pos: { x: a.x, y: a.y - q * 0.3, z: a.z }, target: { x: b.x, y: b.y - q * 0.4, z: b.z } }) };
    }
    return null;
  }

  // The explosion: a blast where the Vipers are thickest (or just behind him), and he walks toward the camera.
  startBoom() {
    const g = this.g, P = g.player.pos, { f } = this.basis();
    const near = g.enemies.filter((e) => e.alive && Math.hypot(e.pos.x - P.x, e.pos.z - P.z) < 30);
    const at = near.length ? near.reduce((a, e) => ({ x: a.x + e.pos.x / near.length, y: P.y, z: a.z + e.pos.z / near.length }), { x: 0, y: 0, z: 0 }) : { x: P.x - f.x * 8, y: P.y, z: P.z - f.z * 8 };
    // He turns his back on it.
    const away = { x: P.x - at.x, z: P.z - at.z }, l = Math.hypot(away.x, away.z) || 1;
    this.walkAway = { yaw: yawTo(away.x / l, away.z / l), at, dir: { x: away.x / l, z: away.z / l }, fired: false };
  }
  detonate() {
    const g = this.g, B = this.walkAway, at = B.at;
    B.fired = true;
    g.events.emit('explosion', { pos: { x: at.x, y: at.y + 0.6, z: at.z }, radius: 6 });
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - at.x, dz = e.pos.z - at.z, d = Math.hypot(dx, dz);
      if (d < 7) g.combat.hitEnemy(e, { damage: 400, proc: 1, source: 'explosion', pos: e.center(), knock: { x: (dx / (d || 1)) * 14, y: 9, z: (dz / (d || 1)) * 14 } });
    }
    // A fireball and a flash of light over the game's own burst and shockwave.
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.95, depthWrite: false }));
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0x2a2624, transparent: true, opacity: 0.85, depthWrite: false, roughness: 1 }));
    const light = new THREE.PointLight(0xffa050, 400, 40, 1.4);
    ball.position.set(at.x, at.y + 1.5, at.z); smoke.position.copy(ball.position); light.position.set(at.x, at.y + 3, at.z);
    this.props.add(ball, smoke, light);
    this.fire = { ball, smoke, light, t: 0 };
  }

  // ---- the timeline --------------------------------------------------------------------------------------------
  nextSeg() {
    this.si++;
    this.segT = 0;
    const s = this.seg;
    if (!s) { this.finish(); return; }
    if (s.flash) this.white = s.flash;
    if (s.kind === 'combat') this.cut();
    if (s.kind === 'boom') this.startBoom();
    if (s.kind !== 'boom') this.walkAway = null;
    this.view.setNight?.(s.night ?? 0);
    if (this.canvas) this.canvas.style.filter = s.grade || GRADE;
    for (const o of this.props.children) if (o.userData.seg) o.visible = o.userData.seg === s.kind;
  }

  staged(s, k) {
    if (s.kind === 'grave') { const G = this.grave; return { pos: { x: G.x + 3.6 - k * 1.0, y: G.y + 1.7 - k * 0.2, z: G.z - 5.6 + k * 1.2 }, target: { x: G.x + 0.2, y: G.y + 1.05, z: G.z - 1.2 } }; }
    if (s.kind === 'porch') {
      const { walt, vis, d, side } = this.porch;
      // Wide on the two of them, then over the visitor's shoulder onto him.
      const wide = { x: vis.x + d.x * 5 + side.x * 3, y: vis.y + 1.9, z: vis.z + d.z * 5 + side.z * 3 };
      const ots = { x: vis.x + d.x * 0.9 + side.x * 0.55, y: vis.y + 1.72, z: vis.z + d.z * 0.9 + side.z * 0.55 };
      const q = Math.min(1, Math.max(0, (k - 0.35) / 0.2)), e = q * q * (3 - 2 * q);
      return { pos: { x: wide.x + (ots.x - wide.x) * e, y: wide.y + (ots.y - wide.y) * e, z: wide.z + (ots.z - wide.z) * e }, target: { x: walt.x, y: walt.y + 1.55, z: walt.z } };
    }
    if (s.kind === 'car') {
      const C = this.car, dist = Math.min(C.L - 10, 15 + k * 60), p = { x: C.a.x + C.dir.x * dist, z: C.a.z + C.dir.z * dist };
      C.mesh.position.set(p.x, C.y, p.z);
      return { pos: { x: p.x - C.dir.x * 16 + C.dir.z * 4, y: C.y + 17 - k * 3, z: p.z - C.dir.z * 16 - C.dir.x * 4 }, target: { x: p.x + C.dir.x * 6, y: C.y, z: p.z + C.dir.z * 6 } };
    }
    if (s.kind === 'boom') {
      // In front of him, low: he walks toward us, the blast going up behind him.
      const P = this.g.player.pos, W = this.walkAway, a = { x: P.x + W.dir.x * 5.5 + W.dir.z * 0.8, y: P.y + 1.1, z: P.z + W.dir.z * 5.5 - W.dir.x * 0.8 };
      if (!W.fired && this.segT > 0.5) this.detonate();
      this.boomCam = this.boomCam && k > 0 ? this.boomCam : a;
      return { pos: { x: this.boomCam.x + (a.x - this.boomCam.x) * 0.02, y: a.y, z: this.boomCam.z + (a.z - this.boomCam.z) * 0.02 }, target: { x: P.x, y: P.y + 1.5, z: P.z } };
    }
    return this.cam;
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    this.segT += dt;
    let s = this.seg;
    if (this.segT >= s.dur) { this.nextSeg(); s = this.seg; if (!s) return; }
    const k = Math.min(1, this.segT / s.dur);
    // The Vipers: held back through the opening shots, sent (a bigger wave) when the car shot starts so they arrive
    // as the fight cuts in, then no long breaks between waves.
    const A = this.g.arcade;
    if (A) {
      const fightIdx = this.segs.findIndex((q) => q.kind === 'car' || q.kind === 'combat');
      if (this.si < fightIdx && A.phase === 'break') A.timer = Math.max(A.timer, 5);
      else if (A.phase === 'break') { if (A.wave < 2) A.wave = 2; A.timer = Math.min(A.timer, 0.8); }
    }
    if (s.kind === 'combat') {
      this.shotT += dt;
      if (this.shotT >= this.shot.dur || (this.killQueue && !this.shot.kill && this.shotT > 0.5)) this.cut();
      this.cam = this.shot.at(Math.min(1, this.shotT / this.shot.dur));
    } else if (s.kind !== 'title') this.cam = this.staged(s, k);
    // The staged people.
    const m4 = new THREE.Matrix4();
    for (const p of this.puppets) {
      p.rig.begin();
      const q = p.at(this.t, s.kind);
      if (q) { rootMatrix(q.x, q.y, q.z, q.yaw, p.scale, m4); p.rig.add(m4, q.pose); }
      p.rig.end();
    }
    // The fireball grows and fades into smoke.
    if (this.fire) {
      const F = this.fire;
      F.t += dt;
      F.ball.scale.setScalar(1 + F.t * 9); F.ball.material.opacity = Math.max(0, 0.95 - F.t * 1.6);
      F.smoke.scale.setScalar(1.5 + F.t * 5); F.smoke.position.y += dt * 2.2; F.smoke.material.opacity = Math.max(0, 0.85 - F.t * 0.35);
      F.light.intensity = Math.max(0, 400 * (1 - F.t * 1.8));
      if (F.t > 2.6) { this.props.remove(F.ball, F.smoke, F.light); this.fire = null; }
    }
    // Overlay: subtitle, flashes, fade up at the start, the title over black at the end.
    const sub = typeof s.sub === 'function' ? s.sub(this.segT) : '';
    if (this.$.sub.dataset.h !== sub) { this.$.sub.dataset.h = sub; this.$.sub.innerHTML = sub; }
    this.$.sub.style.opacity = sub ? 1 : 0;
    this.white = Math.max(0, this.white - dt * 2.5);
    if (this.fire && this.fire.t < 0.12) this.white = Math.max(this.white, 0.7);
    this.$.white.style.opacity = this.white.toFixed(3);
    const black = s.kind === 'title' ? 1 : Math.max(0, 1 - this.t / 0.8, this.si > 0 && this.segT < 0.12 ? 1 - this.segT / 0.12 : 0);
    this.$.fade.style.opacity = black.toFixed(3);
    this.$.card.style.opacity = s.kind === 'title' ? 1 : 0;
    if (s.kind === 'title' && !this.titled) { this.titled = true; this.onTitle?.(); }
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.off?.();
    removeEventListener('keydown', this.key, true);
    for (const p of this.puppets) for (const m of p.rig.meshes) { this.view.scene?.remove(m); m.geometry.dispose(); }
    this.view.scene?.remove(this.props);
    this.view.camOverride = null;
    this.view.setNight?.(this.nightWas);
    if (this.canvas) this.canvas.style.filter = '';
    this.el.remove();
    this.onDone?.();
  }
}
