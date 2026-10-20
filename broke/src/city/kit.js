// The Kit is what modules write into: render primitives (boxes, quads, signs, props) plus gameplay data (colliders,
// climb volumes, spawn points, interactable candidates, lights). It has no Three.js dependency so the city can be
// generated and tested in Node.

import { Box } from '../sim/physics.js';

export const MAT = { STD: 0, GLASS: 1, GLOW: 2, METAL: 3 };

// Collider tags (bit flags) let tests and AI tell what a box is.
export const TAG = { GROUND: 1, BUILDING: 2, PROP: 4, PLATFORM: 8, BOUNDARY: 16, RAIL: 32 };

export class Kit {
  constructor(rng, palette) {
    this.rng = rng;
    this.pal = palette;
    this.boxes = []; // {cx,cy,cz,sx,sy,sz,ry,rx,rz,color,mat,night}
    this.quads = []; // emissive quads (windows): {cx,cy,cz,w,h,nx,nz,day,night}
    this.signs = []; // {text, kind, cx,cy,cz, w,h, nx,nz, color}
    this.props = []; // {type, x,y,z, yaw, color}
    this.solids = []; // Box
    this.climbs = []; // {box, style, top}
    this.spawns = []; // {x,y,z,kind}
    this.slots = []; // interactable candidates {x,y,z,yaw,tags:[...], module}
    this.lights = []; // {x,y,z,color,radius,kind}
    this.strings = []; // string-light runs {ax,ay,az,bx,by,bz}
    this.links = []; // level connections for tests: {kind, from, to, x, z}
    this.module = null; // current module record while building
  }

  // --- collision + render ---------------------------------------------------------------------------------------
  solid(x0, y0, z0, x1, y1, z1, color, mat = MAT.STD, tag = TAG.BUILDING, opts = {}) {
    const b = new Box(x0, y0, z0, x1, y1, z1, tag);
    this.solids.push(b);
    if (color != null) this.box(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, color, mat, opts);
    return b;
  }
  collider(x0, y0, z0, x1, y1, z1, tag = TAG.PROP) {
    const b = new Box(x0, y0, z0, x1, y1, z1, tag);
    this.solids.push(b);
    return b;
  }
  // Render-only box from min/max corners.
  box(x0, y0, z0, x1, y1, z1, color, mat = MAT.STD, opts = {}) {
    this.boxes.push({
      cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, cz: (z0 + z1) / 2,
      sx: Math.abs(x1 - x0), sy: Math.abs(y1 - y0), sz: Math.abs(z1 - z0),
      ry: opts.ry || 0, rx: opts.rx || 0, rz: opts.rz || 0, color, mat, night: opts.night ?? color, flat: opts.flat,
    });
  }
  // Render-only box from center/size with rotation.
  boxC(cx, cy, cz, sx, sy, sz, color, mat = MAT.STD, opts = {}) {
    this.boxes.push({ cx, cy, cz, sx, sy, sz, ry: opts.ry || 0, rx: opts.rx || 0, rz: opts.rz || 0, color, mat, night: opts.night ?? color });
  }
  quad(cx, cy, cz, w, h, nx, nz, day, night) { this.quads.push({ cx, cy, cz, w, h, nx, nz, day, night }); }

  // Stairs / ramps: collision is a run of steps, visuals are one sloped slab. dir is the uphill direction.
  ramp(x0, z0, x1, z1, dir, fromY, toY, color, opts = {}) {
    const rise = toY - fromY;
    const len = dir === 'x+' || dir === 'x-' ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const steps = Math.max(1, Math.ceil(Math.abs(rise) / (opts.stepRise || 0.35)));
    const run = len / steps;
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
    const thick = opts.thick ?? 0.4;
    for (let i = 0; i < steps; i++) {
      const top = fromY + (rise * (i + 1)) / steps;
      const bottom = opts.solidBelow ? Math.min(fromY, 0) - 0.01 : top - thick - rise / steps;
      let a, b;
      if (dir === 'x+') { a = minX + run * i; b = a + run; this.collider(a, bottom, minZ, b, top, maxZ, TAG.PLATFORM); }
      if (dir === 'x-') { b = maxX - run * i; a = b - run; this.collider(a, bottom, minZ, b, top, maxZ, TAG.PLATFORM); }
      if (dir === 'z+') { a = minZ + run * i; b = a + run; this.collider(minX, bottom, a, maxX, top, b, TAG.PLATFORM); }
      if (dir === 'z-') { b = maxZ - run * i; a = b - run; this.collider(minX, bottom, a, maxX, top, b, TAG.PLATFORM); }
    }
    // Visual slope (a rotated slab).
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, cy = fromY + rise / 2 - thick / 2;
    const ang = Math.atan2(rise, len);
    const slopeLen = Math.hypot(rise, len);
    if (dir === 'x+' || dir === 'x-') this.boxC(cx, cy, cz, slopeLen, thick, maxZ - minZ, color, MAT.STD, { rz: dir === 'x+' ? ang : -ang });
    else this.boxC(cx, cy, cz, maxX - minX, thick, slopeLen, color, MAT.STD, { rx: dir === 'z+' ? -ang : ang });
    if (opts.solidBelow) this.box(minX, Math.min(fromY, 0) - 0.01, minZ, maxX, fromY, maxZ, color);
  }

  // A climbable volume (ladder, fire escape, scaffold, crane mast). Visuals are added by the caller or `style`.
  climb(x0, y0, z0, x1, y1, z1, style = 'ladder', from = 'street', to = 'roof') {
    const box = new Box(x0, y0, z0, x1, y1, z1);
    this.climbs.push({ box, style });
    this.link('climb', from, to, (x0 + x1) / 2, (z0 + z1) / 2);
    if (style === 'ladder') {
      const c = this.pal.metal;
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const w = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
      for (const s of [-1, 1]) {
        if (alongX) this.box(cx + s * w * 0.42 - 0.05, y0, cz - 0.05, cx + s * w * 0.42 + 0.05, y1, cz + 0.05, c, MAT.METAL);
        else this.box(cx - 0.05, y0, cz + s * w * 0.42 - 0.05, cx + 0.05, y1, cz + s * w * 0.42 + 0.05, c, MAT.METAL);
      }
      for (let y = y0 + 0.4; y < y1; y += 0.9) {
        if (alongX) this.box(cx - w * 0.42, y, cz - 0.04, cx + w * 0.42, y + 0.07, cz + 0.04, c, MAT.METAL);
        else this.box(cx - 0.04, y, cz - w * 0.42, cx + 0.04, y + 0.07, cz + w * 0.42, c, MAT.METAL);
      }
    }
    return box;
  }

  sign(text, kind, cx, cy, cz, w, h, nx, nz, color) { this.signs.push({ text, kind, cx, cy, cz, w, h, nx, nz, color }); }
  prop(type, x, y, z, yaw = 0, color = null) { this.props.push({ type, x, y, z, yaw, color }); }
  spawn(x, y, z, kind) { this.spawns.push({ x, y, z, kind, module: this.module?.id ?? -1 }); }
  slot(x, y, z, yaw, tags) { this.slots.push({ x, y, z, yaw, tags, module: this.module?.id ?? -1 }); }
  light(x, y, z, color, radius, kind = 'street') { this.lights.push({ x, y, z, color, radius, kind }); }
  link(kind, from, to, x, z) { this.links.push({ kind, from, to, x, z, module: this.module?.id ?? -1 }); }
}
