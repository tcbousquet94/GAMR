# BROKE — Design Document

This file is the source of truth. It contains the full original build prompt (Part 1), every later direction (Part 2), reference notes (Part 3) and a log of decisions and changes (Part 4). Reread before each phase.

---

# PART 1 — ORIGINAL BUILD PROMPT (verbatim)

## BROKE — Build Prompt for Claude Code

Build **BROKE**, a third-person roguelike shooter in the spirit of Risk of Rain 2, set across a procedurally generated city. Work autonomously within each phase without asking me questions. STOP at the end of each phase, report, and wait for my feedback before starting the next one.

---

## HOW TO WORK

- Stack: Three.js + Vite, plain JavaScript ES modules. Add another library only if it helps you verify your own work. Keep files small and single-purpose (player, camera, enemies, director, items, economy, city generator, districts, audio, UI, etc.).
- Create DESIGN.md containing everything in this prompt. Reread it before each phase. Record every decision and change there.
- Commit all tests into the repo so they can be rerun.
- Use sub-agents in parallel for audits: one hunting gameplay bugs, one reviewing visuals and readability.
- Build in small steps, run the tests after each one, and never claim something works without verifying it.

---

## PHASE 0: VERIFICATION HARNESS (build first)

1. A headless browser bot that can move, sprint, jump, climb, shoot, use abilities, buy items, and reach the exit. It reports results as numbers.
2. Screenshot capture that you review yourself for color, composition, readability, and clutter, compared against the reference images.
3. A frame-time and draw-call counter.
4. Headless tests for movement, collision, damage, and item stacking.
5. A city test that generates 100 seeds and checks reachability, traversal time, interactable counts, and fps for each.

Do not start Phase 1 until the harness runs.

---

## REFERENCES

Reference images are in /references. Study them before Phase 1 and describe in DESIGN.md what you take from each (palette, lighting, layout, proportions). During screenshot reviews, compare your output against them and list the differences you're fixing. Use them for mood and style only; don't copy any image directly.

- **characters.jpeg** shows the three survivors. Match each character's colors, silhouette, outfit, and the faceted low-poly style. Simplify faces to a few readable shapes. Slightly exaggerate signature features (Marco's gloves, Paulie's hook and hat, Dee's bun) so each survivor reads clearly from behind at gameplay distance.
- **downtown.jpeg** sets Downtown's lighting, palette, and composition: blue-violet sky with a warm horizon, orange streetlights, glass towers with lit windows, neon only on signs, and the parking garage, food trucks, and fire escapes as set pieces. Match its mood, not its detail level: build everything in the faceted low-poly style of characters.jpeg. Ignore the figure in the foreground; it is not a survivor. Keep environment accents to purple, magenta, cyan neon, and warm orange so the survivors' teal, red, and yellow always stand out. Add more street-level cover and clutter than this image shows.
- **enemies.jpeg** shows Speakerphone Guy, Scooter Bro, and the Canvasser. Match their poses, silhouettes, props, and exaggerated expressions in the faceted low-poly style. Simplify faces but keep the big expressions. Recolor all enemies to muted tones (olive, gray, brown, dusty colors): no saturated teal, red, or yellow, which belong to the survivors, and no purple, which blends into Downtown's lighting. Reserve one bright warning color (white flash) for enemy attack telegraphs.
- **boss.jpeg** shows the HOA President. Match her outfit, props (giant clipboard, gavel, glasses on a chain), orbiting violation notices, parking-enforcement drones, muted palette, and furious expression in the faceted low-poly style. IGNORE the scale in the image: she is about 3x a survivor's height (~5.5m), so a survivor comes up to just above her knee. The drones are about 1m across. She stands on the street, not on rocks. Use the notice text as attack names and barks, e.g. "Section 7.1: Lawn Height!"

---

## THE GAME

### Concept
Three broke working people have to cross the city to catch the last train home, because none of them can afford a cab or a rideshare. The enemies are the everyday people who make city life unbearable, presented like epic action-game villains. Each stage is a different district. Difficulty rises over time. Scrape together loose change, find the transit stop, call your ride, survive the boss wave until it arrives, and move on to the next district.

### Tone
Satire played completely straight. Enemies get dramatic intro titles, slow-motion entrances, and music stings. Short text-bubble barks during combat. The survivors are grounded and sincere; the world around them is absurd.

