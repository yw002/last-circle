# Last Circle

A 3D web-based battle royale game built with Three.js. Players parachute onto an open map, collect weapons and supplies, fight against AI bots, zombies, aliens, and a colossal ancient giant boss, avoid the shrinking danger zone, and strive to be the last survivor to win the chicken dinner.

## Game Features

### Core Gameplay
- Classic battle royale rules with shrinking safe zone
- Parachute landing onto the map
- Multiple weapons (pistol, AR, sniper, shotgun, melee)
- Loot system (ammo, health packs, scopes, armor, helmets)
- Chicken dinner victory condition (eliminate all bots + defeat the giant boss)

### Enemies
- **AI Bots** — intelligent opponents that shoot, take cover, and loot
- **Zombies** — clustered around houses, melee attackers
- **Aliens** — ranged attackers with raycasting
- **Animals** — deer and boars roaming the map
- **Ghosts** — spectral entities
- **Ancient Demon Giant** — 900-unit tall boss visible from anywhere on the map, 5000 HP, spit attacks, must be killed to win

### Environment
- Dynamic weather system (sunny, storm, blizzard)
- Lightning strikes and meteor showers
- Tornadoes and volcanic eruptions
- Houses with concrete foundations on varied terrain
- Procedurally generated terrain with grass and trees

### Technical Features
- Web Audio API synthesized sound effects (no audio files needed)
- Adaptive performance system (auto-adjusts fog density based on FPS)
- Spatial optimization for entity visibility
- Bullet physics with tracers and impact effects
- Blood particle system
- Floating health bars on boss

## How To Play

### Quick Start (Pre-built)
1. Open `dist/index.html` directly in a modern browser
2. No server or installation required

### Development Mode
```bash
npm install
npm run dev
```

### Build for Production
```bash
npm run build
```
Output will be in the `dist/` directory.

## Controls
| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look / Aim |
| Left Click | Shoot |
| Right Click | ADS (Aim Down Sight) |
| R | Reload |
| Space | Jump |
| Shift | Sprint |
| E | Interact (open doors, pick up loot) |
| 1 / 2 | Switch weapons |
| Q | Melee attack |

## Tech Stack
- **Three.js** — 3D rendering
- **Vite** — build tool
- **Web Audio API** — procedural sound synthesis
- **Vanilla JavaScript** — no framework dependencies

## Browser Requirement
Please use Chrome, Edge, Firefox, or other modern browsers with WebGL support for the best experience.

## License
See [LICENSE](./LICENSE) for details.
