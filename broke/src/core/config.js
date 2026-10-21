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
  accelGround: 24, // speed builds over two or three strides
  decelGround: 30,
  pivotDecel: 55,
  turnRate: 9, // rad/s at a standstill, falling with speed (turnFalloff) so turns arc with weight
  turnFalloff: 0.2, // ~3.7 rad/s at a run, ~2.9 at a sprint
  turnSpeedLoss: 0.3, // up to 30% of speed bled while carving a hard turn
  pivotAngle: 2.0, // sharper than this at speed: brake and pivot instead of carving
  frictionSkid: 3.2,
  hardLandSpeed: 19,
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

// Third-person camera, shared by the sim (aim ray) and the view (camera boom) so the reticle is always honest: the
// camera sits on the ray from the shoulder pivot, so a shot from the pivot along the aim lands under the reticle.
// hip: walking around; ads: holding aim (pulled in over the right shoulder, narrower field of view).
export const CAM = {
  hip: { side: 0.25, height: 1.95, dist: 3.4, fov: 48 },
  ads: { side: 0.72, height: 1.78, dist: 2.1, fov: 36 },
  classic: { side: 0.7, height: 1.65, dist: 4.6, fov: 70 }, // the retired roguelike's camera
  adsTime: 0.16, // seconds to raise / lower the aim
  adsMoveMul: 0.5, // walking speed while aiming
  adsSensMul: 0.6, // mouse sensitivity while aiming
};

// Guns. Angles in radians. Damage falls off linearly from `falloff[0]` to `falloff[1]` metres, down to `minMul`.
export const GUNS = {
  revolver: {
    name: 'Revolver', damage: 34, headMul: 2.6, range: 140, falloff: [25, 70], minMul: 0.6,
    cylinder: 6, cock: 0.3, reloadRound: 0.36, reloadStart: 0.25,
    spreadAds: 0.002, spreadHip: 0.04, spreadMove: 0.025, spreadAir: 0.05, bloom: 0.018, bloomMax: 0.06, bloomDecay: 0.12,
    recoil: 0.045, recoilYaw: 0.012, recoilReturn: 9, // the muzzle climbs, then mostly settles back
    knock: 3,
  },
};
