// Town map: a bright, labelled top-down map of the district drawn from the territory data (city.turf). In the spirit
// of the EarthBound town maps (layout and legibility only): blocks tinted by zone, borders in owner colours,
// businesses labelled by type, the landmark, both HQs, edges and the roads out, and where you are.
// This is the pause-menu map now and the phone's map later.

export const OWNER_COLORS = { neutral: '#6f6a7a', gang0: '#2f7fe0', gang1: '#e0453a' };
const ZONE_FILL = { commercial: '#f7d7a6', residential: '#c9e4a9', civic: '#d7c8f0', park: '#8fd27a', landmark: '#f6e58d', industrial: '#d9d2c6' };
const OWNER_TINT = { gang0: 'rgba(47,127,224,0.22)', gang1: 'rgba(224,69,58,0.22)' };
const TYPE_STYLE = {
  bodega: { glyph: 'B', color: '#1f9d6a' }, pawn: { glyph: '$', color: '#c8901f' }, laundromat: { glyph: 'L', color: '#3a7ad8' },
  boxing: { glyph: 'G', color: '#c0392b' }, auto: { glyph: 'A', color: '#6a6470' }, clinic: { glyph: '+', color: '#d94a4a' }, diner: { glyph: 'D', color: '#c2307e' },
};

export function drawTownMap(canvas, turf, opts = {}) {
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const W = canvas.clientWidth || 900, H = canvas.clientHeight || 700;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pad = 46, head = 64;
  const sx = turf.size.x, sz = turf.size.z;
  const k = Math.min((W - pad * 2) / sx, (H - pad - head - 40) / sz);
  const ox = (W - sx * k) / 2, oz = head + (H - head - 40 - sz * k) / 2;
  const X = (x) => ox + x * k, Z = (z) => oz + z * k;
  const rect = (r, fill, stroke, lw = 1) => { g.beginPath(); g.rect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); } };

  // Paper.
  g.fillStyle = '#fbf3df'; g.fillRect(0, 0, W, H);
  // Edges.
  const inner = innerRect(turf);
  for (const [side, kind] of Object.entries(turf.edges)) {
    const r = side === 'n' ? { x0: 0, z0: 0, x1: sx, z1: inner.z0 } : side === 's' ? { x0: 0, z0: inner.z1, x1: sx, z1: sz } : side === 'w' ? { x0: 0, z0: inner.z0, x1: inner.x0, z1: inner.z1 } : { x0: inner.x1, z0: 0, x1: sx, z1: sz };
    if (kind === 'river') { rect(r, '#7cc4ef'); rect({ ...r, x1: r.x0 + 9 }, '#e9e1cf'); }
    else if (kind === 'railyard') { rect(r, '#c9bfae'); g.strokeStyle = '#8a7e6a'; g.lineWidth = 1.2; for (const d of [9, 15, 21, 27]) { g.beginPath(); g.moveTo(X(0), Z(inner.z0 - d)); g.lineTo(X(sx), Z(inner.z0 - d)); g.stroke(); } }
    else if (kind === 'highway') { rect(r, '#d4d0c8'); rect({ x0: 0, z0: inner.z1 + 10, x1: sx, z1: inner.z1 + 26 }, '#9a96a0'); }
    else if (kind === 'warehouses') { rect(r, '#d9cbb3'); }
    edgeLabel(g, side, kind, X, Z, inner, sx, sz);
  }
  // Streets (open segments + intersections), the diagonal.
  rect(inner, '#e4e0d8');
  for (const s of turf.roads.segments) if (!s.open) rect(s.rect, '#efe6d2');
  const D = turf.roads.diagonal;
  if (D) { g.strokeStyle = '#e4e0d8'; g.lineWidth = D.width * k; g.lineCap = 'butt'; g.beginPath(); g.moveTo(X(D.ax), Z(D.az)); g.lineTo(X(D.bx), Z(D.bz)); g.stroke(); }
  // Blocks: zone fill, owner border.
  for (const b of turf.blocks) for (const r of b.rects) rect(r, ZONE_FILL[b.zone] || '#eee');
  if (D) { g.strokeStyle = 'rgba(228,224,216,0.95)'; g.lineWidth = (D.width - 2) * k; g.beginPath(); g.moveTo(X(D.ax), Z(D.az)); g.lineTo(X(D.bx), Z(D.bz)); g.stroke(); }
  // Territory shading by owner (a warehouse's block plus its businesses' blocks).
  for (const b of turf.blocks) if (OWNER_TINT[b.owner]) for (const r of b.rects) rect(r, OWNER_TINT[b.owner]);
  // Buildings (faint) so blocks read as places.
  for (const r of opts.buildings || []) rect(r, 'rgba(90,80,100,0.16)');
  for (const b of turf.blocks) {
    const bb = b.bounds;
    g.setLineDash(b.owner === 'neutral' ? [5, 4] : []);
    rect({ x0: bb.x0 - 1.5, z0: bb.z0 - 1.5, x1: bb.x1 + 1.5, z1: bb.z1 + 1.5 }, null, OWNER_COLORS[b.owner] || '#666', b.owner === 'neutral' ? 2 : 4);
    g.setLineDash([]);
  }
  // Landmark.
  for (const l of turf.landmarks) { rect(l.base, '#d8b04a', '#8a6a1a', 1.5); star(g, X(l.x), Z(l.z), 13, '#ffd34a', '#7a5a10'); label(g, l.name, X(l.x), Z(l.z) - 20, 13, '#5a420a', true); }
  // Links: each warehouse to the businesses it controls.
  g.setLineDash([6, 4]); g.lineWidth = 2;
  for (const w of turf.warehouses || []) for (const id of w.businesses) {
    const b = turf.businesses[id];
    g.strokeStyle = w.owner === 'neutral' ? 'rgba(70,64,80,0.7)' : OWNER_COLORS[w.owner];
    g.beginPath(); g.moveTo(X(w.safe.x), Z(w.safe.z)); g.lineTo(X(b.capture.x), Z(b.capture.z)); g.stroke();
  }
  g.setLineDash([]);
  // Warehouses: the main icons (compound outline + a keep with battlements), HQs marked.
  for (const w of turf.warehouses || []) {
    rect(w.compound, 'rgba(255,255,255,0.45)', '#6a6470', 1.2);
    const col = w.owner === 'neutral' ? '#5a5466' : OWNER_COLORS[w.owner];
    keep(g, X(w.safe.x), Z(w.safe.z), w.hq != null ? 15 : 12, col);
    label(g, w.name, X(w.safe.x), Z(w.safe.z) + (w.hq != null ? 26 : 22), 12, '#2a2430', true);
    label(g, w.hq != null ? `GANG ${w.hq + 1} HQ` : `Warehouse \u00b7 ${w.businesses.length} business${w.businesses.length > 1 ? 'es' : ''}`, X(w.safe.x), Z(w.safe.z) + (w.hq != null ? 40 : 35), 10, w.hq != null ? col : '#6a6470', w.hq != null);
  }
  // Businesses.
  for (const biz of turf.businesses) {
    rect(biz.footprint, 'rgba(255,255,255,0.55)');
    const st = TYPE_STYLE[biz.type] || { glyph: '?', color: '#555' };
    const x = X(biz.capture.x), z = Z(biz.capture.z);
    const isHq = false;
    const col = st.color;
    g.beginPath(); g.arc(x, z, isHq ? 12 : 9, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.font = `700 ${isHq ? 12 : 11}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(isHq ? 'HQ' : st.glyph, x, z + 0.5);
    label(g, biz.name, x, z + (isHq ? 22 : 18), 11.5, '#2a2430', true);
    label(g, biz.hq != null ? `Diner \u00b7 Gang ${biz.hq + 1}` : TYPE_LABEL[biz.type], x, z + 31, 10, '#6a6470');
  }
  // Roads out.
  for (const c of turf.connections || []) { g.fillStyle = '#1f6a4a'; arrow(g, X(c.x), Z(c.z), c.side, 9); }
  // You are here.
  if (opts.player) {
    const p = opts.player;
    g.save(); g.translate(X(p.x), Z(p.z)); g.rotate(-p.yaw);
    g.beginPath(); g.moveTo(0, -11); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath();
    g.fillStyle = '#1fa89a'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.restore();
    label(g, 'You', X(p.x), Z(p.z) + 18, 11, '#167a70', true);
  }
  // Title, compass, legend.
  g.fillStyle = '#2a2430'; g.font = '600 30px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText(turf.district.name.toUpperCase(), pad, 44);
  g.font = 'italic 500 15px "Cormorant Garamond", Georgia, serif'; g.fillStyle = '#6a6470';
  g.fillText(opts.subtitle || turf.district.personality, pad + g.measureText(turf.district.name.toUpperCase()).width * 1.9 + 14, 42);
  north(g, W - pad - 10, 40);
  legend(g, pad, H - 22);
}

const TYPE_LABEL = { bodega: 'Bodega', pawn: 'Pawn Shop', laundromat: 'Laundromat', boxing: 'Boxing Gym', auto: 'Auto Shop', clinic: 'Clinic', diner: 'Diner' };

function innerRect(turf) {
  const segs = turf.roads.intersections;
  return { x0: Math.min(...segs.map((s) => s.rect.x0)), z0: Math.min(...segs.map((s) => s.rect.z0)), x1: Math.max(...segs.map((s) => s.rect.x1)), z1: Math.max(...segs.map((s) => s.rect.z1)) };
}

function label(g, text, x, y, size, color, bold) {
  g.font = `${bold ? 700 : 500} ${size}px system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 3.5; g.strokeStyle = 'rgba(251,243,223,0.95)'; g.strokeText(text, x, y);
  g.fillStyle = color; g.fillText(text, x, y);
}

// A little keep with battlements: the warehouse icon.
function keep(g, x, y, r, col) {
  g.save(); g.translate(x, y);
  g.beginPath();
  const w = r, h = r * 0.9, m = r / 3;
  g.moveTo(-w, h); g.lineTo(-w, -h + m);
  for (let k = 0; k < 3; k++) { const x0 = -w + k * (2 * w / 3); g.lineTo(x0, -h); g.lineTo(x0 + m, -h); g.lineTo(x0 + m, -h + m); g.lineTo(x0 + 2 * w / 3, -h + m); }
  g.lineTo(w, -h); g.lineTo(w, h); g.closePath();
  g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
  g.fillStyle = '#fff'; g.fillRect(-r * 0.25, h * 0.15, r * 0.5, h * 0.85); // gate
  g.restore();
}

function star(g, x, y, r, fill, stroke) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = stroke; g.stroke();
}

