// The whole town (for the superhero / town-management game): the same generator as Downtown on a much bigger grid,
// a downtown core in the middle (towers, the landmark) ringed by neighbourhoods of modules, parks and civic sites.
import { DOWNTOWN } from './downtown.js';

export const TOWN = {
  ...DOWNTOWN,
  id: 'town',
  name: 'Palmetto Bay',
  personality: 'A whole town: a small downtown of towers and brick walk-ups, then blocks of bungalows, corner stores, alleys and yards out to the river and the rail yards.',
  roads: { ...DOWNTOWN.roads, cols: 9, rows: 9, blockTarget: [44, 56] },
  zoning: { parks: [3, 5], civic: [2, 3] },
  warehouses: [8, 10],
  businessMix: { bodega: 6, pawn: 4, laundromat: 2.5, boxing: 1.5, auto: 2.5, clinic: 2, diner: 1.5 },
};
