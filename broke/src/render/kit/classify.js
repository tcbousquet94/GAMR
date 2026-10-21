// Renders the generator's plain coloured boxes (towers, shops, warehouses, garages, props) with the kit's textured
// materials, so every part of the generated city gets the same surfaces and wear as the hand-built kit pieces. A box
// can name its surface (`surf`); otherwise it is classified from its material, size, height and colour:
// glass -> reflective glass, metal -> painted metal, thin and at street level -> paint, big and low -> ground
// (grass / asphalt / paving), tall walls -> brick for red-brown, stucco for light, concrete for grey, small -> trim.
// Emissive boxes (neon, lit signs) stay in the old city mesh (they need its day/night colours).

import * as THREE from 'three';
import { MAT } from '../../city/kit.js';

const _c = new THREE.Color(), _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

export function surfOf(b) {
  if (b.surf) return b.surf;
  if (b.mat === MAT.GLASS) return 'carGlass';
  if (b.mat === MAT.METAL) return 'metalPaint';
  _c.set(b.color);
  const { r, g, b: bl } = _c, lum = 0.3 * r + 0.59 * g + 0.11 * bl;
  const top = b.cy + b.sy / 2, area = b.sx * b.sz, vol = area * b.sy, maxd = Math.max(b.sx, b.sz);
  if (b.sy < 0.06 && top < 0.35) return 'roadPaint';
  if (top <= 0.3 && b.sy < 1.6 && area > 25) return g > r * 1.15 && g > bl ? 'grass' : lum < 0.12 ? 'asphalt' : 'concrete';
  if (vol < 1.5 && maxd < 8) return lum < 0.2 && Math.abs(r - bl) < 0.05 ? 'metalPaint' : 'trim';
  if (b.sy > 2.0 && maxd > 2.5) {
    if (r > g * 1.18 && r > bl * 1.3) return 'brick';
    if (lum > 0.3) return 'stucco';
    return 'plaster';
  }
  return lum > 0.35 ? 'trim' : 'concrete';
}

// Tint so the textured surface lands near the box's original colour (textures have albedo ~0.6-0.75).
function tintOf(surf, color) {
  _c.set(color);
  if (surf === 'brick') { const l = 0.3 * _c.r + 0.59 * _c.g + 0.11 * _c.b; return new THREE.Color(1, 1, 1).multiplyScalar(0.7 + l * 1.4); }
  if (surf === 'roadPaint' || surf === 'carGlass') return _c.clone();
  // Pull the old palette's stylised hues toward grey: the remastered look is sun-faded and natural.
  const l = 0.3 * _c.r + 0.59 * _c.g + 0.11 * _c.b;
  return _c.clone().lerp(new THREE.Color(l, l, l), 0.4).multiplyScalar(1.35);
}

// B(x, z) -> Batch. Adds every non-emissive kit box.
export function addKitBoxes(kit, B) {
  // The old window panels (flat emissive quads) become real recessed-look windows with a frame.
  for (const q of kit.quads) {
    const yaw = Math.atan2(q.nx, q.nz), m = (ox, oy, oz, w, h, d, key, col) => {
      const M = new THREE.Matrix4().makeRotationY(yaw).setPosition(q.cx + q.nx * oz, q.cy + oy, q.cz + q.nz * oz);
      M.multiply(new THREE.Matrix4().makeTranslation(ox, 0, 0));
      B(q.cx, q.cz).boxM(key, w, h, d, M, col, key === 'window' ? { uv: 'native' } : undefined);
    };
    m(0, 0, 0.01, q.w, q.h, 0.03, 'window', 0xffffff);
    m(0, q.h / 2 + 0.04, 0.03, q.w + 0.16, 0.08, 0.06, 'trim', 0xd0c8b8); m(0, -q.h / 2 - 0.05, 0.05, q.w + 0.2, 0.06, 0.12, 'trim', 0xd0c8b8);
    m(-q.w / 2 - 0.04, 0, 0.03, 0.08, q.h, 0.06, 'trim', 0xd0c8b8); m(q.w / 2 + 0.04, 0, 0.03, 0.08, q.h, 0.06, 'trim', 0xd0c8b8);
  }
  for (const b of kit.boxes) {
    if (b.mat === MAT.GLOW) continue;
    const surf = surfOf(b);
    _e.set(b.rx || 0, b.ry || 0, b.rz || 0);
    _q.setFromEuler(_e);
    const m = new THREE.Matrix4().compose(_v.set(b.cx, b.cy, b.cz), _q, _s);
    B(b.cx, b.cz).boxM(surf, b.sx, b.sy, b.sz, m, tintOf(surf, b.color));
  }
}
