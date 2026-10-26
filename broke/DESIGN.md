# BROKE — Design Document

This file is the source of truth. Reread it before each phase. The current game is the **turf war** (top). The
original roguelike design and its log are kept below under HISTORY: much of the tech carried over.

---

# THE GAME (current concept)

Two gangs fight for control of a procedurally generated city in real time. You play a gang leader in third person,
fighting alongside a small crew of named members with permadeath. Orders go through an in-game phone; pulling it
out slows time for tactical orders. Combat is deliberate and mostly melee; guns are rare.

**Bases are warehouses** (think Mount & Blade: warehouses are the castles, businesses are the villages). Every base
uses the same warehouse layout. Each warehouse controls 1–3 nearby businesses (bodega, boxing gym, auto shop, pawn
shop, laundromat, clinic); whoever holds the warehouse gets their income and functions. Businesses can't be captured,
only **raided**: a small fight that cuts the owning warehouse's income for a while and weakens its defenders'
supplies. A warehouse cut off from its businesses weakens over time (defender morale and supplies), so raiding the
surrounding businesses before a siege is a real strategy. Each gang's **HQ is its home warehouse**, with the diner
next door as its linked business (the memorial wall lives in the diner). Lose your HQ and you lose.

**Battle sizes:** RAID (4–6 per side) on a business's block; SIEGE (8–12 per side) on a warehouse, the main battle;
TURF WAR (larger) at a district landmark or a gang HQ, with several capture points.

The city map works both as a 3D world and as strategy data (the territory graph).

---

# PIVOT PLAN (roguelike -> turf war)

**Keep**
- Rendering pipeline: chunked city meshes, night blending, sign atlas, instanced props and detail layer, sky,
  atmosphere pass, shadows, post (art direction is being revised, see below).
- Character models and rigs; the procedural animation system (momentum, IK, look-at, contextual moves, hit springs,
  ragdolls, idle life, RDR-style twist chain); combat feel (GTA-style aim stance, recoil, crosshair).
- Physics (AABB world, climbing, mantling), the nav graph and flow field, the player controller.
- The test harness: unit tests, headless browser bot, screenshots, frame strips, render sweeps.
- City generation building blocks: Kit, building/fire-escape/roof modules, props, street furniture, towerOnPodium.

**Change**
- The map: a new deterministic turf generator (`src/city/turf/`) replaces the stage generator as the main map.
- The main loop: `TurfGame` (commands in, no director/clock/exit) replaces `Game` as the default.
- HUD: district + seed instead of money/clock; compass points to the landmark; block/territory objective line.
- Pause menu: town map, seed entry; debug tools (free-fly camera, overlay).

**Retire** (disconnected from the main game, left in place so nothing breaks; reachable with `?mode=classic`)
- Item shops and the roguelike item system, the difficulty clock, the subway exit event, the roguelike stage loop
  (director waves, boss timing, receipt/missed-train screens).

---

# ARCHITECTURE RULES (from the pivot on)

1. Game state lives separately from rendering (`src/sim`, `src/city` run in Node; the view only reads state/events).
2. Every game action is a **command** sent into the simulation (`src/sim/commands.js`): validated, sanitised, queued
   for a tick and logged. The local player's input is a `control` command too. The rival AI and a second human
   use the same commands, so lockstep multiplayer and replays need no rewrite. Reserved: move, attack, capture,
   recruit (rejected until their systems exist).
3. Map generation is fully deterministic from a seed (verified across 100 seeds: same seed, identical data).

---

# ART DIRECTION (current: remastered early-2000s open-world look, built as THE KIT)

Target: references/target-look.jpeg — a remastered early-2000s open-world crime game. Style only: no assets, names,
designs or locations copied. Bright neutral daylight with a clear sun and pale sky; light distance haze only; soft sun
shadows; ambient occlusion under eaves and in corners; filmic tone mapping; warm lights at night. No flat colours:
every surface has colour, roughness and normal detail plus procedural wear. Framed recessed windows, trim, eaves,
gutters, porches; raised kerbs (some painted red), verges, sidewalks, driveways, crosswalks; poles with sagging lines,
streetlights, palms and trees from leaf cards, parked cars, bins, idle people.
(Superseded v3 "PS2 smog" direction: warm smoggy haze, grading and vignette are gone.)

## The kit (everything that makes "h" look right, reusable everywhere)

Data (sim-safe, no Three.js) — `src/city/kitdata/`:
- `data.js`: the kit-data format (pads, ribbons, kerbs, paint, houses, apartments, stores, warehouses, sheds, fences,
  palms, trees, shrubs, pole lines, lights, cars, trucks, bins, hydrants, props, people, manholes; world metres, `y`
  = standing level, CURB = 0.15 lot level), the module frame (u across the front street, v deep), and colliders for
  everything (rotated buildings become a fill of small boxes so there are no invisible corners).
- `streets.js`: street dressing for any grid of cells: kerb at the road edge with corners rounded at the sidewalk
  radius, short red-painted no-parking runs and some red corners, kerbs dropped with paved aprons where a module's
  lane / alley / drive cuts through; grass verge + concrete walk (residential, industrial, parks) or full paving
  (commercial); crosswalks, stop bars and a double yellow centre line on open segments; manholes; palms in verges,
  street trees in commercial walks; utility poles along two sides of every block; corner streetlights; hydrants;
  parked cars on the road at the kerb.
- `modules.js`: the neighbourhood modules (below), `lotFill` (one house / walk-up / workshop on a frontage lot) and
  `houseRow` (a row of houses for edges).
- `hood.js`: module placement on cells (zone-weighted, facing the widest open side) and the "h" test neighbourhood.

Render — `src/render/kit/`:
- `textures.js`: in-house procedural PBR textures (colour, roughness, normal from a height field): asphalt with grain,
  patches and sealed cracks; concrete with slab joints and stains; red kerb paint; grass; dirt; lap siding; stucco;
  running-bond brick; three-tab shingles; corrugated metal; sectional garage door; painted trim; fence planks;
  chain-link; palm bark; bark; window interiors (blinds / curtains); palm frond and leaf-cluster cards; grass tufts;
  worn road paint; tar and gravel. (Poly Haven / ambientCG are blocked by this environment's network policy; the
  in-house set can be swapped for CC0 photo textures later without touching anything else.)
- `materials.js`: one MeshStandardMaterial per surface with world-metre tiling and vertex tint, plus shader wear
  (large-scale grime drift, damp at wall feet, drip streaks, blots, roughness variation) so repetition doesn't show.
- `batch.js`: geometry batching with world-space metre UVs projected per face (bricks and boards line up across
  pieces), merged to one mesh per surface (optionally per 160 m chunk).
- `houses.js`: houses (walls built around real openings: recessed framed windows with sashes, sills, casings, head
  trim; doors with panels; corner boards, floor bands, skirt boards; hip / side-gable / front-gable / flat roofs with
  eave overhang, fascia, soffit, rake boards, gutters, downspouts; porches with posts, railings, steps, shed roofs;
  chimneys; security bars and window AC units), extended to walk-ups (unit doors per floor), storefronts, warehouses
  (roll-up doors, high windows) and yard buildings.
