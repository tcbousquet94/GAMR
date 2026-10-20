// Item definitions. Effects are implemented in stats.js (passive numbers) and combat.js / procs.js (triggers).
// `icon` describes a simple procedural glyph the HUD draws in the tier colour.

export const TIER_COLOR = {
  common: '#e9e6e1', uncommon: '#6fd36a', legendary: '#ff5a4f', boss: '#ffd34a', sketchy: '#5aa8ff', equipment: '#ff9a3c',
};

export const ITEMS = {
  // Common (white)
  latte: { name: 'Oat Milk Latte', tier: 'common', desc: 'Move 14% faster.', icon: 'cup' },
  espresso: { name: 'Extra Shot of Espresso', tier: 'common', desc: 'Attack 15% faster.', icon: 'bean' },
  headphones: { name: 'Noise-Cancelling Headphones', tier: 'common', desc: '15% chance to block a hit completely.', icon: 'headphones' },
  coupon: { name: 'Grand Opening Coupon', tier: 'common', desc: '+75% damage to enemies above 90% health.', icon: 'ticket' },
  sample: { name: 'Free Sample', tier: 'common', desc: 'Kills drop a snack that heals you.', icon: 'toothpick' },
  bandaids: { name: 'Band-Aids', tier: 'common', desc: 'Shortly after taking damage, heal a little.', icon: 'cross' },
  hotsauce: { name: 'Hot Sauce Packets', tier: 'common', desc: '10% chance on hit to set enemies burning.', icon: 'flame' },
  gym: { name: 'Unused Gym Membership', tier: 'common', desc: '+25 max health.', icon: 'card' },
  coinjar: { name: 'Coin Jar', tier: 'common', desc: 'Enemies drop extra loose change.', icon: 'jar' },
  // Uncommon (green)
  dataplan: { name: 'Unlimited Data Plan', tier: 'uncommon', desc: '20% chance on hit to chain lightning to 3 enemies.', icon: 'bolt' },
  grouptext: { name: 'Group Text', tier: 'uncommon', desc: '10% chance on hit to fire a homing text missile.', icon: 'bubble' },
  replyall: { name: 'Reply All', tier: 'uncommon', desc: 'Enemies explode when killed.', icon: 'burst' },
  courierbag: { name: 'Bike Courier Bag', tier: 'uncommon', desc: '+1 extra jump.', icon: 'bag' },
  overtime: { name: 'Overtime', tier: 'uncommon', desc: 'Kills grant a short stacking damage boost.', icon: 'clock' },
  insoles: { name: 'Comfy Insoles', tier: 'uncommon', desc: 'After 5 s without being hit, move 30% faster.', icon: 'shoe' },
  pizza: { name: 'Leftover Pizza', tier: 'uncommon', desc: 'Heal steadily while standing still.', icon: 'slice' },
  // Boss (yellow)
  gavel: { name: 'Gavel of Authority', tier: 'boss', desc: 'Every fifth hit slams the ground, stunning nearby enemies.', icon: 'gavel' },
  violation: { name: 'Violation Notice', tier: 'boss', desc: 'Hits can cite enemies: +30% damage taken for 5 s.', icon: 'paper' },
};

export const EQUIPMENT = {
  airhorn: { name: 'Airhorn', tier: 'equipment', desc: 'A cone blast that knocks back and stuns.', cooldown: 30, icon: 'horn' },
  cart: { name: 'Shopping Cart', tier: 'equipment', desc: 'Ride it for 5 s, plowing through enemies.', cooldown: 40, icon: 'cart' },
};

export const POOLS = {
  common: Object.keys(ITEMS).filter((k) => ITEMS[k].tier === 'common'),
  uncommon: Object.keys(ITEMS).filter((k) => ITEMS[k].tier === 'uncommon'),
  boss: Object.keys(ITEMS).filter((k) => ITEMS[k].tier === 'boss'),
  equipment: Object.keys(EQUIPMENT),
};