- Title screen tagline: "Last train's in 10 minutes. You have $3.40."
- Death screen: "YOU MISSED THE TRAIN. A rideshare home costs $87. You have $[current change]."
- Win screen: "YOU MADE THE TRAIN," followed by run stats formatted like a sad little receipt (change earned, change spent, items bought, enemies defeated, time).

### Feel
- Fast, fluid movement: sprint, double jump, and climbing on fire escapes, dumpsters, scaffolding, and rooftops.
- Every hit flashes, knocks enemies back, and shows a damage number.
- Every enemy attack has a clear wind-up before it lands.
- Constant pressure: loot or run for the exit.

### Difficulty clock
A visible label escalates over time: Light Traffic → Rush Hour → Gridlock → Total Gridlock → Jury Duty. Each tier spawns more and tougher enemies, and item prices rise. Time of day also advances with the clock: golden hour at the start, dusk at Rush Hour, full night by Gridlock, with streetlights and windows switching on.

---

## THE CITY (procedural, modular, scalable)

- Scale: characters are ~1.8m tall.
- The map is a grid of city blocks. Stage size is a config value (Downtown = 3x3 blocks to start).
- Size target: sprinting from spawn to the far edge takes 60–90 seconds. The bot measures this; adjust block size until it hits the target.
- Modules: hand-designed set pieces with planned climbing routes and cover, assembled by rules so layouts differ every run but every space is fun to fight in.
- Three height levels everywhere: street (0m), mid-level (6–10m: fire escapes, awnings, garage decks, walkways), and rooftop (15–25m). Every level connects to the others in multiple places.
- Seeds: every city comes from a seed, shown on the pause screen, replayable.
- Placement rules: spawn and exit on opposite sides; the exit is always reachable; at least two routes between any two modules; interactables and enemy spawn points placed by density per block, so bigger maps never feel empty.
- Signs, storefronts, and graffiti use original, generated names only.

### Districts
Each stage is a district defined as a config: layout rules (block size, street width, grid density), a module kit, verticality, palette and lighting, an enemy table, and an exit type. The generator reads the config, so new districts can be added without changing the generator.

Planned route: Downtown (subway) → Old Neighborhood (trolley) → Waterfront (ferry) → Suburbs (commuter rail) → Mall (final stage).

---

## DOWNTOWN (the first district)

Dense grid, narrow streets, very vertical. Glass, steel, and concrete with warm streetlight and neon signs.

### Module kit
1. **FINANCIAL PLAZA:** open square with a fountain, planters, benches, and a sculpture for cover. Surrounded by tower bases. Good for big fights.
2. **PARKING GARAGE:** four decks connected by spiral ramps, with parked cars as cover and an open roof level. A natural climbing route to the rooftops.
3. **TOWER BASE:** glass lobby with revolving doors, a mezzanine, and an exterior skybridge on the mid-level linking to a neighboring building.
4. **CONSTRUCTION SITE:** scaffolding, stacked I-beams, a tower crane you can climb, plywood walls, and a dug-out foundation pit. Lots of vertical paths.
5. **FOOD TRUCK ALLEY:** a narrow street of food trucks, string lights, picnic tables, and dumpsters. Tight and chaotic; a good place for vending machines.
6. **ELEVATED WALKWAY:** an above-street pedestrian bridge network connecting two or three modules on the mid-level.
7. **SUBWAY ENTRANCE (exit):** a sunken plaza with stairs down to a lit station entrance and a call panel. The surrounding area must be open enough for the boss fight, with cover and high ground.

Street furniture everywhere: parked cars, traffic lights, hydrants, newspaper boxes, bus shelters, bike racks, trash cans, steam grates.

---

## SURVIVORS

Each has 4 abilities (primary, secondary, utility, special) and a passive, modeled on Risk of Rain 2 kits. Show a lore card on the character select screen. Each survivor owns one accent color.

### DEE OKAFOR — ER night-shift nurse (accent: teal)
Huntress-style: fast, fragile, ranged. Twelve years in the ER, calm in any crisis, loves salsa dancing.
- **Primary, Syringe Darts:** homing shots, usable while sprinting.
- **Secondary, Rounds:** a thrown clipboard that ricochets between up to 6 enemies, gaining damage per bounce.
- **Utility, Salsa Step:** a short spinning teleport-dodge.
- **Special, Code Blue:** leaps up and rains syringes on a target area, slowing enemies.
- **Passive, Night Shift:** stronger as difficulty rises.

