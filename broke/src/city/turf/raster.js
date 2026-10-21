// A 1 m occupancy raster over the whole map, so generation steps can reserve space and never overlap: roads,
// the diagonal, business footprints, buildings, plazas.

export const R = { BLOCK: 1, STREET: 2, DIAG: 4, RESERVED: 8, BUILT: 16, NOFURN: 32, MEWS: 64 };

export class Raster {
  constructor(w, h) { this.w = Math.ceil(w); this.h = Math.ceil(h); this.a = new Uint8Array(this.w * this.h); }
  idx(x, z) { const ix = Math.floor(x), iz = Math.floor(z); return ix < 0 || iz < 0 || ix >= this.w || iz >= this.h ? -1 : iz * this.w + ix; }
  get(x, z) { const i = this.idx(x, z); return i < 0 ? 0 : this.a[i]; }
  // Set flags over a rect (cells whose centre lies inside it).
  mark(r, flag) {
    for (let z = Math.max(0, Math.floor(r.z0)); z < Math.min(this.h, Math.ceil(r.z1)); z++) {
      for (let x = Math.max(0, Math.floor(r.x0)); x < Math.min(this.w, Math.ceil(r.x1)); x++) {
        if (x + 0.5 > r.x0 && x + 0.5 < r.x1 && z + 0.5 > r.z0 && z + 0.5 < r.z1) this.a[z * this.w + x] |= flag;
      }
    }
  }
  // True if every cell in the rect has all `need` flags and none of `avoid`.
  test(r, need, avoid) {
    for (let z = Math.max(0, Math.floor(r.z0)); z < Math.min(this.h, Math.ceil(r.z1)); z++) {
      for (let x = Math.max(0, Math.floor(r.x0)); x < Math.min(this.w, Math.ceil(r.x1)); x++) {
        if (!(x + 0.5 > r.x0 && x + 0.5 < r.x1 && z + 0.5 > r.z0 && z + 0.5 < r.z1)) continue;
        const v = this.a[z * this.w + x];
        if ((v & need) !== need || (v & avoid)) return false;
      }
    }
    return true;
  }
}
