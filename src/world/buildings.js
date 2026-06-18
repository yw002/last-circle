// New building types: military bases, ruins, lighthouses, bridges, mines, farms

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from './terrain.js';
import { getBiomeAt, BIOME } from './biomes.js';
import { registerStaticObject } from '../systems/staticVisibility.js';
import { spawnLoot } from './loot.js';

// Shared materials
const metalMat = new THREE.MeshLambertMaterial({ color: 0x4A5A2A });
const containerMat = new THREE.MeshLambertMaterial({ color: 0x3A4A2A });
const fenceMat = new THREE.MeshLambertMaterial({ color: 0x888888, wireframe: true });
const stoneMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
const stoneBrokenMat = new THREE.MeshLambertMaterial({ color: 0x6A6A6A });
const goldMat = new THREE.MeshLambertMaterial({ color: 0xDAA520 });
const lighthouseWhite = new THREE.MeshLambertMaterial({ color: 0xF5F5F5 });
const lighthouseRed = new THREE.MeshLambertMaterial({ color: 0xCC3333 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.3 });
const woodMat = new THREE.MeshLambertMaterial({ color: 0x6B4226 });
const woodDarkMat = new THREE.MeshLambertMaterial({ color: 0x4A2F1D });
const barnRedMat = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
const hayMat = new THREE.MeshLambertMaterial({ color: 0xDAA520 });
const ironMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
const lanternMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

// Building placement tracking
const buildingPositions = [];

function tooCloseToBuildings(x, z, minDist) {
  for (let i = 0; i < buildingPositions.length; i++) {
    const b = buildingPositions[i];
    const dx = x - b.x, dz = z - b.z;
    if (dx * dx + dz * dz < minDist * minDist) return true;
  }
  return false;
}

function addBuildingCollider(group, x, y, z, w, h, d) {
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + h / 2, z),
    new THREE.Vector3(w, h, d)
  );
  box.userData = { kind: 'building', standable: false };
  state.colliders.push(box);
}

function addStandableSurface(x, y, z, w, d) {
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y, z),
    new THREE.Vector3(w, 1, d)
  );
  box.userData = { kind: 'bridge', standable: true };
  state.colliders.push(box);
}

// ========== MILITARY BASE ==========
function createMilitaryBase(x, y, z) {
  const group = new THREE.Group();

  // 3-5 containers
  const containerGeo = new THREE.BoxGeometry(10, 8, 20);
  const containerCount = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < containerCount; i++) {
    const container = new THREE.Mesh(containerGeo, containerMat);
    container.position.set((i - 1) * 14, 4, (Math.random() - 0.5) * 10);
    container.rotation.y = Math.random() * 0.3;
    container.userData = { isBuilding: true, impactMaterial: 'metal' };
    group.add(container);
  }

  // Fence perimeter (4 sides)
  const fenceGeo = new THREE.BoxGeometry(50, 6, 0.3);
  const fencePositions = [
    { x: 0, z: 30 }, { x: 0, z: -30 },
    { x: 30, z: 0, ry: Math.PI / 2 }, { x: -30, z: 0, ry: Math.PI / 2 }
  ];
  for (const fp of fencePositions) {
    const fence = new THREE.Mesh(fenceGeo, fenceMat);
    fence.position.set(fp.x, 3, fp.z);
    if (fp.ry) fence.rotation.y = fp.ry;
    group.add(fence);
  }

  // Radar tower
  const poleGeo = new THREE.CylinderGeometry(1, 1.5, 40, 6);
  const pole = new THREE.Mesh(poleGeo, metalMat);
  pole.position.set(20, 20, -20);
  pole.userData = { isBuilding: true, impactMaterial: 'metal' };
  group.add(pole);

  const dishGeo = new THREE.SphereGeometry(5, 8, 6, 0, Math.PI);
  const dish = new THREE.Mesh(dishGeo, metalMat);
  dish.position.set(20, 42, -20);
  dish.rotation.x = -Math.PI / 4;
  group.add(dish);

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 1800);

  // Colliders for containers
  for (let i = 0; i < containerCount; i++) {
    addBuildingCollider(group, x + (i - 1) * 14, y, z, 10, 8, 20);
  }

  buildingPositions.push({ x, z });
  spawnLoot(x, y, z); // high-quality loot
  spawnLoot(x + 10, y, z + 5);
}

