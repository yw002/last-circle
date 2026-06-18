// Biome system: Voronoi-based biome assignment with smooth blending
// Provides O(1) biome lookup via pre-computed grid

import { MAP_SIZE } from '../config.js';
import { state } from '../state.js';

const GRID_RES = 600; // 600x600 grid = 10 units per cell
const CELL_SIZE = MAP_SIZE / GRID_RES;

// Voronoi seed points - manually placed to ensure good distribution
const SEEDS = [
  { x: -1500, z: -1500, id: 0 }, // DESERT - southwest
  { x:  1500, z: -1500, id: 1 }, // SNOW   - southeast
  { x:     0, z:  1800, id: 2 }, // JUNGLE - north center
  { x: -1800, z:  1200, id: 3 }, // SWAMP  - northwest
  { x:  1800, z:  1200, id: 4 }, // LAVA   - northeast
];

// Biome terrain color lookup (used by terrain vertex colors)
const BIOME_COLORS = {
  0: { low: 0xA0926B, mid: 0xC2B280, high: 0xD4C494 }, // Desert: dark sand → sand → light sand
  1: { low: 0xB0C4DE, mid: 0xE8E8F0, high: 0xF0F0F8 }, // Snow: ice blue → white → bright white
  2: { low: 0x0D3B0D, mid: 0x1B5E20, high: 0x2E7D32 }, // Jungle: deep dark → deep green → forest
  3: { low: 0x2F3B1A, mid: 0x4A5D23, high: 0x5A6D33 }, // Swamp: murky → green-brown → olive
  4: { low: 0xFF4500, mid: 0x2C2C2C, high: 0x3A3A3A }, // Lava: glowing lava → obsidian → dark rock
};

/**
 * Initialize the biome lookup grid. Must be called before any other world generation.
 */
export function initBiomeMap() {
  const map = new Uint8Array(GRID_RES * GRID_RES);

  for (let gz = 0; gz < GRID_RES; gz++) {
    for (let gx = 0; gx < GRID_RES; gx++) {
      const wx = -MAP_SIZE / 2 + (gx + 0.5) * CELL_SIZE;
      const wz = -MAP_SIZE / 2 + (gz + 0.5) * CELL_SIZE;

      let minDist = Infinity;
      let biomeId = 0;

      for (let i = 0; i < SEEDS.length; i++) {
        const dx = wx - SEEDS[i].x;
        const dz = wz - SEEDS[i].z;
        const dist = dx * dx + dz * dz;
        if (dist < minDist) {
          minDist = dist;
          biomeId = SEEDS[i].id;
        }
      }

      // Add noise perturbation for organic boundaries (not straight Voronoi lines)
      const noise = Math.sin(wx * 0.003) * Math.cos(wz * 0.003) * 80000
                   + Math.sin(wx * 0.007 + wz * 0.005) * 40000;
      if (noise > 20000) {
        // Find second-closest seed for noise-based swapping at boundaries
        let secondDist = Infinity;
        let secondId = biomeId;
        for (let i = 0; i < SEEDS.length; i++) {
          if (SEEDS[i].id === biomeId) continue;
          const dx = wx - SEEDS[i].x;
          const dz = wz - SEEDS[i].z;
          const dist = dx * dx + dz * dz;
          if (dist < secondDist) {
            secondDist = dist;
            secondId = SEEDS[i].id;
          }
        }
        if (secondDist - minDist < noise * 4) {
          biomeId = secondId;
        }
      }

      map[gz * GRID_RES + gx] = biomeId;
    }
  }

  state.biomeMap = map;
}

/**
 * O(1) biome lookup at world coordinates.
 * Returns biome ID: 0=Desert, 1=Snow, 2=Jungle, 3=Swamp, 4=Lava
 */
