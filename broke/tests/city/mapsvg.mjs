// Top-down SVG of a generated city: lots coloured by module, building footprints shaded by height, ladders,
// shops, enemy spawn points, spawn/exit, and the bot's planned route. Usage: node tests/city/mapsvg.mjs [seed] [out]
import { writeFileSync } from 'node:fs';
import { generateCity } from '../../src/city/generator.js';
import { downtown } from '../../src/city/districts/downtown.js';
import { NavGraph } from '../../src/city/nav.js';
import { TAG } from '../../src/city/kit.js';

const seed = +(process.argv[2] || 1);
const out = process.argv[3] || `reports/map-seed${seed}.svg`;
const c = generateCity(downtown, seed);
const S = c.size;
const COL = { plaza: '#3d5a80', garage: '#6d597a', tower: '#355070', construction: '#8a6a3a', foodtrucks: '#7a3e65', walkway: '#2f6f73', subway: '#1f8a70' };
const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -40 ${S + 20} ${S + 120}" width="1100" style="background:#1b1a22;font-family:system-ui,sans-serif">`];
for (const l of c.lots) {
  const r = l.rect;
  parts.push(`<rect x="${r.x0}" y="${r.z0}" width="${r.x1 - r.x0}" height="${r.z1 - r.z0}" fill="${COL[l.type]}" opacity="0.55"/>`);
  parts.push(`<text x="${(r.x0 + r.x1) / 2}" y="${(r.z0 + r.z1) / 2}" fill="#fff" font-size="9" text-anchor="middle" opacity="0.85">${l.type}</text>`);
}
for (const b of c.kit.solids) {
  if (!(b.tag & TAG.BUILDING) || b.maxY < 3) continue;
  const h = Math.min(1, b.maxY / 40);
  parts.push(`<rect x="${b.minX}" y="${b.minZ}" width="${b.maxX - b.minX}" height="${b.maxZ - b.minZ}" fill="rgb(${40 + h * 140},${40 + h * 130},${60 + h * 150})" opacity="0.8"/>`);
}
for (const { box: b } of c.kit.climbs) parts.push(`<rect x="${b.minX}" y="${b.minZ}" width="${Math.max(1.2, b.maxX - b.minX)}" height="${Math.max(1.2, b.maxZ - b.minZ)}" fill="#ffd34a"/>`);
for (const s of c.spawnPoints) parts.push(`<circle cx="${s.x}" cy="${s.z}" r="0.9" fill="#ff6b6b" opacity="0.5"/>`);
const ic = { vending: '#e9e6e1', newsbox: '#bfbab0', locker: '#6fd36a', lostfound: '#ff9a3c', callpanel: '#33e0ff' };
for (const it of c.interactables) parts.push(`<rect x="${it.x - 2}" y="${it.z - 2}" width="4" height="4" fill="${ic[it.type]}" stroke="#000" stroke-width="0.5"/>`);
const nav = new NavGraph(c.world, S);
const a = nav.nearest(c.spawn.x, 0.2, c.spawn.z), e = c.exit.panel;
const p = nav.path(a, nav.nearest(e.x - 1.5, e.y, e.z));
if (p) parts.push(`<polyline points="${p.map((w) => `${w.x},${w.z}`).join(' ')}" fill="none" stroke="#33e0ff" stroke-width="2.2" stroke-dasharray="5 3"/>`);
parts.push(`<circle cx="${c.spawn.x}" cy="${c.spawn.z}" r="7" fill="#1fa89a" stroke="#fff"/><text x="${c.spawn.x + 10}" y="${c.spawn.z + 4}" fill="#fff" font-size="14">SPAWN</text>`);
parts.push(`<circle cx="${e.x}" cy="${e.z}" r="7" fill="#33e0ff" stroke="#fff"/><text x="${e.x - 12}" y="${e.z - 12}" fill="#fff" font-size="14" text-anchor="end">SUBWAY (exit)</text>`);
const leg = [['shop: vending/newsbox', '#e9e6e1'], ['delivery locker', '#6fd36a'], ['lost & found', '#ff9a3c'], ['ladder / fire escape', '#ffd34a'], ['enemy spawn point', '#ff6b6b'], ['bot route spawn→exit', '#33e0ff']];
leg.forEach(([t, col], i) => parts.push(`<rect x="${10 + i * 105}" y="${S + 30}" width="10" height="10" fill="${col}"/><text x="${24 + i * 105}" y="${S + 39}" fill="#ddd" font-size="10">${t}</text>`));
parts.push(`<text x="0" y="-20" fill="#fff" font-size="18">BROKE — Downtown, seed ${seed} — ${S.toFixed(0)} m across, ${c.lots.length} lots, ${c.interactables.length} shops, ${c.kit.climbs.length} ladders</text>`);
parts.push(`<text x="0" y="${S + 70}" fill="#aaa" font-size="11">Building shade = height (brighter is taller). Lots coloured by module type.</text></svg>`);
writeFileSync(out, parts.join('\n'));
console.log('wrote', out);