// ========== ANCIENT RUINS ==========
function createAncientRuins(x, y, z) {
  const group = new THREE.Group();

  // Stone pillars (4-8, some tilted)
  const pillarGeo = new THREE.CylinderGeometry(3, 4, 30, 8);
  const pillarCount = 4 + Math.floor(Math.random() * 5);
  for (let i = 0; i < pillarCount; i++) {
    const pillar = new THREE.Mesh(pillarGeo, stoneMat);
    const angle = (i / pillarCount) * Math.PI * 2;
    const radius = 15 + Math.random() * 10;
    pillar.position.set(Math.cos(angle) * radius, 15, Math.sin(angle) * radius);
    pillar.rotation.z = (Math.random() - 0.5) * 0.3;
    pillar.rotation.x = (Math.random() - 0.5) * 0.2;
    pillar.userData = { isBuilding: true, impactMaterial: 'stone' };
    group.add(pillar);
  }

  // Broken arch
  const archGeo = new THREE.TorusGeometry(8, 2, 6, 8, Math.PI);
  const arch = new THREE.Mesh(archGeo, stoneBrokenMat);
  arch.position.set(0, 20, 0);
  arch.rotation.x = Math.PI / 2;
  group.add(arch);

  // Statue
  const statueBase = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 5), stoneMat);
  statueBase.position.set(-15, 1, 10);
  group.add(statueBase);
  const statueBody = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 12, 6), stoneMat);
  statueBody.position.set(-15, 8, 10);
  group.add(statueBody);
  const statueHead = new THREE.Mesh(new THREE.SphereGeometry(2.5, 6, 6), stoneMat);
  statueHead.position.set(-15, 16, 10);
  group.add(statueHead);

  // Treasure chest
  const chestGeo = new THREE.BoxGeometry(3, 2, 2);
  const chest = new THREE.Mesh(chestGeo, goldMat);
  chest.position.set(5, 1, -5);
  group.add(chest);

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 1500);

  buildingPositions.push({ x, z });
  spawnLoot(x + 5, y, z - 5); // treasure loot
  spawnLoot(x - 5, y, z + 5);
}

// ========== LIGHTHOUSE ==========
function createLighthouse(x, y, z) {
  const group = new THREE.Group();

  // Tower body (white with red stripes)
  const towerGeo = new THREE.CylinderGeometry(5, 8, 60, 12);
  const tower = new THREE.Mesh(towerGeo, lighthouseWhite);
  tower.position.y = 30;
  tower.userData = { isBuilding: true, impactMaterial: 'building' };
  group.add(tower);

  // Red stripe bands
  const stripeGeo = new THREE.CylinderGeometry(6, 7, 4, 12);
  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(stripeGeo, lighthouseRed);
    stripe.position.y = 15 + i * 18;
    group.add(stripe);
  }

  // Glass lamp room
  const lampRoomGeo = new THREE.CylinderGeometry(6, 6, 8, 12);
  const lampRoom = new THREE.Mesh(lampRoomGeo, glassMat);
  lampRoom.position.y = 64;
  group.add(lampRoom);

  // Roof cap
  const capGeo = new THREE.ConeGeometry(7, 5, 12);
  const cap = new THREE.Mesh(capGeo, lighthouseRed);
  cap.position.y = 71;
  group.add(cap);

  // Rotating light (SpotLight)
  const spotlight = new THREE.SpotLight(0xFFFF88, 3, 500, 0.3, 0.5);
  spotlight.position.set(0, 64, 0);
  group.add(spotlight);
  group.userData.spotlight = spotlight;

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 2000);

  addBuildingCollider(group, x, y, z, 16, 60, 16);
  buildingPositions.push({ x, z });
}

