// Destructible objects: wooden crates, fences

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { getBiomeAt, BIOME } from '../world/biomes.js';
import { registerStaticObject } from '../systems/staticVisibility.js';

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
      position: new THREE.Vector3(x, y, z)
    });
    placed++;
  }

  // Fences (200)
  placed = 0;
  for (let i = 0; i < 500 && placed < 200; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const y = getTerrainHeight(x, z);
    if (y < 3 || y > 30) continue;
    const biome = getBiomeAt(x, z);
    if (biome === BIOME.DESERT || biome === BIOME.LAVA || biome === BIOME.SWAMP) continue;

    const fence = new THREE.Mesh(fenceGeo, fenceMat);
    fence.position.set(x, y + 1.5, z);
    fence.rotation.y = Math.random() * Math.PI;
    fence.userData = { isDestructible: true, impactMaterial: 'wood', destructibleIndex: state.destructibles.length };
    state.scene.add(fence);
    registerStaticObject(fence, x, z, 500);
    state.objects.push(fence);

    state.destructibles.push({
      mesh: fence,
      health: 15,
      type: 'fence',
      destroyed: false,
      position: new THREE.Vector3(x, y, z)
    });
    placed++;
  }
}

export function updateDestructibles(delta) {
  // Process destruction animations
  for (let i = state.destructibles.length - 1; i >= 0; i--) {
    const d = state.destructibles[i];
    if (!d.destroyed) continue;

    // Shrink animation
    d.mesh.scale.multiplyScalar(0.85);
    d.mesh.position.y -= delta * 5;

    if (d.mesh.scale.x < 0.1) {
      state.scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      // Mark as fully removed
      d.mesh = null;
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
