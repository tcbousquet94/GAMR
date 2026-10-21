// Packs the Vite build into one self-contained HTML page (CSS + JS inline) for publishing as a playable artifact.
// Usage: ARTIFACT=1 npx vite build && node tools/artifact.mjs [out.html]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const out = process.argv[2] || 'dist/broke-artifact.html';
const assets = readdirSync('dist/assets');
const css = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.css'))}`, 'utf8');
const js = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.js'))}`, 'utf8').replace(/<\/script/gi, '<\\/script')
  // Escape non-ASCII so glyphs (✚, arrows) survive whatever charset the host assumes.
  .replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const html = `<meta charset="utf-8">
<title>BROKE</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&display=swap">
<style>:root { color-scheme: dark; } html, body { height: 100%; background: #120f1c; }
${css}</style>
<canvas id="game"></canvas>
<div id="fx-layer"></div>
<div id="hud"></div>
<div id="touch"></div>
<div id="screens"></div>
<div id="perf"></div>
<script type="module">${js}</script>
`;
writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + ' KB');
