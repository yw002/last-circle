// Animal subsystem: Rich ecosystem with many species
// Zelda BOTW / RDR2 inspired - abundant wildlife everywhere

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { spawnSingleLoot } from '../world/loot.js';
import { addKillFeed } from '../ui/notices.js';
import { updateUI } from '../ui/hud.js';
import { showNotice } from '../ui/notices.js';
import { playerHit } from './player.js';
import { checkEntityCollision } from '../systems/collision.js';
import { getNearbyColliders, getNearbyDoors } from '../systems/spatial.js';

// ========== SHARED RESOURCES ==========
const sharedMats = {
  dark: new THREE.MeshLambertMaterial({ color: 0x222222 }),
  eyeWhite: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  eyePupil: new THREE.MeshBasicMaterial({ color: 0x000000 }),
  antler: new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  tusk: new THREE.MeshLambertMaterial({ color: 0xeeeeee }),
  saddle: new THREE.MeshLambertMaterial({ color: 0x5c3317 }),
  mane: new THREE.MeshLambertMaterial({ color: 0x111111 }),
  stripe: new THREE.MeshLambertMaterial({ color: 0x111111 }),
  wing: new THREE.MeshLambertMaterial({ color: 0x222222, side: THREE.DoubleSide })
};

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
  stripe: new THREE.BoxGeometry(2.1, 0.2, 0.3),

  // Bear
  bearBody: new THREE.SphereGeometry(2.5, 8, 6),
  bearHead: new THREE.SphereGeometry(1.5, 8, 8),

  // Fox
  foxBody: new THREE.BoxGeometry(1.5, 1.5, 3),
  foxHead: new THREE.BoxGeometry(0.8, 1.0, 1.2),
  foxTail: new THREE.CylinderGeometry(0.2, 0.4, 2.5, 6),

  // Owl
  owlBody: new THREE.SphereGeometry(0.8, 8, 8),
  owlWing: new THREE.BoxGeometry(0.1, 0.5, 2),

  // Turtle
  turtleShell: new THREE.SphereGeometry(1.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  turtleBody: new THREE.BoxGeometry(1.5, 0.5, 2),
  turtleLeg: new THREE.CylinderGeometry(0.15, 0.15, 0.8, 6),

  // Monkey
  monkeyBody: new THREE.SphereGeometry(0.8, 8, 8),
  monkeyHead: new THREE.SphereGeometry(0.6, 8, 8),
  monkeyArm: new THREE.CylinderGeometry(0.12, 0.1, 1.5, 6),
  monkeyTail: new THREE.CylinderGeometry(0.08, 0.05, 2, 6)
};

// Animal type definitions
const ANIMAL_TYPES = {
  // Passive (flee)
  deer: { health: 60, speed: 48, fleeDistance: 55, color: 0x8b5a2b, scale: 1.0, drops: ['health', 'ammo'] },
  rabbit: { health: 20, speed: 60, fleeDistance: 30, color: 0x999999, scale: 0.4, drops: ['ammo'] },
  elk: { health: 100, speed: 40, fleeDistance: 60, color: 0x6b4226, scale: 1.3, drops: ['health', 'health'] },
  bison: { health: 150, speed: 25, fleeDistance: 40, color: 0x2c1810, scale: 1.5, drops: ['health', 'health', 'ammo'] },
  fox: { health: 40, speed: 55, fleeDistance: 45, color: 0xd4660a, scale: 0.7, drops: ['ammo'] },
  turtle: { health: 80, speed: 8, fleeDistance: 20, color: 0x2d5a27, scale: 0.8, drops: ['health'] },
  monkey: { health: 35, speed: 45, fleeDistance: 40, color: 0x8b6914, scale: 0.6, drops: ['ammo'] },
  horse: { health: 150, speed: 60, fleeDistance: 25, color: 0x8b4513, scale: 1.3, drops: [] },

  // Aggressive (attack)
  wolf: { health: 70, speed: 45, attackDistance: 80, color: 0x555555, scale: 0.9, damage: 15, drops: ['health'] },
  bear: { health: 200, speed: 30, attackDistance: 50, color: 0x4a2a0a, scale: 1.8, damage: 35, drops: ['health', 'health'] },
  tiger: { health: 120, speed: 55, attackDistance: 70, color: 0xff8c00, scale: 1.2, damage: 25, drops: ['health', 'health'] },
  mountain_lion: { health: 90, speed: 50, attackDistance: 60, color: 0xc4a35a, scale: 1.0, damage: 20, drops: ['health'] },
  boar: { health: 80, speed: 38, fleeDistance: 35, color: 0x3a3a3a, scale: 1.0, drops: ['health', 'ammo'], charges: true },
  snake: { health: 15, speed: 20, attackDistance: 15, color: 0x228b22, scale: 0.3, damage: 10, drops: ['ammo'] },

  // Aquatic
  fish: { health: 10, speed: 15, color: 0x4488aa, scale: 0.5, drops: ['ammo'] },

  // Flying
  eagle: { health: 40, speed: 35, color: 0x3d2b1f, scale: 0.8, drops: ['ammo'] },
  hawk: { health: 30, speed: 40, color: 0x8b4513, scale: 0.6, drops: ['ammo'] },
  owl: { health: 30, speed: 25, color: 0x6b5b3a, scale: 0.7, drops: ['ammo'] }
};

