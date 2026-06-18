// Lava biome: obsidian terrain, lava rivers, smoke particles, rock pillars

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getBiomeAt, BIOME } from './biomes.js';
import { getTerrainHeight } from './terrain.js';
import { registerStaticObject } from '../systems/staticVisibility.js';

// Shared resources
const lavaMat = new THREE.MeshBasicMaterial({ color: 0xFF4500, transparent: true, opacity: 0.9 });
const lavaGlowMat = new THREE.MeshBasicMaterial({ color: 0xFF6600, transparent: true, opacity: 0.5 });
const rockPillarGeo = new THREE.CylinderGeometry(2, 4, 20, 6);
const rockPillarMat = new THREE.MeshLambertMaterial({ color: 0x2C2C2C });
const rockPillarTallGeo = new THREE.CylinderGeometry(1.5, 5, 35, 6);
const obsidianGeo = new THREE.DodecahedronGeometry(3, 1);
const obsidianMat = new THREE.MeshLambertMaterial({ color: 0x1A1A1A });

// Smoke particle system (one shared Points object)
let smokeParticles = null;
const SMOKE_COUNT = 2000;
const smokePositions = new Float32Array(SMOKE_COUNT * 3);
const smokeVelocities = new Float32Array(SMOKE_COUNT * 3);
const smokeLifetimes = new Float32Array(SMOKE_COUNT);

function createLavaRiver(x, y, z) {
  // Create a lava river segment
  const length = 30 + Math.random() * 60;
  const width = 4 + Math.random() * 6;
  const geo = new THREE.PlaneGeometry(width, length);
  const mesh = new THREE.Mesh(geo, lavaMat);
  mesh.position.set(x, y + 0.1, z);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = Math.random() * Math.PI;
  state.scene.add(mesh);
  registerStaticObject(mesh, x, z, 1000);

  // Glow halo above lava
  const glowGeo = new THREE.PlaneGeometry(width + 4, length + 4);
  const glow = new THREE.Mesh(glowGeo, lavaGlowMat);
  glow.position.set(x, y + 0.2, z);
  glow.rotation.x = -Math.PI / 2;
  glow.rotation.z = mesh.rotation.z;
  state.scene.add(glow);
  registerStaticObject(glow, x, z, 800);

  // Point light for lava glow
  const light = new THREE.PointLight(0xFF4500, 2, 40);
  light.position.set(x, y + 5, z);
  state.scene.add(light);

  // Lava damage zone collider — standable but tagged for fire damage.
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 0.1, z),
    new THREE.Vector3(width, 0.4, length)
  );
  box.userData = { kind: 'lava_river', standable: true, soft: true, damagePerSec: 15 };
  state.colliders.push(box);
}

function createRockPillar(x, y, z) {
  const isTall = Math.random() > 0.6;
  const geo = isTall ? rockPillarTallGeo : rockPillarGeo;
  const mesh = new THREE.Mesh(geo, rockPillarMat);
  const height = isTall ? 17.5 : 10;
  mesh.position.set(x, y + height, z);
  mesh.rotation.z = (Math.random() - 0.5) * 0.2;
  mesh.rotation.x = (Math.random() - 0.5) * 0.1;
  mesh.userData.impactMaterial = 'stone';
  state.scene.add(mesh);
  registerStaticObject(mesh, x, z, 1000);

  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + height, z),
    new THREE.Vector3(isTall ? 8 : 6, isTall ? 35 : 20, isTall ? 8 : 6)
  );
  box.userData = { kind: 'rock', standable: false };
  state.colliders.push(box);
}

function createObsidianRock(x, y, z) {
  const mesh = new THREE.Mesh(obsidianGeo, obsidianMat);
  mesh.position.set(x, y + 2, z);
  const sx = 1 + Math.random() * 2;
  const sy = 0.5 + Math.random();
  const sz = 1 + Math.random() * 2;
  mesh.scale.set(sx, sy, sz);
  mesh.rotation.y = Math.random() * Math.PI;
  mesh.userData.impactMaterial = 'stone';
  state.scene.add(mesh);
  registerStaticObject(mesh, x, z, 600);
  state.objects.push(mesh);
  // Obsidian as a hard collider — standard rock obstacle.
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 2, z),
    new THREE.Vector3(6 * sx, 4 * sy, 6 * sz)
  );
  box.userData = { kind: 'obsidian', standable: false };
  state.colliders.push(box);
}

function initSmokeSystem() {
  const smokeMat = new THREE.PointsMaterial({
    color: 0x888888,
    size: 4,
    transparent: true,
    opacity: 0.3,
    depthWrite: false
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));

  smokeParticles = new THREE.Points(geo, smokeMat);
  state.scene.add(smokeParticles);

  // Initialize particles scattered around lava biome
  for (let i = 0; i < SMOKE_COUNT; i++) {
    resetSmokeParticle(i);
  }
}

function resetSmokeParticle(i) {
  const x = (Math.random() - 0.5) * MAP_SIZE * 0.85;
  const z = (Math.random() - 0.5) * MAP_SIZE * 0.85;
  if (getBiomeAt(x, z) !== BIOME.LAVA) {
    // Put inactive particles far away
    smokePositions[i * 3] = 99999;
    smokePositions[i * 3 + 1] = 99999;
    smokePositions[i * 3 + 2] = 99999;
    smokeLifetimes[i] = 0;
    return;
  }

  const y = getTerrainHeight(x, z);
  smokePositions[i * 3] = x;
  smokePositions[i * 3 + 1] = y + Math.random() * 30;
  smokePositions[i * 3 + 2] = z;
  smokeVelocities[i * 3] = (Math.random() - 0.5) * 2;
  smokeVelocities[i * 3 + 1] = 5 + Math.random() * 10;
  smokeVelocities[i * 3 + 2] = (Math.random() - 0.5) * 2;
  smokeLifetimes[i] = 2 + Math.random() * 4;
}

export function initBiomeLavaVegetation() {
  let riverCount = 0, pillarCount = 0, rockCount = 0;
  const maxAttempts = 3000;

  for (let i = 0; i < maxAttempts && (riverCount < 5 || pillarCount < 80 || rockCount < 60); i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.85;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.85;
    if (getBiomeAt(x, z) !== BIOME.LAVA) continue;

    const y = getTerrainHeight(x, z);
    if (y < 0) continue;

    if (riverCount < 5 && Math.random() < 0.02) {
      createLavaRiver(x, y, z);
      riverCount++;
    } else if (pillarCount < 80 && Math.random() < 0.2) {
      createRockPillar(x, y, z);
      pillarCount++;
    } else if (rockCount < 60 && Math.random() < 0.15) {
      createObsidianRock(x, y, z);
      rockCount++;
    }
  }

  initSmokeSystem();
}

export function updateBiomeLava(delta) {
  if (!smokeParticles) return;

  // Update smoke particles
  for (let i = 0; i < SMOKE_COUNT; i++) {
    smokeLifetimes[i] -= delta;
    if (smokeLifetimes[i] <= 0) {
      resetSmokeParticle(i);
      continue;
    }

    smokePositions[i * 3] += smokeVelocities[i * 3] * delta;
    smokePositions[i * 3 + 1] += smokeVelocities[i * 3 + 1] * delta;
    smokePositions[i * 3 + 2] += smokeVelocities[i * 3 + 2] * delta;

    // Slow horizontal drift
    smokeVelocities[i * 3] *= 0.99;
    smokeVelocities[i * 3 + 2] *= 0.99;
  }

  smokeParticles.geometry.attributes.position.needsUpdate = true;
}
