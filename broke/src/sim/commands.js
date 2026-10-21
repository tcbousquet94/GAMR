// Commands: the only way anything changes the turf-war simulation. The local player, the rival AI and (later) a
// second human all submit the same plain-data commands; the sim validates them, queues them for a tick, and
// applies them in a fixed order (tick, then submission order). With the seed, the command log fully reproduces a
// match, which is what lockstep multiplayer and replays need.

const NUM = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);
const BOOL = (v) => v === true;

// Player-style control input, sanitised to known fields so no source can inject anything else.
export function sanitizeControl(i = {}) {
  return {
    moveX: NUM(i.moveX, -1, 1), moveZ: NUM(i.moveZ, -1, 1), yaw: NUM(i.yaw, -1e6, 1e6), pitch: NUM(i.pitch, -1.6, 1.6),
    sprint: BOOL(i.sprint), jumpPressed: BOOL(i.jumpPressed), primary: BOOL(i.primary), secondary: BOOL(i.secondary),
    utility: BOOL(i.utility), special: BOOL(i.special), equipment: BOOL(i.equipment), interact: BOOL(i.interact),
  };
}

// Command types. Part 1 implements `control`; the strategy commands are defined (so callers can be written against
// them) but rejected until their systems exist.
export const COMMANDS = {
  control: {
    validate: (g, c) => (c.input && typeof c.input === 'object' ? null : 'missing input'),
    apply: (g, c) => { g.controls[c.actor] = sanitizeControl(c.input); },
  },
  move: { pending: 'troops arrive in a later part' },
  attack: { pending: 'battles arrive in a later part' },
  capture: { pending: 'capturing arrives in a later part' },
  recruit: { pending: 'recruiting arrives in a later part' },
};

export class CommandQueue {
  constructor() { this.pending = []; this.log = []; this.seq = 0; }

  // Returns { ok, seq } or { ok: false, reason }. Commands land on the next tick unless they name a later one.
  submit(g, cmd) {
    const def = COMMANDS[cmd?.type];
    if (!def) return { ok: false, reason: `unknown command ${cmd?.type}` };
    if (def.pending) return { ok: false, reason: def.pending };
    if (!g.actors[cmd.actor]) return { ok: false, reason: `unknown actor ${cmd.actor}` };
    const err = def.validate?.(g, cmd);
    if (err) return { ok: false, reason: err };
    const c = { ...cmd, seq: this.seq++, tick: Math.max(g.tick + 1, cmd.tick | 0) };
    this.pending.push(c);
    return { ok: true, seq: c.seq };
  }

  // Apply every command due by `tick`, in (tick, seq) order, and append them to the log.
  run(g, tick) {
    if (!this.pending.length) return;
    const due = [], later = [];
    for (const c of this.pending) (c.tick <= tick ? due : later).push(c);
    this.pending = later;
    due.sort((a, b) => a.tick - b.tick || a.seq - b.seq);
    for (const c of due) { COMMANDS[c.type].apply(g, c); this.log.push(c); }
    if (this.log.length > 20000) this.log.splice(0, this.log.length - 20000);
  }
}