// Material cache
const materialCache = {};
function getMaterial(color) {
  if (!materialCache[color]) {
    materialCache[color] = new THREE.MeshLambertMaterial({ color });
  }
  return materialCache[color];
}

let allAnimals = [];
const _animalDir = new THREE.Vector3();

function addExistingParts(group, parts) {
  // Some animal variants intentionally omit limbs; only pass real Object3D instances to Three.
  parts.forEach(part => {
    if (part) group.add(part);
  });
}

export function initAnimals() {
  state._allAnimals = allAnimals;
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
  initHawks();
  initOwls();
  initFish();
  initFoxes();
  initTurtles();
  initMonkeys();
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

    case 'bear':
      body = new THREE.Mesh(sharedGeos.bearBody, bodyMat);
      body.position.y = 3.0;
      body.scale.set(1, 0.8, 1.2);
      head = new THREE.Mesh(sharedGeos.bearHead, bodyMat);
      head.position.set(0, 4.5, 2.5);
      legFL = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 2.5, 6), bodyMat);
      legFR = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 2.5, 6), bodyMat);
      legBL = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 2.5, 6), bodyMat);
      legBR = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 2.5, 6), bodyMat);
      legFL.position.set(-1.2, 1.2, 1.5);
      legFR.position.set(1.2, 1.2, 1.5);
      legBL.position.set(-1.2, 1.2, -1.5);
      legBR.position.set(1.2, 1.2, -1.5);
      break;

    case 'fox':
      body = new THREE.Mesh(sharedGeos.foxBody, bodyMat);
      body.position.y = 1.5;
      head = new THREE.Mesh(sharedGeos.foxHead, bodyMat);
      head.position.set(0, 2.2, 1.8);
      const foxTail = new THREE.Mesh(sharedGeos.foxTail, bodyMat);
      foxTail.position.set(0, 1.8, -2.5);
      foxTail.rotation.x = -Math.PI / 3;
      group.add(foxTail);
      legFL = new THREE.Mesh(sharedGeos.leg, bodyMat);
      legFR = new THREE.Mesh(sharedGeos.leg, bodyMat);
      legBL = new THREE.Mesh(sharedGeos.leg, bodyMat);
      legBR = new THREE.Mesh(sharedGeos.leg, bodyMat);
      legFL.position.set(-0.5, 0.8, 0.8);
      legFR.position.set(0.5, 0.8, 0.8);
      legBL.position.set(-0.5, 0.8, -0.8);
      legBR.position.set(0.5, 0.8, -0.8);
      break;

    case 'turtle':
      body = new THREE.Mesh(sharedGeos.turtleBody, bodyMat);
      body.position.y = 0.5;
      const shell = new THREE.Mesh(sharedGeos.turtleShell, getMaterial(0x3a6b35));
      shell.position.y = 0.8;
      group.add(shell);
      head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 6), bodyMat);
      head.position.set(0, 0.6, 1.2);
      legFL = new THREE.Mesh(sharedGeos.turtleLeg, bodyMat);
      legFR = new THREE.Mesh(sharedGeos.turtleLeg, bodyMat);
      legBL = new THREE.Mesh(sharedGeos.turtleLeg, bodyMat);
      legBR = new THREE.Mesh(sharedGeos.turtleLeg, bodyMat);
      legFL.position.set(-0.7, 0.3, 0.6);
      legFR.position.set(0.7, 0.3, 0.6);
      legBL.position.set(-0.7, 0.3, -0.6);
      legBR.position.set(0.7, 0.3, -0.6);
      break;

    case 'monkey':
      body = new THREE.Mesh(sharedGeos.monkeyBody, bodyMat);
      body.position.y = 1.5;
      head = new THREE.Mesh(sharedGeos.monkeyHead, bodyMat);
      head.position.set(0, 2.5, 0.3);
      const armL = new THREE.Mesh(sharedGeos.monkeyArm, bodyMat);
      armL.position.set(-0.8, 1.8, 0.3);
      armL.rotation.z = 0.3;
      const armR = new THREE.Mesh(sharedGeos.monkeyArm, bodyMat);
      armR.position.set(0.8, 1.8, 0.3);
      armR.rotation.z = -0.3;
      const monkeyTail = new THREE.Mesh(sharedGeos.monkeyTail, bodyMat);
      monkeyTail.position.set(0, 1.5, -1.2);
      monkeyTail.rotation.x = -Math.PI / 4;
      group.add(armL, armR, monkeyTail);
      legFL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 1.2, 6), bodyMat);
      legFR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 1.2, 6), bodyMat);
      legFL.position.set(-0.3, 0.5, 0);
      legFR.position.set(0.3, 0.5, 0);
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
  } else if (type === 'bear') {
    eyeL.position.set(-0.6, 4.8, 3.2);
    eyeR.position.set(0.6, 4.8, 3.2);
    pupilL.position.set(-0.6, 4.8, 3.3);
    pupilR.position.set(0.6, 4.8, 3.3);
  } else if (type === 'turtle') {
    eyeL.position.set(-0.25, 0.7, 1.4);
    eyeR.position.set(0.25, 0.7, 1.4);
    pupilL.position.set(-0.25, 0.7, 1.45);
    pupilR.position.set(0.25, 0.7, 1.45);
  } else if (type === 'monkey') {
    eyeL.position.set(-0.25, 2.7, 0.7);
    eyeR.position.set(0.25, 2.7, 0.7);
    pupilL.position.set(-0.25, 2.7, 0.75);
    pupilR.position.set(0.25, 2.7, 0.75);
  } else if (type === 'owl') {
    // Owl eyes are bigger
    const owlEyeL = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), sharedMats.eyeWhite);
    const owlEyeR = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), sharedMats.eyeWhite);
    owlEyeL.position.set(-0.3, 1.0, 0.7);
    owlEyeR.position.set(0.3, 1.0, 0.7);
    group.add(owlEyeL, owlEyeR);
  } else {
    eyeL.position.set(-0.5, 3.7, 2.8);
    eyeR.position.set(0.5, 3.7, 2.8);
    pupilL.position.set(-0.5, 3.7, 2.85);
    pupilR.position.set(0.5, 3.7, 2.85);
  }

  if (type !== 'owl') {
    group.add(eyeL, eyeR, pupilL, pupilR);
  }
  if (body) group.add(body);
  if (head) group.add(head);
  addExistingParts(group, [legFL, legFR, legBL, legBR]);

  // Tail for some animals
  if (['deer', 'wolf', 'tiger', 'horse', 'elk', 'bison'].includes(type)) {
    const tail = new THREE.Mesh(sharedGeos.tail, bodyMat);
    tail.position.set(0, 2.8, -2.5);
    tail.rotation.x = -Math.PI / 4;
    group.add(tail);
  }

  // Antlers for deer/elk
  if (type === 'deer' || type === 'elk') {
    const antlerL = new THREE.Mesh(sharedGeos.antler, sharedMats.antler);
    antlerL.position.set(-0.4, 4.5, 2.2);
    antlerL.rotation.z = -0.5;
    const antlerR = new THREE.Mesh(sharedGeos.antler, sharedMats.antler);
    antlerR.position.set(0.4, 4.5, 2.2);
    antlerR.rotation.z = 0.5;
    group.add(antlerL, antlerR);
  }

  // Horse saddle
  if (type === 'horse') {
    const saddle = new THREE.Mesh(sharedGeos.saddle, sharedMats.saddle);
    saddle.position.set(0, 3.8, 0);
    group.add(saddle);
    const mane = new THREE.Mesh(sharedGeos.mane, sharedMats.mane);
    mane.position.set(0, 4.0, 1.0);
    group.add(mane);
  }

  // Tiger stripes
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
    id: idx, type, mesh: group, bodyMesh: body, headMesh: head,
    legFL, legFR, legBL, legBR,
    vx: (Math.random() - 0.5) * 10, vz: (Math.random() - 0.5) * 10,
    state: 'wander', health: config.health, maxHealth: config.health,
    alive: true, changeDirTime: 0, fearCooldown: 0, attackCooldown: 0, config
  };

  allAnimals.push(animal);
  state._allAnimals = allAnimals;
  return animal;
}