### MARCO REYES — retired boxer (accent: red)
Loader-style: melee bruiser. A '90s middleweight contender who lost his one title shot in the 11th round. Now in his fifties, he runs a free boxing gym under a laundromat. Tonight one of his kids has their first amateur fight, and he promised to be in the corner.
- **Passive, Old Guard:** landing punches grants a temporary barrier.
- **Primary, Combination:** jab, jab, cross; the third hit knocks back.
- **Secondary, Clinch:** lunges and pulls an enemy in (not bosses).
- **Utility, Haymaker:** charged lunging punch; damage scales with movement speed.
- **Special, Championship Rounds:** a bell rings; for 10 seconds, faster punches and no knockback.

### PAULIE MEDEIROS — Gloucester lobsterman (accent: yellow)
Engineer-style: traps and turret. Third-generation lobsterman restoring his grandfather's boat. He came into the city to deliver lobsters to his cousin's restaurant; if he misses the train, he misses the 4 a.m. haul.
- **Passive, Sea Legs:** can't be slowed or knocked down.
- **Primary, Flare Gun:** shots that set enemies burning.
- **Secondary, Lobster Traps:** drop traps that snap shut and hold enemies in place.
- **Utility, Gaff Hook:** grapple onto rooftops, fire escapes, and light poles.
- **Special, Live Tank:** drop a cooler of furious lobsters that pinch everything nearby (turret).

---

## ENEMIES

Each has a distinct silhouette, muted colors so survivors always read clearly, and a visible white-flash telegraph before attacking. They spawn off-screen from alleys, revolving doors, subway grates, and rooftop doors, never inside geometry. Enemies drop loose change.

1. **SPEAKERPHONE GUY, "He's Never Hung Up."** Keeps his distance and blasts knockback sound-wave cones. Shooting his phone stuns him.
2. **SCOOTER BRO, "Rider of the Sidewalk."** Rings a bell, then charges in a straight line. If dodged, he crashes and is stunned.
3. **THE CANVASSER, "Got a Minute?"** Latches on and slows you while others close in. Dash to break free.

### Boss: THE HOA PRESIDENT, "Supreme Enforcer of the Bylaws."
About 3x survivor height. Fires homing violation notices (named attacks like "Section 4.2: Exterior Paint!"), summons parking-enforcement drones, and has a gavel slam. Full dramatic intro and a health bar.

---

## ECONOMY AND SHOPS

- Currency is loose change, dropped by enemies. Show it in the HUD as dollars and cents.
- Vending machines and newspaper boxes sell Common items (cheap).
- Delivery lockers sell Uncommon items (pricier).
- ATMs sell Legendary items (expensive, with a "withdrawal fee").
- The boss drops one Boss item when defeated.
- Equipment comes from lost-and-found bins; you hold one at a time.
- Scratch-off tickets are a rare drop. Spend them at a Pawn Shop for Sketchy items.
- Thrift Store: trade in one item for a random item of the same tier.
- All prices scale up with the difficulty clock.

---

## ITEMS

Items stack. Show them in a HUD row with counts. Each item has a simple procedural icon in its tier color.

### Common (white)
- **Oat Milk Latte:** move 14% faster.
- **Extra Shot of Espresso:** attack 15% faster.
- **Noise-Cancelling Headphones:** 15% chance to block a hit completely (stacks with diminishing returns).
- **Grand Opening Coupon:** +75% damage to enemies above 90% health.
- **Free Sample:** kills drop a snack that heals you.
- **Band-Aids:** shortly after taking damage, heal a small amount.
- **Hot Sauce Packets:** 10% chance on hit to set enemies burning.
- **Unused Gym Membership:** +25 max health.
- **Coin Jar:** enemies drop extra loose change.

### Uncommon (green)
- **Unlimited Data Plan:** 20% chance on hit to fire chain lightning at up to 3 enemies.
- **Group Text:** 10% chance on hit to launch a homing text-bubble missile.
- **Reply All:** enemies explode when killed, damaging everything nearby.
- **Bike Courier Bag:** +1 extra jump.
- **Overtime:** each kill gives a short damage boost that stacks.
- **Comfy Insoles:** after 5 seconds without getting hit, move 30% faster.
- **Leftover Pizza:** heal steadily while standing still.

