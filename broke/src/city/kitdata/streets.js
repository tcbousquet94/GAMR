// Street dressing in the remastered look, as kit data, for any grid of cells (the generated city or the test street).
// Each cell's sidewalk ring (sw wide, outside the cell) becomes: a kerb at the road edge (rounded at the corners with
// radius sw, some runs painted red), a grass verge (residential, industrial, parks) and a concrete walk; corners are
// quarter discs of paving. Kerbs drop where a module's lane, alley or drive crosses (cuts). Then: crosswalks and lane
// paint on open segments, manholes, palms in verges, utility poles with sagging lines, corner streetlights, hydrants
// and parked cars. Where a boulevard crosses a block edge (`across(x, z)` true), kerb, walk and corner drop and the gap
// is paved in the boulevard's asphalt, so it runs through instead of stopping at a kerb.

import { CURB } from './data.js';

const WALK = 1.6, KW = 0.3;

// cells: [{ rect, zone, sides:{s,n,e,w} }], segs: [{ rect, axis:'h'|'v', open }], cuts: [{ side, a:{x,z}, b:{x,z} }]
export function streetData(D, { cells, segs, sw, rng, cuts = [], across = null, acrossTint = 0x74747c }) {
  const vergeW = Math.max(0, sw - KW - WALK);
  for (const c of cells) {
    const r = c.rect, green = c.zone === 'residential' || c.zone === 'park' || c.zone === 'industrial';
    const sides = [
      { k: 's', open: c.sides.s, a: [r.x0, r.z1], b: [r.x1, r.z1], n: [0, 1] },
      { k: 'e', open: c.sides.e, a: [r.x1, r.z1], b: [r.x1, r.z0], n: [1, 0] },
      { k: 'n', open: c.sides.n, a: [r.x1, r.z0], b: [r.x0, r.z0], n: [0, -1] },
      { k: 'w', open: c.sides.w, a: [r.x0, r.z0], b: [r.x0, r.z1], n: [-1, 0] },
    ];
    const myCuts = cuts.filter((q) => q.cell === c);
    for (const s of sides) {
      if (!s.open) continue;
      const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), tx = (s.b[0] - s.a[0]) / len, tz = (s.b[1] - s.a[1]) / len;
      const P = (t, o) => ({ x: s.a[0] + tx * t + s.n[0] * o, z: s.a[1] + tz * t + s.n[1] * o });
      const strip = (surf, o0, o1, y1, tint, t0 = 0, t1 = len) => D.pads.push({ surf, poly: [P(t0, o0), P(t1, o0), P(t1, o1), P(t0, o1)].map((p) => [p.x, p.z]), y0: 0, y1, tint });
      // Kerb intervals minus cuts (cuts are given as two world points on this side).
      let runs = [[0, len]];
      for (const q of myCuts.filter((q) => q.side === s.k)) {
        const ta = (q.a.x - s.a[0]) * tx + (q.a.z - s.a[1]) * tz, tb = (q.b.x - s.a[0]) * tx + (q.b.z - s.a[1]) * tz;
        const lo = Math.max(0, Math.min(ta, tb)), hi = Math.min(len, Math.max(ta, tb));
        runs = runs.flatMap(([u, v]) => (hi <= u || lo >= v ? [[u, v]] : [[u, lo], [hi, v]].filter(([x, y]) => y - x > 0.4)));
        // Apron: paving across the verge and walk, sloping to the road at the kerb line.
        strip('concrete', 0, sw - KW, CURB + 0.03, 0xd2cec6, lo, hi);
        strip('concrete', sw - KW, sw, 0.04, 0xcac6be, lo, hi);
      }
      // The boulevard: the stretch of this side (over the walk's whole width) it covers, paved through.
      if (across) {
        let lo = Infinity, hi = -Infinity;
        for (let t = 0; t <= len; t += 0.25) for (const o of [0, sw / 2, sw]) { const p = P(t, o); if (across(p.x, p.z)) { lo = Math.min(lo, t); hi = Math.max(hi, t); } }
        if (hi >= lo) {
          lo = Math.max(0, lo - 0.25); hi = Math.min(len, hi + 0.25);
          runs = runs.flatMap(([u, v]) => (hi <= u || lo >= v ? [[u, v]] : [[u, lo], [hi, v]].filter(([x, y]) => y - x > 0.4)));
          strip('asphalt', 0, sw - KW, CURB + 0.012, acrossTint, lo, hi);
          strip('asphalt', sw - KW, sw, 0.06, acrossTint, lo, hi);
        }
      }
      for (const [u, v] of runs) {
        // Mostly plain concrete; now and then a short red-painted no-parking stretch near an end of the run.
        const k = (a, b, red) => D.kerbs.push({ pts: [P(a, sw - KW / 2), P(b, sw - KW / 2)], red: red ? [0] : [], y: 0, street: true });
        if (v - u > 16 && rng.chance(0.35)) { const atEnd = rng.chance(0.5), L2 = rng.range(5, 9); if (atEnd) { k(u, v - L2, false); k(v - L2, v, true); } else { k(u, u + L2, true); k(u + L2, v, false); } }
        else k(u, v, false);
        if (green && vergeW > 0.2) { strip('concrete', 0, WALK, CURB + 0.03, 0xe0dcd4, u, v); strip('grass', WALK, sw - KW, CURB, 0xffffff, u, v); }
        else strip('concrete', 0, sw - KW, CURB + 0.03, 0xe0dcd4, u, v);
      }
      // Verge life: palms (residential) or street trees (commercial), poles with lines on two sides of the block.
      if (green && vergeW > 0.8) for (let t = 6 + rng.range(0, 8); t < len - 6; t += rng.range(17, 27)) if (rng.chance(c.zone === 'residential' ? 0.6 : 0.3) && runs.some(([u, v]) => t > u + 2 && t < v - 2)) { const p = P(t, WALK + vergeW / 2); D.palms.push({ ...p, y: CURB, h: rng.range(11, 16), lean: [rng.range(-0.8, 0.8), rng.range(-0.8, 0.8)] }); }
      if (!green) for (let t = 8; t < len - 6; t += 14) if (rng.chance(0.4)) { const p = P(t, sw - KW - 0.9); D.trees.push({ ...p, y: CURB, r: 2.6, h: 6 }); }
      if ((s.k === 'n' || s.k === 'w') && c.zone !== 'park') {
        const line = [];
        for (let t = 3; t <= len - 3; t += Math.max(18, (len - 6) / Math.max(1, Math.round((len - 6) / 26)))) line.push(P(t, sw - KW - 0.5));
        // No pole in the boulevard: the line breaks there.
        let run = [];
        for (const p of line) { if (across && across(p.x, p.z)) { if (run.length >= 2) D.poleLines.push(run); run = []; } else run.push(p); }
        if (run.length >= 2) D.poleLines.push(run);
      }
      // Parked cars along this kerb, on the road.
      for (let t = 9; t < len - 9; t += 6.8) if (rng.chance(0.18) && runs.some(([u, v]) => t > u + 3 && t < v - 3)) { const p = P(t, sw + 1.2); D.cars.push({ ...p, y: 0, yaw: Math.atan2(tx, tz) + (rng.chance(0.5) ? 0 : Math.PI), color: rng.pick([0x56606a, 0x8a8678, 0x6a2e2a, 0x2e3a4a, 0xb8b4a8, 0x4a5a3a, 0x9a9a98]) }); }
      if (rng.chance(0.25)) { const p = P(rng.range(8, len - 8), WALK + 0.4); if (!across || !across(p.x, p.z)) D.hydrants.push({ ...p, y: CURB }); }
    }
    // Corners: quarter discs of paving with a kerb arc, sometimes red; a streetlight on some.
    const corners = [[r.x1, r.z1, 0, 's', 'e'], [r.x1, r.z0, -Math.PI / 2, 'e', 'n'], [r.x0, r.z0, Math.PI, 'n', 'w'], [r.x0, r.z1, Math.PI / 2, 'w', 's']];
    for (const [cx, cz, a0, s1, s2] of corners) {
      if (!c.sides[s1] || !c.sides[s2]) continue;
      const mid = a0 + Math.PI / 4;
      if (across && [0, 0.5, 1].some((f) => across(cx + Math.cos(mid) * sw * f, cz + Math.sin(mid) * sw * f))) {
        rng.chance(0.35); rng.chance(0.5); // keep the draws: the rest of the street stays as it was
        D.pads.push({ surf: 'asphalt', poly: [[cx, cz], [cx + Math.cos(a0) * sw, cz + Math.sin(a0) * sw], [cx + Math.cos(mid) * sw * Math.SQRT2, cz + Math.sin(mid) * sw * Math.SQRT2], [cx + Math.cos(a0 + Math.PI / 2) * sw, cz + Math.sin(a0 + Math.PI / 2) * sw]], y0: 0, y1: CURB + 0.012, tint: acrossTint });
        continue;
      }
      const fan = [[cx, cz]], arc = [];
      for (let i = 0; i <= 10; i++) { const a = a0 + (i / 10) * Math.PI / 2; fan.push([cx + Math.cos(a) * (sw - KW), cz + Math.sin(a) * (sw - KW)]); arc.push({ x: cx + Math.cos(a) * (sw - KW / 2), z: cz + Math.sin(a) * (sw - KW / 2) }); }
      D.pads.push({ surf: 'concrete', poly: fan, y0: 0, y1: CURB + 0.03, tint: 0xe0dcd4 });
      D.kerbs.push({ pts: arc, red: rng.chance(0.35) ? arc.slice(1).map((_, i) => i) : [], y: 0, street: true });
      if (rng.chance(0.5)) { const a = a0 + Math.PI / 4; D.lights.push({ x: cx + Math.cos(a) * (sw - 0.9), z: cz + Math.sin(a) * (sw - 0.9), y: CURB, yaw: Math.atan2(Math.cos(a), Math.sin(a)) }); }
    }
  }
  // Road paint on open segments: centre line, crosswalks at both ends, stop bars; a manhole now and then.
  for (const s of segs) {
    if (!s.open) continue;
    const r = s.rect, alongZ = s.axis === 'v';
    const len = alongZ ? r.z1 - r.z0 : r.x1 - r.x0, c = alongZ ? (r.x0 + r.x1) / 2 : (r.z0 + r.z1) / 2, rw = (alongZ ? r.x1 - r.x0 : r.z1 - r.z0) - 2 * sw;
    const at = (t, o) => (alongZ ? { x: c + o, z: r.z0 + t } : { x: r.x0 + t, z: c + o });
    const yaw = alongZ ? 0 : Math.PI / 2;
    if (len > 24) for (const o of [-0.13, 0.13]) { const p = at(len / 2, o); D.paint.push({ ...p, w: 0.1, d: len - 14, yaw, color: 0xd8a83a, y: 0 }); }
    for (const end of [0, 1]) {
      const t = end ? len - 3 : 3;
      for (let o = -rw / 2 + 0.6; o < rw / 2 - 0.4; o += 1.1) { const p = at(t, o + 0.27); D.paint.push({ ...p, w: 0.55, d: 3, yaw, color: 0xe8e6e0, y: 0 }); }
      const sb = at(end ? len - 5.2 : 5.2, end ? -rw / 4 : rw / 4); D.paint.push({ ...sb, w: rw / 2 - 0.3, d: 0.4, yaw, color: 0xe8e6e0, y: 0 }); // stop bar across the inbound lane
    }
    if (rng.chance(0.5)) D.manholes.push({ ...at(rng.range(8, Math.max(9, len - 8)), rng.range(-rw / 4, rw / 4)), y: 0 });
  }
  return D;
}
