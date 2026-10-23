// node examples/demo.mjs [seed]  -> an ASCII map of the city and its stats.
import { generateCity, checkPlan, sidewalkSpots } from '../src/index.js';
import { TOWN_ASSETS } from './catalogue.js';

const plan = generateCity({ catalogue: TOWN_ASSETS }, process.argv[2] || 'demo');
const S = 6, W = Math.ceil(plan.size.x / S), H = Math.ceil(plan.size.z / S);
const grid = Array.from({ length: H }, () => Array(W).fill(' '));
const fill = (r, ch) => { for (let z = Math.floor(r.z0 / S); z < Math.ceil(r.z1 / S); z++) for (let x = Math.floor(r.x0 / S); x < Math.ceil(r.x1 / S); x++) if (grid[z]?.[x] != null) grid[z][x] = ch; };
const CH = { house: 'h', porchHouse: 'p', walkup: 'w', shop: 's', cornerMarket: 'M', parking: '=', pocketPark: '*', workshop: 'k', yard: 'Y', midrise: 'm', tower: 'T' };
for (const s of plan.streets) fill(s.rect, s.kind === 'avenue' ? '#' : s.kind === 'local' ? '.' : ':');
for (const b of plan.blocks) if (b.zone === 'park') fill(b.rect, '"');
for (const a of plan.alleys) fill(a.rect, '-');
for (const l of plan.lots) fill(l.rect, CH[l.asset] || '?');
for (const m of plan.landmarks) fill(m.rect, 'H');
console.log(grid.map((r) => r.join('')).join('\n'));
const c = checkPlan(plan);
console.log('\n# avenue  : street  . local  " park  - alley  H town hall');
console.log(JSON.stringify(c.stats, null, 1), '\nproblems:', c.problems.length, '\nstreet-light spots:', sidewalkSpots(plan, { spacing: 30 }).length);
