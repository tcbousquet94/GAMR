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
<div id="boot" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:#eee;font:600 20px Georgia,serif;text-align:center;padding:16px;pointer-events:none;z-index:50">Loading Palmetto Bay&hellip;<small style="font-weight:400;font-size:14px;opacity:.7">building the town can take a few seconds</small></div>
<script>
// Boot notice + visible error report (so a failed load says why instead of showing a blank page).
(() => { const boot = document.getElementById('boot'); let shown = false;
  const show = (msg) => { if (shown || /pointer ?lock|user gesture/i.test(String(msg))) return; shown = true; boot.style.pointerEvents = 'auto'; boot.style.background = '#1b1020';
    boot.innerHTML = '<b>Something broke while loading.</b><pre style="white-space:pre-wrap;max-width:90vw;font:13px monospace;color:#f9c">' + String(msg).replace(/[<&]/g, (c) => c === '<' ? '&lt;' : '&amp;').slice(0, 1500) + '</pre><small>Send me a screenshot of this.</small>'; };
  addEventListener('error', (e) => show((e.error && e.error.stack) || e.message));
  addEventListener('unhandledrejection', (e) => show((e.reason && e.reason.stack) || e.reason));
  const c = document.getElementById('game');
  c.addEventListener('webglcontextlost', () => show('WebGL context lost (the GPU ran out of memory or reset).'));
  const t = setInterval(() => { if (shown) return clearInterval(t); if (window.__broke && window.__broke.view && window.__broke.view.composer) { boot.remove(); clearInterval(t); } }, 300);
})();
</script>
<script type="module">${js}</script>
`;
writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + ' KB');
