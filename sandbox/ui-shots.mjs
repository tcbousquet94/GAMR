// Multi-shot HUD capture: node sandbox/ui-shots.mjs <outDir> [script.js] [w] [h]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [out, scriptPath, w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('console', (m) => { if (m.type() !== 'debug') console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(process.env.URL || 'http://localhost:5173/sandbox/ui.html');
await page.waitForTimeout(1500);
if (scriptPath) await page.evaluate(fs.readFileSync(scriptPath, 'utf8'));
for (const [i, t] of [[1, 400], [2, 900], [3, 1500]]) {
  await page.waitForTimeout(t);
  await page.screenshot({ path: `${out}/s${i}.png` });
}
await browser.close();
