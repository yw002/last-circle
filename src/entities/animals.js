// Animal subsystem: Rich ecosystem with many species
// Inspired by RDR2 - tigers, horses, bears, wolves, eagles, fish, rabbits, snakes, etc.

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { spawnSingleLoot } from '../world/loot.js';
import { addKillFeed } from '../ui/notices.js';
import { updateUI } from '../ui/hud.js';
import { showNotice } from '../ui/notices.js';
import { playerHit } from './player.js';

// Animal type definitions
const ANIMAL_TYPES = {
  // Passive animals (flee from player)
  deer: { health: 60, speed: 48, fleeDistance: 55, color: 0x8b5a2b, scale: 1.0, drops: ['health', 'ammo'] },
  rabbit: { health: 20, speed: 60, fleeDistance: 30, color: 0x999999, scale: 0.4, drops: ['ammo'] },
  boar: { health: 80, speed: 38, fleeDistance: 35, color: 0x3a3a3a, scale: 1.0, drops: ['health', 'ammo'], charges: true },
  elk: { health: 100, speed: 40, fleeDistance: 60, color: 0x6b4226, scale: 1.3, drops: ['health', 'health'] },
  bison: { health: 150, speed: 25, fleeDistance: 40, color: 0x2c1810, scale: 1.5, drops: ['health', 'health', 'ammo'] },

  // Aggressive animals (attack player)
  wolf: { health: 70, speed: 45, attackDistance: 80, color: 0x555555, scale: 0.9, damage: 15, drops: ['health'] },
  bear: { health: 200, speed: 30, attackDistance: 50, color: 0x4a2a0a, scale: 1.8, damage: 35, drops: ['health', 'health'] },
  tiger: { health: 120, speed: 55, attackDistance: 70, color: 0xff8c00, scale: 1.2, damage: 25, drops: ['health', 'health'] },
  mountain_lion: { health: 90, speed: 50, attackDistance: 60, color: 0xc4a35a, scale: 1.0, damage: 20, drops: ['health'] },

  // Aquatic (near water)
  fish: { health: 10, speed: 15, color: 0x4488aa, scale: 0.5, drops: ['ammo'] },

  // Flying
  eagle: { health: 40, speed: 35, color: 0x3d2b1f, scale: 0.8, drops: ['ammo'] },
  hawk: { health: 30, speed: 40, color: 0x8b4513, scale: 0.6, drops: ['ammo'] },

  // Reptiles
  snake: { health: 15, speed: 20, attackDistance: 15, color: 0x228b22, scale: 0.3, damage: 10, drops: ['ammo'] },

  // Rideable
  horse: { health: 150, speed: 60, fleeDistance: 25, color: 0x8b4513, scale: 1.3, drops: [], rideable: true }
};

// State for all animals
let allAnimals = [];

export function initAnimals() {
  initBirds();
  initDeers();
  initBoars();
  initRabbits();
  initWolves();
  initBears();
  initTigers();
  initMountainLions();
  initElk();
  initBison();
  initHorses();
  initSnakes();
  initEagles();
  initFish();
}

