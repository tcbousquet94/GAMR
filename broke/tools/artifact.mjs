// Packs the Vite build into one self-contained HTML page (CSS + JS inline) for publishing as a playable artifact.
// Usage: npx vite build && node tools/artifact.mjs [out.html]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const out = process.argv[2] || 'dist/broke-artifact.html';
const assets = readdirSync('dist/assets');
const css = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.css'))}`, 'utf8');
const js = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.js'))}`, 'utf8').replace(/<\/script/gi, '<\\/script');
const html = `<title>BROKE</title>
<style>:root { color-scheme: dark; } html, body { height: 100%; background: #120f1c; }
${css}</style>
<canvas id="game"></canvas>
<div id="fx-layer"></div>
<div id="hud"></div>
<div id="screens"></div>
<div id="perf"></div>
<script type="module">${js}</script>
`;
writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + ' KB');
