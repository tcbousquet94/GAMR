export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const finite = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export const dist2XZ = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
export const formatMoney = (cents) => {
  const c = Math.max(0, Math.round(cents));
  return `$${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
};
export const formatTime = (s) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