// Helper: Create animal body with legs
function createAnimalBody(type, config) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: config.color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

  let bodyGeo, headGeo, legGeo, tailGeo;

  switch (type) {
    case 'rabbit':
      bodyGeo = new THREE.SphereGeometry(0.6, 8, 8);
      headGeo = new THREE.SphereGeometry(0.35, 8, 8);
      legGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
      break;
    case 'snake':
      // Snake is just a long body
      bodyGeo = new THREE.CylinderGeometry(0.15, 0.08, 3, 8);
      headGeo = new THREE.SphereGeometry(0.2, 8, 8);
      break;
    case 'fish':
      bodyGeo = new THREE.ConeGeometry(0.4, 1.5, 6);
      headGeo = new THREE.SphereGeometry(0.25, 8, 8);
      break;
    default:
      // Generic quadruped
      bodyGeo = new THREE.BoxGeometry(2, 2, 4);
      headGeo = new THREE.BoxGeometry(1.2, 1.5, 1.5);
      legGeo = new THREE.BoxGeometry(0.5, 2.5, 0.5);
  }

  const body = new THREE.Mesh(bodyGeo, bodyMat);
  const head = new THREE.Mesh(headGeo, bodyMat);

  // Add eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeGeo = new THREE.SphereGeometry(0.1, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const pupilGeo = new THREE.SphereGeometry(0.05, 6, 6);
  const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
  const pupilR = new THREE.Mesh(pupilGeo, pupilMat);

  let legFL, legFR, legBL, legBR;

  if (type !== 'snake' && type !== 'fish') {
    legFL = new THREE.Mesh(legGeo, bodyMat);
    legFR = new THREE.Mesh(legGeo, bodyMat);
    legBL = new THREE.Mesh(legGeo, bodyMat);
    legBR = new THREE.Mesh(legGeo, bodyMat);
  }

  // Position based on type
  switch (type) {
    case 'rabbit':
      body.position.y = 0.8;
      head.position.set(0, 1.2, 0.5);
      eyeL.position.set(-0.2, 1.3, 0.7);
      eyeR.position.set(0.2, 1.3, 0.7);
      pupilL.position.set(-0.2, 1.3, 0.75);
      pupilR.position.set(0.2, 1.3, 0.75);
      if (legFL) {
        legFL.position.set(-0.3, 0.3, 0.3);
        legFR.position.set(0.3, 0.3, 0.3);
        legBL.position.set(-0.3, 0.3, -0.3);
        legBR.position.set(0.3, 0.3, -0.3);
      }
      break;
    case 'snake':
      body.position.y = 0.2;
      body.rotation.z = Math.PI / 2;
      head.position.set(0, 0.2, 1.6);
      eyeL.position.set(-0.15, 0.3, 1.7);
      eyeR.position.set(0.15, 0.3, 1.7);
      pupilL.position.set(-0.15, 0.3, 1.75);
      pupilR.position.set(0.15, 0.3, 1.75);
      break;
    case 'fish':
      body.position.y = 0.3;
      body.rotation.x = Math.PI / 2;
      head.position.set(0, 0.3, 0.8);
      eyeL.position.set(-0.25, 0.35, 0.9);
      eyeR.position.set(0.25, 0.35, 0.9);
      pupilL.position.set(-0.25, 0.35, 0.95);
      pupilR.position.set(0.25, 0.35, 0.95);
      break;
    default:
      body.position.y = 2.5;
      head.position.set(0, 3.5, 2.2);
      eyeL.position.set(-0.5, 3.7, 2.8);
      eyeR.position.set(0.5, 3.7, 2.8);
      pupilL.position.set(-0.5, 3.7, 2.85);
      pupilR.position.set(0.5, 3.7, 2.85);
      if (legFL) {
        legFL.position.set(-0.8, 1.2, 1.2);
        legFR.position.set(0.8, 1.2, 1.2);
        legBL.position.set(-0.8, 1.2, -1.2);
        legBR.position.set(0.8, 1.2, -1.2);
      }
  }

  group.add(body, head, eyeL, eyeR, pupilL, pupilR);
  if (legFL) group.add(legFL, legFR, legBL, legBR);

  // Add tail for some animals
  if (['deer', 'wolf', 'tiger', 'mountain_lion', 'horse', 'elk', 'bison'].includes(type)) {
    const tailGeo = new THREE.CylinderGeometry(0.1, 0.15, 1.5, 6);
    const tail = new THREE.Mesh(tailGeo, bodyMat);
    tail.position.set(0, 2.8, -2.5);
    tail.rotation.x = -Math.PI / 4;
    group.add(tail);
  }

  // Add antlers for deer/elk
  if (type === 'deer' || type === 'elk') {
    const antlerMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    const antlerGeo = new THREE.CylinderGeometry(0.08, 0.05, 1.5, 6);
    const antlerL = new THREE.Mesh(antlerGeo, antlerMat);
    antlerL.position.set(-0.4, 4.5, 2.2);
    antlerL.rotation.z = -0.5;
    const antlerR = new THREE.Mesh(antlerGeo, antlerMat);
    antlerR.position.set(0.4, 4.5, 2.2);
    antlerR.rotation.z = 0.5;
    group.add(antlerL, antlerR);
  }

  // Add mane for horse
  if (type === 'horse') {
    const maneMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const maneGeo = new THREE.BoxGeometry(0.3, 1.0, 2.0);
    const mane = new THREE.Mesh(maneGeo, maneMat);
    mane.position.set(0, 4.0, 1.0);
    group.add(mane);
  }

  // Add stripes for tiger
  if (type === 'tiger') {
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (let i = 0; i < 5; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.2, 0.3), stripeMat);
      stripe.position.set(0, 2.5, -1.5 + i * 0.8);
      group.add(stripe);
    }
  }

  // Add saddle for horse
  if (type === 'horse') {
    const saddleMat = new THREE.MeshLambertMaterial({ color: 0x5c3317 });
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.2), saddleMat);
    saddle.position.set(0, 3.8, 0);
    group.add(saddle);
  }

  return { group, body, head, legFL, legFR, legBL, legBR };
}

