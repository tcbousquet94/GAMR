// Scriptable headless driver for playtesting steps.
// Usage: node tools/drive.mjs <url> <outDir> <steps.json>
// steps: [{key:'KeyW', down:true}, {wait: 1.5}, {shot:'name'}, {eval:'js expr'}, {log:'js expr'}]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [url, outDir, stepsPath] = process.argv.slice(2);
const steps = JSON.parse(fs.readFileSync(stepsPath, 'utf8'));
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(url);
await page.waitForTimeout(2500);

// Wait for `sec` of GAME time (headless WebGL renders slowly).
const advance = (sec) => page.evaluate((sec) => new Promise((res) => {
  const g = window.game, start = performance.now();
  let acc = 0, last = performance.now();
  const tick = () => {
    const now = performance.now();
    acc += Math.min((now - last) / 1000, 1 / 20); last = now;
    if (acc >= sec || now - start > 120000) res(); else requestAnimationFrame(tick);
  };
  tick();
}), sec);

for (const s of steps) {
  if (s.key) await page.evaluate(([code, down]) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code })), [s.key, s.down !== false]);
  if (s.tap) { for (const d of [true, false]) { await page.evaluate(([code, down]) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code })), [s.tap, d]); await advance(0.05); } }
  if (s.wait) await advance(s.wait);
  if (s.eval) await page.evaluate(s.eval);
  if (s.log) console.log(s.label ?? 'log', JSON.stringify(await page.evaluate(s.log)));
  if (s.shot) await page.screenshot({ path: `${outDir}/${s.shot}.png` });
}
console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
await browser.close();
