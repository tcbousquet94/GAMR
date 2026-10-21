// Crime-empire tuning: what each business earns and costs, what it can be upgraded with, the player's perk trees,
// the level curves and the random events. Plain data, no logic (see empire.js).

// One in-game day lasts DAY_SECONDS of real time; the books are settled at SETTLE_HOUR every morning.
export const DAY_SECONDS = 480;
export const START_HOUR = 9;
export const SETTLE_HOUR = 6;

// Per business type, per day: base revenue, rent, a manager's wage and the share of revenue spent on stock.
// `takeover` is the price of a buyout (neutral shops only), `traffic` how much downtown foot traffic matters.
export const BIZ = {
  diner: { label: 'Diner', revenue: 1000, rent: 300, wage: 200, stock: 0.38, takeover: 6000, traffic: 1 },
  bodega: { label: 'Bodega', revenue: 900, rent: 240, wage: 170, stock: 0.35, takeover: 4500, traffic: 1.2 },
  pawn: { label: 'Pawn Shop', revenue: 1100, rent: 300, wage: 200, stock: 0.3, takeover: 5500, traffic: 0.8 },
  laundromat: { label: 'Laundromat', revenue: 700, rent: 220, wage: 140, stock: 0.15, takeover: 3500, traffic: 0.9 },
  boxing: { label: 'Boxing Gym', revenue: 800, rent: 280, wage: 190, stock: 0.1, takeover: 4500, traffic: 0.7 },
  auto: { label: 'Auto Shop', revenue: 1300, rent: 380, wage: 250, stock: 0.3, takeover: 7000, traffic: 0.6 },
  clinic: { label: 'Clinic', revenue: 1500, rent: 450, wage: 320, stock: 0.25, takeover: 8500, traffic: 0.8 },
};

// Upgrades. `for` limits one to some types (else any). Effects are read by empire.js:
//   rev (revenue multiplier), cust (customers), raidLoss / raidChance (multipliers), decay (condition decay),
//   heat (per day), shadyMul, night (extra revenue share), upkeep ($/day).
export const UPGRADES = {
  cameras: { name: 'Security Cameras', cost: 800, desc: 'Robberies and raids take half as much.', fx: { raidLoss: 0.5, robbery: 0.5 }, upkeep: 20 },
  door: { name: 'Steel Door', cost: 1200, desc: 'Rivals are a third less likely to hit this place.', fx: { raidChance: 0.67 } },
  neon: { name: 'Neon Sign', cost: 600, desc: '12% more customers.', fx: { cust: 1.12 }, upkeep: 15 },
  reno: { name: 'Renovation', cost: 1500, desc: '15% more revenue, wears out half as fast.', fx: { rev: 1.15, decay: 0.5 } },
  lotto: { name: 'Lotto Machine', cost: 1000, desc: '20% more revenue.', for: ['bodega'], fx: { rev: 1.2 } },
  latenight: { name: 'Late-Night Menu', cost: 1100, desc: 'Open past midnight: 25% more revenue.', for: ['diner'], fx: { rev: 1.25 }, upkeep: 40 },
  fence: { name: 'Fence Network', cost: 1400, desc: 'The back room moves twice as much.', for: ['pawn'], fx: { shadyMul: 2 } },
  coin: { name: 'Coin-Op Bank', cost: 900, desc: 'Cleaner books: 4 less heat a day.', for: ['laundromat'], fx: { heat: -4 } },
  ring: { name: 'Fight Nights', cost: 1300, desc: '30% more revenue.', for: ['boxing'], fx: { rev: 1.3 }, upkeep: 30 },
  lift: { name: 'Second Lift', cost: 1600, desc: '25% more revenue.', for: ['auto'], fx: { rev: 1.25 } },
  pharmacy: { name: 'Pharmacy Counter', cost: 2000, desc: '25% more revenue.', for: ['clinic'], fx: { rev: 1.25 }, upkeep: 40 },
};

// The back room: unlocked at player level SHADY_LEVEL. Extra untaxed income, but every day it runs adds heat.
export const SHADY = { level: 4, cost: 1500, share: 0.6, heat: 7 };
export const SHADY_NAME = {
  diner: 'Card Game', bodega: 'Numbers Racket', pawn: 'Fencing', laundromat: 'Money Laundering', boxing: 'Fixed Fights', auto: 'Chop Shop', clinic: 'Pill Mill',
};