function spawnAnimal(type, x, z, config) {
  const y = getTerrainHeight(x, z);
  if (y < 1) return null; // Don't spawn in water (except fish)

  const { group, body, head, legFL, legFR, legBL, legBR } = createAnimalBody(type, config);

  group.scale.set(config.scale, config.scale, config.scale);
  group.position.set(x, y, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  state.scene.add(group);

  const idx = allAnimals.length;
  body.userData = { isAnimal: true, animalType: type, index: idx, isHeadshot: false };
  head.userData = { isAnimal: true, animalType: type, index: idx, isHeadshot: true };
  state.objects.push(body, head);

  const animal = {
    id: idx,
    type: type,
    mesh: group,
    bodyMesh: body,
    headMesh: head,
    legFL, legFR, legBL, legBR,
    vx: (Math.random() - 0.5) * 10,
    vz: (Math.random() - 0.5) * 10,
    state: 'wander',
    health: config.health,
    maxHealth: config.health,
    alive: true,
    changeDirTime: 0,
    fearCooldown: 0,
    attackCooldown: 0,
    config: config,
    isRidden: false
  };

  allAnimals.push(animal);
  return animal;
}

function initBirds() {
  const wingMat = new THREE.MeshLambertMaterial({ color: 0x222222, side: THREE.DoubleSide });
  const birdBodyGeo = new THREE.ConeGeometry(0.5, 2, 4);
  const wingGeo = new THREE.BoxGeometry(0.08, 0.15, 3.5);

  for (let i = 0; i < 120; i++) {
    const birdGroup = new THREE.Group();
    const body = new THREE.Mesh(birdBodyGeo, wingMat);
    body.rotation.x = Math.PI / 2;

    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-1.75, 0, 0);
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(1.75, 0, 0);

    birdGroup.add(body, wingL, wingR);

    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cy = 150 + Math.random() * 200;
    let radius = 50 + Math.random() * 150;
    let speed = 0.3 + Math.random() * 1.0;
    let angle = Math.random() * Math.PI * 2;

    birdGroup.position.set(cx + Math.cos(angle) * radius, cy, cz + Math.sin(angle) * radius);
    state.scene.add(birdGroup);

    state.birds.push({
      mesh: birdGroup, wingL, wingR, cx, cz, cy, radius, speed, angle
    });
  }
}

function initDeers() {
  const config = ANIMAL_TYPES.deer;
  for (let h = 0; h < 30; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      let x = cx + (Math.random() - 0.5) * 50;
      let z = cz + (Math.random() - 0.5) * 50;
      spawnAnimal('deer', x, z, config);
    }
  }
}

function initBoars() {
  const config = ANIMAL_TYPES.boar;
  for (let h = 0; h < 20; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      let x = cx + (Math.random() - 0.5) * 40;
      let z = cz + (Math.random() - 0.5) * 40;
      spawnAnimal('boar', x, z, config);
    }
  }
}

function initRabbits() {
  const config = ANIMAL_TYPES.rabbit;
  for (let i = 0; i < 100; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    spawnAnimal('rabbit', x, z, config);
  }
}

