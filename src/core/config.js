// Central tuning + palette. Systems read from here; tweak numbers without hunting through code.

export const PALETTE = {
  sky: 0xa8dcff,
  fog: 0xf3f0c8,
  grass: 0xc4d84a,       // EarthBound Saturn Valley yellow-green
  grassDark: 0x9cbc34,
  grassLight: 0xdbe878,
  path: 0xf0dca0,
  cliff: 0xead9a6,
  cliffShade: 0xc9b07a,
  treeLeaf: 0x3e9a3c,
  treeLeafLight: 0x62bf4e,
  trunk: 0x8a5a32,
  water: 0x4fb4f0,
  waterLight: 0x9fe0ff,
  rock: 0xe6dcc4,
  brick: 0xe88a6a,
  wallCream: 0xfbe9c0,
  wallMint: 0xb8ead0,
  wallPink: 0xf7b7c8,
  roof: 0xb4553f,
  roofTeal: 0x4aa3a0,
  window: 0x7fc8f0,
  outline: 0x2a1a2e,
  white: 0xffffff,
  hp: 0x7fe05a,
  mp: 0x4fa8ff,
  danger: 0xff4f6a,
};

// Hero looks feed buildKid(); HUD uses the same values to paint portraits.
export const HEROES = {
  pip: {
    name: 'Pip',
    look: {
      skin: 0xffd3a8, hair: 0x4a2c1a, hairStyle: 'cap', capColor: 0xe8423c,
      shirt: 0xffd23f, stripe: 0x3b6fd8, pants: 0x3b6fd8, shoes: 0xe8423c,
      accessory: 'backpack', weapon: 'bat',
    },
  },
  dot: {
    name: 'Dot',
    look: {
      skin: 0xf6c49a, hair: 0xf2a33a, hairStyle: 'pigtails', bow: 0xff5f9e,
      shirt: 0xff8fbf, stripe: null, pants: 0x7b5fd1, shoes: 0xffffff,
      accessory: 'glasses', weapon: 'book',
    },
  },
  moose: {
    name: 'Moose',
    look: {
      skin: 0xc98a5a, hair: 0x1e1410, hairStyle: 'buzz',
      shirt: 0x5fd18a, stripe: 0xffffff, pants: 0x5a6070, shoes: 0x333344,
      accessory: 'headband', weapon: 'fists', bulk: 1.25,
    },
  },
};

export const PLAYER = {
  maxHp: 120,
  maxMp: 40,
  mpRegen: 1.2,          // per second
  runSpeed: 7.5,
  accel: 40,
  turnRate: 14,
  jumpVelocity: 9,
  gravity: 26,
  dodgeSpeed: 15,
  dodgeTime: 0.38,
  dodgeIFrames: 0.3,
  dodgeCooldown: 0.25,
  combo: [
    { damage: 8, range: 2.1, arc: 1.9, knockback: 3, duration: 0.32, hitAt: 0.35, text: 'Bonk!' },
    { damage: 10, range: 2.2, arc: 2.1, knockback: 4, duration: 0.34, hitAt: 0.35, text: 'Whack!' },
    { damage: 18, range: 2.6, arc: 2.6, knockback: 11, duration: 0.5, hitAt: 0.4, text: 'SMAAAASH!' },
  ],
  comboWindow: 0.35,     // seconds after an attack ends to chain the next one
  lockRange: 22,
  psi: { name: 'PSI Zinger', cost: 8, damage: 22, speed: 18 },
  goods: { name: 'Cafeteria Pizza', count: 3, heal: 50 },
  mom: { cooldown: 45 },
  respawnDelay: 3.5,
};

export const MOM_LINES = [
  "Honey, did you remember your jacket? ...Oh, you're fighting? Well, eat something, sweetie.",
  "I'm in line at the bank. Put a band-aid on it and call your grandmother.",
  "Is this about that locker again? I'll talk to the principal. Love you!",
  "Sweetie, I put a granola bar in your backpack. The front pocket. No, the OTHER front pocket.",
  "Did you say 'monster'? Is this a school thing? Just be yourself, they'll love you.",
  "You're doing great, champ! Also your room is a mess.",
];

export const DEFEAT_LINES = [
  'You felt a little better.',
  'Your confidence went up by 1!',
  'It was not a big deal after all.',
  'Nobody even noticed. Probably.',
  'You remembered to breathe.',
];

export const PARTY = {
  dot: { maxHp: 80, speed: 7.2, role: 'ranged', attackRange: 9, damage: 9, cooldown: 1.1 },
  moose: { maxHp: 140, speed: 6.8, role: 'melee', attackRange: 2.2, damage: 12, cooldown: 0.9 },
  reviveTime: 8,
};

export const ENEMIES = {
  locker: { name: 'Locker Mimic', maxHp: 60, speed: 3.2, damage: 14, aggroRange: 40 },
  groupchat: { name: 'Group Chat (99+)', maxHp: 40, speed: 2.6, damage: 8, aggroRange: 42 },
  hallmonitor: { name: 'Hall Monitor Hank', maxHp: 90, speed: 3.8, damage: 16, aggroRange: 40 },
};

export const STATUS = {
  embarrassed: { label: 'Embarrassed', speedMul: 0.55, attackScale: 0.5, defaultDuration: 6 },
};

export const RENDER = {
  maxPixelRatio: 1.5,
  fov: 55,
};
