# Hallway Heroes: Architecture

A third-person action RPG prototype. Three.js + Vite, with every asset built in code.
Tone: cozy, weird, funny suburban high school (EarthBound look, Kingdom Hearts camera/combat/HUD).

## Folder structure & ownership

```
index.html                 entry, HUD root <div id="hud">            [core]
src/main.js                bootstrap, renderer, system wiring, loop  [core]
src/core/config.js         tuning constants, palette, character data [core]
src/core/events.js         EventBus                                  [core]
src/core/Input.js          keyboard / mouse / gamepad -> actions      [core]
src/core/materials.js      toon(), basic(), blobShadow(), outline()   [core]
src/core/math.js           damp(), clamp(), angle helpers             [core]
src/characters/buildKid.js big-head kid model + procedural animator  [core]

src/world/Environment.js   courtyard wave arena (battle mode only)   [environment agent]
src/world/Area.js          base class for explorable areas (collision, spawns, doors)
src/world/AreaManager.js   area registry, swap + fade, door triggers
src/world/build.js         Batch (merged static geometry + outlines), signMesh, groundRect
src/world/areas/town/      Maplewood, split by district (layout follows the reference map):
  Town.js                    ground, road grid, river/bay/sea, horizon, wayfinding signposts
  props.js                   frame() local building coords, building(), tree, palm, lamp, car, bench...
  school.js park.js westside.js downtown.js fair.js neighborhood.js beach.js
src/camera/CameraRig.js    third-person orbit + lock-on framing      [player agent]
src/player/Player.js       controller, combo, commands, respawn      [player agent]
src/combat/Combat.js       damage, melee sweeps, projectiles, AoE    [combat agent]
src/combat/StatusEffects.js StatusSet ("Embarrassed")                [combat agent]
src/enemies/*.js           EnemyManager + 3 enemy types              [combat agent]
src/party/Party.js         2 AI teammates                            [party agent]
src/ui/HUD.js, hud.css     HUD, command menu, popups, dialogue box   [ui agent]
src/audio/Audio.js         WebAudio synth SFX + tiny music loop      [ui agent]
src/explore/PartyTrail.js  explore mode: EarthBound single-file party line
```

Agents only write files they own. Shared/core files are read-only for agents.

## The `game` object (built in main.js)

```js
game = {
  scene, camera, renderer,          // THREE objects
  input,                            // Input
  events,                           // EventBus: on(name, fn) / off / emit(name, payload)
  time: { elapsed, dt },            // dt is already scaled by timeScale (hitstop)
  timeScale: 1,                     // Combat may lower briefly for hitstop
  world,                            // Environment
  combat,                           // Combat
  player,                           // Player
  party: [],                        // PartyMember[] (2)
  enemies,                          // EnemyManager
  cameraRig,                        // CameraRig
  hud, audio,
  combatants: [],                   // every live Combatant (heroes + enemies); add/remove yourself
  target: null,                     // current lock-on Enemy or null (owned by Player)
  started: false,                   // true after the title screen is dismissed
}
```

Construction order: `world, combat, player, cameraRig, party, enemies, hud, audio, partyTrail`.
Every system is `new X(game)` and exposes `update(dt)`. Constructors may read systems built earlier,
and they must read later systems lazily (at update time).
Update order per frame: `player, (battle: party, enemies | explore: partyTrail), combat, world, cameraRig, hud`, then render, then `input.endFrame()`.
Before `game.started` only `world`, `cameraRig` and `hud` update.
`combat.update(dt, rawDt)` gets the unscaled dt too so it can end hitstop (it restores `game.timeScale = 1`).
`cameraRig.update` and `hud.update` receive the unscaled dt.

## World and scenes

The game world is a set of **areas**. Only one is in the scene at a time, and `game.world` always points at the
active one. Player, CameraRig, Combat and party code only talk to `game.world`. They don't know which area it is.

```
AreaManager (game.areas)
 ├─ town     src/world/areas/town/     seven districts:
 │            1 High School (NW) · 2 Town Park (N) · 3 Downtown (centre) · 4 Pip's street (SE)
 │            5 Arcade & Mall (W, across the river) · 6 Fairground (NE) · 7 Beach (S)
 ├─ school   (step 3) hallway · classroom · cafeteria
 └─ ...      register new areas in AREAS in AreaManager.js
Environment  the original courtyard; only built for ?mode=battle
```

