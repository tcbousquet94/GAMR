// Runs every verification step in order and prints one summary table. Fast checks first so failures show early.
//   node tests/run-all.mjs [--quick]   (--quick: node-mode bot, 10-seed fps sweep, no screenshots)

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const quick = process.argv.includes('--quick');
const steps = [
  ['unit tests', ['node', '--test', ...readdirSync(new URL('./unit/', import.meta.url)).filter((f) => f.endsWith('.test.js')).map((f) => `tests/unit/${f}`)]],
  ['100-seed city', ['node', 'tests/city/city100.mjs']],
  ['bot (sim)', ['node', 'tests/browser/bot.mjs', '--node']],
  ...(quick ? [] : [['bot (browser)', ['node', 'tests/browser/bot.mjs', '--seeds', '1']]]),
  ['render sweep', ['node', 'tests/browser/cityfps.mjs', quick ? '10' : '100']],
  ...(quick ? [] : [['screenshots', ['node', 'tests/browser/screenshots.mjs']], ['frame strips', ['node', 'tests/browser/strips.mjs']]]),
];

const results = [];
for (const [name, cmd] of steps) {
  const t = Date.now();
  process.stdout.write(`> ${name} ... `);
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  const ok = r.status === 0;
  const secs = ((Date.now() - t) / 1000).toFixed(0);
  console.log(`${ok ? 'ok' : 'FAIL'} (${secs}s)`);
  if (!ok) console.log((r.stdout + r.stderr).split('\n').slice(-25).join('\n'));
  results.push({ name, ok, secs });
}
console.log('\n' + results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(16)} ${r.secs}s`).join('\n'));
console.log('Reports: reports/city100.json, reports/bot.json, reports/cityfps.json; images: shots/');
process.exit(results.every((r) => r.ok) ? 0 : 1);
