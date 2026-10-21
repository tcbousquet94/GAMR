// Shared helpers for browser tests: start vite, launch headless Chromium (SwiftShader WebGL), open the game.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export async function startServer(port = 5199) {
  const proc = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('vite did not start')), 30000);
    proc.stdout.on('data', (d) => { if (/Local:/.test(String(d))) { clearTimeout(to); res(); } });
    proc.on('exit', (c) => rej(new Error(`vite exited ${c}`)));
  });
  return { url: `http://localhost:${port}/`, stop: () => proc.kill() };
}

export async function openGame(url, query, { width = 1280, height = 720, mobile = false } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${url}?${query}`);
  await page.waitForFunction(() => window.__broke && window.__broke.game, null, { timeout: 60000 });
  return { browser, page, errors };
}