// Business levels: XP from profit; each level adds an upgrade slot and 12% revenue. Level 5 adds a signature perk.
export const BIZ_XP = [0, 400, 1200, 3000, 6500];
export const SIGNATURE = {
  diner: 'Back Booth: heals you while you are inside.',
  bodega: 'Corner Network: every business in this neighbourhood gets 8% more customers.',
  pawn: 'Under the Counter: refills your ammo when you visit.',
  laundromat: 'Spin Cycle: 5 less heat a day for the whole empire.',
  boxing: 'Muscle: sends two fighters to defend any of your businesses in a raid.',
  auto: 'Plates Swapped: police raids cost half.',
  clinic: 'Patch-Up: fully heals you when you visit.',
};

// Player levels: XP to reach level L+1 from L.
export const xpToNext = (L) => Math.round(220 * L ** 1.45);
export const XP = { thug: 15, gunman: 25, enforcer: 45, takeover: 150, defended: 90, robberyStopped: 60, profitDiv: 25 };

// Business cap: how many you can run at once. Level unlocks, plus the Boss tree.
export const bizCap = (level, empireRank) => 2 + Math.floor(level / 2) + empireRank;
export const UNLOCKS = [
  { level: 2, text: 'Buyouts: pay a neutral owner to sell instead of muscling in.' },
  { level: 3, text: 'Managers can be hired anywhere.' },
  { level: 4, text: 'Back rooms: run a shady side business for extra cash (and heat).' },
  { level: 6, text: 'Rival warehouses can be taken: hit their yard, clear it, crack the safe.' },
  { level: 8, text: 'The rival HQ: take their diner and the city is yours.' },
];
export const BUYOUT_LEVEL = 2, WAREHOUSE_LEVEL = 6, HQ_LEVEL = 8;

// Perk trees. Each perk has ranks; one point per rank.
export const PERKS = {
  street: {
    label: 'Street', desc: 'Fighting and staying alive.',
    perks: {
      tough: { name: 'Tough', ranks: 3, desc: '+25 health per rank.' },
      steady: { name: 'Steady Hands', ranks: 3, desc: '+15% gun damage per rank.' },
      reload: { name: 'Quick Reload', ranks: 2, desc: 'Reload 25% faster per rank.' },
      mags: { name: 'Extended Mags', ranks: 2, desc: '+5 rounds per magazine per rank.' },
      deadeye: { name: 'Dead Eye', ranks: 2, desc: 'Dead Eye lasts 1.5 s longer per rank.' },
    },
  },
  hustle: {
    label: 'Hustle', desc: 'Money, deals and keeping it quiet.',
    perks: {
      haggle: { name: 'Haggler', ranks: 3, desc: 'Upgrades and buyouts 10% cheaper per rank.' },
      tongue: { name: 'Silver Tongue', ranks: 3, desc: '+5% revenue everywhere per rank.' },
      hands: { name: 'Fast Hands', ranks: 2, desc: 'Take over registers 30% faster per rank.' },
      books: { name: 'Cooked Books', ranks: 2, desc: '25% less heat per rank.' },
    },
  },
  boss: {
    label: 'Boss', desc: 'Running an empire.',
    perks: {
      empire: { name: 'Empire', ranks: 3, desc: 'Run one more business per rank.' },
      loyal: { name: 'Loyal Staff', ranks: 2, desc: 'Managers cost 20% less per rank.' },
      respect: { name: 'Respect', ranks: 2, desc: 'Rivals raid you 20% less per rank.' },
      bodyguard: { name: 'Bodyguard', ranks: 2, desc: 'One less attacker per raid per rank.' },
    },
  },
};

// Daily events per owned business (chance per business per day). Effects are applied in empire.js.
export const EVENTS = [
  { id: 'robbery', p: 0.07, title: 'Robbed', text: (b) => `Someone emptied the register at ${b}.` },
  { id: 'inspector', p: 0.05, title: 'Inspector', text: (b) => `A city inspector came through ${b}.` },
  { id: 'breakdown', p: 0.06, title: 'Breakdown', text: (b) => `Equipment broke down at ${b}.` },
  { id: 'review', p: 0.05, title: 'Word got round', text: (b) => `People are talking about ${b}. Customers are up.` },
  { id: 'powercut', p: 0.04, title: 'Power cut', text: (b) => `${b} lost power for the day.` },
];

// Heat: police attention, 0..100. Decays daily; above POLICE_HEAT a police raid can hit a shady business.
export const HEAT = { decay: 6, police: 55, policeChance: 0.35, fineShare: 0.15 };

// Rival gang: raids on your businesses at night. Chance per day grows with how big you are.
export const RIVAL = { raidBase: 0.3, raidPerBiz: 0.06, raidMax: 0.8, warn: 45, window: 150, attackers: [3, 5], grabNeutral: 0.35 };
