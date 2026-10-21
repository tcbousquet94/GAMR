// The handcrafted maps (baked from a seed, then edited by hand). Loaded lazily: each base is a few MB of data.
export const MAPS = {
  palmetto: { title: 'Palmetto Bay', seed: '396873', load: () => Promise.all([import('./palmetto/base.js'), import('./palmetto/edits.js')]) },
};
export const DEFAULT_MAP = 'palmetto';
