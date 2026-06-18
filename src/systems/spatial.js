// Lightweight spatial buckets for hot per-frame proximity queries.

import { state } from '../state.js';

const CELL_SIZE = 300;
const NEAR_RANGE = 1;

function cellCoord(value) {
  return Math.floor(value / CELL_SIZE);
}

function keyFor(x, z) {
  return `${cellCoord(x)},${cellCoord(z)}`;
}

function clearGrid(grid) {
  grid.clear();
}

function addToGrid(grid, item, x, z) {
  const key = keyFor(x, z);
  let bucket = grid.get(key);
  if (!bucket) {
    bucket = [];
    grid.set(key, bucket);
  }
  bucket.push(item);
}

function queryGrid(grid, x, z, range = NEAR_RANGE) {
  const cx = cellCoord(x);
  const cz = cellCoord(z);
  const result = [];

  for (let dx = -range; dx <= range; dx++) {
    for (let dz = -range; dz <= range; dz++) {
      const bucket = grid.get(`${cx + dx},${cz + dz}`);
      if (bucket) result.push(...bucket);
    }
  }

  return result;
}

const grids = {
  bots: new Map(),
  animals: new Map(),
  doors: new Map(),
  loot: new Map(),
  colliders: new Map(),
  aliens: new Map(),
  allEntities: new Map()
};

let staticBuilt = false;

function buildStaticGrids() {
  clearGrid(grids.doors);
  for (let i = 0; i < state.doors.length; i++) {
    const d = state.doors[i];
    if (!d.doorWorldPos) {
      // Door interaction point is fixed relative to its house, so cache it once.
      d.doorWorldPos = d.housePos.clone();
      d.doorWorldPos.y += 4.75;
      d.doorWorldPos.z += 15;
    }
    addToGrid(grids.doors, d, d.housePos.x, d.housePos.z);
  }

  clearGrid(grids.colliders);
  for (let i = 0; i < state.colliders.length; i++) {
    const box = state.colliders[i];
    const cx = (box.min.x + box.max.x) * 0.5;
    const cz = (box.min.z + box.max.z) * 0.5;
    addToGrid(grids.colliders, box, cx, cz);
  }

  staticBuilt = true;
}

let _rebuildCounter = 0;
export function rebuildSpatialIndex() {
  if (!staticBuilt) buildStaticGrids();
  _rebuildCounter++;
  if (_rebuildCounter % 5 !== 0) return;

  clearGrid(grids.bots);
  clearGrid(grids.allEntities);
  for (let i = 0; i < state.bots.length; i++) {
    const bot = state.bots[i];
    if (!bot.alive || bot.isParachuting) continue;
    const p = bot.mesh.position;
    addToGrid(grids.bots, bot, p.x, p.z);
    addToGrid(grids.allEntities, { pos: p, radius: 2, id: 'bot_' + bot.id }, p.x, p.z);
  }

  clearGrid(grids.animals);
  if (state._allAnimals) {
    for (let i = 0; i < state._allAnimals.length; i++) {
      const animal = state._allAnimals[i];
      if (!animal.alive) continue;
      const p = animal.mesh.position;
      addToGrid(grids.animals, animal, p.x, p.z);
      const isFlying = animal.type === 'eagle' || animal.type === 'hawk' || animal.type === 'owl';
      const isSwimming = animal.type === 'fish';
      if (!isFlying && !isSwimming) {
        const r = 2 * (animal.config.scale || 1);
        addToGrid(grids.allEntities, { pos: p, radius: r, id: 'animal_' + animal.id }, p.x, p.z);
      }
    }
  }

  // Add zombies to entity grid
  if (state.zombies) {
    for (let i = 0; i < state.zombies.length; i++) {
      const zombie = state.zombies[i];
      if (!zombie.alive) continue;
      const p = zombie.mesh.position;
      addToGrid(grids.allEntities, { pos: p, radius: 2, id: 'zombie_' + zombie.id }, p.x, p.z);
    }
  }

  // Add aliens to entity grid
  clearGrid(grids.aliens);
  if (state.aliens) {
    for (let i = 0; i < state.aliens.length; i++) {
      const alien = state.aliens[i];
      if (!alien.alive) continue;
      const p = alien.mesh.position;
      addToGrid(grids.aliens, alien, p.x, p.z);
      addToGrid(grids.allEntities, { pos: p, radius: 1.5, id: 'alien_' + alien.id }, p.x, p.z);
    }
  }

  // Add player to entity grid (so entities can't walk through player)
  if (state.player && state.player.alive && state.controls) {
    const pp = state.controls.getObject().position;
    addToGrid(grids.allEntities, { pos: pp, radius: 1.5, id: 'player' }, pp.x, pp.z);
  }

  clearGrid(grids.loot);
  for (let i = 0; i < state.lootItems.length; i++) {
    const loot = state.lootItems[i];
    if (!loot.mesh) continue;
    const p = loot.mesh.position;
    addToGrid(grids.loot, loot, p.x, p.z);
  }
}

export function resetStaticSpatialIndex() {
  staticBuilt = false;
}

export function getNearbyBots(x, z, range = NEAR_RANGE) {
  return queryGrid(grids.bots, x, z, range);
}

export function getNearbyAnimals(x, z, range = NEAR_RANGE) {
  return queryGrid(grids.animals, x, z, range);
}

export function getNearbyDoors(x, z, range = NEAR_RANGE) {
  return queryGrid(grids.doors, x, z, range);
}

export function getNearbyLoot(x, z, range = NEAR_RANGE) {
  return queryGrid(grids.loot, x, z, range);
}

export function getNearbyColliders(x, z, range = NEAR_RANGE) {
  return queryGrid(grids.colliders, x, z, range);
}

export function getNearbyEntities(x, z, range = NEAR_RANGE) {
  return queryGrid(grids.allEntities, x, z, range);
}

export function getNearbyAliens(x, z, range = NEAR_RANGE) {
  return queryGrid(grids.aliens, x, z, range);
}
