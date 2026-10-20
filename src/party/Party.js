import { PartyMember } from './PartyMember.js';
import { rand } from '../core/math.js';

/**
 * Build the two AI teammates. Returns [dot, moose]; main.js stores it as game.party.
 * Each member is a Combatant with update(dt), added to game.scene and game.combatants.
 */
export function createParty(game) {
  // Shared crew state: one bark at a time, 25-45s apart, only during combat.
  const crew = { members: [], leader: null, barkTimer: rand(12, 20), lastLine: {} };
  const dot = new PartyMember(game, 'dot', 0, crew);
  const moose = new PartyMember(game, 'moose', 1, crew);
  crew.members.push(dot, moose);
  crew.leader = dot;
  return [dot, moose];
}

export { PartyMember };