**Area API.** It's the same API the courtyard has, so nothing else needs to change.
- `root` (THREE.Group), `getGroundHeight(x,z)`, `resolveCollision(pos, r)`, `segmentBlocked(a, b) -> 0..1`, `bounds`, `update(dt)`.
- `colliders`: `{type:'box', minX,maxX,minZ,maxZ,h}` or `{type:'circle', x,z,r,h,camR}`. `camR` makes a circle block the camera (tree canopies).
- `spawns`: `name -> {pos, yaw}`. `default` is used at startup.
- `doors`: trigger boxes. A door with `{to, spawn}` changes area (if that area is registered). Otherwise it shows its `message` in the dialogue box. A door fires once each time you enter it.
- `background`, `fog`, `center` (the title-screen orbit).
- `enter()` / `exit()` hooks.

**AreaManager.**
- `load(id, spawn)` swaps instantly: it detaches the old root, attaches the new one, sets `game.world`, places Pip, re-lays the party line and snaps the camera.
- `go(id, spawn)` does the same behind a 0.35s fade. Player input is frozen while `areas.busy`.
- It emits `area {id, spawn}`.

**Building areas.** `Batch` bakes boxes, cylinders, spheres and gable roofs into one merged mesh per color, plus one merged outline mesh,
so a whole street is about 40 draw calls. Signs are canvas textures (`signMesh`).

Ground decals (grass, sand, water, roads, paint) are flat planes a few millimetres apart. Each layer gets a
polygon offset (`decalMaterial`) so they don't flicker at a distance. Walkable platforms (the pier) are listed in
`town.raised`, which `getGroundHeight` reads.

Coordinates: +X east, -Z north, y up. Pip's model faces +Z at rotation 0, and `yaw = atan2(dx, dz)`.

## Game modes

`game.mode` is `'explore'` (the default) or `'battle'`. Switch it with `game.setMode(mode)`, which emits `mode { mode }`.

| | explore | battle |
|---|---|---|
| Party | `game.partyTrail` (src/explore/PartyTrail.js) walks Dot and Moose in a single-file line on Pip's path, EarthBound style. When Pip stands still they sidestep so they don't hide him. | `PartyMember.update` (formation + combat AI) |
| Enemies | `EnemyManager.update` not run | `EnemyManager.update` runs |
| Camera | Higher and further back. Swings lazily behind Pip when he runs forward or diagonally, unless the mouse was used recently. | KH orbit + lock-on framing |
| HUD | Command menu + lock-on hidden (`#hud.mode-explore`) | Full combat HUD |

The combat module (combat/, enemies/, party/PartyMember.js) is unchanged. Exploration code lives in `src/explore/` and drives it from outside.
`?mode=battle` in the URL starts in the original endless-wave arena.

## Combatant interface (Player, PartyMember, Enemy)

```js
{
  name: string,
  team: 'hero' | 'enemy',
  object3d: THREE.Object3D,      // root; position is the FEET, faces +Z at rotation.y = 0
  radius: number,                // body radius for hits/collision
  height: number,                // for popup/reticle placement (top of head)
  hp, maxHp,                     // numbers
  alive: boolean,
  invulnerable: boolean,         // e.g. dodge i-frames; Combat ignores hits while true
  status: StatusSet,             // from src/combat/StatusEffects.js
  knockback: THREE.Vector3,      // Combat ADDS impulses; the owner moves by it each frame and damps it (~8/s)
  onHit?(info),                  // optional flinch hook. info = { source, amount, crit }
  onDefeat?(info),               // optional death hook (Combat sets alive=false first)
}
```

## Combat API (`game.combat`)

```js
dealDamage(source, target, amount, { knockback = 4, text = null, crit = false } = {}) -> number dealt
heal(target, amount, text = null)
meleeSweep(attacker, { range, arc, damage, knockback, text, status }) -> Combatant[] hit
     // arc in radians, centered on attacker.object3d facing (+Z rotated by rotation.y)
     // status: { name, duration } applied to each hit target
spawnProjectile({ owner, position, direction, speed, damage, radius = 0.4, color, life = 2,
                  homing = null, status = null, text = null, mesh = null })
areaBlast({ owner, position, radius, damage, knockback, status, text })
applyStatus(target, name, duration)
opponentsOf(combatant) -> alive combatants of the other team
hitstop(seconds)
```
Damage is multiplied by `source.status.attackScale()`.
When hp reaches 0: set `alive = false`, call `onDefeat`, emit `defeat`.

## StatusSet (`src/combat/StatusEffects.js`, named export `StatusSet`)

```js
const s = new StatusSet(owner, events);
s.add(name, duration); s.has(name); s.remove(name); s.update(dt);
s.speedMul();     // 'embarrassed' -> 0.55, else 1
s.attackScale();  // 'embarrassed' -> 0.5,  else 1 (damage AND visual reach of swings)
s.list            // Map<name, remainingSeconds>
```
Embarrassed also turns the owner's face red. `add` emits `status:add`; expiry emits `status:remove`.

## Events (`game.events`)