// ========== BRIDGES ==========
function createBridge(x, y, z) {
  const group = new THREE.Group();
  const length = 40;
  const width = 8;

  // Bridge deck
  const deckGeo = new THREE.BoxGeometry(width, 1, length);
  const deck = new THREE.Mesh(deckGeo, woodMat);
  deck.position.y = 2;
  deck.userData = { isBuilding: true, impactMaterial: 'wood' };
  group.add(deck);

  // Support posts
  const postGeo = new THREE.CylinderGeometry(0.5, 0.5, 6, 5);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(postGeo, woodDarkMat);
      post.position.set(side * (width / 2 - 0.5), 5, -length / 2 + i * (length / 4));
      group.add(post);
    }
    // Railing
    const railGeo = new THREE.BoxGeometry(0.3, 0.3, length);
    const rail = new THREE.Mesh(railGeo, woodDarkMat);
    rail.position.set(side * (width / 2 - 0.5), 7.5, 0);
    group.add(rail);
  }

  // Support pillars underneath
  const pillarGeo = new THREE.CylinderGeometry(1.5, 2, 10, 6);
  for (let i = 0; i < 3; i++) {
    const pillar = new THREE.Mesh(pillarGeo, stoneMat);
    pillar.position.set(0, -4, -length / 2 + 5 + i * (length / 2 - 5));
    pillar.userData = { isBuilding: true, impactMaterial: 'stone' };
    group.add(pillar);
  }

  group.position.set(x, y + 1, z);
  group.rotation.y = Math.random() * Math.PI; // random orientation
  state.scene.add(group);
  registerStaticObject(group, x, z, 1200);

  // Standable surface on top
  addStandableSurface(x, y + 2.5, z, width, length);
  buildingPositions.push({ x, z });
}

// ========== MINE ENTRANCE ==========
function createMineEntrance(x, y, z) {
  const group = new THREE.Group();

  // Wooden frame
  const frameVertGeo = new THREE.BoxGeometry(2, 12, 2);
  const frameL = new THREE.Mesh(frameVertGeo, woodDarkMat);
  frameL.position.set(-5, 6, 0);
  group.add(frameL);
  const frameR = new THREE.Mesh(frameVertGeo, woodDarkMat);
  frameR.position.set(5, 6, 0);
  group.add(frameR);
  const frameTopGeo = new THREE.BoxGeometry(12, 2, 2);
  const frameTop = new THREE.Mesh(frameTopGeo, woodDarkMat);
  frameTop.position.set(0, 12, 0);
  group.add(frameTop);

  // Dark cave interior
  const caveGeo = new THREE.PlaneGeometry(8, 10);
  const cave = new THREE.Mesh(caveGeo, blackMat);
  cave.position.set(0, 5, -1);
  group.add(cave);

  // Rails
  const railGeo = new THREE.BoxGeometry(0.3, 0.2, 30);
  const railL = new THREE.Mesh(railGeo, ironMat);
  railL.position.set(-2, 0.1, 15);
  group.add(railL);
  const railR = new THREE.Mesh(railGeo, ironMat);
  railR.position.set(2, 0.1, 15);
  group.add(railR);

  // Cross ties
  const tieGeo = new THREE.BoxGeometry(6, 0.2, 0.8);
  for (let i = 0; i < 8; i++) {
    const tie = new THREE.Mesh(tieGeo, woodDarkMat);
    tie.position.set(0, 0.05, 3 + i * 3.5);
    group.add(tie);
  }

  // Mining cart
  const cartGeo = new THREE.BoxGeometry(4, 3, 5);
  const cart = new THREE.Mesh(cartGeo, ironMat);
  cart.position.set(0, 1.5, 18);
  cart.userData = { isBuilding: true, impactMaterial: 'metal' };
  group.add(cart);

  // Lanterns
  const lanternGeo = new THREE.SphereGeometry(0.8, 6, 6);
  const lantern1 = new THREE.Mesh(lanternGeo, lanternMat);
  lantern1.position.set(-6, 10, 0);
  group.add(lantern1);
  const light1 = new THREE.PointLight(0xFFD700, 1.5, 30);
  light1.position.copy(lantern1.position);
  group.add(light1);

  const lantern2 = new THREE.Mesh(lanternGeo, lanternMat);
  lantern2.position.set(6, 10, 0);
  group.add(lantern2);
  const light2 = new THREE.PointLight(0xFFD700, 1.5, 30);
  light2.position.copy(lantern2.position);
  group.add(light2);

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 1500);

  buildingPositions.push({ x, z });
  spawnLoot(x, y, z + 5);
}

