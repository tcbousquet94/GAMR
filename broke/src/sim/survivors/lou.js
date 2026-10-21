// LOU MANCUSO, 52, ex-bus driver: the turf-war leader the player controls. Thirty years on the 14 line; knows every
// block, every shortcut and everybody's business. Sturdier and slower than a kid, carries a sidearm.
// One attack for now (primary: aimed sidearm shots, GTA-style: the crosshair and the raised gun only while shooting).
// The retired roguelike survivor kits (Dee's Syringe / Rounds / Salsa / Code) are not on the HUD any more.

export const LOU = {
  id: 'lou',
  name: 'Lou Mancuso',
  role: 'Ex-bus driver, 52',
  accent: 0x8a6a44,
  hudAbilities: false,
  base: { maxHp: 120, regen: 1.0, damage: 14, speed: 6.6, jumps: 1, crit: 0.02 },
  abilities: {
    primary: { name: 'Sidearm', desc: 'Aimed shots. The gun comes up while you fire.', cooldown: 0 },
    secondary: { name: '-', desc: '', cooldown: 1 },
    utility: { name: '-', desc: '', cooldown: 1 },
    special: { name: '-', desc: '', cooldown: 1 },
    passive: { name: 'Knows the Route', desc: 'Thirty years driving the 14 line.' },
  },
  lore: 'Thirty years behind the wheel of the 14. Pension gone, depot sold, neighbourhood up for grabs. He knows every block, and every block knows Lou.',

  init(p) { p.lou = { fireT: 0 }; },
  blocksSprint(p, input) { return !!input.primary; }, // you stop to aim
  update(p, dt, input, g) {
    const d = p.lou;
    d.fireT = Math.max(0, d.fireT - dt);
    if (input.primary && d.fireT <= 0) {
      d.fireT = 1 / (3.0 * p.stats.attackSpeed);
      g.projectiles.bullet(p, p.hand(), g.aimPoint(p, 150), p.stats.damage * 1.4);
      g.events.emit('ability', { slot: 'primary', kind: 'bullet' });
      g.stats.shots++;
    }
  },
};