### Legendary (red)
- **Jackhammer:** every attack explodes in a small radius.
- **Lucky Penny:** every chance-based effect rolls twice.
- **Road Rage:** kills launch three homing car horns that blast nearby enemies.
- **Spare Key:** if you die, get back up at full health once. Consumed on use.

### Boss (yellow)
- **Gavel of Authority:** every fifth hit slams the ground, stunning nearby enemies.
- **Violation Notice:** hits have a chance to cite an enemy, making it take 30% more damage for 5 seconds.

### Sketchy (blue) — every upside has a downside
- **Credit Card:** everything you buy is free, but each purchase lowers your max health until the stage ends.
- **Payday Loan:** get a huge pile of change now, but enemies drop half as much for the rest of the run.
- **Energy Drink:** move and attack 50% faster, but healing is cut in half.
- **Burner Phone:** crits deal triple damage, but enemies always know where you are.

### Equipment (orange) — one active slot with a cooldown
- **Airhorn:** a cone blast that knocks back and stuns.
- **Car Alarm Fob:** sets off nearby car alarms, pulling enemies toward the cars.
- **Shopping Cart:** ride it for 5 seconds, plowing through enemies.
- **Leaf Blower:** a continuous cone that pushes and damages enemies.

### Synergies that must work
Test these combinations explicitly:
- Hot Sauce Packets + Reply All: burning enemies explode into more burning enemies.
- Lucky Penny + any chance item: lightning, missiles, and burns trigger far more often.
- Leftover Pizza + Paulie: he heals while holding ground near his traps and turret.
- Comfy Insoles + Dee: dodging hits makes her even faster.

Cap or scale every stacking effect so no combination produces broken values.

---

## EXIT EVENT

Interact with the transit call panel to call your ride. A 60–90 second countdown starts, the boss spawns with its intro, and enemy spawns intensify. Survive until arrival, then board to finish the stage.

---

## ART AND AUDIO

- Faceted low-poly style with strong lighting, fog, and bloom. Follow the reference images and each district's palette.
- One clean UI font, no outlined text, minimal HUD. Nothing on screen without a reason.
- All models, textures, effects, music, and sound generated in code (Web Audio). No external asset files.
- Audio: city ambience (traffic, distant sirens, steam), a music track that intensifies with each difficulty tier, and a punchy sound for every hit, ability, pickup, purchase, and enemy bark.
- All names and designs original; nothing from Risk of Rain or any other game.

---

## PERFORMANCE

- 60 fps on a mid-range laptop with 50+ enemies.
- Instance repeated city geometry, cull what the camera can't see, use simpler distant buildings, limit shadow updates, auto-select quality at startup, and drop resolution under load.

---

## EDGE CASES TO HUNT EVERY PHASE

- Knockback pushing the player out of the map or into unreachable spots
- Enemies spawning inside buildings or stuck in geometry
- Boss or wave state carrying over after death/retry
- Invulnerability or dodge exploits
- Exit unreachable on any generated seed
- Item stacks producing broken values (NaN, infinite speed, etc.)
- Shops selling items the player can't afford or that fail to deliver
- Frame rate collapse at high difficulty

---

## PHASES

- **PHASE 1:** Downtown with **DEE ONLY**. One complete loop: spawn → explore, earn change, and buy items → find the subway → call the train → survive the boss until it arrives → win receipt screen → restart. Death shows the missed-train screen. Include all Common and Uncommon items, the Boss items, and two pieces of Equipment (Airhorn, Shopping Cart). Then STOP.
- **PHASE 2:** Apply my feedback. Add Marco, Paulie, and a character select screen with lore cards. Add Legendary items, ATMs, and the remaining Equipment. Then STOP.
- **PHASE 3:** Add the Old Neighborhood as stage 2, with the trolley exit. Add scratch-off tickets, the Pawn Shop, Sketchy items, and the Thrift Store. Then STOP.
- **LATER PHASES:** Add one district per phase in route order, then a final polish pass on visuals, audio, and game feel.

---

## END OF EACH PHASE

Report what you built, what the bot and tests found, what you fixed, screenshots compared against the references, and current fps. Then give me a short checklist of things only a human can judge (control feel, sound, whether the comedy lands) for me to playtest.

