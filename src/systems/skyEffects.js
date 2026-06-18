// Sky effects: stars, aurora, fireflies, falling leaves, bird flocks

import * as THREE from 'three';
import { state } from '../state.js';
import { isNight } from './dayNight.js';
import { getBiomeAt, BIOME } from '../world/biomes.js';
import { MAP_SIZE } from '../config.js';

// Stars
let starsPoints = null;
const STAR_COUNT = 3000;

// Aurora
let auroraMeshes = [];

// Fireflies
let fireflyPoints = null;
const FIREFLY_COUNT = 500;
const fireflyBasePositions = new Float32Array(FIREFLY_COUNT * 3);
const fireflyPositions = new Float32Array(FIREFLY_COUNT * 3);
const fireflyPhases = new Float32Array(FIREFLY_COUNT);

// Falling leaves
let leafPoints = null;
const LEAF_COUNT = 300;
const leafPositions = new Float32Array(LEAF_COUNT * 3);
const leafVelocities = new Float32Array(LEAF_COUNT * 3);
const leafLifetimes = new Float32Array(LEAF_COUNT);

// Bird flocks
let birdFlocks = [];
let lastBirdSpawn = 0;
const BIRD_INTERVAL = 80; // seconds

export function initSkyEffects() {
  // Stars
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.8 + 0.2); // upper hemisphere only
    const r = 2000 + Math.random() * 1000;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xFFFFFF, size: 3, transparent: true, opacity: 0, depthWrite: false
  });
  starsPoints = new THREE.Points(starGeo, starMat);
  state.scene.add(starsPoints);

  // Aurora (3 wavy planes in northern sky)
  for (let i = 0; i < 3; i++) {
    const auroraGeo = new THREE.PlaneGeometry(2000, 150, 50, 1);
    const auroraMat = new THREE.MeshBasicMaterial({
      color: [0x00FF88, 0x8844FF, 0x2288FF][i],
      transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false
    });
    const aurora = new THREE.Mesh(auroraGeo, auroraMat);
    aurora.position.set(0, 800 + i * 100, -1500);
    aurora.rotation.x = -0.2;
    aurora.visible = false;
    state.scene.add(aurora);
    auroraMeshes.push(aurora);
  }

  // Fireflies
  const fireflyGeo = new THREE.BufferGeometry();
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3));
  const fireflyMat = new THREE.PointsMaterial({
    color: 0xADFF2F, size: 3, transparent: true, opacity: 0, depthWrite: false
  });
  fireflyPoints = new THREE.Points(fireflyGeo, fireflyMat);
  state.scene.add(fireflyPoints);

  for (let i = 0; i < FIREFLY_COUNT; i++) {
    fireflyPhases[i] = Math.random() * Math.PI * 2;
    const x = (Math.random() - 0.5) * 300;
    const z = (Math.random() - 0.5) * 300;
    fireflyBasePositions[i * 3] = x;
    fireflyBasePositions[i * 3 + 1] = 5 + Math.random() * 15;
    fireflyBasePositions[i * 3 + 2] = z;
    fireflyPositions[i * 3] = 99999;
    fireflyPositions[i * 3 + 1] = 99999;
    fireflyPositions[i * 3 + 2] = 99999;
  }

  // Falling leaves
  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPositions, 3));
  const leafMat = new THREE.PointsMaterial({
    color: 0xCC8844, size: 2, transparent: true, opacity: 0.8, depthWrite: false
  });
  leafPoints = new THREE.Points(leafGeo, leafMat);
  state.scene.add(leafPoints);

  for (let i = 0; i < LEAF_COUNT; i++) {
    resetLeaf(i);
  }
}

function resetLeaf(i) {
  // Spawn near player area (will be repositioned in update)
  leafPositions[i * 3] = 99999;
  leafPositions[i * 3 + 1] = 99999;
  leafPositions[i * 3 + 2] = 99999;
  leafVelocities[i * 3] = (Math.random() - 0.5) * 5;
  leafVelocities[i * 3 + 1] = -(2 + Math.random() * 3);
  leafVelocities[i * 3 + 2] = (Math.random() - 0.5) * 5;
  leafLifetimes[i] = 0;
}

