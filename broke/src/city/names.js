// Original, generated names for storefronts, signs and graffiti. Syllables are mixed so names never match a
// real brand on purpose.

const A = ['zo', 'ka', 'lu', 'vex', 'mi', 'ro', 'ta', 'pi', 'no', 'bri', 'sol', 'fen', 'ja', 'dex', 'umi', 'oro',
  'kel', 'vay', 'tro', 'sa', 'bo', 'qui', 'ne', 'lo', 'mar', 'gri', 'ya', 'cor', 'ze', 'pel'];
const B = ['ra', 'lo', 'no', 'ki', 'zi', 'ta', 'mo', 'ly', 'xa', 'vo', 'na', 'do', 'ri', 'be', 'su', 'ko'];
const SHOPS = ['CAFE', 'DELI', 'TACOS', 'PHO', 'ARCADE', 'LAUNDRY', 'NAILS', 'PHARMACY', 'DINER', 'BODEGA', 'RAMEN',
  'BAGELS', 'GYM', 'KARAOKE', 'LOUNGE', 'PIZZA', 'NOODLES', 'DUMPLINGS', 'VIDEO', 'BOOKS', 'BURGERS', 'JUICE'];
const GRAFFITI = ['BROKE', 'RENT 2 HIGH', 'NO CABS', 'LATE AGAIN', 'OVERDRAFT', 'MIND THE GAP', 'EXACT CHANGE',
  'TIP 0%', 'SURGE', '2 MIN AWAY', 'ON MY WAY', 'BUS BUNCHING', 'K.O.', 'NIGHT SHIFT'];

const cap = (s) => s.toUpperCase();

export function brandName(rng) {
  const n = rng.int(1, 2);
  let s = rng.pick(A);
  for (let i = 0; i < n; i++) s += rng.pick(B);
  return cap(s);
}
export function shopName(rng) { return `${brandName(rng)} ${rng.pick(SHOPS)}`; }
export function garageName(rng) { return `${brandName(rng)} PARKING`; }
export function towerName(rng) { return `${brandName(rng)} ${rng.pick(['TOWER', 'PLAZA', 'CENTER', 'ONE', 'CAPITAL'])}`; }
export function truckName(rng) { return `${brandName(rng)} ${rng.pick(['TACOS', 'PHO', 'WINGS', 'CURRY', 'BAO', 'CREPES', 'BBQ'])}`; }
export function graffitiText(rng) { return rng.chance(0.5) ? rng.pick(GRAFFITI) : brandName(rng); }
export function stationName(rng) { return `${brandName(rng)} ST STATION`; }
