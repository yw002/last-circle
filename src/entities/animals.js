// Animal subsystem: Optimized with shared resources
// Reduced animal count for better performance

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { spawnSingleLoot } from '../world/loot.js';
import { addKillFeed } from '../ui/notices.js';
import { updateUI } from '../ui/hud.js';
import { showNotice } from '../ui/notices.js';
import { playerHit } from './player.js';

// ========== SHARED RESOURCES ==========
// Shared materials - created once
const sharedMats = {
  dark: new THREE.MeshLambertMaterial({ color: 0x222222 }),
  eyeWhite: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  eyePupil: new THREE.MeshBasicMaterial({ color: 0x000000 }),
  antler: new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  tusk: new THREE.MeshLambertMaterial({ color: 0xeeeeee }),
  saddle: new THREE.MeshLambertMaterial({ color: 0x5c3317 }),
  mane: new THREE.MeshLambertMaterial({ color: 0x111111 }),
  stripe: new THREE.MeshLambertMaterial({ color: 0x111111 })
};

// Shared geometries - created once
const sharedGeos = {
  // Generic quadruped
  body: new THREE.BoxGeometry(2, 2, 4),
  head: new THREE.BoxGeometry(1.2, 1.5, 1.5),
  leg: new THREE.BoxGeometry(0.5, 2.5, 0.5),
  tail: new THREE.CylinderGeometry(0.1, 0.15, 1.5, 6),

  // Small animals
  rabbitBody: new THREE.SphereGeometry(0.6, 6, 6),
  rabbitHead: new THREE.SphereGeometry(0.35, 6, 6),
  rabbitLeg: new THREE.BoxGeometry(0.2, 0.5, 0.2),

  // Snake
  snakeBody: new THREE.CylinderGeometry(0.15, 0.08, 3, 6),
  snakeHead: new THREE.SphereGeometry(0.2, 6, 6),

  // Fish
  fishBody: new THREE.ConeGeometry(0.4, 1.5, 6),
  fishHead: new THREE.SphereGeometry(0.25, 6, 6),

  // Bird
  birdBody: new THREE.ConeGeometry(0.5, 2, 4),
  birdWing: new THREE.BoxGeometry(0.08, 0.15, 3.5),

  // Eyes
  eye: new THREE.SphereGeometry(0.1, 6, 6),

  // Antlers
  antler: new THREE.BoxGeometry(0.15, 1.8, 0.15),

  // Tusks
  tusk: new THREE.BoxGeometry(0.18, 0.45, 0.6),

  // Horse extras
  saddle: new THREE.BoxGeometry(1.5, 0.4, 1.2),
  mane: new THREE.BoxGeometry(0.3, 1.0, 2.0),

  // Tiger stripes
  stripe: new THREE.BoxGeometry(2.1, 0.2, 0.3)
};

// Animal type definitions
const ANIMAL_TYPES = {
  deer: { health: 60, speed: 48, fleeDistance: 55, color: 0x8b5a2b, scale: 1.0, drops: ['health', 'ammo'] },
  rabbit: { health: 20, speed: 60, fleeDistance: 30, color: 0x999999, scale: 0.4, drops: ['ammo'] },
  boar: { health: 80, speed: 38, fleeDistance: 35, color: 0x3a3a3a, scale: 1.0, drops: ['health', 'ammo'], charges: true },
  wolf: { health: 70, speed: 45, attackDistance: 80, color: 0x555555, scale: 0.9, damage: 15, drops: ['health'] },
  bear: { health: 200, speed: 30, attackDistance: 50, color: 0x4a2a0a, scale: 1.8, damage: 35, drops: ['health', 'health'] },
  tiger: { health: 120, speed: 55, attackDistance: 70, color: 0xff8c00, scale: 1.2, damage: 25, drops: ['health', 'health'] },
  horse: { health: 150, speed: 60, fleeDistance: 25, color: 0x8b4513, scale: 1.3, drops: [] }
};

// Material cache - reuse materials by color
const materialCache = {};
function getMaterial(color) {
  if (!materialCache[color]) {
    materialCache[color] = new THREE.MeshLambertMaterial({ color });
  }
  return materialCache[color];
}

let allAnimals = [];

export function initAnimals() {
  initBirds();
  initDeers();
  initBoars();
  initRabbits();
  initWolves();
  initBears();
  initTigers();
  initHorses();
}