function initWolves() {
  const config = ANIMAL_TYPES.wolf;
  for (let h = 0; h < 15; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 3 + Math.floor(Math.random() * 5); // Wolf packs
    for (let i = 0; i < count; i++) {
      let x = cx + (Math.random() - 0.5) * 30;
      let z = cz + (Math.random() - 0.5) * 30;
      spawnAnimal('wolf', x, z, config);
    }
  }
}

function initBears() {
  const config = ANIMAL_TYPES.bear;
  for (let i = 0; i < 20; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    spawnAnimal('bear', x, z, config);
  }
}

function initTigers() {
  const config = ANIMAL_TYPES.tiger;
  for (let i = 0; i < 15; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    spawnAnimal('tiger', x, z, config);
  }
}

function initMountainLions() {
  const config = ANIMAL_TYPES.mountain_lion;
  for (let i = 0; i < 20; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    spawnAnimal('mountain_lion', x, z, config);
  }
}

function initElk() {
  const config = ANIMAL_TYPES.elk;
  for (let h = 0; h < 15; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      let x = cx + (Math.random() - 0.5) * 40;
      let z = cz + (Math.random() - 0.5) * 40;
      spawnAnimal('elk', x, z, config);
    }
  }
}

function initBison() {
  const config = ANIMAL_TYPES.bison;
  for (let h = 0; h < 10; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 4 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      let x = cx + (Math.random() - 0.5) * 50;
      let z = cz + (Math.random() - 0.5) * 50;
      spawnAnimal('bison', x, z, config);
    }
  }
}

function initHorses() {
  const config = ANIMAL_TYPES.horse;
  for (let h = 0; h < 20; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      let x = cx + (Math.random() - 0.5) * 40;
      let z = cz + (Math.random() - 0.5) * 40;
      spawnAnimal('horse', x, z, config);
    }
  }
}

function initSnakes() {
  const config = ANIMAL_TYPES.snake;
  for (let i = 0; i < 50; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    spawnAnimal('snake', x, z, config);
  }
}

function initEagles() {
  const config = ANIMAL_TYPES.eagle;
  for (let i = 0; i < 40; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    spawnAnimal('eagle', x, z, config);
  }
}

function initFish() {
  const config = ANIMAL_TYPES.fish;
  // Spawn fish near water (low terrain)
  for (let i = 0; i < 80; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let y = getTerrainHeight(x, z);
    if (y < 2 && y > -5) { // Near water
      const animal = spawnAnimal('fish', x, z, config);
      if (animal) {
        animal.mesh.position.y = 0.5; // Float on water
      }
    }
  }
}