- `buildings.js`: apartment walk-ups (walkway, railing, outside stair); stores of three kinds: market (storefront,
  awning, lettered sign board, posters), taco stand (barred windows, stone-look base, a ring of lettered boards on the
  roof edge), discount store (name, products and prices hand-painted on the street wall); high-rises (glazed podium,
  window-bay facade between protruding piers, optional setback, crown, penthouse, antennas; windows glow at night);
  mid-rise storefront blocks (shops below, flats above); tilt-up warehouses (painted band, wall lamps, bollards);
  garages / sheds / site offices. Style references: references/buildings-storefronts.webp, buildings-towers.webp
  (style only; names and designs are original).
- `ground.js`: pads (extruded polygons), ribbons, kerbs (2 m blocks, red where painted), paint, tuft spots.
- `vegetation.js`: palms (curved ringed trunks, folded frond cards, dead-frond skirt), broadleaf trees and shrubs
  (leaf cards, normals bent out of the crown), grass tufts.
- `street.js`, `props.js`: utility poles (crossarms, insulators, transformers, sagging catenary wires), cobra-head
  streetlights, sedans, box trucks, bins, hydrants, manholes, fences at any angle (chain-link, barbed, wood, block),
  dumpsters, ice machines, payphones, newspaper boxes, benches, bollards, wheel stops, hoops, laundry lines, pallets,
  containers.
- `classify.js`: the generator's plain boxes (downtown towers, business templates, warehouse bases, edges) drawn with
  kit materials, surface chosen from material, size, height and colour, hues pulled toward grey.
- `world.js`: builds a whole kit-data scene (plus classified boxes) into batched meshes.
- `kitView.js`: the lighting model: shader sky (pale blue zenith, bright hazy horizon, soft broken cloud, sun glow),
  sun from the south-east with 2048 PCF soft shadows following the camera's focus, hemisphere fill, image-based
  ambient from the sky (PMREM), FogExp2 light haze, GTAO screen-space AO (leaf cards hidden from its G-buffer), MSAA,
  ACES filmic, no grade or vignette; night: moonlight, warm lamp heads and windows, real point lights on the nearest
  streetlights. Quality tiers: high / medium / low (AO and MSAA off on low).

## Neighbourhood modules (all original layouts)
- **Crescent** (from "h", made original): a curving lane enters from the front street and bows out to a side street;
  houses on the outside of the bend face the lane radially, the two-storey porch house (brick ground floor, siding
  above) sits at the apex; inside the bend houses face the outer streets around a pocket green with a big tree and a
  bench; palms on the lane verge, poles and wires, two streetlights, a parked car, neighbours chatting.
- **Cul-de-sac**: a lane to a turning bulb with a kerbed, planted island and a palm; five houses fanned around the bulb
  with driveways converging on it; houses along the lane and on the outer streets.
- **Corner store**: a store on the corner with a striped parking lot and wheel stops, awning and sign, ice machine,
  payphone, newspaper boxes, bench, bollards, a dumpster behind; a walk-up next door; houses along the streets.
- **Backyard alley**: houses face the streets and back onto a concrete service alley with a centre drain; fences with
  gates, garages and sheds on the alley, laundry lines, bins, a basketball hoop, a car, poles and wires.
- **Warehouse block**: a tilt-up warehouse with roll-up doors and a site office in a cracked concrete yard behind
  chain-link with barbed wire and a gate; box trucks, a shipping container, pallet stacks, a dumpster, yard lights.

## "h" (the visual test scene)
`?scene=hero` (or H on the title / pause screen): a fixed 3 x 2 grid of blocks (corner store, crescent, warehouse;
alley, cul-de-sac, crescent) with a fringe of houses, built by exactly the same kit and pipeline as the generated city.
The player starts in the junction at the crescent's front-left corner, looking up its front street: the reference
camera. `tests/browser/heroshots.mjs` renders it (plus an aerial, one view per module and night);
`tests/browser/kitshots.mjs` renders generated seeds from the same camera angle next to it.

## The generated city in the kit look (default; `generateTurf(cfg, seed, { kit: false })` for the old look)
Free whole cells get a module by zone (residential: crescent / cul-de-sac / alley / corner store; commercial: corner
store / alley; industrial: warehouse block). Frontage left around businesses and warehouse bases outside the core is
filled by `lotFill` (houses, walk-ups, shops, workshops). The downtown core is built from kit high-rises and storefront
blocks; a ring of distant kit towers beyond the map edges replaces the old flat skyline.
Streets, kerbs, verges and furniture come from `streets.js`; the old ground visuals stay as colliders only. All
kit-data items add their own colliders.

---

# YOUR CHARACTER AND GUNPLAY (turf war)

The turf war is played as **your own character**, made in the creator on the title screen ("Edit character") from
the same Person spec every other human uses (body, skin, hair, facial hair, outfit, name; remembered in this browser).
Kit: `src/sim/survivors/custom.js`. Look storage and creator choices: `src/ui/look.js`; preview: `src/ui/creatorPreview.js`.

Gunplay is modelled on modern third-person shooters (RDR2): **hold right mouse to aim** (the camera pulls in over the
shoulder, field of view narrows, you walk and can't sprint, mouse slows down), **click per shot** (the hammer cocks
between shots, a click just early is buffered), **R reloads** a round at a time and firing cancels the reload.
The revolver is hitscan from the camera's shoulder pivot (what's under the reticle), checked from the muzzle so you
can't shoot through the corner you hide behind. Headshots x2.6, damage falls off from 25 m to 70 m, spread is tight
aimed and loose from the hip, on the move or in the air, and recoil climbs the aim then settles. All numbers: `GUNS`
and `CAM` in `src/core/config.js`; the gun: `src/sim/gun.js`.
- The sim and the view share one camera pose (`Player.camPose()`), so the reticle is always honest.
- Aim assist (`src/input/aimAssist.js`, toggle in the pause menu) snaps onto the nearest body in a small cone when you
  raise the gun and slows the look on a target. It only moves the input's view angles, so the sim stays a pure
  function of its commands. `control` commands carry `aim` and `reload`.
- HUD: dot reticle sized by spread (red on a target), hit markers (white body, gold head, red kill), the cylinder.
- **G** spawns practice hostiles in front of you (until battles exist).

# SAL'S DINER (the HQ diner as a real place)

