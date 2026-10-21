// Procedural item / ability icons: a simple glyph drawn on a canvas in the tier colour. Cached as data URLs.

const cache = new Map();

// bare: glyph only (no tile), for the translucent round buttons.
export function icon(kind, color, size = 64, bare = false) {
  const key = `${kind}|${color}|${size}|${bare}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const s = size / 64;
  g.scale(s, s);
  if (!bare) {
    g.fillStyle = 'rgba(20,18,28,0.55)';
    g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    g.strokeStyle = color; g.lineWidth = 2.5; g.beginPath(); g.arc(32, 32, 29, 0, Math.PI * 2); g.stroke();
    g.translate(32, 32); g.scale(0.72, 0.72); g.translate(-32, -32);
  }
  g.fillStyle = color; g.strokeStyle = color; g.lineWidth = bare ? 3 : 4; g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = bare ? 3 : 0;
  (GLYPHS[kind] || GLYPHS.box)(g);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const poly = (g, pts, fill = true) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); fill ? g.fill() : g.stroke(); };
const circ = (g, x, y, r, fill = true) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); fill ? g.fill() : g.stroke(); };
const line = (g, ...pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };

const GLYPHS = {
  box: (g) => g.fillRect(20, 20, 24, 24),
  cup: (g) => { poly(g, [[20, 22], [44, 22], [40, 48], [24, 48]]); g.fillRect(18, 16, 28, 5); line(g, [44, 28], [50, 32], [43, 38]); },
  bean: (g) => { g.beginPath(); g.ellipse(32, 32, 11, 16, 0.5, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#1a1820'; line(g, [26, 22], [34, 32], [30, 42]); },
  headphones: (g) => { g.beginPath(); g.arc(32, 34, 15, Math.PI, 0); g.stroke(); g.fillRect(14, 32, 8, 14); g.fillRect(42, 32, 8, 14); },
  ticket: (g) => { poly(g, [[14, 22], [50, 22], [50, 28], [46, 32], [50, 36], [50, 42], [14, 42], [14, 36], [18, 32], [14, 28]]); g.fillStyle = '#1a1820'; g.font = '900 13px system-ui'; g.fillText('%', 28, 37); },
  toothpick: (g) => { line(g, [18, 46], [44, 18]); circ(g, 26, 38, 7); },
  cross: (g) => { g.fillRect(27, 16, 10, 32); g.fillRect(16, 27, 32, 10); },
  flame: (g) => poly(g, [[32, 14], [44, 34], [40, 46], [24, 46], [20, 34], [28, 28]]),
  card: (g) => { g.fillRect(14, 20, 36, 24); g.fillStyle = '#1a1820'; g.fillRect(14, 26, 36, 5); },
  jar: (g) => { g.fillRect(22, 14, 20, 6); poly(g, [[18, 22], [46, 22], [46, 48], [18, 48]], false); circ(g, 28, 40, 4); circ(g, 37, 36, 4); },
  bolt: (g) => poly(g, [[36, 12], [20, 36], [30, 36], [26, 52], [44, 28], [34, 28]]),
  bubble: (g) => { g.beginPath(); g.ellipse(32, 30, 16, 12, 0, 0, Math.PI * 2); g.fill(); poly(g, [[24, 38], [20, 50], [32, 40]]); },
  burst: (g) => { const p = []; for (let i = 0; i < 16; i++) { const r = i % 2 ? 8 : 18, a = (i / 16) * Math.PI * 2; p.push([32 + Math.cos(a) * r, 32 + Math.sin(a) * r]); } poly(g, p); },
  bag: (g) => { g.fillRect(16, 24, 32, 22); g.beginPath(); g.arc(32, 24, 10, Math.PI, 0); g.stroke(); },
  clock: (g) => { circ(g, 32, 32, 16, false); line(g, [32, 32], [32, 22]); line(g, [32, 32], [40, 36]); },
  shoe: (g) => poly(g, [[14, 40], [16, 26], [28, 26], [34, 34], [50, 38], [50, 46], [14, 46]]),
  slice: (g) => { poly(g, [[16, 18], [48, 22], [26, 50]]); g.fillStyle = '#1a1820'; circ(g, 28, 28, 3); circ(g, 34, 36, 3); },
  gavel: (g) => { g.save(); g.translate(32, 32); g.rotate(-0.7); g.fillRect(-14, -16, 28, 12); g.fillRect(-3, -6, 6, 26); g.restore(); },
  paper: (g) => { g.fillRect(18, 14, 28, 36); g.fillStyle = '#1a1820'; g.fillRect(22, 20, 20, 3); g.fillRect(22, 27, 16, 3); g.fillRect(22, 34, 20, 3); },
  horn: (g) => { poly(g, [[14, 28], [26, 28], [46, 16], [46, 48], [26, 36], [14, 36]]); },
  cart: (g) => { poly(g, [[12, 18], [18, 18], [22, 38], [46, 38], [50, 24], [20, 24]], false); circ(g, 26, 46, 4); circ(g, 42, 46, 4); },
  dart: (g) => { line(g, [16, 48], [44, 20]); poly(g, [[44, 14], [50, 20], [44, 26], [38, 20]]); },
  clipboard: (g) => { g.fillRect(18, 14, 28, 38); g.fillStyle = '#1a1820'; g.fillRect(22, 22, 20, 26); g.fillStyle = 'currentColor'; },
  salsa: (g) => { g.beginPath(); g.arc(32, 32, 14, 0.3, Math.PI * 1.7); g.stroke(); poly(g, [[44, 22], [50, 30], [40, 32]]); },
  jump: (g) => { line(g, [32, 50], [32, 18]); line(g, [20, 28], [32, 16], [44, 28]); line(g, [20, 52], [44, 52]); },
  equip: (g) => { circ(g, 32, 32, 14, false); line(g, [32, 22], [32, 42]); line(g, [22, 32], [42, 32]); },
  beam: (g) => { g.beginPath(); g.ellipse(32, 32, 14, 8, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1a1820'; circ(g, 32, 32, 4); g.fillStyle = 'currentColor'; line(g, [46, 32], [58, 26]); line(g, [46, 34], [58, 40]); },
  fly: (g) => { poly(g, [[32, 10], [40, 28], [36, 28], [38, 44], [32, 54], [26, 44], [28, 28], [24, 28]]); line(g, [14, 46], [22, 36]); line(g, [50, 46], [42, 36]); },
  revolver: (g) => { g.fillRect(14, 22, 30, 7); g.fillRect(24, 20, 12, 13); poly(g, [[24, 33], [32, 33], [28, 50], [19, 50]]); circ(g, 34, 35, 3, false); },
  aim: (g) => { circ(g, 32, 32, 13, false); line(g, [32, 10], [32, 22]); line(g, [32, 42], [32, 54]); line(g, [10, 32], [22, 32]); line(g, [42, 32], [54, 32]); circ(g, 32, 32, 2.5); },
  reload: (g) => { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; circ(g, 32 + Math.cos(a) * 12, 32 + Math.sin(a) * 12, 4.5); } circ(g, 32, 32, 3); },
  codeblue: (g) => { g.fillRect(29, 12, 6, 22); circ(g, 32, 44, 4); for (const x of [18, 46]) line(g, [x, 16], [x - 4, 26]); },
};