export function updateAnimals(delta) {
  let now = Date.now();
  let playerPos = state.controls.getObject().position;

  allAnimals.forEach(animal => {
    if (!animal.alive) return;

    const config = animal.config;
    const aPos = animal.mesh.position;
    const distToPlayer = aPos.distanceTo(playerPos);
    const COLLISION_DIST = 4.0; // Minimum distance from player

    // State machine
    if (config.charges && distToPlayer < (config.fleeDistance || 35)) {
      animal.state = 'charge';
    } else if (config.attackDistance && distToPlayer < config.attackDistance) {
      animal.state = 'attack';
    } else if (config.fleeDistance && distToPlayer < config.fleeDistance) {
      animal.state = 'flee';
      animal.fearCooldown = now + 4000;
    } else if (now > animal.fearCooldown && now > animal.attackCooldown) {
      animal.state = 'wander';
    }

    // Behavior based on state
    switch (animal.state) {
      case 'flee': {
        let dir = new THREE.Vector3().subVectors(aPos, playerPos);
        dir.y = 0;
        dir.normalize();
        animal.vx = dir.x * config.speed;
        animal.vz = dir.z * config.speed;
        animal.mesh.lookAt(aPos.x + animal.vx, aPos.y, aPos.z + animal.vz);
        break;
      }
      case 'charge': {
        let dir = new THREE.Vector3().subVectors(playerPos, aPos);
        dir.y = 0;
        dir.normalize();
        animal.vx = dir.x * config.speed;
        animal.vz = dir.z * config.speed;
        animal.mesh.lookAt(playerPos.x, aPos.y, playerPos.z);

        // Hit player and bounce back
        if (distToPlayer < COLLISION_DIST) {
          animal.state = 'wander';
          animal.attackCooldown = now + 4000;
          // Push animal away from player
          animal.vx = -dir.x * 20;
          animal.vz = -dir.z * 20;
          // Move animal away immediately
          aPos.x -= dir.x * (COLLISION_DIST - distToPlayer + 2);
          aPos.z -= dir.z * (COLLISION_DIST - distToPlayer + 2);
          playerHit(config.damage || 12);
          showNotice(`💥 被${getAnimalName(animal.type)}攻击！(-${config.damage || 12} HP)`, "#f39c12");
        }
        break;
      }
      case 'attack': {
        let dir = new THREE.Vector3().subVectors(playerPos, aPos);
        dir.y = 0;
        dir.normalize();

        // Keep minimum distance from player - stronger pushback
        if (distToPlayer < COLLISION_DIST) {
          // Push away from player
          animal.vx = -dir.x * 25;
          animal.vz = -dir.z * 25;
          aPos.x -= dir.x * (COLLISION_DIST - distToPlayer + 2);
          aPos.z -= dir.z * (COLLISION_DIST - distToPlayer + 2);
        } else {
          animal.vx = dir.x * config.speed * 0.8;
          animal.vz = dir.z * config.speed * 0.8;
        }
        animal.mesh.lookAt(playerPos.x, aPos.y, playerPos.z);

        if (distToPlayer < 6.0 && now > animal.attackCooldown) {
          animal.attackCooldown = now + 2000;
          // Push animal back after attack - very strong
          animal.vx = -dir.x * 20;
          animal.vz = -dir.z * 20;
          // Move animal away immediately
          aPos.x -= dir.x * 3;
          aPos.z -= dir.z * 3;
          playerHit(config.damage || 15);
          showNotice(`⚠️ 被${getAnimalName(animal.type)}抓咬！(-${config.damage || 15} HP)`, "#e74c3c");
        }
        break;
      }
      case 'wander':
      default: {
        if (now > animal.changeDirTime) {
          animal.changeDirTime = now + 2000 + Math.random() * 4000;
          let angle = Math.random() * Math.PI * 2;
          let speed = 3 + Math.random() * 8;
          animal.vx = Math.cos(angle) * speed;
          animal.vz = Math.sin(angle) * speed;
        }
        if (Math.abs(animal.vx) > 0.1 || Math.abs(animal.vz) > 0.1) {
          animal.mesh.lookAt(aPos.x + animal.vx, aPos.y, aPos.z + animal.vz);
        }
        break;
      }
    }

    // Movement
    aPos.x += animal.vx * delta;
    aPos.z += animal.vz * delta;
    aPos.y = getTerrainHeight(aPos.x, aPos.z);

    // POST-MOVEMENT COLLISION CHECK - prevent ANY animal from getting too close to player
    const MIN_DIST = 10.0; // Large minimum distance
    const dx = aPos.x - playerPos.x;
    const dz = aPos.z - playerPos.z;
    const newDistSq = dx * dx + dz * dz;
    const minDistSq = MIN_DIST * MIN_DIST;

    if (newDistSq < minDistSq && animal.type !== 'fish') {
      const newDist = Math.sqrt(newDistSq);
      // Push animal away from player
      const pushX = dx / newDist;
      const pushZ = dz / newDist;

      // Teleport animal outside minimum distance
      aPos.x = playerPos.x + pushX * MIN_DIST;
      aPos.z = playerPos.z + pushZ * MIN_DIST;
      aPos.y = getTerrainHeight(aPos.x, aPos.z);

      // Set velocity away from player - very strong pushback
      animal.vx = pushX * 40;
      animal.vz = pushZ * 40;

      // Force animal to wander state to prevent re-charging
      animal.state = 'wander';
      animal.attackCooldown = now + 5000;
      animal.changeDirTime = now + 3000;
      animal.fearCooldown = now + 4000;
    }

    // Keep fish in water
    if (animal.type === 'fish') {
      if (aPos.y > 2) {
        // Turn back toward water
        let angle = Math.random() * Math.PI * 2;
        animal.vx = Math.cos(angle) * config.speed;
        animal.vz = Math.sin(angle) * config.speed;
      }
      aPos.y = 0.5;
    }

    // Boundary check
    if (Math.abs(aPos.x) > MAP_SIZE / 2 || Math.abs(aPos.z) > MAP_SIZE / 2) {
      aPos.x = (Math.random() - 0.5) * MAP_SIZE * 0.4;
      aPos.z = (Math.random() - 0.5) * MAP_SIZE * 0.4;
      aPos.y = getTerrainHeight(aPos.x, aPos.z);
    }

    // Leg animation
    let moveSpeedSq = animal.vx * animal.vx + animal.vz * animal.vz;
    if (moveSpeedSq > 1 && animal.legFL) {
      let swingFreq = animal.state === 'flee' ? 0.024 : 0.012;
      let swing = Math.sin(now * swingFreq) * 0.65;
      animal.legFL.rotation.x = swing;
      animal.legFR.rotation.x = -swing;
      animal.legBL.rotation.x = -swing;
      animal.legBR.rotation.x = swing;
    } else if (animal.legFL) {
      animal.legFL.rotation.x = 0;
      animal.legFR.rotation.x = 0;
      animal.legBL.rotation.x = 0;
      animal.legBR.rotation.x = 0;
    }

    // Slow down
    animal.vx *= 0.98;
    animal.vz *= 0.98;
  });

  // Update birds
  state.birds.forEach(bird => {
    bird.angle += bird.speed * delta;
    let bx = bird.cx + Math.cos(bird.angle) * bird.radius;
    let bz = bird.cz + Math.sin(bird.angle) * bird.radius;
    bird.mesh.position.set(bx, bird.cy, bz);
    bird.mesh.rotation.y = -bird.angle;
    let wingAngle = Math.sin(now * 0.016) * 0.55;
    bird.wingL.rotation.z = wingAngle;
    bird.wingR.rotation.z = -wingAngle;
  });
}