function createAnimalBody(type, config) {
  const group = new THREE.Group();
  const bodyMat = getMaterial(config.color);

  let body, head, legFL, legFR, legBL, legBR;

  switch (type) {
    case 'rabbit':
      body = new THREE.Mesh(sharedGeos.rabbitBody, bodyMat);
      body.position.y = 0.8;
      head = new THREE.Mesh(sharedGeos.rabbitHead, bodyMat);
      head.position.set(0, 1.2, 0.5);
      legFL = new THREE.Mesh(sharedGeos.rabbitLeg, bodyMat);
      legFR = new THREE.Mesh(sharedGeos.rabbitLeg, bodyMat);
      legBL = new THREE.Mesh(sharedGeos.rabbitLeg, bodyMat);
      legBR = new THREE.Mesh(sharedGeos.rabbitLeg, bodyMat);
      legFL.position.set(-0.3, 0.3, 0.3);
      legFR.position.set(0.3, 0.3, 0.3);
      legBL.position.set(-0.3, 0.3, -0.3);
      legBR.position.set(0.3, 0.3, -0.3);
      break;

    case 'snake':
      body = new THREE.Mesh(sharedGeos.snakeBody, bodyMat);
      body.position.y = 0.2;
      body.rotation.z = Math.PI / 2;
      head = new THREE.Mesh(sharedGeos.snakeHead, bodyMat);
      head.position.set(0, 0.2, 1.6);
      break;

    case 'fish':
      body = new THREE.Mesh(sharedGeos.fishBody, bodyMat);
      body.position.y = 0.3;
      body.rotation.x = Math.PI / 2;
      head = new THREE.Mesh(sharedGeos.fishHead, bodyMat);
      head.position.set(0, 0.3, 0.8);
      break;

    default:
      // Generic quadruped
      body = new THREE.Mesh(sharedGeos.body, bodyMat);
      body.position.y = 2.5;
      head = new THREE.Mesh(sharedGeos.head, bodyMat);
      head.position.set(0, 3.5, 2.2);
      legFL = new THREE.Mesh(sharedGeos.leg, bodyMat);
      legFR = new THREE.Mesh(sharedGeos.leg, bodyMat);
      legBL = new THREE.Mesh(sharedGeos.leg, bodyMat);
      legBR = new THREE.Mesh(sharedGeos.leg, bodyMat);
      legFL.position.set(-0.8, 1.2, 1.2);
      legFR.position.set(0.8, 1.2, 1.2);
      legBL.position.set(-0.8, 1.2, -1.2);
      legBR.position.set(0.8, 1.2, -1.2);
  }

  // Eyes
  const eyeL = new THREE.Mesh(sharedGeos.eye, sharedMats.eyeWhite);
  const eyeR = new THREE.Mesh(sharedGeos.eye, sharedMats.eyeWhite);
  const pupilL = new THREE.Mesh(sharedGeos.eye, sharedMats.eyePupil);
  const pupilR = new THREE.Mesh(sharedGeos.eye, sharedMats.eyePupil);

  if (type === 'rabbit') {
    eyeL.position.set(-0.2, 1.3, 0.7);
    eyeR.position.set(0.2, 1.3, 0.7);
    pupilL.position.set(-0.2, 1.3, 0.75);
    pupilR.position.set(0.2, 1.3, 0.75);
  } else if (type === 'snake' || type === 'fish') {
    eyeL.position.set(-0.15, 0.3, 1.7);
    eyeR.position.set(0.15, 0.3, 1.7);
    pupilL.position.set(-0.15, 0.3, 1.75);
    pupilR.position.set(0.15, 0.3, 1.75);
  } else {
    eyeL.position.set(-0.5, 3.7, 2.8);
    eyeR.position.set(0.5, 3.7, 2.8);
    pupilL.position.set(-0.5, 3.7, 2.85);
    pupilR.position.set(0.5, 3.7, 2.85);
  }

  group.add(body, head, eyeL, eyeR, pupilL, pupilR);
  if (legFL) group.add(legFL, legFR, legBL, legBR);

  // Add tail for some animals
  if (['deer', 'wolf', 'tiger', 'horse'].includes(type)) {
    const tail = new THREE.Mesh(sharedGeos.tail, bodyMat);
    tail.position.set(0, 2.8, -2.5);
    tail.rotation.x = -Math.PI / 4;
    group.add(tail);
  }

  // Add antlers for deer
  if (type === 'deer') {
    const antlerL = new THREE.Mesh(sharedGeos.antler, sharedMats.antler);
    antlerL.position.set(-0.4, 4.5, 2.2);
    antlerL.rotation.z = -0.5;
    const antlerR = new THREE.Mesh(sharedGeos.antler, sharedMats.antler);
    antlerR.position.set(0.4, 4.5, 2.2);
    antlerR.rotation.z = 0.5;
    group.add(antlerL, antlerR);
  }

  // Add saddle for horse
  if (type === 'horse') {
    const saddle = new THREE.Mesh(sharedGeos.saddle, sharedMats.saddle);
    saddle.position.set(0, 3.8, 0);
    group.add(saddle);
    const mane = new THREE.Mesh(sharedGeos.mane, sharedMats.mane);
    mane.position.set(0, 4.0, 1.0);
    group.add(mane);
  }

  // Add stripes for tiger
  if (type === 'tiger') {
    for (let i = 0; i < 5; i++) {
      const stripe = new THREE.Mesh(sharedGeos.stripe, sharedMats.stripe);
      stripe.position.set(0, 2.5, -1.5 + i * 0.8);
      group.add(stripe);
    }
  }

  return { group, body, head, legFL, legFR, legBL, legBR };
}

function spawnAnimal(type, x, z, config) {
  const y = getTerrainHeight(x, z);
  if (y < 1) return null;

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
    config: config
  };

  allAnimals.push(animal);
  return animal;
}