| name | payload | producer → consumer |
|---|---|---|
| `damage` | `{ source, target, amount, crit, text }` | Combat → HUD popups, Audio |
| `heal` | `{ target, amount, text }` | Combat → HUD |
| `defeat` | `{ target, source }` | Combat → EnemyManager, HUD, Audio |
| `status:add` / `status:remove` | `{ target, name, duration }` | StatusSet → HUD |
| `popup` | `{ text, position: Vector3 \| null, style: 'hit'\|'big'\|'heal'\|'status'\|'info' }` | anyone → HUD |
| `dialogue` | `{ speaker, text, duration = 3.5 }` | anyone → HUD (EarthBound text box) |
| `sfx` | `{ name }` | anyone → Audio |
| `command` | `{ name: 'bash'\|'psi'\|'goods'\|'mom' }` | HUD menu → Player |
| `lock` | `{ target }` (null = released) | Player → HUD, Audio |
| `wave` | `{ index, title }` | EnemyManager → HUD |
| `player:down` / `player:up` | `{}` | Player → HUD |
| `game:start` | `{}` | main.js (first key/click) → HUD hides title, Audio starts music |

SFX names: `swing, hit, smash, jump, dodge, psi, heal, phone, defeat, menu, select, lock, hurt, status, denied, ping, whistle, chomp`.

## Input (`game.input`)

* `input.move` → `{x, y}`, where x is right (+), y is forward (+), and the length is ≤ 1 (WASD / left stick).
* `input.consumeLook()` → `{dx, dy}` in radians since the last call (mouse with pointer lock, or right stick).
* `input.pressed(action)` (this frame) / `input.held(action)`.
* Actions: `jump` (Space / A), `dodge` (Shift / B), `attack` (LMB / J / X), `lock` (Tab / R / MMB / RB),
  `menuUp` (↑ / wheel / dpad), `menuDown` (↓ / wheel / dpad), `menuConfirm` (Enter / E / Y),
  `cmd1..cmd4` (keys 1-4), `start` (any key / click; used by the title screen).
* Clicking the canvas requests pointer lock.

## Shared look (`src/core/materials.js`)

`toon(color)` is a cached 3-band MeshToonMaterial. `basic(color)` is a cached MeshBasicMaterial.
`blobShadow(radius)` is a flat dark circle mesh (we don't use real-time shadow maps).
`outline(mesh, thickness)` adds a back-face inverted-hull child for the chunky EarthBound outline.
Palette lives in `config.PALETTE`.

## Characters (`src/characters/buildKid.js`)

`buildKid(look)` returns `{ root, parts, setBlush(on), update(dt, anim) }` where
`anim = { speed01, grounded, action: null|'attack'|'dodge'|'hurt'|'ko'|'cast'|'cheer', actionT: 0..1, combo: 0|1|2 }`.
`look` comes from `config.HEROES.<id>.look`.

## Performance budget

There are no shadow maps, and we use toon/basic materials only. Pixel ratio is capped at 1.5, and grass/flowers use InstancedMesh.
Target ≤ 150 draw calls and allocate no new objects per frame in hot loops (reuse temp vectors).

## Fields the HUD reads (keep these names)

* `game.player`: `heroId='pip', name, hp, maxHp, mp, maxMp, alive, status, goods` (pizzas left),
  `momCooldown` (seconds remaining, 0 = ready), `momCooldownMax`, `psiCost`, `object3d`, `height`.
* `game.party[i]`: `heroId ('dot'|'moose'), name, hp, maxHp, alive, status, object3d, height`.
* `game.target`: `name, hp, maxHp, alive, object3d, height`.
* `game.enemies.list` holds the alive enemies. `game.enemies.getNearest(pos, maxDist, filter?)` returns one.

## Command ownership

* Bash: the Player reads `input.pressed('attack')` directly. The HUD flashes the Bash row on the `command` event.
* The HUD owns menu navigation (`menuUp/menuDown/menuConfirm`) and hotkeys `cmd1..cmd4`, and emits `command`.
* The Player executes every `command` event and gives feedback (sfx, popup, dialogue), including "can't use" cases.
* Lock-on is owned by the Player (`lock` action). The Player keeps `game.target` valid: it clears the target when it dies or goes out of range, and emits `lock`.

## Sandboxes

Agents may create preview pages under `sandbox/<name>.html` (served by Vite at `/sandbox/<name>.html`) for
isolated testing. They are deleted at integration. Headless screenshots: `node` + `playwright-core` with
`executablePath: '/opt/pw-browsers/chromium'` (or find the binary under /opt/pw-browsers).
A shared Vite dev server runs on http://localhost:5173 during development. Use `node tools/shot.mjs <url> <out.png> [waitMs] [script.js]`
to capture a screenshot plus console errors.
