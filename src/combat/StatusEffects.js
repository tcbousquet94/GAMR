import * as THREE from 'three';
import { STATUS } from '../core/config.js';

// Per-combatant status container. The OWNER calls status.update(dt) each frame.
// Names are config keys (e.g. 'embarrassed').
export class StatusSet {
  constructor(owner, events) {
    this.owner = owner;
    this.events = events;
    this.list = new Map(); // name -> remaining seconds
  }

  add(name, duration) {
    const def = STATUS[name];
    const d = duration ?? def?.defaultDuration ?? 5;
    const refreshed = this.list.has(name);
    // Refresh (never shorten an existing longer timer).
    this.list.set(name, refreshed ? Math.max(this.list.get(name), d) : d);
    const o = this.owner;
    if (!refreshed && name === 'embarrassed') o?.setBlush?.(true);
    this.events?.emit('status:add', { target: o, name, duration: this.list.get(name), refreshed });
    if (name === 'embarrassed' && o?.team === 'hero') {
      const position = o.object3d
        ? new THREE.Vector3().copy(o.object3d.position).setY(o.object3d.position.y + (o.height || 1.7) + 0.3)
        : null;
      this.events?.emit('popup', { text: 'Embarrassed!', style: 'status', position });
      this.events?.emit('sfx', { name: 'status' });
    }
    return this;
  }

  has(name) {
    return this.list.has(name);
  }

  remove(name) {
    if (!this.list.has(name)) return;
    this.list.delete(name);
    if (name === 'embarrassed') this.owner?.setBlush?.(false);
    this.events?.emit('status:remove', { target: this.owner, name, duration: 0 });
  }

  clear() {
    for (const name of [...this.list.keys()]) this.remove(name);
  }

  update(dt) {
    if (this.list.size === 0) return;
    for (const [name, t] of this.list) {
      const left = t - dt;
      if (left <= 0) this.remove(name);
      else this.list.set(name, left);
    }
  }

  speedMul() {
    return this.list.has('embarrassed') ? STATUS.embarrassed.speedMul : 1;
  }

  attackScale() {
    return this.list.has('embarrassed') ? STATUS.embarrassed.attackScale : 1;
  }
}
