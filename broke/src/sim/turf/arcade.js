// Street fights: the turf war's arcade loop. The Vipers come at you in waves; you score for every one you drop
// (more for headshots, more again while a kill streak keeps the combo going), for clearing a wave, and for every
// second you stay standing. Power-ups drop from the fallen and turn up on the street. The run ends when you go down;
// the final score is what the leaderboard keeps.
//
// Pure sim, driven by TurfGame.step; the HUD and the game-over screen read it.

export const ARCADE = {
  breakSeconds: 6, // between waves
  maxAlive: 7, // at once (phones draw every one of them)
  comboWindow: 4, // seconds a streak survives without a kill
  points: { gunman: 100, bruiser: 80, heavy: 250 },
  headshot: 50,
  waveBonus: 300, // x wave number
  perSecond: 2,
  dropChance: { gunman: 0.18, bruiser: 0.18, heavy: 0.6 },
  fieldEvery: 28, // seconds between power-ups turning up on the street
};

// Power-ups: instant (medkit, armor) or timed (seconds).
export const POWERS = {
  medkit: { name: 'Medkit', desc: '+60 health', color: 0xe8483a },
  armor: { name: 'Body Armor', desc: 'Soaks the next 60 damage', color: 0x4a8ad8 },
  double: { name: 'Double Damage', desc: 'Every round hits twice as hard', color: 0xe8642a, time: 12 },
  rapid: { name: 'Rapid Fire', desc: 'Fast hammer, no reloads', color: 0xf0c030, time: 10 },
  speed: { name: 'Adrenaline', desc: 'Run 35% faster', color: 0x3ac08a, time: 12 },
  score: { name: 'Score x2', desc: 'Double points', color: 0xc05ad8, time: 15 },
};
const POWER_IDS = Object.keys(POWERS);

// What a wave sends: more of them, tougher, with bruisers from wave 2 and heavies from wave 3.
export function waveMix(n) {
  const count = 3 + n * 2 + Math.floor(n / 3) * 2;
  const heavy = n >= 3 ? Math.min(4, Math.floor((n - 1) / 2)) : 0;
  const bruiser = n >= 2 ? Math.round((count - heavy) * 0.35) : 0;
  return { count, heavy, bruiser, gunman: count - heavy - bruiser, level: 1 + (n - 1) * 0.35 };
}

export class Arcade {
  constructor(game) {
    this.game = game;
    this.wave = 0;
    this.phase = 'break';
    this.timer = 3; // a short breath before wave 1
    this.queue = [];
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.time = 0;
    this.combo = { n: 0, t: 0 };
    this.best = { n: 0 };
    this.powers = {}; // id -> seconds left
    this.fieldT = ARCADE.fieldEvery * 0.6;
    this.over = false;
    this.lastPart = new Map();
    this.secondCarry = 0;
    const E = game.events;
    this.off = [
      E.on('hit', (d) => { if (d.id != null) this.lastPart.set(d.id, d.part); }),
      E.on('kill', (d) => this.onKill(d)),
      E.on('playerDeath', () => this.finish()),
    ];
  }

  get mult() { return 1 + Math.min(4, Math.floor(this.combo.n / 2)) * 0.5; } // x1 .. x3
  active(id) { return (this.powers[id] || 0) > 0; }
  // Turns to shoot: two guns at once on the first waves, one more every third wave.
  mayShoot() {
    const busy = this.game.enemies.filter((e) => e.alive && e.def.gun && (e.state === 'windup' || e.state === 'fire')).length;
    return busy < 2 + Math.floor(this.wave / 3);
  }
  enemiesLeft() { return this.queue.length + this.game.enemies.filter((e) => e.alive && e.def.id in ARCADE.points).length; }