// ========== INIT FUNCTIONS ==========
function initBirds() {
  for (let i = 0; i < 80; i++) {
    const birdGroup = new THREE.Group();
    const body = new THREE.Mesh(sharedGeos.birdBody, sharedMats.dark);
    body.rotation.x = Math.PI / 2;
    const wingL = new THREE.Mesh(sharedGeos.birdWing, sharedMats.wing);
    wingL.position.set(-1.75, 0, 0);
    const wingR = new THREE.Mesh(sharedGeos.birdWing, sharedMats.wing);
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
    state.birds.push({ mesh: birdGroup, wingL, wingR, cx, cz, cy, radius, speed, angle });
  }
}

function initDeers() {
  const config = ANIMAL_TYPES.deer;
  for (let h = 0; h < 25; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) spawnAnimal('deer', cx + (Math.random() - 0.5) * 50, cz + (Math.random() - 0.5) * 50, config);
  }
}

function initBoars() {
  const config = ANIMAL_TYPES.boar;
  for (let h = 0; h < 15; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) spawnAnimal('boar', cx + (Math.random() - 0.5) * 30, cz + (Math.random() - 0.5) * 30, config);
  }
}

function initRabbits() {
  const config = ANIMAL_TYPES.rabbit;
  for (let i = 0; i < 60; i++) spawnAnimal('rabbit', (Math.random() - 0.5) * MAP_SIZE * 0.9, (Math.random() - 0.5) * MAP_SIZE * 0.9, config);
}