---

# PART 2 — LATER DIRECTIONS (verbatim, in order)

## 2.1 Art direction (target-look-1.png)

```
target-look-1.png is a phone screenshot of Arkenfall.
Ignore the browser bar and the on-screen controls.
Take these qualities and translate them to a city:
- Strong aerial perspective: distant towers fade
  into warm blue-violet haze, so the city has depth.
- Low warm sun and a soft pastel sky with layered
  clouds and a glow at the horizon.
- High density of small detail everywhere, the way
  this scene's ground is covered in grass and
  flowers: litter, puddles with reflections, leaves,
  steam from grates, lit windows, flickering signs,
  string lights. Use instancing so it stays fast.
- Soft shadows that ground every object.
- Smooth, organic forms; no boxes for characters.
- Constant subtle motion: cloth on survivors (Dee's
  scrubs, Marco's hoodie strings, Paulie's oilskins),
  flags, awnings, laundry lines, drifting steam.
- Warm, cohesive, slightly desaturated grading.
- UI in this style: translucent round buttons, a thin
  compass bar, and an elegant serif font for text.
```

## 2.2 Animation target

```
ANIMATION TARGET: the weight, flow, and naturalism of
Uncharted, adapted to our stylized characters.
Without motion capture, achieve it procedurally:

- MOMENTUM: characters accelerate and decelerate over
  a few steps. Turns arc with a planted foot and body
  lean. Sharp reversals play a quick pivot. Sprint
  stops slide slightly.
- INVERSE KINEMATICS: feet plant correctly on stairs,
  slopes, and curbs. Hands reach and touch walls when
  running close to them. Hands grab ledges, railings,
  and fire escapes when climbing.
- LOOK-AT: heads and eyes track nearby enemies and
  points of interest.
- CONTEXTUAL MOVES: vault over low cover, duck under
  low obstacles, stumble on landing from big drops,
  brace against walls when stopping next to them.
- PHYSICAL HIT REACTIONS: a partial ragdoll layered on
  the animation, so hits push the body in the hit's
  direction and every reaction looks different. Full
  ragdoll on death.
- SEAMLESS TRANSITIONS: no visible snapping between
  any states. Every transition blends, and no pose
  pops.
- IDLE LIFE: breathing, weight shifts, small fidgets
  specific to each survivor (Dee checks her watch,
  Marco rolls his shoulders, Paulie adjusts his hat).

Record frame strips of running past walls, turning
sharply, vaulting, and getting hit from different
directions, and fix anything stiff or snapping.
```

## 2.3 Layout reference (towns.webp)

```
towns.webp shows 2D overhead town maps from
EarthBound. Use it ONLY for layout and district
identity: how landmarks, roads, edges, zones, and
points of interest are arranged. It is NOT a visual
reference. Do not use its pixel art, colors,
top-down view, or flat style for the game itself;
the 3D look comes from the Arkenfall screenshots.
DONT COPY
```

---

# PART 3 — REFERENCE NOTES

Images live in `references/`.

- **downtown.jpeg / characters.jpeg / enemies.jpeg / boss.jpeg** (original refs): character silhouettes, palette
  (dusky pinks, teal scrubs, warm brick), comedic enemy archetypes, the HOA President's scale (~3x a person).
- **target-look-1.png** (Arkenfall phone screenshot, supersedes the original "faceted low-poly" look): aerial
  perspective (warm blue-violet haze), low warm sun, pastel layered-cloud sky with horizon glow, dense small
  detail via instancing, soft grounding shadows, smooth organic characters, constant subtle motion, warm
  slightly desaturated grade, translucent round buttons + thin compass + serif type. Browser bar and on-screen
  controls in the screenshot are ignored.
- **towns.webp** (EarthBound town maps): LAYOUT AND DISTRICT IDENTITY ONLY — how landmarks, roads, edges, zones
  and points of interest are arranged. Nothing visual is taken from it (no pixel art, colours, top-down view or
  flat style), and no specific map is copied. Principles taken:
  1. Each town has a **spine** (one main road) that the eye follows from arrival.
  2. A **landmark** visible from far away anchors orientation mid-route.
  3. **Hard edges** (rail, water, cliffs, highway) frame the town and say "the map ends here".
  4. **Services cluster** on the main road; edges are quieter.
  5. The **exit** sits at an edge, slightly hidden, reached by following signs.

