// Bundles the example viewer (with three.js) into one self-contained HTML file.
//   npm i -D three esbuild   (once)
//   node examples/build-viewer.mjs [out.html]
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url).pathname;
const out = process.argv[2] || `${here}viewer.bundle.html`;
const res = await build({ entryPoints: [`${here}viewer.js`], bundle: true, format: 'iife', minify: true, write: false });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync(`${here}viewer.html`, 'utf8').replace('<script type="module" src="./viewer.js"></script>', () => `<script>${js}</script>`);
writeFileSync(out, html);
console.log(`wrote ${out} (${Math.round(html.length / 1024)} KB)`);
