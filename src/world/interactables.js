// Interactive world elements: campfires, explosive barrels, fishing spots

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { getBiomeAt, BIOME } from '../world/biomes.js';
import { registerStaticObject } from '../systems/staticVisibility.js';
import { spawnLoot } from '../world/loot.js';
import { playSound } from '../systems/audio.js';
import { showNotice } from '../ui/notices.js';

// Shared resources
const campfireLogGeo = new THREE.CylinderGeometry(0.5, 0.5, 4, 6);
const campfireLogMat = new THREE.MeshLambertMaterial({ color: 0x4A2F1D });
const barrelGeo = new THREE.CylinderGeometry(2, 2, 4, 12);
const barrelMat = new THREE.MeshLambertMaterial({ color: 0xCC0000 });
const barrelBandGeo = new THREE.CylinderGeometry(2.1, 2.1, 0.3, 12);
const barrelBandMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
const rippleGeo = new THREE.RingGeometry(1, 3, 12);
const rippleMat = new THREE.MeshBasicMaterial({ color: 0x4488FF, transparent: true, opacity: 0.5, side: THREE.DoubleSide });

// Fire particle system shared across all campfires — one Points object, per-campfire ranges.
let fireParticles = null;
const FIRE_PARTICLES_PER_CAMPFIRE = 24;
let fireParticleData = null; // Float32Array, written each frame

function ensureFireSystem() {
  if (fireParticles) return;
  const total = state.campfires.length * FIRE_PARTICLES_PER_CAMPFIRE;
  if (total === 0) return;
  const positions = new Float32Array(total * 3);
  fireParticleData = new Float32Array(total * 3); // (life, life0, baseY) packed... actually we store life/maxLife/seed
  const fireGeo = new THREE.BufferGeometry();
  fireGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const fireMat = new THREE.PointsMaterial({
    color: 0xFF6600,
    size: 1.6,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  fireParticles = new THREE.Points(fireGeo, fireMat);
  state.scene.add(fireParticles);
  // Initialize per-particle lifetime/seed
  for (let i = 0; i < total; i++) {
    fireParticleData[i * 3] = Math.random() * 1.2;     // life
    fireParticleData[i * 3 + 1] = 1.0 + Math.random() * 0.6; // maxLife
    fireParticleData[i * 3 + 2] = Math.random() * Math.PI * 2; // seed
  }
}

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

  // Point light (the fire itself is rendered by the shared Points system)
  const light = new THREE.PointLight(0xFF6600, 2, 30);
  light.position.y = 3;
  group.add(light);

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 800);

  state.campfires.push({
    position: new THREE.Vector3(x, y, z),
    light,
    group,
    fireParticleStart: state.campfires.length * FIRE_PARTICLES_PER_CAMPFIRE,
  });
}

function createBarrel(x, y, z) {
  const group = new THREE.Group();

  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.y = 2;
  // Barrel index is stamped on userData so raycasts can find the entry in state.barrels.
  const barrelIndex = state.barrels.length;
  barrel.userData = { isBarrel: true, impactMaterial: 'metal', barrelIndex };
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
    exploded: false,
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
    cooldownEndsAt: 0, // performance.now() ms
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

  ensureFireSystem();
}

// === Fishing state ===
// Press E near a fishing spot, wait FISH_DURATION seconds, then receive +50 HP and a random reward.
const FISH_DURATION = 2.0;
const FISH_RANGE_SQ = 8 * 8;
let fishingSession = null; // { spotIndex, elapsed }

export function tryStartFishing(playerPos) {
  if (fishingSession) return false;
  const spots = state.fishingSpots;
  const now = performance.now();
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    if (now < s.cooldownEndsAt) continue;
    const dx = playerPos.x - s.position.x;
    const dz = playerPos.z - s.position.z;
    if (dx * dx + dz * dz <= FISH_RANGE_SQ) {
      fishingSession = { spotIndex: i, elapsed: 0 };
      showNotice('开始钓鱼…', '#88ccff');
      return true;
    }
  }
  return false;
}