function arrow(g, x, y, side, s) {
  const a = { n: -Math.PI / 2, s: Math.PI / 2, w: Math.PI, e: 0 }[side];
  g.save(); g.translate(x, y); g.rotate(a);
  g.beginPath(); g.moveTo(s, 0); g.lineTo(-s * 0.6, -s * 0.7); g.lineTo(-s * 0.6, s * 0.7); g.closePath(); g.fill(); g.restore();
}

function edgeLabel(g, side, kind, X, Z, inner, sx, sz) {
  const text = { river: 'RIVER', railyard: 'RAIL YARD', highway: 'HIGHWAY', warehouses: 'WAREHOUSES' }[kind];
  g.save();
  g.font = '700 11px system-ui, sans-serif'; g.fillStyle = 'rgba(42,36,48,0.55)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (side === 'n') g.translate(X(sx * 0.18), Z(inner.z0 / 2));
  if (side === 's') g.translate(X(sx * 0.18), Z((inner.z1 + sz) / 2));
  if (side === 'w') { g.translate(X(inner.x0 / 2), Z(sz * 0.2)); g.rotate(-Math.PI / 2); }
  if (side === 'e') { g.translate(X((inner.x1 + sx) / 2 + 5), Z(sz * 0.2)); g.rotate(Math.PI / 2); }
  g.fillText(text.split('').join(' '), 0, 0);
  g.restore();
}

