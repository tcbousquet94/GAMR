// The whole town (for the superhero / town-management game): the same generator as Downtown on a much bigger grid,
// a downtown core in the middle (towers, the landmark) ringed by neighbourhoods of modules, parks and civic sites.
import { DOWNTOWN } from './downtown.js';

export const TOWN = {
  ...DOWNTOWN,
  id: 'town',
  name: 'Palmetto Bay',
  personality: 'A whole town: a small downtown of towers and brick walk-ups, then blocks of bungalows, corner stores, alleys and yards out to the river and the rail yards.',
  // One main street (avenue) each way through the middle of town; the rest streets and residential streets.
  roads: { ...DOWNTOWN.roads, cols: 9, rows: 9, blockTarget: [44, 56], hierarchy: { ...DOWNTOWN.roads.hierarchy, avenueEvery: 99, localBeyond: 0.45 } },
  zoning: { parks: [3, 5], civic: [2, 3] },
  warehouses: [8, 10],
  clutter: { treeSpacing: 28, shrubs: 0.3, cars: 0.45, bins: 0.35, props: ['dumpster', 'hoop', 'bench', 'phone', 'wheelstop', 'bollard', 'ice', 'container'], propShare: 0.3, oldProps: { bench: 0.4, crate: 0.35, planter: 0.5 } }, businessMix: { bodega: 6, pawn: 4, laundromat: 2.5, boxing: 1.5, auto: 2.5, clinic: 2, diner: 1.5 },
};
