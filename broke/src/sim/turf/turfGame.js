// The turf-war simulation (Part 1: the city). Reuses the kept systems (player movement and combat feel,
// projectiles, physics, the generated world) from the roguelike Game and leaves the retired ones (director waves,
// difficulty clock, subway exit, item shops) constructed but disconnected: they are never stepped.
//
// All state changes arrive as commands (see ../commands.js). step(input) is a convenience for the local player:
// it submits a `control` command for the leader and then advances one tick.

import { DT } from '../../core/config.js';
import { Game, EMPTY_INPUT } from '../game.js';
import { generateTurf } from '../../city/turf/generate.js';
import { DOWNTOWN } from '../../city/turf/districts/downtown.js';
import { CommandQueue } from '../commands.js';
import { TYPES } from '../../city/turf/business.js';

export const LEADER = 'gang0:leader';

export class TurfGame extends Game {
  constructor({ seed = 1, district = DOWNTOWN, survivor, city = null, startMinutes = 0 }) {
    const c = city || generateTurf(district, seed);
    super({ seed, district, survivor, city: c, startMinutes });
    this.mode = 'turf';
    this.turf = c.turf;
    this.director.enabled = false; // retired: no roguelike waves
    this.tick = 0;
    this.commands = new CommandQueue();
    this.controls = {};
    this.actors = { [LEADER]: this.player };
  }

  submit(cmd) { return this.commands.submit(this, cmd); }

  step(input = null, dt = DT) {
    if (input) this.submit({ type: 'control', actor: LEADER, input });
    this.tick++;
    this.commands.run(this, this.tick);
    this.time += dt;
    if (this.slowmo > 0) {
      this.slowmo -= dt / Math.max(0.05, this.timeScale);
      if (this.slowmo <= 0) { this.timeScale = 1; this.slowmo = 0; }
    }
    if (this.state === 'playing') this.player.update(dt, this.controls[LEADER] || EMPTY_INPUT);
    for (const e of this.enemies) if (e.alive) e.update(dt);
    this.separate();
    this.projectiles.update(dt);
    this.pickups.update(dt);
  }

  // ---- queries for the HUD / map ------------------------------------------------------------------------------------
  compassTarget() { const l = this.turf.landmarks[0]; return { x: l.x, z: l.z }; }

  blockAt(x, z) {
    for (const b of this.turf.blocks) for (const r of b.rects) if (x >= r.x0 - 4 && x <= r.x1 + 4 && z >= r.z0 - 4 && z <= r.z1 + 4) return b;
    return null;
  }

  objective() {
    const b = this.blockAt(this.player.pos.x, this.player.pos.z);
    if (!b) return `${this.turf.district.name} \u00b7 the spire is your compass`;
    if (b.territory == null) return `Block ${b.id} \u00b7 unclaimed`;
    const w = this.turf.warehouses[b.territory];
    return `Block ${b.id} \u00b7 ${w.name} territory`;
  }

  // The base or business you're standing at (door, gate, register, safe), for the HUD banner.
  businessNear(p, r) {
    let best = null, bd = r;
    const consider = (q, site) => { const d = Math.hypot(q.x - p.x, q.z - p.z) + Math.abs(q.y - p.y) * 0.5; if (d < bd) { bd = d; best = site; } };
    for (const b of this.turf.businesses) for (const q of [b.door, b.capture, b.backDoor]) consider(q, { ...b, label: TYPES[b.type].label });
    for (const w of this.turf.warehouses) {
      const gate = { x: (w.gate.x0 + w.gate.x1) / 2, y: 0, z: (w.gate.z0 + w.gate.z1) / 2 };
      for (const q of [gate, w.safe, w.yardSpawn]) consider(q, { ...w, label: `Warehouse \u00b7 controls ${w.businesses.length} business${w.businesses.length > 1 ? 'es' : ''}`, block: w.block });
    }
    return best;
  }
}
