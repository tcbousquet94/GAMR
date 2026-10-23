// Seeded RNG (mulberry32) plus a few helpers. Every random decision in the sim and city goes through one of these,
// so a seed fully reproduces a city and (with the same inputs) a run.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  constructor(seed = 1) {
    this.state = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 1;
  }
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); } // inclusive
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  weighted(entries) { // [{w, v}]
    let total = 0;
    for (const e of entries) total += e.w;
    let r = this.next() * total;
    for (const e of entries) { if ((r -= e.w) <= 0) return e.v; }
    return entries[entries.length - 1].v;
  }
  fork(salt) { return new Rng((this.state ^ hashString(String(salt))) >>> 0); }
}
