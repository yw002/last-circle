// F3 collision volume visualizer for static colliders, house walls, and live entities.

import * as THREE from 'three';
import { state } from '../state.js';
import { getAllAliens } from '../entities/aliens.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';

const colors = {
  static: 0x00ffff,
  house: 0xffcc00,
  door: 0xff5500,
  player: 0x00ff00,
  bot: 0xff3333,
  zombie: 0x66ff66,
  animal: 0xff66ff,
  alien: 0x00ff88,
  boundary: 0xffffff
};

let enabled = false;
let group = null;
let staticBuilt = false;
const dynamicHelpers = [];
const _box = new THREE.Box3();
const _center = new THREE.Vector3();
const _size = new THREE.Vector3();
const _playerDebugCenter = new THREE.Vector3();
let terrainWire = null;

function ensureGroup() {
  if (group) return;
  group = new THREE.Group();
  group.name = 'collision-debug-volumes';
  state.scene.add(group);
}

function makeBoxHelper(box, color) {
  const helper = new THREE.Box3Helper(box.clone(), color);
  helper.material.depthTest = false;
  helper.material.transparent = true;
  helper.material.opacity = 0.75;
  group.add(helper);
  return helper;
}

function addBoxFromCenter(center, size, color) {
  _box.setFromCenterAndSize(center, size);
  return makeBoxHelper(_box, color);
}

function buildTerrainDebug() {
  if (terrainWire) return;

  const segments = 100;
  const geometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position.array;

  // This mirrors the actual ground collision query used by player/entity movement.
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    positions[i + 1] = getTerrainHeight(x, z) + 0.35;
  }
  geometry.computeVertexNormals();

  terrainWire = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0x44ff44,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      depthTest: false
    })
  );
  terrainWire.name = 'terrain-collision-debug';
  group.add(terrainWire);
}

function buildHouseDebug() {
  const sizeSide = new THREE.Vector3(2.7, 24, 32.4);
  const sizeBack = new THREE.Vector3(32.4, 24, 2.7);
  const sizeFront = new THREE.Vector3(13.1, 24, 2.7);
  const sizeDoor = new THREE.Vector3(6.5, 24, 2.7);

  for (let i = 0; i < state.doors.length; i++) {
    const h = state.doors[i].housePos;
    addBoxFromCenter(new THREE.Vector3(h.x - 14.85, h.y + 12, h.z), sizeSide, colors.house);
    addBoxFromCenter(new THREE.Vector3(h.x + 14.85, h.y + 12, h.z), sizeSide, colors.house);
    addBoxFromCenter(new THREE.Vector3(h.x, h.y + 12, h.z - 14.85), sizeBack, colors.house);
    addBoxFromCenter(new THREE.Vector3(h.x - 9.75, h.y + 12, h.z + 14.85), sizeFront, colors.house);
    addBoxFromCenter(new THREE.Vector3(h.x + 9.75, h.y + 12, h.z + 14.85), sizeFront, colors.house);
    addBoxFromCenter(new THREE.Vector3(h.x, h.y + 12, h.z + 14.85), sizeDoor, colors.door);
  }
}

function buildStaticDebug() {
  ensureGroup();
  for (let i = 0; i < state.colliders.length; i++) {
    makeBoxHelper(state.colliders[i], colors.static);
  }

  buildTerrainDebug();
  buildHouseDebug();
  addBoxFromCenter(new THREE.Vector3(0, 50, -MAP_SIZE / 2), new THREE.Vector3(MAP_SIZE, 100, 4), colors.boundary);
  addBoxFromCenter(new THREE.Vector3(0, 50, MAP_SIZE / 2), new THREE.Vector3(MAP_SIZE, 100, 4), colors.boundary);
  addBoxFromCenter(new THREE.Vector3(-MAP_SIZE / 2, 50, 0), new THREE.Vector3(4, 100, MAP_SIZE), colors.boundary);
  addBoxFromCenter(new THREE.Vector3(MAP_SIZE / 2, 50, 0), new THREE.Vector3(4, 100, MAP_SIZE), colors.boundary);
  staticBuilt = true;
}

function addDynamicHelper(color) {
  const helper = makeBoxHelper(new THREE.Box3(), color);
  dynamicHelpers.push(helper);
  return helper;
}

function setHelperBox(helper, center, size) {
  helper.box.setFromCenterAndSize(center, size);
  helper.visible = true;
}

function hideUnusedDynamic(startIndex) {
  for (let i = startIndex; i < dynamicHelpers.length; i++) {
    dynamicHelpers[i].visible = false;
  }
}

function updateDynamicDebug() {
  if (!enabled || !state.controls) return;

  let index = 0;
  const playerPos = state.controls.getObject().position;
  if (!dynamicHelpers[index]) addDynamicHelper(colors.player);
  _playerDebugCenter.set(playerPos.x, playerPos.y - 5, playerPos.z);
  setHelperBox(dynamicHelpers[index++], _playerDebugCenter, new THREE.Vector3(3, 10, 3));

  for (let i = 0; i < state.bots.length; i++) {
    const bot = state.bots[i];
    if (!bot.alive || !bot.mesh) continue;
    if (!dynamicHelpers[index]) addDynamicHelper(colors.bot);
    setHelperBox(dynamicHelpers[index++], bot.mesh.position, new THREE.Vector3(4, 8, 4));
  }

  for (let i = 0; i < state.zombies.length; i++) {
    const zombie = state.zombies[i];
    if (!zombie.alive || !zombie.mesh) continue;
    if (!dynamicHelpers[index]) addDynamicHelper(colors.zombie);
    setHelperBox(dynamicHelpers[index++], zombie.mesh.position, new THREE.Vector3(4, 7, 4));
  }

  const animals = state._allAnimals || [];
  for (let i = 0; i < animals.length; i++) {
    const animal = animals[i];
    if (!animal.alive || !animal.mesh) continue;
    if (!dynamicHelpers[index]) addDynamicHelper(colors.animal);
    const scale = animal.config && animal.config.scale ? animal.config.scale : 1;
    setHelperBox(dynamicHelpers[index++], animal.mesh.position, new THREE.Vector3(4 * scale, 5 * scale, 4 * scale));
  }

  const aliens = getAllAliens();
  for (let i = 0; i < aliens.length; i++) {
    const alien = aliens[i];
    if (!alien.alive || !alien.mesh) continue;
    if (!dynamicHelpers[index]) addDynamicHelper(colors.alien);
    setHelperBox(dynamicHelpers[index++], alien.mesh.position, new THREE.Vector3(5, 8, 5));
  }

  hideUnusedDynamic(index);
}

export function toggleCollisionDebug() {
  enabled = !enabled;
  ensureGroup();
  if (!staticBuilt) buildStaticDebug();
  group.visible = enabled;
  updateDynamicDebug();
  return enabled;
}

export function updateCollisionDebug() {
  updateDynamicDebug();
}

export function isCollisionDebugEnabled() {
  return enabled;
}