function spawnBirdFlock() {
  const flock = {
    birds: [],
    direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
    speed: 100 + Math.random() * 80,
    lifetime: 30 + Math.random() * 30
  };

  const startX = (Math.random() - 0.5) * 3000;
  const startZ = -2000;
  const birdCount = 5 + Math.floor(Math.random() * 3);
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const birdGeo = new THREE.ConeGeometry(1.5, 5, 4);

  for (let i = 0; i < birdCount; i++) {
    const mesh = new THREE.Mesh(birdGeo, birdMat);
    // V formation
    const side = i % 2 === 0 ? 1 : -1;
    const row = Math.ceil(i / 2);
    mesh.position.set(
      startX + side * row * 8,
      600 + Math.random() * 50,
      startZ - row * 12
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.rotation.y = Math.atan2(flock.direction.x, flock.direction.z);
    state.scene.add(mesh);
    flock.birds.push(mesh);
  }

  birdFlocks.push(flock);
}

export function updateSkyEffects(delta, time) {
  const nightActive = isNight();
  const playerPos = state.controls ? state.controls.getObject().position : null;
  if (!playerPos) return;

  const biome = getBiomeAt(playerPos.x, playerPos.z);

  // Stars - fade in/out
  if (starsPoints) {
    const targetOpacity = nightActive ? 0.8 : 0;
    starsPoints.material.opacity += (targetOpacity - starsPoints.material.opacity) * delta * 2;
    starsPoints.position.set(playerPos.x, 0, playerPos.z);
  }

  // Aurora - visible at night in northern zones
  for (let i = 0; i < auroraMeshes.length; i++) {
    const aurora = auroraMeshes[i];
    const shouldShow = nightActive && playerPos.z < -500;
    aurora.visible = shouldShow;
    if (shouldShow) {
      // Wave animation
      const positions = aurora.geometry.attributes.position.array;
      for (let j = 0; j < positions.length; j += 3) {
        positions[j + 1] = Math.sin(time * 0.5 + positions[j] * 0.005 + i) * 20;
      }
      aurora.geometry.attributes.position.needsUpdate = true;
      aurora.position.x = playerPos.x;
    }
  }

  // Fireflies - visible at night in swamp/jungle
  if (fireflyPoints) {
    const showFireflies = nightActive && (biome === BIOME.SWAMP || biome === BIOME.JUNGLE);
    const targetOpacity = showFireflies ? 0.8 : 0;
    fireflyPoints.material.opacity += (targetOpacity - fireflyPoints.material.opacity) * delta * 3;

    if (showFireflies) {
      for (let i = 0; i < FIREFLY_COUNT; i++) {
        const phase = fireflyPhases[i] + time;
        fireflyPositions[i * 3] = playerPos.x + fireflyBasePositions[i * 3] + Math.sin(phase * 1.3) * 10;
        fireflyPositions[i * 3 + 1] = playerPos.y + fireflyBasePositions[i * 3 + 1] + Math.sin(phase * 0.7) * 5;
        fireflyPositions[i * 3 + 2] = playerPos.z + fireflyBasePositions[i * 3 + 2] + Math.cos(phase * 1.1) * 10;
      }
      fireflyPoints.geometry.attributes.position.needsUpdate = true;
    }
  }

  // Falling leaves - near birch/cherry trees (any biome, autumn effect)
  if (leafPoints) {
    for (let i = 0; i < LEAF_COUNT; i++) {
      leafLifetimes[i] -= delta;
      if (leafLifetimes[i] <= 0) {
        // Respawn near player
        leafPositions[i * 3] = playerPos.x + (Math.random() - 0.5) * 100;
        leafPositions[i * 3 + 1] = playerPos.y + 20 + Math.random() * 30;
        leafPositions[i * 3 + 2] = playerPos.z + (Math.random() - 0.5) * 100;
        leafVelocities[i * 3] = (Math.random() - 0.5) * 5;
        leafVelocities[i * 3 + 1] = -(2 + Math.random() * 3);
        leafVelocities[i * 3 + 2] = (Math.random() - 0.5) * 5;
        leafLifetimes[i] = 3 + Math.random() * 5;
      } else {
        leafPositions[i * 3] += leafVelocities[i * 3] * delta;
        leafPositions[i * 3 + 1] += leafVelocities[i * 3 + 1] * delta;
        leafPositions[i * 3 + 2] += leafVelocities[i * 3 + 2] * delta;
        // Wind drift
        leafVelocities[i * 3] += Math.sin(time + i) * delta * 2;
      }
    }
    leafPoints.geometry.attributes.position.needsUpdate = true;
  }

  // Bird flocks
  lastBirdSpawn += delta;
  if (lastBirdSpawn > BIRD_INTERVAL && !nightActive && birdFlocks.length < 3) {
    spawnBirdFlock();
    lastBirdSpawn = 0;
  }

  // Update existing flocks
  for (let f = birdFlocks.length - 1; f >= 0; f--) {
    const flock = birdFlocks[f];
    flock.lifetime -= delta;

    if (flock.lifetime <= 0) {
      for (const bird of flock.birds) {
        state.scene.remove(bird);
        bird.geometry.dispose();
      }
      birdFlocks.splice(f, 1);
      continue;
    }

    for (const bird of flock.birds) {
      bird.position.x += flock.direction.x * flock.speed * delta;
      bird.position.z += flock.direction.z * flock.speed * delta;
      bird.position.y += Math.sin(time * 3 + bird.position.x * 0.01) * delta * 2;
    }
  }
}
