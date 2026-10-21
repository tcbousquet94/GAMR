// Bake a generated city into a fixed, hand-editable map:  node tools/bakemap.mjs <seed> <name> [district=town]
// Writes src/maps/<name>/base.js (the generator's full output for that seed, as data: render kit, physics boxes,
// layout, blocks, businesses, warehouses, territories, kit-look streets and modules). Hand edits live separately in
// src/maps/<name>/edits.js and are applied on load, so a re-bake never wipes them.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { generateTurf } from '../src/city/turf/generate.js';
import { DOWNTOWN } from '../src/city/turf/districts/downtown.js';
import { TOWN } from '../src/city/turf/districts/town.js';
const DISTRICTS = { downtown: DOWNTOWN, town: TOWN };

const [seed, name, dist = 'town'] = process.argv.slice(2);
if (!seed || !name) { console.error('usage: node tools/bakemap.mjs <seed> <name>'); process.exit(1); }
const c = generateTurf(DISTRICTS[dist], seed);
const { world, district, sideOpen, ...rest } = c;
const { rng, pal, module, pendingFE, ...kit } = c.kit;
const data = { format: 1, seed: String(seed), district: district.id, bakedAt: new Date().toISOString().slice(0, 10), city: { ...rest, kit, layout: { ...c.layout, cellAt: undefined } } };
const round = (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v);
const json = JSON.stringify(data, round);
const dir = new URL(`../src/maps/${name}/`, import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}base.js`, `// Baked from seed ${seed} by tools/bakemap.mjs. Regenerate with: node tools/bakemap.mjs ${seed} ${name}\n// Do not hand-edit this file; put changes in edits.js.\nexport default ${json};\n`);
if (!existsSync(`${dir}edits.js`)) writeFileSync(`${dir}edits.js`, `// Hand edits for the "${name}" map, applied on top of base.js when it loads.\nexport default function edits(city) {\n  return city;\n}\n`);
console.log(`baked seed ${seed} -> src/maps/${name}/base.js (${(json.length / 1024 / 1024).toFixed(2)} MB)`);