function getAnimalName(type) {
  const names = {
    deer: '梅花鹿', rabbit: '野兔', boar: '野猪', elk: '麋鹿', bison: '野牛',
    wolf: '灰狼', bear: '棕熊', tiger: '猛虎', mountain_lion: '美洲狮',
    fish: '鱼', eagle: '雄鹰', hawk: '猎鹰', snake: '毒蛇', horse: '野马'
  };
  return names[type] || type;
}

export function killAnimal(animal, animalType) {
  if (!animal.alive) return;
  animal.alive = false;
  state.scene.remove(animal.mesh);

  let idx1 = state.objects.indexOf(animal.bodyMesh);
  if (idx1 > -1) state.objects.splice(idx1, 1);
  let idx2 = state.objects.indexOf(animal.headMesh);
  if (idx2 > -1) state.objects.splice(idx2, 1);

  let animalName = getAnimalName(animalType);
  showNotice(`击杀了 [${animalName}]！生存补给已掉落！`, "#2ecc71");

  // Drop loot based on animal config
  const drops = animal.config.drops || ['ammo'];
  if (drops.length > 0) {
    let r = Math.random();
    if (r < 0.5) {
      spawnSingleLoot(animal.mesh.position.x, animal.mesh.position.y, animal.mesh.position.z, drops[0]);
    } else if (drops.length > 1) {
      spawnSingleLoot(animal.mesh.position.x, animal.mesh.position.y, animal.mesh.position.z, drops[1]);
    }
  }

  addKillFeed(`[You] 击杀了一只 [${animalName}]`);
  updateUI();
}

// Get all animals for external access
export function getAllAnimals() {
  return allAnimals;
}

// Find nearest horse for riding
export function findNearestHorse(playerPos) {
  let nearest = null;
  let minDist = Infinity;
  allAnimals.forEach(animal => {
    if (animal.type === 'horse' && animal.alive && !animal.isRidden) {
      let dist = animal.mesh.position.distanceTo(playerPos);
      if (dist < minDist && dist < 10) {
        minDist = dist;
        nearest = animal;
      }
    }
  });
  return nearest;
}
