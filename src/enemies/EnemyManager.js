import * as THREE from 'three';
import { DEFEAT_LINES } from '../core/config.js';
import { pick } from '../core/math.js';
import { Locker } from './Locker.js';
import { GroupChat } from './GroupChat.js';
import { HallMonitor } from './HallMonitor.js';

const TYPES = { locker: Locker, groupchat: GroupChat, hallmonitor: HallMonitor };

const DEFEAT_LINE = {
  locker: 'The locker spat out a gym sock and calmed down.',
  groupchat: 'Muted. Ahh, peace and quiet.',
  hallmonitor: 'Hank wrote himself a detention slip.',
};

const TITLES = [
  'First Period', 'Pop Quiz', 'The Cafeteria Incident', 'Group Project', 'Picture Day',
  'Surprise Fire Drill', 'Pep Rally', 'Detention', 'Finals Week', 'Summer School',
];

const FALLBACK_SPAWNS = [
  new THREE.Vector3(12, 0, 12), new THREE.Vector3(-12, 0, 12), new THREE.Vector3(12, 0, -12),
  new THREE.Vector3(-12, 0, -12), new THREE.Vector3(0, 0, 16),
];

export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.list = [];   // alive enemies
    this.all = [];    // alive + dying (still in the scene)
    this.pending = []; // { type, pos, t, hpMul }
    this.wave = 0;
    this.waveActive = false;
    this.nextWaveT = -1;
    this.begun = false;

    game.events.on('defeat', ({ target }) => this.onDefeat(target));
    game.events.on('game:start', () => this.begin());
    if (game.started) this.begin();
  }

  begin() {
    if (this.begun) return;
    this.begun = true;
    this.startWave(1);
  }

  waveComposition(n) {
    const i = n - 1;
    return {
      locker: Math.min(4, 2 + Math.ceil(i / 2)),
      groupchat: Math.min(3, 2 + Math.floor(i / 2)),
      hallmonitor: Math.min(2, 1 + Math.floor(i / 2)),
      hpMul: 1 + 0.12 * i,
    };
  }

  startWave(n) {
    this.wave = n;
    this.waveActive = true;
    this.nextWaveT = -1;
    const title = `Wave ${n}: ${TITLES[n - 1] ?? 'Overtime'}`;
    this.game.events.emit('wave', { index: n, title });

    const comp = this.waveComposition(n);
    const types = [];
    for (const k of ['hallmonitor', 'locker', 'groupchat']) for (let j = 0; j < comp[k]; j++) types.push(k);

    // spawn points farthest from the player first
    const spawns = (this.game.world?.enemySpawns?.length ? this.game.world.enemySpawns : FALLBACK_SPAWNS).slice();
    const pp = this.game.player?.object3d?.position;
    if (pp) spawns.sort((a, b) => Math.hypot(b.x - pp.x, b.z - pp.z) - Math.hypot(a.x - pp.x, a.z - pp.z));
    types.forEach((type, idx) => {
      const sp = spawns[idx % spawns.length];
      const a = Math.random() * Math.PI * 2, r = idx >= spawns.length ? 1.5 + Math.random() : Math.random() * 0.8;
      const pos = new THREE.Vector3(sp.x + Math.cos(a) * r, sp.y ?? 0, sp.z + Math.sin(a) * r);
      this.pending.push({ type, pos, t: 0.4 + idx * 0.3, hpMul: comp.hpMul });
    });
  }

  spawn(type, pos, hpMul = 1) {
    const E = TYPES[type];
    const e = new E(this.game, { hpMul });
    e.kind = type;
    e.manager = this;
    e.spawnAt(pos);
    this.game.scene.add(e.object3d);
    this.game.combatants.push(e);
    this.all.push(e);
    this.list.push(e);
    const p = e.object3d.position;
    this.game.combat?.spawnPoof?.(new THREE.Vector3(p.x, p.y + 0.8, p.z), 1);
    return e;
  }

  onDefeat(target) {
    if (!target || target.team !== 'enemy' || !this.all.includes(target)) return;
    const ev = this.game.events;
    const p = target.object3d.position;
    ev.emit('popup', { text: DEFEAT_LINE[target.kind] ?? 'It calmed down.', position: new THREE.Vector3(p.x, p.y + target.height + 0.5, p.z), style: 'info' });
    ev.emit('popup', { text: pick(DEFEAT_LINES), position: null, style: 'heal' });
    ev.emit('sfx', { name: 'defeat' });
  }

  getNearest(pos, maxDist = Infinity, filter = null) {
    let best = null, bestD = maxDist;
    for (const e of this.list) {
      if (!e.alive || (filter && !filter(e))) continue;
      const p = e.object3d.position;
      const d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  update(dt) {
    // staggered spawns
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const s = this.pending[i];
      s.t -= dt;
      if (s.t <= 0) {
        this.spawn(s.type, s.pos, s.hpMul);
        this.pending.splice(i, 1);
      }
    }

    for (let i = this.all.length - 1; i >= 0; i--) {
      const e = this.all[i];
      e.update(dt);
      if (e.removed) {
        this.game.scene.remove(e.object3d);
        const ci = this.game.combatants.indexOf(e);
        if (ci >= 0) this.game.combatants.splice(ci, 1);
        this.all.splice(i, 1);
      }
    }
    // rebuild alive list in place
    this.list.length = 0;
    for (const e of this.all) if (e.alive) this.list.push(e);

    if (this.waveActive && this.pending.length === 0 && this.list.length === 0) {
      this.waveActive = false;
      this.nextWaveT = 4;
    }
    if (this.nextWaveT > 0) {
      this.nextWaveT -= dt;
      if (this.nextWaveT <= 0) this.startWave(this.wave + 1);
    }
  }
}