function initWolves() {
  const config = ANIMAL_TYPES.wolf;
  for (let h = 0; h < 12; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) spawnAnimal('wolf', cx + (Math.random() - 0.5) * 30, cz + (Math.random() - 0.5) * 30, config);
  }
}

function initBears() {
  const config = ANIMAL_TYPES.bear;
  for (let i = 0; i < 15; i++) spawnAnimal('bear', (Math.random() - 0.5) * MAP_SIZE * 0.8, (Math.random() - 0.5) * MAP_SIZE * 0.8, config);
}

function initTigers() {
  const config = ANIMAL_TYPES.tiger;
  for (let i = 0; i < 12; i++) spawnAnimal('tiger', (Math.random() - 0.5) * MAP_SIZE * 0.8, (Math.random() - 0.5) * MAP_SIZE * 0.8, config);
}

function initMountainLions() {
  const config = ANIMAL_TYPES.mountain_lion;
  for (let i = 0; i < 15; i++) spawnAnimal('mountain_lion', (Math.random() - 0.5) * MAP_SIZE * 0.8, (Math.random() - 0.5) * MAP_SIZE * 0.8, config);
}

function initElk() {
  const config = ANIMAL_TYPES.elk;
  for (let h = 0; h < 12; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) spawnAnimal('elk', cx + (Math.random() - 0.5) * 40, cz + (Math.random() - 0.5) * 40, config);
  }
}

