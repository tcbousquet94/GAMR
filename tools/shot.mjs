// Headless screenshot + console capture for testing.
// Usage: node tools/shot.mjs <url> <out.png> [waitMs] [script.js]
// The optional script runs in the page after load. It may be async and may use `window.game`.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [url, out, waitMs = '2500', scriptPath] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => console.log(`[${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url);
await page.waitForTimeout(Number(waitMs));
if (scriptPath) {
  const res = await page.evaluate(fs.readFileSync(scriptPath, 'utf8'));
  if (res !== undefined) console.log('[script result]', typeof res === 'string' ? res : JSON.stringify(res));
}
await page.screenshot({ path: out });
await browser.close();
