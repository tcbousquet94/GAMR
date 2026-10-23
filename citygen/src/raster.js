// A 1 m occupancy raster over the whole map, so every step can reserve ground and nothing ever overlaps: streets,
// alleys, landmarks, lots. Lot sizes are whole metres and cells sit on whole metres, so lots tile it exactly.

export const R = { BLOCK: 1, STREET: 2, RESERVED: 4, BUILT: 8 };

export class Raster {
  constructor(w, h) { this.w = Math.ceil(w); this.h = Math.ceil(h); this.a = new Uint8Array(this.w * this.h); }
  get(x, z) { const ix = Math.floor(x), iz = Math.floor(z); return ix < 0 || iz < 0 || ix >= this.w || iz >= this.h ? 0 : this.a[iz * this.w + ix]; }
  // Visit the cells whose centre lies inside the rect.
  each(r, fn) {
    for (let z = Math.max(0, Math.floor(r.z0)); z < Math.min(this.h, Math.ceil(r.z1)); z++) {
      for (let x = Math.max(0, Math.floor(r.x0)); x < Math.min(this.w, Math.ceil(r.x1)); x++) {
        if (x + 0.5 > r.x0 && x + 0.5 < r.x1 && z + 0.5 > r.z0 && z + 0.5 < r.z1 && fn(z * this.w + x) === false) return false;
      }
    }
    return true;
  }
  mark(r, flag) { this.each(r, (i) => { this.a[i] |= flag; }); }
  // True if every cell in the rect has all `need` flags and none of `avoid`.
  test(r, need, avoid) { return this.each(r, (i) => { const v = this.a[i]; return (v & need) === need && !(v & avoid); }); }
}
