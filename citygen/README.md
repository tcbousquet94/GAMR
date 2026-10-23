# citygen

Procedural city layouts for games, filled with **your** assets. Zero dependencies, engine-agnostic, deterministic.

You describe your buildings (how wide and deep a lot each one needs, which parts of town want it, a few placement rules), and citygen lays out a city around them:

- **Streets with a hierarchy.** Avenues through the middle, ordinary streets, and narrow local streets toward the edges. Every street is open, so any block can reach any other by road.
- **Zoning.** A commercial core thins out to inner and outer residential. Industry sits against the map edges you choose. Avenue frontage becomes main street.
- **Landmarks.** A landmark either takes a whole block (a park) or stands on part of a block behind a clear forecourt (a town hall).
- **Rear service alleys** run through deep commercial blocks.
- **Lots.** Corners are cut first, then every street frontage is cut into lots, each sized for one of your assets and facing its street. Lots tile on a 1 m grid and never overlap.
- **Checks.** `checkPlan` catches overlaps, lots that don't touch their street, and frontage coverage.
- **Furniture spots.** `sidewalkSpots` returns evenly spaced points on the sidewalks for lights, trees, hydrants or bus stops.

citygen returns plain data and never builds geometry. Put your own models where it says. The plan is JSON, so a Unity, Godot or Unreal project can read it too.

It was extracted from BROKE's city generator (`broke/src/city/lots`, `broke/src/city/turf/layout.js`). BROKE's handcrafted builders became the catalogue below.

## Use it

```js
import { generateCity, checkPlan, sidewalkSpots, toWorld } from 'citygen'; // or './citygen/src/index.js'

const ASSETS = [
  { id: 'house',  front: [12, 15], depth: [22, 32], zones: { residential: 6, inner: 3 }, corner: 0.8 },
  { id: 'shop',   front: [12, 18], depth: [15, 22], zones: { commercial: 3.5, mainstreet: 4.5, core: 0.6 }, corner: 3 },
  { id: 'market', front: [24, 28], depth: [24, 28], zones: { residential: 1.2, commercial: 2 }, cornerOnly: true, spacing: 90 },
  { id: 'tower',  front: [18, 30], depth: [18, 26], zones: { core: 3 } },
  // ...
];

const plan = generateCity({ catalogue: ASSETS, grid: { cols: 7, rows: 7 } }, 'my-seed');

for (const lot of plan.lots) {
  const model = spawn(lot.asset);                  // your model, front facing local +z
  model.position.set(lot.center.x, 0, lot.center.z);
  model.rotation.y = lot.yaw;                      // turns local +z toward the lot's street
  fitTo(model, lot.width, lot.depth);              // or pick a variant that fits
}
for (const s of sidewalkSpots(plan, { spacing: 30 })) spawn('streetLight').position.set(s.x, 0, s.z);
console.log(checkPlan(plan).stats);
```

Coordinates are metres: x points east, z points south (north is −z), and y is up. A model faces its lot's street when its front points along local +z and you rotate it by `lot.yaw`. `toWorld(lot, x, z)` turns lot-local metres (measured from the lot centre, +z toward the street) into world coordinates. Use it to place a porch, a driveway or a sign.

## The catalogue

| field | meaning |
|---|---|
| `id` | Your asset's name. It comes back as `lot.asset`. |
| `front` | Frontage range `[min, max]` in metres. A lot's width falls in this range. On a street's last lot it can be a little wider, so the leftover strip gets absorbed. |
| `depth` | Depth range `[min, max]` in metres, measured from the street. |
| `zones` | Weight per lot zone, e.g. `{ residential: 6, inner: 3 }`. A zone with weight 0 or absent never gets this asset. Zone names are yours, see below. |
| `corner` | Weight multiplier on corner lots. `0` means never on a corner. Default `1`. |
| `cornerOnly` | Only ever on a corner. |
| `perBlock` | At most this many on one block. |
| `spacing` | No two of this asset closer than this many metres, centre to centre. |

Anything else you put on an entry (a prefab path, a cost, variants) is ignored by the generator and is yours to read back by `lot.asset`.

## The plan