function finishFishing() {
  if (!fishingSession) return;
  const spot = state.fishingSpots[fishingSession.spotIndex];
  spot.cooldownEndsAt = performance.now() + 8000; // 8s cooldown per spot

  // Heal +50, capped to maxHealth.
  const healed = Math.min(50, state.player.maxHealth - state.player.health);
  state.player.health = Math.min(state.player.maxHealth, state.player.health + 50);

  // Random reward: spawn 1 loot at the player's feet (so they can pick it up).
  const player = state.controls.getObject().position;
  spawnLoot(player.x + (Math.random() - 0.5) * 2, getTerrainHeight(player.x, player.z), player.z + (Math.random() - 0.5) * 2);

  showNotice(`钓到了一条鱼！+${healed} HP`, '#7fff7f');
  fishingSession = null;
}

export function isFishing() { return !!fishingSession; }

export function updateInteractables(delta) {
  const playerPos = state.controls ? state.controls.getObject().position : null;
  if (!playerPos) return;

  // Campfire heal + light flicker
  const nowMs = performance.now();
  for (let i = 0; i < state.campfires.length; i++) {
    const cf = state.campfires[i];
    cf.light.intensity = 1.5 + Math.random() * 1;

    // Heal player within radius 20
    const dx = playerPos.x - cf.position.x;
    const dz = playerPos.z - cf.position.z;
    if (dx * dx + dz * dz < 400) {
      state.player.health = Math.min(state.player.maxHealth, state.player.health + 10 * delta);
    }
  }

  // Fire particle simulation — additive points rising from each campfire base.
  if (fireParticles && fireParticleData) {
    const positions = fireParticles.geometry.attributes.position.array;
    for (let c = 0; c < state.campfires.length; c++) {
      const cf = state.campfires[c];
      const start = cf.fireParticleStart;
      for (let p = 0; p < FIRE_PARTICLES_PER_CAMPFIRE; p++) {
        const idx = start + p;
        const dataIdx = idx * 3;
        let life = fireParticleData[dataIdx];
        const maxLife = fireParticleData[dataIdx + 1];
        const seed = fireParticleData[dataIdx + 2];
        life += delta;
        if (life >= maxLife) {
          // respawn at base
          life = 0;
          positions[idx * 3] = cf.position.x + (Math.random() - 0.5) * 1.2;
          positions[idx * 3 + 1] = cf.position.y + 0.6;
          positions[idx * 3 + 2] = cf.position.z + (Math.random() - 0.5) * 1.2;
          fireParticleData[dataIdx + 1] = 1.0 + Math.random() * 0.6;
          fireParticleData[dataIdx + 2] = Math.random() * Math.PI * 2;
        } else {
          // rise + jitter
          const t = life / maxLife;
          positions[idx * 3] += Math.sin(seed + nowMs * 0.005) * delta * 0.6;
          positions[idx * 3 + 1] += (3.5 - t * 1.5) * delta;
          positions[idx * 3 + 2] += Math.cos(seed + nowMs * 0.005) * delta * 0.6;
        }
        fireParticleData[dataIdx] = life;
      }
    }
    fireParticles.geometry.attributes.position.needsUpdate = true;
  }

  // Fishing tick
  if (fishingSession) {
    fishingSession.elapsed += delta;
    // Cancel if player walked away from the spot.
    const spot = state.fishingSpots[fishingSession.spotIndex];
    const dx = playerPos.x - spot.position.x;
    const dz = playerPos.z - spot.position.z;
    if (dx * dx + dz * dz > FISH_RANGE_SQ * 4) {
      showNotice('钓鱼中断', '#ff8888');
      fishingSession = null;
    } else if (fishingSession.elapsed >= FISH_DURATION) {
      finishFishing();
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

  // Audio
  playSound('explosion', barrel.position);

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

  // Damage nearby entities
  const explosionRadius = 25;
  const explosionRadiusSq = explosionRadius * explosionRadius;
  const damage = 80;

  if (state.player.alive) {
    const dx = state.controls.getObject().position.x - barrel.position.x;
    const dz = state.controls.getObject().position.z - barrel.position.z;
    if (dx * dx + dz * dz < explosionRadiusSq) {
      state.player.health -= damage;
      if (state.player.health <= 0) state.player.health = 0;
    }
  }

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