function north(g, x, y) {
  g.save(); g.translate(x, y);
  g.beginPath(); g.moveTo(0, -16); g.lineTo(7, 8); g.lineTo(0, 3); g.lineTo(-7, 8); g.closePath();
  g.fillStyle = '#2a2430'; g.fill();
  g.font = '700 12px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('N', 0, 22);
  g.restore();
}

function legend(g, x, y) {
  const items = [['Commercial', '#f7d7a6'], ['Residential', '#c9e4a9'], ['Industrial', '#d9d2c6'], ['Civic', '#d7c8f0'], ['Park', '#8fd27a'], ['Landmark', '#f6e58d']];
  g.font = '600 11px system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
  let cx = x;
  for (const [t, c] of items) { g.fillStyle = c; g.fillRect(cx, y - 6, 14, 12); g.strokeStyle = '#8a8490'; g.strokeRect(cx, y - 6, 14, 12); g.fillStyle = '#4a4450'; g.fillText(t, cx + 19, y); cx += g.measureText(t).width + 38; }
  for (const [t, c, dash] of [['Neutral', OWNER_COLORS.neutral, true], ['Gang 1', OWNER_COLORS.gang0], ['Gang 2', OWNER_COLORS.gang1]]) {
    g.setLineDash(dash ? [4, 3] : []); g.strokeStyle = c; g.lineWidth = 3; g.strokeRect(cx, y - 6, 14, 12); g.setLineDash([]);
    g.fillStyle = '#4a4450'; g.fillText(t, cx + 19, y); cx += g.measureText(t).width + 38;
  }
}
