import * as THREE from 'three';
import { Town } from './areas/town/Town.js';

// Owns the explorable areas. Builds each one on first visit and keeps it cached, swaps
// `game.world` to the active one, and handles door triggers + the fade between areas.

const FADE_TIME = 0.35;

export const AREAS = {
  town: (game) => new Town(game),
};

export class AreaManager {
  constructor(game) {
    this.game = game;
    this.cache = new Map();
    this.current = null;
    this.busy = false;        // true while fading between areas (player input frozen)
    this.fadeT = 0;
    this.fadeDir = 0;         // +1 fading to black, -1 fading in
    this.pending = null;
    this.latch = null;        // the door the player is standing in (fires once per entry)

    this.fadeEl = document.createElement('div');
    Object.assign(this.fadeEl.style, {
      position: 'fixed', inset: '0', background: '#160f22', opacity: '0', pointerEvents: 'none', zIndex: '20',
    });
    document.body.appendChild(this.fadeEl);
  }

  get(id) {
    if (!this.cache.has(id)) {
      const make = AREAS[id];
      if (!make) return null;
      this.cache.set(id, make(this.game));
    }
    return this.cache.get(id);
  }

  has(id) {
    return !!AREAS[id];
  }

  // Swap areas immediately and put the party at `spawnName`.
  load(id, spawnName = 'default') {
    const game = this.game;
    const area = this.get(id);
    if (!area) throw new Error(`Unknown area "${id}"`);
    if (this.current) {
      game.scene.remove(this.current.root);
      this.current.exit();
    }
    this.current = area;
    game.world = area;
    game.scene.add(area.root);
    game.scene.background = new THREE.Color(area.background);
    game.scene.fog = area.fog ? new THREE.Fog(area.fog.color, area.fog.near, area.fog.far) : null;
    area.enter();

    const spawn = area.spawns[spawnName] ?? area.spawns.default;
    const player = game.player;
    if (player && spawn) {
      player.object3d.position.copy(spawn.pos);
      player.object3d.rotation.y = spawn.yaw;
      player.vel?.set(0, 0, 0);
      player.knockback?.set(0, 0, 0);
      player.vy = 0;
      this.latch = this.doorAt(player.object3d.position); // don't re-trigger a door we spawned in
    }
    if (game.party?.length && game.partyTrail) game.partyTrail.reset();
    const rig = game.cameraRig;
    if (rig && spawn) {
      rig.yaw = spawn.yaw;
      rig._computeGameplay?.(0);
    }
    game.events.emit('area', { id, spawn: spawnName });
  }

  // Fade out, swap, fade in.
  go(id, spawnName) {
    if (this.busy) return;
    this.busy = true;
    this.pending = { id, spawnName };
    this.fadeDir = 1;
    this.fadeT = 0;
    this.game.events.emit('sfx', { name: 'dodge' });
  }

  doorAt(p) {
    const doors = this.current?.doors ?? [];
    for (const d of doors) {
      if (p.x >= d.minX && p.x <= d.maxX && p.z >= d.minZ && p.z <= d.maxZ) return d;
    }
    return null;
  }

  update(rawDt) {
    const game = this.game;
    if (this.fadeDir !== 0) {
      this.fadeT += rawDt / FADE_TIME;
      if (this.fadeDir > 0) {
        this.fadeEl.style.opacity = String(Math.min(1, this.fadeT));
        if (this.fadeT >= 1) {
          this.load(this.pending.id, this.pending.spawnName);
          this.pending = null;
          this.fadeDir = -1;
          this.fadeT = 0;
        }
      } else {
        this.fadeEl.style.opacity = String(Math.max(0, 1 - this.fadeT));
        if (this.fadeT >= 1) {
          this.fadeDir = 0;
          this.busy = false;
        }
      }
      return;
    }

    if (game.mode !== 'explore' || !game.started || !game.player?.alive) return;
    const d = this.doorAt(game.player.object3d.position);
    if (d === this.latch) return;
    this.latch = d;
    if (!d) return;
    if (d.to && this.has(d.to)) this.go(d.to, d.spawn);
    else {
      const msg = d.message ?? { speaker: '', text: "The doors are locked. A sticky note says: \"Back in 5 minutes. —The School\"" };
      game.events.emit('dialogue', { speaker: msg.speaker ?? '', text: msg.text, duration: msg.duration ?? 4 });
      game.events.emit('sfx', { name: 'denied' });
    }
  }
}
