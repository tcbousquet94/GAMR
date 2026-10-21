// Phones and low-memory devices get the "lite" path: half-resolution textures, medium quality, shorter draw distance.
// Override with ?lite=1 / ?lite=0.
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lite') : null;
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const lowMem = typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory <= 4;
export const LITE = q != null ? q === '1' : !!(coarse || lowMem);
