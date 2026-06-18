// Interactive world elements: campfires, explosive barrels, fishing spots

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { getBiomeAt, BIOME } from '../world/biomes.js';
import { registerStaticObject } from '../systems/staticVisibility.js';

// Shared resources
const campfireLogGeo = new THREE.CylinderGeometry(0.5, 0.5, 4, 6);
const campfireLogMat = new THREE.MeshLambertMaterial({ color: 0x4A2F1D });
const barrelGeo = new THREE.CylinderGeometry(2, 2, 4, 12);
const barrelMat = new THREE.MeshLambertMaterial({ color: 0xCC0000 });
const barrelBandGeo = new THREE.CylinderGeometry(2.1, 2.1, 0.3, 12);
const barrelBandMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
const rippleGeo = new THREE.RingGeometry(1, 3, 12);
const rippleMat = new THREE.MeshBasicMaterial({ color: 0x4488FF, transparent: true, opacity: 0.5, side: THREE.DoubleSide });

function createCampfire(x, y, z) {
  const group = new THREE.Group();

  // Log ring
  for (let i = 0; i < 5; i++) {
    const log = new THREE.Mesh(campfireLogGeo, campfireLogMat);
    const angle = (i / 5) * Math.PI * 2;
    log.position.set(Math.cos(angle) * 1.5, 0.3, Math.sin(angle) * 1.5);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = angle;
    group.add(log);
  }

  // Fire particles (simple cone)
  const fireGeo = new THREE.ConeGeometry(1, 4, 6);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xFF6600, transparent: true, opacity: 0.7 });
  const fire = new THREE.Mesh(fireGeo, fireMat);
  fire.position.y = 2;
  group.add(fire);

  // Point light
  const light = new THREE.PointLight(0xFF6600, 2, 30);
  light.position.y = 3;
  group.add(light);

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 800);

  state.campfires.push({
    position: new THREE.Vector3(x, y, z),
    light,
    fire,
    group
  });
}

function createBarrel(x, y, z) {
  const group = new THREE.Group();

  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.y = 2;
  barrel.userData = { isBarrel: true, impactMaterial: 'metal' };
  group.add(barrel);

  // Metal bands
  const band1 = new THREE.Mesh(barrelBandGeo, barrelBandMat);
  band1.position.y = 1;
  group.add(band1);
  const band2 = new THREE.Mesh(barrelBandGeo, barrelBandMat);
  band2.position.y = 3;
  group.add(band2);

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 600);

  // Collider
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 2, z),
    new THREE.Vector3(4, 4, 4)
  );
  box.userData = { kind: 'barrel', standable: false };
  state.colliders.push(box);
  state.objects.push(barrel); // for raycast

  state.barrels.push({
    position: new THREE.Vector3(x, y, z),
    mesh: group,
    health: 50,
    exploded: false
  });
}

function createFishingSpot(x, y, z) {
  const ripple = new THREE.Mesh(rippleGeo, rippleMat);
  ripple.position.set(x, y + 0.2, z);
  ripple.rotation.x = -Math.PI / 2;
  state.scene.add(ripple);
  registerStaticObject(ripple, x, z, 400);

  state.fishingSpots.push({
    position: new THREE.Vector3(x, y, z),
    mesh: ripple,
    active: true,
    cooldown: 0
  });
}

export function initInteractables() {
  // Campfires (30)
  let placed = 0;
  for (let i = 0; i < 300 && placed < 30; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const y = getTerrainHeight(x, z);
    if (y < 3 || y > 40) continue;
    const biome = getBiomeAt(x, z);
    if (biome === BIOME.LAVA) continue;
    createCampfire(x, y, z);
    placed++;
  }

  // Explosive barrels (80)
  placed = 0;
  for (let i = 0; i < 500 && placed < 80; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const y = getTerrainHeight(x, z);
    if (y < 2) continue;
    createBarrel(x, y, z);
    placed++;
  }

  // Fishing spots (20)
  placed = 0;
  for (let i = 0; i < 200 && placed < 20; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y > 3 || y < -5) continue; // near water level
    createFishingSpot(x, y, z);
    placed++;
  }
}

export function updateInteractables(delta) {
  const playerPos = state.controls ? state.controls.getObject().position : null;
  if (!playerPos) return;

  // Campfire fire flicker + healing
  for (let i = 0; i < state.campfires.length; i++) {
    const cf = state.campfires[i];
    if (!cf.fire || !cf.fire.visible) continue;

    // Flicker
    const flicker = 0.9 + Math.sin(performance.now() * 0.01 + i) * 0.1;
    cf.fire.scale.set(flicker, 0.8 + Math.random() * 0.4, flicker);
    cf.light.intensity = 1.5 + Math.random() * 1;

    // Heal player within range
    const dx = playerPos.x - cf.position.x;
    const dz = playerPos.z - cf.position.z;
    if (dx * dx + dz * dz < 400) { // 20 unit radius
      state.player.health = Math.min(state.player.maxHealth, state.player.health + 10 * delta);
    }
  }
}

/**
 * Explode a barrel at given index, with chain reaction
 */
export function explodeBarrel(barrelIndex, sourcePos) {
  const barrel = state.barrels[barrelIndex];
  if (!barrel || barrel.exploded) return;

  barrel.exploded = true;
  barrel.mesh.visible = false;

  // Visual explosion effect
  const explosionGeo = new THREE.SphereGeometry(5, 8, 8);
  const explosionMat = new THREE.MeshBasicMaterial({ color: 0xFF4400, transparent: true, opacity: 0.8 });
  const explosion = new THREE.Mesh(explosionGeo, explosionMat);
  explosion.position.copy(barrel.position);
  explosion.position.y += 3;
  state.scene.add(explosion);

  // Scale up and fade
  let scale = 1;
  const expandInterval = setInterval(() => {
    scale += 0.5;
    explosion.scale.set(scale, scale, scale);
    explosion.material.opacity -= 0.1;
    if (explosion.material.opacity <= 0) {
      clearInterval(expandInterval);
      state.scene.remove(explosion);
      explosion.geometry.dispose();
    }
  }, 50);

  // Damage nearby entities (bots, player, zombies)
  const explosionRadius = 25;
  const explosionRadiusSq = explosionRadius * explosionRadius;
  const damage = 80;

  // Damage player
  if (state.player.alive) {
    const dx = state.controls.getObject().position.x - barrel.position.x;
    const dz = state.controls.getObject().position.z - barrel.position.z;
    if (dx * dx + dz * dz < explosionRadiusSq) {
      state.player.health -= damage;
      if (state.player.health <= 0) state.player.health = 0;
    }
  }

  // Damage bots
  for (const bot of state.bots) {
    if (!bot.alive) continue;
    const dx = bot.position.x - barrel.position.x;
    const dz = bot.position.z - barrel.position.z;
    if (dx * dx + dz * dz < explosionRadiusSq) {
      bot.health -= damage;
      if (bot.health <= 0) bot.alive = false;
    }
  }

  // Chain reaction: explode nearby barrels after 100ms delay
  setTimeout(() => {
    for (let i = 0; i < state.barrels.length; i++) {
      if (state.barrels[i].exploded) continue;
      const dx = state.barrels[i].position.x - barrel.position.x;
      const dz = state.barrels[i].position.z - barrel.position.z;
      if (dx * dx + dz * dz < explosionRadiusSq) {
        explodeBarrel(i, barrel.position);
      }
    }
  }, 100);
}