### District layout identities (Downtown built; others planned for later phases)

| District | Spine | Landmark | Edges | Zones / POIs |
|---|---|---|---|---|
| Downtown | East–west avenue with a planted median, spawn on it | "First National Debt" spire, 150–170 m, centre block | E: elevated rail viaduct (trains), W: highway overpass (traffic); N/S: tall facades | Shops denser along the avenue (×1.45), quieter edge lots (×0.75); subway station off-avenue on the east edge; SUBWAY signs at every corner |
| Old Neighborhood | Winding hillside street with switchbacks | Church/water tower on the hilltop | Retaining walls, a ravine | Stoops, corner stores, rooftop gardens |
| Waterfront | Coastal boardwalk strip | Lighthouse / crane gantry | The water itself, a freight rail line | Fish market, piers, container yard |
| Suburbs | Arterial road feeding cul-de-sacs | Big-box store sign on a pylon | Sound walls, a drainage canal | Cul-de-sac pods, strip mall, HOA clubhouse |
| Mall | Ring road around the mall | The mall atrium dome | Parking-structure ring, freeway ramps | Anchor stores, food court, loading docks |

---

# PART 4 — DECISIONS AND CHANGES (log)

Every decision that interprets or changes the spec is recorded here, newest last within each section.

## Architecture
- **Sim/view split.** `src/sim` + `src/city` are pure JS with no DOM/WebGL; they run in Node for tests and bots.
  The sim runs at a fixed 60 Hz (`SIM_HZ`); the view interpolates and reacts to sim events (`src/core/events.js`).
- **Physics** is custom AABB (spatial hash, axis-separated sweeps, step-up 0.6 m, air mantle 2.1 m, ladder climb
  volumes with a wall direction). No physics library: everything in the city is axis-aligned boxes.
- **City** = district config + seed → `Kit` (boxes, quads, signs, props, colliders, climbs, spawns, slots,
  lights). 3×3 blocks, 2×2 lots per block with an alley cross, 7 lot modules (tower, plaza, garage,
  construction, food trucks, walkway, subway). Fire escapes are built after all modules, with clip checks.
- **Navigation** for bots and enemies: `NavGraph` (1 m cells, multi-level, WALK/JUMP/DROP/CLIMB/GAP edges, A*)
  and a 2 m `FlowField` for enemy swarms.

## Tuning (see `src/core/config.js`)
- Walk 7.2 m/s, sprint ×1.45 (10.4 m/s), jump 1.75 m, double jump 3.3 m, climb 7.5 m/s, max 7 jumps,
  move-speed multipliers capped at ×3.5, knockback capped at 26 m/s, block chance capped at 75%, proc chains
  stop at depth 3, attack speed capped at ×4.
- Difficulty clock tiers: Light Traffic 0, Rush Hour 2.5, Gridlock 5.5, Total Gridlock 9, Jury Duty 13 min.
- Economy: start $3.40; common $1.25, uncommon $3.00, legendary $12.00, equipment $2.00, all × difficulty
  coefficient. Train countdown 75 s (spec 60–90), boss arrives 2.5 s after calling.
- Downtown blockSize 190 m: bot spawn→exit 69–88 s over 100 seeds (target 60–90 s).

## Art direction
- **Changed (user direction, target-look-1):** smooth organic characters (capsules, lathes, rounded boxes)
  instead of faceted low-poly; the city keeps simple massing but gets per-vertex AO, height fog/aerial
  perspective (`render/post.js`), procedural layered-cloud sky, PMREM environment, PCF soft shadows, bloom,
  warm desaturated grade, and an instanced detail layer (litter, leaves, weeds, puddles, posters, manholes,
  contact shadows, laundry, banners, awning fringes) with a wind vertex shader; flickering neon; steam.
- **Changed (user direction):** UI uses Cormorant Garamond (serif) instead of "one clean UI font", with frosted
  translucent round ability buttons and a thin compass strip. Touch controls: thumbstick + drag-look + round
  buttons.
- Cloth springs on Dee's scrubs (Marco's hoodie strings and Paulie's oilskins are specified for when they ship).