function initBirds() {
  for (let i = 0; i < 60; i++) { // Reduced from 120
    const birdGroup = new THREE.Group();
    const bodyMat = sharedMats.dark;

    const body = new THREE.Mesh(sharedGeos.birdBody, bodyMat);
    body.rotation.x = Math.PI / 2;
    const wingL = new THREE.Mesh(sharedGeos.birdWing, bodyMat);
    wingL.position.set(-1.75, 0, 0);
    const wingR = new THREE.Mesh(sharedGeos.birdWing, bodyMat);
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
  for (let h = 0; h < 15; h++) { // Reduced from 30
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      let x = cx + (Math.random() - 0.5) * 40;
      let z = cz + (Math.random() - 0.5) * 40;
      spawnAnimal('deer', x, z, config);
    }
  }
}

function initBoars() {
  const config = ANIMAL_TYPES.boar;
  for (let h = 0; h < 10; h++) { // Reduced from 20
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      let x = cx + (Math.random() - 0.5) * 30;
      let z = cz + (Math.random() - 0.5) * 30;
      spawnAnimal('boar', x, z, config);
    }
  }
}

function initRabbits() {
  const config = ANIMAL_TYPES.rabbit;
  for (let i = 0; i < 40; i++) { // Reduced from 100
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    spawnAnimal('rabbit', x, z, config);
  }
}

function initWolves() {
  const config = ANIMAL_TYPES.wolf;
  for (let h = 0; h < 8; h++) { // Reduced from 15
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      let x = cx + (Math.random() - 0.5) * 30;
      let z = cz + (Math.random() - 0.5) * 30;
      spawnAnimal('wolf', x, z, config);
    }
  }
}

function initBears() {
  const config = ANIMAL_TYPES.bear;
  for (let i = 0; i < 10; i++) { // Reduced from 20
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    spawnAnimal('bear', x, z, config);
  }
}

function initTigers() {
  const config = ANIMAL_TYPES.tiger;
  for (let i = 0; i < 8; i++) { // Reduced from 15
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    spawnAnimal('tiger', x, z, config);
  }
}

function initHorses() {
  const config = ANIMAL_TYPES.horse;
  for (let h = 0; h < 10; h++) { // Reduced from 20
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      let x = cx + (Math.random() - 0.5) * 30;
      let z = cz + (Math.random() - 0.5) * 30;
      spawnAnimal('horse', x, z, config);
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

    // Skip updates for distant animals
    if (distToPlayer > 500) {
      animal.mesh.visible = false;
      return;
    }
    animal.mesh.visible = true;

    const COLLISION_DIST = 4.0;

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

    // Behavior
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

        if (distToPlayer < COLLISION_DIST) {
          animal.state = 'wander';
          animal.attackCooldown = now + 4000;
          animal.vx = -dir.x * 20;
          animal.vz = -dir.z * 20;
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

        // Move toward player
        animal.vx = dir.x * config.speed * 0.9;
        animal.vz = dir.z * config.speed * 0.9;
        animal.mesh.lookAt(playerPos.x, aPos.y, playerPos.z);

        // Attack when close enough (within 5 meters)
        if (distToPlayer < 5.0 && now > animal.attackCooldown) {
          animal.attackCooldown = now + 1500;
          // Push back slightly after attack
          animal.vx = -dir.x * 15;
          animal.vz = -dir.z * 15;
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

    // Collision check - aggressive animals can get closer to attack
    const isAggressive = config.attackDistance || config.charges;
    const MIN_DIST = isAggressive ? 2.5 : 8.0;
    const dx = aPos.x - playerPos.x;
    const dz = aPos.z - playerPos.z;
    const newDistSq = dx * dx + dz * dz;
    const minDistSq = MIN_DIST * MIN_DIST;

    if (newDistSq < minDistSq && animal.type !== 'fish') {
      const newDist = Math.sqrt(newDistSq);
      const pushX = dx / newDist;
      const pushZ = dz / newDist;

      aPos.x = playerPos.x + pushX * MIN_DIST;
      aPos.z = playerPos.z + pushZ * MIN_DIST;
      aPos.y = getTerrainHeight(aPos.x, aPos.z);

      // Only push passive animals away completely
      if (!isAggressive) {
        animal.vx = pushX * 40;
        animal.vz = pushZ * 40;
        animal.state = 'wander';
        animal.attackCooldown = now + 5000;
        animal.changeDirTime = now + 3000;
        animal.fearCooldown = now + 4000;
      }
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
    deer: '梅花鹿', rabbit: '野兔', boar: '野猪',
    wolf: '灰狼', bear: '棕熊', tiger: '猛虎',
    horse: '野马'
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

export function getAllAnimals() {
  return allAnimals;
}

export function findNearestHorse(playerPos) {
  let nearest = null;
  let minDist = Infinity;
  allAnimals.forEach(animal => {
    if (animal.type === 'horse' && animal.alive) {
      let dist = animal.mesh.position.distanceTo(playerPos);
      if (dist < minDist && dist < 10) {
        minDist = dist;
        nearest = animal;
      }
    }
  });
  return nearest;
}
