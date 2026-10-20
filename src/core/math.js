export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// Frame-rate independent exponential smoothing. `rate` ~ how many "e-folds" per second.
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

export const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export const dampAngle = (a, b, rate, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-rate * dt));

// Yaw (rotation.y) that makes a +Z-facing object look along (dx, dz).
export const yawTo = (dx, dz) => Math.atan2(dx, dz);

export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
