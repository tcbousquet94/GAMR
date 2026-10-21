// Dev check: generate the "h" neighbourhood data and report counts and timing.
const t0 = performance.now();
const { hoodCity } = await import('../../src/city/kitdata/hood.js');
const c = hoodCity();
const D = c.kitData;
console.log('ms', Math.round(performance.now() - t0), Object.fromEntries(Object.entries(D).map(([k, v]) => [k, v.length])), c.layout.cells.map((q) => q.placed + ':' + q.front).join(' '), 'spawn', c.spawn);
