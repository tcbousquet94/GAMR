// Derived stats from base survivor stats + item stacks + temporary buffs. Pure functions with caps, so no stack
// combination can produce NaN, infinities or absurd values. Unit-tested in tests/unit/items.test.js.

import { COMBAT, MOVE } from '../core/config.js';
import { clamp, finite } from '../core/math.js';

export const count = (inv, id) => Math.max(0, Math.floor(finite(inv[id] || 0)));

export function computeStats(base, inv, ctx = {}) {
  const n = (id) => count(inv, id);
  const tier = clamp(finite(ctx.tier || 0), 0, 4);
  // Movement: additive multipliers, capped.
  let moveMul = 1 + 0.14 * n('latte') + (base.nightShift ? 0.03 * tier : 0);
  if ((ctx.timeSinceHit ?? 0) >= 5) moveMul += 0.3 * n('insoles');
  moveMul *= ctx.slowMul ?? 1;
  moveMul = clamp(moveMul, 0.2, MOVE.maxMoveMul);
  const attackSpeed = clamp(1 + 0.15 * n('espresso'), 1, COMBAT.maxAttackSpeedMul);
  // Hyperbolic-ish block chance with a hard cap so nobody becomes invulnerable.
  const block = clamp(1 - Math.pow(0.85, n('headphones')), 0, COMBAT.maxBlockChance);
  const maxHp = Math.max(1, base.maxHp + 25 * n('gym') + (ctx.maxHpBonus || 0));
  const overtimeStacks = clamp(finite(ctx.overtimeStacks || 0), 0, 30);
  let damageMul = 1 + 0.04 * overtimeStacks;
  if (base.nightShift) damageMul *= 1 + 0.1 * tier;
  return {
    moveMul, attackSpeed, block, maxHp,
    damage: base.damage * damageMul,
    regen: base.regen * (1 + 0.1 * tier),
    crit: clamp(base.crit ?? COMBAT.baseCrit, 0, 1),
    jumps: clamp(base.jumps + n('courierbag'), 1, MOVE.maxJumps),
    couponMul: 1 + 0.75 * n('coupon'),
    burnChance: clamp(0.1 * n('hotsauce'), 0, 1),
    lightningChance: n('dataplan') ? 0.2 : 0,
    lightningTargets: n('dataplan') ? clamp(3 + 2 * (n('dataplan') - 1), 3, 15) : 0,
    missileChance: n('grouptext') ? 0.1 : 0,
    missileDamage: 3 * n('grouptext'),
    explodeOnKill: n('replyall') > 0,
    explodeRadius: n('replyall') ? clamp(8 + 2.4 * (n('replyall') - 1), 8, 24) : 0,
    explodeDamage: n('replyall') ? 3.5 * (1 + 0.8 * (n('replyall') - 1)) : 0,
    overtimeMax: clamp(3 * n('overtime'), 0, 30),
    snackHeal: n('sample') ? 8 + 4 * n('sample') : 0,
    bandaidHeal: n('bandaids') ? 12 + 0.05 * maxHp * n('bandaids') : 0,
    pizzaHealPct: clamp(0.045 * n('pizza'), 0, 0.5), // of max hp per second while still
    pizzaRadius: n('pizza') ? 3 + 1.5 * (n('pizza') - 1) : 0,
    coinMul: 1 + 0.25 * n('coinjar'),
    gavelRadius: n('gavel') ? 6 + 2 * (n('gavel') - 1) : 0,
    citeChance: n('violation') ? clamp(0.1 + 0.05 * (n('violation') - 1), 0, 0.6) : 0,
    luck: clamp(finite(ctx.luck || 0), 0, 3),
  };
}

// Chance roll with luck: each point of luck rolls again and keeps the best (Lucky Penny, Phase 2).
export function roll(rng, p, luck = 0) {
  if (!(p > 0)) return false;
  if (p >= 1) return true;
  for (let i = 0; i <= luck; i++) if (rng.next() < p) return true;
  return false;
}
