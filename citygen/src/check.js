// Checks on a finished plan: every lot inside its block and flush with the street it faces, nothing overlapping
// (lots, alleys, landmark grounds, streets), and how much of the street frontage got built. Returns
// { ok, problems: [{kind, ...}], stats }.

import { overlap, sideRect, sideLength } from './geom.js';

const EPS = 1e-6;
const inside = (a, r) => a.x0 >= r.x0 - EPS && a.x1 <= r.x1 + EPS && a.z0 >= r.z0 - EPS && a.z1 <= r.z1 + EPS;

export function checkPlan(plan) {
  const problems = [];
  const taken = [...plan.lots.map((l) => ({ what: `lot ${l.id}`, rect: l.rect })), ...plan.alleys.map((a, i) => ({ what: `alley ${i}`, rect: a.rect })), ...plan.landmarks.filter((m) => m.reserved).map((m) => ({ what: `landmark ${m.id}`, rect: m.reserved }))];
  for (const l of plan.lots) {
    const b = plan.blocks[l.block];
    if (!inside(l.rect, b.rect)) problems.push({ kind: 'outside-block', lot: l.id });
    // Flush with its street: the lot's front edge lies on the block edge on that side.
    if (overlap(l.rect, sideRect(b.rect, l.front, 0, sideLength(b.rect, l.front), 0, 0.5)) < EPS) problems.push({ kind: 'not-on-street', lot: l.id });
    for (const s of plan.streets) if (overlap(l.rect, s.rect) > EPS) problems.push({ kind: 'on-street', lot: l.id, street: s.id });
  }
  for (let i = 0; i < taken.length; i++) for (let j = i + 1; j < taken.length; j++) {
    if (overlap(taken[i].rect, taken[j].rect) > EPS) problems.push({ kind: 'overlap', a: taken[i].what, b: taken[j].what });
  }
  // Frontage coverage: the share of each built block's street edge that has a lot (or landmark) on it.
  let edge = 0, built = 0;
  for (const b of plan.blocks) {
    if (b.landmark && !plan.landmarks.some((m) => m.block === b.id)) continue; // whole-block landmark (a park)
    for (const s of ['n', 'e', 's', 'w']) {
      const L = sideLength(b.rect, s), strip = sideRect(b.rect, s, 0, L, 0, 0.5);
      edge += L;
      let cover = 0;
      for (const t of taken) cover += overlap(strip, t.rect) / 0.5;
      built += Math.min(L, cover);
    }
  }
  const byAsset = {};
  for (const l of plan.lots) byAsset[l.asset] = (byAsset[l.asset] || 0) + 1;
  const byZone = {};
  for (const b of plan.blocks) byZone[b.zone] = (byZone[b.zone] || 0) + 1;
  return { ok: problems.length === 0, problems, stats: { blocks: plan.blocks.length, lots: plan.lots.length, alleys: plan.alleys.length, landmarks: plan.landmarks.length, frontageBuilt: edge ? built / edge : 0, byAsset, byZone } };
}
