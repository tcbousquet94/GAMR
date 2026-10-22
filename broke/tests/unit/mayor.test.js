// The mayor game: neighbourhood scores, the weekly budget, businesses that open and close.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMap } from '../../src/city/maps/load.js';
import { TownGame } from '../../src/sim/town/townGame.js';
import { BEACON } from '../../src/sim/survivors/beacon.js';
import { Mayor, MAYOR, STATS } from '../../src/sim/mayor/mayor.js';
import raw from '../../src/maps/palmetto/base.js';
import { decodeMap } from '../../src/city/maps/decode.js';
import edits from '../../src/maps/palmetto/edits.js';
const base = await decodeMap(raw);

const g = new TownGame({ city: loadMap(base, edits), survivor: BEACON });
const fresh = () => new Mayor(g.city, 396873, (x, z) => g.blockAt(x, z));
const weeks = (m, n) => { for (let i = 0; i < n; i++) m.settle(); return m; };

test('the city is read in: neighbourhoods, households, every business and shop', () => {
  const m = fresh();
  assert.ok(m.hoods.length >= 4, `${m.hoods.length} neighbourhoods`);
  assert.ok(m.households > 300);
  assert.ok(m.businesses.some((b) => b.ref.business != null) && m.businesses.some((b) => b.ref.store != null));
  for (const h of m.hoods) for (const k of STATS) assert.ok(h[k] >= 0 && h[k] <= 100);
  assert.ok(g.mayor, 'the town game has a mayor');
});

test('deterministic: the same city and budget play out the same', () => {
  const a = weeks(fresh(), 6), b = weeks(fresh(), 6);
  assert.deepEqual(a.snapshot(), b.snapshot());
});

test('the budget is clamped and the focus must be a real neighbourhood', () => {
  const m = fresh();
  m.setBudget({ tax: 0.9, police: -5, parks: 1e9, focus: 'Atlantis' });
  assert.equal(m.budget.tax, MAYOR.tax.max);
  assert.equal(m.budget.police, 0);
  assert.equal(m.budget.parks, MAYOR.maxSpend);
  assert.equal(m.budget.focus, null);
});

test('trade-offs: the default holds, austerity rots the city, low taxes run a deficit', () => {
  const d = weeks(fresh(), 10);
  assert.ok(d.cash > 0 && d.approval > 50, `default: $${Math.round(d.cash)}, approval ${d.approval.toFixed(0)}`);
  const a = fresh(); a.setBudget({ police: 3000, services: 2000, parks: 0, grants: 0 }); weeks(a, 10);
  assert.ok(a.cash > d.cash, 'austerity saves money');
  assert.ok(a.approval < d.approval - 10, `austerity costs approval (${a.approval.toFixed(0)} vs ${d.approval.toFixed(0)})`);
  assert.ok(a.openCount() < d.openCount() - 5, `and shops (${a.openCount()} vs ${d.openCount()} open)`);
  const l = fresh(); l.setBudget({ tax: 0.05 }); weeks(l, 6);
  assert.ok(l.cash < MAYOR.startCash, 'low taxes lose money');
  assert.ok(l.approval > d.approval - 3, 'but people like them');
});

test('police spending and a focus raise the safety of a neighbourhood', () => {
  const base = weeks(fresh(), 6), worst = base.hoods.slice().sort((p, q) => p.safety - q.safety)[0].name;
  const m = fresh(); m.setBudget({ police: 32000, focus: worst }); weeks(m, 6);
  assert.ok(m.hood(worst).safety > base.hood(worst).safety + 8, `${worst}: ${m.hood(worst).safety.toFixed(0)} vs ${base.hood(worst).safety.toFixed(0)}`);
});

test('a week settles on the clock, with a report of the money and every closing', () => {
  const m = fresh();
  assert.equal(m.update(MAYOR.weekSeconds - 1), null);
  const r = m.update(2);
  assert.ok(r && r.week === 1 && m.week === 2 && typeof r.money.net === 'number' && Array.isArray(r.events));
  const a = fresh(); a.setBudget({ police: 0, services: 0, parks: 0, grants: 0, tax: 0.25 }); weeks(a, 8);
  const closed = a.reports.flatMap((x) => x.events).filter((e) => e.kind === 'closed');
  assert.ok(closed.length > 5 && closed.every((e) => a.businesses.some((b) => b.id === e.business)), `${closed.length} closings reported`);
});

test('the turf businesses know their street face (for boarding them up)', () => {
  for (const b of g.city.businesses) assert.ok(b.front?.win?.length === 2 && b.front.out, b.name);
});
