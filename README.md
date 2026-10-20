# Hallway Heroes

A playable 3D action RPG prototype in the browser (Three.js + Vite). You play Pip, a high schooler fighting the
monsters of teen life (Locker Mimics, the Group Chat (99+) and Hall Monitor Hank) in the Maplewood High courtyard,
with AI friends Dot and Moose. Every character, enemy and building is made from code: no external art assets.

## Run it

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173 and press any key or click to start.

## Controls

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move | WASD | Left stick |
| Look | Mouse (click to capture; Esc releases). Right-drag if capture is blocked | Right stick |
| Bash (3-hit combo) | Left click / J | X |
| Jump / Dodge roll | Space / Shift | A / B |
| Lock-on (press again to cycle) | Tab / R / middle click | RB |
| Command menu | ↑↓ or wheel, E/Enter to use | D-pad, Y |
| Quick commands | 1 Bash · 2 PSI · 3 Goods · 4 Call Mom | |
| Mute | M | |

**Commands:** *PSI Zinger* is a homing ranged attack that costs 8 MP. *Goods* eats a Cafeteria Pizza, which heals 50
(you have 3). *Call Mom* fully heals you and cures Embarrassed, then has a 45s cooldown.

**Embarrassed:** caused by the Group Chat's cringe messages and Hank's whistle. It slows you down and shrinks your attacks
until it wears off.

## Project layout

See [ARCHITECTURE.md](ARCHITECTURE.md) for the system contracts. In short:

- `src/core`: config/tuning, input, event bus, shared toon materials
- `src/characters`: the big-head kid model and procedural animation
- `src/world`: the courtyard, colliders and spawns
- `src/player`, `src/camera`: the controller, combo, commands, lock-on, and the third-person camera
- `src/combat`, `src/enemies`: damage, projectiles, the Embarrassed status, the three enemies and waves
- `src/party`: the Dot and Moose AI
- `src/ui`, `src/audio`: the KH-style HUD, command menu, EarthBound-style popups and dialogue, and WebAudio synth SFX and music

`node tools/playtest.mjs` (with the dev server running) drives the game headlessly and saves screenshots.
