// Global tuning. Gameplay numbers live here so tests and DESIGN.md can point at one place.

export const SIM_HZ = 60;
export const DT = 1 / SIM_HZ;

export const PHYS = {
  gravity: 30,
  playerRadius: 0.4, // half-width of the player's square footprint
  playerHeight: 1.8,
  stepHeight: 0.6, // auto step-up (curbs, stairs, ramps built as steps)
  mantleReach: 2.1, // in the air, ledges up to this far above the feet are vaulted onto
  killY: -30, // falling below this teleports you back to the last safe ground
  maxFallSpeed: 45,
};

export const MOVE = {
  accelGround: 70,
  accelAir: 22,
  frictionGround: 14,
  jumpSpeed: 10.5, // ~1.8m per jump
  climbSpeed: 7.5,
  climbStickDist: 0.35,
  coyoteTime: 0.12,
  jumpBuffer: 0.12,
  sprintMul: 1.45,
  maxMoveMul: 3.5, // cap on all move-speed multipliers combined
  maxJumps: 7, // cap on total jumps (base 2 + couriers bags)
};

export const COMBAT = {
  critMul: 2,
  baseCrit: 0.01,
  knockbackMaxSpeed: 26, // any knockback impulse is clamped to this
  maxAttackSpeedMul: 4,
  maxBlockChance: 0.75,
  maxProcDepth: 3, // on-hit chains (lightning -> missile -> explosion) stop after this depth
};

// Difficulty clock. `at` is minutes when the tier starts.
export const TIERS = [
  { name: 'Light Traffic', at: 0 },
  { name: 'Rush Hour', at: 2.5 },
  { name: 'Gridlock', at: 5.5 },
  { name: 'Total Gridlock', at: 9 },
  { name: 'Jury Duty', at: 13 },
];

export const ECON = {
  startCents: 340, // "You have $3.40."
  prices: { common: 125, uncommon: 300, legendary: 1200, equipment: 200 },
  priceScalePerCoeff: 1.0, // price = base * coeff
  dropBase: 18, // cents an average enemy drops at coeff 1, scaled by enemy cost and coeff
};

export const EXIT = {
  countdown: 75, // seconds from calling the train to arrival (spec: 60-90)
  bossDelay: 2.5,
  spawnRateMul: 2.6,
};
