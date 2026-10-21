// Downtown district config. The generator reads this; a new district is a new file like this one.

export const downtown = {
  id: 'downtown',
  name: 'Downtown',
  exitType: 'subway',
  layout: {
    blocks: 3, // blocks per side (stage size)
    blockSize: 190, // tuned so the bot's spawn -> exit sprint lands in 60-90 s
    streetWidth: 16, // curb to curb plus sidewalks
    sidewalk: 3.5,
    alleyWidth: 7, // alleys between the 2x2 lots inside each block
    lotsPerBlock: 2,
  },
  verticality: { mid: [6, 10], roof: [15, 25], towerMax: 95 },
  // Module weights and limits. 'subway' is placed by rule on the exit side.
  modules: {
    plaza: { w: 2, max: 4, min: 2 },
    garage: { w: 2, max: 2, min: 1 },
    tower: { w: 3, max: 99 },
    construction: { w: 2, max: 3, min: 1 },
    foodtrucks: { w: 2.5, max: 5, min: 2 },
    walkway: { w: 2, max: 3, min: 1 },
  },
  // Interactable density per lot (expected count, rounded with rng).
  density: { vending: 1.0, newsbox: 0.8, locker: 0.55, lostfound: 0.3 },
  enemies: [
    { id: 'canvasser', w: 3, cost: 9, minTier: 0 },
    { id: 'scooter', w: 3, cost: 11, minTier: 0 },
    { id: 'speakerphone', w: 2.5, cost: 14, minTier: 0 },
  ],
  boss: 'hoa',
  palette: {
    asphalt: 0x3b3944, lane: 0x9a9586, sidewalk: 0x726e79, curb: 0x86828c,
    brick: [0x6a3d34, 0x5c3530, 0x734a3b, 0x4f3431], concrete: [0x6f6c76, 0x5d5b66, 0x7c7884],
    glass: [0x3b5680, 0x2f4a75, 0x46638f], tower: [0x34496e, 0x2c3e60, 0x3e5682],
    metal: 0x24232b, trim: 0x8f8a93, plywood: 0xa48a62, steel: 0x6d6a6a, roof: 0x4d4a52,
    planter: 0x5a5560, foliage: [0x3f5a3c, 0x4c6644, 0x35503a], water: 0x3a6a8a,
    windowDay: [0x6c86ad, 0x5a729b, 0x7d93b8], windowNight: [0xffcf86, 0xffd9a0, 0xffbf70, 0xe8e4d0],
    windowDark: 0x2a3348,
    neon: [0xff3fb8, 0xb04bff, 0x33e0ff, 0xff5fd0, 0x8a5bff],
    street: 0xffa94d,
  },
  lighting: {
    // Keyframes over the difficulty clock (minutes). Golden hour -> dusk (Rush Hour) -> night (Gridlock).
    keys: [
      { t: 0, sky: [0x5d6fb8, 0xf2a46a, 0xffd59a], sun: 0xffc27a, sunI: 2.8, hemi: [0xb8c0ec, 0x8a6a60], hemiI: 1.7, fog: 0xd8a088, fogD: 0.0036, night: 0, sunEl: 24 },
      { t: 2.5, sky: [0x3b3f8f, 0xd9706a, 0xf09a6a], sun: 0xff9a6a, sunI: 1.8, hemi: [0x9a90d8, 0x6a4a60], hemiI: 1.5, fog: 0xa06c86, fogD: 0.0042, night: 0.45, sunEl: 12 },
      { t: 5.5, sky: [0x1d1c4a, 0x4a3b8f, 0xd0705a], sun: 0x8a7cff, sunI: 0.7, hemi: [0x6a66c8, 0x3a3050], hemiI: 1.25, fog: 0x3a3270, fogD: 0.0048, night: 1, sunEl: 40 },
    ],
  },
};
