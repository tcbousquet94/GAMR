// Coins, snacks (Free Sample) and dropped items. Coins pop out, then home in on the player.

export class Pickups {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.nextId = 1;
  }

  spawnCoins(pos, cents) {
    const g = this.game;
    const n = Math.max(1, Math.min(8, Math.round(cents / 12)));
    let left = cents;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.round(cents / n);
      left -= v;
      const a = g.rng.next() * Math.PI * 2;
      this.list.push({ id: this.nextId++, kind: 'coin', value: v, pos: { ...pos }, vel: { x: Math.cos(a) * 3, y: 6 + g.rng.next() * 3, z: Math.sin(a) * 3 }, age: 0, life: 40 });
    }
  }
  spawnSnack(pos, heal) {
    this.list.push({ id: this.nextId++, kind: 'snack', value: heal, pos: { ...pos }, vel: { x: 0, y: 5, z: 0 }, age: 0, life: 12 });
  }
  spawnItem(pos, item) {
    this.list.push({ id: this.nextId++, kind: 'item', item, pos: { ...pos }, vel: { x: 0, y: 8, z: 0 }, age: 0, life: 9999 });
  }

  update(dt) {
    const g = this.game;
    const P = g.player;
    const pp = { x: P.pos.x, y: P.pos.y + 1, z: P.pos.z };
    for (const k of this.list) {
      k.age += dt;
      const dx = pp.x - k.pos.x, dy = pp.y - k.pos.y, dz = pp.z - k.pos.z;
      const d = Math.hypot(dx, dy, dz);
      const homing = k.kind === 'coin' ? k.age > 0.5 && d < 45 : d < 3.5;
      if (homing && P.alive) {
        const sp = Math.max(14, 40 - d) * (k.kind === 'coin' ? 1 : 0.6);
        k.vel.x = (dx / d) * sp; k.vel.y = (dy / d) * sp; k.vel.z = (dz / d) * sp;
      } else {
        k.vel.y -= 22 * dt;
        const ground = g.world.groundBelow(k.pos.x, k.pos.y + 0.3, k.pos.z, 0.05, 50);
        if (k.pos.y + k.vel.y * dt < ground + 0.25) { k.pos.y = ground + 0.25; k.vel.y = 0; k.vel.x *= 0.8; k.vel.z *= 0.8; }
      }
      k.pos.x += k.vel.x * dt; k.pos.y += k.vel.y * dt; k.pos.z += k.vel.z * dt;
      if (d < 1.1 && P.alive) this.collect(k);
      if (k.age > k.life) k.dead = true;
    }
    this.list = this.list.filter((k) => !k.dead);
  }

  collect(k) {
    const g = this.game;
    k.dead = true;
    if (k.kind === 'coin') g.economy.addCents(k.value);
    else if (k.kind === 'snack') g.player.heal(k.value);
    else if (k.kind === 'item') { g.giveItem(k.item); g.events.emit('bossItem', { item: k.item }); }
    g.events.emit('pickup', { kind: k.kind, value: k.value, item: k.item });
  }

  clear() { this.list.length = 0; }
}
