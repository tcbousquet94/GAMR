// The mayor game (part 1): neighbourhood scores, a weekly budget, and businesses that open and close.
//
// You run the city from City Hall. Every in-game week (MAYOR.weekSeconds of play) the books settle: taxes come in
// from households and open businesses, the budget goes out to police, city services, parks and small-business
// grants, and every neighbourhood's scores move toward what that spending (and the gangs) make of them. Businesses
// follow their neighbourhood: a safe, clean, busy area keeps its shops open; a neglected one boards them up.
//
// Pure and deterministic (its own seeded random stream), driven by the town game's step; the UI reads it.

import { Rng } from '../../core/rng.js';
import { BIZ } from '../empire/data.js';

export const MAYOR = {
  weekSeconds: 150, // one in-game week of play
  startCash: 40000,
  tax: { min: 0.04, max: 0.25, start: 0.12 },
  // Default weekly spending ($), and the slider ranges.
  budget: { police: 16000, services: 11000, parks: 5000, grants: 7000 },
  maxSpend: 50000,
  // Weekly revenue of a walk-in shop by kind (turf businesses use the empire table, per day x 7).
  storeRevenue: { market: 4200, taco: 3000, discount: 3600 },
  move: 0.35, // how far a score moves toward its target each week
};
export const STATS = ['safety', 'cleanliness', 'happiness', 'wealth'];
const clamp = (v) => Math.max(0, Math.min(100, v));
const sat = (spend, scale) => 1 - Math.exp(-Math.max(0, spend) / Math.max(1, scale)); // diminishing returns, 0..1

export class Mayor {
  // city: the loaded town city (blocks with hood, turf, businesses, kitData). blockAt(x, z) -> turf block.
  constructor(city, seed, blockAt) {
    this.rng = new Rng(`mayor:${seed}`);
    this.week = 1;
    this.clock = 0;
    this.cash = MAYOR.startCash;
    this.budget = { tax: MAYOR.tax.start, ...MAYOR.budget, focus: null };
    this.reports = [];
    const hoodOf = (b) => b?.hood ?? 'Downtown';
    // Neighbourhoods.
    const H = new Map();
    const hood = (name) => { if (!H.has(name)) H.set(name, { name, households: 0, businesses: [], blocks: 0, gangBlocks: 0, parks: 0, core: 0 }); return H.get(name); };
    for (const b of city.turf.blocks) {
      const h = hood(hoodOf(b));
      h.blocks++;
      if (b.owner && b.owner !== 'neutral') h.gangBlocks++;
      if (b.zone === 'park') h.parks++;
      if (b.zone === 'commercial' || b.zone === 'landmark' || b.zone === 'civic') h.core++;
    }
    const D = city.kitData || {};
    for (const x of D.houses || []) hood(hoodOf(blockAt(x.x, x.z))).households += 1;
    for (const a of D.apartments || []) hood(hoodOf(blockAt(a.x, a.z))).households += (a.floors || 2) * Math.max(2, Math.round(a.w / 5.5));
    for (const k of D.blocks || []) hood(hoodOf(blockAt(k.x, k.z))).households += Math.max(0, (k.floors || 3) - 1) * 2;
    // Businesses: the turf businesses and every shop on the street.
    this.businesses = [];
    for (const b of city.businesses || []) {
      const p = b.capture || b.door;
      this.businesses.push({ id: `biz:${b.id}`, name: b.name, type: b.type, x: p.x, z: p.z, hood: hoodOf(city.turf.blocks[b.block] ?? blockAt(p.x, p.z)), revenue: (BIZ[b.type]?.revenue ?? 800) * 7, ref: { business: b.id } });
    }
    (D.stores || []).forEach((s, i) => {
      this.businesses.push({ id: `store:${i}`, name: s.name || 'Shop', type: s.kind || 'market', x: s.x, z: s.z, hood: hoodOf(blockAt(s.x, s.z)), revenue: MAYOR.storeRevenue[s.kind || 'market'] ?? 3500, ref: { store: i } });
    });
    for (const b of this.businesses) hood(b.hood).businesses.push(b);
    // Starting scores: gangs make a place unsafe; the core is busier and better off.
    this.hoods = [...H.values()].filter((h) => h.households + h.businesses.length > 0).sort((a, b) => a.name.localeCompare(b.name));
    for (const h of this.hoods) {
      h.gang = h.blocks ? h.gangBlocks / h.blocks : 0;
      h.base = 32 + 26 * (h.blocks ? h.core / h.blocks : 0);
      h.safety = clamp(62 - 40 * h.gang + this.rng.range(-6, 6));
      h.cleanliness = clamp(46 + this.rng.range(-8, 8));
      h.wealth = clamp(h.base + this.rng.range(-5, 5));
      h.happiness = clamp(0.4 * h.safety + 0.3 * h.cleanliness + 18);
    }
    for (const b of this.businesses) { b.health = clamp(this.rng.range(30, 80) - 25 * (this.hood(b.hood)?.gang ?? 0)); b.open = b.health >= 30; }
    this.history = [this.snapshot()];
  }

