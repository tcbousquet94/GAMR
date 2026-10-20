// End-to-end smoke test: drives the real game headlessly, captures screenshots and console errors.
// Usage: node tools/playtest.mjs [url] [outDir]   (defaults to the battle-mode wave arena)
import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://localhost:5173/?mode=battle';
const outDir = process.argv[3] || '.';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png` });
const state = () => page.evaluate(() => {
  const g = window.game;
  return {
    t: +g.time.elapsed.toFixed(1),
    player: { hp: g.player.hp, mp: Math.round(g.player.mp), goods: g.player.goods, mom: Math.ceil(g.player.momCooldown),
      pos: g.player.object3d.position.toArray().map((v) => +v.toFixed(1)), embarrassed: g.player.status.has('embarrassed') },
    party: g.party.map((m) => `${m.name}:${m.hp}/${m.maxHp}${m.alive ? '' : '(KO)'}`),
    enemies: g.enemies.list.map((e) => `${e.name}:${e.hp}`),
    target: g.target?.name ?? null,
    calls: g.renderer.info.render.calls,
  };
});
// Advance real time until `sec` of game time passes (headless WebGL is slow).
const advance = (sec) => page.evaluate((sec) => new Promise((res) => {
  const start = window.game.time.elapsed;
  const tick = () => (window.game.time.elapsed - start >= sec ? res() : requestAnimationFrame(tick));
  tick();
}), sec);
const key = (code, down = true) => page.evaluate(([code, down]) =>
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true })), [code, down]);
const tap = async (code) => { await key(code); await advance(0.05); await key(code, false); };

await page.goto(url);
await page.waitForTimeout(2500);
await shot('01-title');

await tap('KeyX'); // any key starts
await advance(1.5);
await shot('02-start');

// Walk north into the courtyard toward enemies
await key('KeyW');
await advance(2.5);
await key('KeyW', false);
await advance(0.5);
console.log('after walk', JSON.stringify(await state()));
await shot('03-walk');

// Lock on and fight
await tap('Tab');
await advance(0.3);
console.log('locked', JSON.stringify(await state()));
for (let i = 0; i < 18; i++) {
  await page.evaluate(() => window.game.input.press('attack'));
  await advance(0.12);
  await page.evaluate(() => window.game.input.down.delete('attack'));
  await advance(0.12);
  if (i === 5) await shot('04-combo');
}
console.log('after combo', JSON.stringify(await state()));

await tap('Digit2'); // PSI
await advance(0.6);
await shot('05-psi');
await tap('Digit3'); // Goods
await advance(0.8);
await tap('Digit4'); // Call Mom
await advance(1.5);
await shot('06-mom');
console.log('after commands', JSON.stringify(await state()));

// Force Embarrassed to verify the status presentation
await page.evaluate(() => window.game.combat.applyStatus(window.game.player, 'embarrassed', 6));
await advance(0.6);
await shot('07-embarrassed');
console.log('embarrassed', JSON.stringify(await state()));

// Let the fight play out for a while with the AI party
for (let i = 0; i < 30; i++) {
  await page.evaluate(() => window.game.input.press('attack'));
  await advance(0.15);
  await page.evaluate(() => window.game.input.down.delete('attack'));
  await advance(0.15);
}
await shot('08-brawl');
console.log('final', JSON.stringify(await state()));
console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
await browser.close();