  update(dt) {
    if (this.over) return;
    const g = this.game;
    this.time += dt;
    // Standing still is worth something too.
    this.secondCarry += dt * ARCADE.perSecond;
    if (this.secondCarry >= 1) { const k = Math.floor(this.secondCarry); this.secondCarry -= k; this.score += k; }
    if (this.combo.t > 0) { this.combo.t -= dt; if (this.combo.t <= 0) this.combo.n = 0; }
    for (const id of Object.keys(this.powers)) { this.powers[id] -= dt; if (this.powers[id] <= 0) { delete this.powers[id]; g.events.emit('powerEnd', { id }); } }
    // Waves.
    if (this.phase === 'break') {
      this.timer -= dt;
      if (this.timer <= 0) this.startWave();
    } else {
      this.timer -= dt;
      const alive = g.enemies.filter((e) => e.alive && e.def.id in ARCADE.points).length;
      if (this.queue.length && alive < ARCADE.maxAlive && this.timer <= 0) { this.spawnOne(); this.timer = 0.7 + g.rng.next() * 0.8; }
      if (!this.queue.length && alive === 0) this.clearWave();
    }
    // Power-ups turn up on the street now and then.
    this.fieldT -= dt;
    if (this.fieldT <= 0) {
      this.fieldT = ARCADE.fieldEvery * (0.8 + g.rng.next() * 0.4);
      const pt = g.director.pickSpawnPoint(10, 32, { allowVisible: true });
      if (pt) g.pickups.spawnPower({ x: pt.x, y: pt.y + 0.6, z: pt.z }, this.pickPower());
    }
  }

  startWave() {
    const g = this.game;
    this.wave++;
    this.phase = 'fight';
    const m = waveMix(this.wave);
    this.level = m.level;
    this.queue = g.rng.shuffle([...Array(m.gunman).fill('gunman'), ...Array(m.bruiser).fill('bruiser'), ...Array(m.heavy).fill('heavy')]);
    this.timer = 0;
    g.events.emit('waveStart', { wave: this.wave, count: m.count });
  }

  spawnOne() {
    const g = this.game;
    const pt = g.director.pickSpawnPoint(26, 60);
    if (!pt) return;
    const e = g.spawnEnemy(this.queue.pop(), { x: pt.x, y: pt.y, z: pt.z });
    if (e) { e.maxHp *= this.level; e.hp = e.maxHp; e.dmgMul *= 1 + (this.level - 1) * 0.4; }
  }

  clearWave() {
    const g = this.game;
    const bonus = ARCADE.waveBonus * this.wave * (this.active('score') ? 2 : 1);
    this.score += bonus;
    g.player.heal(25);
    this.phase = 'break';
    this.timer = ARCADE.breakSeconds;
    g.events.emit('waveClear', { wave: this.wave, bonus });
  }

  onKill(d) {
    if (this.over || !(d.type in ARCADE.points)) return;
    const g = this.game;
    const head = this.lastPart.get(d.id) === 'head';
    this.lastPart.delete(d.id);
    this.kills++;
    if (head) this.headshots++;
    this.combo.n++;
    this.combo.t = ARCADE.comboWindow;
    if (this.combo.n > this.best.n) this.best.n = this.combo.n;
    const pts = Math.round((ARCADE.points[d.type] + (head ? ARCADE.headshot : 0)) * this.mult * (this.active('score') ? 2 : 1));
    this.score += pts;
    g.events.emit('score', { points: pts, head, mult: this.mult, pos: d.pos });
    if (g.rng.chance(ARCADE.dropChance[d.type])) g.pickups.spawnPower({ ...d.pos }, this.pickPower());
  }

  // Medkits more often when hurt; otherwise an even pick.
  pickPower() {
    const g = this.game, P = g.player;
    if (P.hp < P.stats.maxHp * 0.45 && g.rng.chance(0.5)) return 'medkit';
    return g.rng.pick(POWER_IDS);
  }

  grant(id) {
    const g = this.game, P = g.player, d = POWERS[id];
    if (!d) return;
    if (id === 'medkit') P.heal(60);
    else if (id === 'armor') P.barrier = Math.max(P.barrier, 60);
    else this.powers[id] = d.time;
    if (id === 'rapid' && P.gun) { P.gun.reload = null; P.gun.ammo = P.gun.def.cylinder; }
    g.events.emit('power', { id, name: d.name, desc: d.desc, color: d.color });
  }

  finish() {
    if (this.over) return;
    this.over = true;
    this.game.events.emit('arcadeOver', this.result());
  }

  result() {
    return { score: this.score, wave: this.wave, kills: this.kills, headshots: this.headshots, time: Math.round(this.time), bestCombo: this.best.n, seed: this.game.seed };
  }

  dispose() { this.off.forEach((o) => o()); }
}
