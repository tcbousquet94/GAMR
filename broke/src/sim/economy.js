// Loose change, shops and pickups. Prices scale with the difficulty clock. A purchase only succeeds if you can
// afford it, and always delivers (the item is added to the inventory the same tick).

import { ECON } from '../core/config.js';
import { POOLS, ITEMS, EQUIPMENT } from './items.js';

export const SHOP = {
  vending: { tier: 'common', base: ECON.prices.common, label: 'Vending Machine' },
  newsbox: { tier: 'common', base: Math.round(ECON.prices.common * 0.8), label: 'Newspaper Box' },
  locker: { tier: 'uncommon', base: ECON.prices.uncommon, label: 'Delivery Locker' },
  lostfound: { tier: 'equipment', base: ECON.prices.equipment, label: 'Lost & Found' },
  callpanel: { tier: null, base: 0, label: 'Call the Train' },
};

export class Economy {
  constructor(game) {
    this.game = game;
    this.cents = ECON.startCents;
    this.earned = 0;
    this.spent = 0;
    this.bought = 0;
  }

  price(it) {
    const s = SHOP[it.type];
    return Math.round(s.base * this.game.clock.priceMul() / 5) * 5;
  }

  addCents(c, src = 'pickup') {
    c = Math.max(0, Math.round(c));
    this.cents += c;
    this.earned += c;
    this.game.events.emit('change', { amount: c, total: this.cents, src });
  }

  dropChange(e) {
    const g = this.game;
    const st = g.player.stats;
    const amount = ECON.dropBase * (e.def.drop ?? 1) * (e.dropMul ?? 1) * g.clock.coeff * st.coinMul * (g.player.dropMul ?? 1);
    if (amount < 1) return;
    g.pickups.spawnCoins(e.center(), Math.round(amount));
  }

  // Nearest usable interactable in reach and roughly in front of the player.
  focus(p) {
    const g = this.game;
    let best = null, bd = 2.6;
    const f = p.forward();
    for (const it of g.city.interactables) {
      if (it.used && it.type !== 'callpanel') continue;
      const dx = it.x - p.pos.x, dz = it.z - p.pos.z, dy = it.y - p.pos.y;
      if (Math.abs(dy) > 1.6) continue;
      const d = Math.hypot(dx, dz);
      if (d < bd && (d < 1.2 || (dx * f.x + dz * f.z) / d > -0.2)) { bd = d; best = it; }
    }
    return best;
  }

  tryInteract(p) {
    const g = this.game;
    const it = this.focus(p);
    if (!it) return false;
    if (it.type === 'callpanel') return g.exit.call();
    const price = this.price(it);
    const free = p.freePurchases;
    if (!free && this.cents < price) {
      g.events.emit('cantAfford', { id: it.id, price, have: this.cents });
      return false;
    }
    if (!free) { this.cents -= price; this.spent += price; }
    it.used = true;
    this.bought++;
    const tier = SHOP[it.type].tier;
    if (tier === 'equipment') {
      const choices = POOLS.equipment.filter((k) => k !== p.equipment);
      const id = g.rng.pick(choices.length ? choices : POOLS.equipment);
      const old = p.equipment;
      p.equipment = id;
      p.equipCd = 0;
      g.events.emit('purchase', { id: it.id, item: id, tier, price, equipment: true, swapped: old });
    } else {
      const id = g.rng.pick(POOLS[tier]);
      giveItem(g, p, id);
      g.events.emit('purchase', { id: it.id, item: id, tier, price });
    }
    return true;
  }
}

export function giveItem(g, p, id, n = 1) {
  if (!ITEMS[id] && !EQUIPMENT[id]) return;
  p.inv[id] = (p.inv[id] || 0) + n;
  p.refreshStats();
  g.stats.items++;
  g.events.emit('item', { item: id, count: p.inv[id] });
}