export function getBiomeAt(x, z) {
  if (!state.biomeMap) return 0;
  const gx = Math.floor((x + MAP_SIZE / 2) / CELL_SIZE);
  const gz = Math.floor((z + MAP_SIZE / 2) / CELL_SIZE);
  if (gx < 0 || gx >= GRID_RES || gz < 0 || gz >= GRID_RES) return 0;
  return state.biomeMap[gz * GRID_RES + gx];
}

/**
 * Returns blend info for smooth biome transitions.
 * { biomeA, biomeB, t } where t=0 means fully biomeA, t=1 means fully biomeB.
 * Returns t=0 when not in a transition zone.
 */
export function getBiomeBlendFactor(x, z) {
  if (!state.biomeMap) return { biomeA: 0, biomeB: 0, t: 0 };

  const gx = Math.floor((x + MAP_SIZE / 2) / CELL_SIZE);
  const gz = Math.floor((z + MAP_SIZE / 2) / CELL_SIZE);
  if (gx < 1 || gx >= GRID_RES - 1 || gz < 1 || gz >= GRID_RES - 1) {
    return { biomeA: 0, biomeB: 0, t: 0 };
  }

  const biomeA = state.biomeMap[gz * GRID_RES + gx];

  // Sample 4 neighbors
  const neighbors = [
    state.biomeMap[(gz - 1) * GRID_RES + gx],
    state.biomeMap[(gz + 1) * GRID_RES + gx],
    state.biomeMap[gz * GRID_RES + (gx - 1)],
    state.biomeMap[gz * GRID_RES + (gx + 1)],
  ];

  // Count how many neighbors differ from center
  let differentBiome = -1;
  let diffCount = 0;
  for (let i = 0; i < 4; i++) {
    if (neighbors[i] !== biomeA) {
      differentBiome = neighbors[i];
      diffCount++;
    }
  }

  if (diffCount === 0 || differentBiome === -1) {
    return { biomeA, biomeB: biomeA, t: 0 };
  }

  // Calculate blend factor based on position within cell
  // Use fractional position to determine how close we are to the boundary
  const fracX = ((x + MAP_SIZE / 2) % CELL_SIZE) / CELL_SIZE;
  const fracZ = ((z + MAP_SIZE / 2) % CELL_SIZE) / CELL_SIZE;

  // Blend zone extends ~20 cells (200 units) from boundary
  const blendCells = 20;
  let t = 0;

  // Find direction of different biome
  const isDiffUp = neighbors[0] !== biomeA;
  const isDiffDown = neighbors[1] !== biomeA;
  const isDiffLeft = neighbors[2] !== biomeA;
  const isDiffRight = neighbors[3] !== biomeA;

  if (isDiffDown && fracZ > (1 - blendCells / GRID_RES)) {
    t = (fracZ - (1 - blendCells / GRID_RES)) / (blendCells / GRID_RES);
  } else if (isDiffUp && fracZ < blendCells / GRID_RES) {
    t = 1 - fracZ / (blendCells / GRID_RES);
  } else if (isDiffRight && fracX > (1 - blendCells / GRID_RES)) {
    t = (fracX - (1 - blendCells / GRID_RES)) / (blendCells / GRID_RES);
  } else if (isDiffLeft && fracX < blendCells / GRID_RES) {
    t = 1 - fracX / (blendCells / GRID_RES);
  }

  return { biomeA, biomeB: differentBiome, t: Math.max(0, Math.min(1, t)) };
}

/**
 * Get terrain color for a biome at a given height.
 */
export function getBiomeColor(biomeId, height) {
  const colors = BIOME_COLORS[biomeId] || BIOME_COLORS[0];
  if (height < 5) return colors.low;
  if (height < 25) return colors.mid;
  return colors.high;
}

/**
 * Check if a position is in a specific biome (convenience function).
 */
export function isInBiome(x, z, biomeId) {
  return getBiomeAt(x, z) === biomeId;
}

// Biome IDs for external use
export const BIOME = {
  DESERT: 0,
  SNOW: 1,
  JUNGLE: 2,
  SWAMP: 3,
  LAVA: 4,
};