function initBison() {
  const config = ANIMAL_TYPES.bison;
  for (let h = 0; h < 8; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 4 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) spawnAnimal('bison', cx + (Math.random() - 0.5) * 50, cz + (Math.random() - 0.5) * 50, config);
  }
}

function initHorses() {
  const config = ANIMAL_TYPES.horse;
  for (let h = 0; h < 15; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) spawnAnimal('horse', cx + (Math.random() - 0.5) * 40, cz + (Math.random() - 0.5) * 40, config);
  }
}

function initSnakes() {
  const config = ANIMAL_TYPES.snake;
  for (let i = 0; i < 40; i++) spawnAnimal('snake', (Math.random() - 0.5) * MAP_SIZE * 0.9, (Math.random() - 0.5) * MAP_SIZE * 0.9, config);
}

function initEagles() {
  const config = ANIMAL_TYPES.eagle;
  for (let i = 0; i < 40; i++) spawnAnimal('eagle', (Math.random() - 0.5) * MAP_SIZE * 0.8, (Math.random() - 0.5) * MAP_SIZE * 0.8, config);
}

function initHawks() {
  const config = ANIMAL_TYPES.hawk;
  for (let i = 0; i < 30; i++) spawnAnimal('hawk', (Math.random() - 0.5) * MAP_SIZE * 0.8, (Math.random() - 0.5) * MAP_SIZE * 0.8, config);
}

function initOwls() {
  const config = ANIMAL_TYPES.owl;
  for (let i = 0; i < 25; i++) spawnAnimal('owl', (Math.random() - 0.5) * MAP_SIZE * 0.8, (Math.random() - 0.5) * MAP_SIZE * 0.8, config);
}

function initFish() {
  const config = ANIMAL_TYPES.fish;
  for (let i = 0; i < 80; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let y = getTerrainHeight(x, z);
    if (y < 2 && y > -5) {
      const animal = spawnAnimal('fish', x, z, config);
      if (animal) animal.mesh.position.y = 0.5;
    }
  }
}

function initFoxes() {
  const config = ANIMAL_TYPES.fox;
  for (let h = 0; h < 15; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) spawnAnimal('fox', cx + (Math.random() - 0.5) * 30, cz + (Math.random() - 0.5) * 30, config);
  }
}

function initTurtles() {
  const config = ANIMAL_TYPES.turtle;
  for (let i = 0; i < 30; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let y = getTerrainHeight(x, z);
    if (y > 0 && y < 5) spawnAnimal('turtle', x, z, config);
  }
}

function initMonkeys() {
  const config = ANIMAL_TYPES.monkey;
  for (let h = 0; h < 10; h++) {
    let cx = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let cz = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let count = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) spawnAnimal('monkey', cx + (Math.random() - 0.5) * 30, cz + (Math.random() - 0.5) * 30, config);
  }
}