// ========== FARM ==========
function createFarm(x, y, z) {
  const group = new THREE.Group();

  // Barn
  const barnGeo = new THREE.BoxGeometry(20, 15, 30);
  const barn = new THREE.Mesh(barnGeo, barnRedMat);
  barn.position.set(0, 7.5, 0);
  barn.userData = { isBuilding: true, impactMaterial: 'wood' };
  group.add(barn);

  // Barn roof
  const roofGeo = new THREE.BoxGeometry(22, 2, 32);
  const roof = new THREE.Mesh(roofGeo, woodDarkMat);
  roof.position.set(0, 16, 0);
  group.add(roof);
  const roofPeak = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 32), woodDarkMat);
  roofPeak.position.set(0, 20, 0);
  group.add(roofPeak);

  // Windmill tower
  const windmillGeo = new THREE.CylinderGeometry(3, 5, 30, 8);
  const windmill = new THREE.Mesh(windmillGeo, lighthouseWhite);
  windmill.position.set(25, 15, -15);
  windmill.userData = { isBuilding: true, impactMaterial: 'building' };
  group.add(windmill);

  // Windmill blades
  const bladeGeo = new THREE.BoxGeometry(1, 15, 0.5);
  const bladeMat = woodMat;
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(25, 30 + Math.sin(i * Math.PI / 2) * 7, -15);
    blade.rotation.z = (i / 4) * Math.PI * 2;
    group.add(blade);
  }

  // Fences
  const fencePostGeo = new THREE.BoxGeometry(0.5, 4, 0.5);
  const fenceRailGeo = new THREE.BoxGeometry(0.3, 0.3, 5);
  for (let i = 0; i < 8; i++) {
    const post = new THREE.Mesh(fencePostGeo, woodDarkMat);
    post.position.set(-20 + i * 6, 2, 25);
    group.add(post);
    if (i < 7) {
      const rail = new THREE.Mesh(fenceRailGeo, woodDarkMat);
      rail.position.set(-17 + i * 6, 3, 25);
      group.add(rail);
    }
  }

  // Haystacks (cover)
  const hayGeo = new THREE.CylinderGeometry(4, 4, 5, 8);
  for (let i = 0; i < 3; i++) {
    const hay = new THREE.Mesh(hayGeo, hayMat);
    hay.position.set(-15 + i * 8, 2.5, -20);
    hay.userData = { isBuilding: true, impactMaterial: 'wood' };
    group.add(hay);
  }

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 1800);

  addBuildingCollider(group, x, y, z, 20, 15, 30); // barn
  for (let i = 0; i < 3; i++) {
    addBuildingCollider(group, x - 15 + i * 8, y, z - 20, 8, 5, 8); // hay
  }

  buildingPositions.push({ x, z });
  spawnLoot(x, y, z);
}

// ========== INIT ALL BUILDINGS ==========
export function initBuildings() {
  // Military bases (3) - prefer flat areas
  let placed = 0;
  for (let i = 0; i < 200 && placed < 3; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < 5 || y > 30) continue;
    if (tooCloseToBuildings(x, z, 300)) continue;
    createMilitaryBase(x, y, z);
    placed++;
  }

  // Ancient ruins (5)
  placed = 0;
  for (let i = 0; i < 200 && placed < 5; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const y = getTerrainHeight(x, z);
    if (y < 3) continue;
    if (tooCloseToBuildings(x, z, 250)) continue;
    createAncientRuins(x, y, z);
    placed++;
  }

  // Lighthouses (2) - near water (low terrain)
  placed = 0;
  for (let i = 0; i < 200 && placed < 2; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < 2 || y > 10) continue; // near water level
    if (tooCloseToBuildings(x, z, 400)) continue;
    createLighthouse(x, y, z);
    placed++;
  }

  // Bridges (8) - placed randomly
  placed = 0;
  for (let i = 0; i < 200 && placed < 8; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < 1 || y > 8) continue;
    if (tooCloseToBuildings(x, z, 200)) continue;
    createBridge(x, y, z);
    placed++;
  }

  // Mine entrances (3) - prefer hilly/mountainous terrain
  placed = 0;
  for (let i = 0; i < 200 && placed < 3; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < 20 || y > 60) continue;
    if (tooCloseToBuildings(x, z, 300)) continue;
    createMineEntrance(x, y, z);
    placed++;
  }

  // Farms (5) - prefer flat, non-lava non-desert terrain
  placed = 0;
  for (let i = 0; i < 200 && placed < 5; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < 5 || y > 25) continue;
    const biome = getBiomeAt(x, z);
    if (biome === BIOME.DESERT || biome === BIOME.LAVA || biome === BIOME.SNOW) continue;
    if (tooCloseToBuildings(x, z, 250)) continue;
    createFarm(x, y, z);
    placed++;
  }
}