  hood(name) { return this.hoods.find((h) => h.name === name); }
  get households() { return this.hoods.reduce((n, h) => n + h.households, 0); }
  get approval() { const n = this.households || 1; return this.hoods.reduce((a, h) => a + h.happiness * h.households, 0) / n; }
  openCount() { return this.businesses.filter((b) => b.open).length; }

  setBudget(patch) {
    const b = { ...this.budget, ...patch };
    b.tax = Math.max(MAYOR.tax.min, Math.min(MAYOR.tax.max, +b.tax || MAYOR.tax.start));
    for (const k of ['police', 'services', 'parks', 'grants']) b[k] = Math.max(0, Math.min(MAYOR.maxSpend, Math.round(+b[k] || 0)));
    if (b.focus && !this.hood(b.focus)) b.focus = null;
    this.budget = b;
  }

  // How a department's money splits over the neighbourhoods: by households (and shops for grants), the focus doubled.
  share(h, weightOf) {
    const w = (q) => weightOf(q) * (this.budget.focus === q.name ? 2 : 1);
    const tot = this.hoods.reduce((a, q) => a + w(q), 0) || 1;
    return w(h) / tot;
  }

  // This week's money if it settled now: income by source, spending, the balance.
  projection() {
    const t = this.budget.tax;
    let biz = 0, prop = 0;
    for (const b of this.businesses) if (b.open) biz += b.revenue * (0.6 + this.hood(b.hood).wealth / 125) * t * 0.45; // the city's cut of the till
    for (const h of this.hoods) prop += h.households * (60 + 2 * h.wealth) * t;
    const spend = this.budget.police + this.budget.services + this.budget.parks + this.budget.grants;
    return { business: Math.round(biz), property: Math.round(prop), income: Math.round(biz + prop), spend, net: Math.round(biz + prop - spend) };
  }

  // Advance play time; settles a week when one has passed. Returns the week's report then, else null.
  update(dt) {
    this.clock += dt;
    if (this.clock < MAYOR.weekSeconds) return null;
    this.clock -= MAYOR.weekSeconds;
    return this.settle();
  }

  settle() {
    const B = this.budget, rng = this.rng, before = this.snapshot();
    const money = this.projection();
    this.cash += money.net;
    const taxPain = Math.max(0, B.tax - 0.08) * 150, bizTaxPain = Math.max(0, B.tax - 0.08) * 170;
    const events = [];
    for (const h of this.hoods) {
      const homes = Math.max(1, h.households), shops = Math.max(1, h.businesses.length);
      const police = B.police * this.share(h, (q) => q.households + 3 * q.businesses.length);
      const services = B.services * this.share(h, (q) => q.households + 2 * q.businesses.length);
      const parks = B.parks * this.share(h, (q) => q.households);
      const open = h.businesses.length ? h.businesses.filter((b) => b.open).length / h.businesses.length : 1;
      const T = {
        safety: 24 + 60 * sat(police, 20 * (homes + 3 * shops)) - 32 * h.gang + 0.1 * (h.cleanliness - 50),
        cleanliness: 18 + 74 * sat(services, 15 * (homes + 2 * shops)),
        happiness: 0.35 * h.safety + 0.25 * h.cleanliness + 22 * sat(parks, 9 * homes) + 4 * h.parks + 20 * open - taxPain + 8,
        wealth: h.base + 28 * (open - 0.7) + 0.15 * (h.safety - 50),
      };
      for (const k of STATS) h[k] = clamp(h[k] + (T[k] - h[k]) * MAYOR.move);
      // Shops follow their neighbourhood.
      const grants = B.grants * this.share(h, (q) => q.businesses.length);
      const help = 26 * sat(grants, 300 * shops);
      for (const b of h.businesses) {
        const target = 0.3 * h.safety + 0.25 * h.wealth + 0.15 * h.cleanliness + help + 24 - bizTaxPain;
        b.health = clamp(b.health + (target - b.health) * 0.4 + rng.range(-7, 7));
        if (b.open && b.health < 30) { b.open = false; events.push({ kind: 'closed', text: `${b.name} closed its doors (${h.name}).`, business: b.id }); }
        else if (!b.open && b.health > 52 && rng.chance(0.6)) { b.open = true; b.health = Math.max(b.health, 55); events.push({ kind: 'opened', text: `${b.name} reopened (${h.name}).`, business: b.id }); }
      }
    }
    const after = this.snapshot();
    const report = { week: this.week, money, cash: this.cash, approval: this.approval, events, before, after };
    this.reports.unshift(report);
    this.reports.length = Math.min(this.reports.length, 12);
    this.history.push(after);
    this.week++;
    return report;
  }

  snapshot() {
    return { week: this.week, cash: this.cash, approval: Math.round(this.approval), open: this.openCount(), hoods: Object.fromEntries(this.hoods.map((h) => [h.name, Object.fromEntries(STATS.map((k) => [k, Math.round(h[k])]))])) };
  }
}