```text
plan.size            { x, z }        whole map, margin included
plan.sidewalk        metres          sidewalk width on every street
plan.streets[]       { id, axis: 'x'|'z' (direction of travel), kind: 'avenue'|'street'|'local', width, rect, from, to }
plan.intersections[] { id, x, z, rect, degree, kinds, outer }
plan.blocks[]        { id, rect, center, zone, landmark, streets: {n,e,s,w: kind}, streetIds, edges, d }
plan.landmarks[]     { id, block, rect, reserved, front, yaw, center, width, depth }   (footprint landmarks)
plan.alleys[]        { rect, axis, block, width }
plan.lots[]          { id, block, asset, zone, front: 'n'|'e'|'s'|'w', street, streetId, yaw, rect, center,
                       width, depth, corner: { side, street, localX } | null, alley }
```

A `rect` is `{ x0, z0, x1, z1 }`. Street rects include both sidewalks. Block rects are the land inside the sidewalks. On a corner lot, `corner.localX` (+1 or −1) says which side of your model, along its local x axis, also faces a street. Use it to put a second entrance or a side sign there. `block.d` is the block's distance from the centre: 0 at the centre and about 1 at the middle of each edge.

## Config

Every field is optional except `catalogue`. The defaults are in `DEFAULTS` in `src/index.js`.

```js
generateCity({
  catalogue: ASSETS,
  grid:    { cols: 7, rows: 7, cell: [58, 76] },          // blocks per side; block size range (m)
  streets: { avenueEvery: 3, localBeyond: 0.5,             // 99 = one main street each way
             width: { avenue: 24, street: 16, local: 13 }, sidewalk: 3 },
  margin: 30,                                              // open ground around the grid
  zoning:  { core: 0.3, commercial: 0.55, inner: 0.8,
             industry: { sides: ['e', 'n'], beyond: 0.6, chance: 0.3 },
             zoneOf: null },                               // (block, zoning, rng) => zone name | null
  frontage: null,                                          // (blockZone, streetKind) => lot zone
  landmarks: [
    { id: 'park', zone: 'park', count: [1, 2], where: 'ring' },                                    // whole block
    { id: 'townHall', zone: 'civic', count: 1, where: 'center', footprint: [36, 24], setback: 8 },  // on part of one
  ],
  alleys:  { width: 6, chance: 0.75, minDepth: 46, zones: ['core', 'commercial', 'civic'] },        // null = none
  repeatPenalty: 0.3,                                      // same asset twice in a row on a street is less likely
}, seed);
```

**Zones are yours.** With the default rules, blocks are `core`, `commercial`, `inner`, `residential`, `industrial`, or a landmark's zone. `frontageZone` then turns a block zone into a lot zone using the street the lot faces:

- Avenue frontage becomes `mainstreet`. Core and industrial frontage stays as it is.
- A commercial block's local streets become `inner`.

For a different kind of game, replace both rules. For example, a fantasy town:

```js
generateCity({
  catalogue: [
    { id: 'cottage', front: [8, 12], depth: [8, 14], zones: { village: 1 } },
    { id: 'stall',   front: [6, 9],  depth: [6, 10], zones: { market: 3 }, corner: 2 },
  ],
  grid: { cols: 5, rows: 5, cell: [36, 44] },
  zoning: { zoneOf: (b) => (b.d < 0.4 ? 'market' : 'village'), industry: null },
  frontage: (zone) => zone,
  landmarks: [{ id: 'temple', zone: 'market', where: 'center', footprint: [20, 14], setback: 4 }, { id: 'pond', count: 2, where: 'ring' }],
  alleys: null,
}, 'riverbend');
```

`where` picks a landmark's block. It takes one of these values:

- `center`: the blocks nearest the middle.
- `ring`: about two-thirds of the way out.
- `edge`: the outer ring of blocks.
- `any`: a random block.

Two of the same landmark are never placed next to each other.

## Try it

```sh
npm test                 # 7 tests: determinism, 120 cities with no overlaps, placement rules, orientation
npm run demo             # ASCII map of a city and its stats
npm i -D three esbuild && npm run viewer   # builds examples/viewer.bundle.html, a 3D viewer you can open
```

`examples/catalogue.js` is the example catalogue: BROKE's town assets, plus a height and colour for each so the viewer can draw boxes.