## Animation (user direction: Uncharted-like weight, procedural)
- Momentum lives in the sim (accel 24, decel 30, pivot decel 55, turn rate 13 rad/s falling with speed, skid
  friction 3.2) so the bot and players feel the same thing the animation shows. Sim emits pivot/skid/land/vault/
  duck events.
- `render/anim/animator.js`: critically damped springs on every joint, gait phase from distance travelled,
  2-bone leg IK with ankle alignment on stairs/slopes/curbs, pelvis drop, lean/bank from acceleration, look-at
  with eyes, wall touch and brace, vault/crouch/land/skid/pivot layers that blend (no snaps), layered hit springs
  (push in hit direction with random twist + stagger step), idle breathing/weight shift/fidgets
  (Dee: watch; Marco: shoulder roll; Paulie: hat). Death = verlet ragdoll (`render/anim/ragdoll.js`).
- Frame strips (`tests/browser/strips.mjs`): wall run, sharp turn, reversal, skid stop, vault, stairs, hits from
  4 directions, idle, death.

## Layout pass (towns.webp principles, Downtown)
- Avenue spine on a random interior east–west street; spawn on it at the west end; landmark block in the centre;
  exit lot in the east column, off the avenue (farthest of the two candidates).
- Avenue: no lane dashes, planted median with trees every 14 m and double streetlights every 28 m, no parked cars
  on avenue edges, denser street clutter.
- Wayfinding: "SUBWAY" arrow signs on poles at every intersection corner.
- Edges: east rail viaduct (deck 10.5 m) with a 5-car train every 38 s; west highway overpass (deck 8.5 m) with
  26 looping vehicles. Both sit outside the invisible boundary walls (decoration only); facades pushed back 16 m.

## Verification harness
- `npm test` — unit tests (physics, combat, items/stacking, economy).
- `npm run test:city` — 100 seeds: generation errors, exit reachability, every shop reachable, walkable reach,
  bridges/single-entry lots, vertical links, bot traversal time → `reports/city100.json`.
- `npm run test:bot` — scenario bot in the real game (`--node` for the bare sim): movement, climb, combat,
  shopping, traverse, full run (god mode: a loop check, not balance) → `reports/bot.json`.
- `npm run test:fps` — 100-seed render sweep: fps, p95, draw calls, triangles at four viewpoints →
  `reports/cityfps.json`. Budget: ≤450 draw calls, ≤2.5M triangles. Headless SwiftShader fps is CPU raster and
  not representative of real GPUs.
- `npm run test:shots` — screenshots for review against the references → `shots/`.
- `npm run test:all` — everything in order (`--quick` for a fast pass).

## Bugs found and fixed by the harness (selection)
- Nav DROP edges through ceilings; climb edges across walls; GAP edges through thin walls; stair-riser cells.
- Ladders grabbed when walking past (climb volumes now carry a wall direction; grab only when pushing in).
- Fire escapes clipping neighbours → deferred build with clip checks; roofs without access lose shops/spawns.
- Cart crawled forever from idle friction; shopping cart / pizza tests hit parked cars.
- Shops placed at ladder feet blocked the climb; construction frame shop on an unreachable deck.
- Mid-ladder "landings" linked to neighbouring roofs 2 m sideways (bot stalled at a ladder top).
- Debug `pose()` left the animator frozen mid-fall in screenshots.

## Phase 1 audits (two parallel sub-agents) and what changed
Gameplay audit, each finding reproduced with a script before fixing; regression tests in
`tests/unit/audit.test.js`:
- Elevated spots were nearly damage-free: melee enemies parked underneath forever (the stuck check used horizontal
  distance only). Now enemies below the player head for a ladder that reaches them and climb it; the stuck
  check counts vertical progress and the "parked below" case; relocation prefers the player's own surface.
  Damage taken at y=8/16 went from 0 to ~150 per 3 min (street: ~95).
- Relocation could silently delete the boss (spawn-point sampling missed in map corners). The boss is never
  deleted; the fallback does a full scan; the receipt's "boss defeated" comes from the actual kill.
- Knockback cap now applies to the resulting velocity (a 3-wave volley stacked to 51 m/s).
- Speakerphone soundwaves passed through walls; they now stop on world geometry.
- Leftover Pizza radius capped at 8 m, Gavel of Authority at 16 m (was 31 m / 204 m at 20 / 100 stacks).
  Coupon, missile, explosion and coin multipliers stay uncapped and linear (RoR2-style, never NaN).