// ========== UPDATE ==========
export function updateAnimals(delta) {
  let now = Date.now();
  let playerPos = state.controls.getObject().position;

  allAnimals.forEach(animal => {
    if (!animal.alive) return;

    const config = animal.config;
    const aPos = animal.mesh.position;
    const dxPlayer = aPos.x - playerPos.x;
    const dzPlayer = aPos.z - playerPos.z;
    const distToPlayerSq = dxPlayer * dxPlayer + dzPlayer * dzPlayer;

    // Skip distant animals
    if (distToPlayerSq > 500 * 500) {
      animal.mesh.visible = false;
      animal._farHidden = true;
      if ((state.frameId + animal.id) % 30 !== 0) return;
      animal.vx *= 0.98;
      animal.vz *= 0.98;
      return;
    }
    animal.mesh.visible = true;
    animal._farHidden = false;

    const isMidRange = distToPlayerSq > 250 * 250;
    if (isMidRange && (state.frameId + animal.id) % 3 !== 0) return;
    const stepDelta = isMidRange ? delta * 3 : delta;

    const COLLISION_DIST = 4.0;
    const distToPlayer = Math.sqrt(distToPlayerSq);

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
        let dir = _animalDir.subVectors(aPos, playerPos);
        dir.y = 0; dir.normalize();
        animal.vx = dir.x * config.speed;
        animal.vz = dir.z * config.speed;
        animal.mesh.lookAt(aPos.x + animal.vx, aPos.y, aPos.z + animal.vz);
        break;
      }
      case 'charge': {
        let dir = _animalDir.subVectors(playerPos, aPos);
        dir.y = 0; dir.normalize();
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
          playerHit(config.damage || 12, aPos); // Pass position for hit direction
          showNotice(`💥 被${getAnimalName(animal.type)}攻击！(-${config.damage || 12} HP)`, "#f39c12");
        }
        break;
      }
      case 'attack': {
        let dir = _animalDir.subVectors(playerPos, aPos);
        dir.y = 0; dir.normalize();
        animal.vx = dir.x * config.speed * 0.9;
        animal.vz = dir.z * config.speed * 0.9;
        animal.mesh.lookAt(playerPos.x, aPos.y, playerPos.z);
        if (distToPlayer < 5.0 && now > animal.attackCooldown) {
          animal.attackCooldown = now + 1500;
          animal.vx = -dir.x * 15;
          animal.vz = -dir.z * 15;
          playerHit(config.damage || 15, aPos); // Pass position for hit direction
          showNotice(`⚠️ 被${getAnimalName(animal.type)}抓咬！(-${config.damage || 15} HP)`, "#e74c3c");
        }
        break;
      }
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
      }
    }

    // Movement with collision
    const oldX = aPos.x;
    const oldZ = aPos.z;
    let newX = aPos.x + animal.vx * stepDelta;
    let newZ = aPos.z + animal.vz * stepDelta;

    // Check collision before moving (skip for flying and swimming animals)
    const isFlying = ['eagle', 'hawk', 'owl'].includes(animal.type);
    const isSwimming = animal.type === 'fish';

    if (!isFlying && !isSwimming) {
      const nearbyColliders = getNearbyColliders(aPos.x, aPos.z);
      const nearbyDoors = getNearbyDoors(aPos.x, aPos.z);
      let collision = checkEntityCollision(oldX, oldZ, newX, newZ, aPos.y, 4, {
        colliders: nearbyColliders,
        doors: nearbyDoors
      });
      if (!collision.blocked) {
        aPos.x = newX;
        aPos.z = newZ;
      } else {
        aPos.x = collision.x;
        aPos.z = collision.z;
        // Bounce away on collision
        animal.vx = -animal.vx * 0.5;
        animal.vz = -animal.vz * 0.5;
      }
    } else {
      aPos.x = newX;
      aPos.z = newZ;
    }
    aPos.y = getTerrainHeight(aPos.x, aPos.z);

    // House wall collision for animals
    if (animal.type !== 'fish' && animal.type !== 'eagle' && animal.type !== 'hawk' && animal.type !== 'owl') {
      const nearbyDoors = getNearbyDoors(aPos.x, aPos.z);
      for (let i = 0; i < nearbyDoors.length; i++) {
        const d = nearbyDoors[i];
        const hPos = d.housePos;
        const adx = aPos.x - hPos.x;
        const adz = aPos.z - hPos.z;
        const baseY = hPos.baseHeight ?? hPos.y;
        const animalHeight = 5 * (animal.config.scale || 1);

        if (aPos.y + animalHeight > baseY && aPos.y < baseY + 24) {
          const absX = Math.abs(adx);
          const absZ = Math.abs(adz);

          if (absX < 16.2 && absZ < 16.2) {
            let wallHit = false;

            // Left wall
            if (adx >= -16.2 && adx <= -13.5 && adz >= -16.2 && adz <= 16.2) wallHit = true;
            // Right wall
            else if (adx >= 13.5 && adx <= 16.2 && adz >= -16.2 && adz <= 16.2) wallHit = true;
            // Back wall
            else if (adz >= -16.2 && adz <= -13.5 && adx >= -16.2 && adx <= 16.2) wallHit = true;
            // Front wall left
            else if (adz >= 13.5 && adz <= 16.2 && adx >= -16.2 && adx <= -3.1) wallHit = true;
            // Front wall right
            else if (adz >= 13.5 && adz <= 16.2 && adx >= 3.1 && adx <= 16.2) wallHit = true;
            // Door (closed)
            else if (!d.isOpen && adz >= 13.5 && adz <= 16.2 && adx >= -3.25 && adx <= 3.25) wallHit = true;

            if (wallHit) {
              aPos.x = oldX;
              aPos.z = oldZ;
              // Bounce away
              animal.vx = -animal.vx * 0.5;
              animal.vz = -animal.vz * 0.5;
              break;
            }
          }
        }
      }
    }

    // Player collision
    const isAggressive = config.attackDistance || config.charges;
    const MIN_DIST = isAggressive ? 2.5 : 8.0;
    const dx = aPos.x - playerPos.x;
    const dz = aPos.z - playerPos.z;
    const newDistSq = dx * dx + dz * dz;
    if (newDistSq < MIN_DIST * MIN_DIST && animal.type !== 'fish') {
      const newDist = Math.sqrt(newDistSq);
      const pushX = dx / newDist;
      const pushZ = dz / newDist;
      aPos.x = playerPos.x + pushX * MIN_DIST;
      aPos.z = playerPos.z + pushZ * MIN_DIST;
      aPos.y = getTerrainHeight(aPos.x, aPos.z);
      if (!isAggressive) {
        animal.vx = pushX * 40;
        animal.vz = pushZ * 40;
        animal.state = 'wander';
        animal.attackCooldown = now + 5000;
        animal.changeDirTime = now + 3000;
        animal.fearCooldown = now + 4000;
      }
    }

    // Boundary
    if (Math.abs(aPos.x) > MAP_SIZE / 2 || Math.abs(aPos.z) > MAP_SIZE / 2) {
      aPos.x = (Math.random() - 0.5) * MAP_SIZE * 0.4;
      aPos.z = (Math.random() - 0.5) * MAP_SIZE * 0.4;
      aPos.y = getTerrainHeight(aPos.x, aPos.z);
    }

    // Leg animation
    let moveSpeedSq = animal.vx * animal.vx + animal.vz * animal.vz;
    if (moveSpeedSq > 1 && animal.legFL && animal.legFR && animal.legBL && animal.legBR) {
      let swingFreq = animal.state === 'flee' ? 0.024 : 0.012;
      let swing = Math.sin(now * swingFreq) * 0.65;
      animal.legFL.rotation.x = swing;
      animal.legFR.rotation.x = -swing;
      animal.legBL.rotation.x = -swing;
      animal.legBR.rotation.x = swing;
    } else if (animal.legFL && animal.legFR && animal.legBL && animal.legBR) {
      animal.legFL.rotation.x = 0;
      animal.legFR.rotation.x = 0;
      animal.legBL.rotation.x = 0;
      animal.legBR.rotation.x = 0;
    }

    animal.vx *= 0.98;
    animal.vz *= 0.98;
  });

  // Birds
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
    fish: '鱼', eagle: '雄鹰', hawk: '猎鹰', owl: '猫头鹰', snake: '毒蛇',
    horse: '野马', fox: '狐狸', turtle: '乌龟', monkey: '猴子'
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
    if (r < 0.5) spawnSingleLoot(animal.mesh.position.x, animal.mesh.position.y, animal.mesh.position.z, drops[0]);
    else if (drops.length > 1) spawnSingleLoot(animal.mesh.position.x, animal.mesh.position.y, animal.mesh.position.z, drops[1]);
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
