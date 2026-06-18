# Last Circle

A 3D web-based survival shooter built with Three.js. Survive in a vast open world with 5 unique biomes, fight through 20 waves of enemies, collect weapons and gear, and be the last one standing.

## Game Features

### Core Gameplay
- 20-wave survival mode with rest phases and boss encounters every 5 waves
- 5 distinct biomes (Desert, Snow, Jungle, Swamp, Lava) with unique terrain and hazards
- Parachute landing onto the map
- Day/night cycle with dynamic sky effects
- Shrinking safe zone mechanics

### Weapons & Gear
- 30+ weapons across 6 categories (AR, SMG, Sniper/DMR, Shotgun, Pistol, Melee)
- 6 special apocalypse weapons with unique effects (corrosive spray, arc chain, gravity hammer, blood mist, rift rifle, infection marker)
- Throwables (grenades, flashbangs)
- Equipment system (helmets, armor, scopes — 3 levels each)
- Melee weapons including the legendary Salted Fish (咸鱼)

### Enemies
- **AI Bots** — intelligent opponents that shoot, take cover, and loot
- **Zombies** — clustered horde enemies with melee attacks
- **Aliens** — ranged attackers with advanced targeting
- **Animals** — deer and boars roaming the map
- **Ghosts** — spectral entities
- **Ancient Demon Giant** — massive boss with 5000 HP, visible from anywhere on the map

### Environment
- 5 biomes: Desert, Snow, Jungle, Swamp (poison hazard), Lava (fire hazard)
- Dynamic weather system (sunny, storm, blizzard)
- Lightning strikes, meteor showers, tornadoes, volcanic eruptions
- Rivers with bridges, varied terrain with grass and trees
- Buildings, campfires, destructible objects, explosive barrels
- Vehicles for faster traversal
- Fishing spots, airdrop supply crates

### Technical Features
- Web Audio API synthesized sound effects (no audio files needed)
- Adaptive performance system (auto-adjusts quality based on FPS)
- Spatial optimization for entity visibility
- Bullet physics with tracers and impact effects
- Blood particle system
- Floating health bars on boss
- Mini-map with real-time entity tracking
- Hit direction indicators
- Combat feedback system

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
| E | Interact (open doors, pick up loot, enter vehicle) |
| 1 / 2 | Switch weapons |
| Q | Melee attack |

## Tech Stack
- **Three.js** — 3D rendering
- **Vite** — build tool
- **Web Audio API** — procedural sound synthesis
- **Vanilla JavaScript (ES Modules)** — no framework dependencies

## Browser Requirement
Please use Chrome, Edge, Firefox, or other modern browsers with WebGL support for the best experience.

## License
See [LICENSE](./LICENSE) for details.
