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
let nextBirdInterval = 60 + Math.random() * 60; // 60-120s, re-rolled per spawn

// Aurora shader — vertex displacement + green/purple/blue gradient. Replaces a
// flat MeshBasicMaterial with a real ShaderMaterial so the wave deformation and
// vertical color stripes are GPU-driven instead of a CPU position attribute write.
const AURORA_VERT = /* glsl */`
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.y += sin(uTime * 0.5 + p.x * 0.005 + uPhase) * 25.0;
    p.y += cos(uTime * 0.3 + p.x * 0.011 + uPhase * 0.5) * 12.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const AURORA_FRAG = /* glsl */`
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float band = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
    float wave = 0.5 + 0.5 * sin(uTime * 0.6 + vUv.x * 6.2832 * 3.0);
    vec3 col = mix(uColorA, uColorB, wave);
    float alpha = band * (0.18 + 0.12 * wave) * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;
const AURORA_PALETTE = [
  { a: new THREE.Color(0x00ff88), b: new THREE.Color(0x2288ff) }, // green→blue
  { a: new THREE.Color(0x8844ff), b: new THREE.Color(0x00ff88) }, // purple→green
  { a: new THREE.Color(0x2288ff), b: new THREE.Color(0x8844ff) }, // blue→purple
];

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

  // Aurora — 3 wavy planes in northern sky, ShaderMaterial-driven
  for (let i = 0; i < 3; i++) {
    const auroraGeo = new THREE.PlaneGeometry(2000, 150, 50, 1);
    const palette = AURORA_PALETTE[i % AURORA_PALETTE.length];
    const auroraMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPhase: { value: i * 1.7 },
        uColorA: { value: palette.a.clone() },
        uColorB: { value: palette.b.clone() },
        uOpacity: { value: 1.0 },
      },
      vertexShader: AURORA_VERT,
      fragmentShader: AURORA_FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
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
      // Drive shader uniforms; the GPU handles wave deformation + color band each frame.
      const u = aurora.material.uniforms;
      u.uTime.value = time;
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

  // Falling leaves — only spawn near birch/cherry trees (recorded in state.autumnTreePositions).
  // Each leaf picks the nearest such tree on respawn so the effect localises to autumn foliage.
  if (leafPoints) {
    const trees = state.autumnTreePositions;
    const nearbyTrees = [];
    if (trees && trees.length > 0) {
      for (let t = 0; t < trees.length; t++) {
        const dx = trees[t].x - playerPos.x;
        const dz = trees[t].z - playerPos.z;
        if (dx * dx + dz * dz < 220 * 220) nearbyTrees.push(trees[t]);
      }
    }

    for (let i = 0; i < LEAF_COUNT; i++) {
      leafLifetimes[i] -= delta;
      if (leafLifetimes[i] <= 0) {
        if (nearbyTrees.length === 0) {
          // No autumn trees near the player — park the leaf far offscreen.
          leafPositions[i * 3] = 99999;
          leafPositions[i * 3 + 1] = 99999;
          leafPositions[i * 3 + 2] = 99999;
          leafLifetimes[i] = 1 + Math.random();
          continue;
        }
        const tree = nearbyTrees[Math.floor(Math.random() * nearbyTrees.length)];
        leafPositions[i * 3] = tree.x + (Math.random() - 0.5) * 30;
        leafPositions[i * 3 + 1] = playerPos.y + 35 + Math.random() * 25;
        leafPositions[i * 3 + 2] = tree.z + (Math.random() - 0.5) * 30;
        leafVelocities[i * 3] = (Math.random() - 0.5) * 5;
        leafVelocities[i * 3 + 1] = -(2 + Math.random() * 3);
        leafVelocities[i * 3 + 2] = (Math.random() - 0.5) * 5;
        leafLifetimes[i] = 4 + Math.random() * 5;
      } else {
        leafPositions[i * 3] += leafVelocities[i * 3] * delta;
        leafPositions[i * 3 + 1] += leafVelocities[i * 3 + 1] * delta;
        leafPositions[i * 3 + 2] += leafVelocities[i * 3 + 2] * delta;
        leafVelocities[i * 3] += Math.sin(time + i) * delta * 2;
      }
    }
    leafPoints.geometry.attributes.position.needsUpdate = true;
  }

  // Bird flocks — random 60-120s spacing per spawn.
  lastBirdSpawn += delta;
  if (lastBirdSpawn > nextBirdInterval && !nightActive && birdFlocks.length < 3) {
    spawnBirdFlock();
    lastBirdSpawn = 0;
    nextBirdInterval = 60 + Math.random() * 60;
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