- No shopping while on a ladder.
- Checked fine: no crashes or NaN in 10 seeds × 240 s of random input; Jury Duty sim cost ~0.2–0.5 ms/step
  with ≤69 enemies; 100× every item stays finite with caps holding; knockback/Salsa never leave the map;
  no state carries between runs; every shop delivers and never oversells.

Visual/readability audit:
- Ground telegraphs while enemies wind up (`render/telegraphs.js`): scooter charge lane, speakerphone cone,
  canvasser lunge, HOA slam ring (16 m — jump it).
- Each enemy gets a colour identity: Speakerphone Guy red shirt / charcoal vest, Scooter Bro electric-blue hoodie,
  Canvasser high-vis yellow jacket.
- Contact shadows under all characters; streetlights and traffic lights cast shadows.
- Compass marker stays inside the visible bar and shows a turn arrow at the edge; labels clear of the centre
  tick; a soft dim band and stronger text shadow behind HUD text; info banners without a key pill; phone layout.
- Stars only at real night; daytime lamp bulbs dimmed (no daylight bloom blobs).
- Tower crowns no longer tilted (stepped caps / penthouse bands); smoother trees and wheels; Dee's bun smaller
  and set back.
- World-space wear on ground (oil stains, patches, cracks, grain) and wall bases (grime, rain streaks); more litter
  in the roadway and more puddles.
- SUBWAY signs: transit green, 1.5× larger, roundel + big arrow; a lit SUBWAY pylon at the station.
- Viaduct moved 2 m further out (a streetlight clipped its deck); overhead barks stack instead of overlapping.
- Hit reactions now stagger the hips and legs; idle weight shift is larger; the first fidget comes sooner.

## Playtest feedback round 1 (user)
- "Feet too fast when walking": gait cadence lowered from ~4.8 to ~2.8 steps/s at run speed (cycle freq
  0.7 + 0.1·speed Hz, two steps per cycle), stride cap raised 0.44 → 0.56 m so the feet don't skate.
- "Turns should have more weight": turnRate 13 → 9 rad/s with stronger speed falloff (≈3.7 rad/s at a run,
  ≈2.9 at a sprint), hard carves bleed up to 30% speed, pivots now trigger past 115° (was 132°). Animation banks
  harder into turns and the hips swing out. Bot traversal still 71–81 s.
- "Not aiming all the time; hands relaxed; crosshair only when shooting; like GTA": an aim-stance timer
  (`player.aimT`) is set while firing primary/secondary/special and relaxes 1 s after the last shot (user: 1.4 → 1.0 s). Only then
  does Dee face the camera direction, raise her throwing arm, show the dart in her hand, and show the crosshair
  (fades in/out). Otherwise she runs facing her travel direction with loose arms and no weapon in hand.
- "A little recoil when Dee shoots": each dart kicks her throwing arm and shoulder back through the hit-reaction
  springs (varied per shot, joints not stiffened) and rocks the torso; Rounds kicks harder. The camera view
  kicks up ~0.6° per dart on a spring and settles; aim (player.pitch) is not changed, so recoil never costs accuracy.
- "Shoulders and waist look disconnected; the body should turn with the shoulders like Red Dead" (researched:
  Rockstar GDC 2020 "Filling Marston's Boots" on RDR2 locomotion; Epic Lyra's root-yaw-offset / turn-in-place
  and aim offsets distributed down the spine; gait studies showing pelvis and thorax rotate in phase at walking
  speed and counter-rotate only when faster). Changes in `render/anim/animator.js`:
  - Twist chain: any upper-body turn toward the view or a target is shared pelvis 30% / chest 40% / head 30%
    (thighs counter-rotate so planted feet don't spin).
  - Turn in place: standing, the chain absorbs camera turns up to ~60°; beyond that the feet step round
    (shuffle steps driven by the turn rate) until the body is square to the view again.
  - Gait: pelvis and chest turn together at a walk, counter-rotate only at a run (much smaller than before).
  - Lean from the feet: 65% of the turn bank and 40% of the acceleration lean tilt the whole body about the
    feet (root roll/pitch in `rootMatrix`), the spine adds the rest — no more side-bending at the waist.
  - Frame strip `lookaround` added (standing while the camera sweeps 115° and back).
