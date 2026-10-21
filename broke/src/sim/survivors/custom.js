// The player's own character: made in the character creator (a Person spec, the same one every other human in the
// city is built from), carrying a revolver. Hold aim (right mouse) to raise it and tighten the shot, click per shot,
// R to reload. See ../gun.js for how the gun handles.

import { Gun } from '../gun.js';
import { GUNS } from '../../core/config.js';

export function makeCustomHero(look) {
  const name = (look.name || '').trim() || 'You';
  return {
    id: 'custom',
    name,
    role: look.role || 'Gang leader',
    accent: look.outfit?.top?.color ?? 0x8a6a44,
    look,
    aims: true, // hold-to-aim camera and stance
    hudAbilities: false,
    icons: { primary: 'revolver', secondary: 'aim', utility: 'salsa', special: 'reload', jump: 'jump', equipment: 'equip' },
    touchLabels: { primary: 'Fire', secondary: 'Aim', utility: '-', special: 'Reload' },
    base: { maxHp: 110, regen: 1.0, damage: 14, speed: 6.9, jumps: 2, crit: 0 },
    abilities: {
      primary: { name: 'Revolver', desc: 'Click per shot. Headshots hit hard.', cooldown: 0 },
      secondary: { name: 'Aim', desc: 'Hold to raise the gun: tighter shots, slower feet.', cooldown: 1 },
      utility: { name: '-', desc: '', cooldown: 1 },
      special: { name: 'Reload', desc: 'Six in the cylinder, loaded a round at a time.', cooldown: 1 },
      passive: { name: 'Local', desc: 'Everybody on the block knows the name.' },
    },
    lore: `${name} runs a crew out of a warehouse by the water. Six rounds, a short temper, and a lot of friends.`,

    init(p) { p.gun = new Gun(GUNS.revolver); },
    blocksSprint(p, input) { return !!(input.aim || input.primary); },
    update(p, dt, input, g) { p.gun.update(p, dt, input, g); },
  };
}