Every diner (each gang HQ's front room, and any other diner) is a furnished, walk-in place built in `buildDiner`
(`src/city/turf/business.js`), seen from the street through clear glass (`shopGlass`) and open blinds. The look follows
the user's second reference image (style only; its "Liberty City" poster became "Palmetto Bay"):
- A long stainless counter with a red trim band and eight chrome-and-red stools down the corner side, with the register
  (the capture point: furnished interiors place their own and skip the template counter), a cake dome and condiments.
  Behind it a back bar (coffee machine, soda fountain, shake mixer), four black menu boards and an old TV on a shelf.
- Red leather booths with laminate tables down the alley side, two more at the front window; above them the
  **memorial wall** (framed photos, a candle shelf, "NEVER FORGOTTEN"; `biz.memorialWall`), a red neon OPEN and a
  city poster.
- The back wall in dark wood with a black-and-white checker tile band over a green wainscot (the band runs round the
  room), the big cream SAL'S DINER shield sign (the business name in red, DINER in navy, a red star), framed notices,
  a glass exit door under a red EXIT sign, and the kitchen pass and doorway.
- Worn black-and-cream checkerboard floor; a dark drop-tile ceiling with square light panels and a ceiling fan; dim,
  warm light (interior lights carry `power` and `tint`; they get no additive ground pool, which tinted floors orange).
- Behind the back wall the kitchen (grill line under a hood, fryers, range, prep table, fridge, dish sink, shelving)
  with a clear path from the doorway and the exit to the back door.
- People (`biz.patrons`, drawn by the kit view with seated / counter / cook poses): Sal behind the counter, a cook, a
  waitress, four regulars in booths and two at the counter.
The diner uses its own random stream so furnishing it never changes the rest of the city. Re-bake Palmetto Bay after
changing it: `node tools/bakemap.mjs 396873 palmetto`.

# WALK-IN CORNER MARKETS (bodegas)

Every kit `market` store (LUCKY 7 MARKET, CORNER KING, EZ STOP...) is a walk-in bodega after the user's reference image
(style only; the reference's cigarette brand became "CIGARETTES / FILTER KINGS", its "NYC" poster "PALMETTO 2002").
One layout in `src/city/kitdata/bodega.js` drives the colliders (hollow walls with the front doorway, floor, roof and
fixtures in `kitColliders`), the renderer (`bodegaInterior` in `src/render/kit/buildings.js`; the house builder's
`walkIn` option gives clear shop glass and an open doorway) and the clerk and room light the generator adds
(no rng, so the rest of the city is unchanged). Inside: worn checker floor, grimy cream walls, a low dark ceiling with
pipes and fluorescent tubes; glass-door coolers under "COLD BEER & SODAS" on the left with PLAY LOTTO, an ATM and
"ATM HERE" by the door; the counter across the back (register, scratch tickets, tip jar) with the clerk, shelves of
cigarettes and sundries and the green BODEGA "THANK YOU, COME AGAIN!" sign behind; bottle shelves on the right under
CIGARETTES and ENERGIA signs; a chip rack, milk crates and boxes, a back door ("NO LOITERING"), mop, stool, trash can
and a mat. Taco stands and discount stores stay closed for now.

# WALK-IN CAFES

Any generic-building storefront whose generated name ends in CAFE (e.g. LUMO CAFE) is a walk-in cafe after the
user's reference image (style only). `modules/building.js` draws each storefront's random values in the original order
before building, records cafe rooms, then replaces the building's single solid with an upper block from the room
ceiling up plus ground-floor blocks around the rooms (`carveRooms`), so the rest of the city is unchanged.
`modules/cafe.js` furnishes the room with its own random stream: polished concrete, warm concrete walls and a dark
olive back wall with the cafe's name and a palm, floor-to-ceiling glass with a door, a column with a plant and a "GOOD
COFFEE / BETTER DAYS" sign, a wood-fronted counter with a stone top, register and pastry case, the espresso bar and a
chalk menu board, a rust banquette with tables, wood tables and chairs by the window, black pendant lights, a sunset
print, a barista and two customers (`kit.interiorPeople`, added to the kit-data people).

# THE MAYOR GAME (part 1: neighbourhoods, budget, shops)

Palmetto Bay (town mode: the title screen's "Be the mayor of Palmetto Bay", or ?mode=town) is played as the mayor,
your own created character. `sim/mayor/mayor.js` (pure, deterministic, its own random stream) reads the city in:
neighbourhoods (the map's hoods) with households (houses, walk-up flats, flats over storefront blocks), gang turf
share and core share; every business (the turf businesses and every shop on the street). Each neighbourhood has
safety, cleanliness, happiness and wealth (0-100). Every week (MAYOR.weekSeconds of play) the books settle: shops pay
a cut of their takings and homes a property tax at the tax rate; the budget goes to police, city services, parks and
small-business grants, split by households (and shops), the focus neighbourhood counting double; every score moves
35% toward a target set by that spending (diminishing returns), the gangs, open shops and the tax rate. Each business
has a health that follows its neighbourhood (safety, wealth, cleanliness, grants, taxes): below 30 it closes, above
52 a closed one may reopen. Approval is happiness weighted by households. Calibrated so the default budget roughly
breaks even (approval ~60, the gang-held neighbourhood lagging); austerity piles up cash while the city rots and
shops close; high tax and big spending is safer but caps happiness; low taxes are popular and run a deficit
(tests/unit/mayor.test.js).

City Hall (C, or the pause menu): the town map tinted by a chosen score (red to green) with neighbourhood names,
closed shops marked; treasury, approval, shops open; tax and department sliders with a live projection; the focus
neighbourhood; every neighbourhood's bars and shops; last week's report. The HUD carries a mayor bar (week, treasury,
approval, time to settlement) and a toast when a week settles. On the street, closed shops are boarded up
(`render/kit/closedShops.js`: plywood over windows and door, CLOSED and FOR LEASE signs, shared materials) and
unboarded when they reopen; turf businesses record their street face (`biz.front`) for it.

Next (planned): households with moods who move out (dark houses, FOR SALE signs), projects on lots (parks, clinics,
bus stops), crime spreading through neglected neighbourhoods, events and elections, citizens with requests.

# THE LOT GENERATOR (asset catalogue + lot subdivision)

The city is built from the handcrafted kit assets only, placed lot by lot (kit look; the old stepped boxes remain for
the legacy look). `city/lots/catalogue.js` lists every asset with its frontage and depth ranges (metres), zone
weights (residential, commercial, industrial, civic, and core = commercial blocks in the downtown core), a corner
weight (or cornerOnly), a per-cell limit and its builder: house (front yard, path, maybe a driveway and a car, a fenced
backyard with a garage or shed, laundry, a tree), porch house (two storeys), walk-up (entry court with palms, parking
behind), shop (taco stand, discount store or walk-in market), corner market (parking in front, corners only), surface
parking, pocket park, workshop, warehouse yard, mid-rise storefront block and tower (core).

`city/lots/lots.js` subdivides each cell after the businesses, warehouse compounds, garages and whole-cell
neighbourhood modules have taken their ground: corners first (where two streets meet; shops and corner markets are
most likely there), then each open side walked end to end, cutting lots back to back so the street wall is
continuous. Lot width comes from the chosen asset, depth too, capped so lots on opposite sides meet in the middle of
the cell (residential backyards fill the block). Sizes are whole metres so lots tile the 1 m raster exactly.
`city.lots` records every lot (rect, asset, front, corner); tests check no overlaps, every lot inside its cell,
catalogue assets only, corner-only rules, determinism.

Street hierarchy (`roads.hierarchy`): every street line has a class, set in the layout. Avenues every third line
counting from the middle (24 m with both sidewalks: four lanes, double yellow centre, dashed lane lines, a bus
shelter on long sides with the kerb kept clear of parked cars); ordinary streets (16 m, as before; the outer ring is
always one); narrow residential streets in the outer part of the grid (13 m, no centre line). Segments carry `kind`,
the layout `SX/SZ` (widths) and `KX/KZ` (classes). Rear service alleys (6 m) run through commercial, downtown and civic
cells between two opposite street sides: lots back onto them, dumpsters and bins along them, lamps, kerb cuts at
both ends, poles kept out of their mouths; `city.alleys`. Curves and dead ends come from the whole-cell
neighbourhood modules (crescent, cul-de-sac) in the suburbs.

Zoning by distance and street: block zones as before (landmark, parks, civic, commercial inside 0.55 of the radius,
residential outside), but a gang warehouse's block is industrial only against the river or rail yard or far out
(otherwise its compound stands in a mixed block), and some outer blocks against those edges turn industrial
(`zoning.edgeIndustry`). Lots read a per-frontage use (`frontageKey`): avenue frontage is main street (shops,
walk-ups, mid-rises, corner markets) wherever it is; a commercial block's narrow residential streets get houses and
walk-ups; residential blocks close in are 'inner' (walk-ups and porch houses), the outer ones mostly houses. Corner
lots face their avenue. Whole-cell neighbourhood modules stay off avenue cells, so main streets are a continuous
shopfront. Lots record `street` and `use`; a test checks avenue frontage and the suburbs.

Handcrafted civic and storefront pieces: City Hall (`cityHall` in turf/fill.js) is a limestone block on a rusticated
base with windows on every face, a portico of eight columns under a pediment (CITY HALL and the town's name), a
balustrade, a domed copper cupola with a clock and the town flag, bronze doors, lamps and two flagpoles; no random
draws. Every turf business has clear front windows (no opaque glow panel), so the pawn shop's cases, the laundromat's
machines, the boxing ring, the auto lift and the clinic's waiting room show from the street.

City checks (`src/city/check.js`, tests/unit/citycheck.test.js): a flood fill of the walkable ground from the spawn on
a 0.25 m grid with a body just inside the player's (same step-up as walking, no jumping or climbing) must reach every
door: businesses, homes and walk-in markets; no two buildings may overlap (square-on ones as rectangles, angled ones
by their inscribed circle); and the city must stay within a size budget (generator boxes, kit buildings, props,
people, lights; ~25% over today's largest; raise it only with a phone frame-rate check). Run on four Downtown seeds and
Palmetto Bay. What it found and fixed: crescent back-row yard fences standing against the house fronts, cul-de-sac and
crescent houses generated on top of one another (module rows now skip taken spots, `MB.clear`), front doors too tight
past the open leaf (now 1.5 m), and angled houses are no longer walk-in (their colliders are too coarse for a doorway).

# STREETS, NOT MEWS (Downtown)

Playtest: the pedestrianised mews (the same paved strip again and again, and dead space when you need to get
somewhere) and the diagonal avenue (always in the way) are gone from Downtown. `roads.keepStreets`: neighbouring cells
still merge into territory blocks (same block counts), but the street between them stays an open street; `roads.diagonal`
is null. Palmetto Bay (the town, baked from its seed) uses the same rules.

# DELI & GROCERY (bodega-type businesses)

Every turf business of type `bodega` (Rivera Deli & Grocery, El Sol Grocery, Big Mike Deli...) is furnished like
Sal's Diner (`FURNISHED` in `turf/business.js`, `buildDeli`, its own random stream so the city never moves), after the
user's reference image (style only): black-and-cream checker floor, wood wainscot under cream walls, fluorescent tubes
in a drop ceiling. Corner side: the counter (wood front, speckled stone top) with the register (the capture point),
the clerk, a cigarette rack and the shop's name on a cream banner ("LOTTO - COLD BEER - SANDWICHES - BEVERAGES").
Two gondola aisles down the middle, a wall of glass-door coolers across the back under COLD BEER, a stock-room door,
a lotto poster and a clock. Alley side: the deli (glass case of meats and cheese, back counter with microwaves and a
slicer, salamis, the DELI price board) and the deli man; produce crates by the door, a chip rack, an ice-cream chest,
an ATM and an ATM INSIDE sign, a customer at the case.

# WALK-IN HOMES

Every ordinary pitched-roof kit house at least 8.5 m wide and 9 m deep (`isHome` in `kitdata/home.js`) is a walk-in
home after the user's reference image (style only). One layout (`homeLayout`) drives the colliders
(`kitdata/data.js`), the renderer (`render/kit/houses.js`) and the generator's room light and resident, so what you
see is what you bump into. The front door stands open (1.2 m wide); windows are see-through glass with part-drawn
venetian blinds. Living room at the front: dark varnished boards, two-tone walls (dark blue-grey wainscot, a chair
rail, pale above, crown moulding), a rug, an olive sofa facing a TV on a low unit between tall speakers, a coffee table
with a bottle and ashtray, a poster and a framed picture, a potted plant, pendant lamps; stairs with a banister up the
left wall in two-storey houses (the upper floor is not built). A cased opening in a partition leads to the
kitchen-diner across the back: green checker floor, honey-oak cabinets on two walls (upper ones skip the windows), sink
under a window, stove, an almond fridge, a table and four ladder-back chairs. One warm, dim room light per home and
someone on the sofa in about half (both placed by position, no rng). Houses without a porch get a concrete stoop.

# THE TURF MAP (how Downtown is generated) — decisions

- **District as data** (`src/city/turf/districts/downtown.js`): personality, landmark, road style, edges per side,
  neighbours, zoning, warehouse count, business mix, building styles, palette. A new district is a new config.
- **Order (landmark-first):** identity -> road skeleton -> landmark cell -> zoning (warehouses, HQs, territories) ->
  ground and edges -> landmark -> warehouses -> businesses -> fill -> connections -> physics -> strategy data.
- **Roads:** a 5x5 grid of 58–76 m cells with jittered sizes; interior street segments are pedestrianised into
  paved mews (never leaving a dead end or splitting the network) so cells merge into 12–16 territory blocks; one
  diagonal boulevard runs corner to corner at curb height (AABB physics stays axis-aligned; paint, curbs, trees and
  lamps follow the diagonal; buildings step along it).
- **Landmark:** "First National Debt", a 170–190 m stepped spire on a plaza in the most central cell the diagonal
  doesn't cut; the podium sits toward one corner so the block keeps room for a business. Median 67% of street
  sample points can see it (worst seed 53%).
- **Edges (never invisible walls):** east river (promenade, railing, quay drop into the water = "you fell"), north rail
  yard behind a 6 m chain-link fence with barbed wire, south highway behind a 6 m sound wall, west row of warehouses
  with fenced gaps. Two streets per side leave the map and end at a closed gate/barrier under a green sign naming
  the neighbouring district (The Yards, Southside, Old Neighborhood, Waterfront). Colliders are 8 m so a stacked
  jump + mantle can't clear them.
- **Warehouses:** 6–8 (capped at half the block count), on cell corners with streets on two sides, preferring the
  ring, river and rail-yard edges; one per block, spread out. The two HQs are the eligible pair furthest apart
  (hops, then distance) whose diners can sit in distinct neighbouring blocks.
- **Territories:** each HQ claims its diner block; every warehouse then gets one block (greedy, then swaps that
  shorten the longest link); remaining blocks go to the nearest warehouse with room. Every non-warehouse block holds
  1–2 businesses; each business belongs to exactly one warehouse (max walk gate->door 395 m over 100 seeds).
  Territory = the warehouse's block + its businesses' blocks; adjacency is between territories. Owners: HQ
  territories belong to their gangs, the rest start neutral.
- **Warehouse template** (`warehouse.js`): 48 x 44 m compound + a 5 m service lane. Perimeter: chain-link with barbed
  wire and brick sections (slot), rolling vehicle gate (main gate, rammable) and side gate (both open for now),
  containers two high along the far side and as a front corner tower (ladders on the yard side), guard booth,
  floodlights. Yard: box trucks, pallets, crates. Keep: loading dock with three roll-up doors, side door with steps,
  pallet racks in two rows, mezzanine catwalk (stairs) along the back and far side, upstairs office with the safe
  (capture point), roof with three skylights and a ladder. Owner colour on the gate board and a painted band.
- **Siege data per warehouse:** staging areas on every open side (front + corner always; back/far when open),
  breach points (main gate, side gate, fence cuts, brick walls, container walls, dock doors, side door, skylights),
  defender posts (container tops, guard booth, yard cover, dock doors, catwalk, office), the safe; slots for siege
  equipment (ram truck, bolt cutters, ladders, forklift) and defender upgrades (brick walls, reinforced gate,
  floodlights, cameras, barbed wire, guard dog, barricades).
- **Business template** (`business.js`, kept for raids): corner storefront with big windows, door with a roll-down
  gate, counter + register (raid target), side alley with back door, alley ladder to a roof with AC units, sidewalk
  cover (planters, bench, newspaper box, parked car), fenced back lot. Type slots: sign, awning colour, window
  display, interior and exterior props (bodega, pawn shop, laundromat, boxing gym, auto shop, clinic, diner).
- **Battle zones:** raid (business block + nearest intersection), siege (compound + lane + staging), turf war
  (landmark and each HQ block + neighbours, capture points = safes and registers inside).
- **Tactical data:** cover points around every cover object (props, counters, racks, trucks, pallets, AC units) with
  the direction they protect from and low/high; climb points (base/top) for every ladder and fire escape.
- **Town map** (M / pause): bright, labelled top-down map in the spirit of the EarthBound layouts (the one place
  that style is allowed): zones, owner-tinted territories, warehouses as keep icons linked to their businesses,
  HQs marked, landmark, edges, roads out, "You".
- **Debug:** seed in the pause menu + any seed can be played; free-fly camera (F1); overlay (F2) with block borders
  and ids, territory adjacency, raid/siege/turf-war boundaries, staging, breach points, defender posts, safes,
  registers, approach points, cover and climb points.
- **Verification** (`tests/city/turf100.mjs`, 100 seeds, all passing): determinism; businesses mutually reachable;
  block and territory graphs connected; HQs far apart with their diners; >= 2 raid approaches and a reachable roof per
  business; landmark visibility; nothing over roads or the diagonal; nothing floating; doors/alleys/gates clear;
  nav covers streets, alleys, interiors, roofs; staging >= 2 on different sides and reachable; every breach point
  reachable and leading to the safe; defenders reach every post.

---

# DIRECTIONS LOG (verbatim, newest last)

## Pivot, Part 1: The City Map

```
# BROKE — Pivot, Part 1: The City Map

We are changing BROKE from a roguelike into a real-time, third-person 4X gang turf war. This prompt covers **Part 1 only: the pivot plan and the procedural city map.** Do NOT build combat changes, troops, the economy, or the rival AI yet. Work autonomously without asking me questions, then STOP at the end and report.

---

## THE NEW GAME (context only, for planning)

Two gangs fight for control of a procedurally generated city in real time. The city is divided into blocks. Each block has one business that acts as its base (a bodega, a boxing gym, an auto shop, and so on). Capturing a block's business claims the block and earns income. Each gang has a headquarters; lose it and you lose.

You play as a gang leader in third person, fighting alongside a small crew of named members with permadeath. Orders go through an in-game phone; pulling it out slows time for tactical orders. Attacking a business starts a tactical battle on that block. Combat is deliberate and mostly melee; guns are rare.

The map you build now is the foundation for all of that, so it must work both as a 3D world and as strategy data.

---

## STEP 1: AUDIT AND PLAN

1. Read the current codebase and DESIGN.md.
2. Write a short list in DESIGN.md of what we **keep** (rendering, lighting and the visual overhaul, character models, the animation and combat-feel systems, the test harness, any reusable city generation), what we **change**, and what we **retire** (the item shops and roguelike item system, the difficulty clock, the subway exit event, the roguelike stage loop).
3. Don't delete retired systems yet. Disconnect them from the main game and leave them in place so nothing breaks.
4. Replace the concept section at the top of DESIGN.md with the new game summary above.
5. **Architecture rules from now on:**
   - Game state lives separately from rendering.
   - Every game action (later: move, attack, capture, recruit) is a command sent into the simulation. The rival AI and, later, a second human player must use the same commands. This keeps future multiplayer possible without a rewrite.
   - Map generation is fully deterministic from a seed.

---

## STEP 2: PROCEDURAL CITY MAP

Build **Downtown first**, but structure everything so other districts are just new configs.

### 2A. The map as data (the territory graph)
The generator outputs a 3D city AND a data model the game logic can use:
- **Blocks:** id, district, zone type (commercial, residential, civic, park), owner (neutral for now), and its business.
- **Adjacency:** which blocks border which. Later, gangs can only claim blocks next to their turf.
- **Businesses:** id, type, block, level, capture point position, defender posts, attacker approach points.
- **Landmarks** and **district edges.**
- **Battle zones** (see 2E).
- Start with a 5x5 block Downtown with roughly 12 to 16 capturable businesses. Block count is a config value.

### 2B. Districts as configs
Each district config defines: personality, a signature landmark, a road-shape style, a natural edge, a business mix, building styles, and a palette. The generator reads the config. Adding a district later means writing a config and modules, not changing the generator.

Downtown: dense, partly diagonal grid; a tall spire tower visible from everywhere; a river edge on one side; glass towers mixed with older brick buildings; heavy on bodegas, pawn shops, and parking garages.

### 2C. Generation order (landmark-first)
1. **Identity:** read the district config.
2. **Landmark:** place it first, visible from most of the map so players can navigate by it.
3. **Roads:** generate the road skeleton from the district's road-shape style, not a uniform grid.
4. **Edges:** frame the map with natural or built boundaries (river, rail yard, highway), never invisible walls.
5. **Zoning:** a dense core thinning toward the edges, mixing commercial, residential, civic, and park zones.
6. **Businesses:** place one base business per block, following the district's business mix. Place both gang HQs far apart (a diner for each, with different names).
7. **Fill:** buildings in the district's style, then parks, alleys, trees, and props, so open space feels designed, not empty.
8. **Connections:** roads leaving the map get signs naming neighboring districts.

### 2D. The business base template
Every business uses **one shared layout** for now, built as a template with slots so new layouts can be added later without changing how capturing works.

The layout must look like a real corner business but play like a defendable base:
- Storefront with big front windows and a door with a **roll-down security gate**.
- Inside: aisles or equipment, and a **counter with a register**. The register is the capture point.
- **Side alley** with a **back door**, giving attackers a second way in.
- **Rooftop** reached by an alley ladder, with AC units as cover.
- **Sidewalk out front** with cover: planters, a bench, a newspaper box, a parked car.
- A small **back lot**.

Template slots change per business type: sign, awning color, window display, interior props, and exterior props.
- **Bodega:** neon sign, stacked soda cases, newspaper box out front.
- **Boxing gym:** posters in the windows, heavy bags inside.
- **Auto shop:** stacked tires, oil drums, a car on a lift.
- **Pawn shop:** barred windows, display cases.
- **Laundromat:** rows of machines, a folding table.
- **Clinic:** a plain sign with a cross, waiting-room chairs.
- **Diner (HQ):** booths, a long counter, a memorial wall space for later.

### 2E. Battle zones
For every business, define its **skirmish zone**: the whole block around it (street, sidewalks, alley, back lot, roof, and the nearest intersection). Mark:
- At least two **attacker approach points** (street ends, alley mouth).
- **Defender posts** (counter, windows, roof, out front).
- A soft **battle boundary**.

Also mark larger zones for later:
- **Street Brawl zones** at key intersections and parking garages.
- **Turf War zones** at the landmark and each HQ, with several capture points across neighboring blocks.

### 2F. Navigation, cover, and climbing (for the AI later)
- A navigation mesh or graph covering streets, sidewalks, alleys, interiors, and roofs.
- **Cover points** tagged on every cover object (cars, planters, dumpsters, counters, AC units), with which direction they protect from.
- **Climb points** on ladders and fire escapes.

### 2G. Town map screen
A pause-menu map in the spirit of the EarthBound reference: a bright top-down view of the district with block borders, owner colors, labeled businesses by type, the landmark, both HQs, and the district name. This becomes the phone's map later, and it's how I'll check the layout, so make it clear and readable.

### 2H. Debug tools
- Seed shown in the pause menu; any seed can be replayed.
- A free-fly debug camera.
- A toggleable overlay showing block borders and ids, adjacency lines, business capture points, approach points, defender posts, cover points, climb points, and battle zone boundaries.

### Visual style
Keep the current visual direction from the overhaul (the Arkenfall target look, with Downtown's palette). The city needs high density of small street detail so it feels lived in.

---

## REFERENCES

- **towns.webp** shows 2D overhead town maps from EarthBound. Use it ONLY for layout and district identity: how landmarks, roads, edges, zones, and points of interest are arranged. It is NOT a visual reference. Do not use its pixel art, colors, top-down view, or flat style for the 3D game. The one exception is the town map screen, which can borrow its bright, labeled style. Don't copy its art, names, or layouts.
- **target-look-*.png** (Arkenfall screenshots) set the 3D look.
- **downtown.jpeg** sets Downtown's mood, palette, and set pieces.

---

## STEP 3: VERIFY

Generate 100 seeds and check every one:
- Every business is reachable on foot from every other.
- Every block has exactly one business, and the adjacency graph is fully connected.
- Both HQs exist and are far apart.
- Every business has at least two attacker approach points and a reachable roof.
- The landmark is visible from most street positions (sample with raycasts and report the percentage).
- No buildings overlap roads, nothing floats, nothing blocks alleys or doors.
- Navigation covers streets, alleys, interiors, and roofs.
- 60 fps while walking the whole district.

Commit these tests to the repo.

---

## STOP AND REPORT

Report what you kept, changed, and retired; the test results; and current fps. Include screenshots of:
1. The landmark from street level
2. A bodega base close up, front and alley side
3. The debug overlay from above
4. The town map screen

Then give me a short checklist to walk around and judge myself: does it feel like a real place, does the bodega look like a bodega but feel defendable, and can I find my way using the landmark.
```

## Part 1 Update: Warehouses as Bases

```
# BROKE — Part 1 Update: Warehouses as Bases

Design change to the map from Part 1. Apply it to the generator, the territory graph, battle zones, the town map, the debug overlay, and the tests, then update DESIGN.md. Work autonomously, then STOP and report.

---

## THE CHANGE

Bases are no longer businesses. **Every base is a warehouse,** and every warehouse uses the **same layout.** Think of Mount & Blade: warehouses are the castles, businesses are the villages.

- Each warehouse **controls 1 to 3 nearby businesses** (bodega, boxing gym, auto shop, pawn shop, laundromat, clinic). Whoever holds the warehouse gets those businesses' income and functions.
- Businesses can't be captured directly. They can be **raided**: a small fight that cuts the owning warehouse's income for a while and weakens its defenders' supplies.
- A warehouse cut off from its businesses grows weaker over time (lower defender morale and supplies), so raiding the surrounding businesses before a siege is a real strategy.
- Each gang's **HQ is its home warehouse,** with the diner next door as its linked business. The memorial wall stays in the diner.

---

## THE WAREHOUSE (one shared layout, built as a template)

It must look like a real city warehouse but play like a castle.

**Perimeter (the walls):**
- Chain-link fence topped with barbed wire, with some brick wall sections.
- A rolling **vehicle gate** (the main gate) and a smaller **side gate.**
- Shipping containers stacked two high along the fence, with ladders, acting as **walls and towers** defenders can stand on.
- A **guard booth** by the main gate and **floodlights** on poles.

**The yard (the courtyard):**
- Parked box trucks, pallets, and crates as cover.
- Open enough for a real fight between the fence and the building.

**The building (the keep):**
- **Loading docks** with roll-up doors (the inner gate) and a side door.
- The main floor: tall **pallet racks** forming cover and lanes.
- A **mezzanine catwalk** overlooking the floor, giving defenders high ground.
- An upstairs **office** with a **safe.** The safe is the capture point, the final stand.
- A **roof** with skylights: a risky way in from above.

Template slots: gang colors and signage, fence vs. brick wall sections, container colors, props, and upgrade visuals (see below).

---

## SIEGE DATA FOR EACH WAREHOUSE

Mark in the territory graph and debug overlay:
- **Staging areas** outside the fence where attackers gather before a siege (at least two, on different sides).
- **Breach points:** the main gate (rammable), side gate, fence sections that can be cut, container walls that can be climbed, dock doors, side door, skylights.
- **Defender posts:** container tops, guard booth, yard cover, dock doors, catwalk, office.
- **The safe** as the capture point.
- Cover points and climb points for all of the above.

Also store slots for later systems (don't build them yet):
- **Siege equipment** attackers can bring: a box truck to ram the gate, bolt cutters for the fence, ladders, and a forklift to lift crew to the catwalk or move containers.
- **Defender upgrades:** brick walls replacing fence, a reinforced gate, extra floodlights, cameras for early warning, more barbed wire, a guard dog, barricades.

---

## BATTLE SIZES (updated)

- **RAID (4–6 per side):** a business. Quick and small, fought on its block.
- **SIEGE (8–12 per side):** a warehouse. The main battle of the game.
- **TURF WAR (larger):** a district landmark or a gang HQ, with several capture points.

---

## MAP GENERATION CHANGES

- Downtown gets **6 to 8 warehouses** (a config value), each linked to 1 to 3 nearby businesses. Every business belongs to exactly one warehouse.
- Warehouses need space: place them in industrial pockets, along the river edge, near the rail yard, and behind commercial blocks, with streets on at least two sides so sieges have multiple approaches.
- **Territory now belongs to warehouses:** each warehouse controls its own block plus the blocks of its linked businesses. Adjacency is between warehouse territories.
- The two HQ warehouses are placed far apart.
- Keep the existing business template for raids.

## TOWN MAP AND OVERLAY

- Town map: show warehouses as the main icons, lines to their linked businesses, territory shaded by owner, and HQs marked.
- Debug overlay: add staging areas, breach points, defender posts, and the safe.

---

## VERIFY (add to the existing tests)

Across 100 seeds:
- Every warehouse has at least two staging areas on different sides and every breach point is reachable.
- Every business is linked to exactly one warehouse, within a reasonable walk.
- The safe is reachable from every breach point.
- Defenders can reach every post; container tops and the catwalk are climbable.
- 60 fps walking through a warehouse and its yard.

---

## STOP AND REPORT

Report the changes and test results. Include screenshots of a warehouse from the street, the yard from a container top, the warehouse floor from the catwalk, the office with the safe, and the updated town map. Then give me a checklist: does the warehouse look real, does it feel like a castle to attack, and are there enough different ways in.
```

## Art direction change (v3)

```
ART DIRECTION CHANGE: the current look is too
cartoony. New target: PlayStation 2 era open-world
crime games like GTA San Andreas. Use it as a style
reference only; copy no assets, names, or designs.
- Realistic human proportions. No oversized heads,
  hands, or exaggerated features.
- Low-poly models; put detail into procedural
  textures: cracked asphalt, stained concrete,
  graffiti, faded paint, rust, grime.
- Heavy atmospheric haze and a warm, smoggy color
  tint by day; distance fades into haze.
- Sun-faded, slightly desaturated palette with gang
  colors as the strongest accents.
- Moody but simple lighting: long sunsets, sodium
  streetlights and neon at night.
- A worn, lived-in city: chain-link, power lines,
  dumpsters, beat-up cars, billboards, litter.
- Satirical characters look like real people; the
  comedy lives in their behavior and barks.
- Drop the Arkenfall screenshots as a visual target,
  but keep their lessons: dense small detail,
  atmospheric depth, and constant sub
```

---

## Art direction fix (remastered look, hero scene)
ART DIRECTION FIX. The current look is flat and cartoony. The target is /references/target-look.jpeg: a remastered
early-2000s open-world crime game look. Use it for style only; copy no assets or designs. Match its lighting,
materials, and street detail; the city layout still comes from our generator. Fix these differences, in this order:
1. LIGHTING: bright, neutral daylight with a clear sun and a pale sky. Remove the pink-brown grading, vignette, and
heavy haze; keep only light distance haze. Add soft sun shadows, ambient occlusion under eaves and in corners, and
filmic tone mapping. Light sources at night stay warm. 2. MATERIALS: no flat colors anywhere. Every surface gets a
texture with color, roughness, and normal detail: wood siding, stucco, brick, concrete, asphalt with grain and patches,
roof shingles, metal, chain-link. You may use free CC0 textures from Poly Haven or ambientCG, stored in
/assets/textures with a CREDITS file; add procedural wear (grime, stains, cracks) so repetition doesn't show.
3. BUILDINGS: framed, recessed windows with sills; trim, gutters, eaves, and proper rooflines; porches, railings, steps,
garage doors, and fences on houses; loading docks and roll-up doors on warehouses. 4. GROUND: raised curbs (some
painted red), sidewalks, grass strips, driveways, crosswalks, lane markings, manholes, and cracks. 5. STREET LIFE: power
poles with sagging lines, streetlights, trees and palms built from leaf cards, shrubs, parked cars, trash cans, and
idle pedestrians. 6. CHARACTERS: realistic human proportions, skin and fabric materials, natural colors. No toy-like
shapes. Build one hero scene first: a street with houses, a corner, and the player walking down it, matching the
target's camera angle. Screenshot it, compare it side by side with the target, list the five biggest differences, fix
them, and repeat at least three times. STOP and show me before rolling the style out to the whole city. Keep 60 fps.

## Character fix
CHARACTER FIX. The player character looks like a toy (capsule limbs, segmented body), while the pedestrian NPCs look
like real people. Unify them. 1. Build ONE shared human character generator, based on the pedestrian NPC model. The
player, crew members, rival gang members, neutral defenders, and pedestrians all come from it. 2. Replace the player
character with this model. The player is now LOU MANCUSO (per Part 2): a 52-year-old ex-bus driver in a worn work
jacket, jeans, and work boots. Retire Dee's model and her old abilities (Syringe, Rounds, Salsa, Code) from the HUD.
3. The camera is always close to the player and crew, so add a higher detail level for anyone within about 10 meters:
smooth, continuous body with no visible joints or segments; hands with fingers; a face with real features: brows,
nose, jaw, ears, and simple eyes; hair with volume and texture; clothing with folds, seams, and fabric textures,
layered over the body; skin with subtle variation and shading. Distant characters keep the simpler model. 4. The
generator varies body type, height, age, skin tone, face, hair, and outfit, so crews and crowds don't look cloned.
5. Keep the existing animation and combat-feel systems working with the new rig. Verify with a close-up screenshot of
Lou from the gameplay camera, one from the front, and one of Lou next to a pedestrian at the same distance. They must
look like the same kind of person. STOP and show me.
(Status: generator, both LODs, materials and Lou's sim kit are built; the close-up build is too slow and not yet wired
in — parked when the next direction arrived.)

## Reuse the "h" hero scene
REUSE THE "h" HERO SCENE. 1. KIT: Extract everything that makes "h" look right into a reusable kit: materials and
textures, lighting and sky setup, post-processing, houses, apartment buildings, curbs (including red-painted
sections), sidewalks, grass, driveways, fences, palms and trees, power poles and lines, streetlights, cars, and props.
Document it in DESIGN.md. 2. APPLY: Switch the procedural city to use this kit and lighting everywhere, so generated
streets look as good as "h." 3. MODULE: Turn the hero scene into a handcrafted neighborhood module the generator can
place. First make its layout original: change the road curve, building arrangement, and lot layout so it is no longer
a recreation of any existing game location, while keeping its quality and feel. 4. MORE MODULES: Build 3–4 more
original neighborhood modules in the same style (a cul-de-sac, a corner store intersection, an alley of backyards, a
warehouse block). 5. Keep "h" as a visual test scene to compare against. Verify: generate 5 seeds, screenshot each
from the "h" camera angle, and compare against "h." STOP and show me.

---

# HISTORY: BROKE, THE ROGUELIKE (retired)

The roguelike design (retired by the turf-war pivot): the original build prompt (Part 1), later directions (Part 2), reference notes (Part 3) and its decisions log (Part 4).

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


## 2.4 The President game, farming and the war (verbatim, in order)

```
Make this a White House. This game you are now the president.
```
```
These huds are awful this is suppose to be an  immersive sim. Maybe you can only see the treasury money when going to the treasury and vise versa. The map and ui is terrible
And idk what's going on or what I'm playing
```
```
I also want to add the ability to farm in a section of the map. This should be the food for the population. I also want to add a military place for future updates. I think it would be goal if there was a war going on vs a friend. Not one that you personally fought in but a simulated one and the things you go in ur town and how you plan matter
```
```
What's if it was a turn based battle. Would that be very hard
```
```
What if we made it like worms 3d that way we don't have to change anything.
```
```
We should make the troops like xcom. Every week you send 4 people for war. If they die they die
```
```
We don't need enemy AI right now because I am only going to be versing another player
```
```
I would like to know that it when my friend picks up the phone or get the link will he see the last turn?
```
```
Just note it will be a 4 v 4 and be similar to worms 3d
```
```
Actually 3 v 3. How much should towns cap at with unique people? 10?
```

### Plan agreed so far (not yet built)

- **You are the President**; the White House stands on the first civic block (built). The stone hall on any other
  civic block is the police headquarters.
- **Immersive UI** (proposed, awaiting go-ahead): almost nothing on screen; numbers live in places (the Treasury
  shows the money, the police HQ the crime map, the Oval Office desk the briefing and polls, newspaper boxes the
  mood); a paper map; an opening where the chief of staff meets you and hands you your first tasks.
- **Farmland**: a farm zone at one edge of the map; fields grow crops that feed the population each week;
  shortages hurt approval, shops and crime.
- **Military base**: a fenced base at another edge (barracks, depot, briefing room); recruits are named citizens
  taken from the workforce.
- **The war, against another player (no enemy AI)**: every week each side sends **3 soldiers** into a **3 v 3
  battle played like Worms 3D** (changed from 4 v 4): teams alternate turns, on your turn you control one soldier directly in 3D (move,
  then fire one weapon) on a stretch of the city. Soldiers are **XCOM-style**: named, classed, ranked, wounded or
  **killed for good**. What you do in town (food, money, recruiting, approval) decides what you field.
- **Playing a friend**: same device first, then through the shared game link: turns are stored with the link, and
  opening it replays the other side's last turn before your own (the command log makes replays exact). Needs the
  friend signed in to claude.ai and invited with permission to play; no push notification.

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

## STREET FIGHTS (turf war arcade loop, high scores, online board)

User direction: "Let's add ai and some power ups and keep a high score for the player. The leaderboard shud be online."

- **The Vipers** (`src/sim/enemies/gang.js`), the rival crew, have three roles. Every attack has a visible wind-up.
  - The **gunman** closes to pistol range, circles at 9–17 m and fires 2–3 round bursts after a draw. It backs off to reload and opens the distance when hurt.
  - The **bruiser** rushes in and punches.
  - The **heavy** is slow and tough, with a sawn-off spread.
  - Only 2 guns fire at once on the first waves, plus one every third wave (`Arcade.mayShoot`). Only one crew member shouts at a time.
- **Waves** (`src/sim/turf/arcade.js`): 3 + 2n enemies per wave. Bruisers join from wave 2 and heavies from wave 3. Toughness and damage scale per wave. At most 7 are alive at once, spawned off-screen at the city's spawn points. There's a 6 s break between waves, and clearing a wave heals 25.
- **Score = kills** (user: "The high score is number of kills before player died"). Headshots, best streak, wave and time survived are shown as run stats only.
- **Power-ups**: medkit (+60), armor (60 barrier), double damage, rapid fire (fast hammer, no reloads), and adrenaline (+35% speed). Timed ones last 10–12 s. They drop from kills (18%, heavies 60%) and turn up on the street about every 28 s. They glow in their colour with a light column, and blink before they vanish.
- **Pathfinding fix**: the flow field now records walls between neighbouring cells. Fences and walls used to read as a way through, and enemies stood behind them.
- **High scores** (`src/net/leaderboard.js`):
  - The local best is kept in localStorage.
  - The online board is the published page's shared store: `scores/<player id>` = { tag, score (= kills), wave, kills, headshots, at }, best run only.
  - Rules: `scores` is readable by everyone and written by the owner; `scores/{self}` is written by that player at Contributor level and up.
  - Public-link visitors can read the board but can't post (a platform rule: outside viewers never write). The game-over screen says so.
- The game-over screen shows the score, the run stats, a personal-best flag, a name field with Post score, and the top 10 (your row highlighted). The title screen shows your best and the online top five.

## THE TITLE SCREEN (attract mode)

User direction: "I need a more immersive opening screen."

- **Camera tour** (`src/render/titlecam.js`): the menu sits over a slow loop of four shots of the city, 8.5 s each, cut through black, each with a location card in the bottom letterbox bar:
  - a low dolly down a nearby street, named after a business on it;
  - a slow orbit around your character;
  - a side-on two-shot: a few Vipers loitering in the foreground (`spawnLoiterers`: no AI, no attacks) with you beyond them;
  - a crane up toward the landmark tower.
  Every camera position is checked against the world and has fallbacks. A target inside a solid, like the tower, is tested short of the solid.
- **Layout**: letterbox bars, a dark falloff from the left, the BROKE logo and the menu bottom-left (Hit the streets / Character / Be the President / How to play), and the street-legends top five and your best in a card top-right. On phones it's centred low, with the board under the top bar.
- **Production card**: once per visit, before anything else: "A Teddy Bousquet Production" fades up over black, holds and lifts (about 5 s; a click or key skips it).
- **Splash**: the first time, only the logo and "Click to enter" show. That click starts the city's sound, which browsers only allow after a gesture.
- **Leaving**: choosing anything cuts to black, and the game fades up from black.
