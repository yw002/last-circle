// Destructible objects: wooden crates, fences

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { getBiomeAt, BIOME } from '../world/biomes.js';
import { registerStaticObject } from '../systems/staticVisibility.js';
import { spawnLoot } from '../world/loot.js';

// Shared resources
const crateGeo = new THREE.BoxGeometry(3, 3, 3);
const crateMat = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
const fenceGeo = new THREE.BoxGeometry(0.5, 3, 6);
const fenceMat = new THREE.MeshLambertMaterial({ color: 0x5C3A1E });

export function initDestructibles() {
  // Wooden crates (100)
  let placed = 0;
  for (let i = 0; i < 500 && placed < 100; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const y = getTerrainHeight(x, z);
    if (y < 2) continue;

    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.set(x, y + 1.5, z);
    crate.rotation.y = Math.random() * Math.PI;
    crate.userData = { isDestructible: true, impactMaterial: 'wood', destructibleIndex: state.destructibles.length };
    state.scene.add(crate);
    registerStaticObject(crate, x, z, 600);
    state.objects.push(crate);

    state.destructibles.push({
      mesh: crate,
      health: 30,
      type: 'crate',
      destroyed: false,
      lootDropped: false,
      position: new THREE.Vector3(x, y, z),
    });
    placed++;
  }

  // Fences (200) — concentrate around farm + military anchors when available; sprinkle the rest in habitable biomes.
  const anchors = state.fenceClusterAnchors || [];
  const FENCES_PER_ANCHOR = anchors.length > 0 ? Math.floor(160 / anchors.length) : 0;
  let fencesPlaced = 0;

  // 1) Cluster ~80% of fences around anchor buildings.
  for (const anchor of anchors) {
    if (fencesPlaced >= 200) break;
    let clusterPlaced = 0;
    for (let attempt = 0; attempt < 60 && clusterPlaced < FENCES_PER_ANCHOR && fencesPlaced < 200; attempt++) {
      // Random ring 25..70 units around the anchor.
      const angle = Math.random() * Math.PI * 2;
      const radius = 25 + Math.random() * 45;
      const x = anchor.x + Math.cos(angle) * radius;
      const z = anchor.z + Math.sin(angle) * radius;
      if (Math.abs(x) > MAP_SIZE * 0.45 || Math.abs(z) > MAP_SIZE * 0.45) continue;
      const y = getTerrainHeight(x, z);
      if (y < 2 || y > 35) continue;
      pushFence(x, y, z, angle); // align fence tangentially around the anchor
      clusterPlaced++;
      fencesPlaced++;
    }
  }

  // 2) Fill the remaining fences with random placements in non-extreme biomes.
  for (let i = 0; i < 800 && fencesPlaced < 200; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const y = getTerrainHeight(x, z);
    if (y < 3 || y > 30) continue;
    const biome = getBiomeAt(x, z);
    if (biome === BIOME.DESERT || biome === BIOME.LAVA || biome === BIOME.SWAMP) continue;
    pushFence(x, y, z, Math.random() * Math.PI);
    fencesPlaced++;
  }
}

function pushFence(x, y, z, yaw) {
  const fence = new THREE.Mesh(fenceGeo, fenceMat);
  fence.position.set(x, y + 1.5, z);
  fence.rotation.y = yaw;
  fence.userData = { isDestructible: true, impactMaterial: 'wood', destructibleIndex: state.destructibles.length };
  state.scene.add(fence);
  registerStaticObject(fence, x, z, 500);
  state.objects.push(fence);

  state.destructibles.push({
    mesh: fence,
    health: 15,
    type: 'fence',
    destroyed: false,
    lootDropped: false,
    position: new THREE.Vector3(x, y, z),
  });
}

export function updateDestructibles(delta) {
  for (let i = state.destructibles.length - 1; i >= 0; i--) {
    const d = state.destructibles[i];
    if (!d.destroyed) continue;

    // Drop loot once when the crate is first destroyed (fences leave nothing).
    if (!d.lootDropped) {
      d.lootDropped = true;
      if (d.type === 'crate') {
        // 1-2 loot drops per crate (ammo / medkits / weapons).
        spawnLoot(d.position.x, d.position.y, d.position.z);
        if (Math.random() < 0.4) {
          spawnLoot(d.position.x + 1, d.position.y, d.position.z + 1);
        }
      }
    }

    // Shrink animation
    if (d.mesh) {
      d.mesh.scale.multiplyScalar(0.85);
      d.mesh.position.y -= delta * 5;
      if (d.mesh.scale.x < 0.1) {
        state.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        d.mesh = null;
      }
    }
  }
}

/**
 * Damage a destructible object
 */
export function damageDestructible(index, damage) {
  const d = state.destructibles[index];
  if (!d || d.destroyed) return;

  d.health -= damage;
  if (d.health <= 0) {
    d.destroyed = true;
  }
}
