// The title screen's attract mode: a slow cinematic tour of the city behind the menu. A loop of shots, each a few
// seconds long, cut through black, each with a location card:
//   street - a low dolly down a street near you, looking along it;
//   hero   - a slow orbit around your character, standing on the corner;
//   crew   - side-on down the street: the Vipers loitering in the foreground, you beyond them;
//   skyline- a crane up from the street toward the landmark tower.
// Every camera position is checked against the world (a clear line to what it looks at), with fallbacks, so a shot
// never starts inside a wall. Drives view.camOverride; reads the game, never writes it.

const SHOT = 8.5; // seconds per shot
const FADE = 0.7;

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
// The camera at a is in the open and can see b (stopping `short` metres before it: a target inside a solid, like the
// middle of a tower, would otherwise always read as blocked).
const clear = (w, a, b, short = 0.3) => {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l = Math.hypot(dx, dy, dz) || 1, k = Math.max(0, l - short) / l;
  return w.fits(a.x, a.y - 0.6, a.z, 0.3, 0.8) && w.segmentClear(a, { x: a.x + dx * k, y: a.y + dy * k, z: a.z + dz * k });
};

export class TitleCam {
  constructor(game, { crew = null, name = '' } = {}) {
    this.game = game;
    this.t = 0;
    this.i = 0;
    this.shots = [this.street(), this.hero(name), crew && this.crew(crew), this.skyline()].filter(Boolean);
    this.fade = 1;
  }

  get shot() { return this.shots[this.i % this.shots.length]; }
  get caption() { return this.shot?.caption || ''; }

  update(dt) {
    this.t += dt;
    if (this.t >= SHOT) { this.t -= SHOT; this.i++; }
    // Black at each cut, easing in and out.
    this.fade = Math.max(0, 1 - this.t / FADE, 1 - (SHOT - this.t) / FADE);
  }

  pose() { return this.shot.at(ease(Math.min(1, this.t / SHOT))); }

  // A slow orbit around the character, at chest height, starting in front of them.
  hero(name) {
    const g = this.game, w = g.world, P = g.player.pos, yaw = g.player.yaw;
    const tgt = { x: P.x, y: P.y + 1.3, z: P.z };
    for (const [r, a0] of [[3.6, 0], [3.6, 0.9], [3.6, -0.9], [2.6, 0], [2.6, Math.PI], [3.6, Math.PI]]) {
      const at = (a) => ({ x: P.x - Math.sin(yaw + a) * r, y: P.y + 1.5, z: P.z - Math.cos(yaw + a) * r });
      if (![-0.55, 0, 0.55].every((d) => clear(w, at(a0 + d), tgt))) continue;
      return { caption: [name, g.city.district?.name].filter(Boolean).join(' · '), at: (k) => ({ pos: { ...at(a0 - 0.55 + 1.1 * k), y: P.y + lerp(1.35, 1.7, k) }, target: tgt }) };
    }
    return { caption: name, at: () => ({ pos: { x: P.x - Math.sin(yaw) * 3, y: P.y + 2, z: P.z - Math.cos(yaw) * 3 }, target: tgt }) };
  }

  // A low dolly along a street near the player, named after a business on it.
  street() {
    const g = this.game, w = g.world, T = g.turf, P = g.player.pos;
    if (!T) return null;
    const segs = T.roads.segments.filter((s) => s.open).map((s) => {
      const r = s.rect, v = s.axis === 'v', L = v ? r.z1 - r.z0 : r.x1 - r.x0;
      const c = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
      return { s, v, L, c, d: Math.hypot(c.x - P.x, c.z - P.z) };
    }).filter((q) => q.L > 45).sort((a, b) => a.d - b.d);
    for (const q of segs.slice(0, 8)) {
      const r = q.s.rect, dir = q.v ? { x: 0, z: 1 } : { x: 1, z: 0 };
      const lane = q.v ? (r.x1 - r.x0) * 0.22 : (r.z1 - r.z0) * 0.22; // off the centre line, toward one side
      const a = q.v ? { x: q.c.x + lane, y: 1.9, z: r.z0 + 4 } : { x: r.x0 + 4, y: 1.9, z: q.c.z + lane };
      const b = { x: a.x + dir.x * (q.L * 0.45), y: 2.4, z: a.z + dir.z * (q.L * 0.45) };
      const look = (p) => ({ x: p.x + dir.x * 40, y: 3.2, z: p.z + dir.z * 40 });
      if (!clear(w, a, look(a)) || !clear(w, b, look(b))) continue;
      const biz = (T.businesses || []).map((x) => ({ x, d: Math.hypot(x.door.x - q.c.x, x.door.z - q.c.z) })).sort((m, n) => m.d - n.d)[0];
      const caption = biz && biz.d < 160 ? `${biz.x.name} · ${T.district?.name || ''}` : T.district?.name || '';
      return { caption, at: (k) => { const p = { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) }; return { pos: p, target: look(p) }; } };
    }
    return null;
  }

  // A side-on two-shot down the street: the loitering crew in the foreground, you beyond them, the camera drifting
  // as the focus pans from them to you. Both must be in clear view and nobody close enough to fill the frame.
  crew({ x, z }) {
    const g = this.game, w = g.world, P = g.player.pos;
    const dx = P.x - x, dz = P.z - z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
    const them = { x, y: P.y + 1.3, z }, you = { x: P.x, y: P.y + 1.4, z: P.z };
    const crew = g.enemies.filter((e) => e.loiter);
    const roomy = (p) => crew.every((e) => Math.hypot(e.pos.x - p.x, e.pos.z - p.z) > 3);
    for (const side of [6, -6, 8, -8, 4.5, -4.5, 10, -10]) for (const t of [-0.15, 0.1, 0.3]) {
      const at = (k) => ({ x: x + ux * l * (t + 0.08 * k) - uz * side, y: P.y + 1.7, z: z + uz * l * (t + 0.08 * k) + ux * side });
      const a = at(0), b = at(1);
      if (!roomy(a) || !roomy(b) || ![a, b].every((p) => clear(w, p, them, 1) && clear(w, p, you))) continue;
      return {
        caption: 'The Vipers · They want your streets',
        at: (k) => ({ pos: at(k), target: { x: lerp(them.x, (them.x + you.x) / 2, k), y: lerp(them.y, you.y, k), z: lerp(them.z, (them.z + you.z) / 2, k) } }),
      };
    }
    return null;
  }

  // A crane up from a street toward the landmark tower.
  skyline() {
    const g = this.game, w = g.world, T = g.turf, L = T?.landmarks?.[0];
    if (!L) return null;
    for (const s of T.roads.segments) {
      if (!s.open) continue;
      const x = (s.rect.x0 + s.rect.x1) / 2, z = (s.rect.z0 + s.rect.z1) / 2, d = Math.hypot(x - L.x, z - L.z);
      if (d < 90 || d > 200) continue;
      const lo = { x, y: 2.5, z }, hi = { x, y: 34, z }, top = { x: L.x, y: L.height * 0.75, z: L.z };
      if (!clear(w, lo, top, 30) || !clear(w, hi, top, 30)) continue;
      return { caption: `${L.name} · ${T.district?.name || ''}`, at: (k) => ({ pos: { x, y: lerp(lo.y, hi.y, k), z }, target: { x: L.x, y: lerp(L.height * 0.3, L.height * 0.8, k), z: L.z } }) };
    }
    return null;
  }
}
