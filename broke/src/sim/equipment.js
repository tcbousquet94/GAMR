// Equipment actives (one slot, cooldown). Phase 1: Airhorn and Shopping Cart.

import { EQUIPMENT } from './items.js';

export class EquipmentSystem {
  constructor(game) { this.game = game; }

  use(p) {
    const g = this.game;
    const id = p.equipment;
    const def = EQUIPMENT[id];
    if (!def || p.equipCd > 0) return false;
    if (id === 'airhorn') this.airhorn(p);
    else if (id === 'cart') this.cart(p);
    p.equipCd = def.cooldown;
    g.stats.equipUses++;
    g.events.emit('equipment', { id });
    return true;
  }

  // 14 m, ~70 degree cone: knockback + 2 s stun + light damage.
  airhorn(p) {
    const g = this.game;
    const f = p.forward();
    for (const e of g.enemiesNear(p.pos, 14)) {
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      if ((dx * f.x + dz * f.z) / d < 0.55 && d > 2) continue;
      if (!e.boss) e.stunned = Math.max(e.stunned, 2);
      if (e.latching && p.latchedBy === e) e.breakLatch();
      g.combat.hitEnemy(e, { damage: p.stats.damage * 1.5, proc: 0.5, source: 'airhorn', knock: { x: (dx / d) * 20, y: 6, z: (dz / d) * 20 } });
    }
    if (p.latchedBy) { p.latchedBy.breakLatch?.(); p.latchedBy = null; }
  }

  cart(p) {
    p.cart = 5;
    p.cartHits = new Map();
    if (p.latchedBy) { p.latchedBy.breakLatch?.(); p.latchedBy = null; }
  }

  // Called each tick while riding: plow through anything in front.
  cartTick(p, dt) {
    const g = this.game;
    const f = p.forward();
    for (const e of g.enemiesNear(p.pos, 2.2)) {
      const last = p.cartHits.get(e.id) ?? -9;
      if (g.time - last < 0.6) continue;
      p.cartHits.set(e.id, g.time);
      const side = { x: e.pos.x - p.pos.x, z: e.pos.z - p.pos.z };
      g.combat.hitEnemy(e, { damage: p.stats.damage * 2.5, proc: 1, source: 'cart', knock: { x: f.x * 16 + side.x * 4, y: 8, z: f.z * 16 + side.z * 4 } });
    }
  }
}
